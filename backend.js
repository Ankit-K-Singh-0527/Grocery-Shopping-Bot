const express = require('express'); // Import Express for server creation
const { Pool } = require('pg'); // Import pg for PostgreSQL connection
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const cors = require('cors'); // Import cors for cross-origin requests
require('dotenv').config(); // Load environment variables from .env file

// Initialize Express app
const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS for Netlify frontend
app.use(
  cors({
    origin: 'https://groceryshoppingbot.netlify.app', // Your Netlify frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

// Configure PostgreSQL connection pool using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Connection string from environment variable
  ssl: { rejectUnauthorized: false }, // Ensure SSL is used for Neon
});

// API Route: Sign Up (POST /sign-up)
app.post('/sign-up', async (req, res) => {
  const { name, email, password } = req.body; // Extract user details from request body

  // Validate inputs
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Hash the password before saving it to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the PostgreSQL database
    const query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)';
    await pool.query(query, [name, email, hashedPassword]);

    res.status(200).json({ message: 'User registered successfully' }); // Success message
  } catch (err) {
    console.error('Error during sign-up:', err);
    if (err.code === '23505') {
      // Unique violation (email already exists)
      res.status(400).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Error saving user' });
    }
  }
});

// API Route: Sign In (POST /sign-in)
app.post('/sign-in', async (req, res) => {
  const { email, password } = req.body; // Extract login details from request body

  // Validate inputs
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Query the database for the user by email
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [email]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' }); // User not found
    }

    const user = rows[0];

    // Compare the provided password with the hashed password in the database
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (isPasswordMatch) {
      res.status(200).json({ message: 'Login successful' }); // Success message
    } else {
      res.status(400).json({ error: 'Invalid email or password' }); // Password mismatch
    }
  } catch (err) {
    console.error('Error during sign-in:', err);
    res.status(500).json({ error: 'Error during sign-in' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000; // Use port 3000 or the environment's port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});