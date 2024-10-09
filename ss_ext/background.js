// Initialize a variable to hold the WebSocket connection
let socket = null;

// Variable to track connection status
let isConnected = false;

// Listen for messages sent from other parts of the extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) 
{
    if (request.action === 'connectWebSocket') 
    {
        connectWebSocket()
            .then(() => 
            {
                sendResponse({ status: 'Connected' });
            })
            .catch(() => 
            {
                sendResponse({ status: 'Connection failed' });
            });
        return true; // Keep the message channel open for sendResponse
    }
    // Handle other actions if necessary
});

// Function to establish a WebSocket connection
function connectWebSocket() 
{
    return new Promise(function(resolve, reject) 
    {
        const retryInterval = 5000; // Set the retry interval to 5 seconds

        console.log('connectWebSocket called');

        // Check if the socket is already open
        if (socket !== null && socket.readyState === WebSocket.OPEN) 
        {
            console.log(`WebSocket is already open. readyState: ${socket.readyState}`);
            resolve();
            return;
        }

        // Initialize a new WebSocket connection
        console.log('Initializing new WebSocket connection to ws://localhost:3000');
        socket = new WebSocket('ws://localhost:3000');
        console.log(`WebSocket instance created. current readyState: ${socket.readyState}`);

        // Define what happens when the WebSocket connection is opened
        socket.onopen = function() 
        {
            console.log('WebSocket connection established. readyState:', socket.readyState);
            isConnected = true;
            resolve();
        };

        // Define what happens when a message is received from the server
        socket.onmessage = function(event) 
        {
            try
            {
                console.log('Received from server:', event.data);
                const message = JSON.parse(event.data);
                if (message.action === 'toggleMedia') 
                {
                    console.log('Action "toggleMedia" received. Toggling media on all tabs.');
                    toggleMediaOnAllTabs();
                }
                else 
                {
                    console.log('Unknown action received:', message.action);
                }
            }
            catch (error) 
            {
                console.error('Error in onmessage handler:', error);
            }
        };

        // Define what happens when the WebSocket connection is closed
        socket.onclose = function(event) 
        {
            console.log('WebSocket connection closed:', event.reason, 'readyState:', socket.readyState);
            socket = null;
            isConnected = false;
            console.log(`Attempting to reconnect in ${retryInterval / 1000} seconds...`);
            setTimeout(connectWebSocket, retryInterval);
        };

        // Define what happens when an error occurs with the WebSocket
        socket.onerror = function(error) 
        {
            console.log('WebSocket error occurred:', error, 'readyState:', socket.readyState);
            socket.close();
            reject();
        };
    });
}

// Function to toggle media playback on all active tabs
function toggleMediaOnAllTabs() 
{
    try
    {
        console.log('toggleMediaOnAllTabs called');
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
                                    console.log('Error executing toggleMedia on tab', tab.id, ':', chrome.runtime.lastError.message);
                                }
                                else 
                                {
                                    console.log('toggleMedia executed successfully on tab', tab.id);
                                }
                            }
                        );
                    }
                });
            }
            catch (error)
            {
                console.log('Error in tabs.query callback:', error);
            }
        });
    }
    catch (error)
    {
        console.log('Error in toggleMediaOnAllTabs:', error);
    }
}

// Function to toggle play/pause on media elements
function toggleMedia() 
{
    try
    {
        console.log('toggleMedia function injected and executed');
        const mediaElements = document.querySelectorAll('video, audio');
        mediaElements.forEach(media => 
        {
            try
            {
                // Check if the media is paused
                if (media.paused) 
                {
                    media.play();
                    console.log('Played media element:', media);
                }
                else 
                {
                    media.pause();
                    console.log('Paused media element:', media);
                }
            }
            catch (error)
            {
                console.error('Error toggling individual media element:', error);
            }
        });
    }
    catch (error)
    {
        console.error('Error in toggleMedia:', error);
    }
}