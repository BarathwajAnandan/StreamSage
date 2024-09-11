from flask import Flask, request, jsonify, render_template
import os
from pydub import AudioSegment
import base64
import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)

# Set up logging to a file
log_file = 'audio_recorder.log'
handler = RotatingFileHandler(log_file, maxBytes=10000, backupCount=1)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.logger.setLevel(logging.DEBUG)

SAVE_DIRECTORY = '/Users/barathwajanandan/Documents/ws/AGIHouse/StreamSage/audio'

# Create the directory if it doesn't exist
os.makedirs(SAVE_DIRECTORY, exist_ok=True)
app.logger.info(f"Save directory: {SAVE_DIRECTORY}")

@app.route('/')
def index():
    app.logger.info("Index page accessed")
    return render_template('index.html')

@app.route('/save_audio', methods=['POST'])
def save_audio():
    app.logger.info("Save audio endpoint accessed")
    try:
        audio_data = request.json['audio']
        app.logger.info("Received audio data")

        # Decode the base64 audio data
        try:
            audio_bytes = base64.b64decode(audio_data.split(',')[1])
            app.logger.info(f"Decoded audio data. Size: {len(audio_bytes)} bytes")
        except Exception as e:
            app.logger.error(f"Error decoding audio data: {str(e)}")
            return jsonify(error="Failed to decode audio data"), 400

        # Save as temporary webm file
        temp_filename = os.path.join(SAVE_DIRECTORY, 'temp_audio.webm')
        try:
            with open(temp_filename, 'wb') as f:
                f.write(audio_bytes)
            app.logger.info(f"Temporary file saved: {temp_filename}")
        except Exception as e:
            app.logger.error(f"Error saving temporary file: {str(e)}")
            return jsonify(error="Failed to save temporary file"), 500

        # Convert to mp3 and save
        try:
            audio = AudioSegment.from_file(temp_filename, format='webm')
            mp3_filename = 'recorded_audio.mp3'
            mp3_path = os.path.join(SAVE_DIRECTORY, mp3_filename)
            audio.export(mp3_path, format='mp3')
            app.logger.info(f"MP3 file saved: {mp3_path}")
        except Exception as e:
            app.logger.error(f"Error converting to MP3: {str(e)}")
            return jsonify(error="Failed to convert to MP3"), 500

        # Remove the temporary webm file
        try:
            os.remove(temp_filename)
            app.logger.info(f"Temporary file removed: {temp_filename}")
        except Exception as e:
            app.logger.warning(f"Failed to remove temporary file: {str(e)}")

        return jsonify(message=f'Audio saved successfully at {mp3_path}'), 200
    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify(error=str(e)), 500

if __name__ == '__main__':
    app.run(debug=True)