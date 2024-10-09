// Initialize a variable to hold the WebSocket connection
let socket = null;

// Listen for messages sent from other parts of the extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) 
{
    try
    {
        // Check if the action requested is to connect to the WebSocket
        if (request.action === 'connectWebSocket') 
        {
            console.log('Received connectWebSocket request'); // Log the request
            connectWebSocket(); // Call the function to connect to the WebSocket
            sendResponse({ status: 'Connecting to WebSocket server' }); // Send a response back
        }
        return true; // Indicate that the response will be sent asynchronously
    }
    catch (error)
    {
        console.error('Error in onMessage listener:', error); // Log any errors that occur
        return true; // Indicate that the response will be sent asynchronously
    }
});

// Function to establish a WebSocket connection
function connectWebSocket() 
{
    const retryInterval = 5000; // Set the retry interval to 5 seconds

    try
    {
        console.log('connectWebSocket called'); // Log that the function was called

        // Check if the socket is already open
        if (socket !== null && socket.readyState === WebSocket.OPEN) 
        {
            console.log(`WebSocket is already open. readyState: ${socket.readyState}`); // Log the current state
            return; // Exit the function if the socket is already open
        }

        // Initialize a new WebSocket connection
        console.log('Initializing new WebSocket connection to ws://localhost:3000');
        socket = new WebSocket('ws://localhost:3000'); // Create a new WebSocket instance
        console.log(`WebSocket instance created. current readyState: ${socket.readyState}`); // Log the current state

        // Define what happens when the WebSocket connection is opened
        socket.onopen = function() 
        {
            console.log('WebSocket connection established. readyState:', socket.readyState); // Log the successful connection
        };

        // Define what happens when a message is received from the server
        socket.onmessage = function(event) 
        {
            try
            {
                console.log('Received from server:', event.data); // Log the received message
                const message = JSON.parse(event.data); // Parse the message data
                // Check if the action in the message is to toggle media
                if (message.action === 'toggleMedia') 
                {
                    console.log('Action "toggleMedia" received. Toggling media on all tabs.'); // Log the action
                    toggleMediaOnAllTabs(); // Call the function to toggle media on all tabs
                }
                else 
                {
                    console.log('Unknown action received:', message.action); // Log if the action is unknown
                }
            }
            catch (error) 
            {
                console.error('Error in onmessage handler:', error); // Log any errors that occur while handling the message
            }
        };

        // Define what happens when the WebSocket connection is closed
        socket.onclose = function(event) 
        {
            console.log('WebSocket connection closed:', event.reason, 'readyState:', socket.readyState); // Log the closure reason
            socket = null; // Reset the socket variable
            console.log(`Attempting to reconnect in ${retryInterval / 1000} seconds...`); // Log the reconnection attempt
            setTimeout(connectWebSocket, retryInterval); // Attempt to reconnect after the specified interval
        };

        // Define what happens when an error occurs with the WebSocket
        socket.onerror = function(error) 
        {
            console.log('WebSocket error occurred:', error, 'readyState:', socket.readyState); // Log the error
            socket.close(); // Close the socket on error
        };
    }
    catch (error)
    {
        console.log('Error in connectWebSocket:', error); // Log any errors that occur in this function
        console.log(`Attempting to reconnect in ${retryInterval / 1000} seconds...`); // Log the reconnection attempt
        setTimeout(connectWebSocket, retryInterval); // Attempt to reconnect after the specified interval
    }
}

// Function to toggle media playback on all active tabs
function toggleMediaOnAllTabs() 
{
    try
    {
        console.log('toggleMediaOnAllTabs called'); // Log that the function was called
        // Query all tabs in the browser
        chrome.tabs.query({}, function(tabs) 
        {
            try
            {
                // Loop through each tab
                tabs.forEach(tab => 
                {
                    // Check if the tab is active
                    if (tab.active) 
                    {
                        // Execute the toggleMedia function in the active tab
                        chrome.scripting.executeScript(
                            {
                                target: { tabId: tab.id }, // Specify the target tab
                                function: toggleMedia // Specify the function to execute
                            },
                            () => 
                            {
                                // Check for errors after executing the script
                                if (chrome.runtime.lastError) 
                                {
                                    console.log('Error executing toggleMedia on tab', tab.id, ':', chrome.runtime.lastError.message); // Log the error
                                }
                                else 
                                {
                                    console.log('toggleMedia executed successfully on tab', tab.id); // Log success
                                }
                            }
                        );
                    }
                });
            }
            catch (error)
            {
                console.log('Error in tabs.query callback:', error); // Log any errors that occur in the callback
            }
        });
    }
    catch (error)
    {
        console.log('Error in toggleMediaOnAllTabs:', error); // Log any errors that occur in this function
    }
}

// Function to toggle play/pause on media elements
function toggleMedia() 
{
    try
    {
        console.log('toggleMedia function injected and executed'); // Log that the function was executed
        const mediaElements = document.querySelectorAll('video, audio'); // Select all video and audio elements
        mediaElements.forEach(media => 
        {
            try
            {
                // Check if the media is paused
                if (media.paused) 
                {
                    media.play(); // Play the media if it is paused
                    console.log('Played media element:', media); // Log the action
                }
                else 
                {
                    media.pause(); // Pause the media if it is playing
                    console.log('Paused media element:', media); // Log the action
                }
            }
            catch (error)
            {
                console.error('Error toggling individual media element:', error); // Log any errors that occur while toggling media
            }
        });
    }
    catch (error)
    {
        console.error('Error in toggleMedia:', error); // Log any errors that occur in this function
    }
}