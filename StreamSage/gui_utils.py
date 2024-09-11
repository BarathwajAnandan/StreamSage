import tkinter as tk
from tkinter import ttk
import subprocess
import os
import time
from pynput import keyboard
import sounddevice as sd
import soundfile as sf
import numpy as np
from pydub import AudioSegment
import threading
import pygame
import sys

def check_mic_volume_macos():
    try:
        result = subprocess.run(
            ["osascript", "-e", "input volume of (get volume settings)"],
            capture_output=True,
            text=True,
            check=True
        )
        return int(result.stdout.strip())
    except subprocess.CalledProcessError as e:
        print(f"Error getting microphone volume: {e}")
        return None

# Example usage
volume = check_mic_volume_macos()
if volume is not None:
    print(f"Current microphone volume: {volume}%")

class MicMuteApp:
    def __init__(self, master=None, file_to_watch=None):
        self.master = master
        self.file_to_watch = file_to_watch
        if self.file_to_watch:
            self.last_modified_time = os.path.getmtime(self.file_to_watch)
        
        # Read initial mic volume
        initial_volume = check_mic_volume_macos()
        self.muted = initial_volume == 0 if initial_volume is not None else False
        
        # Recording attributes
        self.is_recording = False
        self.audio_data = []
        self.sample_rate = 144000
        self.channels = 1
        self.chunk = 1024
        
        self.voice_enabled = tk.BooleanVar(value=True)  # Initialize with voice enabled
        
        if master:
            self.setup_gui(master)
        
        # Set up global hotkeys
        if sys.platform == 'darwin':  # macOS
            self.listener = keyboard.GlobalHotKeys({
                '<ctrl>+<cmd>+<shift>+<space>': self.toggle_recording,
                '<ctrl>+<cmd>+<shift>+m': self.toggle_mute
            })
        else:  # Windows, Linux, etc.
            self.listener = keyboard.GlobalHotKeys({
                '<ctrl>+<shift>+<space>': self.toggle_recording,
                '<ctrl>+<shift>+m': self.toggle_mute
            })
        self.listener.start()

    def setup_gui(self, master):
        master.title("Mic Mute and Record App")

        main_frame = tk.Frame(master)
        main_frame.pack(side=tk.LEFT, padx=10, pady=10)

        self.label = tk.Label(main_frame, text="Mic: Muted" if self.muted else "Mic: Unmuted", font=("Arial", 14))
        self.label.config(fg="red" if self.muted else "green")
        self.label.pack(pady=20)

        mute_hotkey = "Ctrl+Cmd+Shift+M" if sys.platform == 'darwin' else "Ctrl+Shift+M"
        self.button = tk.Button(main_frame, text=f"Toggle Mute ({mute_hotkey})", command=self.toggle_mute)
        self.button.pack(pady=10)

        # Add recording button
        record_hotkey = "Ctrl+Cmd+Shift+Space" if sys.platform == 'darwin' else "Ctrl+Shift+Space"
        self.record_button = ttk.Button(main_frame, text=f"Toggle Recording ({record_hotkey})", command=self.toggle_recording)
        self.record_button.pack(pady=10)

        self.status_label = ttk.Label(main_frame, text="Ready to record", font=('Helvetica', 10))
        self.status_label.pack(pady=5)

        self.device_label = ttk.Label(main_frame, text="", font=('Helvetica', 10))
        self.device_label.pack(pady=5)

        self.level_meter = ttk.Progressbar(main_frame, orient="horizontal", length=200, mode="determinate")
        self.level_meter.pack(pady=10)

        # Add Voice Enable/Disable checkbox
        self.voice_checkbox = ttk.Checkbutton(main_frame, text="Enable Voice", variable=self.voice_enabled, command=self.toggle_voice)
        self.voice_checkbox.pack(pady=10)

        self.output_text = tk.Text(master, wrap=tk.WORD, width=40, height=15)
        self.output_text.pack(side=tk.RIGHT, padx=10, pady=10)

    def toggle_mute(self):
        self.muted = not self.muted
        if self.muted:
            subprocess.run(["osascript", "-e", "set volume input volume 0"])
            if hasattr(self, 'label'):
                self.label.config(text="Mic: Muted", fg="red")
            self.log("Microphone muted")
        else:
            subprocess.run(["osascript", "-e", "set volume input volume 100"])
            if hasattr(self, 'label'):
                self.label.config(text="Mic: Unmuted", fg="green")
            self.log("Microphone unmuted")

    def toggle_recording(self):
        if self.is_recording:
            self.stop_recording()
        else:
            self.start_recording()

    def toggle_voice(self):
        is_enabled = self.voice_enabled.get()
        self.log(f"Voice output {'enabled' if is_enabled else 'disabled'}")

    def log(self, message):
        print(message)  # Always print to console
        if hasattr(self, 'output_text'):
            self.output_text.insert(tk.END, message + "\n")
            self.output_text.see(tk.END)

    def check_file_modification(self):
        if not self.file_to_watch:
            return
        current_modified_time = os.path.getmtime(self.file_to_watch)
        if current_modified_time != self.last_modified_time:
            self.last_modified_time = current_modified_time
            self.log("File modified")
            if self.muted:
                self.toggle_mute()  # Unmute the mic
            if self.master:
                self.master.attributes('-topmost', True)
                self.master.lift()
                self.master.focus_force()
                self.master.update()
                
                # Attempt to bring window to foreground on macOS
                try:
                    import AppKit
                    AppKit.NSApplication.sharedApplication().activateIgnoringOtherApps_(True)
                except ImportError:
                    pass  # AppKit not available, skip this step
            
            # Ensure the mic is unmuted
            subprocess.run(["osascript", "-e", "set volume input volume 100"])
            self.muted = False
            if hasattr(self, 'label'):
                self.label.config(text="Mic: Unmuted", fg="green")
            self.log("Microphone unmuted")
        
        if self.master:
            self.master.after(1000, self.check_file_modification)

    def start_recording(self):
        if not self.is_recording:
            self.is_recording = True
            self.audio_data = []
            self.record_button.config(text="Stop Recording")
            self.status_label.config(text="Recording...")

            def audio_callback(indata, frames, time, status):
                if status:
                    print(f"Error in audio stream: {status}")
                self.audio_data.append(indata.copy())
                self.update_level_meter(indata)

            self.stream = sd.InputStream(
                callback=audio_callback,
                channels=self.channels,
                samplerate=self.sample_rate,
                blocksize=self.chunk,
                dtype='float32'
            )
            self.stream.start()
            self.log("Recording started")

    def stop_recording(self):
        if self.is_recording:
            self.stream.stop()
            self.stream.close()
            self.is_recording = False
            self.record_button.config(text="Start Recording")
            self.status_label.config(text="Recording stopped")
            self.save_audio()
            self.log("Recording stopped")

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
            self.log("Audio saved as recorded_audio.wav and recorded_audio.mp3")

    def update_level_meter(self, indata):
        amplitude = np.max(np.abs(indata)) * 100
        self.master.after(0, self.level_meter.config, {"value": amplitude})

def run_standalone():
    root = tk.Tk()
    app = MicMuteApp(root, "/Users/barathwajanandan/Downloads/recorded_audio.mp3")
    root.attributes('-topmost', True)
    
    # Set window size
    window_width, window_height = 500, 500
    
    # Get screen dimensions
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    
    # Calculate position for top right corner
    x = screen_width - window_width - 20  # 20 pixels padding from the right edge
    y = 40  # 40 pixels from the top to account for the menu bar on macOS
    
    # Set window geometry
    root.geometry(f'{window_width}x{window_height}+{x}+{y}')
    
    def keep_on_top():
        root.attributes('-topmost', True)
        root.after(100, keep_on_top)
    
    keep_on_top()
    
    # Force the window to the top right corner
    root.update_idletasks()
    root.geometry(f'+{x}+{y}')
    
    app.check_file_modification()
    root.mainloop()

if __name__ == "__main__":
    run_standalone()