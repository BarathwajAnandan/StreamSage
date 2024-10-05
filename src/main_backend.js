const { Groq } = require('groq-sdk');
const { MacTTS, DeepGram } = require('./tts');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

class BackendProcessor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.file_to_watch = path.join(__dirname, "../StreamSage/recorded_audio.webm");
    this.user_question_file = "user_question.wav";
    this.voice_enabled = true;
    this.muted = true;
    this.is_recording = false;
    this.should_run = true;
    this.generate_answer = false;
    this.greeted = false;
    this.is_mic_recording = false;
    this.context = "";
    this.is_stop_recording = false;
    this.debug_enabled = false;

    this.transcriber = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.chat_client = new Groq({ apiKey: process.env.GROQ_API_KEY2 });
    this.tts = process.platform === 'darwin' ? new MacTTS() : new DeepGram();
  }

  log(message, tag = "") {
    if (this.debug_enabled) {
      this.mainWindow.webContents.send('python-output', JSON.stringify({ type: "log", message, tag }));
    }
  }

  updateStatus() {
    if (this.debug_enabled) {
      this.mainWindow.webContents.send('python-output', JSON.stringify({
        type: "status_update",
        
        muted: this.muted,
        recording: this.is_recording
      }));
    }
  }
  //Record audio from mic
  async recordAudio(outputFile = 'recorded_audio.wav', sampleRate = 16000, device = 1) {
    return new Promise((resolve, reject) => {
      const cmd = `sox -t waveaudio ${device} ${outputFile} rate ${sampleRate} silence 1 0.1 1% 1 3.0 1%`;
      
      this.log(`Starting audio recording with command: ${cmd}`, "recordAudio");
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          this.log(`Error occurred during recording: ${error.message}`, "recordAudio");
          reject(error);
          return;
        }
        if (stderr) {
          this.log(`Warning: ${stderr}`, "recordAudio");
        }
        if (stdout) {
          this.log(`SoX output: ${stdout}`, "recordAudio");
        }
        this.log(`Recording completed successfully. Output saved to: ${outputFile}`, "recordAudio");
        this.log(`Recording parameters: Sample rate: ${sampleRate}Hz, Silence duration: 3s`, "recordAudio");
        resolve(outputFile);
      });
    });
  }
  async transcribeAudio(filename) {
    try {
      const audioData = await fs.readFile(filename);
      const transcription = await this.transcriber.audio.transcriptions.create({
        file: audioData,
        model: "distil-whisper-large-v3-en",
        prompt: "Specify context or spelling",
        response_format: "json",
        language: "en",
        temperature: 0.0
      });
      console.log("TRANSCRIPTION TEXT: ", transcription.text);
      return transcription.text;
    } catch (error) {
      throw new Error(`Error during transcription: ${error.message}`);
    }
  }

  async chatWithModel(context, question, model = "llama3-8b-8192") {
    try {
      const prompt = `
        Context: The following is a transcription from a live video the user is currently watching:
        ${context}

        The user is confused and has the following question:
        ${question}

        Instructions:
        1. Analyze the provided transcription carefully, keeping in mind it's from a live video the user is watching right now.
        2. Consider the real-time nature of the content and any potential gaps or ambiguities in the transcription.
        3. Address the user's confusion directly, providing a clear and helpful explanation based on the context.
        4. If the question doesn't make sense, is out of context, or is irrelevant to the provided transcription, or if the input is not meaningful or mostly silent, do not respond.

        Do not talk about the video or the user's question. Just provide a response to the user's question briefly.
      `;

      const response = await this.chat_client.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful AI assistant designed to aid users in real-time as they watch live video content. Your goal is to clarify confusions, provide insights, and enhance the viewer's understanding based on transcribed audio from the video. If a question is irrelevant or out of context, politely decline to answer." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 4096,
        top_p: 0.95,
        stream: false,
        stop: null
      });
      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`Error during chat interaction: ${error.message}`);
    }
  }

  async checkContext(question, context = '', model = "llama3-8b-8192") {
    try {
      const prompt = `
        Check if the following question is relevant and makes sense or some noise. 
        if it's not relevant, return "false"
        if it's relevant, return "true"
        question:
        ${question}
        answer in one word.
      `;

      const response = await this.chat_client.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful AI Assistant designed to check if the user's question is relevant and makes sense or some noise. If it's not relevant, return 'false'. If it's relevant, return 'true'." },
          { role: "user", content: prompt }
        ],
        temperature: 0.001,
        max_tokens: 1024,
        top_p: 0.95,
        stream: false,
        stop: null
      });
      const result = response.choices[0].message.content.toLowerCase();
      return result.includes('true');
    } catch (error) {
      throw new Error(`Error during chat interaction: ${error.message}`);
    }
  }

  async processAudio() {
    // if (this.muted) {
    //   return;
    // }
    console.log("Processing audio.. entering function ");
    // if (!this.greeted) {
    //   if (this.voice_enabled) {
    //     this.log("Hey!", "main");
    //     await this.tts.generateSpeech("Hey!", "prompt.aiff");
    //     await this.tts.playAudio("prompt.aiff");
    //     this.greeted = true;
    //     this.log("Please ask your question verbally..", "main");
    //     this.muted = false;
    //     this.updateStatus();
    //     this.log("Microphone unmuted for question", "main");
    //   } else {
    //     this.log("Hey!", "main");
    //   }
    // }

    console.log("IS STOP RECORDING? ", this.is_stop_recording);
    console.log("FILE TO WATCH? ", this.file_to_watch);

    if (await fs.stat(this.file_to_watch).catch(() => false) && this.is_stop_recording) {
      console.log("WHAT IS THIS FILE TO WATCH? ", this.file_to_watch);
      console.log("*************** Recording stopped", "main");
      console.log("Transcription started!", "main");

      const stats = await fs.stat(this.file_to_watch);
      const file_size = stats.size;
      
      console.log(`File found: ${this.file_to_watch}. Size: ${file_size} bytes.`, "main");
      
      if (file_size === 0) {
        console.log("Warning: Audio file is empty. Skipping processing.", "main");
      }
      
      // console.log(`Processing audio file. Size: ${file_size} bytes`, "main");
      try {
        console.log(`CONTEXT BEFORE: ${this.context}`, "main");
        const new_transcription = await this.transcribeAudio(this.file_to_watch);
        this.context += `\n${new_transcription}`;
        console.log(`CONTEXT AFTER: ${this.context}`, "main");
        console.log("Transcription updated and added to context.", "main");
      } catch (error) {
        console.log(`Error during transcription: ${error.message}`, "main");
      }
      this.is_stop_recording = false;
    } else {
      console.log(`Waiting for ${this.file_to_watch} or stop-recording command`, "main");
    }

    // if (1) {
    //   console.log("Processing question.. entering function inside if  ");
    //   try {
    //     console.log("Processing question.. entering try block  ");
    //     const user_question = await this.transcribeAudio(this.user_question_file);
    //     this.log(`User: ${user_question}`, "main");

    //     if (!user_question || user_question.trim().length < 10) {
    //       this.log("The question doesn't seem to make sense. Skipping this iteration.", "main");
    //       return;
    //     }

    //     if (!await this.checkContext(user_question)) {
    //       this.log("The question doesn't seem to make sense. Skipping this iteration.", "main");
    //       return;
    //     }

    //     const ai_response = await this.chatWithModel(this.context, user_question);

    //     if (!ai_response || ai_response.trim() === "") {
    //       this.log("The AI couldn't generate a meaningful response. Skipping this iteration.", "main");
    //       return;
    //     }

    //     this.log(`AI: ${ai_response}`, "main");

    //     if (this.voice_enabled) {
    //       const answer_audio_file = await this.tts.generateSpeech(ai_response, "answer.aiff");
    //       if (answer_audio_file) {
    //         this.log(`AI answer audio saved to: ${answer_audio_file}`, "main");
    //         await this.tts.playAudio(answer_audio_file);
    //       } else {
    //         this.log("Failed to generate speech for the AI's answer.", "main");
    //       }
    //     } else {
    //       this.log("Voice output is disabled. Response logged in GUI.", "main");
    //     }

    //     this.generate_answer = false;
    //     this.greeted = false;
    //     this.is_mic_recording = false;
    //     await fs.unlink(this.user_question_file);
    //   } catch (error) {
    //     this.log(`An error occurred: ${error.message}`, "main");
    //   }
    // }
  }

  async run() {
    while (this.should_run) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Check every 0.5 seconds

      this.log(`app.should_run: ${this.should_run}`, "main");
      this.log(`app.is_stop_recording: ${this.is_stop_recording}`, "main");
      this.log(`app.generate_answer: ${this.generate_answer}`, "main");
      this.log(`app.greeted: ${this.greeted}`, "main");
      this.log(`app.voice_enabled: ${this.voice_enabled}`, "main");
      this.log(`app.muted: ${this.muted}`, "main");
      this.log(`app.is_recording: ${this.is_recording}`, "main");
      this.log(`app.file_to_watch: ${this.file_to_watch}`, "main");

      if (await fs.stat(this.file_to_watch).catch(() => false) && this.is_stop_recording) {
        console.log("WHAT IS THIS FILE TO WATCH? ", this.file_to_watch);
        this.log("*************** Recording stopped", "main");
        this.log("Transcription started!", "main");

        const stats = await fs.stat(this.file_to_watch);
        const file_size = stats.size;
        
        this.log(`File found: ${this.file_to_watch}. Size: ${file_size} bytes.`, "main");
        
        if (file_size === 0) {
          this.log("Warning: Audio file is empty. Skipping processing.", "main");
          continue;
        }
        
        this.log(`Processing audio file. Size: ${file_size} bytes`, "main");
        try {
          this.log(`CONTEXT BEFORE: ${this.context}`, "main");
          const new_transcription = await this.transcribeAudio(this.file_to_watch);
          this.context += `\n${new_transcription}`;
          this.log(`CONTEXT AFTER: ${this.context}`, "main");
          this.log("Transcription updated and added to context.", "main");
        } catch (error) {
          this.log(`Error during transcription: ${error.message}`, "main");
          continue;
        }
        this.is_stop_recording = false;
      } else {
        this.log(`Waiting for ${this.file_to_watch} or stop-recording command`, "main");
      }

      // await this.processAudio();
    }
  }

  // Methods to handle commands from main process
  setMute(shouldMute) {
    this.muted = shouldMute;
    this.log(`Microphone ${this.muted ? 'muted' : 'unmuted'}`, "handle_commands");
    this.updateStatus();
  }

  toggleRecording() {
    this.is_recording = !this.is_recording;
    this.log(`Recording ${this.is_recording ? 'started' : 'stopped'}`, "handle_commands");
    this.updateStatus();
  }

  setVoiceEnabled(isEnabled) {
    this.voice_enabled = isEnabled;
    this.log(`Voice output ${this.voice_enabled ? 'enabled' : 'disabled'}`, "handle_commands");
  }

  processQuestion() {
    this.generate_answer = true;
    this.log("Received process-question command", "handle_commands");
  }

  toggleMicRecording() {
    this.is_mic_recording = true;
    this.log("Received record-mic command", "handle_commands");
    this.updateStatus();
  }

  stopRecording() {
    this.is_stop_recording = true;
    this.log("Received stop-recording command", "handle_commands");
    this.updateStatus();
  }
}

module.exports = BackendProcessor;