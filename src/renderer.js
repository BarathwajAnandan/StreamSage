const { ipcRenderer } = require('electron');
const { startRecording, stopRecording } = require('./screenCapture');

const micStatus = document.getElementById('micStatus');
const toggleMuteBtn = document.getElementById('toggleMute');
const toggleRecordingBtn = document.getElementById('toggleRecording');
const recordingStatus = document.getElementById('recordingStatus');
const levelMeter = document.getElementById('levelMeter');
const voiceEnabled = document.getElementById('voiceEnabled');
const output = document.getElementById('output');
const questionStatus = document.getElementById('questionStatus');

let isMuted = true;  // Start muted
let isRecording = false;

let mic, fft;
let radius = 100; // Base radius for the visualization
let maxRadius = 400; // Maximum radius for the circle
let minRadius = 50; // Minimum radius for the circle

// Initialize p5.js
function setup() {
  createCanvas(400, 400); // Set a smaller canvas size (e.g., 400x400)
  noFill();
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);
}

function draw() {
  background(0, 10); // Fading effect for the background
  let spectrum = fft.analyze(); // Analyze the audio input
  let amp = fft.getEnergy("bass"); // Get the energy of the bass frequencies

  // Map the amplitude to the radius with more aggressive scaling
  radius = map(amp, 0, 255, minRadius, maxRadius); // Adjust the radius based on amplitude

  // Move origin to center but adjust the Y position to move it up
  translate(width / 2, height / 4); // Move origin to center and up

  // Draw the circle with a thicker stroke
  stroke(255);
  strokeWeight(8); // Thicker lines for better visibility
  noFill();
  ellipse(0, 0, radius, radius); // Draw the circle with the dynamic radius
}

// Mouse click event to toggle mute
function mousePressed() {
  // Check if the mouse is inside the circle
  let d = dist(mouseX, mouseY, width / 2, height / 4); // Adjust Y position for the circle
  if (d < radius / 2) { // Check if the click is within the circle
    isMuted = !isMuted; // Toggle mute state
    ipcRenderer.send('toggle-mute', isMuted); // Send mute state to main process
  }
}

// Call startP5 when the document is ready
function startP5() {
  new p5();
}

// Resize canvas when the window is resized
function windowResized() {
  resizeCanvas(400, 400); // Keep the canvas size consistent
}

// Remove the startRecording and stopRecording functions from here

// ... existing code ...

function updateRecordingUI() {
  recordingStatus.textContent = isRecording ? 'Recording...' : 'Ready to record';
  toggleRecordingBtn.textContent = isRecording ? 'Stop Recording' : 'Start Recording';
}

// Update the initial UI state
updateMuteUI();

function updateMuteUI() {
  micStatus.textContent = `Mic: ${isMuted ? 'Muted' : 'Unmuted'}`;
  micStatus.style.color = isMuted ? 'red' : 'green';
  toggleMuteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
}

toggleMuteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  ipcRenderer.send('toggle-mute', isMuted);
  updateMuteUI();
});

toggleRecordingBtn.addEventListener('click', async () => {
  if (isRecording) {
    if (stopRecording()) {
      isRecording = false;
      ipcRenderer.send('stop-recording');
    } else {
      console.error('Failed to stop recording');
    }
  } else {
    if (await startRecording()) {
      isRecording = true;
      ipcRenderer.send('start-recording');
    } else {
      console.error('Failed to start recording');
    }
  }
  updateRecordingUI();
});

voiceEnabled.addEventListener('change', (e) => {
  ipcRenderer.send('toggle-voice', e.target.checked);
});

// ... (keep all the remaining code, including ipcRenderer listeners) ...

ipcRenderer.on('python-output', (event, data) => {
  output.innerHTML += data + '<br>';
  output.scrollTop = output.scrollHeight;

  if (data.includes('amplitude:')) {
    const amplitude = parseFloat(data.split(':')[1]);
    levelMeter.value = amplitude;
  }

  if (data.includes('Please ask your question verbally..')) {
    questionStatus.textContent = 'Listening for question...';
    questionStatus.style.color = 'green';
  } else if (data.includes('User:')) {
    questionStatus.textContent = 'Question received';
    questionStatus.style.color = 'blue';
  }
});

ipcRenderer.on('mute-state-changed', (event, muted) => {
  isMuted = muted;
  updateMuteUI();
});