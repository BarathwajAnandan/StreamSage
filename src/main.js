const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

const { spawn, exec, execSync } = require('child_process'); // Ensure execSync is imported

const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

let mainWindow;
let pythonProcess;
const screenAudio_filename = 'recorded_audio.webm';

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
}

/**
 * Initializes the Python process and sets up communication.
 */
function initializePythonProcess() {
  const { pythonPath, pythonScriptPath } = getPythonPaths();
  logPythonPaths(pythonPath, pythonScriptPath);

  pythonProcess = spawnPythonProcess(pythonPath, pythonScriptPath);
  setupPythonProcessListeners(pythonProcess);
  
  sendCommandToPython('set-mute true');
}

/**
 * Determines the correct paths for Python executable and script.
 * @returns {Object} An object containing pythonPath and pythonScriptPath.
 */
function getPythonPaths() {
  const pythonScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'StreamSage', 'main.py')
    : path.join(__dirname, '..', 'StreamSage', 'main.py');

  const pythonPath = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : execSync('which python').toString().trim(); // Get the current Python path from the current environment

  return { pythonPath, pythonScriptPath };
}

/**
 * Logs Python paths for debugging purposes.
 * @param {string} pythonPath - Path to Python executable.
 * @param {string} pythonScriptPath - Path to Python script.
 */
function logPythonPaths(pythonPath, pythonScriptPath) {
  console.log('Python path:', pythonPath);
  console.log('Python script path:', pythonScriptPath);
}

/**
 * Spawns the Python process.
 * @param {string} pythonPath - Path to Python executable.
 * @param {string} pythonScriptPath - Path to Python script.
 * @returns {ChildProcess} The spawned Python process.
 */
function spawnPythonProcess(pythonPath, pythonScriptPath) {
  return spawn(pythonPath, [pythonScriptPath]);
}

/**
 * Sets up listeners for the Python process output.
 * @param {ChildProcess} process - The Python child process.
 */
function setupPythonProcessListeners(process) {
  process.stdout.on('data', handlePythonOutput);
  process.stderr.on('data', handlePythonError);
}

/**
 * Handles standard output from the Python process.
 * @param {Buffer} data - The output data.
 */
function handlePythonOutput(data) {
  if (mainWindow) {
    mainWindow.webContents.send('python-output', data.toString());
  }
}

/**
 * Handles error output from the Python process.
 * @param {Buffer} data - The error data.
 */
function handlePythonError(data) {
  console.error(`Python Error: ${data}`);
}

/**
 * Sends a command to the Python process.
 * @param {string} command - The command to send.
 */
function sendCommandToPython(command) {
  pythonProcess.stdin.write(`${command}\n`);
}

/**
 * Initializes the application when it's ready.
 */
function initializeApp() {
  createWindow();
  initializePythonProcess();

  sendCommandToPython(`set-mute ${true}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Sending mute-state-changed event with filename:', screenAudio_filename);
    mainWindow.webContents.send('mute-state-changed', true, screenAudio_filename);
  }
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
        console.log('Sending process-audio command to Python');
        sendCommandToPython('record-mic');
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
        console.log('Sending process-question command to Python');
        sendCommandToPython('process-question');
      } else {
        console.log('Audio file is empty, not processing');
      }
      sendCommandToPython('process-question');
    }
  });
}

// Application event listeners
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC event listeners
ipcMain.on('toggle-mute', (event, shouldMute) => {
  sendCommandToPython(`set-mute ${shouldMute}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mute-state-changed', shouldMute);
  }
});

ipcMain.on('toggle-mic-recording', () => {
  sendCommandToPython('set-mute false');
});

ipcMain.on('toggle-recording', () => {
  sendCommandToPython('toggle-recording');
});

ipcMain.on('toggle-voice', (event, isEnabled) => {
  sendCommandToPython(`toggle-voice ${isEnabled}`);
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
  sendCommandToPython('start-recording');
});

ipcMain.on('stop-recording', () => {
  sendCommandToPython('stop-recording');
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