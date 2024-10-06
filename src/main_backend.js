const { Groq } = require('groq-sdk');

const { recordAudioWithSox } = require('./mic_record');
// Initialize the Groq client
const groq = new Groq();
const { MacTTS, DeepGram } = require('./tts');
const fs_promises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');


const fs = require("fs");
// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });




class BackendProcessor 
{
  constructor(mainWindow) 
  {
    this.mainWindow = mainWindow;
    this.file_to_watch = path.join(__dirname, "../StreamSage/recorded_audio.webm");
    this.user_question_file = "user_question.wav";
    this.user_question = "";
    this.voice_enabled = true;
    this.muted = true;
    this.is_recording = false;
    this.should_run = true;
    this.generate_answer = false;
    this.greeted = false;
    this.is_mic_recording = false;
    this.context = "";
    this.is_stop_recording = false;
    this.debug_enabled = true;
    this.prev_modified_time = 0;

    this.transcriber = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.chat_client = new Groq({ apiKey: process.env.GROQ_API_KEY2 });
    this.tts = process.platform === 'darwin' ? new MacTTS() : new DeepGram();
  }

  async sendStatusToRenderer(status) 
  {
    this.mainWindow.webContents.send('update-status', status);
  }
  log(message, tag = "") 
  {
    if (this.debug_enabled) 
    {
      this.mainWindow.webContents.send('python-output', JSON.stringify({ type: "log", message, tag }));
    }
  }

  // Record audio from mic
  async trigger_mic_recording(outputFile, sampleRate = 16000, device = 1) 
  {
    console.log('Triggering mic recording...');

    try 
    {
      await recordAudioWithSox(outputFile, sampleRate, device);
      console.log('Mic recording completed successfully.');
    } 
    catch (error) 
    {
      console.error('An error occurred during mic recording:', error);
      throw error; // Re-throw the error to be caught in the main function
    }
  }

  async groq_transcribe(filename) 
  {
    // Create a transcription job
    const transcription = await this.transcriber.audio.transcriptions.create({
      file: fs.createReadStream(filename), // Required path to audio file - replace with your audio file!
      model: "distil-whisper-large-v3-en", // Required model to use for transcription
      prompt: "Specify context or spelling", // Optional
      response_format: "json", // Optional
      language: "en", // Optional
      temperature: 0.0, // Optional
    });
    // Log the transcribed text
    return transcription;
  }

  async transcribeAudio(filename) 
  {
    // this.log("Transcribing audio file: ", filename, "transcribeAudio");
    try 
    {
      console.log("Transcribing audio file: ", filename);
      const transcription = await this.groq_transcribe(filename);
      return transcription.text;
    } 
    catch (error) 
    {
      if (error.code === 'ENOENT') 
      {
        throw new Error(`Error during transcription: File not found: ${filename}`);
      } 
      else 
      {
        throw new Error(`Error during transcription: ${error.message}`);
      }
    }
  }

  async chatWithModel(context, question, model = "llama3-8b-8192") 
  {
    try 
    {
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
    } 
    catch (error) 
    {
      throw new Error(`Error during chat interaction: ${error.message}`);
    }
  }

  async checkContext(question, context = '', model = "llama3-8b-8192") 
  {
    try 
    {
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
    } 
    catch (error) 
    {
      throw new Error(`Error during chat interaction: ${error.message}`);
    }
  }

  async run() 
  {
    while (this.should_run) 
    {
      await new Promise(resolve => setTimeout(resolve, 500)); // Check every 0.5 seconds

      console.log("is_recording: " + this.is_recording);
      // Check if the recording is currently active
        // Log a message indicating that recording is active and we are waiting for a stop command
        this.log("Recording is ON... Waiting for stop command", "main");
        
        // Create a promise that will resolve when the recording stops
        await new Promise(resolve => 
        {
          // Set up an interval to check the recording status every 0.5 seconds
          const checkRecording = setInterval(() => 
          {
            // If recording is no longer active
            if (!this.is_recording) 
            {
              // Clear the interval to stop checking
              clearInterval(checkRecording);
              // Resolve the promise to indicate that we can proceed
              resolve();
            }
            else
            {
              this.sendStatusToRenderer("Recording....")
            }
          }, 1000); // Check every 1 second
        });


      if (await fs_promises.stat(this.file_to_watch).catch(() => false)) 
      {
        this.sendStatusToRenderer("processing audio file...")
        const stats = await fs_promises.stat(this.file_to_watch);
        const file_size = stats.size;
        if (file_size === 0) 
        {
          this.log("Warning: Audio file is empty. Skipping processing.", "main");
          this.sendStatusToRenderer("Warning: context audio empty")
          continue;
        }
        this.log(`File found: ${this.file_to_watch}. Size: ${file_size} bytes.`, "main");
        this.log("*************** Recording is stopped", "main");

        // const stats = await fs.stat(this.file_to_watch);
        const currentModifiedTime = stats.mtimeMs;
        if (currentModifiedTime !== this.prev_modified_time) 
        {
          console.log("File IS MODIFIED!! Transcription started!", "main");
          this.sendStatusToRenderer("Transcribing context...")
          this.log(`CONTEXT BEFORE: ${this.context}`, "main");
          this.prev_modified_time = currentModifiedTime; // Update the last modified time after processing

          // this.log("FILE TO WATCH: ", this.file_to_watch);
          const new_transcription = await this.transcribeAudio(this.file_to_watch);
          this.context += `\n${new_transcription}`;
          console.log(`CONTEXT AFTER: ${this.context}`, "main");
          this.log("Transcription updated and added to context.", "main");
          this.sendStatusToRenderer("Transcription updated and added to context.")
          this.is_stop_recording = false;
        }  
        else 
        {
          this.sendStatusToRenderer(`Ready - Unmute to start questioning!`)
          this.log(`Waiting for ${this.file_to_watch} or stop-recording command`, "main");
        } 
      } // end of if (await fs_promises.stat(this.file_to_watch).catch(() => false) && this.is_stop_recording)
      else
      {
        this.log("NO Recording. File not found: " + this.file_to_watch, "main");
        continue;
      }
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      if (this.muted)
      {
        this.log("Muted, skipping processing", "main");
        continue;
      }
      //call function to enable microphone recording
      // this.is_mic_recording = true;
      //send recording command to renderer
      this.sendStatusToRenderer("Listening....Ask your question")
      this.mainWindow.webContents.send('mic-start');
      await this.trigger_mic_recording(this.user_question_file);
      this.sendStatusToRenderer("processing ...")
      //check if file is available and if it's not empty
      if (await fs_promises.stat(this.user_question_file).catch(() => false)) 
      {
        const stats = await fs_promises.stat(this.user_question_file);
        const file_size = stats.size;
        if (file_size === 0) 
        {
          this.log("Warning: Mic recording file is empty. Skipping processing.", "main");
          continue;
        }
        console.log("Mic recording file is not empty. Processing...")
        const transcription = await this.transcribeAudio(this.user_question_file);
        this.user_question = transcription;
        console.log("USER QUESTION: " + this.user_question);
        this.mainWindow.webContents.send('mic-stop');
        this.is_mic_recording = false;
        this.sendStatusToRenderer("Thinking...") 
        //we have question, context and we can start chat

        this.mainWindow.webContents.send('answer-start');
        const answer = await this.chatWithModel(this.context, this.user_question);
        console.log("ANSWER: " + answer);
        this.mainWindow.webContents.send('answer-stop');
        this.sendStatusToRenderer("Answering...") 
        await this.tts.generateSpeech(answer);
        console.log("TTS generated speech");
        await  this.tts.playAudio();
        console.log("TTS played audio");
        this.mainWindow.webContents.send('answer-play');
      }

    }
  }

  // Methods to handle commands from main process
  setMute(isMuted) 
  {
    this.muted = isMuted;
    this.log(`Microphone ${this.muted ? 'muted' : 'unmuted'}`, "handle_commands");
    // this.updateStatus();
  }

  setRecording(isRecording) 
  {
    this.is_recording = isRecording;
    this.log(`Recording ${this.is_recording ? 'started' : 'stopped'}`, "handle_commands");
    // this.updateStatus();
  }

  setVoiceEnabled(isEnabled) 
  {
    this.voice_enabled = isEnabled;
    this.log(`Voice output ${this.voice_enabled ? 'enabled' : 'disabled'}`, "handle_commands");
  }

  // processQuestion() 
  // {
  //   this.generate_answer = true;
  //   this.log("Received process-question command", "handle_commands");
  // }

  // toggleMicRecording() 
  // {
  //   this.is_mic_recording = true;
  //   this.log("Received record-mic command", "handle_commands");
  //   // this.updateStatus();
  // }

  stopRecording() 
  {
    this.is_stop_recording = true;
    this.log("Received stop-recording command", "handle_commands");
    // this.updateStatus();
  }
}

module.exports = BackendProcessor;