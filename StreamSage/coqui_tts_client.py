import requests
import io
import pygame

url = "http://192.168.1.185:7777/generate_speech"
params = {"text": "This is a test of the emergency broadcast system"}
response = requests.post(url, params=params)

if response.status_code == 200:
    audio_data = io.BytesIO(response.content)
    pygame.mixer.init()
    pygame.mixer.music.load(audio_data)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        pygame.time.Clock().tick(10)
    print("Audio played successfully")
else:
    print(f"Error: {response.status_code}")
    print(response.text)