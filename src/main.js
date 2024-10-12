// Import necessary modules from Electron and other libraries
const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const WebSocket = require('ws');

// Load environment variables from .env file
dotenv.config();

// Declare variables for the main window and backend processor
let mainWindow;
let backendProcessor;
const screenAudio_filename = 'recorded_audio.webm'; // Define the audio file name

// Import the BackendProcessor class from the main_backend module
const BackendProcessor = require('./main_backend');

// Function to initialize the backend processor
function initializeBackendProcessor() 
{
  // Create a new instance of BackendProcessor and run it
  backendProcessor = new BackendProcessor(mainWindow);
  backendProcessor.run().catch(console.error); // Catch and log any errors
}

// Function to list available media devices
async function listDevices() 
{
  // Get the list of media devices
  const devices = await navigator.mediaDevices.enumerateDevices();
  // Log each device's kind, label, and ID
  devices.forEach(device => 
  {
    console.log(`${device.kind}: ${device.label} id = ${device.deviceId}`);
  });
}

/**
 * Creates and configures the main application window.
 */
function createWindow() 
{
  // const primaryDisplay = screen.getPrimaryDisplay();

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  // Create a new BrowserWindow instance with specified dimensions and settings
  mainWindow = new BrowserWindow(
  {
    width: 380,
    height: 500,
    alwaysOnTop: true, // This makes the window always on top
    x: width - 200, // Position from the right
    y: 0, // Position from the top
    webPreferences: 
    {
      nodeIntegration: true, // Enable Node.js integration
      contextIsolation: false, // Disable context isolation
      devTools: true // Enable developer tools
    },
  });

  // Load the main HTML file into the window
  mainWindow.loadFile('src/index.html');
  // Set the window's position
  mainWindow.setPosition(mainWindow.getPosition()[0], 40);
  // Remove the window menu
  mainWindow.setMenu(null);

  // Event listener for when the window is closed
  mainWindow.on('closed', () => 
  {
    mainWindow = null; // Clear the reference to the main window
    app.quit(); // Quit the application
  });

  // Initialize the backend processor
  initializeBackendProcessor();

  // Enable the console window for debugging
  // mainWindow.webContents.openDevTools();
}

/**
 * Handles saving audio data to a file.
 * @param {ArrayBuffer} arrayBuffer - The audio data.
 * @param {string} fileName - The name of the file to save.
 */
function handleSaveAudio(arrayBuffer, fileName) 
{
  // Check if the received data is an ArrayBuffer
  if (!(arrayBuffer instanceof ArrayBuffer)) 
  {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return; // Exit the function if the data is invalid
  }

  // Construct the file path for saving the audio
  const filePath = path.join(__dirname, '..', 'StreamSage', fileName);
  const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer

  // Write the buffer to the specified file
  fs.writeFile(filePath, buffer, (err) => 
  {
    if (err) 
    {
      console.error('Failed to save audio:', err); // Log error if saving fails
    } 
    else 
    {
      console.log('Audio saved successfully. File size:', buffer.length); // Log success message
      if (buffer.length > 0) 
      {
        console.log('Processing audio after recording!'); // Log that audio is being processed
        // backendProcessor.processAudio(); // Uncomment to process audio
      } 
      else 
      {
        console.log('Audio file is empty, not processing'); // Log if the audio file is empty
      }
    }
  });
}

/**
 * Handles saving and processing a user question.
 * @param {ArrayBuffer} arrayBuffer - The question audio data.
 */
function handleSaveQuestion(arrayBuffer) 
{
  // Check if the received data is an ArrayBuffer
  if (!(arrayBuffer instanceof ArrayBuffer)) 
  {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return; // Exit the function if the data is invalid
  }

  // Construct the file path for saving the user question audio
  const filePath = path.join(__dirname, '..', 'StreamSage', 'user_question.wav');
  const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer

  // Write the buffer to the specified file
  fs.writeFile(filePath, buffer, (err) => 
  {
    if (err) 
    {
      console.error('Failed to save audio:', err); // Log error if saving fails
    } 
    else 
    {
      console.log('Audio saved successfully. File size:', buffer.length); // Log success message
      if (buffer.length > 0) 
      {
        console.log('Processing question'); // Log that the question is being processed
        backendProcessor.processQuestion(); // Call to process the user question
      } 
      else 
      {
        console.log('Audio file is empty, not processing'); // Log if the audio file is empty
      }
    }
  });
}

// Application event listeners
app.whenReady().then(() => 
{
    createWindow(); // Create the window when the app is ready
    // Initialize WebSocket server on port 3000

    
    wss = new WebSocket.Server({ port: 3000 }, () => 
    {
        console.log('WebSocket Server is listening on ws://localhost:3000');
    });

    let connectionCount = 0; // Variable to track the number of connections

    wss.on('connection', (ws) => 
    {
        console.log('Chrome extension connected via WebSocket');
        connectionCount++; // Increment the connection count
        console.log('Number of previous connections:', connectionCount - 1);

        // Kill all previous connections
        wss.clients.forEach(client => 
        {
            if (client !== ws && client.readyState === WebSocket.OPEN) 
            {
                client.close(); // Close the previous connection
                console.log('Closed a previous connection');
            }
        });

        ws.on('message', (message) => 
        {
            console.log('Received from Chrome extension:', message);
            // Handle incoming messages from the extension if needed
        });

        ws.on('close', () => 
        {
            console.log('Chrome extension disconnected');
            connectionCount--; // Decrement the connection count on disconnect
        }); 
    });
  
    // Handle IPC from renderer to send commands via WebSocket
    ipcMain.on('send-toggle', (event, arg) => 
    {
        console.log('Received toggle command from renderer');
        sendToggleCommand();
    });
  
    app.on('activate', function () 
    {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => 
{
  if (process.platform !== 'darwin') app.quit(); // Quit the app if not on macOS
});

app.on('activate', () => 
{
  if (BrowserWindow.getAllWindows().length === 0) createWindow(); // Recreate the window if there are none
});

// IPC event listeners
ipcMain.on('toggle-mute', (event, isMuted) => 
{
  backendProcessor.setMute(isMuted); // Set mute state in the backend processor
  sendToggleCommand(isMuted);
  // if (mainWindow && !mainWindow.isDestroyed()) 
  // {
  //   mainWindow.webContents.send('toggle-mute-changed', isMuted); // Notify the main window of mute state change
  // }
});

ipcMain.on('toggle-recording', (event, isRecording) => 
{
  backendProcessor.setRecording(isRecording); // Toggle microphone recording state

});

//TODO: USE IT
ipcMain.on('toggle-voice', (event, isEnabled) => 
{
  backendProcessor.setVoiceEnabled(isEnabled); // Set voice enabled state in the backend processor
});

// Handle request to get media sources
ipcMain.handle('get-sources', async () => 
{
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] }); // Get media sources
  return sources.map(source => 
  {
    // Map the sources to return their ID, name, and thumbnail
    return {
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    };
  });
});

// Handle save-audio event
ipcMain.on('save-audio', (event, arrayBuffer, fileName) => 
{
  console.log('Received save-audio event'); // Log the event
  handleSaveAudio(arrayBuffer, fileName); // Call the function to save audio
});

// Handle save-question event
ipcMain.on('save-question', (event, arrayBuffer) => 
{
  console.log('Received save-question event'); // Log the event
  handleSaveQuestion(arrayBuffer); // Call the function to save the question
});

// // Handle start-recording event
// ipcMain.on('start-recording', () => 
// {
//   backendProcessor.setRecording(true); // Toggle the recording state
// });

// // Handle stop-recording event
// ipcMain.on('stop-recording', () => 
// {
//   backendProcessor.setRecording(false); // Stop the recording
// });

// Clean up on app quit
const filePathToDelete = path.join(__dirname, `../StreamSage/${screenAudio_filename}`); // Define the file path to delete

app.on('before-quit', () => 
{
  fs.unlink(filePathToDelete, (err) => 
  {
    if (err) 
    {
      console.error('Error deleting file:', err); // Log error if file deletion fails
    } 
    else 
    {
      console.log('File deleted successfully.'); // Log success message
    }
  });
});


// Function to send toggle command to all connected clients
function sendToggleCommand(isMuted) 
{
    console.log('Sending toggle command to extension');
    const message = JSON.stringify
    ({
        action: 'toggleMedia',
        isMuted: isMuted
    });
  wss.clients.forEach(client => 
  {
      if (client.readyState === WebSocket.OPEN) 
      {
        client.send(message);
        console.log('Sent toggleMedia command to extension');
      }
      else
      {
        console.log('Client is not open');
      }
  }
);
}