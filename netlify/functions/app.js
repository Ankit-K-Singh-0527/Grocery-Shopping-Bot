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

// Additional middleware to ensure that the request body is parsed properly.
app.use((req, res, next) => {
  // If no keys exist, assume the body wasn't parsed.
  if (!req.body || Object.keys(req.body).length === 0) {
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
 * This logic is the same as used by the /generate-code endpoint.
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
    // Parse the 'items' field from JSON before sending the response.
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

// /grocery-list POST endpoint: Inserts or updates a grocery list record.
// This endpoint ignores the user_id sent by the client and instead fetches the record from the DB.
app.post("/grocery-list", async (req, res) => {
  console.log("Raw POST body:", req.body);
  const body = req.body;

  // Read the user_id from the client payload.
  const clientUserId = body.user_id || body.userId;
  if (!clientUserId) {
    return res.status(400).json({
      status: "error",
      message:
        "Missing user_id in request body. Please use the user_id obtained from /generate-code.",
    });
  }
  
  // Now, fetch the user_id from the database to ensure we use the same one generated via /generate-code.
  let dbUserId;
  try {
    const result = await pool.query(
      "SELECT user_id FROM grocery_list WHERE user_id = $1",
      [clientUserId]
    );
    if (result.rowCount > 0) {
      dbUserId = result.rows[0].user_id;
      console.log("Fetched user_id from DB:", dbUserId);
    } else {
      // If not found in the DB, instruct the client to run /generate-code.
      console.error("User_id not found in DB for:", clientUserId);
      return res.status(400).json({
        status: "error",
        message:
          "User not found in DB. Please use the user_id obtained from /generate-code.",
      });
    }
  } catch (err) {
    console.error("Error fetching user_id from DB:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Error fetching user_id from DB" });
  }
  
  // Use the DB user_id for the upsert.
  const user_id = dbUserId;
  const items = body.items;
  const total_price = body.total_price;
  const budget = body.budget;
  
  console.log("Parsed POST body using DB user_id:", {
    user_id,
    items,
    total_price,
    budget,
  });
  
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
    console.log("Upsert successfully executed for user_id:", user_id);
    res.json({ status: "success", user_id });
  } catch (err) {
    console.error("Error upserting grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports.handler = serverless(app);