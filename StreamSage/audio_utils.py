from abc import ABC, abstractmethod
from deepgram import DeepgramClient, SpeakOptions
import os
from dotenv import load_dotenv
import pygame
import requests
import io
import subprocess
import pyaudio
import wave
import audioop
import time
from groq import Groq
import numpy as np

load_dotenv()
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')
COQUI_LOCAL_URL = os.getenv('COQUI_LOCAL_URL')
PIPER_LOCAL_URL = os.getenv('PIPER_LOCAL_URL')

class SpeechGenerator(ABC):
    @abstractmethod
    def generate_speech(self, text, filename="audio.mp3"):
        pass

    @abstractmethod
    def play_audio(self, filename):
        pass

    @abstractmethod
    def stop_audio(self):
        pass

class DeepGram(SpeechGenerator):
    def __init__(self):
        self.deepgram = DeepgramClient(DEEPGRAM_API_KEY)
        pygame.mixer.init()

    def generate_speech(self, text, filename="audio.mp3"):
        try:
            options = SpeakOptions(
                model="aura-asteria-en",
            )

            text_input = {"text": text}

            response = self.deepgram.speak.v("1").save(filename, text_input, options)
            print(response.to_json(indent=4))
            return filename

        except Exception as e:
            print(f"Exception: {e}")
            return None

    def play_audio(self, filename):
        try:
            pygame.mixer.music.load(filename)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
            print("Audio played successfully")
        except Exception as e:
            print(f"Error playing audio: {e}")

    def stop_audio(self):
        pygame.mixer.music.stop()
        print("Audio playback stopped")

class Coqui(SpeechGenerator):
    def __init__(self, url=COQUI_LOCAL_URL):
        self.url = url
        pygame.mixer.init()

    def generate_speech(self, text, filename="audio.mp3"):
        try:
            params = {"text": text}
            response = requests.post(self.url, params=params)

            if response.status_code == 200:
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"Audio saved to {filename}")
                return filename
            else:
                print(f"Error: {response.status_code}")
                print(response.text)
                return None

        except Exception as e:
            print(f"Exception: {e}")
            return None

    def play_audio(self, filename):
        try:
            audio_data = io.BytesIO()
            with open(filename, 'rb') as f:
                audio_data.write(f.read())
            audio_data.seek(0)
            pygame.mixer.music.load(audio_data)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
            print("Audio played successfully")
        except Exception as e:
            print(f"Error playing audio: {e}")

    def stop_audio(self):
        pygame.mixer.music.stop()
        print("Audio playback stopped")

class Piper(SpeechGenerator):
    def __init__(self, url=PIPER_LOCAL_URL):
        self.url = url
        pygame.mixer.init()

    def generate_speech(self, text, filename="audio.mp3"):
        try:
            params = {"text": text}
            response = requests.post(self.url, params=params)

            if response.status_code == 200:
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"Audio saved to {filename}")
                return filename
            else:
                print(f"Error: {response.status_code}")
                print(response.text)
                return None

        except Exception as e:
            print(f"Exception: {e}")
            return None

    def play_audio(self, filename):
        try:
            audio_data = io.BytesIO()
            with open(filename, 'rb') as f:
                audio_data.write(f.read())
            audio_data.seek(0)
            pygame.mixer.music.load(audio_data)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
            print("Audio played successfully")
        except Exception as e:
            print(f"Error playing audio: {e}")

    def stop_audio(self):
        pygame.mixer.music.stop()
        print("Audio playback stopped")

class MacTTS(SpeechGenerator):
    def __init__(self):
        self.process = None

    def generate_speech(self, text, filename="audio.aiff"):
        try:
            subprocess.run(["say", "-o", filename, text], check=True)
            print(f"Audio saved to {filename}")
            return filename
        except subprocess.CalledProcessError as e:
            print(f"Error occurred while trying to generate speech: {e}")
            return None

    def play_audio(self, filename):
        try:
            self.process = subprocess.Popen(["afplay", filename])
            self.process.wait()
            print("Audio played successfully")
        except subprocess.CalledProcessError as e:
            print(f"Error playing audio: {e}")

    def stop_audio(self):
        if self.process:
            self.process.terminate()
            print("Audio playback stopped")

def record_audio(filename, max_duration=10, silence_threshold=500, silence_duration=3):
    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100

    p = pyaudio.PyAudio()

    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK)

    print("* Recording")

    frames = []
    silent_chunks = 0
    max_chunks = int(RATE / CHUNK * max_duration)

    for i in range(max_chunks):
        data = stream.read(CHUNK)
        frames.append(data)

        # Convert data to numpy array
        audio_data = np.frombuffer(data, dtype=np.int16)
        
        # Check if this chunk is silent
        if np.abs(audio_data).mean() < silence_threshold:
            silent_chunks += 1
        else:
            silent_chunks = 0

        # If we've had 3 seconds of silence, stop recording
        if silent_chunks > RATE / CHUNK * silence_duration:
            print("Detected 3 seconds of silence, stopping recording.")
            break

    print("* Done recording")

    stream.stop_stream()
    stream.close()
    p.terminate()

    wf = wave.open(filename, 'wb')
    wf.setnchannels(CHANNELS)
    wf.setsampwidth(p.get_sample_size(FORMAT))
    wf.setframerate(RATE)
    wf.writeframes(b''.join(frames))
    wf.close()

    return filename

def transcribe_audio(transcriber, filename=None):
    if filename is None:
        if os.name == 'nt':  # Windows
            filename = "C:\\Users\\barat\\Downloads\\recorded_audio.mp3"
        elif os.name == 'posix':  # macOS or Linux
            filename = os.path.expanduser("recorded_audio.mp3")
        else:
            raise OSError("Unsupported operating system")

        if not os.path.exists(filename):
            raise FileNotFoundError(f"Audio file not found at {filename}")

    with open(filename, "rb") as file:
        try:
            transcription = transcriber.audio.transcriptions.create(
              file=(filename, file.read()),
              model="distil-whisper-large-v3-en",
              prompt="Specify context or spelling",
              response_format="json",
              language="en",
              temperature=0.0
            )
            print(transcription.text)
            return transcription.text
        except Exception as e:
            raise Exception(f"Error during transcription: {str(e)}")

def chat_with_model(chat_client, context, question, model="llama3-8b-8192"):
    try:
        prompt = f"""
        Context: The following is a transcription from a live video the user is currently watching:
        {context}

        The user is confused and has the following question:
        {question}

        Instructions:
        1. Analyze the provided transcription carefully, keeping in mind it's from a live video the user is watching right now.
        2. Consider the real-time nature of the content and any potential gaps or ambiguities in the transcription.
        3. Address the user's confusion directly, providing a clear and helpful explanation based on the context.
        4. If the question doesn't make sense, is out of context, or is irrelevant to the provided transcription, or if the input is not meaningful or mostly silent, do not respond.

        Do not talk about the video or the user's question. Just provide a response to the user's question briefly.
        """

        response = chat_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant designed to aid users in real-time as they watch live video content. Your goal is to clarify confusions, provide insights, and enhance the viewer's understanding based on transcribed audio from the video. If a question is irrelevant or out of context, politely decline to answer."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=4096,
            top_p=0.95,
            stream=False,
            stop=None
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"Error during chat interaction: {str(e)}")

if __name__ == "__main__":
    sample_text = "hi PRACHIE, how are you?"
    
    # Choose the TTS engine: 'deepgram', 'coqui', or 'piper'
    tts_engine = 'mac'  # You can change this to 'deepgram' or 'piper' to use those engines

    if tts_engine == 'deepgram':
        generator = DeepGram()
    elif tts_engine == 'coqui':
        generator = Coqui()
    elif tts_engine == 'piper':
        generator = Piper()
    elif tts_engine == 'mac':
        generator = MacTTS()
    else:
        raise ValueError("Invalid TTS engine. Choose 'deepgram', 'coqui', or 'piper'.")

    audio_file = generator.generate_speech(sample_text)
    if audio_file:
        generator.play_audio(audio_file)
        # Uncomment the following line to test stopping audio midway
        # generator.stop_audio()