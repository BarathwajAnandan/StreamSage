const { ipcRenderer } = require('electron');
const { startRecording, stopRecording } = require('./screenCapture');
const { startMicrophoneRecording, stopMicrophoneRecording } = require('./micCapture');

// DOM element references
const elements = {
  micStatus: document.getElementById('micStatus'),
  toggleMuteBtn: document.getElementById('toggleMute'),
  toggleRecordingBtn: document.getElementById('toggleRecording'),
  statusArea: document.getElementById('statusArea'),
  recordingStatus: document.getElementById('recordingStatus'),
  levelMeter: document.getElementById('levelMeter'),
  output: document.getElementById('output'),
  questionStatus: document.getElementById('questionStatus')
};

// Application state
const state = {
  isMuted: true,
  isRecording: false,
  screenAudio_filename: 'recorded_audio.webm'
};

// P5.js related variables
let mic, fft;
let radius = 100; // Base radius for the visualization
const maxRadius = 350; // Maximum radius for the circle
const minRadius = 30; // Minimum radius for the circle

// P5.js setup function
function setup() {
  createCanvas(300, 300);
  noFill();
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);
  frameRate(90);
}

// P5.js draw function
function draw() {
  updateVisualization();
}

// Update the audio visualization
function updateVisualization() {
  if (state.isMuted) {
    background(0);
    radius = minRadius;
  } else {
    background(0, 10);
  }

  let amp = fft.getEnergy("mid");
  let targetRadius = state.isMuted ? minRadius : map(amp, 0, 200, minRadius, maxRadius);
  radius += (targetRadius - radius) * 0.1;

  translate(window.innerWidth * 0.425, window.innerHeight * 0.3);
  
  // Draw filled circle
  fill(255);
  noStroke();
  ellipse(0, 0, radius, radius);

  // Draw outer circle
  stroke(255);
  strokeWeight(12);
  noFill();
  ellipse(0, 0, radius, radius);
}

// Mouse click event to toggle mute
function mousePressed() {
  let d = dist(mouseX, mouseY, window.innerWidth * 0.425, window.innerHeight * 0.35);
  if (d < radius && !state.isRecording) {
    toggleMute();
  }
}

// Initialize P5.js
function startP5() {
  new p5();
}

// Resize canvas when the window is resized
function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

// Update UI elements based on recording state
function updateRecordingUI() {
  elements.recordingStatus.textContent = state.isRecording ? 'Recording...' : 'Ready to record';
  elements.toggleMuteBtn.disabled = state.isRecording;
  elements.toggleMuteBtn.style.opacity = state.isRecording ? 0.5 : 1;
  elements.toggleMuteBtn.style.transform = state.isRecording ? 'scale(0.9)' : 'scale(1)';
  elements.toggleRecordingBtn.className = state.isRecording ? 'fas fa-pause' : 'fas fa-play';
  updateStatus(state.isRecording ? 'Recording...' : 'Ready to record');
}

// Update UI elements based on mute state
function updateMuteUI() {
  elements.micStatus.textContent = `Mic: ${state.isMuted ? 'Muted' : 'Unmuted'}`;
  elements.micStatus.style.color = state.isMuted ? 'red' : 'green';
  elements.toggleMuteBtn.className = state.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
  updateStatus(state.isMuted ? 'Idle' : 'Listening... Ask your question');
}

// Toggle mute state
function toggleMute() {
  state.isMuted = !state.isMuted;
  if (!state.isRecording) {
    ipcRenderer.send('toggle-mute', state.isMuted);
    updateMuteUI();
  }
}

// Toggle recording state
async function toggleRecording() {
  if (state.isRecording) {
    if (stopRecording()) {
      state.isRecording = false;
      ipcRenderer.send('stop-recording');
    } else {
      console.error('Failed to stop recording');
    }
  } else {
    if (await startRecording(state.screenAudio_filename)) {
      state.isRecording = true;
      ipcRenderer.send('start-recording');
    } else {
      console.error('Failed to start recording');
    }
  }
  updateRecordingUI();
}

// Update status text with animation
function updateStatus(message) {
  elements.statusArea.textContent = message;
  elements.statusArea.style.opacity = 0;
  elements.statusArea.style.transition = 'opacity 0.5s';
  setTimeout(() => {
    elements.statusArea.style.opacity = 1;
  }, 50);
}

// Event listeners
elements.toggleMuteBtn.addEventListener('click', toggleMute);
elements.toggleRecordingBtn.addEventListener('click', toggleRecording);

// IPC listeners
ipcRenderer.on('python-output', (event, data) => {
  elements.output.innerHTML += data + '<br>';
  elements.output.scrollTop = elements.output.scrollHeight;

  if (data.includes('amplitude:')) {
    const amplitude = parseFloat(data.split(':')[1]);
    elements.levelMeter.value = amplitude;
  }

  if (data.includes('Please ask your question verbally..')) {
    elements.questionStatus.textContent = 'Listening for question...';
    elements.questionStatus.style.color = 'green';
  } else if (data.includes('User:')) {
    elements.questionStatus.textContent = 'Question received';
    elements.questionStatus.style.color = 'blue';
  }
});

ipcRenderer.on('mute-state-changed', (event, muted) => {
  state.isMuted = muted;
  updateMuteUI();
});

// Initialize UI
updateMuteUI();
updateRecordingUI();
updateStatus('Idle');