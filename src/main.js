const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

let mainWindow; // Declare mainWindow in the global scope
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({ // Assign to the global mainWindow
    width: 500,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false // Disable DevTools
    },
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.setPosition(mainWindow.getPosition()[0], 40);
  // mainWindow.webContents.openDevTools(); // Remove or comment out this line if it exists

  // Prevent the default menu from showing (which includes DevTools option)
  mainWindow.setMenu(null);

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

function toggleMacOSMic(mute) {
  const script = mute
    ? 'set volume input volume 0'
    : 'set volume input volume 100';
  
  exec(`osascript -e "${script}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    // console.log(`Microphone ${mute ? 'muted' : 'unmuted'}`);
    // Ensure Python script's mute state is synchronized
    pythonProcess.stdin.write(`set-mute ${mute}\n`);
    // Inform renderer process about the mute state change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mute-state-changed', mute);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  initializePythonProcess();

  // Mute the microphone by default when the app starts
  toggleMacOSMic(true);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('toggle-mute', (event, shouldMute) => {
  toggleMacOSMic(shouldMute);
  // We don't need to send 'toggle-mute' here as it's already done in toggleMacOSMic
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

ipcMain.on('save-audio', (event, arrayBuffer) => {
  console.log('Received save-audio event');
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    console.error('Received data is not an ArrayBuffer:', arrayBuffer);
    return;
  }
  console.log('Received audio data. Size:', arrayBuffer.byteLength);
  const filePath = path.join(__dirname, '..', 'StreamSage', 'recorded_audio.webm');
  
  
  const buffer = Buffer.from(arrayBuffer);
  console.log('Writing file:', filePath);
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('Failed to save audio:', err);
    } else {
      console.log('Audio saved successfully. File size:', buffer.length);
      if (buffer.length > 0) {
        console.log('Sending process-audio command to Python');
        pythonProcess.stdin.write('process-audio\n');
      } else {
        console.log('Audio file is empty, not processing');
      }
    }
  });
});

ipcMain.on('start-recording', () => {
  // Don't create an empty file here, let the actual recording process create it
  pythonProcess.stdin.write('toggle-recording\n');
});

ipcMain.on('stop-recording', () => {
  // Don't update the file here, let the actual recording process handle it
  pythonProcess.stdin.write('toggle-recording\n');
});