const { ipcRenderer } = require('electron');
// const AudioRecorder = require('./audioRecorder');
const { startRecording, stopRecording } = require('./screenCapture');
const { startMicrophoneRecording, stopMicrophoneRecording } = require('./micCapture');

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
let screenAudio_filename = 'recorded_audio.webm';
let mic, fft;
let radius = 100; // Base radius for the visualization
let maxRadius = 400; // Maximum radius for the circle
let minRadius = 30; // Minimum radius for the circle
// let fillOpacity = 10; // Initial fill opacity

// Initialize AudioRecorder
// const audioRecorder = new AudioRecorder();

// Initialize p5.js
function setup() {
  createCanvas(400, 400); // Set a smaller canvas size (e.g., 400x400)
  noFill();
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);
  frameRate(90); // Set frame rate to 60 FPS for smoother animation
}

function draw() {
  background(0, 10); // This line sets the background color to black with a 10% opacity, creating a fading effect.
  let spectrum = fft.analyze(); // Analyze the audio input
  let amp = fft.getEnergy("mid"); // Get the energy of all frequencies

  // Check if muted and set radius accordingly
  if (isMuted) {
    background(0); // Solid black background when muted
    radius = minRadius; // Set to default radius when muted
  } else {
    // Map the amplitude to the radius with more aggressive scaling
    let targetRadius = isMuted ? minRadius : map(amp, 0, 180, minRadius, maxRadius);

    // radius = map(amp, 0, 125, minRadius, maxRadius); // Adjust the radius based on amplitude
    radius += (targetRadius - radius) * 0.1; // Easing factor for smooth transition

  }

  // Move origin to center but adjust the Y position to move it up
  translate(width / 2, height / 2); // Move origin to center and up
  fill(255); // Set fill color to white
  noStroke(); // No stroke for the filled circle
  ellipse(0, 0, radius, radius); // Draw the filled circle

  // Draw the circle with a thicker stroke
  stroke(255);
  strokeWeight(12); // Thicker lines for better visibility
  noFill();
  ellipse(0, 0, radius, radius); // Draw the circle with the dynamic radius
}

// Mouse click event to toggle mute
function mousePressed() {
  console.log('Mouse pressed');
  // Check if the mouse is inside the circle
  let d = dist(mouseX, mouseY, width / 2, height / 2); // Adjust Y position for the circle
  if (d < radius ) { // Check if the click is within the circle
    isMuted = !isMuted; // Toggle mute state
    ipcRenderer.send('toggle-mute', isMuted);
    console.log('Sent toggle-mute event with isMuted:', isMuted);
    updateMuteUI();
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
  if (isMuted) {
    // console.log('Muted. Stopping recording mic');
    // stopMicrophoneRecording();
    // audioRecorder.stopRecording();
  } else {
    // console.log('Unmuted/Please ask your question verbally..');
    // ipcRenderer.send('toggle-mic-recording');
    // console.log('Sent toggle-mic-recording');
    // startMicrophoneRecording();
    //call to python to start recording
    // pythonProcess.stdin.write('process-audio\n');
  }
  // Remove the direct IPC call as muting is now handled by AudioRecorder
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
    if (await startRecording(screenAudio_filename)) {
      isRecording = true;
      
      console.log('Calling start-recording with filename:', screenAudio_filename);
      ipcRenderer.send('start-recording');
    } else {
      console.error('Failed to start recording');
    }
  }
  updateRecordingUI();
});

// voiceEnabled.addEventListener('change', (e) => {
//   ipcRenderer.send('toggle-voice', e.target.checked);
// });

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
  // screenAudio_filename = filename;
  // console.log('Received screen audio filename:', screenAudio_filename);
  updateMuteUI();
});