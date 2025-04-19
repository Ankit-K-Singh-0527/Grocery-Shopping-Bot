const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

// Database connection (secure this in production)
const connectionString = "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files from the "public" folder.
app.use(express.static("public"));

// API Endpoint to generate a unique user code
app.get("/generate-code", async (req, res) => {
  async function generateUniqueCode() {
    let code;
    let exists = true;
    // Generate a unique code with simple "user" + 3-digit format
    while (exists) {
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      try {
        const query = "SELECT 1 FROM grocery_list WHERE user_code = $1 LIMIT 1";
        const result = await pool.query(query, [code]);
        // If the code does not exist in database, break the loop
        if (result.rowCount === 0) {
          exists = false;
        }
      } catch (err) {
        console.error("DB Error checking user code:", err);
        throw new Error("Database error when checking unique code");
      }
    }
    return code;
  }
  try {
    const code = await generateUniqueCode();
    console.log("Generated unique code: ", code);
    res.json({ status: "success", code });
  } catch (err) {
    console.error("Error generating code:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// API Endpoint to store (or update) a grocery list
app.post("/grocery-list", async (req, res) => {
  const { userCode, items, totalPrice, budget } = req.body;
  // Upsert logic: update if exists, otherwise insert new record.
  const updateQuery = `
    UPDATE grocery_list
    SET items = $2, total_price = $3, budget = $4, created_at = NOW()
    WHERE user_code = $1
    RETURNING *
  `;
  try {
    let result = await pool.query(updateQuery, [userCode, JSON.stringify(items), totalPrice, budget]);
    if (result.rowCount === 0) {
      const insertQuery = `
        INSERT INTO grocery_list (user_code, items, total_price, budget, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      result = await pool.query(insertQuery, [userCode, JSON.stringify(items), totalPrice, budget]);
    }
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    console.error("Error storing grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// API Endpoint to retrieve a grocery list by userCode
app.get("/grocery-list", async (req, res) => {
  try {
    const query = "SELECT * FROM grocery_list WHERE user_code = $1 ORDER BY created_at DESC";
    const params = [req.query.userCode];
    const result = await pool.query(query, params);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error retrieving grocery list:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});