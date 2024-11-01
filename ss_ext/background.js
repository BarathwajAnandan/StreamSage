    // Initialize a variable to hold the WebSocket connection
    let socket = null; let isConnected = false; // Variable to track connection status

    // Listen for messages sent from other parts of the extension
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)
    {
        if (request.action === 'connectWebSocket')
        {
            connectWebSocket().then(function()
            {
                sendResponse({ status: 'Connected' });
            }).catch(function()
            {
                console.log('Initial connection failed. Retrying to connect...');
                connectWebSocket().then(function()
                {
                    sendResponse({ status: 'Connected after retry' });
                }).catch(function()
                {
                    sendResponse({ status: 'Connection failed after retry' });
                });
            });
            return true; // Keep the message channel open for sendResponse
        }
    });

    // Function to attempt reconnection
    function attemptReconnection()
    {
        if (!isConnected)
        {
            console.log('Attempting to reconnect...');
            connectWebSocket().then(function()
            {
                console.log('Reconnection successful');
            }).catch(function()
            {
                console.log('Reconnection failed, will retry in 5 seconds');
            });
        }
    }

    // Function to establish a WebSocket connection
    function connectWebSocket()
    {
        return new Promise(function(resolve, reject)
        {
            const retryInterval = 5000; const heartbeatInterval = 30000; let heartbeatTimer = null; // Set intervals
            console.log('connectWebSocket called');

            // Check if the socket is already open
            if (socket !== null && socket.readyState === WebSocket.OPEN)
            {
                console.log('WebSocket is already open. readyState:', socket.readyState);
                resolve(); return;
            }

            // Initialize a new WebSocket connection
            console.log('Initializing new WebSocket connection to ws://localhost:3000');
            socket = new WebSocket('ws://localhost:3000');
            console.log('WebSocket instance created. current readyState:', socket.readyState);

            // Define what happens when the WebSocket connection is opened
            socket.onopen = function()
            {
                console.log('WebSocket connection established. readyState:', socket.readyState);
                isConnected = true; console.log('WebSocket is now connected.');
                // Start sending heartbeats to keep the connection alive
                heartbeatTimer = setInterval(function()
                {
                    if (socket && socket.readyState === WebSocket.OPEN)
                    {
                        socket.send(JSON.stringify({ type: 'heartbeat' }));
                        console.log('Heartbeat sent to server.');
                    }
                }, heartbeatInterval);
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
                        toggleMediaOnAllTabs(message.isMuted);
                    }
                    else if (message.type === 'heartbeat_ack')
                    {
                        console.log('Heartbeat acknowledged by server.');
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
                isConnected = false; socket = null; if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
                console.log(`Attempting to reconnect in ${retryInterval / 1000} seconds...`);
                setTimeout(function() { attemptReconnection(); }, retryInterval);
            };

            // Define what happens when an error occurs with the WebSocket
            socket.onerror = function(error)
            {
                console.log('WebSocket error occurred:', error, 'readyState:', socket.readyState);
                socket.close(); reject();
            };
        });
    }

    // Function to attempt WebSocket connection with retries
    function attemptWebSocketConnection(retryCount = 0, maxRetries = 5)
    {
        connectWebSocket().then(function()
        {
            console.log('WebSocket connected successfully.');
        }).catch(function()
        {
            console.log(`WebSocket connection attempt ${retryCount + 1} failed.`);
            if (retryCount < maxRetries)
            {
                console.log('Retrying...');
                setTimeout(function() { attemptWebSocketConnection(retryCount + 1, maxRetries); }, 5000); // Wait 5 seconds before retrying
            }
            else
            {
                console.log('Max retries reached. WebSocket connection failed.');
            }
        });
    }

    // Automatically initiate WebSocket connection when the background script loads
    attemptWebSocketConnection();

    // Listen for browser tab changes and ensure WebSocket is connected
    chrome.tabs.onActivated.addListener(function(activeInfo)
    {
        console.log('Tab activated. Ensuring WebSocket is connected...');
        attemptWebSocketConnection();
    });

    // Attempt to reconnect periodically if the connection is refused or lost
    setInterval(function()
    {
        if (!isConnected)
        {
            console.log('Periodic check: WebSocket not connected. Attempting to connect...');
            attemptWebSocketConnection();
        }
    }, 60000); // Check every 60 seconds

    // Function to toggle media playback on all active tabs
    function toggleMediaOnAllTabs(isMuted)
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
                    tabs.forEach(function(tab)
                    {
                        // Check if the tab is active
                        if (tab.active)
                        {
                            // Execute the toggleMedia function in the active tab
                            chrome.scripting.executeScript(
                                {
                                    target: { tabId: tab.id }, // Specify the target tab
                                    function: toggleMedia, // Specify the function to execute
                                    args: [isMuted] // Pass isMuted to the function
                                },
                                function()
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
                    console.log('Error in chrome.tabs.query callback:', error);
                }
            });
        }
        catch (error)
        {
            console.log('Error in toggleMediaOnAllTabs:', error);
        }
    }

    // Function to toggle play/pause on media elements
    function toggleMedia(isMuted)
    {
        try
        {
            console.log('toggleMedia function injected and executed');
            const mediaElements = document.querySelectorAll('video, audio');
            mediaElements.forEach(function(media)
            {
                try
                {
                    if (isMuted)
                    {
                        // If isMuted is true, pause the media if it's playing
                        if (!media.paused)
                        {
                            media.pause(); console.log('Paused media element:', media);
                        }
                    }
                    else
                    {
                        // If isMuted is false, play the media if it's paused
                        if (media.paused)
                        {
                            media.play(); console.log('Played media element:', media);
                        }
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