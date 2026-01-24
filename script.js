// DOM Elements
const albumsGrid = document.getElementById('albums-container');
const albumDetailView = document.getElementById('album-detail-view');
const albumDetailCover = document.getElementById('album-detail-cover');
const albumDetailTitle = document.getElementById('album-detail-title');
const albumDetailMeta = document.getElementById('album-detail-meta');
const tracksList = document.getElementById('tracks-list');
const pageTitle = document.getElementById('page-title');
const themeToggle = document.getElementById('theme-toggle');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volume-slider');
const lyricsPanel = document.getElementById('lyrics-panel');
const lyricsContainer = document.getElementById('lyrics-container');
const queuePanel = document.getElementById('queue-panel');
const queueContainer = document.getElementById('queue-container');
const lyricsBtn = document.getElementById('lyrics-btn');
const queueBtn = document.getElementById('queue-btn');
const closeLyrics = document.getElementById('close-lyrics');
const closeQueue = document.getElementById('close-queue');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const likeTrackBtn = document.getElementById('like-track-btn');
const likeAlbumBtn = document.getElementById('like-album-btn');
const playAlbumBtn = document.getElementById('play-album-btn');
const searchInput = document.getElementById('search-input');
const sortNameAscBtn = document.getElementById('sort-name-asc');
const sortNameDescBtn = document.getElementById('sort-name-desc');
const sortYearAscBtn = document.getElementById('sort-year-asc');
const sortYearDescBtn = document.getElementById('sort-year-desc');
const navLinks = document.querySelectorAll('.nav-link');
const contextMenu = document.getElementById('context-menu');
const addToQueueBtn = document.getElementById('add-to-queue-btn');
const likeFromContextBtn = document.getElementById('like-from-context-btn');
const searchResults = document.getElementById('search-results');
const searchTracksContainer = document.getElementById('search-tracks-container');
const sortOptions = document.getElementById('sort-options');
const likedSongsView = document.getElementById('liked-songs-view');
const likedTracksList = document.getElementById('liked-tracks-list');
const likedSongsCount = document.getElementById('liked-songs-count');

// Audio element
const audio = new Audio();

// Player state
let albums = [];
let isPlaying = false;
let currentTrackIndex = 0;
let currentLyricIndex = -1;
let shuffled = false;
let repeatMode = 0; // 0: off, 1: repeat all, 2: repeat one
let playlist = [];
let originalPlaylist = [];
let lyricsData = {};
let currentAlbum = null;
let likedTracks = JSON.parse(localStorage.getItem('likedTracks')) || [];
let currentView = 'home'; // home, search, liked
let sortBy = 'name-asc'; // name-asc, name-desc, year-asc, year-desc
let contextMenuTrack = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    await loadAlbums();
    renderAlbums();
    setupEventListeners();
    loadThemePreference();
    loadVolumePreference();
    
    // Set default sort to name ascending
    sortNameAscBtn.classList.add('active');
});

// Load albums from JSON
async function loadAlbums() {
    try {
        const response = await fetch('albums.json');
        albums = await response.json();
    } catch (error) {
        console.error('Error loading albums:', error);
        // Fallback to sample data
        albums = [
            {
                "id": "radiohead_ok_computer",
                "title": "OK Computer",
                "year": 1997,
                "cover": "https://placehold.co/300x300/ff6b35/ffffff?text=OK+Computer",
                "tracks": [
                    {"file":"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "title":"Airbag", "duration": 268, "lrc":"lrc/01_airbag.lrc"},
                    {"file":"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", "title":"Paranoid Android", "duration": 387, "lrc":"lrc/02_paranoid_android.lrc"}
                ]
            }
        ];
    }
}

// Render albums grid
function renderAlbums(filteredAlbums = null, sortField = sortBy) {
    const albumsToRender = filteredAlbums || albums;
    
    // Sort albums
    let sortedAlbums = [...albumsToRender];
    
    switch(sortField) {
        case 'name-asc':
            sortedAlbums.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'name-desc':
            sortedAlbums.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'year-asc':
            sortedAlbums.sort((a, b) => a.year - b.year);
            break;
        case 'year-desc':
            sortedAlbums.sort((a, b) => b.year - a.year);
            break;
        default:
            sortedAlbums.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    albumsGrid.innerHTML = '';
    
    sortedAlbums.forEach((album, index) => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card fade-in';
        albumCard.innerHTML = `
            <img src="${album.cover}" alt="${album.title}" class="album-cover">
            <div class="album-title">${album.title}</div>
            <div class="album-year">${album.year}</div>
            <div class="play-button">
                <i class="fas fa-play"></i>
            </div>
        `;
        
        albumCard.addEventListener('click', (e) => {
            if (e.target.closest('.play-button')) {
                playAlbum(album);
            } else {
                showAlbumDetail(album);
            }
        });
        
        albumsGrid.appendChild(albumCard);
    });
}

// Show album detail view
function showAlbumDetail(album) {
    currentAlbum = album;
    albumDetailView.classList.remove('hidden');
    albumsGrid.classList.add('hidden');
    searchResults.classList.add('hidden');
    likedSongsView.classList.add('hidden');
    sortOptions.classList.add('hidden');
    
    albumDetailCover.src = album.cover;
    albumDetailTitle.textContent = album.title;
    albumDetailMeta.textContent = `${album.year} • ${album.tracks.length} songs`;
    
    // Render tracks
    tracksList.innerHTML = '';
    album.tracks.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-row';
        trackRow.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info-main">
                <div class="track-title">${track.title}</div>
            </div>
            <div class="track-duration">${formatTime(track.duration)}</div>
            <div class="track-actions">
                <i class="fas fa-ellipsis-h"></i>
            </div>
        `;
        
        // Add click event for track row
        trackRow.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-ellipsis-h')) {
                // Show context menu
                showContextMenu(e, track, album);
            } else {
                // Play track
                playTrackFromAlbum(album, index);
            }
        });
        
        tracksList.appendChild(trackRow);
    });
    
    // Update like button
    const isLiked = likedTracks.includes(album.id);
    likeAlbumBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
}

// Show context menu
function showContextMenu(event, track, album) {
    event.preventDefault();
    event.stopPropagation();
    
    // Store track info for context menu actions
    contextMenuTrack = {
        track: track,
        album: album
    };
    
    // Position context menu within viewport
    const rect = event.target.getBoundingClientRect();
    const x = rect.left;
    const y = rect.bottom;
    
    // Adjust position to stay within viewport
    const menuWidth = 180;
    const menuHeight = 100;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let menuX = x;
    let menuY = y;
    
    if (x + menuWidth > windowWidth) {
        menuX = windowWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > windowHeight) {
        menuY = y - menuHeight - 10;
    }
    
    // Position context menu
    contextMenu.style.top = `${menuY}px`;
    contextMenu.style.left = `${menuX}px`;
    contextMenu.classList.remove('hidden');
    
    // Update like button in context menu
    const trackId = `${album.title}-${track.title}`;
    const isLiked = likedTracks.includes(trackId);
    likeFromContextBtn.innerHTML = isLiked ? 
        '<i class="fas fa-heart"></i> Unlike Song' : 
        '<i class="far fa-heart"></i> Like Song';
}

// Play an album
function playAlbum(album) {
    playlist = album.tracks.map(track => ({
        ...track,
        albumTitle: album.title,
        albumCover: album.cover
    }));
    originalPlaylist = JSON.parse(JSON.stringify(playlist)); // Głęboka kopia
    currentTrackIndex = 0;
    
    // Update now playing info
    document.getElementById('now-cover').src = album.cover;
    document.getElementById('now-title').textContent = album.title;
    document.getElementById('now-artist').textContent = "Full Album";
    
    // Play first track
    playTrack(0);
}

// Play a specific track from album
function playTrackFromAlbum(album, trackIndex) {
    playlist = album.tracks.map(track => ({
        ...track,
        albumTitle: album.title,
        albumCover: album.cover
    }));
    currentTrackIndex = trackIndex;
    
    // Update now playing info
    document.getElementById('now-cover').src = album.cover;
    document.getElementById('now-title').textContent = album.tracks[trackIndex].title;
    document.getElementById('now-artist').textContent = album.title;
    
    // Play track
    playTrack(trackIndex);
}

// Play a specific track
function playTrack(trackIndex) {
    if (trackIndex < 0 || trackIndex >= playlist.length) return;
    
    currentTrackIndex = trackIndex;
    const track = playlist[trackIndex];
    
    // Update now playing info
    document.getElementById('now-cover').src = track.albumCover || 'covers/default_cover.jpg';
    document.getElementById('now-title').textContent = track.title;
    document.getElementById('now-artist').textContent = track.albumTitle || 'Unknown Album';
    
    // Set audio source
    audio.src = track.file;
    audio.play();
    isPlaying = true;
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    
    // Update like button
    const isLiked = likedTracks.includes(`${track.albumTitle}-${track.title}`);
    likeTrackBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    
    // Load lyrics immediately
    loadLyrics(track.lrc).then(() => {
        // Reset lyrics and update display immediately
        currentLyricIndex = -1;
        updateLyricsDisplay();
    });
    
    // Update progress
    updateProgress();
    
    // Render queue
    renderQueue();
}


// Add track to queue
function addTrackToQueue(track, album) {
    const trackToAdd = {
        ...track,
        albumTitle: album.title,
        albumCover: album.cover
    };
    
    playlist.push(trackToAdd);
    renderQueue();
}

// Load lyrics from LRC file
function loadLyrics(lrcPath) {
    // Return promise for immediate handling
    return new Promise((resolve) => {
        if (!lrcPath) {
            lyricsData[lrcPath] = [];
            resolve();
            return;
        }
        
        // Check if lyrics already loaded
        if (lyricsData[lrcPath]) {
            resolve();
            return;
        }
        
        fetch(lrcPath)
            .then(response => response.text())
            .then(lrcText => {
                lyricsData[lrcPath] = parseLyrics(lrcText);
                resolve();
            })
            .catch(error => {
                console.error('Error loading lyrics:', error);
                lyricsData[lrcPath] = [];
                resolve();
            });
    });
}

// Parse LRC lyrics
function parseLyrics(lrcText) {
    if (!lrcText) return [];
    
    const lines = lrcText.split('\n');
    const parsedLyrics = [];
    
    lines.forEach(line => {
        if (line.trim() === '') {
            parsedLyrics.push({ time: null, text: '' });
            return;
        }
        
        const timeMatches = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g);
        const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
        
        if (timeMatches) {
            timeMatches.forEach(timeMatch => {
                const timeParts = timeMatch.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
                if (timeParts) {
                    const minutes = parseInt(timeParts[1]);
                    const seconds = parseInt(timeParts[2]);
                    const milliseconds = parseInt(timeParts[3]);
                    const totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
                    
                    parsedLyrics.push({ time: totalSeconds, text });
                }
            });
        }
    });
    
    // Sort by time
    parsedLyrics.sort((a, b) => {
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return a.time - b.time;
    });
    
    return parsedLyrics;
}

// Update lyrics display
function updateLyricsDisplay() {
    lyricsContainer.innerHTML = '';
    
    const track = playlist[currentTrackIndex];
    if (!track || !lyricsData[track.lrc]) return;
    
    const parsedLyrics = lyricsData[track.lrc];
    
    parsedLyrics.forEach((line, index) => {
        const lyricElement = document.createElement('div');
        lyricElement.className = 'lyric-line';
        lyricElement.textContent = line.text || '• • •';
        
        if (index === currentLyricIndex) {
            lyricElement.classList.add('active');
        } else if (index < currentLyricIndex) {
            lyricElement.classList.add('past');
        }
        
        lyricElement.addEventListener('click', () => {
            if (line.time !== null) {
                audio.currentTime = line.time;
            }
        });
        
        lyricsContainer.appendChild(lyricElement);
    });
}

// Format time (seconds to mm:ss)
function formatTime(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Update progress bar
function updateProgress() {
    if (!isPlaying) return;
    
    const percent = (audio.currentTime / audio.duration) * 100;
    progress.style.width = `${percent || 0}%`;
    
    // Update time displays
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(audio.duration || 0);
    
    // Aktualizuj tekst częściej dla lepszej synchronizacji
    updateLyricsForTime(audio.currentTime);
    
    requestAnimationFrame(updateProgress);
}

// Update lyrics based on current time
function updateLyricsForTime(currentTime) {
    const track = playlist[currentTrackIndex];
    if (!track || !lyricsData[track.lrc]) return;
    
    const parsedLyrics = lyricsData[track.lrc];
    let newIndex = -1;
    
    // Znajdź aktualną linię tekstu z dokładnością do 0.5 sekundy
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time !== null && 
            parsedLyrics[i].time <= currentTime && 
            (i === parsedLyrics.length - 1 || parsedLyrics[i + 1].time > currentTime)) {
            newIndex = i;
            break;
        }
    }
    
    // Jeśli nie znaleziono i czas jest większy niż ostatnia linia
    if (newIndex === -1 && parsedLyrics.length > 0) {
        const lastLine = parsedLyrics[parsedLyrics.length - 1];
        if (lastLine.time !== null && currentTime >= lastLine.time) {
            newIndex = parsedLyrics.length - 1;
        }
    }
    
    if (newIndex !== currentLyricIndex) {
        currentLyricIndex = newIndex;
        updateLyricsDisplay();
        
        // Auto-scroll do aktywnej linii
        const activeLine = document.querySelector('.lyric-line.active');
        if (activeLine && newIndex !== -1) {
            activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Render queue with drag and drop
function renderQueue() {
    queueContainer.innerHTML = '';
    
    playlist.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-row';
        
        // Blokuj drag dla aktualnie granej piosenki
        if (index !== currentTrackIndex) {
            trackRow.draggable = true;
            trackRow.dataset.index = index;
        } else {
            trackRow.style.cursor = 'not-allowed';
            trackRow.style.opacity = '0.7';
        }
        
        trackRow.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info-main">
                <div class="track-title">${track.title}</div>
                <div class="track-artist">${track.albumTitle}</div>
            </div>
            <div class="track-duration">${formatTime(track.duration)}</div>
        `;
        
        if (index === currentTrackIndex) {
            trackRow.style.borderLeft = '3px solid var(--color-accent)';
        }
        
        // Dodaj event listenery tylko dla pozycji, które można przeciągać
        if (index !== currentTrackIndex) {
            trackRow.addEventListener('dragstart', handleDragStart);
            trackRow.addEventListener('dragover', handleDragOver);
            trackRow.addEventListener('drop', handleDrop);
            trackRow.addEventListener('dragenter', handleDragEnter);
            trackRow.addEventListener('dragleave', handleDragLeave);
        }
        
        trackRow.addEventListener('click', () => {
            if (index !== currentTrackIndex) {
                playTrack(index);
            }
        });
        
        queueContainer.appendChild(trackRow);
    });
}

// Drag and drop functions
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);
        
        // Blokuj przenoszenie aktualnie granej piosenki
        if (fromIndex === currentTrackIndex || toIndex === currentTrackIndex) {
            return false;
        }
        
        // Move item in playlist array
        const movedItem = playlist.splice(fromIndex, 1)[0];
        playlist.splice(toIndex, 0, movedItem);
        
        // Update current track index if needed
        if (fromIndex < currentTrackIndex && toIndex >= currentTrackIndex) {
            currentTrackIndex--;
        } else if (fromIndex > currentTrackIndex && toIndex <= currentTrackIndex) {
            currentTrackIndex++;
        }
        
        // Update indices for ALL rows
        const trackRows = document.querySelectorAll('.track-row');
        trackRows.forEach((row, index) => {
            row.dataset.index = index;
        });
        
        // Re-render queue
        renderQueue();
    }
    
    return false;
}

// Render liked songs (same structure as album view)
function renderLikedSongs() {
    likedSongsView.classList.remove('hidden');
    albumsGrid.classList.add('hidden');
    albumDetailView.classList.add('hidden');
    searchResults.classList.add('hidden');
    sortOptions.classList.add('hidden');
    
    const likedSongElements = [];
    
    // Find all liked tracks
    likedTracks.forEach(trackId => {
        // Find the track in albums
        albums.forEach(album => {
            album.tracks.forEach(track => {
                const fullTrackId = `${album.title}-${track.title}`;
                if (fullTrackId === trackId) {
                    likedSongElements.push({
                        track: track,
                        album: album
                    });
                }
            });
        });
    });
    
    // Update count
    likedSongsCount.textContent = `${likedSongElements.length} songs`;
    
    // Render tracks
    likedTracksList.innerHTML = '';
    
    likedSongElements.forEach((item, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-row';
        trackRow.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <img src="${item.album.cover}" alt="${item.album.title}" class="track-mini-cover">
            <div class="track-info-main">
                <div class="track-title">${item.track.title}</div>
                <div class="track-artist">${item.album.title}</div>
            </div>
            <div class="track-duration">${formatTime(item.track.duration)}</div>
            <div class="track-actions">
                <i class="fas fa-ellipsis-h"></i>
            </div>
        `;
        
        trackRow.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-ellipsis-h')) {
                // Show context menu
                showContextMenu(e, item.track, item.album);
            } else {
                // Play track
                playTrackFromAlbum(item.album, item.album.tracks.indexOf(item.track));
            }
        });
        
        likedTracksList.appendChild(trackRow);
    });
}

// Render search results
function renderSearchResults(searchTerm) {
    const results = [];
    
    // Search in albums
    albums.forEach(album => {
        if (album.title.toLowerCase().includes(searchTerm)) {
            results.push({
                type: 'album',
                item: album
            });
        }
        
        // Search in tracks
        album.tracks.forEach(track => {
            if (track.title.toLowerCase().includes(searchTerm)) {
                results.push({
                    type: 'track',
                    item: track,
                    album: album
                });
            }
        });
    });
    
    searchTracksContainer.innerHTML = '';
    
    if (results.length === 0) {
        searchTracksContainer.innerHTML = '<p>No results found.</p>';
        return;
    }
    
    results.forEach(result => {
        if (result.type === 'album') {
            const album = result.item;
            const albumItem = document.createElement('div');
            albumItem.className = 'search-track-item';
            albumItem.innerHTML = `
                <img src="${album.cover}" alt="${album.title}" class="search-track-cover">
                <div class="search-track-info">
                    <div class="search-track-title">${album.title} (Album)</div>
                    <div class="search-track-album">${album.year} • ${album.tracks.length} songs</div>
                </div>
            `;
            
            albumItem.addEventListener('click', () => {
                showAlbumDetail(album);
            });
            
            searchTracksContainer.appendChild(albumItem);
        } else {
            const track = result.item;
            const album = result.album;
            const trackItem = document.createElement('div');
            trackItem.className = 'search-track-item';
            trackItem.innerHTML = `
                <img src="${album.cover}" alt="${album.title}" class="search-track-cover">
                <div class="search-track-info">
                    <div class="search-track-title">${track.title}</div>
                    <div class="search-track-album">${album.title}</div>
                </div>
                <div class="search-track-duration">${formatTime(track.duration)}</div>
            `;
            
            trackItem.addEventListener('click', () => {
                playTrackFromAlbum(album, album.tracks.indexOf(track));
            });
            
            searchTracksContainer.appendChild(trackItem);
        }
    });
}

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeToggle.innerHTML = isLight ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
    });
    
    // Play/Pause button
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        isPlaying = !isPlaying;
        playPauseBtn.innerHTML = isPlaying ? 
            '<i class="fas fa-pause"></i>' : 
            '<i class="fas fa-play"></i>';
        
        if (isPlaying) {
            updateProgress();
        }
    });
    
    // Next button
    nextBtn.addEventListener('click', () => {
        if (currentTrackIndex < playlist.length - 1) {
            playTrack(currentTrackIndex + 1);
        } else if (repeatMode === 1) {
            playTrack(0);
        }
    });
    
    // Previous button
    prevBtn.addEventListener('click', () => {
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
        } else if (currentTrackIndex > 0) {
            playTrack(currentTrackIndex - 1);
        } else if (repeatMode === 1) {
            playTrack(playlist.length - 1);
        }
    });
    
    // Progress bar click - poprawiona synchronizacja
    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pos * audio.duration;
        
        // Natychmiastowa aktualizacja tekstu po zmianie pozycji
        setTimeout(() => {
            updateLyricsForTime(audio.currentTime);
        }, 10);
    });


    
    // Volume slider
    volumeSlider.addEventListener('input', () => {
        audio.volume = volumeSlider.value / 100;
        localStorage.setItem('volume', volumeSlider.value);
    });
    
    // Lyrics panel
    lyricsBtn.addEventListener('click', () => {
        if (lyricsPanel.classList.contains('active')) {
            lyricsPanel.classList.remove('active');
        } else {
            lyricsPanel.classList.add('active');
            queuePanel.classList.remove('active');
        }
    });
    
    // Queue panel
    queueBtn.addEventListener('click', () => {
        if (queuePanel.classList.contains('active')) {
            queuePanel.classList.remove('active');
        } else {
            queuePanel.classList.add('active');
            lyricsPanel.classList.remove('active');
        }
    });
    
    closeLyrics.addEventListener('click', () => {
        lyricsPanel.classList.remove('active');
    });
    
    closeQueue.addEventListener('click', () => {
        queuePanel.classList.remove('active');
    });
    
    // Shuffle button
    shuffleBtn.addEventListener('click', () => {
        shuffled = !shuffled;
        shuffleBtn.style.color = shuffled ? 'var(--color-accent)' : '';
        
        if (shuffled && playlist.length > 1) {
            // Save current track
            const currentTrack = playlist[currentTrackIndex];
            
            // Get remaining tracks (excluding current)
            let remainingTracks;
            if (currentTrackIndex === 0) {
                remainingTracks = playlist.slice(1);
            } else if (currentTrackIndex === playlist.length - 1) {
                remainingTracks = playlist.slice(0, -1);
            } else {
                remainingTracks = [...playlist.slice(0, currentTrackIndex), ...playlist.slice(currentTrackIndex + 1)];
            }
            
            // Shuffle remaining tracks
            for (let i = remainingTracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
            }
            
            // Rebuild playlist with current track at position 0
            playlist = [currentTrack, ...remainingTracks];
            currentTrackIndex = 0;
            
            // Update queue display
            renderQueue();
        } else if (!shuffled && originalPlaylist.length > 0) {
            // Restore original order but keep current track playing
            const currentTrackTitle = playlist[currentTrackIndex].title;
            const currentTrackAlbum = playlist[currentTrackIndex].albumTitle;
            
            playlist = JSON.parse(JSON.stringify(originalPlaylist));
            
            // Find new index of current track
            const newIndex = playlist.findIndex(track => 
                track.title === currentTrackTitle && 
                track.albumTitle === currentTrackAlbum
            );
            
            if (newIndex !== -1) {
                currentTrackIndex = newIndex;
            }
            
            renderQueue();
        }
    });

    
    // Repeat button
    repeatBtn.addEventListener('click', () => {
        repeatMode = (repeatMode + 1) % 3;
        const icons = ['fa-repeat', 'fa-repeat', 'fa-redo'];
        const titles = ['Repeat Off', 'Repeat All', 'Repeat One'];
        repeatBtn.innerHTML = `<i class="fas ${icons[repeatMode]}"></i>`;
        repeatBtn.title = titles[repeatMode];
        repeatBtn.style.color = repeatMode > 0 ? 'var(--color-accent)' : '';
    });
    
    // Like track button
    likeTrackBtn.addEventListener('click', () => {
        const track = playlist[currentTrackIndex];
        if (!track) return;
        
        const trackId = `${track.albumTitle}-${track.title}`;
        const isLiked = likedTracks.includes(trackId);
        
        if (isLiked) {
            likedTracks = likedTracks.filter(id => id !== trackId);
            likeTrackBtn.innerHTML = '<i class="far fa-heart"></i>';
        } else {
            likedTracks.push(trackId);
            likeTrackBtn.innerHTML = '<i class="fas fa-heart"></i>';
        }
        
        localStorage.setItem('likedTracks', JSON.stringify(likedTracks));
    });
    
    // Play album button
    playAlbumBtn.addEventListener('click', () => {
        if (currentAlbum) {
            playAlbum(currentAlbum);
        }
    });
    
    // Search input
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm === '') {
            searchResults.classList.add('hidden');
            if (currentView === 'search') {
                searchTracksContainer.innerHTML = '';
            }
            return;
        }
        
        if (currentView !== 'search') {
            // Switch to search view
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelector('[data-view="search"]').classList.add('active');
            currentView = 'search';
            pageTitle.textContent = 'Search';
            albumsGrid.classList.add('hidden');
            albumDetailView.classList.add('hidden');
            likedSongsView.classList.add('hidden');
            searchResults.classList.remove('hidden');
            sortOptions.classList.add('hidden');
        }
        
        renderSearchResults(searchTerm);
    });
    
    // Sort buttons
    sortNameAscBtn.addEventListener('click', () => {
        sortBy = 'name-asc';
        updateSortButtons();
        renderAlbums(null, 'name-asc');
    });
    
    sortNameDescBtn.addEventListener('click', () => {
        sortBy = 'name-desc';
        updateSortButtons();
        renderAlbums(null, 'name-desc');
    });
    
    sortYearAscBtn.addEventListener('click', () => {
        sortBy = 'year-asc';
        updateSortButtons();
        renderAlbums(null, 'year-asc');
    });
    
    sortYearDescBtn.addEventListener('click', () => {
        sortBy = 'year-desc';
        updateSortButtons();
        renderAlbums(null, 'year-desc');
    });
    
    // Navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update view
            currentView = link.dataset.view;
            
            if (currentView === 'liked') {
                renderLikedSongs();
                pageTitle.textContent = 'Liked Songs';
            } else if (currentView === 'search') {
                pageTitle.textContent = 'Search';
                searchResults.classList.remove('hidden');
                albumsGrid.classList.add('hidden');
                albumDetailView.classList.add('hidden');
                likedSongsView.classList.add('hidden');
                sortOptions.classList.add('hidden');
                searchTracksContainer.innerHTML = '';
            } else {
                pageTitle.textContent = 'Home';
                albumsGrid.classList.remove('hidden');
                albumDetailView.classList.add('hidden');
                searchResults.classList.add('hidden');
                likedSongsView.classList.add('hidden');
                sortOptions.classList.remove('hidden');
                renderAlbums();
            }
        });
    });
    
    // Context menu actions
    addToQueueBtn.addEventListener('click', () => {
        if (contextMenuTrack) {
            addTrackToQueue(contextMenuTrack.track, contextMenuTrack.album);
            contextMenu.classList.add('hidden');
        }
    });
    
    likeFromContextBtn.addEventListener('click', () => {
        if (contextMenuTrack) {
            const trackId = `${contextMenuTrack.album.title}-${contextMenuTrack.track.title}`;
            const isLiked = likedTracks.includes(trackId);
            
            if (isLiked) {
                likedTracks = likedTracks.filter(id => id !== trackId);
            } else {
                likedTracks.push(trackId);
            }
            
            localStorage.setItem('likedTracks', JSON.stringify(likedTracks));
            contextMenu.classList.add('hidden');
            
            // Update UI if needed
            if (currentView === 'liked') {
                renderLikedSongs();
            }
        }
    });
    
    // Close context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && e.target !== contextMenu) {
            contextMenu.classList.add('hidden');
        }
    });
    
    // Audio events
    audio.addEventListener('ended', () => {
        if (repeatMode === 2) {
            playTrack(currentTrackIndex);
        } else if (currentTrackIndex < playlist.length - 1) {
            playTrack(currentTrackIndex + 1);
        } else if (repeatMode === 1) {
            playTrack(0);
        } else {
            isPlaying = false;
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    });
    
    audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audio.duration);
    });
}

// Update sort buttons active state
function updateSortButtons() {
    // Remove active class from all buttons
    sortNameAscBtn.classList.remove('active');
    sortNameDescBtn.classList.remove('active');
    sortYearAscBtn.classList.remove('active');
    sortYearDescBtn.classList.remove('active');
    
    // Add active class to current sort button
    switch(sortBy) {
        case 'name-asc':
            sortNameAscBtn.classList.add('active');
            break;
        case 'name-desc':
            sortNameDescBtn.classList.add('active');
            break;
        case 'year-asc':
            sortYearAscBtn.classList.add('active');
            break;
        case 'year-desc':
            sortYearDescBtn.classList.add('active');
            break;
    }
}

// Load theme preference
function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// Load volume preference
function loadVolumePreference() {
    const savedVolume = localStorage.getItem('volume') || '80';
    volumeSlider.value = savedVolume;
    audio.volume = savedVolume / 100;
}

// Close album detail view
function closeAlbumDetail() {
    albumDetailView.classList.add('hidden');
    albumsGrid.classList.remove('hidden');
    sortOptions.classList.remove('hidden');
    
    if (currentView === 'search') {
        searchResults.classList.remove('hidden');
    }
}

// Add close button functionality for album detail
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !albumDetailView.classList.contains('hidden')) {
        closeAlbumDetail();
    }
});

// Mobile menu toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('active');
});

// Close menu when clicking nav link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.remove('active');
    });
});

// Volume mute/unmute functionality
let isMuted = false;
let previousVolume = 80;

document.querySelector('.fa-volume-up').addEventListener('click', function() {
    if (!isMuted) {
        // Wycisz
        previousVolume = volumeSlider.value;
        audio.volume = 0;
        volumeSlider.value = 0;
        this.className = 'fas fa-volume-mute';
        isMuted = true;
        volumeSlider.classList.add('muted'); // Dodaj klasę muted
    } else {
        // Przywróć
        audio.volume = previousVolume / 100;
        volumeSlider.value = previousVolume;
        this.className = 'fas fa-volume-up';
        isMuted = false;
        volumeSlider.classList.remove('muted'); // Usuń klasę muted
    }
});
