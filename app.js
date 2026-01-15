// app.js — logic, LRC sync, UI glue

// STATE
let albumsData = [];
let currentAlbum = null;
let queue = [];
let currentTrack = null;
let lyrics = []; // [{time: seconds, text: "..."}]
let liked = loadLiked(); // array of track ids
let lrcOffsetMs = 0; // optional offset in ms

// ELEMENTS
const albumsGrid = document.getElementById('albumsGrid');
const albumView = document.getElementById('albumView');
const errorMsg = document.getElementById('errorMsg');

const audio = document.getElementById('audio');
const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const coverImg = document.getElementById('coverImg');
const playerCover = document.getElementById('playerCover');

const queueBox = document.getElementById('queue');
const lyricsBox = document.getElementById('lyrics');

const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');

const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const likeBtn = document.getElementById('likeBtn');

const progressBar = document.getElementById('progressBar');
const progressFill = progressBar.querySelector('.progress-fill');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');

const tabs = document.querySelectorAll('.tab');
const queueTab = document.getElementById('queue');
const lyricsTab = document.getElementById('lyrics');

// UTILITIES
function fmtTime(s){
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}
function debounce(fn, ms=200){
  let t;
  return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms) }
}

// LOAD DATA
fetch('data.json')
  .then(r => { if(!r.ok) throw new Error('Nie można załadować data.json'); return r.json() })
  .then(j => {
    albumsData = j.albums || [];
    renderAlbums(albumsData);
  })
  .catch(e => {
    console.error(e);
    showError('Błąd ładowania danych. Sprawdź ścieżki i serwer.');
  });

// UI: error
function showError(msg){
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

// RENDER ALBUMS
function renderAlbums(albums){
  albumsGrid.innerHTML = '';
  if(!albums.length){
    albumsGrid.innerHTML = '<div class="muted">Brak albumów</div>';
    return;
  }
  albums.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role','listitem');
    card.innerHTML = `
      <img src="${album.cover}" alt="${escapeHtml(album.title)}">
      <div class="album-meta">
        <b>${escapeHtml(album.title)}</b>
        <small>${escapeHtml(album.artist)} • ${album.year}</small>
      </div>
    `;
    card.onclick = () => openAlbum(album);
    albumsGrid.appendChild(card);
  });
}

// ESCAPE helper for basic safety
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// OPEN ALBUM
function openAlbum(album){
  currentAlbum = album;
  queue = album.tracks.slice();
  albumView.innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start">
      <div style="width:220px"><img src="${album.cover}" alt="" style="width:100%;border-radius:8px;object-fit:cover"></div>
      <div>
        <h2>${escapeHtml(album.title)}</h2>
        <div class="muted">${escapeHtml(album.artist)} • ${album.year}</div>
        <div style="margin-top:12px" id="tracksList"></div>
      </div>
    </div>
  `;
  const tracksList = document.getElementById('tracksList');
  tracksList.innerHTML = queue.map(t => `
    <div class="track" data-id="${t.id}">
      <div>
        <div><strong>${escapeHtml(t.title)}</strong></div>
        <small class="muted">${escapeHtml(t.duration)}</small>
      </div>
      <div>
        <button class="btn small-play" data-id="${t.id}">▶</button>
      </div>
    </div>
  `).join('');
  // attach listeners
  tracksList.querySelectorAll('.small-play').forEach(b => b.addEventListener('click', (e)=>{ playTrack(b.dataset.id); }));
  renderQueue();
}

// RENDER QUEUE
function renderQueue(){
  queueBox.innerHTML = '';
  if(!queue.length){ queueBox.innerHTML = '<div class="muted">Kolejka pusta</div>'; return; }
  queue.forEach((t,idx) => {
    const el = document.createElement('div');
    el.className = 'q-item';
    el.innerHTML = `
      <div>${escapeHtml(t.title)} <small class="muted">• ${escapeHtml(t.duration)}</small></div>
      <div>
        <button class="btn q-play" data-id="${t.id}">▶</button>
      </div>
    `;
    queueBox.appendChild(el);
  });
  queueBox.querySelectorAll('.q-play').forEach(b => b.addEventListener('click', ()=>playTrack(b.dataset.id)));
}

// PLAY TRACK
function playTrack(id){
  const track = queue.find(t=>t.id===id);
  if(!track){ console.warn('track not found', id); return; }
  currentTrack = track;

  audio.src = track.audio;
  audio.play().catch(e=>console.warn('autoplay blocked', e));

  nowTitle.textContent = track.title;
  nowArtist.textContent = currentAlbum ? `${currentAlbum.artist} • ${currentAlbum.year}` : '';
  coverImg.src = currentAlbum ? currentAlbum.cover : '';
  updateLikeButton();

  // load lrc
  if(track.lrc){
    loadLRC(track.lrc);
  } else {
    lyrics = [];
    lyricsBox.innerHTML = '<div class="muted">Brak tekstu</div>';
  }

  // media session
  if('mediaSession' in navigator){
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: currentAlbum ? currentAlbum.artist : '',
      album: currentAlbum ? currentAlbum.title : '',
      artwork: [{ src: currentAlbum ? currentAlbum.cover : '', sizes:'512x512', type:'image/jpeg' }]
    });
  }
}

// LRC: load & parse
function loadLRC(path){
  fetch(path).then(r => {
    if(!r.ok) throw new Error('Nie można załadować LRC');
    return r.text();
  }).then(txt => {
    lyrics = parseLRC(txt);
    renderLyrics();
  }).catch(e => {
    console.warn(e);
    lyrics = [];
    lyricsBox.innerHTML = '<div class="muted">Brak lub błąd pliku LRC</div>';
  });
}

function parseLRC(text){
  // supports multiple timestamps per line
  const lines = text.split(/\r?\n/);
  const out = [];
  const re = /\[(\d+):(\d{2}(?:\.\d+)?)\]/g;
  for(const raw of lines){
    let line = raw.trim();
    if(!line) continue;
    let last;
    const times = [];
    while((last = re.exec(line)) !== null){
      const min = parseInt(last[1],10);
      const sec = parseFloat(last[2]);
      times.push(min*60 + sec);
    }
    const textOnly = line.replace(re,'').trim();
    times.forEach(t => out.push({ time: t, text: textOnly }));
  }
  // sort by time
  out.sort((a,b)=>a.time - b.time);
  return out;
}

function renderLyrics(){
  if(!lyrics.length){ lyricsBox.innerHTML = '<div class="muted">Brak tekstu</div>'; return; }
  lyricsBox.innerHTML = lyrics.map(l => `<div>${escapeHtml(l.text)}</div>`).join('');
}

// SYNC highlighting
function highlightLine(index){
  const nodes = lyricsBox.children;
  for(let i=0;i<nodes.length;i++){
    nodes[i].classList.toggle('active', i===index);
  }
  if(nodes[index]) nodes[index].scrollIntoView({behavior:'smooth', block:'center'});
}

// audio timeupdate
audio.addEventListener('timeupdate', ()=> {
  const t = audio.currentTime + (lrcOffsetMs/1000);
  // progress
  if(audio.duration && isFinite(audio.duration)){
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + '%';
    curTimeEl.textContent = fmtTime(audio.currentTime);
    durTimeEl.textContent = fmtTime(audio.duration);
  }
  // lyrics highlight
  if(lyrics && lyrics.length){
    for(let i=0;i<lyrics.length;i++){
      if(t >= lyrics[i].time && (!lyrics[i+1] || t < lyrics[i+1].time)){
        highlightLine(i);
        break;
      }
    }
  }
});

// PROGRESS bar seeking (click)
progressBar.addEventListener('click', (e)=>{
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if(audio.duration) audio.currentTime = pct * audio.duration;
});

// PLAY/PAUSE + prev/next (basic)
playPauseBtn.addEventListener('click', ()=>{
  if(audio.paused) { audio.play().catch(()=>{}); playPauseBtn.textContent = '⏸'; }
  else { audio.pause(); playPauseBtn.textContent = '▶️'; }
});

audio.addEventListener('play', ()=> playPauseBtn.textContent = '⏸' );
audio.addEventListener('pause', ()=> playPauseBtn.textContent = '▶️' );

prevBtn.addEventListener('click', ()=> {
  if(!currentTrack) return;
  const idx = queue.findIndex(t=>t.id===currentTrack.id);
  if(idx>0) playTrack(queue[idx-1].id);
});
nextBtn.addEventListener('click', ()=> {
  if(!currentTrack) return;
  const idx = queue.findIndex(t=>t.id===currentTrack.id);
  if(idx < queue.length - 1) playTrack(queue[idx+1].id);
});

// like
likeBtn.addEventListener('click', ()=>{
  if(!currentTrack) return;
  toggleLike(currentTrack.id);
  updateLikeButton();
});
function updateLikeButton(){
  if(!currentTrack) { likeBtn.textContent = '♡'; return; }
  likeBtn.textContent = liked.includes(currentTrack.id) ? '♥' : '♡';
}

// TABS
tabs.forEach(t => t.addEventListener('click', ()=> {
  tabs.forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));
  const id = t.dataset.tab;
  document.getElementById(id).classList.remove('hidden');
}));

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
    if(a.tracks.some(t => t.title.toLowerCase().includes(q))) return true;
    return false;
  });
  if(sortBy === 'title') filtered.sort((a,b)=>a.title.localeCompare(b.title));
  if(sortBy === 'year') filtered.sort((a,b)=> (b.year||0) - (a.year||0));
  renderAlbums(filtered);
}

// LIKED persistence (localStorage + cookie fallback)
function saveLiked(ids){
  try {
    localStorage.setItem('liked', JSON.stringify(ids));
  } catch(e){
    // fallback to cookie
    document.cookie = "liked=" + encodeURIComponent(JSON.stringify(ids)) + "; max-age=" + (60*60*24*365) + "; path=/";
  }
}
function loadLiked(){
  try {
    const raw = localStorage.getItem('liked');
    if(raw) return JSON.parse(raw);
    // fallback cookie
    const m = document.cookie.match(/(?:^|; )liked=([^;]+)/);
    if(m) return JSON.parse(decodeURIComponent(m[1]));
  } catch(e){}
  return [];
}
function toggleLike(id){
  if(!id) return;
  const i = liked.indexOf(id);
  if(i === -1) liked.push(id);
  else liked.splice(i,1);
  saveLiked(liked);
}

// small safety: prevent XSS injection when setting innerHTML in some places
// (we already escaped content with escapeHtml)

// Accessibility: keyboard on progress (seek)
progressBar.addEventListener('keydown', (e)=>{
  if(!audio.duration) return;
  if(e.key === 'ArrowLeft'){ audio.currentTime = Math.max(0, audio.currentTime - 5); }
  if(e.key === 'ArrowRight'){ audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); }
});

// Initial: make sure controls disabled until data loaded
document.addEventListener('DOMContentLoaded', ()=> {
  // noop for now
});
