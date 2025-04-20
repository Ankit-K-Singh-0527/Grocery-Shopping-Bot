const express = require("express");
const { Pool } = require("pg");
const serverless = require("serverless-http");

const connectionString =
  "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";
console.log("Using connection string:", connectionString);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const app = express();

// Middleware to parse JSON bodies.
app.use(express.json());

// Middleware to strip the Netlify function prefix from the URL.
app.use((req, res, next) => {
  if (req.url.startsWith("/.netlify/functions/app")) {
    req.url = req.url.replace("/.netlify/functions/app", "");
  }
  next();
});

/**
 * Internal function to generate a unique user code.
 * This logic is used by the /generate-code endpoint.
 */
async function generateUserCodeInternal() {
  let code = "";
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    code = "user" + (Math.floor(Math.random() * 900) + 100);
    try {
      const checkQuery = "SELECT * FROM grocery_list WHERE user_id = $1";
      const result = await pool.query(checkQuery, [code]);
      if (result.rowCount === 0) {
        // Insert a new record with an empty list.
        const insertQuery = `
          INSERT INTO grocery_list (user_id, items, total_price, budget, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `;
        await pool.query(insertQuery, [code, JSON.stringify([]), 0, null]);
        return code;
      }
    } catch (dbError) {
      console.error("Database error during code check:", dbError);
      throw new Error("Database error during code check.");
    }
  }
  throw new Error("Unable to generate a unique code after several attempts.");
}

// /generate-code endpoint: Generates and returns a unique user_id.
app.get("/generate-code", async (req, res) => {
  try {
    const code = await generateUserCodeInternal();
    return res.json({ status: "success", code });
  } catch (err) {
    console.error("Error generating code:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list GET endpoint: Retrieves and updates the grocery list.
app.get("/grocery-list", async (req, res) => {
  console.log("GET /grocery-list query parameters:", req.query);
  const user_id = req.query.user_id;
  const items = req.query.items || []; // Default to an empty list if not provided.
  const total_price = req.query.total_price || 0; // Default to 0 if not provided.
  const budget = req.query.budget || null; // Default to null if not provided.

  if (!user_id) {
    console.error("Missing user_id parameter in GET /grocery-list request.");
    return res.status(400).json({ status: "error", message: "Missing user_id parameter." });
  }

  try {
    // Update the database with the provided values while fetching the record.
    const updateAndFetchQuery = `
      UPDATE grocery_list
      SET items = $2, total_price = $3, budget = $4
      WHERE user_id = $1
      RETURNING *;
    `;
    const result = await pool.query(updateAndFetchQuery, [user_id, JSON.stringify(items), total_price, budget]);

    if (result.rowCount === 0) {
      console.error("No record found for user_id:", user_id);
      return res.status(400).json({
        status: "error",
        message: "User not found in the database. Please use the /generate-code endpoint first.",
      });
    }

    const updatedRecord = result.rows[0];
    try {
      updatedRecord.items = JSON.parse(updatedRecord.items);
    } catch (e) {
      console.error("Error parsing items for user:", updatedRecord.user_id, e);
    }
    updatedRecord.total_price = Number(updatedRecord.total_price);

    console.log("Updated record for user_id:", updatedRecord.user_id);
    res.json({ status: "success", data: updatedRecord });
  } catch (err) {
    console.error("Error updating and fetching grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list POST endpoint: Updates a grocery list record.
app.post("/grocery-list", async (req, res) => {
  console.log("Raw POST body:", req.body);
  const body = req.body;
  const clientUserId = body.user_id || body.userId;
  if (!clientUserId) {
    return res.status(400).json({
      status: "error",
      message:
        "Missing user_id in request body. Please use the user_id obtained from /generate-code.",
    });
  }
  
  // Use the GET logic to retrieve the record from the DB.
  let dbRecord;
  try {
    const result = await pool.query("SELECT * FROM grocery_list WHERE user_id = $1", [clientUserId]);
    if (result.rowCount > 0) {
      dbRecord = result.rows[0];
      console.log("Fetched record from DB for user_id:", dbRecord.user_id);
    } else {
      console.error("No record found for user_id:", clientUserId);
      return res.status(400).json({
        status: "error",
        message: "User not found in DB. Please use the user_id obtained from /generate-code.",
      });
    }
  } catch (err) {
    console.error("Error fetching user record from DB:", err);
    return res.status(500).json({ status: "error", message: "DB error" });
  }
  
  // Use the stored user_id from the record.
  const user_id = dbRecord.user_id;
  // Update with provided values.
  const items = body.items;
  const total_price = body.total_price;
  const budget = body.budget;
  
  console.log("Updating record for user_id:", user_id, { items, total_price, budget });
  
  const upsertQuery = `
    INSERT INTO grocery_list (user_id, items, total_price, budget, created_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      items = EXCLUDED.items, 
      total_price = EXCLUDED.total_price, 
      budget = EXCLUDED.budget;
  `;
  
  try {
    await pool.query(upsertQuery, [
      user_id,
      JSON.stringify(items),
      total_price,
      budget,
    ]);
    console.log("Upsert executed successfully for user_id:", user_id);
    res.json({ status: "success", user_id });
  } catch (err) {
    console.error("Error upserting grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports.handler = serverless(app);