const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

// Use your actual PostgreSQL connection string below or set it as an environment variable.
const connectionString = process.env.PG_CONNECTION_STRING || "postgres://username:password@localhost:5432/databaseName";
const pool = new Pool({
  connectionString,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Endpoint to generate a unique user code
app.get("/generate-code", async (req, res) => {
  try {
    let code = "";
    let exists = true; 
    // Keep generating until the code is unique in the database
    while (exists) {
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      const checkQuery = "SELECT * FROM grocery_list WHERE user_code = $1";
      const result = await pool.query(checkQuery, [code]);
      if (result.rowCount === 0) {
        exists = false;
      }
    }
    console.log("Generated code:", code);
    res.json({ status: "success", code });
  } catch (err) {
    console.error("Error generating code:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to check and get the grocery list for a given user code
app.get("/grocery-list", async (req, res) => {
  const userCode = req.query.userCode;
  if (!userCode) {
    return res.status(400).json({ status: "error", message: "Missing userCode parameter." });
  }
  try {
    const query = "SELECT * FROM grocery_list WHERE user_code = $1";
    const result = await pool.query(query, [userCode]);
    if (result.rowCount === 0) {
      res.json({ status: "success", data: [] });
    } else {
      res.json({ status: "success", data: result.rows });
    }
  } catch (err) {
    console.error("Error fetching grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to store (upsert) a grocery list
app.post("/grocery-list", async (req, res) => {
  const { user_code, items, total_price, budget } = req.body;
  if (!user_code) {
    return res.status(400).json({ status: "error", message: "Missing user_code in request body." });
  }
  // Upsert the grocery list record; assumes user_code is the unique key.
  const upsertQuery = `
    INSERT INTO grocery_list (user_code, items, total_price, budget, created_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (user_code)
    DO UPDATE SET 
      items = EXCLUDED.items, 
      total_price = EXCLUDED.total_price, 
      budget = EXCLUDED.budget,
      created_at = EXCLUDED.created_at;
  `;
  try {
    await pool.query(upsertQuery, [user_code, JSON.stringify(items), total_price, budget]);
    console.log("Stored/Updated grocery list for user:", user_code);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error storing grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});