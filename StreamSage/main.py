import os
from dotenv import load_dotenv
from groq import Groq
from audio_utils import MacTTS,DeepGram, transcribe_audio, chat_with_model, record_audio, check_context
import time
import sys
import json
import traceback
import select
import threading

# Load environment variables from .env file
load_dotenv()

# Initialize the Groq client with API key from .env
transcriber = Groq(api_key=os.getenv('GROQ_API_KEY'))

# Initialize the Groq client for chat
chat_client = Groq(api_key=os.getenv('GROQ_API_KEY2'))

class ElectronApp:
    def __init__(self):
        # Get the directory of the current script
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Set the file_to_watch path relative to the current script
        self.file_to_watch = os.path.join(current_dir, "recorded_audio.webm")
        self.user_question_file = "user_question.wav"
        self.voice_enabled = True
        self.muted = True  # Start muted
        self.is_recording = False
        self.should_run = True
        self.generate_answer = False
        self.greeted = False
        self.is_mic_recording = False
        self.context = ""
        self.is_stop_recording = False
        self.debug_enabled = False  # Debugging enabled by default

    def log(self, message, tag=""):
        if self.debug_enabled:
            print(json.dumps({"type": "log", "message": message, "tag": tag}))
            sys.stdout.flush()

    def update_level_meter(self, amplitude):
        if self.debug_enabled:
            print(json.dumps({"type": "level_meter", "amplitude": amplitude}))
            sys.stdout.flush()

    def update_status(self):
        if self.debug_enabled:
            status_update = json.dumps({
                "type": "status_update",
                "muted": self.muted,
                "recording": self.is_recording
            })
            print(status_update)
            sys.stdout.flush()

def handle_commands(app):
    while app.should_run:
        rlist, _, _ = select.select([sys.stdin], [], [], 0.1)
        if rlist:
            command = sys.stdin.readline().strip()
            app.log(f"Received command: {command}", "handle_commands")
            if command == "process-audio":
                app.log("Received process-audio command", "handle_commands")
                if os.path.exists(app.file_to_watch):
                    file_size = os.path.getsize(app.file_to_watch)
                    app.log(f"File found: {app.file_to_watch}. Size: {file_size} bytes.", "handle_commands")
                    if file_size > 0:
                        app.log("File is not empty. Ready for processing in the main loop.", "handle_commands")
                    else:
                        app.log("Warning: Audio file is empty.", "handle_commands")
                else:
                    app.log(f"Audio file not found: {app.file_to_watch}", "handle_commands")
            elif command.startswith("set-mute"):
                mute_state = command.split()[1].lower() == "true"
                app.muted = mute_state
                app.log(f"Microphone {'muted' if app.muted else 'unmuted'}", "handle_commands")
                app.update_status()
            elif command == "toggle-recording":
                app.is_recording = not app.is_recording
                app.log(f"Recording {'started' if app.is_recording else 'stopped'}", "handle_commands")
                app.update_status()
            elif command.startswith("toggle-voice"):
                app.voice_enabled = command.split()[1].lower() == "true"
                app.log(f"Voice output {'enabled' if app.voice_enabled else 'disabled'}", "handle_commands")
            elif command == "exit":
                app.should_run = False
            # In your existing command handling logic
            elif command == "process-question":
                app.generate_answer = True
                app.log("Received process-question command", "handle_commands")
                if os.path.exists(app.user_question_file):
                    file_size = os.path.getsize(app.user_question_file)
                    app.log(f"File found: {app.user_question_file}. Size: {file_size} bytes.", "handle_commands")
                    if file_size > 0:
                        app.log("File is not empty. Ready for processing in the main loop.", "handle_commands")
                    else:
                        app.log("Warning: Audio file is empty.", "handle_commands")
            elif command == "toggle-mic-recording":
                app.log("Received record-mic command", "handle_commands")
                app.is_mic_recording = True
                app.update_status()
                # app.log("toggle-mic-recording")

            elif command == "stop-recording":
                app.log("Received stop-recording command", "handle_commands")
                app.is_stop_recording = True
                app.update_status()

def main(app):
    try:
        if sys.platform == 'darwin':
            tts = MacTTS()
        else:
            tts = DeepGram()
        last_modified_time = 0

        last_mute_log_time = 0
        file_check_interval = 0.5  # Check for file every 0.5 seconds

        # Start the command handling thread
        command_thread = threading.Thread(target=handle_commands, args=(app,))
        command_thread.start()

        while app.should_run:
            #print all variables
            app.log(f"app.should_run: {app.should_run}", "main")
            app.log(f"app.is_stop_recording: {app.is_stop_recording}", "main")
            app.log(f"app.generate_answer: {app.generate_answer}", "main")
            app.log(f"app.greeted: {app.greeted}", "main")
            app.log(f"app.voice_enabled: {app.voice_enabled}", "main")
            app.log(f"app.muted: {app.muted}", "main")
            app.log(f"app.is_recording: {app.is_recording}", "main")
            app.log(f"app.file_to_watch: {app.file_to_watch}", "main")
            time.sleep(file_check_interval)

            if os.path.exists(app.file_to_watch) and app.is_stop_recording == True:
                app.log("*************** Recording stopped", "main")
                app.log("Transcription started!", "main")

                current_modified_time = os.path.getmtime(app.file_to_watch)
                file_size = os.path.getsize(app.file_to_watch)
                
                time.sleep(0.5)
                app.log(f"File found: {app.file_to_watch}. Size: {file_size} bytes. Last modified: {current_modified_time}", "main")
                
                if file_size == 0:
                    app.log("Warning: Audio file is empty. Skipping processing.", "main")
                    continue
                
                if current_modified_time != last_modified_time:
                    app.log(f"Processing audio file. Size: {file_size} bytes", "main")
                    try:
                        app.log(f"CONTEXT BEFORE: {app.context}", "main")  # Log the current context
                        new_transcription = transcribe_audio(transcriber, app.file_to_watch)
                        app.context += f"\n{new_transcription}"  # Append new transcription to context
                        app.log(f"CONTEXT AFTER: {app.context}", "main")  # Log the updated context
                        # app.log(f"Transcription: {new_transcription}")
                        last_modified_time = current_modified_time
                        # app.log(f"Transcription: {app.context}")
                        app.log("Transcription updated and added to context.", "main")
                    except Exception as e:
                        app.log(f"Error during transcription: {str(e)}", "main")
                        continue
                    app.is_stop_recording = False
                else:
                    app.log("Screen audio File not modified since last check. Skipping processing.", "main")
            else:
                app.log(f"Waiting for {app.file_to_watch} or stop-recording command", "main")
                # continue


            if app.muted:
                # current_time = time.time()
                # if current_time - last_mute_log_time > 60:  # Log only once per minute
                # app.log("Microphone is muted, skipping audio processing", "main")
                #     last_mute_log_time = current_time
                continue
            if not app.greeted:
                if app.voice_enabled:
                    app.log("Hey!", "main")
                    tts.generate_speech("Hey!", "prompt.aiff")
                    tts.play_audio("prompt.aiff")
                    app.greeted = True
                    app.log("Please ask your question verbally..", "main")
                    app.muted = False
                    app.update_status()
                    app.log("Microphone unmuted for question", "main")
                else: #TODO NO VOICE MODE - THIS IS JUST A PLACEHOLDER
                    app.log("Hey!", "main")
            else:

                app.log(f"app.greeted: {app.greeted}", "main")
                


            
            # Unmute the microphone before recording the question
            
            # Record the user's question with silence detection
            app.log(app.is_mic_recording, "main")
            if not app.muted:
                app.log("*************** Recording started", "main")
                user_question_audio = record_audio(app.user_question_file, max_duration=15, silence_threshold=1000, silence_duration=3)
                app.log("*************** Recording stopped", "main")
                app.log("FILE SAVED", "main")
                app.update_status()
                app.generate_answer = True
            else:
                continue
            # Do not mute the microphone after recording the question
            # The mic will remain unmuted until the user manually mutes it
            if app.generate_answer:
                if os.path.exists(app.user_question_file):
                    user_question = transcribe_audio(transcriber,app.user_question_file)
                    app.log(f"User: {user_question}", "main")
                else:
                    app.log("No user question file found - File not found/saved.", "main")
                    continue

                if not user_question or len(user_question.strip()) < 10:
                    app.log("The question doesn't seem to make sense. Skipping this iteration.", "main")
                    continue

                if not check_context(chat_client, user_question):  # Check context before processing
                    app.log("The question doesn't seem to make sense. Skipping this iteration.", "main")
                    continue

                ai_response = chat_with_model(chat_client, app.context, user_question)

                if not ai_response or ai_response.strip() == "":
                    app.log("The AI couldn't generate a meaningful response. Skipping this iteration.", "main")
                    continue

                app.log(f"AI: {ai_response}", "main")

                if app.voice_enabled:
                    answer_audio_file = tts.generate_speech(ai_response, "answer.aiff")
                    if answer_audio_file:
                        app.log(f"AI answer audio saved to: {answer_audio_file}", "main")
                        tts.play_audio(answer_audio_file)
                    else:
                        app.log("Failed to generate speech for the AI's answer.", "main")
                else:
                    app.log("Voice output is disabled. Response logged in GUI.", "main")
                app.generate_answer = False
                app.greeted = False
                app.is_mic_recording = False
                #delete the audio file
                os.remove(app.user_question_file)
                # app.log("User question file deleted.", "main")

    except Exception as e:
        app.log(f"An error occurred: {str(e)}", "main")
        app.log(traceback.format_exc(), "main")
    finally:
        app.should_run = False
        command_thread.join()

# Redirect stdout to catch all print statements
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        return str(obj)

class StdoutCatcher:
    def write(self, data):
        sys.stderr.write(json.dumps({"type": "log", "message": data}, cls=JSONEncoder) + "\n")
        sys.stderr.flush()

    def flush(self):
        sys.stderr.flush()

sys.stdout = StdoutCatcher()

# Wrap the main function in a try-except block
if __name__ == "__main__":
    try:
        app = ElectronApp()
        main(app)
    except Exception as e:
        error_message = traceback.format_exc()
        sys.stderr.write(json.dumps({"type": "error", "message": error_message}) + "\n")
        sys.stderr.flush()