from piper import PiperVoice
import wave
import os

root = '/home/barathwajanandan/StreamSage/piper/src/python_run'
# Initialize the Piper voice
voice = PiperVoice.load(root + "/en_US-lessac-medium.onnx")

def synthesize_speech(text, output_fname="test.wav"):
    # Get the full path for the output file
    full_path = os.path.abspath(output_fname)
    
    # Synthesize audio
    with wave.open(full_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 2 bytes per sample for 16-bit audio
        wav_file.setframerate(voice.config.sample_rate)
        voice.synthesize(text, wav_file)
    
    return full_path

# Example usage:
# synthesized_file = synthesize_speech("Hello, world!", "output.wav")
# print(f"Audio saved to: {synthesized_file}")

