const express = require('express'); // Import Express for server creation
const path = require('path'); // For serving static files
const { Pool } = require('pg'); // Import pg for PostgreSQL connection
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing

// Initialize Express app
const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve your static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Configure PostgreSQL connection pool
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_DAPek9F8viVY@ep-little-boat-a4nzyxm6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }, // Ensure SSL is used for Neon
});

// API Route: Sign Up (POST /sign-up)
app.post('/sign-up', async (req, res) => {
  const { name, email, password } = req.body; // Extract user details from request body

  try {
    // Hash the password before saving it to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the PostgreSQL database
    const query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)';
    await pool.query(query, [name, email, hashedPassword]);

    res.status(200).send('User registered successfully'); // Success message
  } catch (err) {
    console.error('Error during sign-up:', err);
    if (err.code === '23505') {
      // Unique violation (email already exists)
      res.status(400).send('Email already registered');
    } else {
      res.status(500).send('Error saving user');
    }
  }
});

// API Route: Sign In (POST /sign-in)
app.post('/sign-in', async (req, res) => {
  const { email, password } = req.body; // Extract login details from request body

  try {
    // Query the database for the user by email
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [email]);

    if (rows.length === 0) {
      return res.status(400).send('Invalid email or password'); // User not found
    }

    const user = rows[0];

    // Compare the provided password with the hashed password in the database
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (isPasswordMatch) {
      res.status(200).send('Login successful'); // Success message
    } else {
      res.status(400).send('Invalid email or password'); // Password mismatch
    }
  } catch (err) {
    console.error('Error during sign-in:', err);
    res.status(500).send('Error during sign-in');
  }
});

// Start the server
const PORT = process.env.PORT || 3000; // Use port 3000 or the environment's port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});