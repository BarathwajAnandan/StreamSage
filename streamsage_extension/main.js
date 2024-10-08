const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let wss;

function createWindow () {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    console.log('Initializing WebSocket server on port 3000');
    // Initialize WebSocket server on port 3000
    wss = new WebSocket.Server({ port: 3000 }, () => {
        console.log('WebSocket Server is listening on ws://localhost:3000');
    });

    wss.on('connection', (ws) => {
        console.log('A new client Connected!');
        ws.send('Welcome New Client!');

        ws.on('message', (message) => {
            console.log('received: %s', message);
            // Broadcast to all connected clients
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                    console.log('Broadcasted message to a client');
                }
            });
        });

        ws.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });

        ws.on('close', () => {
            console.log('Chrome extension disconnected');
        });
    });

    // Handle IPC from renderer to send commands via WebSocket
    ipcMain.on('send-toggle', (event, arg) => {
        console.log('Received toggle command from renderer');
        sendToggleCommand();
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    console.log('All windows closed. Quitting app.');
    if (process.platform !== 'darwin') app.quit();
});

// Function to send toggle command to all connected clients
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