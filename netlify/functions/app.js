const express = require("express");
const { Pool } = require("pg");
const serverless = require("serverless-http");

const connectionString =
  "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";

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

/**
 * Internal function to generate a unique user code.
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

// /grocery-list POST endpoint: Inserts or updates a grocery list.
app.post("/grocery-list", async (req, res) => {
  console.log("POST /grocery-list payload:", req.body);

  const { user_id, items, total_price, budget } = req.body;

  // Validate the payload.
  if (!user_id) {
    console.error("Missing user_id in the request body.");
    return res.status(400).json({
      status: "error",
      message: "Missing user_id in request body. Please use the user_id obtained from /generate-code.",
    });
  }

  if (!Array.isArray(items)) {
    console.error("Invalid items format. Expected an array.");
    return res.status(400).json({
      status: "error",
      message: "Invalid items format. 'items' must be an array.",
    });
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
    await pool.query(upsertQuery, [user_id, JSON.stringify(items), total_price || 0, budget || null]);
    console.log(`Grocery list for user_id ${user_id} updated successfully.`);
    res.json({ status: "success", user_id });
  } catch (err) {
    console.error("Error upserting grocery list:", err);
    res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

module.exports.handler = serverless(app);