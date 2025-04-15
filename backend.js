const { Pool } = require('pg'); // Import the pg library
const bcrypt = require('bcrypt');

// Configure your PostgreSQL connection pool
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_DAPek9F8viVY@ep-little-boat-a4nzyxm6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }, // Ensure SSL is used for Neon
});

// Sign up route
const signUp = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the database
    const query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)';
    await pool.query(query, [name, email, hashedPassword]);

    res.status(200).send('User registered successfully');
  } catch (err) {
    console.error('Error during sign-up:', err);
    res.status(500).send('Error saving user');
  }
};

// Sign in route
const signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Query the database for the user by email
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [email]);

    if (rows.length === 0) {
      return res.status(400).send('Invalid email or password');
    }

    const user = rows[0];

    // Compare the provided password with the hashed password in the database
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (isPasswordMatch) {
      res.status(200).send('Login successful');
    } else {
      res.status(400).send('Invalid email or password');
    }
  } catch (err) {
    console.error('Error during sign-in:', err);
    res.status(500).send('Error during sign-in');
  }
};

// Export the routes for use in your server
module.exports = { signUp, signIn };