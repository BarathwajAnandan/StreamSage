const { ipcRenderer } = require('electron');

document.getElementById('toggleButton').addEventListener('click', () => {
    ipcRenderer.send('send-toggle', 'toggleMedia');
});