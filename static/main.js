document.addEventListener('DOMContentLoaded', async () => {
    // Clear server cache on every page load
    await clearProcessedCacheOnLoad();
    
    // === DOM Element References ===
    const fileInput = document.getElementById('fileInput');
    const audio = document.getElementById('audioPlayer');

    const backgroundBlur = document.getElementById('background-blur');
    const fileSelectContainer = document.querySelector('.file-select-container');
    
    const playerWrapper = document.getElementById('player-wrapper');
    const distortedBg = document.getElementById('player-ui-distorted-bg');
    const playerUIGlass = document.getElementById('player-ui-glass');
    
    const albumArt = document.getElementById('albumArt');
    const artistNameEl = document.getElementById('artistName');
    const songTitleEl = document.getElementById('songTitle');

    const progressBarFill = document.getElementById('progress-bar-fill');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // === State Variables ===
    let isPlaying = false;
    let hasStartedPlayback = false; // Flag to prevent looping
    let isUIVisible = true;
    let isInFullscreen = false;
    let isMinimalMode = false;
    let artworkUrl = null;
    let currentProcessedFile = null;
    let currentArtworkFile = null;
    let mouseHideTimer;
    
    // === Core Logic: File Upload & Processing ===
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        await deleteCurrentCache();
        loadingOverlay.style.opacity = '1';
        loadingOverlay.style.pointerEvents = 'auto';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }
            const data = await response.json();
            
            artworkUrl = data.artwork_url || null;
            currentProcessedFile = data.processed_filename || null;
            currentArtworkFile = data.artwork_filename || null;
            
            artistNameEl.textContent = data.metadata.artist;
            songTitleEl.textContent = data.metadata.title;
            
            audio.src = data.audio_url;
            audio.crossOrigin = "anonymous";
            
            hasStartedPlayback = false; // Reset flag for the new song
            audio.load();

            if (artworkUrl) {
                backgroundBlur.style.backgroundImage = `url(${artworkUrl})`;
                distortedBg.style.backgroundImage = `url(${artworkUrl})`;
                backgroundBlur.classList.add('active');
                albumArt.src = artworkUrl;
                albumArt.style.display = 'block';
            } else {
                backgroundBlur.style.backgroundImage = 'none';
                distortedBg.style.backgroundImage = 'none';
                backgroundBlur.classList.remove('active');
                albumArt.src = '';
                albumArt.style.display = 'none';
            }
            
            fileSelectContainer.style.display = 'none';
            playerWrapper.classList.remove('hidden');
            
            resetUIForNewSong();

        } catch (error) {
            console.error('Error processing audio:', error);
            alert(`Error: ${error.message}`);
        } finally {
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.pointerEvents = 'none';
        }
    });

    // === Audio Playback Handling ===
    function playAudio() { audio.play(); }
    function pauseAudio() { audio.pause(); }

    audio.addEventListener('play', () => { isPlaying = true; });
    audio.addEventListener('pause', () => { isPlaying = false; });

    audio.addEventListener('ended', async () => {
        pauseAudio();
        audio.currentTime = 0;
        await deleteCurrentCache();
    });

    audio.addEventListener('canplay', () => {
        if (!hasStartedPlayback) {
            playAudio();
            hasStartedPlayback = true;
        }
    });
    
    audio.addEventListener('loadedmetadata', () => {
        if (isFinite(audio.duration)) {
            durationEl.textContent = formatTime(audio.duration);
        }
    });

    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        currentTimeEl.textContent = formatTime(currentTime);
        const progress = audio.duration ? (currentTime / audio.duration) * 100 : 0;
        if (progressBarFill) {
            progressBarFill.style.width = `${progress}%`;
        }
    });

    // === Keyboard Shortcuts & UI Toggles ===
    function toggleUIVisibility() {
        isUIVisible = !isUIVisible;
        const elementsToToggle = document.querySelectorAll('.setting-item'); 
        elementsToToggle.forEach(el => {
            if (isUIVisible) el.classList.remove('ui-hidden');
            else el.classList.add('ui-hidden');
        });
    }

    function handleKeyPress(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        const key = event.key.toLowerCase();
        switch (key) {
            case 'h': toggleUIVisibility(); break;
            case ' ': if (audio.src) isPlaying ? pauseAudio() : playAudio(); break;
            case 'r': if (audio.src) { audio.currentTime = 0; if (!isPlaying) playAudio(); } break;
            case 'f': toggleFullscreen(); break;
            case 'v': toggleMinimalView(); break;
            default: return;
        }
        event.preventDefault();
    }
    document.addEventListener('keydown', handleKeyPress);

    // === Fullscreen Handling ===
    function toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    }
    
    function handleFullscreenChange() {
        isInFullscreen = !!document.fullscreenElement;
        if (isInFullscreen) {
            resetMouseHideTimer();
            document.addEventListener('mousemove', resetMouseHideTimer);
        } else {
            showCursor();
            clearTimeout(mouseHideTimer);
            document.removeEventListener('mousemove', resetMouseHideTimer);
        }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    function hideCursor() { document.body.style.cursor = 'none'; }
    function showCursor() { document.body.style.cursor = 'default'; }
    function resetMouseHideTimer() {
        if (isInFullscreen) {
            showCursor();
            clearTimeout(mouseHideTimer);
            mouseHideTimer = setTimeout(hideCursor, 3000);
        }
    }
    
    // === Minimal View Toggle ===
    function toggleMinimalView() {
        isMinimalMode = !isMinimalMode;
        playerUIGlass.classList.toggle('minimal-mode', isMinimalMode);
        
        // Also toggle container class for width override
        const container = document.querySelector('.container');
        if (container) {
            container.classList.toggle('minimal-active', isMinimalMode);
        }
        
        // Also toggle player wrapper class for width override
        if (playerWrapper) {
            playerWrapper.classList.toggle('minimal-active', isMinimalMode);
        }
    }

    // === Utility Functions ===
    async function clearProcessedCacheOnLoad() {
        try {
            const response = await fetch('/clear_processed_directory', { method: 'POST' });
            if (!response.ok) {
                console.error('Failed to clear server cache on page load.');
            } else {
                console.log('Processed cache cleared on page load.');
            }
        } catch (error) {
            console.error('Error calling cache clearing endpoint:', error);
        }
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function resetUIForNewSong() {
        currentTimeEl.textContent = '00:00';
        if (audio.duration) durationEl.textContent = formatTime(audio.duration);
        else durationEl.textContent = '00:00';
    }

    async function deleteCurrentCache() {
        const files = [];
        if (currentProcessedFile) files.push(currentProcessedFile);
        if (currentArtworkFile) files.push(currentArtworkFile);
        if (files.length === 0) return;
        try {
            await fetch('/delete_cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files })
            });
        } catch (err) { console.error('Failed to delete cache', err); }
        currentProcessedFile = null;
        currentArtworkFile = null;
    }
});