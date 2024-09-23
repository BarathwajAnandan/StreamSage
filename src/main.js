const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');
let screenAudio_filename = 'recorded_audio.webm';

// const electronDebug = require('electron-debug'); // Add this line

// Load environment variables from .env file
dotenv.config();

// Enable debug mode
// electronDebug({ showDevTools: true }); // This will automatically open DevTools

let mainWindow; // Declare mainWindow in the global scope
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({ // Assign to the global mainWindow
    width: 500,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // Ensure DevTools are enabled
    },
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.setPosition(mainWindow.getPosition()[0], 40);

  // Prevent the default menu from showing (which includes DevTools option)
  mainWindow.setMenu(null);

  // Open DevTools automatically
  mainWindow.webContents.openDevTools(); // Open DevTools when the window is created

  // Listen for the window close event
  mainWindow.on('closed', () => {
    mainWindow = null; // Dereference the window object
    app.quit(); // Quit the application
  });
}

function initializePythonProcess() {
  const pythonScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'StreamSage', 'main.py')
    : path.join(__dirname, '..', 'StreamSage', 'main.py');

  const pythonPath = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : '/opt/anaconda3/envs/quiz/bin/python';

  console.log('Python path:', pythonPath);
  console.log('Python script path:', pythonScriptPath);

  pythonProcess = spawn(pythonPath, [pythonScriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('python-output', data.toString());
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });

  // Send initial mute command after the Python process is initialized
  pythonProcess.stdin.write('set-mute true\n');
}

app.whenReady().then(() => {
  createWindow();
  initializePythonProcess();
  

  // Mute the microphone by default when the app starts
  pythonProcess.stdin.write(`set-mute ${true}\n`);
  // Inform renderer process about the mute state change
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Sending mute-state-changed event with filename:', screenAudio_filename);
    mainWindow.webContents.send('mute-state-changed', true, screenAudio_filename);
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('toggle-mute', (event, shouldMute) => {
  pythonProcess.stdin.write(`set-mute ${shouldMute}\n`);
  // Inform renderer process about the mute state change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mute-state-changed', shouldMute);
  }
});

ipcMain.on('toggle-mic-recording', () => {
  pythonProcess.stdin.write(`set-mute false\n`);
  // pythonProcess.stdin.write('toggle-mic-recording\n');
});

ipcMain.on('toggle-recording', () => {
  pythonProcess.stdin.write('toggle-recording\n');
});

ipcMain.on('toggle-voice', (event, isEnabled) => {
  pythonProcess.stdin.write(`toggle-voice ${isEnabled}\n`);
});

ipcMain.handle('get-sources', async (event) => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

ipcMain.on('save-audio', (event, arrayBuffer, fileName) => {
  console.log('Received save-audio event');
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return;
  }
  console.log('Received audio data. Size:', arrayBuffer.byteLength);
  const filePath = path.join(__dirname, '..', 'StreamSage', fileName);
  
  
  const buffer = Buffer.from(arrayBuffer);
  console.log('Writing file:', filePath);
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('Failed to save audio:', err);
    } else {
      console.log('Audio saved successfully. File size:', buffer.length);
      if (buffer.length > 0) {
        console.log('Sending process-audio command to Python');
        pythonProcess.stdin.write('record-mic\n');
      } else {
        console.log('Audio file is empty, not processing');
      }
    }
  });
});


ipcMain.on('save-question', (event, arrayBuffer) => {
  console.log('Received save-question event');
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return;
  }
  console.log('Received audio data. Size:', arrayBuffer.byteLength);
  const filePath = path.join(__dirname, '..', 'StreamSage', 'user_question.wav');
  const buffer = Buffer.from(arrayBuffer);
  console.log('Writing file:', filePath);
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('Failed to save audio:', err);
    } else {
      console.log('Audio saved successfully. File size:', buffer.length);
      if (buffer.length > 0) {
        console.log('Sending process-audio command to Python');
        pythonProcess.stdin.write('process-question\n');
      } else {
        console.log('Audio file is empty, not processing');
      }
      pythonProcess.stdin.write('process-question\n');
    }
  });
});

ipcMain.on('start-recording', () => {
  // Don't create an empty file here, let the actual recording process create it
  pythonProcess.stdin.write('start-recording\n');
});

ipcMain.on('stop-recording', () => {
  // Don't update the file here, let the actual recording process handle it
  pythonProcess.stdin.write('stop-recording\n');
});

const filePathToDelete = path.join(__dirname, `../StreamSage/${screenAudio_filename}`); // Update with the correct extension if needed

app.on('before-quit', () => {
  // Delete the file when the app is about to quit
  fs.unlink(filePathToDelete, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
    } else {
      console.log('File deleted successfully.');
    }
  });
});