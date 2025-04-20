const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: "postgres://your_connection_string_here",
});

// Generate a unique user code
app.get("/generate-code", async (req, res) => {
  try {
    const userCode = "user" + Math.floor(Math.random() * 1000);
    await pool.query("INSERT INTO grocery_list (user_id, items, total_price, budget) VALUES ($1, $2, $3, $4)", [
      userCode,
      JSON.stringify([]),
      0,
      null,
    ]);
    res.json({ status: "success", code: userCode });
  } catch (error) {
    console.error("Error generating code:", error);
    res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

// Get grocery list by user_id
app.get("/grocery-list", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ status: "error", message: "Missing user_id in query parameters." });
  }

  try {
    const result = await pool.query("SELECT * FROM grocery_list WHERE user_id = $1", [user_id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }
    res.json({ status: "success", data: result.rows });
  } catch (error) {
    console.error("Error fetching grocery list:", error);
    res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

// Add or update grocery list
app.post("/grocery-list", async (req, res) => {
  const { user_id, items, total_price, budget } = req.body;
  if (!user_id) {
    return res.status(400).json({ status: "error", message: "Missing user_id in request body." });
  }

  try {
    await pool.query(
      "INSERT INTO grocery_list (user_id, items, total_price, budget) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET items = $2, total_price = $3, budget = $4",
      [user_id, JSON.stringify(items), total_price, budget]
    );
    res.json({ status: "success", message: "Grocery list updated successfully." });
  } catch (error) {
    console.error("Error updating grocery list:", error);
    res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));