const { ipcRenderer } = require('electron');

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null; // Store the stream for muting/unmuting
        this.silenceTimeout = null; // Add a timeout reference for silence detection
    }

    async startRecording() {
        console.log('Requesting audio stream...');
        try {
            // List all audio input devices to find the correct one
            const devices = await navigator.mediaDevices.enumerateDevices();
            const microphone = devices.find(device => device.kind === 'audioinput' && device.label.includes('MacBook Pro Microphone'));

            if (microphone) {
                // Request only the microphone audio
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: microphone.deviceId, echoCancellation: true, noiseSuppression: true } });
                console.log('Audio stream obtained');
            } else {
                console.error('Microphone not found');
                return;
            }

            this.mediaRecorder = new MediaRecorder(this.stream);

            this.mediaRecorder.ondataavailable = (event) => {
                console.log('Data available from media recorder');
                this.audioChunks.push(event.data);
                this.detectSilence(event.data); // Call silence detection
            };

            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped');
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = [];
                const reader = new FileReader();
                reader.onload = () => {
                    const buffer = reader.result;
                    console.log('Sending audio data to main process');
                    ipcRenderer.send('save-audio', buffer);
                };
                reader.readAsArrayBuffer(audioBlob);
            };

            this.mediaRecorder.start();
            console.log('Recording started');
        } catch (error) {
            console.error('Error accessing audio stream:', error);
        }
    }

    detectSilence(audioData) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createBufferSource();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            audioContext.decodeAudioData(e.target.result, (buffer) => {
                const channelData = buffer.getChannelData(0);
                const isSilent = this.checkSilence(channelData);
                
                if (isSilent) {
                    this.startSilenceTimer();
                } else {
                    this.resetSilenceTimer();
                }
            });
        };
        reader.readAsArrayBuffer(audioData);
    }

    checkSilence(channelData) {
        const threshold = 0.01; // Silence threshold
        return channelData.every(sample => Math.abs(sample) < threshold);
    }

    startSilenceTimer() {
        if (!this.silenceTimeout) {
            this.silenceTimeout = setTimeout(() => {
                this.stopRecording(); // Stop recording after 2 seconds of silence
            }, 2000);
        }
    }

    resetSilenceTimer() {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null; // Reset the timeout reference
    }

    stopRecording() {
        console.log('Attempting to stop recording...');
        if (this.mediaRecorder) {
            console.log('Stopping recording...');
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
            this.resetSilenceTimer(); // Reset silence timer when stopping
        } else {
            console.log('No active media recorder to stop');
        }
    }

    mute() {
        if (this.stream) {
            this.stream.getAudioTracks().forEach(track => {
                track.enabled = false;
                console.log('Microphone muted');
            });
        }
    }

    unmute() {
        if (this.stream) {
            this.stream.getAudioTracks().forEach(track => {
                track.enabled = true;
                console.log('Microphone unmuted');
            });
        }
    }
}

module.exports = AudioRecorder;