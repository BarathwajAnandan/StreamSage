import tkinter as tk
from tkinter import ttk
import sounddevice as sd
import soundfile as sf
import numpy as np
from pydub import AudioSegment
import threading

class ScreenAudioRecorder:
    def __init__(self, master):
        self.master = master
        self.master.title("Screen Audio Recorder")
        self.master.geometry("300x250")
        self.master.resizable(False, False)
        self.master.attributes('-topmost', True)  # Make the window always on top

        self.is_recording = False
        self.audio_data = []
        self.sample_rate = 14400   # Increased sample rate for better quality
        self.channels = 1  # Stereo recording for better quality
        self.chunk = 1024  # Chunk size

        style = ttk.Style()
        style.configure("TButton", padding=10, font=('Helvetica', 12))

        self.start_button = ttk.Button(master, text="Start Recording", command=self.start_recording)
        self.start_button.pack(pady=10)

        self.stop_button = ttk.Button(master, text="Stop Recording", command=self.stop_recording, state=tk.DISABLED)
        self.stop_button.pack(pady=10)

        self.status_label = ttk.Label(master, text="Ready to record", font=('Helvetica', 10))
        self.status_label.pack(pady=5)

        self.device_label = ttk.Label(master, text="", font=('Helvetica', 10))
        self.device_label.pack(pady=5)

        self.level_meter = ttk.Progressbar(master, orient="horizontal", length=200, mode="determinate")
        self.level_meter.pack(pady=10)

    def start_recording(self):
        self.is_recording = True
        self.audio_data = []
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.status_label.config(text="Recording...")

        def audio_callback(indata, frames, time, status):
            if status:
                print(f"Error in audio stream: {status}")
            self.audio_data.append(indata.copy())
            self.update_level_meter(indata)

        # Get the default input device
        device_info = sd.query_devices(kind='input')
        device_name = device_info['name']
        self.device_label.config(text=f"Recording from: {device_name}")

        self.stream = sd.InputStream(
            callback=audio_callback,
            channels=self.channels,
            samplerate=self.sample_rate,
            blocksize=self.chunk,
            dtype='float32'  # Use float32 for better dynamic range
        )
        self.stream.start()
        print(f"Recording from: {device_name}")

    def stop_recording(self):
        if self.is_recording:
            self.stream.stop()
            self.stream.close()
            self.is_recording = False
            self.start_button.config(state=tk.NORMAL)
            self.stop_button.config(state=tk.DISABLED)
            self.status_label.config(text="Recording stopped")
            self.save_audio()

    def save_audio(self):
        if self.audio_data:
            audio_data = np.concatenate(self.audio_data, axis=0)
            sf.write("recorded_audio.wav", audio_data, self.sample_rate, subtype='FLOAT')
            
            # Convert wav to high-quality mp3
            audio = AudioSegment.from_wav("recorded_audio.wav")
            audio = audio.set_channels(self.channels)
            audio = audio.set_frame_rate(self.sample_rate)
            audio.export("recorded_audio.mp3", format="mp3", bitrate="320k")
            
            self.status_label.config(text="Audio saved as recorded_audio.wav and .mp3")
            print("Audio saved as recorded_audio.wav and recorded_audio.mp3")

    def update_level_meter(self, indata):
        amplitude = np.max(np.abs(indata)) * 100
        self.master.after(0, self.level_meter.config, {"value": amplitude})

import sounddevice as sd

def list_audio_devices():
    devices = sd.query_devices()
    for i, device in enumerate(devices):
        if device['max_input_channels'] > 0:
            print(f"Device {i}: {device['name']}")
            print(f"  Max Input Channels: {device['max_input_channels']}")
            print(f"  Default Sample Rate: {device['default_samplerate']}")
            print()

if __name__ == "__main__":
    list_audio_devices()
    root = tk.Tk()
    app = ScreenAudioRecorder(root)
    root.mainloop()