const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

// Hardcoded connection string as default
const defaultConnectionString = "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";

// Use the environment variable if set, otherwise fallback to the default hardcoded connection string.
const connectionString = process.env.PG_CONNECTION_STRING || defaultConnectionString;

const pool = new Pool({ connectionString });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Endpoint to generate a unique user code
app.get("/generate-code", async (req, res) => {
  try {
    let code = "";
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      console.log(`Attempt ${attempts + 1}: Trying code ${code}`);
      try {
        const checkQuery = "SELECT * FROM grocery_list WHERE user_code = $1";
        const result = await pool.query(checkQuery, [code]);
        console.log(`Code ${code} checked, row count: ${result.rowCount}`);
        if (result.rowCount === 0) {
          console.log("Unique code found:", code);
          break;
        }
      } catch (dbError) {
        console.error("Error during code generation while checking DB:", dbError.message);
        return res.status(500).json({ status: "error", message: "Database error during code checking." });
      }
      attempts++;
    }
    
    if (attempts === maxAttempts) {
      console.error("Failed to generate a unique code after 10 attempts.");
      return res.status(500).json({ status: "error", message: "Failed to generate a unique code, please try again." });
    }
    
    res.json({ status: "success", code });
  } catch (err) {
    console.error("Error in /generate-code endpoint:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to check and retrieve the grocery list for a given user code
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
    console.error("Error in /grocery-list GET endpoint:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to insert or update (upsert) a grocery list record
app.post("/grocery-list", async (req, res) => {
  const { user_code, items, total_price, budget } = req.body;
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
    console.error("Error in /grocery-list POST endpoint:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});