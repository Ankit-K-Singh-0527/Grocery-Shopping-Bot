const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const serverless = require("serverless-http");

// Use the provided connection string directly.
const connectionString = "postgresql://neondb_owner:npg_sNweM82LZRcy@ep-divine-morning-a4cylplf-pooler.us-east-1.aws.neon.tech/grocery_db?sslmode=require";
// Log the connection string
console.log("Using connection string:", connectionString);

// Create pool with SSL configuration for Neon
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const app = express();

app.use(bodyParser.json());

// Middleware to strip Netlify function prefix from the URL.
app.use((req, res, next) => {
  if (req.url.startsWith("/.netlify/functions/app")) {
    req.url = req.url.replace("/.netlify/functions/app", "");
  }
  next();
});

// /generate-code endpoint: generates a unique user code.
app.get("/generate-code", async (req, res) => {
  try {
    let code = "";
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate a code using the "user" prefix followed by a 3-digit number.
      code = "user" + (Math.floor(Math.random() * 900) + 100);
      console.log(`Attempt ${attempt + 1}: Trying code ${code}`);
      try {
        const checkQuery = "SELECT * FROM grocery_list WHERE user_id = $1";
        const result = await pool.query(checkQuery, [code]);
        console.log(`Code ${code} checked, row count: ${result.rowCount}`);
        if (result.rowCount === 0) {
          console.log("Unique code found:", code);
          return res.json({ status: "success", code });
        } else {
          console.warn(`Code ${code} already exists. Trying a new one.`);
        }
      } catch (dbError) {
        console.error("Database error during code check:", dbError);
        return res.status(500).json({ status: "error", message: "Database error during code check." });
      }
    }
    console.error("Failed to generate a unique code after maximum attempts.");
    res.status(500).json({ status: "error", message: "Unable to generate a unique code after several attempts." });
  } catch (err) {
    console.error("Error in /generate-code endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list GET endpoint: retrieves the grocery list for a given user.
app.get("/grocery-list", async (req, res) => {
  // Expecting a query parameter "userId" to match the "user_id" column.
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ status: "error", message: "Missing userId parameter." });
  }
  try {
    const query = "SELECT * FROM grocery_list WHERE user_id = $1";
    const result = await pool.query(query, [userId]);
    console.log(`Fetched grocery list for ${userId}, row count: ${result.rowCount}`);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error in /grocery-list GET endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// /grocery-list POST endpoint: inserts or updates a grocery list record.
app.post("/grocery-list", async (req, res) => {
  // Expecting the client to send either "user_id" or "userId" in the request body.
  const user_id = req.body.user_id || req.body.userId;
  const items = req.body.items;
  const total_price = req.body.total_price || req.body.totalPrice;
  const budget = req.body.budget;
  if (!user_id) {
    return res.status(400).json({ status: "error", message: "Missing user_id in request body." });
  }
  
  // Updated upsert query: insert a new row if one doesn't exist; update existing otherwise.
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
    await pool.query(upsertQuery, [user_id, JSON.stringify(items), total_price, budget]);
    console.log("Stored/Updated grocery list for user:", user_id);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error in /grocery-list POST endpoint:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports.handler = serverless(app);

/* ========================================================
Below is the client-side code for handling Ably channels 
and updating the list. This section remains unchanged.
========================================================= */

// Ably Initialization
const ably = new Ably.Realtime("QFP-Dw.p_WLfg:ilu2PzKHJR1Tn14Pl6l1-kO0RcoqK3-_NsXV8U8PjXk");
const channel = ably.channels.get("grocery-list-channel");

// Global variables
let currentUserCode = "";
let currentBudget = null;
let totalPrice = 0;
let groceryList = [];
let connectedUsers = new Set();

// DOM Elements
const userCodeDisplay = document.getElementById("userCode");
const budgetModal = document.getElementById("budgetModal");
const budgetInput = document.getElementById("budgetInput");
const budgetDisplay = document.getElementById("budgetDisplay");
const totalPriceDisplay = document.getElementById("totalPriceDisplay");

// Elements for receiving updates
const updatedListEl = document.getElementById("updatedList");
const mergeDiscardButtons = document.getElementById("mergeDiscardButtons");
const mergeListButton = document.getElementById("mergeListButton");
const discardListButton = document.getElementById("discardListButton");

// Elements for connection flow
const connectInputEl = document.getElementById("connectInput");
const connectButton = document.getElementById("connectButton");

// Ensure that all event registrations occur once DOM is fully loaded.
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired");
  
  // Initialize user code and load list from backend.
  initializeUserCodeLoop();

  // Attach event listener for Add Item button
  const addItemButton = document.getElementById("addItemButton");
  addItemButton.addEventListener("click", () => {
    const itemInputEl = document.getElementById("itemInput");
    const item = itemInputEl.value.trim();
    if (item) {
      addItemToList(item);
      itemInputEl.value = "";
    } else {
      alert("Please enter an item name.");
    }
  });
});

// Function to initialize or validate the user code using retry logic.
async function initializeUserCodeLoop() {
  let codeSet = false;
  while (!codeSet) {
    console.log("Initializing user code...");
    alert("A prompt will ask for your unique code. Click OK to continue.");
    
    // Prompt the user for a code; if left blank, we generate a new code.
    let code = prompt("Enter your unique code (leave blank if new):");
    if (code && code.trim() !== "") {
      try {
        const response = await fetch("/.netlify/functions/app/grocery-list?userId=" + encodeURIComponent(code.trim()));
        const data = await response.json();
        console.log("Check code response:", data);
        if (data.status === "success" && data.data && data.data.length > 0) {
          currentUserCode = code.trim();
          codeSet = true;
        } else {
          alert("The code does not exist. Please try again.");
        }
      } catch (err) {
        console.error("Error checking code:", err);
        alert("Error checking code. Please try again.");
      }
    } else {
      try {
        // Generate a new code if none was provided.
        const response = await fetch("/.netlify/functions/app/generate-code");
        const data = await response.json();
        console.log("Generate code response:", data);
        if (data.status === "success" && data.code) {
          currentUserCode = data.code;
          alert("New user created with code: " + currentUserCode);
          codeSet = true;
        } else {
          alert("Error generating code. Please try again.");
        }
      } catch (err) {
        console.error("Error generating code:", err);
        alert("Error generating code. Please try again.");
      }
    }
  }
  // Display the user code and load stored list
  userCodeDisplay.textContent = currentUserCode;
  loadUserList(currentUserCode);
}

// Function to load the grocery list from the backend
function loadUserList(code) {
  fetch("/.netlify/functions/app/grocery-list?userId=" + encodeURIComponent(code))
    .then(response => response.json())
    .then(data => {
      console.log("Load user list response:", data);
      if (data.status === "success" && data.data && data.data.length > 0) {
        const record = data.data[0];
        try {
          groceryList = JSON.parse(record.items);
        } catch (e) {
          groceryList = [];
        }
        currentBudget = record.budget;
        totalPrice = Number(record.total_price);
        if (currentBudget) {
          budgetDisplay.textContent = "$" + currentBudget;
        }
        totalPriceDisplay.textContent = "$" + totalPrice;
      } else {
        // Initialize if no data exists.
        groceryList = [];
        currentBudget = null;
        totalPrice = 0;
      }
      renderGroceryList();
    })
    .catch(err => {
      console.error("Error loading list:", err);
      groceryList = [];
      currentBudget = null;
      totalPrice = 0;
      renderGroceryList();
    });
}

// Budget modal event handlers
document.getElementById("closeBudgetButton").addEventListener("click", () => {
  budgetModal.classList.add("hidden");
});
document.getElementById("saveBudgetButton").addEventListener("click", () => {
  const budget = parseFloat(budgetInput.value);
  if (!isNaN(budget) && budget > 0) {
    currentBudget = budget;
    budgetDisplay.textContent = "$" + currentBudget;
    alert("Budget set successfully!");
  } else {
    alert("Enter a valid budget.");
  }
  budgetModal.classList.add("hidden");
  storeGroceryList();
});
document.getElementById("openBudgetButton").addEventListener("click", () => {
  budgetModal.classList.toggle("hidden");
});

// Function to add an item to the grocery list.
function addItemToList(item) {
  const normalizedItem = item.toLowerCase();
  if (groceryList.some(entry => entry.name.toLowerCase() === normalizedItem)) {
    alert("Duplicate item!");
    return;
  }
  const price = Math.floor(Math.random() * 20) + 1; // Random price generation.
  groceryList.push({ name: item, price });
  totalPrice += price;
  totalPriceDisplay.textContent = "$" + totalPrice;
  if (currentBudget !== null && totalPrice > currentBudget) {
    alert("Budget exceeded!");
  }
  renderGroceryList();
  publishGroceryList();
  storeGroceryList();
}

// Function to publish the updated grocery list via Ably.
function publishGroceryList() {
  channel.publish("list-updated", {
    user: currentUserCode,
    type: "update",
    list: groceryList,
    connectedUsers: Array.from(connectedUsers),
    path: [currentUserCode]
  });
}

// Function to render the grocery list on the UI.
function renderGroceryList() {
  const groceryListEl = document.getElementById("groceryList");
  groceryListEl.innerHTML = "";
  groceryList.forEach((item, index) => {
    const li = document.createElement("li");
    const itemSpan = document.createElement("span");
    itemSpan.textContent = item.name + " - $" + item.price + " ";
    li.appendChild(itemSpan);
    // Edit button for each item.
    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.style.marginRight = "5px";
    editButton.addEventListener("click", () => {
      const newName = prompt("Enter new name:", item.name);
      if (!newName) return;
      const normalizedNew = newName.toLowerCase();
      if (
        normalizedNew !== item.name.toLowerCase() &&
        groceryList.some(e => e.name.toLowerCase() === normalizedNew)
      ) {
        alert("Duplicate item!");
        return;
      }
      groceryList[index].name = newName;
      renderGroceryList();
      publishGroceryList();
      storeGroceryList();
    });
    li.appendChild(editButton);
    // Delete button for each item.
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      groceryList.splice(index, 1);
      totalPrice = groceryList.reduce((sum, itm) => sum + itm.price, 0);
      totalPriceDisplay.textContent = "$" + totalPrice;
      renderGroceryList();
      publishGroceryList();
      storeGroceryList();
    });
    li.appendChild(deleteButton);
    groceryListEl.appendChild(li);
  });
}

// Function to persist the grocery list to the backend.
function storeGroceryList() {
  if (!currentUserCode) return;
  fetch("/.netlify/functions/app/grocery-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUserCode,
      items: groceryList,
      totalPrice: totalPrice,
      budget: currentBudget
    })
  })
    .then(response => response.json())
    .then(data => console.log("Stored:", data))
    .catch(err => console.error("Store error:", err));
}

// Ably subscription to receive updates from other users.
channel.subscribe("list-updated", (message) => {
  // If the update is meant for this user, show in the updatedList section.
  if (message.data.connectedUsers && message.data.connectedUsers.includes(currentUserCode)) {
    updatedListEl.innerHTML = "";
    message.data.list.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.name} - $${item.price}`;
      updatedListEl.appendChild(li);
    });
    mergeDiscardButtons.classList.remove("hidden");
  }
  // Forward the update if not already in the path.
  if (!message.data.path || !message.data.path.includes(currentUserCode)) {
    forwardUpdate(message);
  }
});

// Helper to forward updates to connected users.
function forwardUpdate(message) {
  let forwardedPath = message.data.path ? [...message.data.path] : [message.data.user];
  if (!forwardedPath.includes(currentUserCode)) {
    forwardedPath.push(currentUserCode);
  }
  const targetUsers = Array.from(connectedUsers).filter(u => !forwardedPath.includes(u));
  if (targetUsers.length > 0) {
    channel.publish("list-updated", {
      user: message.data.user,
      type: message.data.type,
      list: message.data.list,
      connectedUsers: targetUsers,
      path: forwardedPath
    });
  }
}

// Merge two lists without duplicate items.
function mergeLists(list1, list2) {
  const merged = [...list1];
  list2.forEach(item2 => {
    if (!merged.some(item1 => item1.name.toLowerCase() === item2.name.toLowerCase())) {
      merged.push(item2);
    }
  });
  return merged;
}

// Merge/discard updates received from other users.
mergeListButton.addEventListener("click", () => {
  const incomingList = Array.from(updatedListEl.childNodes).map(li => {
    const parts = li.textContent.split(" - $");
    return { name: parts[0].trim(), price: Number(parts[1]) };
  });
  groceryList = mergeLists(groceryList, incomingList);
  totalPrice = groceryList.reduce((sum, item) => sum + item.price, 0);
  totalPriceDisplay.textContent = "$" + totalPrice;
  renderGroceryList();
  updatedListEl.innerHTML = "";
  mergeDiscardButtons.classList.add("hidden");
  storeGroceryList();
});
discardListButton.addEventListener("click", () => {
  updatedListEl.innerHTML = "";
  mergeDiscardButtons.classList.add("hidden");
});

// Connection flow: Allow users to connect for sharing updates.
connectButton.addEventListener("click", () => {
  const targetCode = connectInputEl.value.trim();
  if (targetCode) {
    channel.publish("connect-request", {
      user: currentUserCode,
      target: targetCode
    });
    alert(`Connection request sent to user: ${targetCode}`);
    connectInputEl.value = "";
  } else {
    alert("Please enter a valid user code to connect.");
  }
});
channel.subscribe("connect-request", (message) => {
  if (message.data.target === currentUserCode) {
    connectedUsers.add(message.data.user);
    channel.publish("connect-back", {
      user: currentUserCode,
      target: message.data.user
    });
    channel.publish("list-updated", {
      user: currentUserCode,
      type: "initial",
      list: groceryList,
      connectedUsers: [message.data.user],
      path: [currentUserCode]
    });
  }
});
channel.subscribe("connect-back", (message) => {
  if (message.data.target === currentUserCode) {
    connectedUsers.add(message.data.user);
  }
});