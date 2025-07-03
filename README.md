# Liquid Glass Music Player

A beautiful, immersive web-based music player that presents album art with a stunning "liquid glass" effect. It features a minimalist interface, real-time audio processing on the backend, and a fluid, distorted background that reflects the song's artwork.

![Screenshot](https://user-images.githubusercontent.com/example.png) <!-- Placeholder for a screenshot -->

## Features

- **Liquid Glass UI**: A semi-transparent player with a blurred and distorted background based on the song's album art, created using CSS and SVG filters.
- **File-based Playback**: Upload your local audio or video files to play.
- **Automatic Metadata & Artwork Extraction**: Uses FFmpeg/FFprobe on the backend to automatically extract the song title, artist, and album art.
- **Optimized for Web**: Transcodes various audio formats into the web-friendly Opus codec on the fly.
- **Keyboard Controls**: Control playback (`Space` for Play/Pause, `R` for Restart) and UI (`F` for Fullscreen, `H` to hide controls).
- **Automatic Cache Management**: The server-side cache for processed audio and artwork is cleared automatically on page load and after playback.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Python (Flask)
- **Audio/Video Processing**: FFmpeg, FFprobe

## How to Run Locally

### Prerequisites

- Python 3.x
- Flask (`pip install Flask`)
- Flask-SocketIO (`pip install Flask-SocketIO`)
- FFmpeg: You must have FFmpeg installed and accessible from your system's PATH. You can download it from [ffmpeg.org](https://ffmpeg.org/download.html).

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/chyinan/liquid-glass-music-player
    cd liquid-glass-music-player
    ```

2.  **Install Python dependencies:**
    It's recommended to use a virtual environment.
    ```bash
    # Create and activate a virtual environment (optional but recommended)
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

    # Install dependencies from requirements.txt
    pip install -r requirements.txt
    ```

3.  **Run the application:**
    ```bash
    python app.py
    ```

4.  **Open your browser** and navigate to `http://127.0.0.1:5000`.

## How It Works

1.  **File Upload**: The user selects an audio or video file from their local machine.
2.  **Backend Processing**: The Flask server receives the file.
    - **Metadata Extraction**: `ffprobe` extracts metadata like title and artist.
    - **Artwork Extraction**: `ffmpeg` extracts the embedded album art and saves it as a JPG.
    - **Audio Transcoding**: `ffmpeg` transcodes the audio stream into the highly compatible Opus format (`.opus`) while downmixing to stereo for broader browser support.
3.  **Frontend Playback**: The server sends back URLs for the processed audio and artwork, along with the metadata.
    - The JavaScript frontend populates the UI with the song info and artwork.
    - The `<audio>` element plays the processed `.opus` file.
    - The UI dynamically applies the "liquid glass" effect using the extracted artwork and SVG filters.
4.  **Cache Handling**: Processed files are stored in the `static/processed` directory. This directory is automatically cleared when the web page is reloaded, and individual song caches are deleted after playback ends or when a new song is uploaded. 