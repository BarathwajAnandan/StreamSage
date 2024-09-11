import os
from dotenv import load_dotenv
from groq import Groq
from audio_utils import MacTTS, transcribe_audio, chat_with_model, record_audio
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

    def log(self, message):
        print(json.dumps({"type": "log", "message": message}))
        sys.stdout.flush()

    def update_level_meter(self, amplitude):
        print(json.dumps({"type": "level_meter", "amplitude": amplitude}))
        sys.stdout.flush()

    def update_status(self):
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
            app.log(f"Received command: {command}")
            if command == "process-audio":
                app.log("Received process-audio command")
                if os.path.exists(app.file_to_watch):
                    file_size = os.path.getsize(app.file_to_watch)
                    app.log(f"File found: {app.file_to_watch}. Size: {file_size} bytes.")
                    if file_size > 0:
                        app.log("File is not empty. Ready for processing in the main loop.")
                    else:
                        app.log("Warning: Audio file is empty.")
                else:
                    app.log(f"Audio file not found: {app.file_to_watch}")
            elif command.startswith("set-mute"):
                mute_state = command.split()[1].lower() == "true"
                app.muted = mute_state
                app.log(f"Microphone {'muted' if app.muted else 'unmuted'}")
                app.update_status()
            elif command == "toggle-recording":
                app.is_recording = not app.is_recording
                app.log(f"Recording {'started' if app.is_recording else 'stopped'}")
                app.update_status()
            elif command.startswith("toggle-voice"):
                app.voice_enabled = command.split()[1].lower() == "true"
                app.log(f"Voice output {'enabled' if app.voice_enabled else 'disabled'}")
            elif command == "exit":
                app.should_run = False

def main(app):
    try:
        tts = MacTTS()
        last_modified_time = 0
        context = ""
        last_mute_log_time = 0
        file_check_interval = 0.5  # Check for file every 0.5 seconds

        # Start the command handling thread
        command_thread = threading.Thread(target=handle_commands, args=(app,))
        command_thread.start()

        while app.should_run:
            time.sleep(file_check_interval)

            if app.muted:
                # current_time = time.time()
                # if current_time - last_mute_log_time > 60:  # Log only once per minute
                app.log("Microphone is muted, skipping audio processing")
                #     last_mute_log_time = current_time
                continue

            if os.path.exists(app.file_to_watch):
                current_modified_time = os.path.getmtime(app.file_to_watch)
                file_size = os.path.getsize(app.file_to_watch)
                
                app.log(f"File found: {app.file_to_watch}. Size: {file_size} bytes. Last modified: {current_modified_time}")
                
                if file_size == 0:
                    app.log("Warning: Audio file is empty. Skipping processing.")
                    continue
                
                if current_modified_time != last_modified_time:
                    app.log(f"Processing audio file. Size: {file_size} bytes")
                    try:
                        new_transcription = transcribe_audio(transcriber, app.file_to_watch)
                        context += f"\n{new_transcription}"
                        last_modified_time = current_modified_time
                        app.log(f"Transcription: {new_transcription}")
                        app.log("Transcription updated and added to context.")
                    except Exception as e:
                        app.log(f"Error during transcription: {str(e)}")
                        continue
                else:
                    app.log("File not modified since last check. Skipping processing.")
            else:
                app.log(f"Waiting for {app.file_to_watch}")
                continue

            if app.voice_enabled:
                app.log("Hey!")
                tts.generate_speech("Hey!", "prompt.aiff")
                tts.play_audio("prompt.aiff")
            else:
                app.log("Hey!")

            app.log("Please ask your question verbally..")
            
            # Unmute the microphone before recording the question
            app.muted = False
            app.update_status()
            app.log("Microphone unmuted for question")
            
            # Record the user's question with silence detection
            user_question_audio = record_audio(app.user_question_file, max_duration=30, silence_threshold=500, silence_duration=3)
            
            # Do not mute the microphone after recording the question
            # The mic will remain unmuted until the user manually mutes it
            
            user_question = transcribe_audio(transcriber,user_question_audio)
            app.log(f"User: {user_question}")

            if not user_question or len(user_question.strip()) < 10:
                app.log("The question doesn't seem to make sense. Skipping this iteration.")
                continue

            ai_response = chat_with_model(chat_client, context, user_question)

            if not ai_response or ai_response.strip() == "":
                app.log("The AI couldn't generate a meaningful response. Skipping this iteration.")
                continue

            app.log(f"AI: {ai_response}")

            if app.voice_enabled:
                answer_audio_file = tts.generate_speech(ai_response, "answer.aiff")
                if answer_audio_file:
                    app.log(f"AI answer audio saved to: {answer_audio_file}")
                    tts.play_audio(answer_audio_file)
                else:
                    app.log("Failed to generate speech for the AI's answer.")
            else:
                app.log("Voice output is disabled. Response logged in GUI.")

    except Exception as e:
        app.log(f"An error occurred: {str(e)}")
        app.log(traceback.format_exc())
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