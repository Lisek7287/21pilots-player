/* Final update: mini controls (seek + volume), removed spinner, improved layout, fixed autoscroll detection.
   Key flags: isAutoScrolling prevents auto-follow being considered user scroll.
*/

let albumsData = [];
let currentAlbum = null;
let queue = [];
let currentTrack = null;
let lyrics = [];
let liked = loadLiked();
let animLock = false;
let currentLrcController = null;
let isAutoScrolling = false; // IMPORTANT: prevents programmatic scroll from being treated as user scroll

let settings = {
  volume: Number(localStorage.getItem('volume') ?? 0.9),
  shuffle: localStorage.getItem('shuffle') === 'true',
  loop: localStorage.getItem('loop') === 'true',
  autoFollow: localStorage.getItem('autoFollow') !== 'false'
};

// ELEMENTS
const albumsGrid = document.getElementById('albumsGrid');
const errorMsg = document.getElementById('errorMsg');

const backFromTracks = document.getElementById('backFromTracks');
const backFromPlayer = document.getElementById('backFromPlayer');
const albumTitle = document.getElementById('albumTitle');
const albumMeta = document.getElementById('albumMeta');
const tracksList = document.getElementById('tracksList');
const tracksCoverImg = document.getElementById('tracksCoverImg');

const coverImg = document.getElementById('coverImg');
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

const tabBtns = document.querySelectorAll('.tab-btn');
const volumeEl = document.getElementById('volumeEl');
const shuffleBtn = document.getElementById('shuffleBtn');
const loopBtn = document.getElementById('loopBtn');

const resumeAuto = document.getElementById('resumeAuto');
const resumeBtn = document.getElementById('resumeBtn');

const miniPlayer = document.getElementById('miniPlayer');
const miniThumb = document.getElementById('miniThumb');
const miniTitle = document.getElementById('miniTitle');
const miniSub = document.getElementById('miniSub');
const miniPlay = document.getElementById('miniPlay');
const miniNext = document.getElementById('miniNext');
const miniPrev = document.getElementById('miniPrev');
const miniLike = document.getElementById('miniLike');
const miniLeft = document.getElementById('miniLeft');
const miniProgress = document.getElementById('miniProgress');
const miniProgressFill = document.getElementById('miniProgressFill');
const miniVolume = document.getElementById('miniVolume');

// UTIL
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
function fmtTime(s){ if(!isFinite(s)) return '0:00'; const m = Math.floor(s/60); const sec = Math.floor(s%60).toString().padStart(2,'0'); return `${m}:${sec}`; }
function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }

// INIT
(async function init(){
  try{
    const res = await fetch('data.json');
    if(!res.ok) throw new Error('Nie można załadować data.json');
    const j = await res.json();
    albumsData = j.albums || [];
    renderAlbumsWithLiked();
    applyVolume();
    updateShuffleLoopButtons();
  } catch(e){
    console.error(e);
    showError('Błąd ładowania danych. Uruchom serwer (python -m http.server) lub sprawdź ścieżki.');
  }
})();

// VIEW switch (keeps mini-player behavior: show only when leaving full player and audio plays)
function showView(viewEl){
  if(animLock) return;
  animLock = true;
  const prev = document.querySelector('.view.active');
  if(prev === viewEl){ animLock = false; return; }
  prev.classList.remove('active'); prev.classList.add('leave');
  viewEl.classList.add('enter');
  requestAnimationFrame(()=> { viewEl.classList.add('active'); viewEl.classList.remove('enter'); });
  const onEnd = () => { prev.classList.remove('leave'); prev.removeEventListener('transitionend', onEnd); animLock = false; };
  prev.addEventListener('transitionend', onEnd, { once: true });

  if(prev.id === 'playerView'){
    if(!audio.paused) showMini(true);
  } else {
    if(viewEl.id === 'playerView') showMini(false);
  }
}

// RENDER ALBUMS
function renderAlbumsWithLiked(){
  const likedTracks = [];
  liked.forEach(id => {
    for(const album of albumsData){
      const track = (album.tracks || []).find(t => t.id === id);
      if(track){
        likedTracks.push(Object.assign({}, track, { albumId: album.id, albumTitle: album.title, albumCover: album.cover, albumArtist: album.artist }));
        break;
      }
    }
  });
  const likedAlbum = {
    id: 'liked',
    title: 'Polubione',
    artist: '',
    year: '',
    cover: likedTracks[0] ? likedTracks[0].albumCover : 'covers/liked.png',
    tracks: likedTracks.map(t => ({ id: 'liked-' + t.id, title: t.title, duration: t.duration, audio: t.audio, lrc: t.lrc, sourceId: t.id, artist: t.artist || t.albumArtist }))
  };
  const display = [likedAlbum].concat(albumsData);
  albumsGrid.innerHTML = '';
  display.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role','listitem');
    card.innerHTML = `
      <img src="${escapeHtml(album.cover)}" alt="${escapeHtml(album.title)}">
      <div class="album-meta">
        <b>${escapeHtml(album.title)}</b>
        <small>${escapeHtml(album.artist || '')} ${album.year ? '• ' + album.year : ''}</small>
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
  albumMeta.textContent = `${album.artist || ''} ${album.year ? '• ' + album.year : ''}`;
  tracksCoverImg.src = album.cover || '';
  tracksList.innerHTML = '';
  const tracks = album.tracks || [];
  tracks.forEach((track, idx) => {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.setAttribute('data-id', track.id);
    div.innerHTML = `
      <div class="track-left">
        <div class="track-num">${idx+1}</div>
        <div style="min-width:0">
          <div class="track-title"><strong>${escapeHtml(track.title)}</strong></div>
          <div class="track-meta">${escapeHtml(track.duration || '')}</div>
        </div>
      </div>
      <div class="track-actions">
        <button class="btn add-queue" data-id="${track.id}" title="Dodaj do kolejki">＋</button>
        <button class="btn play-small" data-id="${track.id}" title="Odtwórz">▶</button>
      </div>
    `;
    div.querySelector('.play-small').addEventListener('click', (e) => { e.stopPropagation(); playTrack(track.id); });
    div.querySelector('.add-queue').addEventListener('click', (e) => { e.stopPropagation(); addToQueueById(track.id); });
    div.addEventListener('click', ()=> playTrack(track.id));
    tracksList.appendChild(div);
  });
  showView(document.getElementById('tracksView'));
}

// ADD TO QUEUE
function addToQueueById(trackId){
  let sourceId = trackId;
  if(trackId.startsWith('liked-')) sourceId = trackId.replace('liked-','');
  let found = null;
  for(const album of albumsData){
    const t = (album.tracks || []).find(x => x.id === sourceId);
    if(t){ found = Object.assign({}, t, { albumId: album.id, albumTitle: album.title, albumCover: album.cover, albumArtist: album.artist }); break; }
  }
  if(!found){ console.warn('Nie znaleziono tracku do dodania:', trackId); return; }
  queue.push(found);
  renderQueue();
}

// RENDER QUEUE
function renderQueue(){
  queueBox.innerHTML = '';
  if(!queue.length){ queueBox.innerHTML = '<div class="muted">Kolejka pusta</div>'; return; }
  queue.forEach((t, idx) => {
    const el = document.createElement('div');
    el.className = 'q-item';
    el.innerHTML = `
      <div class="q-thumb"><img src="${escapeHtml(t.albumCover || t.cover || 'covers/placeholder.png')}" alt=""></div>
      <div class="q-meta">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="sub">${escapeHtml(t.albumArtist || t.artist || '')} • ${escapeHtml(t.albumTitle || '')}</div>
      </div>
      <div style="margin-left:auto;">
        <button class="btn q-play" data-idx="${idx}">▶</button>
        <button class="btn q-remove" data-idx="${idx}">✖</button>
      </div>
    `;
    queueBox.appendChild(el);
  });
  queueBox.querySelectorAll('.q-play').forEach(b => b.addEventListener('click', ()=> playQueueIndex(Number(b.dataset.idx))));
  queueBox.querySelectorAll('.q-remove').forEach(b => b.addEventListener('click', ()=> { queue.splice(Number(b.dataset.idx),1); renderQueue(); }));
}

// PLAY QUEUE INDEX
function playQueueIndex(idx){
  const t = queue[idx];
  if(!t) return;
  currentAlbum = albumsData.find(a => a.id === t.albumId) || currentAlbum;
  playTrack(t.id || t.sourceId || t.id);
}

// PLAY TRACK
async function playTrack(id){
  let sourceId = id;
  if(id.startsWith && id.startsWith('liked-')) sourceId = id.replace('liked-','');

  let found = queue.find(qt => qt.id === sourceId || qt.sourceId === sourceId);
  if(!found){
    for(const album of albumsData){
      const t = (album.tracks || []).find(x => x.id === sourceId);
      if(t){ found = Object.assign({}, t, { albumId: album.id, albumTitle: album.title, albumCover: album.cover, albumArtist: album.artist }); break; }
    }
  }
  if(!found){ console.warn('track not found', id); return; }

  currentTrack = found;
  nowTitle.textContent = found.title;
  nowArtist.textContent = `${found.albumArtist || found.artist || ''} • ${found.albumTitle || ''}`;
  coverImg.src = found.albumCover || found.cover || 'covers/placeholder.png';
  updateLikeButton();

  try{
    audio.pause();
    audio.src = found.audio;
    audio.load();
    await audio.play().catch(()=>{});
  } catch(e){ console.warn('play error', e); showAudioError('Błąd odtwarzania'); }

  loadLRC(found.lrc);

  if(!queue.find(q => q === found || q.id === found.id)) queue.unshift(found);
  renderQueue();

  document.getElementById('playerAlbumTitle').textContent = found.albumTitle || (currentAlbum && currentAlbum.title) || '';
  document.getElementById('playerAlbumMeta').textContent = `${found.albumArtist || ''}`;
  showView(document.getElementById('playerView'));
  preloadNextTrack();
  setupMediaSession();

  // show mini only when leaving player view (handled by showView). Do NOT auto open player on new song.
}

// LRC: load + parse + render (click line -> seek)
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
    if(settings.autoFollow){
      scrollToCurrentLine();
      resumeAuto.classList.add('hidden');
    }
  } catch(err){
    if(err.name === 'AbortError') return;
    console.warn('LRC load error', err);
    lyrics = [];
    lyricsBox.innerHTML = '<div class="muted">Brak lub błąd pliku LRC</div>';
  }
}

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
  lyricsBox.innerHTML = lyrics.map((l,i) => `<div data-idx="${i}" data-time="${l.time}">${escapeHtml(l.text)}</div>`).join('');
  lyricsBox.addEventListener('scroll', onLyricsScrollUser, { passive: true });
  lyricsBox.querySelectorAll('div[data-time]').forEach(el => el.addEventListener('click', (e) => {
    const t = Number(el.dataset.time || 0);
    audio.currentTime = t;
    if(!document.getElementById('playerView').classList.contains('active')) showView(document.getElementById('playerView'));
  }));
}

let userScrolled = false;
let lyricsScrollTimeout = null;
function onLyricsScrollUser(){
  if(isAutoScrolling) return; // IGNORE programmatic scrolls
  if(lyricsScrollTimeout) clearTimeout(lyricsScrollTimeout);
  if(!userScrolled){
    userScrolled = true;
    settings.autoFollow = false;
    localStorage.setItem('autoFollow', 'false');
    resumeAuto.classList.remove('hidden');
  }
  lyricsScrollTimeout = setTimeout(()=>{ /* no-op */ }, 300);
}

function scrollToCurrentLine(){
  if(!lyrics.length) return;
  const t = audio.currentTime;
  for(let i=0;i<lyrics.length;i++){
    if(t >= lyrics[i].time && (!lyrics[i+1] || t < lyrics[i+1].time)){
      const nodes = lyricsBox.children;
      for(let j=0;j<nodes.length;j++) nodes[j].classList.toggle('active', j===i);
      if(nodes[i]){
        isAutoScrolling = true;
        nodes[i].scrollIntoView({ behavior:'smooth', block:'center' });
        // clear flag after animation time (safe)
        setTimeout(()=> { isAutoScrolling = false; }, 520);
      }
      break;
    }
  }
}

function highlightCurrentLyric(){
  if(!lyrics.length) return;
  const t = audio.currentTime;
  for(let i=0;i<lyrics.length;i++){
    if(t >= lyrics[i].time && (!lyrics[i+1] || t < lyrics[i+1].time)){
      const nodes = lyricsBox.children;
      if(nodes.length && settings.autoFollow && !userScrolled){
        for(let j=0;j<nodes.length;j++) nodes[j].classList.toggle('active', j===i);
        if(nodes[i]) {
          isAutoScrolling = true;
          nodes[i].scrollIntoView({ behavior:'smooth', block:'center' });
          setTimeout(()=> { isAutoScrolling = false; }, 520);
        }
      } else {
        for(let j=0;j<nodes.length;j++) nodes[j].classList.toggle('active', j===i);
      }
      break;
    }
  }
}

// AUDIO events & progress
audio.addEventListener('timeupdate', () => {
  if(audio.duration && isFinite(audio.duration)){
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + '%';
    curTimeEl.textContent = fmtTime(audio.currentTime);
    durTimeEl.textContent = fmtTime(audio.duration);
    // update mini progress too
    if(miniProgressFill) {
      const mpct = (audio.currentTime / (audio.duration || 1)) * 100;
      miniProgressFill.style.width = mpct + '%';
    }
  }
  highlightCurrentLyric();
});

audio.addEventListener('error', () => { showAudioError('Błąd odtwarzania (plik nie istnieje / CORS / uszkodzony).'); });

audio.addEventListener('ended', () => {
  if(settings.shuffle){
    if(queue.length <= 1) return;
    let rnd;
    do { rnd = Math.floor(Math.random() * queue.length); } while(queue[rnd].id === currentTrack.id && queue.length > 1);
    playTrack(queue[rnd].id);
  } else {
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if(idx >= 0 && idx < queue.length - 1) playTrack(queue[idx+1].id);
    else if(settings.loop && queue.length) playTrack(queue[0].id);
  }
});

// seeking (main)
progressBar.addEventListener('click', (e) => {
  if(!audio.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
});

// play/pause (no auto-show of mini on play/pause)
playPauseBtn.addEventListener('click', () => { if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); });
audio.addEventListener('play', ()=> { playPauseBtn.textContent = '⏸'; miniPlay.textContent = '⏸'; });
audio.addEventListener('pause', ()=> { playPauseBtn.textContent = '▶️'; miniPlay.textContent = '▶️'; });

// prev/next
prevBtn.addEventListener('click', () => {
  if(!currentTrack) return;
  if(settings.shuffle){
    let rnd;
    do { rnd = Math.floor(Math.random() * queue.length); } while(queue[rnd].id === currentTrack.id && queue.length > 1);
    playTrack(queue[rnd].id);
  } else {
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if(idx > 0) playTrack(queue[idx-1].id);
    else if(settings.loop && queue.length) playTrack(queue[queue.length-1].id);
  }
});
nextBtn.addEventListener('click', () => {
  if(!currentTrack) return;
  if(settings.shuffle){
    let rnd;
    do { rnd = Math.floor(Math.random() * queue.length); } while(queue[rnd].id === currentTrack.id && queue.length > 1);
    playTrack(queue[rnd].id);
  } else {
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if(idx >= 0 && idx < queue.length - 1) playTrack(queue[idx+1].id);
    else if(settings.loop && queue.length) playTrack(queue[0].id);
  }
});

// like button
likeBtn.addEventListener('click', () => {
  if(!currentTrack) return;
  toggleLike(currentTrack.id);
  updateLikeButton();
  renderAlbumsWithLiked();
});
function updateLikeButton(){ likeBtn.textContent = (currentTrack && liked.includes(currentTrack.id)) ? '♥' : '♡'; }

// preload next
function preloadNextTrack(){
  try{
    const idx = queue.findIndex(t => t.id === (currentTrack && currentTrack.id));
    const next = (idx >= 0 && idx < queue.length - 1) ? queue[idx+1] : null;
    if(!next) return;
    const link = document.createElement('link'); link.rel = 'preload'; link.as = 'audio'; link.href = next.audio; document.head.appendChild(link);
  }catch(e){}
}

// media session
function setupMediaSession(){
  if(!('mediaSession' in navigator) || !currentTrack) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTrack.title,
    artist: currentTrack.albumArtist || currentTrack.artist || '',
    album: currentTrack.albumTitle || '',
    artwork: [{ src: currentTrack.albumCover || currentTrack.cover || '', sizes: '512x512' }]
  });
  navigator.mediaSession.setActionHandler('play', ()=>audio.play());
  navigator.mediaSession.setActionHandler('pause', ()=>audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', ()=> prevBtn.click());
  navigator.mediaSession.setActionHandler('nexttrack', ()=> nextBtn.click());
}

// search + sort
searchEl.addEventListener('input', debounce(()=> applyFilters(), 200));
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
  if(sortBy === 'year') filtered.sort((a, b) => a.year - b.year);
  renderAlbumsFilteredWithLiked(filtered);
}
function renderAlbumsFilteredWithLiked(filtered){
  const likedTracks = [];
  liked.forEach(id => {
    for(const album of albumsData){
      const track = (album.tracks || []).find(t => t.id === id);
      if(track){
        likedTracks.push(Object.assign({}, track, { albumId: album.id, albumTitle: album.title, albumCover: album.cover, albumArtist: album.artist }));
        break;
      }
    }
  });
  const likedAlbum = {
    id: 'liked',
    title: 'Polubione',
    artist: '',
    year: '',
    cover: likedTracks[0] ? likedTracks[0].albumCover : 'covers/liked.png',
    tracks: likedTracks.map(t => ({ id: 'liked-' + t.id, title: t.title, duration: t.duration, audio: t.audio, lrc: t.lrc, sourceId: t.id, artist: t.artist || t.albumArtist }))
  };
  const display = [likedAlbum].concat(filtered.filter(a => a.id !== 'liked'));
  albumsGrid.innerHTML = '';
  display.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role','listitem');
    card.innerHTML = `
      <img src="${escapeHtml(album.cover)}" alt="${escapeHtml(album.title)}">
      <div class="album-meta">
        <b>${escapeHtml(album.title)}</b>
        <small>${escapeHtml(album.artist || '')} ${album.year ? '• ' + album.year : ''}</small>
      </div>
    `;
    card.addEventListener('click', ()=> openAlbum(album));
    albumsGrid.appendChild(card);
  });
}

// resume autoscroll button
resumeBtn.addEventListener('click', ()=> {
  userScrolled = false;
  settings.autoFollow = true;
  localStorage.setItem('autoFollow', 'true');
  resumeAuto.classList.add('hidden');
  scrollToCurrentLine();
});

// VOLUME custom (main + mini)
volumeEl.value = settings.volume;
applyVolume();
volumeEl.addEventListener('input', (e) => { settings.volume = Number(e.target.value); applyVolume(); localStorage.setItem('volume', String(settings.volume)); });
miniVolume.value = settings.volume;
miniVolume.addEventListener('input', (e) => { settings.volume = Number(e.target.value); applyVolume(); localStorage.setItem('volume', String(settings.volume)); });
function applyVolume(){
  audio.volume = settings.volume;
  // main fill
  const wrap = document.querySelector('.custom-range-wrap');
  const fill = document.querySelector('.custom-range-fill');
  if(wrap && fill){
    const rect = wrap.getBoundingClientRect();
    const px = Math.round(settings.volume * rect.width);
    fill.style.width = px + 'px';
  }
  // mini volume reflect
  if(miniVolume) miniVolume.value = settings.volume;
}

// shuffle/loop
shuffleBtn.addEventListener('click', ()=> { settings.shuffle = !settings.shuffle; localStorage.setItem('shuffle', settings.shuffle); updateShuffleLoopButtons(); });
loopBtn.addEventListener('click', ()=> { settings.loop = !settings.loop; localStorage.setItem('loop', settings.loop); updateShuffleLoopButtons(); });
function updateShuffleLoopButtons(){ shuffleBtn.style.opacity = settings.shuffle ? '1' : '0.5'; loopBtn.style.opacity = settings.loop ? '1' : '0.5'; }

// MINI player controls
function showMini(show){
  if(show && currentTrack){
    miniThumb.src = currentTrack.albumCover || currentTrack.cover || 'covers/placeholder.png';
    miniTitle.textContent = currentTrack.title;
    miniSub.textContent = `${currentTrack.albumArtist || currentTrack.artist || ''} • ${currentTrack.albumTitle || ''}`;
    miniPlay.textContent = audio.paused ? '▶️' : '⏸';
    miniLike.textContent = (currentTrack && liked.includes(currentTrack.id)) ? '♥' : '♡';
    miniPlayer.classList.remove('hidden');
  } else {
    miniPlayer.classList.add('hidden');
  }
}
miniLeft.addEventListener('click', ()=> showView(document.getElementById('playerView'))); // click whole left area opens player
miniPlay.addEventListener('click', ()=> { if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); });
miniNext.addEventListener('click', ()=> nextBtn.click());
miniPrev.addEventListener('click', ()=> prevBtn.click());
miniLike.addEventListener('click', ()=> { if(currentTrack){ toggleLike(currentTrack.id); updateLikeButton(); miniLike.textContent = liked.includes(currentTrack.id) ? '♥' : '♡'; renderAlbumsWithLiked(); }});

// mini progress seeking
if(miniProgress){
  miniProgress.addEventListener('click', (e) => {
    if(!audio.duration) return;
    const rect = miniProgress.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  });
}

// liked persistence
function saveLiked(ids){ try{ localStorage.setItem('liked', JSON.stringify(ids)); }catch(e){ document.cookie = "liked=" + encodeURIComponent(JSON.stringify(ids)) + "; max-age=" + (60*60*24*365) + "; path=/"; } }
function loadLiked(){ try{ const raw = localStorage.getItem('liked'); if(raw) return JSON.parse(raw); const m = document.cookie.match(/(?:^|; )liked=([^;]+)/); if(m) return JSON.parse(decodeURIComponent(m[1])); } catch(e){} return []; }
function toggleLike(id){ if(!id) return; const i = liked.indexOf(id); if(i === -1) liked.push(id); else liked.splice(i,1); saveLiked(liked); }

// show errors
function showError(msg){ errorMsg.textContent = msg; errorMsg.classList.remove('hidden'); }
function showAudioError(msg){ const el = document.getElementById('audioError'); el.textContent = msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'), 6000); }

// keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if(e.code === 'Space' && document.activeElement.tagName !== 'INPUT'){ e.preventDefault(); if(audio.paused) audio.play(); else audio.pause(); }
  if(e.code === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  if(e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
});

// back buttons
backFromTracks.addEventListener('click', ()=> showView(document.getElementById('albumsView')));
backFromPlayer.addEventListener('click', ()=> showView(document.getElementById('tracksView')));

// tabs (lyrics/queue)
tabBtns.forEach(btn => btn.addEventListener('click', ()=> {
  tabBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const target = btn.dataset.tab;
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(target).classList.remove('hidden');
  if(target === 'queue') renderQueue();
}));

// simple search render on init
document.addEventListener('DOMContentLoaded', ()=>{});
