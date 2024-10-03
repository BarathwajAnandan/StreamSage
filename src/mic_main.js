const { recordAudioWithSox } = require('./mic_record');

async function recordMic(outputFile, sampleRate = 16000, device = 1) {
    console.log('Starting audio recording...');
    
    try {
        await recordAudioWithSox(outputFile, sampleRate, device);
        console.log('Audio recording completed successfully.');
    } catch (error) {
        console.error('An error occurred during audio recording:', error);
        throw error; // Re-throw the error to be caught in the main function
    }
}

async function main() 
{
    const outputFile = 'output_main.wav';
    const sampleRate = 16000;
    const device = 1;

    try {
        await recordMic(outputFile, sampleRate, device);
    } catch (error) {
        console.error('Error in main:', error);
    }
}

// This line executes the main function and handles any uncaught errors
// It calls the main() function, which is an async function that records audio
// If an error occurs during the execution of main(), it will be caught and logged to the console
main().catch(console.error);
