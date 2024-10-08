(() => {
    // Remove direct WebSocket connection from content.js

    function toggleMediaPlayback() {
        const mediaElements = document.querySelectorAll('video, audio');

        if (mediaElements.length === 0) {
            console.log('No media elements found on this page.');
            return;
        }

        mediaElements.forEach(media => {
            if (media.paused) {
                media.play();
            } else {
                media.pause();
            }
        });

        // Send a message to background.js to handle the toggle command
        chrome.runtime.sendMessage({ action: 'toggleMedia' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background:', chrome.runtime.lastError);
            } else {
                console.log('Toggle command sent to background.js');
            }
        });

        console.log('Attempting to establish WebSocket connection to ws://localhost:3000/');
        const socket = new WebSocket('ws://localhost:3000/');

        socket.addEventListener('open', function (event) {
            console.log('WebSocket connection established');
            // You can send messages here
        });

        socket.addEventListener('error', function (event) {
            console.error('WebSocket error:', event);
            console.log('Error details:', event.message || event);
        });

        socket.addEventListener('message', function (event) {
            console.log('Message from server:', event.data);
        });

        socket.addEventListener('close', function (event) {
            console.log('WebSocket connection closed:', event);
        });
    }

    // Example: Add a keyboard shortcut or button to trigger toggleMediaPlayback
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'm') { // Example: Ctrl + M
            toggleMediaPlayback();
        }
    });
})();