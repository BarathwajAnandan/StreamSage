const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const { app } = require('electron');

dotenv.config();

// Setup logging
function createLogger() 
{
    const logFile = path.join(app.getPath('userData'), 'mic_record.log');
    
    return (message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [TTS] ${message}\n`;
        
        // Log to console
        console.log(logMessage);
        
        // Append to file
        try {
            fs.appendFileSync(logFile, logMessage);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    };
}

const log = createLogger();

class SpeechGenerator {
    constructor() 
    {
        if (this.constructor === SpeechGenerator) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    async generateSpeech(text, filename = "audio.mp3") {
        throw new Error("Method 'generateSpeech()' must be implemented.");
    }

    async playAudio(filename) {
        throw new Error("Method 'playAudio()' must be implemented.");
    }

    stopAudio() {
        throw new Error("Method 'stopAudio()' must be implemented.");
    }
}

class DeepGram extends SpeechGenerator 
{
    constructor() 
    {
        super();
        log('DeepGram TTS initialized');
    }

    async generateSpeech(text, filename = "audio.mp3") 
    {
        try {
            log(`Attempting to generate speech via DeepGram: "${text.substring(0, 50)}..."`);
            // Implement DeepGram API call here
            log(`Generated speech saved to ${filename}`);
            return filename;
        } catch (error) {
            log(`DeepGram error: ${error.message}`);
            return null;
        }
    }

    async playAudio(filename) 
    {
        log(`Playing audio: ${filename}`);
    }

    stopAudio() 
    {
        log("Stopping DeepGram audio playback");
    }
}

class Coqui extends SpeechGenerator 
{
    constructor(url = COQUI_LOCAL_URL) 
    {
        super();
        this.url = url;
        log(`Coqui TTS initialized with URL: ${url}`);
    }

    async generateSpeech(text, filename = "audio.mp3") 
    {
        try {
            log(`Generating speech via Coqui: "${text.substring(0, 50)}..."`);
            const response = await axios.post(this.url, null, { params: { text } });
            
            if (response.status === 200) {
                fs.writeFileSync(filename, response.data);
                log(`Coqui audio saved to ${filename}`);
                return filename;
            } else {
                log(`Coqui error: ${response.status} - ${response.statusText}`);
                return null;
            }
        } catch (error) {
            log(`Coqui exception: ${error.message}`);
            return null;
        }
    }

    async playAudio(filename) 
    {
        log(`Playing Coqui audio: ${filename}`);
    }

    stopAudio() 
    {
        log("Stopping Coqui audio playback");
    }
}

class Piper extends SpeechGenerator 
{
    constructor(url = PIPER_LOCAL_URL) 
    {
        super();
        this.url = url;
        log(`Piper TTS initialized with URL: ${url}`);
    }

    async generateSpeech(text, filename = "audio.mp3") 
    {
        try {
            log(`Generating speech via Piper: "${text.substring(0, 50)}..."`);
            const response = await axios.post(this.url, null, { params: { text } });
            
            if (response.status === 200) {
                fs.writeFileSync(filename, response.data);
                log(`Piper audio saved to ${filename}`);
                return filename;
            } else {
                log(`Piper error: ${response.status} - ${response.statusText}`);
                return null;
            }
        } catch (error) {
            log(`Piper exception: ${error.message}`);
            return null;
        }
    }

    async playAudio(filename) 
    {
        log(`Playing Piper audio: ${filename}`);
    }

    stopAudio() 
    {
        log("Stopping Piper audio playback");
    }
}

class MacTTS extends SpeechGenerator 
{
    constructor() 
    {
        super();
        this.process = null;
        this.defaultFilename = "audio.aiff";
        log('MacTTS initialized');
    }

    async generateSpeech(text, filename = this.defaultFilename) 
    {
        return new Promise((resolve, reject) => {
            log(`Generating speech for text: "${text.substring(0, 50)}..."`);
            log(`Output filename: ${filename}`);
            
            exec(`/usr/bin/say "${text}"`, (error) => {
                if (error) {
                    const errorMsg = `Error generating speech: ${error.message}`;
                    log(errorMsg);
                    reject(error);
                } else {
                    log(`Speech generated successfully: ${filename}`);
                    resolve(filename);
                }
            });
        });
    }

    async playAudio(filename = this.defaultFilename) 
    {
        return new Promise((resolve, reject) => {
            log(`Playing audio file: ${filename}`);
            
            this.process = exec(`afplay "${filename}"`, (error) => {
                if (error) {
                    const errorMsg = `Error playing audio: ${error.message}`;
                    log(errorMsg);
                    reject(error);
                } else {
                    log('Audio playback completed successfully');
                    resolve();
                }
            });
        });
    }

    stopAudio() 
    {
        if (this.process) {
            log('Stopping audio playback');
            this.process.kill();
            log('Audio playback stopped');
        } else {
            log('No audio playback to stop');
        }
    }
}

module.exports = {
    DeepGram,
    Coqui,
    Piper,
    MacTTS
};