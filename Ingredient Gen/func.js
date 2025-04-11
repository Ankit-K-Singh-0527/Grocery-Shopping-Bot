
        const inputRecipe = document.getElementById('inputRecipe');
        const generateButton = document.getElementById('generateButton');
        const shoppingListSection = document.getElementById('shoppingListSection');
        const shoppingList = document.getElementById('shoppingList');
        const clearButton = document.getElementById('clearButton');
        const messageSection = document.getElementById('messageSection');
        const messageText = document.getElementById('messageText');

        // Function to navigate back
        function goBack() {
            window.history.back();
        }

        // Display a message
        function displayMessage(text, type = 'success') {
            messageText.textContent = text;
            messageText.className = `animated-message text-lg font-semibold ${type === 'error' ? 'text-red-500' : 'text-green-500'}`;
            messageSection.classList.remove('hidden');

            // Hide the message after 3 seconds
            setTimeout(() => {
                messageSection.classList.add('hidden');
            }, 3000);
        }

        // Fetch Recipe Ingredients from Themealdb API
        async function fetchIngredients(recipeName) {
            const API_URL = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(recipeName)}`;
            try {
                const response = await fetch(API_URL);
                const data = await response.json();

                if (data.meals && data.meals.length > 0) {
                    const meal = data.meals[0];
                    const ingredients = [];

                    // Extract ingredients and measures
                    for (let i = 1; i <= 20; i++) {
                        const ingredient = meal[`strIngredient${i}`];
                        const measure = meal[`strMeasure${i}`];
                        if (ingredient && ingredient.trim() !== '') {
                            ingredients.push(`${measure ? measure : ''} ${ingredient}`.trim());
                        }
                    }

                    return ingredients;
                } else {
                    displayMessage("No recipes found! Try another name.", 'error');
                    return [];
                }
            } catch (error) {
                console.error("Error fetching ingredients:", error);
                displayMessage("Error fetching recipe. Please try again.", 'error');
                return [];
            }
        }

        // Generate Shopping List
        async function generateShoppingList() {
            const recipeName = inputRecipe.value.trim();

            if (!recipeName) {
                displayMessage('Please enter a recipe name!', 'error');
                return;
            }

            // Clear Existing List
            shoppingList.innerHTML = '';

            // Fetch Ingredients
            const ingredients = await fetchIngredients(recipeName);

            if (ingredients.length > 0) {
                ingredients.forEach(ingredient => {
                    const listItem = document.createElement('li');
                    listItem.className = 'fade-in list-item';
                    listItem.textContent = ingredient;
                    shoppingList.appendChild(listItem);
                });

                // Display Shopping List Section
                shoppingListSection.classList.remove('hidden');
                displayMessage('Shopping list generated successfully!');
            }
        }

        // Trigger search on button click or Enter key
        generateButton.addEventListener('click', generateShoppingList);
        inputRecipe.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                generateShoppingList();
            }
        });

        // Clear Shopping List
        clearButton.addEventListener('click', () => {
            shoppingList.innerHTML = '';
            shoppingListSection.classList.add('hidden');
            inputRecipe.value = '';
            displayMessage('Shopping list cleared.');
        });
    