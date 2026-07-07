/* ============================================================
   FILE: js/app.js (main entry point)
   ============================================================ */
import { onAuthState, getCurrentUser, isAdmin, logoutUser, loginWithGoogle } from './auth.js';
import { db } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, increment, getDocs } from 'firebase/firestore';
import { showToast, convertToCdnUrl, escapeHtml, generateRandomCounts } from './utils.js';
import { initPlayer, getState, setSongs, playSong, togglePlayPause, getNextSong, playNext, playPrev, seekTo, toggleShuffle, toggleRepeat, setVolume, getVolume, resetPlayer, setCallbacks } from './player.js';
import { initLyrics, parseLrc, formatTimestamp, updateActiveLyric, getLyricsState } from './lyrics.js';
import { loadPlaylists, getPlaylists, createPlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, getPlaylistById } from './playlist.js';

// --- DOM refs ---
const $ = id => document.getElementById(id);
const audio = document.getElementById('audioElement');

// --- State ---
let state = {
  songs: [],
  categories: new Set(),
  searchTerm: '',
  categoryFilter: 'all',
  sortMode: 'recent',
  showFavoritesOnly: false,
  authUser: null,
  isAdmin: false,
};

// --- Init ---
function init() {
  // Load playlists
  loadPlaylists();

  // Init player
  const playerState = initPlayer(state.songs, audio);
  setCallbacks({
    onPlay: (song) => {
      updatePlayerUI();
      renderAll();
      loadLyricsForSong(song);
      loadVideoForSong(song);
    },
    onPause: () => {
      updatePlayerUI();
      renderAll();
    },
    onTimeUpdate: (current, duration, progress) => {
      updatePlayerTime(current, duration, progress);
      updateActiveLyric(current);
      syncVideoToAudio(current);
    },
    onSongChange: (song) => {
      updatePlayerUI();
      renderAll();
      loadLyricsForSong(song);
      loadVideoForSong(song);
    },
    onEnded: () => {
      renderAll();
      // video handled in player
    }
  });

  // Init lyrics
  initLyrics({
    onLyricUpdate: (idx, lines) => {
      renderLyricsBody();
      updateExpandedPlayerLyrics();
    }
  });

  // Auth listener
  onAuthState((user) => {
    state.authUser = user;
    state.isAdmin = isAdmin(user);
    updateAuthUI(user);
    if (user && state.isAdmin) {
      updateStats();
      loadAdminSongs();
    }
  });

  // Firestore listener
  listenSongs();

  // Event bindings
  bindEvents();

  // Theme
  setTheme(getTheme());

  // PWA install
  setupPWA();

  // Volume
  audio.volume = 0.8;
  updateVolumeIcon();

  console.log('🎵 Melodify PWA loaded.');
  console.log('⌨️ Press L for lyrics · ? for shortcuts');
}

// --- Firestore Listener ---
function listenSongs() {
  const q = query(collection(db, 'songs'), orderBy('uploadDate', 'desc'));
  onSnapshot(q, (snapshot) => {
    const songs = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      songs.push({
        id: doc.id,
        ...data,
        likes: data.likes || 0,
        views: data.views || 0,
        downloads: data.downloads || 0,
        lyrics: data.lyrics || '',
        lyricsUrl: data.lyricsUrl || '',
        videoUrl: data.videoUrl || null,
        videoType: data.videoType || null,
      });
    });
    state.songs = songs;
    setSongs(songs);
    state.categories = new Set(songs.map(s => s.category).filter(Boolean));
    populateCategoryFilter();
    renderAll();
    updateStats();
    updateFavCount();
    if (state.authUser && state.isAdmin) loadAdminSongs();
    if (getLyricsState().currentSongId && !songs.find(s => s.id === getLyricsState().currentSongId)) {
      clearLyrics();
    }
    populateLyricsSongSelector();
    if (getState().currentSong) {
      loadLyricsForSong(getState().currentSong);
      loadVideoForSong(getState().currentSong);
    }
    updateVideoIndicator();
  }, (err) => {
    console.error('Firestore error:', err);
    showToast('Error loading songs.', 'error');
  });
}

// --- Render all ---
function renderAll() {
  renderSongs();
  renderRecommendations();
  renderRecentlyPlayed();
  renderQueue();
  renderPlaylists();
  renderLyricsBody();
}

// --- Song rendering ---
function getFilteredSongs() {
  const term = state.searchTerm.toLowerCase().trim();
  const filter = state.categoryFilter;
  let filtered = state.songs.filter(song => {
    const matchSearch = song.title.toLowerCase().includes(term) || song.artist.toLowerCase().includes(term);
    return matchSearch && (filter === 'all' || song.category === filter);
  });
  if (state.showFavoritesOnly) {
    const likedIds = getLikedSongIds();
    filtered = filtered.filter(s => likedIds.includes(s.id));
  }
  const mode = state.sortMode;
  const sorted = [...filtered];
  switch (mode) {
    case 'title': sorted.sort((a,b) => a.title.localeCompare(b.title)); break;
    case 'artist': sorted.sort((a,b) => a.artist.localeCompare(b.artist)); break;
    case 'likes': sorted.sort((a,b) => (b.likes||0)-(a.likes||0)); break;
    case 'views': sorted.sort((a,b) => (b.views||0)-(a.views||0)); break;
    default: break;
  }
  return sorted;
}

function renderSongs() {
  const grid = document.getElementById('songGrid');
  const empty = document.getElementById('emptyState');
  const filtered = getFilteredSongs();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = filtered.map(song => {
    const isCurrent = getState().currentSong && getState().currentSong.id === song.id;
    const isPlaying = isCurrent && getState().isPlaying;
    const thumbCdn = convertToCdnUrl(song.thumbnailUrl);
    const isLiked = userHasLiked(song.id);
    const hasVideo = song.videoUrl && song.videoType;
    return `
      <div class="song-card" data-id="${song.id}">
        <div class="thumbnail-wrapper">
          <img class="thumbnail" src="${thumbCdn}" alt="${escapeHtml(song.title)}" loading="lazy"
            onerror="this.src='https://placehold.co/300x300/181818/333?text=🎵'; this.style.opacity='0.7';" />
          <div class="play-overlay-icon"><i class="fas fa-play-circle"></i></div>
          ${hasVideo ? '<span style="position:absolute;top:6px;right:6px;font-size:0.6rem;background:rgba(0,0,0,0.7);padding:0.1rem 0.4rem;border-radius:var(--radius-full);color:var(--text-secondary);"><i class="fas fa-video"></i></span>' : ''}
        </div>
        <div class="title">${escapeHtml(song.title)}</div>
        <div class="artist">${escapeHtml(song.artist)}</div>
        <span class="category-badge">${escapeHtml(song.category || 'Uncategorized')}</span>
        <div class="card-actions">
          <button class="btn-icon play-btn" data-action="play" data-id="${song.id}">
            <i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
          </button>
          <button class="btn-icon like-btn ${isLiked ? 'liked' : ''}" data-action="like" data-id="${song.id}">
            <i class="fas fa-heart"></i>
          </button>
          <button class="btn-icon queue-btn" data-action="queue" data-id="${song.id}"><i class="fas fa-list"></i></button>
          <button class="btn-icon add-to-playlist" data-action="add" data-id="${song.id}"><i class="fas fa-plus"></i></button>
          <button class="btn-icon" data-action="download" data-id="${song.id}"><i class="fas fa-download"></i></button>
        </div>
        <div class="stats-row">
          <span><i class="fas fa-heart" style="color:#ef4444;"></i> ${song.likes||0}</span>
          <span><i class="fas fa-eye"></i> ${song.views||0}</span>
        </div>
      </div>
    `;
  }).join('');

  // Event bindings
  grid.querySelectorAll('[data-action="play"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = state.songs.find(s => s.id === btn.dataset.id);
      if (song) togglePlaySong(song);
    });
  });
  grid.querySelectorAll('[data-action="like"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLike(btn.dataset.id);
    });
  });
  grid.querySelectorAll('[data-action="queue"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToQueue(btn.dataset.id);
    });
  });
  grid.querySelectorAll('[data-action="add"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showAddToPlaylistPopup(btn.dataset.id, btn);
    });
  });
  grid.querySelectorAll('[data-action="download"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = state.songs.find(s => s.id === btn.dataset.id);
      if (song) handleDownload(song);
    });
  });
  grid.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', () => {
      const song = state.songs.find(s => s.id === card.dataset.id);
      if (song) playSong(song);
    });
  });
}

// --- Helper: toggle play song ---
function togglePlaySong(song) {
  if (getState().currentSong && getState().currentSong.id === song.id) {
    togglePlayPause();
  } else {
    playSong(song);
  }
}

// --- Recently played ---
const RECENT_KEY = 'melodify_recently_played';
function getRecentlyPlayed() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecentlyPlayed(recent) { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); }
function addToRecentlyPlayed(songId) {
  let recent = getRecentlyPlayed();
  recent = recent.filter(id => id !== songId);
  recent.unshift(songId);
  if (recent.length > 20) recent = recent.slice(0, 20);
  saveRecentlyPlayed(recent);
  renderRecentlyPlayed();
}

function renderRecentlyPlayed() {
  const container = document.getElementById('recentGrid');
  const empty = document.getElementById('recentEmpty');
  const ids = getRecentlyPlayed();
  if (ids.length === 0 || state.songs.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const songs = ids.map(id => state.songs.find(s => s.id === id)).filter(Boolean).slice(0, 20);
  if (songs.length === 0) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  container.innerHTML = songs.map(song => {
    const isCurrent = getState().currentSong && getState().currentSong.id === song.id;
    const isPlaying = isCurrent && getState().isPlaying;
    const thumbCdn = convertToCdnUrl(song.thumbnailUrl);
    return `
      <div class="song-card" data-id="${song.id}">
        <div class="thumbnail-wrapper">
          <img class="thumbnail" src="${thumbCdn}" alt="${escapeHtml(song.title)}" loading="lazy"
            onerror="this.src='https://placehold.co/300x300/181818/333?text=🎵'; this.style.opacity='0.7';" />
          <div class="play-overlay-icon"><i class="fas fa-play-circle"></i></div>
        </div>
        <div class="title">${escapeHtml(song.title)}</div>
        <div class="artist">${escapeHtml(song.artist)}</div>
        <div class="card-actions">
          <button class="btn-icon play-btn" data-action="recent-play" data-id="${song.id}">
            <i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
          </button>
          <button class="btn-icon queue-btn" data-action="recent-queue" data-id="${song.id}"><i class="fas fa-list"></i></button>
          <button class="btn-icon" data-action="recent-download" data-id="${song.id}"><i class="fas fa-download"></i></button>
        </div>
        <div class="played-time">Recently played</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-action="recent-play"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = state.songs.find(s => s.id === btn.dataset.id);
      if (song) togglePlaySong(song);
    });
  });
  container.querySelectorAll('[data-action="recent-queue"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToQueue(btn.dataset.id);
    });
  });
  container.querySelectorAll('[data-action="recent-download"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = state.songs.find(s => s.id === btn.dataset.id);
      if (song) handleDownload(song);
    });
  });
  container.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', () => {
      const song = state.songs.find(s => s.id === card.dataset.id);
      if (song) playSong(song);
    });
  });
}

// --- Recommendations ---
const HISTORY_KEY = 'melodify_play_history';
function getPlayHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch { return {}; }
}
function savePlayHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }
function incrementPlayCount(songId) {
  const h = getPlayHistory();
  h[songId] = (h[songId]||0) + 1;
  savePlayHistory(h);
  return h;
}

function getRecommendations(songs, limit = 6) {
  const history = getPlayHistory();
  const playedIds = Object.keys(history);
  if (playedIds.length === 0) return [];
  const categoryTotals = {};
  for (const song of songs) {
    const count = history[song.id] || 0;
    if (count > 0) {
      const cat = song.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + count;
    }
  }
  let topCategory = null, maxCount = 0;
  for (const [cat, count] of Object.entries(categoryTotals)) {
    if (count > maxCount) { maxCount = count; topCategory = cat; }
  }
  if (!topCategory) return [];
  const categorySongs = songs.filter(s => (s.category || 'Uncategorized') === topCategory)
    .sort((a,b) => (b.likes||0) - (a.likes||0));
  const unplayed = categorySongs.filter(s => !history[s.id] || history[s.id] === 0);
  const played = categorySongs.filter(s => history[s.id] && history[s.id] > 0);
  played.sort((a,b) => (history[a.id]||0) - (history[b.id]||0));
  return [...unplayed, ...played].slice(0, limit);
}

function renderRecommendations() {
  const grid = document.getElementById('recGrid');
  const empty = document.getElementById('recEmpty');
  const sub = document.getElementById('recSub');
  const history = getPlayHistory();
  const playedIds = Object.keys(history);
  if (playedIds.length === 0 || state.songs.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    sub.textContent = 'Start listening to get personalised recommendations!';
    return;
  }
  const recs = getRecommendations(state.songs, 6);
  if (recs.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    sub.textContent = 'No recommendations yet. Keep exploring!';
    return;
  }
  empty.classList.add('hidden');
  const catTotals = {};
  for (const song of state.songs) {
    const count = history[song.id] || 0;
    if (count > 0) {
      const cat = song.category || 'Uncategorized';
      catTotals[cat] = (catTotals[cat]||0) + count;
    }
  }
  let topCat = 'Unknown', maxC = 0;
  for (const [cat, count] of Object.entries(catTotals)) {
    if (count > maxC) { maxC = count; topCat = cat; }
  }
  sub.textContent = `Based on your love for "${topCat}" — here are some tracks you might enjoy.`;

  grid.innerHTML = recs.map(song => {
    const isCurrent = getState().currentSong && getState().currentSong.id === song.id;
    const isPlaying = isCurrent && getState().isPlaying;
    const thumbCdn = convertToCdnUrl(song.thumbnailUrl);
    const isLiked = userHasLiked(song.id);
    return `
      <div class="song-card" data-id="${song.id}">
        <div class="thumbnail-wrapper">
          <img class="thumbnail" src="${thumbCdn}" alt="${escapeHtml(song.title)}" loading="lazy"
            onerror="this.src='https://placehold.co/300x300/181818/333?text=🎵'; this.style.opacity='0.7';" />
          <div class="play-overlay-icon"><i class="fas fa-play-circle"></i></div>
        </div>
        <div class="title">${escapeHtml(song.title)}</div>
        <div class="artist">${escapeHtml(song.artist)}</div>
        <span class="category-badge">${escapeHtml(song.category || 'Uncategorized')}</span>
        <div class="card-actions">
          <button class="btn-icon play-btn" data-action="rec-play" data-id="${song.id}">
            <i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
          </button>
          <button class="btn-icon like-btn ${isLiked ? 'liked' : ''}" data-action="rec-like" data-id="${song.id}"><i class="fas fa-heart"></i></button>
          <button class="btn-icon queue-btn" data-action="rec-queue" data-id="${song.id}"><i class="fas fa-list"></i></button>
          <button class="btn-icon add-to-playlist" data-action="rec-add" data-id="${song.id}"><i class="fas fa-plus"></i></button>
          <button class="btn-icon" data-action="rec-download" data-id="${song.id}"><i class="fas fa-download"></i></button>
        </div>
        <div class="stats-row">
          <span><i class="fas fa-heart" style="color:#ef4444;"></i> ${song.likes||0}</span>
          <span><i class="fas fa-eye"></i> ${song.views||0}</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-action="rec-play"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = state.songs.find(s => s.id === btn.dataset.id);
      if (song) togglePlaySong(song);
    });
  });
  grid.querySelectorAll('[data-action="rec-like"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLike(btn.dataset.id);
    });
  });
  grid.querySelectorAll('[data-action="rec-queue"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToQueue(btn.dataset.id);
    });
  });
  grid.querySelectorAll('[data-action="rec-add"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showAddToPlaylistPopup(btn.dataset.id, btn);
    });
  });
  grid.querySelectorAll('[data-action="rec-download"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = state.songs.find(s => s.id === btn.dataset.id);
      if (song) handleDownload(song);
    });
  });
  grid.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', () => {
      const song = state.songs.find(s => s.id === card.dataset.id);
      if (song) playSong(song);
    });
  });
}

// --- Likes ---
const LIKES_KEY = 'melodify_user_likes';
function getLikedSongs() {
  try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch { return {}; }
}
function saveLikedSongs(l) { localStorage.setItem(LIKES_KEY, JSON.stringify(l)); }
function userHasLiked(songId) { return !!getLikedSongs()[songId]; }
function getLikedSongIds() { return Object.keys(getLikedSongs()); }
function toggleUserLike(songId) {
  const likes = getLikedSongs();
  if (likes[songId]) { delete likes[songId]; saveLikedSongs(likes); return false; }
  else { likes[songId] = true; saveLikedSongs(likes); return true; }
}

async function toggleLike(songId) {
  const song = state.songs.find(s => s.id === songId);
  if (!song) return;
  const wasLiked = userHasLiked(songId);
  const nowLiked = toggleUserLike(songId);
  updateLikeUI(songId, nowLiked);
  updateFavCount();
  try {
    const songRef = doc(db, 'songs', songId);
    if (nowLiked) { await updateDoc(songRef, { likes: increment(1) }); song.likes = (song.likes||0)+1; }
    else { await updateDoc(songRef, { likes: increment(-1) }); song.likes = Math.max(0, (song.likes||0)-1); }
    updateStats(); renderAll();
    showToast(nowLiked ? '❤️ Liked!' : '💔 Unliked!', 'success');
  } catch (err) {
    console.error(err);
    toggleUserLike(songId);
    updateLikeUI(songId, wasLiked);
    updateFavCount();
    showToast('Failed to update like.', 'error');
  }
}

function update
