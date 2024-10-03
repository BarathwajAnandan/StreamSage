const { exec } = require('child_process');

/**
 * Records audio using SoX and saves it to a specified output file.
 * @param {string} outputFile - The name of the output WAV file.
 * @param {number} sampleRate - The sample rate for the recording.
 * @param {number} device - The input device number.
 * @returns {Promise} A promise that resolves when the recording is complete.
 */
function recordAudioWithSox(outputFile, sampleRate = 16000, device = 1) {
    return new Promise((resolve, reject) => {
        const cmd = `sox -t waveaudio ${device} ${outputFile} rate ${sampleRate} silence 1 0.1 1% 1 3.0 1%`;
        
        console.log(`Starting audio recording with command: ${cmd}`);
        
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error occurred during recording: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.warn(`Warning: ${stderr}`);
            }
            if (stdout) {
                console.log(`SoX output: ${stdout}`);
            }
            console.log(`Recording completed successfully. Output saved to: ${outputFile}`);
            console.log(`Recording parameters: Sample rate: ${sampleRate}Hz, Silence duration: 3s`);
            resolve();
        });
    });
}

module.exports = { recordAudioWithSox };
