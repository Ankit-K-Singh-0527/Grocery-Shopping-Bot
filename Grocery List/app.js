const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

// Use PG_CONNECTION_STRING from environment variables.
// Netlify should inject this variable in all environments.
const connectionString =
  process.env.PG_CONNECTION_STRING ||
  "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";

console.log("Using connection string:", connectionString); // Debug: Remove in production

const pool = new Pool({ connectionString });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Helper function to log errors with detailed info.
const logError = (context, err) => {
  console.error(`Error in ${context}:`, err.message);
  console.error(err.stack);
};

/*
  Endpoint: /generate-code
  Generates a unique user code. Added extra logging of each attempt.
*/
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
        logError("generate-code while checking DB", dbError);
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
    logError("generate-code endpoint", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/*
  Endpoint: /grocery-list (GET)
  Retrieves the grocery list for a given user code.
*/
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
    logError("grocery-list GET", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/*
  Endpoint: /grocery-list (POST)
  Inserts or updates (upserts) a grocery list record.
*/
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
    const result = await pool.query(upsertQuery, [user_code, JSON.stringify(items), total_price, budget]);
    console.log(`Stored/Updated grocery list for user ${user_code}. Result:`, result);
    res.json({ status: "success" });
  } catch (err) {
    logError("grocery-list POST", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});