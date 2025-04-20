const express = require("express");
const { Pool } = require("pg");
const serverless = require("serverless-http");

const connectionString = "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";
console.log("Using connection string:", connectionString);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const app = express();

// Use the built-in JSON parser
app.use(express.json());

// Middleware to strip Netlify function prefix from the URL.
app.use((req, res, next) => {
  if (req.url.startsWith("/.netlify/functions/app")) {
    req.url = req.url.replace("/.netlify/functions/app", "");
  }
  next();
});

// /generate-code endpoint: generates a unique user code.
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

// /grocery-list GET endpoint: retrieves the grocery list for a given user.
app.get("/grocery-list", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId parameter." });
  }
  try {
    const query = "SELECT * FROM grocery_list WHERE user_id = $1";
    const result = await pool.query(query, [userId]);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error fetching grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list POST endpoint: inserts or updates a grocery list record.
app.post("/grocery-list", async (req, res) => {
  console.log("POST /grocery-list req.body:", req.body);  // Debug log
  const user_id = req.body.user_id || req.body.userId;
  const items = req.body.items;
  const total_price = req.body.total_price || req.body.totalPrice;
  const budget = req.body.budget;
  
  if (!user_id) {
    return res.status(400).json({ status: "error", message: "Missing user_id in request body." });
  }
  
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