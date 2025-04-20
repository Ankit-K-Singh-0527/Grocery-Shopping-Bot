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

// Use express.json() middleware to parse JSON bodies.
app.use(express.json());

// Middleware to ensure req.body is parsed correctly
app.use((req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    // In case body is empty, try to parse rawBody if available
    try {
      req.body = JSON.parse(req.rawBody || "{}");
    } catch (err) {
      console.error("Error parsing request body:", err);
      return res
        .status(400)
        .json({ status: "error", message: "Invalid JSON in request body." });
    }
  }
  next();
});

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

// /grocery-list GET endpoint: Retrieves the grocery list for a given user_id.
app.get("/grocery-list", async (req, res) => {
  console.log("GET /grocery-list query parameters:", req.query);
  const user_id = req.query.user_id;
  if (!user_id) {
    console.error("Missing user_id parameter in GET /grocery-list request.");
    return res
      .status(400)
      .json({ status: "error", message: "Missing user_id parameter." });
  }
  try {
    const query = "SELECT * FROM grocery_list WHERE user_id = $1";
    const result = await pool.query(query, [user_id]);
    console.log(`Found ${result.rowCount} record(s) for user_id ${user_id}`);
    const rows = result.rows.map(row => {
      try {
        row.items = JSON.parse(row.items);
      } catch (e) {
        console.error("Error parsing items for user:", row.user_id, e);
      }
      row.total_price = Number(row.total_price);
      return row;
    });
    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error("Error fetching grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list POST endpoint: Updates a grocery list record.
// This endpoint first retrieves the record for the provided user_id (using the GET logic)
// and then uses that stored user_id to update the grocery list (items, total_price, and budget).
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