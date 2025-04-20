// // Ably Initialization
// const ably = new Ably.Realtime("QFP-Dw.p_WLfg:ilu2PzKHJR1Tn14Pl6l1-kO0RcoqK3-_NsXV8U8PjXk"); // Replace with your Ably API Key
// const channel = ably.channels.get("grocery-list-channel");

// // Initialization of Global Variables
// let currentBudget = null;
// let totalPrice = 0;
// let groceryList = []; // Current user's grocery list
// let connectedUsers = new Set(); // Track explicitly connected users

// // Generate a Unique Code for Current User
// const currentUserCode = `user${Math.floor(Math.random() * 1000)}`;
// document.getElementById("userCode").textContent = currentUserCode;

// // Handle Budget Modal
// const budgetModal = document.getElementById("budgetModal");
// const budgetInput = document.getElementById("budgetInput");
// const budgetDisplay = document.getElementById("budgetDisplay");
// const totalPriceDisplay = document.getElementById("totalPriceDisplay");

// document.getElementById("closeBudgetButton").addEventListener("click", () => {
//   budgetModal.classList.add("hidden");
// });

// document.getElementById("saveBudgetButton").addEventListener("click", () => {
//   const budget = parseFloat(budgetInput.value);
//   if (!isNaN(budget) && budget > 0) {
//     currentBudget = budget;
//     budgetDisplay.textContent = `$${currentBudget}`;
//     alert("Budget set successfully!");
//   } else {
//     alert("Please enter a valid budget.");
//   }
//   budgetModal.classList.add("hidden");
// });

// // Add Item to Grocery List
// function addItemToList(item) {
//   const normalizedItem = item.toLowerCase();
//   if (groceryList.some((entry) => entry.name.toLowerCase() === normalizedItem)) {
//     alert("Duplicate item! This item is already in your grocery list.");
//     return;
//   }

//   // Generate a random price
//   const price = Math.floor(Math.random() * 20) + 1;
//   groceryList.push({ name: item, price });
//   totalPrice += price;
//   totalPriceDisplay.textContent = `$${totalPrice}`;

//   // Check if total price exceeds budget
//   if (currentBudget !== null && totalPrice > currentBudget) {
//     alert("Warning: You are out of your budget limit!");
//   }

//   // Publish the updated list to Ably for connected users
//   publishGroceryList();
//   renderGroceryList();
// }

// // Publish the current grocery list to Ably for connected users.
// function publishGroceryList() {
//   channel.publish("list-updated", {
//     user: currentUserCode,
//     type: "update", // Regular update
//     list: groceryList,
//     connectedUsers: Array.from(connectedUsers),
//     path: [currentUserCode], // Start the forwarding path with the originator
//   });
// }

// // Render Grocery List with Edit and Delete buttons
// function renderGroceryList() {
//   const groceryListEl = document.getElementById("groceryList");
//   groceryListEl.innerHTML = "";
//   groceryList.forEach((item, index) => {
//     const li = document.createElement("li");

//     // Display the item details
//     const itemSpan = document.createElement("span");
//     itemSpan.textContent = `${item.name} - $${item.price} `;
//     li.appendChild(itemSpan);

//     // Add Edit button
//     const editButton = document.createElement("button");
//     editButton.textContent = "Edit";
//     editButton.style.marginRight = "5px";
//     editButton.addEventListener("click", () => {
//       const newName = prompt("Enter new name for the item:", item.name);
//       if (!newName) return;
//       const normalizedNewName = newName.toLowerCase();
//       if (
//         normalizedNewName !== item.name.toLowerCase() &&
//         groceryList.some((entry) => entry.name.toLowerCase() === normalizedNewName)
//       ) {
//         alert("Duplicate item! This item is already in your grocery list.");
//         return;
//       }
//       // const newPriceInput = prompt("Enter new price for the item:", item.price);
//       // const newPrice = parseFloat(newPriceInput);
//       // if (isNaN(newPrice) || newPrice <= 0) {
//       //   alert("Please enter a valid price.");
//       //   return;
//       // }
//       // Update the item
//       groceryList[index] = { name: newName, price: newPrice };
//       totalPrice = groceryList.reduce((sum, item) => sum + item.price, 0);
//       totalPriceDisplay.textContent = `$${totalPrice}`;
//       renderGroceryList();
//       publishGroceryList();
//     });
//     li.appendChild(editButton);

//     // Add Delete button
//     const deleteButton = document.createElement("button");
//     deleteButton.textContent = "Delete";
//     deleteButton.addEventListener("click", () => {
//       // Remove the item
//       groceryList.splice(index, 1);
//       totalPrice = groceryList.reduce((sum, item) => sum + item.price, 0);
//       totalPriceDisplay.textContent = `$${totalPrice}`;
//       renderGroceryList();
//       publishGroceryList();
//     });
//     li.appendChild(deleteButton);

//     groceryListEl.appendChild(li);
//   });
// }

// // Forward the update to any connected users who haven't received it yet.
// function forwardUpdate(message) {
//   let forwardedPath = message.data.path ? [...message.data.path] : [message.data.user];
//   if (!forwardedPath.includes(currentUserCode)) {
//     forwardedPath.push(currentUserCode);
//   }
//   const targetUsers = Array.from(connectedUsers).filter((u) => !forwardedPath.includes(u));
//   if (targetUsers.length > 0) {
//     channel.publish("list-updated", {
//       user: message.data.user,
//       type: message.data.type,
//       list: message.data.list,
//       connectedUsers: targetUsers,
//       path: forwardedPath,
//     });
//   }
// }

// // Handle Receiving "list-updated" Events
// channel.subscribe("list-updated", (message) => {
//   if (message.data.connectedUsers.includes(currentUserCode)) {
//     const updatedListEl = document.getElementById("updatedList");
//     const mergeDiscardButtons = document.getElementById("mergeDiscardButtons");

//     updatedListEl.innerHTML = "";
//     message.data.list.forEach((item) => {
//       const li = document.createElement("li");
//       li.textContent = `${item.name} - $${item.price}`;
//       updatedListEl.appendChild(li);
//     });

//     mergeDiscardButtons.classList.remove("hidden");

//     document.getElementById("mergeListButton").addEventListener("click", () => {
//       groceryList = [...groceryList, ...message.data.list];
//       groceryList = groceryList.filter(
//         (item, index, self) =>
//           index === self.findIndex((t) => t.name.toLowerCase() === item.name.toLowerCase())
//       );
//       totalPrice = groceryList.reduce((sum, item) => sum + item.price, 0);
//       totalPriceDisplay.textContent = `$${totalPrice}`;
//       renderGroceryList();
//       updatedListEl.innerHTML = "";
//       mergeDiscardButtons.classList.add("hidden");
//     });

//     document.getElementById("discardListButton").addEventListener("click", () => {
//       updatedListEl.innerHTML = "";
//       mergeDiscardButtons.classList.add("hidden");
//     });
//   }

//   if (!message.data.path || !message.data.path.includes(currentUserCode)) {
//     forwardUpdate(message);
//   }
// });

// // Connection Flow
// document.getElementById("connectButton").addEventListener("click", () => {
//   const connectInputEl = document.getElementById("connectInput");
//   const targetCode = connectInputEl.value.trim();
//   if (targetCode) {
//     channel.publish("connect-request", {
//       user: currentUserCode,
//       target: targetCode,
//     });
//     alert(`Connection request sent to user: ${targetCode}`);
//     connectInputEl.value = "";
//   } else {
//     alert("Please enter a valid user code to connect.");
//   }
// });

// channel.subscribe("connect-request", (message) => {
//   if (message.data.target === currentUserCode) {
//     connectedUsers.add(message.data.user);
//     channel.publish("connect-back", {
//       user: currentUserCode,
//       target: message.data.user,
//     });
//     channel.publish("list-updated", {
//       user: currentUserCode,
//       type: "initial",
//       list: groceryList,
//       connectedUsers: [message.data.user],
//       path: [currentUserCode],
//     });
//   }
// });

// channel.subscribe("connect-back", (message) => {
//   if (message.data.target === currentUserCode) {
//     connectedUsers.add(message.data.user);
//   }
// });

// document.getElementById("addItemButton").addEventListener("click", () => {
//   const itemInputEl = document.getElementById("itemInput");
//   const item = itemInputEl.value.trim();
//   if (item) {
//     addItemToList(item);
//     itemInputEl.value = "";
//   }
// });

// // Initialize Grocery List on Page Load
// renderGroceryList();

// Frontend JavaScript Code

// Ably Initialization
const ably = new Ably.Realtime("YOUR_ABLY_API_KEY");
const channel = ably.channels.get("grocery-list-channel");

// Global variables
let currentUserCode = "";
let currentBudget = null;
let totalPrice = 0;
let groceryList = [];

// DOM Elements
const userCodeDisplay = document.getElementById("userCode");
const budgetDisplay = document.getElementById("budgetDisplay");
const totalPriceDisplay = document.getElementById("totalPriceDisplay");
const groceryListEl = document.getElementById("groceryList");

// Initialize the app on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initializeUserCodeLoop();

  document.getElementById("addItemButton").addEventListener("click", () => {
    const itemInputEl = document.getElementById("itemInput");
    const itemName = itemInputEl.value.trim();
    if (itemName) {
      addItemToList(itemName);
      itemInputEl.value = "";
    } else {
      alert("Please enter a valid item name.");
    }
  });
});

// Function to initialize user code
async function initializeUserCodeLoop() {
  let codeSet = false;

  while (!codeSet) {
    const userInput = prompt("Enter your unique code (leave blank to generate a new one):");

    if (userInput && userInput.trim()) {
      try {
        const response = await fetch(`/grocery-list?user_id=${encodeURIComponent(userInput.trim())}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && data.data.length > 0) {
            currentUserCode = userInput.trim();
            codeSet = true;
          } else {
            alert("Code not found. Please try again.");
          }
        } else if (response.status === 404) {
          alert("Code does not exist. Please try again.");
        } else {
          throw new Error("Error checking code.");
        }
      } catch (error) {
        console.error("Error checking code:", error);
      }
    } else {
      try {
        const response = await fetch("/generate-code");
        const data = await response.json();
        if (data.status === "success" && data.code) {
          currentUserCode = data.code;
          alert(`Generated new user code: ${currentUserCode}`);
          codeSet = true;
        } else {
          throw new Error("Error generating user code.");
        }
      } catch (error) {
        console.error("Error generating code:", error);
      }
    }
  }

  userCodeDisplay.textContent = currentUserCode;
  await storeUserRecord();
  await loadUserList();
}

// Function to store a new user record
async function storeUserRecord() {
  const payload = {
    user_id: currentUserCode,
    items: [],
    total_price: 0,
    budget: null
  };

  try {
    const response = await fetch("/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Failed to store user record.");
  } catch (error) {
    console.error("Error storing user record:", error.message);
  }
}

// Function to load the grocery list
async function loadUserList() {
  try {
    const response = await fetch(`/grocery-list?user_id=${encodeURIComponent(currentUserCode)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === "success" && data.data.length > 0) {
        const record = data.data[0];
        groceryList = Array.isArray(record.items) ? record.items : JSON.parse(record.items || "[]");
        currentBudget = record.budget;
        totalPrice = record.total_price || 0;

        renderGroceryList();
      }
    } else {
      console.warn("No grocery list found for user.");
    }
  } catch (error) {
    console.error("Error loading grocery list:", error.message);
  }
}

// Function to render the grocery list
function renderGroceryList() {
  groceryListEl.innerHTML = "";
  groceryList.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.name} - $${item.price}`;
    groceryListEl.appendChild(li);
  });

  budgetDisplay.textContent = currentBudget ? `$${currentBudget}` : "Not Set";
  totalPriceDisplay.textContent = `$${totalPrice}`;
}

// Function to add an item to the grocery list
function addItemToList(itemName) {
  const price = Math.floor(Math.random() * 20) + 1;
  groceryList.push({ name: itemName, price });
  totalPrice += price;
  renderGroceryList();
  storeGroceryList();
}

// Function to persist the grocery list to the backend
async function storeGroceryList() {
  const payload = {
    user_id: currentUserCode,
    items: groceryList,
    total_price: totalPrice,
    budget: currentBudget
  };

  try {
    const response = await fetch("/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Failed to store grocery list.");
  } catch (error) {
    console.error("Error storing grocery list:", error.message);
  }
}