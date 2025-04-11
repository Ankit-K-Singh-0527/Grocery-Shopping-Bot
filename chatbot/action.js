
        // Function to navigate back to the main page
        function goBack() {
            window.history.back();
        }

        // Chatbot Functionality
        document.getElementById('sendButton').addEventListener('click', () => {
            handleUserInput();
        });

        document.getElementById('chatInput').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleUserInput();
            }
        });

        async function handleUserInput() {
            const chatWindow = document.getElementById('chatWindow');
            const chatInput = document.getElementById('chatInput');
            const userMessage = chatInput.value.trim();

            if (!userMessage) return;

            // Display user message
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message slide-right user-message p-3 rounded-lg inline-block max-w-xs text-black shadow-lg self-end';
            userMessageDiv.innerHTML = userMessage;
            chatWindow.appendChild(userMessageDiv);

            // Clear input field
            chatInput.value = '';

            // Scroll to the bottom
            chatWindow.scrollTop = chatWindow.scrollHeight;

            // Fetch bot response (e.g., healthiness of a product)
            const botResponse = await fetchProductDetails(userMessage);

            // Display bot response
            const botMessageDiv = document.createElement('div');
            botMessageDiv.className = 'message slide-left bot-message p-3 rounded-lg inline-block max-w-xs text-white shadow-lg';
            botMessageDiv.innerHTML = botResponse;
            chatWindow.appendChild(botMessageDiv);

            // Scroll to the bottom
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        // Fetch product details from OpenFoodFacts API
        async function fetchProductDetails(productName) {
            const API_URL = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&json=1`;

            try {
                const response = await fetch(API_URL);
                const data = await response.json();

                if (!data.products || data.products.length === 0) {
                    return `Sorry, I couldn't find any information about "${productName}". Can you try a different product?`;
                }

                // Analyze the first product in the results
                const product = data.products[0];
                const productNameResult = product.product_name || 'Unknown Product';
                const nutritionGrade = product.nutrition_grades || 'N/A';
                const ingredients = product.ingredients_text || 'No ingredient information available.';
                const calories = product.nutriments?.energy_kcal || 'Unknown';

                // Generate a response about healthiness
                let healthiness = '';
                if (nutritionGrade === 'a' || nutritionGrade === 'b') {
                    healthiness = 'healthy';
                } else if (nutritionGrade === 'c') {
                    healthiness = 'moderately healthy';
                } else {
                    healthiness = 'unhealthy';
                }

                return `
                    The product "${productNameResult}" is considered ${healthiness}. 
                    It has a nutrition grade of "${nutritionGrade.toUpperCase()}". 
                    Calories: ${calories} kcal. Ingredients: ${ingredients}.
                `;
            } catch (error) {
                console.error('Error fetching product details:', error);
                return 'Sorry, there was an error fetching the product information. Please try again later.';
            }
        }
    