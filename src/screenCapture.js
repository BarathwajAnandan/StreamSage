const { ipcRenderer } = require('electron');

let mediaRecorder;
let recordedChunks = [];

async function startRecording() {
  try {
    console.log('Requesting audio stream...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('Audio stream obtained');

    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    console.log('MediaRecorder created');

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
        console.log(`Received audio chunk: ${event.data.size} bytes`);
      } else {
        console.log('Received empty audio chunk');
      }
    };

    mediaRecorder.onstop = () => {
      console.log(`Recording stopped. Total chunks: ${recordedChunks.length}`);
      if (recordedChunks.length > 0) {
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        console.log('Audio blob created. Size:', audioBlob.size);
        
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          try {
            ipcRenderer.send('save-audio', arrayBuffer);
          } catch (error) {
            console.error('Error sending audio data to main process:', error);
          }
        };
        reader.onerror = (error) => {
          console.error('Error reading blob:', error);
        };
        reader.readAsArrayBuffer(audioBlob);
      } else {
        console.log('No audio data recorded');
      }
      recordedChunks = [];
    };

    mediaRecorder.start(1000); // Capture data every second
    console.log('Recording started');
    return true;
  } catch (error) {
    console.error('Error starting recording:', error);
    return false;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    console.log('Stopping recording...');
    mediaRecorder.stop();
    return true;
  } else {
    console.log('MediaRecorder is not active');
    return false;
  }
}

function concatenateBuffers(buffers) {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

function createWavFile(audioData, sampleRate) {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, audioData.length * 2, true);

  const length = audioData.length;
  let index = 44;
  for (let i = 0; i < length; i++) {
    view.setInt16(index, audioData[i] * 0x7FFF, true);
    index += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

module.exports = {
  startRecording,
  stopRecording,
  concatenateBuffers,
  createWavFile,
};