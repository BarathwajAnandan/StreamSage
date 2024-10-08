const { ipcRenderer } = require('electron');
const { startRecording, stopRecording } = require('./screenCapture');
const { startMicrophoneRecording, stopMicrophoneRecording } = require('./micCapture');

// DOM element references
const elements = 
{
  micStatus: document.getElementById('micStatus'),
  toggleMuteBtn: document.getElementById('toggleMute'),
  toggleRecordingBtn: document.getElementById('toggleRecording'),
  statusArea: document.getElementById('statusArea'),
  recordingStatus: document.getElementById('recordingStatus'),
  output: document.getElementById('output'),
  questionStatus: document.getElementById('questionStatus')
};

// Application state
const state = 
{
  isMuted: true,
  isRecording: false,
  screenAudio_filename: 'recorded_audio.webm'
};

// Canvas related variables
let canvas, ctx;
let animationId;
let radius = 100; // Base radius for the visualization
const maxRadius = 350; // Maximum radius for the circle
const minRadius = 30; // Minimum radius for the circle

// Audio context and analyzer
let audioContext, analyzer, microphone, dataArray;

// Initialize audio context and analyzer
function initAudio() 
{
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 256;
  dataArray = new Uint8Array(analyzer.frequencyBinCount);

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => 
    {
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyzer);
      console.log("Microphone connected successfully");
    })
    .catch(err => 
    {
      console.error("Error accessing the microphone", err);
    });
}

// Initialize Canvas
function initCanvas() 
{
  canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 300;
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
}

// Animation function
function animate() 
{
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (state.isMuted) 
  {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    radius = minRadius;
  } 
  else 
  {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    analyzer.getByteFrequencyData(dataArray);
    let sum = dataArray.reduce((a, b) => a + b, 0);
    let average = sum / dataArray.length;
    
    let targetRadius = map(average, 0, 255, minRadius, maxRadius);
    radius += (targetRadius - radius) * 0.1;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  
  // Draw filled circle
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(0, 0, radius / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw outer circle
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(0, 0, radius / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  animationId = requestAnimationFrame(animate);
}

// Utility function to map a value from one range to another
function map(value, start1, stop1, start2, stop2) 
{
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

// Initialize the visualization
function initVisualization() 
{
  initAudio();
  initCanvas();
  animate();
}

// Mouse click event to toggle mute
function handleCanvasClick(event) 
{
  let rect = canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;
  let d = Math.sqrt(Math.pow(x - canvas.width / 2, 2) + Math.pow(y - canvas.height / 2, 2));
  
  if (d < radius / 2 && !state.isRecording) 
  {
    toggleMute();
  }
}

// Update UI elements based on recording state
function updateRecordingUI() 
{
  // elements.recordingStatus.textContent = state.isRecording ? 'Recording...' : 'Ready to record';
  elements.toggleMuteBtn.disabled = state.isRecording;
  elements.toggleMuteBtn.style.opacity = state.isRecording ? 0.5 : 1;
  elements.toggleMuteBtn.style.transform = state.isRecording ? 'scale(0.9)' : 'scale(1)';
  elements.toggleRecordingBtn.className = state.isRecording ? 'fas fa-pause' : 'fas fa-play';
  updateStatus(state.isRecording ? 'Recording...' : 'Ready to record');
}

// Update UI elements based on mute state
function updateMuteUI() 
{
  elements.micStatus.textContent = `Mic: ${state.isMuted ? 'Muted' : 'Unmuted'}`;
  elements.micStatus.style.color = state.isMuted ? 'red' : 'green';
  elements.toggleMuteBtn.className = state.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
  updateStatus(state.isMuted ? 'Idle' : 'Listening... Ask your question');
}

// Toggle mute state
function toggleMute() 
{
  state.isMuted = !state.isMuted;
  if (!state.isRecording) 
  {
    ipcRenderer.send('toggle-mute', state.isMuted);
    updateMuteUI();
  }
}

// Toggle recording state
async function toggleRecording() 
{
  if (state.isRecording) 
  {
    console.log("Stopping recording...");
    if (stopRecording()) 
    {
      state.isRecording = false;
      ipcRenderer.send('toggle-recording', false);
    } 
    else 
    {
      console.error('Failed to stop recording');
    }
  } 
  else 
  {
    console.log("Starting recording...");
    if (await startRecording(state.screenAudio_filename)) 
    {
      state.isRecording = true;
      ipcRenderer.send('toggle-recording', true);
    } 
    else 
    {
      console.error('Failed to start recording');
    }
  }
  updateRecordingUI();
}

// Update status text with animation
function updateStatus(message) 
{
  elements.statusArea.textContent = message;
  elements.statusArea.style.opacity = 0;
  elements.statusArea.style.transition = 'opacity 0.5s';
  setTimeout(() => 
  {
    elements.statusArea.style.opacity = 1;
  }, 50);
}

ipcRenderer.on('update-status', (event, status) => 
{
  updateStatus(status);
});

// Event listeners for keyboard shortcuts
document.addEventListener('keydown', (event) => 
{
  if (event.key === 'm' || event.key === 'M') // Toggle mute with 'M' key
  {
    toggleMute();
  }
  else if (event.key === 'r' || event.key === 'R') // Toggle recording with 'R' key
  {
    toggleRecording();
  }
});

// Existing event listeners for buttons
elements.toggleMuteBtn.addEventListener('click', toggleMute);
elements.toggleRecordingBtn.addEventListener('click', toggleRecording);

// Initialize UI and visualization
updateMuteUI();
updateRecordingUI();
updateStatus('Idle');
initVisualization();

// Add click event listener to the canvas
canvas.addEventListener('click', handleCanvasClick);