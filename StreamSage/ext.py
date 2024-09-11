from flask import Flask, request, jsonify
import os
import base64
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SAVE_DIRECTORY = '/Users/barathwajanandan/Documents/ws/AGIHouse/audio'
os.makedirs(SAVE_DIRECTORY, exist_ok=True)

@app.route('/')
def home():
    return "Server is running. Use /save_audio to save audio."

@app.route('/save_audio', methods=['POST'])
def save_audio():
    app.logger.info("Save audio endpoint accessed")
    app.logger.info(f"Request data: {request.data}")
    try:
        audio_data = request.json['audio']
        audio_bytes = base64.b64decode(audio_data.split(',')[1])
        
        filename = 'recorded_audio.webm'
        file_path = os.path.join(SAVE_DIRECTORY, filename)
        
        with open(file_path, 'wb') as f:
            f.write(audio_bytes)
        
        return jsonify({"message": f"Audio saved successfully at {file_path}"}), 200
    except Exception as e:
        app.logger.error(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)