const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const serverless = require("serverless-http");

// Hardcoded connection string as default.
const defaultConnectionString = "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";

// Use the environment variable PG_CONNECTION_STRING if provided, otherwise fallback to the default.
const connectionString = process.env.PG_CONNECTION_STRING || defaultConnectionString;

console.log("Using connection string:", connectionString);

const pool = new Pool({ connectionString });
const app = express();

app.use(bodyParser.json());

// /generate-code endpoint: generates a unique user code.
app.get("/generate-code", async (req, res) => {
  try {
    let code = "";
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      console.log(`Attempt ${attempt + 1}: Trying code ${code}`);
      try {
        const checkQuery = "SELECT * FROM grocery_list WHERE user_code = $1";
        const result = await pool.query(checkQuery, [code]);
        console.log(`Code ${code} checked, row count: ${result.rowCount}`);
        if (result.rowCount === 0) {
          console.log("Unique code found:", code);
          return res.json({ status: "success", code });
        } else {
          console.warn(`Code ${code} already exists. Trying a new one.`);
        }
      } catch (dbError) {
        console.error("Database error during code check:", dbError);
        return res.status(500).json({ status: "error", message: "Database error during code check." });
      }
    }
    console.error("Failed to generate a unique code after maximum attempts.");
    res.status(500).json({ status: "error", message: "Unable to generate a unique code after several attempts." });
  } catch (err) {
    console.error("Error in /generate-code endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list GET endpoint: retrieves the grocery list for a given user code.
app.get("/grocery-list", async (req, res) => {
  const userCode = req.query.userCode;
  if (!userCode) {
    return res.status(400).json({ status: "error", message: "Missing userCode parameter." });
  }
  try {
    const query = "SELECT * FROM grocery_list WHERE user_code = $1";
    const result = await pool.query(query, [userCode]);
    console.log(`Fetched grocery list for ${userCode}, row count: ${result.rowCount}`);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error in /grocery-list GET endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list POST endpoint: inserts or updates a grocery list record.
app.post("/grocery-list", async (req, res) => {
  // Accept either user_code or userCode, and total_price or totalPrice from the request body.
  const user_code = req.body.user_code || req.body.userCode;
  const items = req.body.items;
  const total_price = req.body.total_price || req.body.totalPrice;
  const budget = req.body.budget;
  if (!user_code) {
    return res.status(400).json({ status: "error", message: "Missing user_code in request body." });
  }
  const upsertQuery = `
    INSERT INTO grocery_list (user_code, items, total_price, budget, created_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (user_code)
    DO UPDATE SET 
      items = EXCLUDED.items, 
      total_price = EXCLUDED.total_price, 
      budget = EXCLUDED.budget,
      created_at = CURRENT_TIMESTAMP;
  `;
  try {
    await pool.query(upsertQuery, [user_code, JSON.stringify(items), total_price, budget]);
    console.log("Stored/Updated grocery list for user:", user_code);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error in /grocery-list POST endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports.handler = serverless(app);