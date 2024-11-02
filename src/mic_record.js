const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Records audio using SoX and saves it to a specified output file.
 * @param {string} outputFile - The name of the output WAV file.
 * @param {number} sampleRate - The sample rate for the recording.
 * @param {number} device - The input device number.
 * @returns {Promise} A promise that resolves when the recording is complete.
 */
function recordAudioWithSox(outputFile, sampleRate = 16000, device = 1) 
{
    const logFile = path.join(app.getPath('userData'), 'mic_record.log');
    console.log("logFile", logFile)
    const logMessage = (msg) => 
    {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    logMessage(`MIC ON : outputFile ${outputFile}`);
    const escapedPath = `"${outputFile}"`;

    return new Promise((resolve, reject) => 
    {
        // Get the correct path to sox binary
        const possiblePaths = app.isPackaged 
            ? [
                path.join(process.resourcesPath, 'bin', 'sox'),
                'sox',
                '/usr/bin/sox',
                '/usr/local/bin/sox', 
                '/opt/homebrew/bin/sox',
                '/opt/local/bin/sox',
                '/usr/local/opt/sox/bin/sox'
            ]
            : [
                'sox',
                '/usr/bin/sox',
                '/usr/local/bin/sox', 
                '/opt/homebrew/bin/sox',
                '/opt/local/bin/sox',
                '/usr/local/opt/sox/bin/sox'
            ];
        
        let soxPath = possiblePaths.find(testPath => {
            try {
                return fs.existsSync(testPath);
            } catch (err) {
                return false;
            }
        });

        if (!soxPath)
        {
            const errMsg = 'Sox binary not found in any expected locations';
            logMessage(errMsg);
            reject(new Error(errMsg));
            return;
        }

        logMessage(`Found sox binary at: ${soxPath}`);
            
        let cmd;
        if (process.platform === 'darwin')
        {
            cmd = `"${soxPath}" -d ${escapedPath} rate ${sampleRate} silence 1 0.1 1% 1 2.0 1%`;
        }
        else if (process.platform === 'win32')
        {
            cmd = `"${soxPath}" -t waveaudio ${device} ${escapedPath} rate ${sampleRate} silence 1 0.1 3% 1 3.0 3%`;
        }
        else
        {
            const errMsg = `Not implemented for this platform: ${process.platform}`;
            logMessage(errMsg);
            reject(new Error(errMsg));
        }
        logMessage(`Starting audio recording with command: ${cmd}`);
        
        exec(cmd, { stdio: 'inherit' }, (error, stdout, stderr) => 
        {
            if (error) 
            {
                const errMsg = `Error occurred during recording: ${error.message}`;
                logMessage(errMsg);
                reject(error);
                return;
            }
            if (stderr) 
            {
                logMessage(`Warning: ${stderr}`);
            }
            if (stdout) 
            {
                logMessage(`SoX output: ${stdout}`);
            }
            logMessage(`Recording completed successfully. Output saved to: ${escapedPath}`);
            logMessage(`Recording parameters: Sample rate: ${sampleRate}Hz, Silence duration: 3s`);
            resolve();
        });
        logMessage(`Recording completed successfully. Output saved to: ${escapedPath}`);
    });
}

module.exports = { recordAudioWithSox };
