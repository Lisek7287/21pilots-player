// app.js — pełna, dopieszczona wersja (animLock, AbortController, LRC offset, mediaSession, preloadNext, spinner, error handling)

let albumsData = [];
let currentAlbum = null;
let queue = [];
let currentTrack = null;
let lyrics = []; // {time, text}
let lrcOffsetMs = Number(localStorage.getItem('lrcOffset') || 0);
let liked = loadLiked();
let animLock = false;
let currentLrcController = null;

// ELEMENTS
const albumsView = document.getElementById('albumsView');
const tracksView = document.getElementById('tracksView');
const playerView = document.getElementById('playerView');

const albumsGrid = document.getElementById('albumsGrid');
const errorMsg = document.getElementById('errorMsg');

const backFromTracks = document.getElementById('backFromTracks');
const backFromPlayer = document.getElementById('backFromPlayer');
const albumTitle = document.getElementById('albumTitle');
const albumMeta = document.getElementById('albumMeta');
const tracksList = document.getElementById('tracksList');
const tracksCoverImg = document.getElementById('tracksCoverImg');

const coverImg = document.getElementById('coverImg');
const coverSpinner = document.getElementById('coverSpinner');
const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const progressBar = document.getElementById('progressBar');
const progressFill = progressBar.querySelector('.progress-fill');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const likeBtn = document.getElementById('likeBtn');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const audio = document.getElementById('audio');

const lyricsBox = document.getElementById('lyrics');
const queueBox = document.getElementById('queue');

const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');

const lrcOffsetEl = document.getElementById('lrcOffset');
const offsetVal = document.getElementById('offsetVal');

const tabBtns = document.querySelectorAll('.tab-btn');

// UTILS
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
function fmtTime(s){ if(!isFinite(s)) return '0:00'; const m = Math.floor(s/60); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${m}:${sec}`; }
function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }

// FETCH DATA
(async function init(){
  try{
    const res = await fetch('data.json');
    if(!res.ok) throw new Error('Nie można załadować data.json');
    const j = await res.json();
    albumsData = j.albums || [];
    renderAlbums(albumsData);
    applySavedOffset();
  } catch(e){
    console.error(e);
    showError('Błąd ładowania danych. Sprawdź ścieżki i serwer (uruchom: python -m http.server).');
  }
})();

// SHOW VIEW (with animLock)
function showView(viewEl){
  if(animLock) return;
  animLock = true;
  const prev = document.querySelector('.view.active');
  if(prev === viewEl){ animLock = false; return; }
  // start leave
  prev.classList.remove('active');
  prev.classList.add('leave');
  // start enter
  viewEl.classList.add('enter');
  requestAnimationFrame(()=> {
    viewEl.classList.add('active');
    // trigger one more frame to allow transition
    requestAnimationFrame(()=> {
      viewEl.classList.remove('enter');
    });
  });
  const onEnd = () => {
    prev.classList.remove('leave');
    prev.removeEventListener('transitionend', onEnd);
    animLock = false;
  };
  prev.addEventListener('transitionend', onEnd, { once: true });
}

// RENDER ALBUMS
function renderAlbums(albums){
  albumsGrid.innerHTML = '';
  if(!albums.length) { albumsGrid.innerHTML = '<div class="muted">Brak albumów</div>'; return; }
  albums.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role','listitem');
    card.innerHTML = `
      <img src="${escapeHtml(album.cover)}" alt="${escapeHtml(album.title)}">
      <div class="album-meta">
        <b>${escapeHtml(album.title)}</b>
        <small>${escapeHtml(album.artist)} • ${album.year || ''}</small>
      </div>
    `;
    card.addEventListener('click', ()=> openAlbum(album));
    albumsGrid.appendChild(card);
  });
}

// OPEN ALBUM
function openAlbum(album){
  currentAlbum = album;
  albumTitle.textContent = album.title;
  albumMeta.textContent = `${album.artist} • ${album.year || ''}`;
  tracksCoverImg.src = album.cover || '';
  // render tracks list
  tracksList.innerHTML = '';
  (album.tracks || []).forEach(track => {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.setAttribute('data-id', track.id);
    div.innerHTML = `
      <div>
        <div><strong>${escapeHtml(track.title)}</strong></div>
        <div class="meta">${escapeHtml(track.duration || '')}</div>
      </div>
      <div>
        <button class="btn play-small" data-id="${track.id}" aria-label="Odtwórz">▶</button>
      </div>
    `;
    div.querySelector('.play-small').addEventListener('click', (e) => { e.stopPropagation(); playTrack(track.id); });
    div.addEventListener('click', ()=> playTrack(track.id));
    tracksList.appendChild(div);
  });
  showView(tracksView);
}

// RENDER QUEUE
function renderQueue(){
  queueBox.innerHTML = '';
  if(!queue.length){ queueBox.innerHTML = '<div class="muted">Kolejka pusta</div>'; return; }
  queue.forEach(t => {
    const el = document.createElement('div');
    el.className = 'q-item';
    el.innerHTML = `<div>${escapeHtml(t.title)} <small class="muted">• ${escapeHtml(t.duration||'')}</small></div>
                    <div><button class="btn q-play" data-id="${t.id}">▶</button></div>`;
    queueBox.appendChild(el);
  });
  queueBox.querySelectorAll('.q-play').forEach(b => b.addEventListener('click', ()=> playTrack(b.dataset.id)));
}

// PLAY
async function playTrack(id){
  const track = (currentAlbum && currentAlbum.tracks || []).find(t => t.id === id);
  if(!track){
    console.warn('track not found', id);
    return;
  }
  currentTrack = track;
  queue = currentAlbum.tracks.slice();
  // UI updates
  nowTitle.textContent = track.title;
  nowArtist.textContent = `${currentAlbum.artist || ''} • ${currentAlbum.year || ''}`;
  coverImg.src = currentAlbum.cover || '';
  coverSpinner.classList.remove('hidden');
  updateLikeButton();

  // start playing
  try{
    audio.pause();
    audio.src = track.audio;
    audio.load();
    await audio.play().catch(()=>{}); // autoplay may be blocked
  } catch(e){
    console.warn('play error', e);
  }

  // load LRC (abort previous)
  loadLRC(track.lrc);

  // render queue and switch to player view
  renderQueue();
  document.getElementById('playerAlbumTitle').textContent = currentAlbum.title || '';
  document.getElementById('playerAlbumMeta').textContent = `${currentAlbum.artist || ''} • ${currentAlbum.year || ''}`;
  showView(playerView);

  // preload next
  const idx = queue.findIndex(t=>t.id === track.id);
  const next = queue[idx+1];
  preloadNext(next);
  // media session
  setupMediaSession();
}

// LOAD LRC with AbortController
async function loadLRC(path){
  lyrics = [];
  lyricsBox.innerHTML = '<div class="muted">Ładowanie tekstu...</div>';
  if(!path){ lyricsBox.innerHTML = '<div class="muted">Brak tekstu</div>'; return; }
  try{
    if(currentLrcController) currentLrcController.abort();
    currentLrcController = new AbortController();
    const res = await fetch(path, { signal: currentLrcController.signal });
    if(!res.ok) throw new Error('Nie można załadować LRC');
    const txt = await res.text();
    lyrics = parseLRC(txt);
    renderLyrics();
  } catch(err){
    if(err.name === 'AbortError') return;
    console.warn('LRC load error', err);
    lyrics = [];
    lyricsBox.innerHTML = '<div class="muted">Brak lub błąd pliku LRC</div>';
  }
}

// LRC parser (multi timestamps per line)
function parseLRC(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  const re = /\[(\d+):(\d{2}(?:\.\d+)?)\]/g;
  for(const raw of lines){
    let line = raw.trim();
    if(!line) continue;
    let match;
    const times = [];
    while((match = re.exec(line)) !== null){
      const min = parseInt(match[1],10);
      const sec = parseFloat(match[2]);
      times.push(min*60 + sec);
    }
    const content = line.replace(re, '').trim();
    times.forEach(t => out.push({ time: t, text: content }));
  }
  out.sort((a,b)=>a.time - b.time);
  return out;
}

function renderLyrics(){
  if(!lyrics.length){ lyricsBox.innerHTML = '<div class="muted">Brak tekstu</div>'; return; }
  lyricsBox.innerHTML = lyrics.map(l => `<div>${escapeHtml(l.text)}</div>`).join('');
}

// HIGHLIGHT LINES with offset
function highlightCurrentLyric(){
  if(!lyrics.length) return;
  const t = audio.currentTime + (lrcOffsetMs / 1000);
  for(let i=0;i<lyrics.length;i++){
    if(t >= lyrics[i].time && (!lyrics[i+1] || t < lyrics[i+1].time)){
      const nodes = lyricsBox.children;
      for(let j=0;j<nodes.length;j++) nodes[j].classList.toggle('active', j===i);
      if(nodes[i]) nodes[i].scrollIntoView({ behavior:'smooth', block:'center' });
      break;
    }
  }
}

// AUDIO events
audio.addEventListener('timeupdate', () => {
  if(audio.duration && isFinite(audio.duration)){
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + '%';
    curTimeEl.textContent = fmtTime(audio.currentTime);
    durTimeEl.textContent = fmtTime(audio.duration);
  }
  highlightCurrentLyric();
});

audio.addEventListener('loadeddata', () => {
  coverSpinner.classList.add('hidden');
});

audio.addEventListener('error', () => {
  showAudioError('Błąd odtwarzania (plik nie istnieje / CORS / uszkodzony).');
  coverSpinner.classList.add('hidden');
});

audio.addEventListener('ended', () => {
  // auto next
  const idx = queue.findIndex(t => t.id === currentTrack.id);
  if(idx >= 0 && idx < queue.length - 1){
    playTrack(queue[idx+1].id);
  }
});

// PROGRESS seeking
progressBar.addEventListener('click', (e) => {
  if(!audio.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
});

// PLAY/PAUSE handlers
playPauseBtn.addEventListener('click', () => {
  if(audio.paused) { audio.play().catch(()=>{}); }
  else { audio.pause(); }
});
audio.addEventListener('play', ()=> playPauseBtn.textContent = '⏸');
audio.addEventListener('pause', ()=> playPauseBtn.textContent = '▶️');

// prev/next
prevBtn.addEventListener('click', () => {
  if(!currentTrack) return;
  const idx = queue.findIndex(t => t.id === currentTrack.id);
  if(idx > 0) playTrack(queue[idx-1].id);
});
nextBtn.addEventListener('click', () => {
  if(!currentTrack) return;
  const idx = queue.findIndex(t => t.id === currentTrack.id);
  if(idx < queue.length - 1) playTrack(queue[idx+1].id);
});

// LIKE
likeBtn.addEventListener('click', () => {
  if(!currentTrack) return;
  toggleLike(currentTrack.id);
  updateLikeButton();
});
function updateLikeButton(){ likeBtn.textContent = (currentTrack && liked.includes(currentTrack.id)) ? '♥' : '♡'; }

// PRELOAD next audio (rel=preload)
function preloadNext(nextTrack){
  try{
    if(!nextTrack) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'audio';
    link.href = nextTrack.audio;
    document.head.appendChild(link);
  }catch(e){/* ignore */}
}

// MEDIA SESSION
function setupMediaSession(){
  if(!('mediaSession' in navigator) || !currentTrack) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTrack.title,
    artist: currentAlbum.artist || '',
    album: currentAlbum.title || '',
    artwork: [{ src: currentAlbum.cover || '', sizes: '512x512' }]
  });
  navigator.mediaSession.setActionHandler('play', ()=> audio.play());
  navigator.mediaSession.setActionHandler('pause', ()=> audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', ()=> {
    const idx = queue.findIndex(t=>t.id===currentTrack.id);
    if(idx>0) playTrack(queue[idx-1].id);
  });
  navigator.mediaSession.setActionHandler('nexttrack', ()=> {
    const idx = queue.findIndex(t=>t.id===currentTrack.id);
    if(idx < queue.length - 1) playTrack(queue[idx+1].id);
  });
}

// SEARCH + SORT
searchEl.addEventListener('input', debounce(()=> applyFilters(), 220));
sortEl.addEventListener('change', ()=> applyFilters());
function applyFilters(){
  const q = (searchEl.value || '').toLowerCase().trim();
  const sortBy = sortEl.value;
  let filtered = albumsData.filter(a=>{
    if(!q) return true;
    if(a.title.toLowerCase().includes(q)) return true;
    if(a.artist && a.artist.toLowerCase().includes(q)) return true;
    if(a.tracks && a.tracks.some(t => t.title.toLowerCase().includes(q))) return true;
    return false;
  });
  if(sortBy === 'title') filtered.sort((a,b)=> a.title.localeCompare(b.title));
  if(sortBy === 'year') filtered.sort((a,b)=> (b.year||0) - (a.year||0));
  renderAlbums(filtered);
}

// OFFSET LRC UI
lrcOffsetEl.value = lrcOffsetMs;
offsetVal.textContent = `${lrcOffsetMs} ms`;
lrcOffsetEl.addEventListener('input', (e) => {
  lrcOffsetMs = Number(e.target.value || 0);
  offsetVal.textContent = `${lrcOffsetMs} ms`;
  localStorage.setItem('lrcOffset', String(lrcOffsetMs));
});

// TABS
tabBtns.forEach(btn => btn.addEventListener('click', ()=> {
  tabBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const target = btn.dataset.tab;
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(target).classList.remove('hidden');
}));

// BACK buttons
backFromTracks.addEventListener('click', ()=> showView(albumsView));
backFromPlayer.addEventListener('click', ()=> showView(tracksView));

// KEYBOARD shortcuts
document.addEventListener('keydown', (e) => {
  if(e.code === 'Space' && document.activeElement.tagName !== 'INPUT'){ e.preventDefault(); if(audio.paused) audio.play(); else audio.pause(); }
  if(e.code === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  if(e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
});

// Liked persistence
function saveLiked(ids){
  try{ localStorage.setItem('liked', JSON.stringify(ids)); }
  catch(e){ document.cookie = "liked=" + encodeURIComponent(JSON.stringify(ids)) + "; max-age=" + (60*60*24*365) + "; path=/"; }
}
function loadLiked(){
  try{
    const raw = localStorage.getItem('liked');
    if(raw) return JSON.parse(raw);
    const m = document.cookie.match(/(?:^|; )liked=([^;]+)/);
    if(m) return JSON.parse(decodeURIComponent(m[1]));
  } catch(e){}
  return [];
}
function toggleLike(id){
  const i = liked.indexOf(id);
  if(i === -1) liked.push(id); else liked.splice(i,1);
  saveLiked(liked);
}

// ERROR handling UI
function showError(msg){ errorMsg.textContent = msg; errorMsg.classList.remove('hidden'); }
function showAudioError(msg){ const el = document.getElementById('audioError'); el.textContent = msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'), 6000); }

// SAFETY: clickable elements - initial state
document.addEventListener('DOMContentLoaded', ()=> {
  // noop for now
});
