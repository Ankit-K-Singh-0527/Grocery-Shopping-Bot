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

// /generate-code endpoint: Generates and returns a unique user_id.
app.get("/generate-code", async (req, res) => {
  try {
    let code = "";
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      const result = await pool.query("SELECT * FROM grocery_list WHERE user_id = $1", [code]);
      if (result.rowCount === 0) {
        // Insert the generated user_id into the database.
        const insertQuery = `
          INSERT INTO grocery_list (user_id, items, total_price, budget, created_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `;
        await pool.query(insertQuery, [code, JSON.stringify([]), 0, null]);
        return res.json({ status: "success", code });
      }
    }
    throw new Error("Unable to generate a unique code after several attempts.");
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

module.exports.handler = serverless(app);