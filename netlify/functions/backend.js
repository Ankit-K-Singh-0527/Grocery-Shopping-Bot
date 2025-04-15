const { Pool } = require('pg'); // PostgreSQL client
const bcrypt = require('bcrypt'); // For password hashing

// Configure PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Get DB connection string from environment variable
  ssl: { rejectUnauthorized: false }, // Ensure SSL is enabled for Neon
});

// Helper to handle responses
function handleResponse(statusCode, message) {
  return {
    statusCode,
    body: JSON.stringify(message),
  };
}

// Function: Sign Up
const signUp = async (event) => {
  if (event.httpMethod !== 'POST') {
    return handleResponse(405, { error: 'Method not allowed' });
  }

  const { name, email, password } = JSON.parse(event.body);

  // Input validation
  if (!name || !email || !password) {
    return handleResponse(400, { error: 'All fields are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return handleResponse(400, { error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return handleResponse(400, { error: 'Password must be at least 6 characters long' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)';
    await pool.query(query, [name, email, hashedPassword]);

    return handleResponse(200, { message: 'User registered successfully' });
  } catch (err) {
    console.error('Error during sign-up:', err);
    if (err.code === '23505') {
      return handleResponse(400, { error: 'Email already registered' });
    }
    return handleResponse(500, { error: 'Error saving user' });
  }
};

// Function: Sign In
const signIn = async (event) => {
  if (event.httpMethod !== 'POST') {
    return handleResponse(405, { error: 'Method not allowed' });
  }

  const { email, password } = JSON.parse(event.body);

  // Input validation
  if (!email || !password) {
    return handleResponse(400, { error: 'Email and password are required' });
  }

  try {
    // Query database for the user
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [email]);

    if (rows.length === 0) {
      return handleResponse(400, { error: 'Invalid email or password' });
    }

    const user = rows[0];

    // Compare passwords
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (isPasswordMatch) {
      return handleResponse(200, { message: 'Login successful' });
    } else {
      return handleResponse(400, { error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Error during sign-in:', err);
    return handleResponse(500, { error: 'Error during sign-in' });
  }
};

// Export Netlify functions
exports.handler = async (event, context) => {
  if (event.path.includes('/sign-up')) {
    return await signUp(event);
  } else if (event.path.includes('/sign-in')) {
    return await signIn(event);
  } else {
    return handleResponse(404, { error: 'Not Found' });
  }
};