import os
import subprocess
import uuid
import json
import shutil
from flask import Flask, request, jsonify, render_template, url_for, send_from_directory
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app)

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = os.path.join('static', 'processed')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# --- Helper Functions ---
def get_metadata(file_path):
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='utf-8', errors='ignore')
        data = json.loads(result.stdout)
        
        format_tags = data.get('format', {}).get('tags', {})
        
        # Prioritize stream tags over format tags for more specific info
        audio_stream = next((s for s in data.get('streams', []) if s.get('codec_type') == 'audio'), {})
        stream_tags = audio_stream.get('tags', {})

        return {
            'title': stream_tags.get('title', format_tags.get('title', 'Unknown Title')),
            'artist': stream_tags.get('artist', format_tags.get('artist', 'Unknown Artist')),
        }
    except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error getting metadata: {e}")
        return {'title': 'Unknown Title', 'artist': 'Unknown Artist'}

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify(error='No file part'), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify(error='No selected file'), 400

    if file:
        unique_id = uuid.uuid4().hex
        original_path = os.path.join(UPLOAD_FOLDER, file.filename)
        processed_filename = f'processed_{unique_id}.opus'
        processed_path = os.path.join(PROCESSED_FOLDER, processed_filename)
        artwork_filename = f'art_{unique_id}.jpg'
        artwork_path = os.path.join(PROCESSED_FOLDER, artwork_filename)
        
        file.save(original_path)
        
        metadata = get_metadata(original_path)

        # Extract artwork
        art_cmd = [
            'ffmpeg', '-y', '-i', original_path, '-an', '-vcodec', 'copy', 
            artwork_path
        ]
        # Use DEVNULL to discard ffmpeg's console output to avoid decode errors on Windows
        subprocess.run(art_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Transcode audio to Opus (stereo for compatibility)
        audio_cmd = [
            'ffmpeg', '-y', '-i', original_path, '-c:a', 'libopus', 
            '-b:a', '192k', '-ac', '2', '-vn', processed_path
        ]
        subprocess.run(audio_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        os.remove(original_path)

        artwork_url = url_for('static', filename=f'processed/{artwork_filename}') if os.path.exists(artwork_path) else None

        return jsonify({
            'audio_url': url_for('static', filename=f'processed/{processed_filename}'),
            'artwork_url': artwork_url,
            'metadata': metadata,
            'processed_filename': processed_filename,
            'artwork_filename': artwork_filename if os.path.exists(artwork_path) else None,
        })

@app.route('/delete_cache', methods=['POST'])
def delete_cache():
    data = request.get_json()
    files_to_delete = data.get('files', [])
    if not isinstance(files_to_delete, list):
        return jsonify(error="Invalid data format, 'files' must be a list."), 400

    for filename in files_to_delete:
        if filename:
            try:
                path = os.path.join(PROCESSED_FOLDER, filename)
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                print(f"Error deleting {filename}: {e}")
                
    return jsonify(status='success')

@app.route('/clear_processed_directory', methods=['POST'])
def clear_processed_directory():
    """Clears all files in the processed folder."""
    try:
        if os.path.exists(PROCESSED_FOLDER):
            shutil.rmtree(PROCESSED_FOLDER)
            os.makedirs(PROCESSED_FOLDER)
        return jsonify(status="success", message="Processed directory cleared."), 200
    except Exception as e:
        print(f"Error clearing processed directory: {e}")
        return jsonify(error=str(e)), 500

if __name__ == '__main__':
    socketio.run(app, debug=True)
