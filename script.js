// Profile section 
// Toggle Settings Menu
function toggleSettings(){
    document.getElementById('themeButton').classList.toggle('hidden');
    document.getElementById('settingsDropdown').classList.toggle('hidden');
}
function toggleSettingsMenu() {
    const settingsDropdown = document.getElementById('settingsDropdown');
    const themeDropdown = document.getElementById('themeDropdown');

    settingsDropdown.classList.toggle('hidden');

    // Close the theme menu if open
    if (!themeDropdown.classList.contains('hidden')) {
        themeDropdown.classList.add('hidden');
    }
}

// Toggle Theme Menu (Nested Dropdown)
function toggleThemeDropdown() {
    const themeDropdown = document.getElementById('themeDropdown');

    // Hide settings menu when theme menu is shown
    const settingsDropdown = document.getElementById('settingsDropdown');
    settingsDropdown.classList.add('hidden');

    themeDropdown.classList.toggle('hidden');
}

// Set the Theme Mode
function setTheme(mode) {
    const body = document.body;
    const contentBoxes = document.querySelectorAll('.content-box');

    if (mode === 'dark') {
        body.classList.add('bg-gray-900', 'text-white');
        body.classList.remove('bg-gray-100', 'text-black');
        document.getElementById('item').classList.add('bg-gray-700', 'text-white', 'placeholder-gray-400');
        document.getElementById('item').classList.remove('bg-white', 'text-black', 'placeholder-gray-500');
        contentBoxes.forEach(box => {
            box.classList.add('bg-gray-800', 'text-white');
            box.classList.remove('bg-white', 'text-black');
        });

    } else {
        body.classList.add('bg-gray-100', 'text-black');
        body.classList.remove('bg-gray-900', 'text-white');
        document.getElementById('item').classList.add('bg-white', 'text-black', 'placeholder-gray-500');
        document.getElementById('item').classList.remove('bg-gray-700', 'text-white', 'placeholder-gray-400');
        contentBoxes.forEach(box => {
            box.classList.add('bg-white', 'text-black');
            box.classList.remove('bg-gray-800', 'text-white');
        });
    }
    document.getElementById('themeButton').classList.toggle('hidden');
    document.getElementById('themeDropdown').classList.toggle('hidden');
}

// Close dropdowns when clicking outside
window.onclick = function(event) {
    const settingsDropdown = document.getElementById('settingsDropdown');
    const themeDropdown = document.getElementById('themeButton');
    const themeDropdownContent = document.getElementById('themeDropdown');

    if (!event.target.closest('.relative')) {
        settingsDropdown.classList.add('hidden');
        themeDropdown.classList.add('hidden');
        themeDropdownContent.classList.add('hidden');
    }
}

// Profile section closed

// Api Section & Grocery search section


// ✅ Fetch and Render Grocery Data from API
async function fetchAndRenderGrocery() {
    const item = document.getElementById('item').value.trim().toLowerCase();
    if (item) {
        let history = JSON.parse(localStorage.getItem("searchHistory")) || [];
        if (!history.includes(item)) {
            history.push(item);
            localStorage.setItem("searchHistory", JSON.stringify(history));
        }
    }
    const resultDiv = document.getElementById('result');

    if (!item) {
        resultDiv.innerHTML = '<p class="text-red-500">Please enter an item name.</p>';
        return;
    }
    // ✅ Save search item to history
   
    try {
        // Show loading indicator
        resultDiv.innerHTML = `<p class="text-blue-500">Loading...</p>`;

        // ✅ API URL with search term
        const API_URL = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(item)}&search_simple=1&json=1`;

        // Fetch data from API
        const response = await fetch(API_URL);
        const data = await response.json();

        // Check if there are products
        if (!data.products || data.products.length === 0) {
            resultDiv.innerHTML = `<p class="text-red-500">No results found for "${item}".</p>`;
            return;
        }

        // ✅ Render fetched products in the carousel
        renderProducts(data.products);
        
    } catch (error) {
        console.error("Error fetching data:", error);
        resultDiv.innerHTML = `<p class="text-red-500">Failed to fetch data. Please try again later.</p>`;
    }
}

// ✅ Function to render grocery items with the 'product-card' class
function renderProducts(products) {
    const resultDiv = document.getElementById('result');
    
    // Clear previous content and add carousel structure
    resultDiv.innerHTML = `
        <div id="carouselContainer" class="overflow-hidden relative w-full">
            <button id="btnLeft" class="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white
            px-4 py-2 rounded-full shadow-lg hover:bg-gray-700 z-10">
            ← 
            </button>
            <div id="carouselWrapper" class="flex transition-transform duration-3000 ease-in-out">
                <!-- Products will be injected here -->
            </div>
            <button id="btnRight" class="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white
            px-4 py-2 rounded-full shadow-lg hover:bg-gray-700 z-10">
            →
            </button>
        </div>
    `;

    const carouselWrapper = document.getElementById('carouselWrapper');

    products.slice(0, 12).forEach(product => {  // Display only top 12
        const productHTML = `
            <div class="product-card flex-shrink-0 w-full sm:w-1/2 md:w-1/3 lg:w-1/4 p-4">
                <div class="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden transition-transform hover:scale-105 hover:shadow-2xl min-h-[420px] max-h-[420px] flex flex-col justify-between">
                    <img src="${product.image_url || 'https://via.placeholder.com/200'}" 
                         alt="${product.product_name || 'No Name'}" 
                         class="w-full h-48 object-cover">
                    <div class="p-4 flex flex-col justify-between flex-grow">
                        <h2 class="text-lg font-bold dark:text-white truncate">${product.product_name || 'No Name'}</h2>
                        <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">Brand: ${product.brands || 'N/A'}</p>
                        <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">Category: ${product.categories || 'N/A'}</p>

                        <div class="flex justify-between items-center mt-4">
                            <p class="text-blue-600 font-semibold dark:text-blue-400">
                                ${product.nutriments?.energy_kcal ? `${product.nutriments.energy_kcal} kcal` : 'N/A'}
                            </p>
                            <div class="flex flex-col gap-2">
                                <button onclick="viewMore('${product.code}')"
                                    class="bg-blue-500 text-white px-4 py-1 rounded-lg hover:bg-blue-600 transition">
                                    View More
                                </button>
                                <button class="add-to-cart-btn bg-green-500 text-white px-4 py-1 rounded-lg hover:bg-green-600 transition" data-product='${JSON.stringify(product)}'>
                                    Add to Cart
                                </button>


                            </div>

                        </div>
                    </div>
                </div>
            </div>
        `;
        carouselWrapper.innerHTML += productHTML;   // Append the product HTML inside the wrapper
        });
        // Attach event listeners to all "Add to Cart" buttons
document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', function () {
        const productData = JSON.parse(this.getAttribute('data-product'));
        addToCart(productData);
    });
});
            document.getElementById('btnLeft').addEventListener('click', handleLeftClick);
            document.getElementById('btnRight').addEventListener('click', handleRightClick);
    
        
           // Pause animation on hover
const carouselContainer = document.getElementById('carouselContainer');

// when mouse enter to the carousel, stop the animation
carouselContainer.addEventListener('mouseenter', () => {
    clearInterval(intervalId);
} )

// when mouse leave the carousel, start the animation
carouselContainer.addEventListener('mouseleave', ()=>{
    startCarousel();
} )


    // ✅ Start the carousel animation after rendering products
    startCarousel();
}

// ✅ Carousel Animation with Tailwind
let currentSlide = 0;
let intervalId;
function startCarousel() {
    const carouselWrapper = document.getElementById('carouselWrapper');
    const productCards = document.querySelectorAll('.product-card');
    const totalSlides = Math.ceil(productCards.length / 4);

    // Clear the interval if already running
    clearInterval(intervalId);
    intervalId = setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;

        // Sliding animation using Tailwind classes
        // 0.7 sec will be taken for transition means sliding 
        carouselWrapper.classList.add('transform', 'duration-[2000]', 'ease-in-out');
        carouselWrapper.style.transition = 'transform 1s ease-in-out';
        carouselWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
    }, 3000);  // Slide every 2 seconds means for 2 sec one slide will be shown
}

// ✅ Function to slide left and right
    // ✅Left Navigation Button
    function handleLeftClick(){
        const productCards = document.querySelectorAll('.product-card');
        if(productCards.length === 0) return;
        const totalSlides = Math.ceil(productCards.length / 4);
        if(currentSlide <= 0 ) {document.getElementById('btnLeft').disabled = true ; return;}
        // Move backward (circular navigation)
        currentSlide--;
        document.getElementById('carouselWrapper').style.transform = `translateX(-${currentSlide * 100}%)`;
        document.getElementById('btnRight').disabled = false;
    }
    
    // ✅Right Navigation Button
    function handleRightClick(){
        const productCards = document.querySelectorAll('.product-card');
        if(productCards.length === 0) return;
        const totalSlides = Math.ceil(productCards.length / 4);
        if(currentSlide >= totalSlides - 1) {document.getElementById('btnRight').disabled = true ; return;}
        // Move forward (circular navigation)
        currentSlide++;
        document.getElementById('carouselWrapper').style.transform = `translateX(-${currentSlide * 100}%)`;
        document.getElementById('btnLeft').disabled = false;
    } 


// ✅ Function to display more details when clicking "View More"
async function viewMore(productCode) {
    const resultDiv = document.getElementById('result');
    const API_URL = `https://world.openfoodfacts.org/api/v0/product/${productCode}.json`;

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!data || !data.product) {
            resultDiv.innerHTML = `<p class="text-red-500">No additional details found.</p>`;
            return;
        }

        const product = data.product;

        // ✅ Display detailed info
        resultDiv.innerHTML = `
            <div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <h2 class="text-3xl font-bold text-blue-600">${product.product_name || 'No Name'}</h2>
                <img src="${product.image_url || 'https://via.placeholder.com/300'}" 
                     alt="${product.product_name}" 
                     class="w-full h-64 object-cover rounded-lg mt-4">

                <p class="text-lg text-gray-600 dark:text-gray-300 mt-4">
                    <strong>Brand:</strong> ${product.brands || 'N/A'}
                </p>
                <p class="text-lg text-gray-600 dark:text-gray-300">
                    <strong>Categories:</strong> ${product.categories || 'N/A'}
                </p>
                <p class="text-lg text-gray-600 dark:text-gray-300">
                    <strong>Ingredients:</strong> ${product.ingredients_text || 'N/A'}
                </p>
                <p class="text-lg text-gray-600 dark:text-gray-300">
                    <strong>Nutritional Info:</strong> ${product.nutriments?.energy_kcal || 'N/A'} kcal
                </p>

                <button onclick="fetchAndRenderGrocery()" 
                        class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
                    Back to Results
                </button>
                <button class="add-to-cart-btn bg-green-500 text-white px-4 py-1 rounded-lg hover:bg-green-600 transition" data-product='${JSON.stringify(product)}'>
    Add to Cart
</button>


            </div>
        `;

    } catch (error) {
        console.error("Error fetching details:", error);
        resultDiv.innerHTML = `<p class="text-red-500">Failed to fetch details. Please try again later.</p>`;
    }
}

// Function to add product to cart
function addToCart(product) {
    // Load existing cart from localStorage or start fresh
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // Check for duplicates
    if (cart.some(item => item.code === product.code)) {
        alert("Already in cart.");
        return;
    }

    cart.push(product);
    localStorage.setItem('cart', JSON.stringify(cart));  // Save to localStorage

    alert(`✅ "${product.product_name}" added to cart!`);
}

// Function to call slideLeft and slideRight functions


// ✅ Clear Results Function
function clearResults() {
    const resultDiv = document.getElementById('result').innerHTML = '';;
    document.getElementById('item').value = '';
}

// ✅ Function to load Lottie library
function loadLottie(callbackFunc){
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.9.6/lottie.min.js";
    script.onload = callbackFunc;
    document.head.appendChild(script);
}

// ✅ Function to initialize after the script is loaded
window.addEventListener('DOMContentLoaded', ()=>{
    loadLottie(() => { 
        const cartContainer = document.getElementById('cart-container');
        lottie.loadAnimation({
            container : cartContainer,
            render: 'svg',
            loop: true,
            autoplay: true,
            path: './Animation - 1743155879183.json'
        });
    });
} );
// ✅ Added the Enter key event listener to the input field
document.addEventListener('DOMContentLoaded', () => {
document.getElementById('item').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        fetchAndRenderGrocery();
    }
}); });

// ✅ Personalized List Section
async function getPersonalizedListFromAPI() {
    const searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

    if (searchHistory.length === 0) {
        document.getElementById("result").innerHTML = "<p class='text-red-500'>No personalized items found in your history.</p>";
        return;
    }

    document.getElementById("result").innerHTML = "<p class='text-blue-500'>Fetching personalized suggestions...</p>";

    const personalizedResults = [];

    for (const item of searchHistory) {
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/search?categories_tags=${item}&page_size=1`);
        const data = await response.json();

        if (data.products && data.products.length > 0) {
            personalizedResults.push(data.products[0]);
        }
    }

    renderPersonalizedList(personalizedResults);
}

function renderPersonalizedList(products) {
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "<h2 class='text-xl font-bold mb-4 text-blue-600'>Your Personalized Recommendations:</h2>";

    if (products.length === 0) {
        resultDiv.innerHTML += "<p class='text-gray-700'>No products found based on your previous searches.</p>";
        return;
    }

    const container = document.createElement("div");
    container.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "bg-white p-4 rounded-lg shadow";

        const image = product.image_url || 'https://via.placeholder.com/150';
        const name = product.product_name || "No name";
        const brand = product.brands || "N/A";

        card.innerHTML = `
            <img src="${image}" alt="${name}" class="h-40 w-full object-cover mb-2 rounded">
            <h3 class="font-semibold text-lg">${name}</h3>
            <p class="text-sm text-gray-600">Brand: ${brand}</p>
        `;

        container.appendChild(card);
    });

    resultDiv.appendChild(container);
}
