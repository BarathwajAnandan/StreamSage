import subprocess

def speak_with_mac_tts(text, voice="Siri"):
    """
    Use macOS built-in 'say' command for Text-to-Speech.
    
    :param text: The text to be spoken
    :param voice: The voice to use (default is Siri)
    """
    try:
        subprocess.run(["say",  text], check=True)
        print(f"Spoke: {text}")
    except subprocess.CalledProcessError as e:
        print(f"Error occurred while trying to speak: {e}")

# Example usage
if __name__ == "__main__":
    sample_text = "Hello! I'm using the macOS say command for Text-to-Speech. Isn't this cool?"
    speak_with_mac_tts(sample_text)
