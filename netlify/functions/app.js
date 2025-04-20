const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const serverless = require("serverless-http");

// Use the provided connection string directly.
const connectionString = "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";
// Log the connection string
console.log("Using connection string:", connectionString);

// Create pool with SSL configuration for Neon
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const app = express();

app.use(bodyParser.json());

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
      // Generate a code using the "user" prefix followed by a 3-digit number.
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      console.log(`Attempt ${attempt + 1}: Trying code ${code}`);
      try {
        const checkQuery = "SELECT * FROM grocery_list WHERE user_id = $1";
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

// /grocery-list GET endpoint: retrieves the grocery list for a given user.
app.get("/grocery-list", async (req, res) => {
  // Expecting a query parameter "userId" to match the "user_id" column.
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId parameter." });
  }
  try {
    const query = "SELECT * FROM grocery_list WHERE user_id = $1";
    const result = await pool.query(query, [userId]);
    console.log(`Fetched grocery list for ${userId}, row count: ${result.rowCount}`);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error in /grocery-list GET endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list POST endpoint: inserts or updates a grocery list record.
app.post("/grocery-list", async (req, res) => {
  // Expecting the client to send either "user_id" or "userId" in the request body.
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
      budget = EXCLUDED.budget,
      created_at = CURRENT_TIMESTAMP;
  `;
  try {
    await pool.query(upsertQuery, [user_id, JSON.stringify(items), total_price, budget]);
    console.log("Stored/Updated grocery list for user:", user_id);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error in /grocery-list POST endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports.handler = serverless(app);