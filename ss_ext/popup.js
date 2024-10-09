document.getElementById('playButton').addEventListener('click', function() 
{
    console.log('Play button clicked');
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) 
    {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabs[0].id },
                function: playMedia
            },
            () => 
            {
                if (chrome.runtime.lastError) 
                {
                    console.error('Error executing playMedia:', chrome.runtime.lastError.message);
                }
                else 
                {
                    console.log('playMedia executed successfully');
                }
            }
        );
    });
});

document.getElementById('pauseButton').addEventListener('click', function() 
{
    console.log('Pause button clicked');
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) 
    {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabs[0].id },
                function: pauseMedia
            },
            () => 
            {
                if (chrome.runtime.lastError) 
                {
                    console.error('Error executing pauseMedia:', chrome.runtime.lastError.message);
                }
                else 
                {
                    console.log('pauseMedia executed successfully');
                }
            }
        );
    });
});

document.getElementById('connectButton').addEventListener('click', function() 
{
    console.log('Connect button clicked');
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = 'Connecting...';

    chrome.runtime.sendMessage({ action: 'connectWebSocket' }, function(response) 
    {
        if (chrome.runtime.lastError) 
        {
            console.error('Error sending connectWebSocket message:', chrome.runtime.lastError.message);
            statusMessage.textContent = 'Connection failed last Error';
        }
        else 
        {
            console.log('connectWebSocket message sent successfully');
            if (response.status === 'Connected') 
            {
                statusMessage.textContent = 'Connected';
            }
            else 
            {
                statusMessage.textContent = 'Connection failed';
            }
        }
    });
});

// Functions to be injected into the page
function playMedia() 
{
    console.log('playMedia function injected and executed');
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => 
    {
        media.play();
        console.log('Played media element:', media);
    });
}

function pauseMedia() 
{
    console.log('pauseMedia function injected and executed');
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => 
    {
        media.pause();
        console.log('Paused media element:', media);
    });
}