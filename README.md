# StreamSage

## Description

StreamSage is an AI-powered learning companion that helps you better understand any audio content by watching/listening along with you and answering your questions in real-time, maintaining full context of the material. Whether you're watching educational videos, lectures, podcasts, or any other audio source, StreamSage transcribes the content and allows you to pause and ask questions to clarify your understanding. Built with Electron, it currently offers full support for macOS with ongoing development for other operating systems.

## Features

- **Real-time Audio Transcription**: Uses [Groq] for audio transcription and processing.
- **Text-to-Speech (TTS)**: Generates speech from text using various TTS engines like DeepGram, Coqui, Piper, and macOS built-in Siri voice.
- **Keyboard Shortcuts**: Supports global keyboard shortcuts for quick access to functionalities.
- **User-Friendly Interface**: Built with a responsive design for ease of use.

## Current Status

- **macOS**: Fully supported.
- **Windows**: Work in progress (WIP). Contributions welcome!
- **Linux**: Work in progress (WIP). Contributions welcome!

## Prerequisites
Before you begin, ensure you have met the following requirements:

- **Node.js**: [Download and install Node.js](https://nodejs.org/)
- **npm**: Comes with Node.js, but you can check your version with `npm -v`.
- **Electron**: This project uses Electron, which will be installed automatically via npm.
- **SoX**: Audio processing tool required for microphone recording 
  - On macOS: Install via Homebrew with `brew install sox`
  - On Linux: Install via package manager (e.g. `apt-get install sox`)
  - On Windows: Download from the [SoX website](https://sourceforge.net/projects/sox/)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/StreamSage.git
   cd StreamSage
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. (Optional) If you want to run the app in development mode:

   ```bash
   npm start
   ```

## Building the Application

To build the application for distribution, run:

```bash
npm run build
```

This will create a packaged version of your app in the `dist` folder.

## Usage

1. Launch the application in development mode:
   ```bash
   npm start
   ```

2. Look for the 'S' logo in your system tray (near the battery indicator). Click it to show the application UI and quit options.

3. Enter your GROQ API key in the text box and click 'Save'

4. Use these keyboard shortcuts to control recording:
   - **M**: Mute/unmute the microphone
   - **R**: Start/stop recording

5. Important notes about recording:
   - Due to macOS limitations, recording will capture both screen audio and ambient sound
   - This is useful for recording lectures, videos, or any audio content
   - Best practice:
     1. Start recording when watching content
     2. Stop recording when you have a question
     3. Wait a couple seconds for processing
     4. Unmute and ask your question once processing is complete
     5. The AI (currently using llama3.1 70B model) will respond to your query
     6. Mute the microphone again before starting the next recording
     7. Repeat

Notes/Features:
- Keeps track of your recording history and context for subsequent recordings in a session. Restarting the app clears this history.
- No need to click 'Save' again after entering your GROQ API key


Future updates:

- Model and API selection options
- TTS options will be available in future updates with support for Windows and Linux
- Exporting to txt and PDF

Mac Siri voice changes if needed:
in macOS:
- Accessability -> Voice Content -> System voice -> choose voice. (default : Samantha)

## Logging

The application logs important events and errors to the following files:

- `mic_record.log`: Logs related to microphone recording.
- `backend.log`: Logs related to backend processing.

These logs can be found in the user data directory, typically located at:

- **macOS**: `~/Library/Application Support/StreamSage/`
- **Windows**: `C:\Users\YourUsername\AppData\Roaming\StreamSage\`
- **Linux**: `~/.config/StreamSage/`

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Make your changes and commit them (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- [Electron](https://www.electronjs.org/) for building cross-platform desktop apps.
- [Groq](https://groq.dev/) for audio transcription services.
- [DeepGram](https://deepgram.com/) for TTS capabilities.
- [Coqui](https://coqui.ai/) for open-source TTS.
- [Piper](https://piper.readthedocs.io/en/latest/) for additional TTS options.
