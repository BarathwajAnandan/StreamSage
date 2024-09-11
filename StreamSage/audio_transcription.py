import os
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Print contents of dotenv to see if it's loading properly
print("Environment variables loaded from .env:")
for key, value in os.environ.items():
    print(f"{key}: {value}")

# Initialize the Groq client with API key from .env
client = Groq(api_key=os.getenv('GROQ_API_KEY'))

def transcribe_audio(filename=None):
    if filename is None:
        filename = os.path.dirname(__file__) + '/extracted_audio.mp3'

    with open(filename, "rb") as file:
        try:
            # Create a transcription of the audio file
            transcription = client.audio.transcriptions.create(
              file=(filename, file.read()), # Required audio file
              model="distil-whisper-large-v3-en", # Required model to use for transcription
              prompt="Specify context or spelling",  # Optional
              response_format="json",  # Optional
              language="en",  # Optional
              temperature=0.0  # Optional
            )
            # Print the transcription text
            print(transcription.text)
            return transcription.text
        except Exception as e:
            raise Exception(f"Error during transcription: {str(e)}")