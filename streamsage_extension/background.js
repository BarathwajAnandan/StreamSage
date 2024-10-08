// Ping the server every 30 seconds to keep the connection alive
setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'ping' }));
        console.log('Ping sent to server');
    }
}, 30000); // 30 seconds

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) 
{
    if (request.action === "toggleMedia")
    {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) 
        {
            if (tabs.length === 0) {
                console.warn('No active tabs found.');
                return;
            }

            const activeTab = tabs[0];
            console.log('Executing toggleMediaPlayback in active tab:', activeTab.id);

            chrome.scripting.executeScript(
                {
                    target: {tabId: activeTab.id},
                    function: toggleMediaPlayback
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error('executeScript error:', chrome.runtime.lastError);
                    } else {
                        console.log('Successfully executed toggleMediaPlayback in tab:', activeTab.id);
                    }
                }
            );
        });
    }
    else if (request.action === "updateStatus")
    {
        updateStatus(request.status)
    }
});

function toggleMediaPlayback()
{
    console.log('toggleMediaPlayback function invoked.');
    const mediaElements = document.querySelectorAll('video, audio');

    if (mediaElements.length === 0)
    {
        alert('No media elements found on this page.');
        console.log('No media elements found on this page.');
        return;
    }

    mediaElements.forEach(function(media) 
    {
        if (media.paused)
        {
            media.play().then(() => {
                console.log('Media played:', media);
            }).catch(error => {
                console.error('Error playing media:', error);
            });
        }
        else
        {
            media.pause();
            console.log('Media paused:', media);
        }
    });
}

function updateStatus(status)
{
    // Handle status updates if needed
    console.log('Media status:', status)
}

// Initialize WebSocket connection
console.log('Attempting to establish WebSocket connection to ws://127.0.0.1:3000/');
const socket = new WebSocket('ws://127.0.0.1:3000/');

socket.addEventListener('open', function (event) {
    console.log('WebSocket connection established in background.js');
    // You can send messages here
});

socket.addEventListener('error', function (event) {
    console.error('WebSocket error in background.js:', event);
    // Implement additional error handling if necessary
});

socket.addEventListener('message', function (event) {
    console.log('Message from server in background.js:', event.data);
    try {
        const message = JSON.parse(event.data);
        if (message.action === 'toggleMedia') {
            console.log('Received toggleMedia command from WebSocket server');

            // Query the active tab in the current window
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs.length === 0) {
                    console.warn('No active tabs found.');
                    return;
                }

                const activeTab = tabs[0];
                console.log('Active tab ID:', activeTab.id);

                // Execute the toggleMediaPlayback function in the active tab
                chrome.scripting.executeScript(
                    {
                        target: {tabId: activeTab.id},
                        function: toggleMediaPlayback
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.error('executeScript error:', chrome.runtime.lastError);
                        } else {
                            console.log('Executed toggleMediaPlayback in active tab:', activeTab.id);
                        }
                    }
                );
            });
        } else {
            console.warn('Unknown action received:', message.action);
        }
    } catch (error) {
        console.error('Error parsing message from WebSocket:', error);
    }
});

socket.addEventListener('close', function (event) {
    console.log('WebSocket connection closed in background.js:', event);
    // Implement reconnection logic if necessary
});

// Remove the duplicate message listener to avoid conflicts
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === 'toggleMedia') {
//         console.log('Received toggleMedia command from content.js');
//         // Forward the toggle command to the WebSocket server
//         socket.send(JSON.stringify({ action: 'toggleMedia' }));
//     }
// });

// Function to send toggle command to all connected clients (if needed)
function sendToggleCommand() {
    const message = JSON.stringify({ action: 'toggleMedia' });
    console.log('Sending toggleMedia command to all connected clients');
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            console.log('Sent toggleMedia command to a client');
        }
    });
}