document.addEventListener('DOMContentLoaded', function() 
{
    const statusDiv = document.getElementById('status')
    const toggleButton = document.getElementById('toggleButton')

    // Update status on load
    updateMediaStatus()

    // Add event listener to button
    toggleButton.addEventListener('click', function() 
    {
        chrome.runtime.sendMessage({action: "toggleMedia"})
        setTimeout(updateMediaStatus, 500) // Delay to allow state change
    })

    function updateMediaStatus()
    {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) 
        {
            chrome.scripting.executeScript(
                {
                    target: {tabId: tabs[0].id},
                    function: getMediaStatus
                },
                (results) => 
                {
                    if (results && results[0] && results[0].result)
                    {
                        statusDiv.textContent = results[0].result
                    }
                    else
                    {
                        statusDiv.textContent = 'No media found'
                    }
                }
            )
        })
    }
})

function getMediaStatus()
{
    const mediaElements = document.querySelectorAll('video, audio')

    if (mediaElements.length === 0)
    {
        return 'No media on this page'
    }

    const isPlaying = Array.from(mediaElements).some(media => !media.paused)

    return isPlaying ? 'Playing' : 'Paused'
}