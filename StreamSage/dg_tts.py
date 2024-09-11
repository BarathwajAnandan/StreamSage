from deepgram import DeepgramClient, SpeakOptions
import os
from dotenv import load_dotenv
import pygame

load_dotenv()
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')

def generate_speech(text, filename="audio.mp3", model="aura-asteria-en"):
    try:
        print(DEEPGRAM_API_KEY)
        deepgram = DeepgramClient(DEEPGRAM_API_KEY)

        options = SpeakOptions(
            model=model,
        )

        text_input = {"text": text}

        response = deepgram.speak.v("1").save(filename, text_input, options)
        print(response.to_json(indent=4))
        return filename

    except Exception as e:
        print(f"Exception: {e}")
        return None

def play_audio(filename):
    pygame.mixer.init()
    pygame.mixer.music.load(filename)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        pygame.time.Clock().tick(10)

if __name__ == "__main__":
    sample_text = "What is the weather in Tokyo?"
    audio_file = generate_speech(sample_text)
    if audio_file:
        play_audio(audio_file)