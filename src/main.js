const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

let mainWindow;
let backendProcessor;
const screenAudio_filename = 'recorded_audio.webm';

const BackendProcessor = require('./main_backend');

function initializeBackendProcessor() {
  backendProcessor = new BackendProcessor(mainWindow);
  backendProcessor.run().catch(console.error);
}

async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  devices.forEach(device => {
    console.log(`${device.kind}: ${device.label} id = ${device.deviceId}`);
  });
}
/**
 * Creates and configures the main application window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    },
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.setPosition(mainWindow.getPosition()[0], 40);
  mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });

  initializeBackendProcessor();

  // Enable the console window
  mainWindow.webContents.openDevTools();
}

/**
 * Handles saving audio data to a file.
 * @param {ArrayBuffer} arrayBuffer - The audio data.
 * @param {string} fileName - The name of the file to save.
 */
function handleSaveAudio(arrayBuffer, fileName) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return;
  }

  const filePath = path.join(__dirname, '..', 'StreamSage', fileName);
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('Failed to save audio:', err);
    } else {
      console.log('Audio saved successfully. File size:', buffer.length);
      if (buffer.length > 0) {
        console.log('Processing audio');
        backendProcessor.processAudio();
      } else {
        console.log('Audio file is empty, not processing');
      }
    }
  });
}

/**
 * Handles saving and processing a user question.
 * @param {ArrayBuffer} arrayBuffer - The question audio data.
 */
function handleSaveQuestion(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return;
  }

  const filePath = path.join(__dirname, '..', 'StreamSage', 'user_question.wav');
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('Failed to save audio:', err);
    } else {
      console.log('Audio saved successfully. File size:', buffer.length);
      if (buffer.length > 0) {
        console.log('Processing question');
        backendProcessor.processQuestion();
      } else {
        console.log('Audio file is empty, not processing');
      }
    }
  });
}

// Application event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC event listeners
ipcMain.on('toggle-mute', (event, shouldMute) => {
  backendProcessor.setMute(shouldMute);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mute-state-changed', shouldMute);
  }
});

ipcMain.on('toggle-mic-recording', () => {
  backendProcessor.toggleMicRecording();
});

ipcMain.on('toggle-recording', () => {
  // backendProcessor.toggleRecording();
});

ipcMain.on('toggle-voice', (event, isEnabled) => {
  backendProcessor.setVoiceEnabled(isEnabled);
});

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

ipcMain.on('save-audio', (event, arrayBuffer, fileName) => {
  console.log('Received save-audio event');
  handleSaveAudio(arrayBuffer, fileName);
});

ipcMain.on('save-question', (event, arrayBuffer) => {
  console.log('Received save-question event');
  handleSaveQuestion(arrayBuffer);
});

ipcMain.on('start-recording', () => {
  backendProcessor.toggleRecording();
});

ipcMain.on('stop-recording', () => {
  backendProcessor.stopRecording();
});

// Clean up on app quit
const filePathToDelete = path.join(__dirname, `../StreamSage/${screenAudio_filename}`);

app.on('before-quit', () => {
  fs.unlink(filePathToDelete, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
    } else {
      console.log('File deleted successfully.');
    }
  });
});