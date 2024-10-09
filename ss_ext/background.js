let socket = null;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) 
{
    if (request.action === 'connectWebSocket') 
    {
        console.log('Received connectWebSocket request');
        connectWebSocket();
        sendResponse({ status: 'Connecting to WebSocket server' });
    }
    return true;
});

function connectWebSocket() 
{
    console.log('connectWebSocket called');

    if (socket !== null && socket.readyState === WebSocket.OPEN) 
    {
        console.log(`WebSocket is already open. readyState: ${socket.readyState}`);
        return;
    }

    console.log('Initializing new WebSocket connection to ws://localhost:3000');
    socket = new WebSocket('ws://localhost:3000');
    console.log(`WebSocket instance created. current readyState: ${socket.readyState}`);

    socket.onopen = function() 
    {
        console.log('WebSocket connection established. readyState:', socket.readyState);
    };

    socket.onmessage = function(event) 
    {
        console.log('Received from server:', event.data);
        try 
        {
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
            console.error('Error parsing message:', error);
        }
    };

    socket.onclose = function(event) 
    {
        console.log('WebSocket connection closed:', event.reason, 'readyState:', socket.readyState);
        socket = null;
    };

    socket.onerror = function(error) 
    {
        console.error('WebSocket error occurred:', error, 'readyState:', socket.readyState);
    };
}

function toggleMediaOnAllTabs() 
{
    console.log('toggleMediaOnAllTabs called');
    chrome.tabs.query({}, function(tabs) 
    {
        tabs.forEach(tab => 
        {
            if (tab.active) 
            {
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tab.id },
                        function: toggleMedia
                    },
                    () => 
                    {
                        if (chrome.runtime.lastError) 
                        {
                            console.error('Error executing toggleMedia on tab', tab.id, ':', chrome.runtime.lastError.message);
                        }
                        else 
                        {
                            console.log('toggleMedia executed successfully on tab', tab.id);
                        }
                    }
                );
            }
        });
    });
}

function toggleMedia() 
{
    console.log('toggleMedia function injected and executed');
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => 
    {
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
    });
}