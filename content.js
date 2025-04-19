// API key for OpenRouter
const apiKey = "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";

// Function to call the OpenRouter API
async function callOpenRouterApi(prompt) {
    // Display loading state
    console.log("Calling API... Please wait.");

    // --- API Call Configuration ---
    const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    const requestBody = {
        model: "meta-llama/llama-4-scout:free", // You can change the model if needed
        messages: [
            {
                role: "user",
                content: prompt || "Translate 'yellow' to vietnamese?", // The question being asked
            },
        ],
    };

    try {
        // Make the fetch request
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                // Use the API key variable defined above
                Authorization: `Bearer ${apiKey}`,
                // Optional headers removed for this basic example
                // 'HTTP-Referer': '<YOUR_SITE_URL>',
                // 'X-Title': '<YOUR_SITE_NAME>',
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody), // Convert the request body to a JSON string
        });

        // Check if the response status is OK (e.g., 200)
        if (!response.ok) {
            // If not OK, try to parse the error response and throw an error
            const errorData = await response.json().catch(() => ({})); // Try to get error details
            throw new Error(
                `API Error: ${response.status} ${response.statusText}. ${errorData.error?.message || ""}`,
            );
        }
        // Parse the successful JSON response
        const data = await response.json();
        // Extract the AI's message content
        // The structure might vary slightly based on the model/response
        const messageContent =
            data.choices?.[0]?.message?.content ||
            "No content found in response.";
        // Return the message content for use in other functions
        return messageContent.trim();
    } catch (error) {
        // Handle any errors during the fetch or processing
        console.error("API call failed:", error);
        return null;
    } finally {
        // Re-enable the button regardless of success or failure
    }
}

// Helper function to sleep/wait for a specified time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to get element by XPath
function getElementByXPath(xpath) {
  return document.evaluate(
    xpath, 
    document, 
    null, 
    XPathResult.FIRST_ORDERED_NODE_TYPE, 
    null
  ).singleNodeValue;
}

// Export functions for use in other files
// Note: In a Chrome extension, you'll typically import this file in your manifest.json
// and then access these functions through the chrome.* APIs or message passing