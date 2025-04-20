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

// Use express.json() middleware to parse JSON bodies
app.use(express.json());

// Middleware to ensure req.body is always an object even if delivered as a string.
app.use((req, res, next) => {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch (err) {
      console.error("Error parsing request body:", err);
      return res.status(400).json({ status: "error", message: "Invalid JSON in request body." });
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

// /generate-code endpoint: Generates a unique user_id, stores an empty grocery list record, and returns the user_id.
app.get("/generate-code", async (req, res) => {
  try {
    let code = "";
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      try {
        const checkQuery = "SELECT * FROM grocery_list WHERE user_id = $1";
        const result = await pool.query(checkQuery, [code]);
        if (result.rowCount === 0) {
          const insertQuery = `
            INSERT INTO grocery_list (user_id, items, total_price, budget, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `;
          await pool.query(insertQuery, [code, JSON.stringify([]), 0, null]);
          return res.json({ status: "success", code });
        }
      } catch (dbError) {
        console.error("Database error during code check:", dbError);
        return res.status(500).json({ status: "error", message: "Database error during code check." });
      }
    }
    res.status(500).json({ status: "error", message: "Unable to generate a unique code after several attempts." });
  } catch (err) {
    console.error("Error generating code:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list GET endpoint: Retrieves the grocery list for a given user.
app.get("/grocery-list", async (req, res) => {
  console.log("GET /grocery-list query parameters:", req.query);
  const user_id = req.query.user_id;
  if (!user_id) {
    console.error("Missing user_id parameter in GET /grocery-list request.");
    return res.status(400).json({ status: "error", message: "Missing user_id parameter." });
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
app.post("/grocery-list", async (req, res) => {
  console.log("Raw POST body:", req.body);
  
  // Fallback: if user_id is not found, try checking for userId.
  const body = req.body;
  const user_id = body.user_id || body.userId;
  const items = body.items;
  const total_price = body.total_price;
  const budget = body.budget;
  
  if (!user_id) {
    return res.status(400).json({ status: "error", message: "Missing user_id in request body. Please use the user_id obtained from /generate-code." });
  }
  
  console.log("Parsed POST body:", { user_id, items, total_price, budget });
  
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
    await pool.query(upsertQuery, [user_id, JSON.stringify(items), total_price, budget]);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error upserting grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports.handler = serverless(app);