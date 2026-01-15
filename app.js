let albumsData = [];
let currentAlbum = null;
let queue = [];
let lyrics = [];

const albumList = document.getElementById("albumList");
const albumView = document.getElementById("albumView");
const audio = document.getElementById("audio");
const queueBox = document.getElementById("queue");
const lyricsBox = document.getElementById("lyrics");
const nowPlaying = document.getElementById("nowPlaying");

fetch("data.json")
  .then(res => res.json())
  .then(data => {
    albumsData = data.albums;
    renderAlbums(albumsData);
  });

function renderAlbums(albums) {
  albumList.innerHTML = "";
  albums.forEach(album => {
    const div = document.createElement("div");
    div.className = "album";
    div.innerHTML = `
      <img src="${album.cover}" width="50">
      <div>
        <b>${album.title}</b><br>
        <small>${album.artist} • ${album.year}</small>
      </div>
    `;
    div.onclick = () => openAlbum(album);
    albumList.appendChild(div);
  });
}

function openAlbum(album) {
  currentAlbum = album;
  queue = album.tracks;

  albumView.innerHTML = `
    <h2>${album.title}</h2>
    <h4>${album.artist}</h4>
    ${album.tracks.map(track => `
      <div class="track" onclick="playTrack('${track.id}')">
        ${track.title} <small>${track.duration}</small>
      </div>
    `).join("")}
  `;

  renderQueue();
}

function playTrack(id) {
  const track = queue.find(t => t.id === id);
  if (!track) return;

  audio.src = track.audio;
  audio.play();

  nowPlaying.innerText = track.title;
  loadLRC(track.lrc);
}

function renderQueue() {
  queueBox.innerHTML = queue.map(t =>
    `<div>${t.title}</div>`
  ).join("");
}

function loadLRC(path) {
  fetch(path)
    .then(res => res.text())
    .then(text => {
      lyrics = parseLRC(text);
      lyricsBox.innerHTML = lyrics.map(l => `<div>${l.text}</div>`).join("");
    });
}

function parseLRC(lrc) {
  return lrc.split("\n").map(line => {
    const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    if (!match) return null;
    return {
      time: parseInt(match[1]) * 60 + parseFloat(match[2]),
      text: match[3]
    };
  }).filter(Boolean);
}

audio.addEventListener("timeupdate", () => {
  const t = audio.currentTime;
  lyrics.forEach((line, i) => {
    const el = lyricsBox.children[i];
    if (!el) return;

    if (t >= line.time && (!lyrics[i + 1] || t < lyrics[i + 1].time)) {
      el.style.color = "#ff6a00";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      el.style.color = "#aaa";
    }
  });
});

document.querySelectorAll(".tabs button").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  };
});
