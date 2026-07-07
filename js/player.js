/* ============================================================
   FILE: js/player.js
   ============================================================ */
import { formatTime, convertToCdnUrl, showToast } from './utils.js';

let audio = null;
let state = {
  currentSong: null,
  currentIndex: -1,
  isPlaying: false,
  songs: [],
  shuffleMode: false,
  repeatMode: 'none', // 'none' | 'all' | 'one'
};

let playerCallbacks = {
  onPlay: null,
  onPause: null,
  onEnded: null,
  onTimeUpdate: null,
  onSongChange: null,
};

export function initPlayer(songs, audioElement) {
  audio = audioElement;
  state.songs = songs;
  setupAudioEvents();
  return state;
}

function setupAudioEvents() {
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const progress = (audio.currentTime / audio.duration) * 100;
      if (playerCallbacks.onTimeUpdate) {
        playerCallbacks.onTimeUpdate(audio.currentTime, audio.duration, progress);
      }
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (playerCallbacks.onTimeUpdate && audio.duration) {
      playerCallbacks.onTimeUpdate(audio.currentTime, audio.duration, 0);
    }
  });

  audio.addEventListener('ended', () => {
    state.isPlaying = false;
    if (playerCallbacks.onEnded) {
      playerCallbacks.onEnded();
    }
    if (state.repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    const next = getNextSong();
    if (next) {
      playSong(next);
    } else if (state.repeatMode === 'all' && state.songs.length > 0) {
      playSong(state.songs[0]);
    } else {
      // ended
    }
  });

  audio.addEventListener('error', () => {
    showToast('Audio playback error.', 'error');
    state.isPlaying = false;
    if (playerCallbacks.onPause) playerCallbacks.onPause();
  });
}

export function setSongs(songs) {
  state.songs = songs;
}

export function getState() {
  return state;
}

export function getAudio() {
  return audio;
}

export function setCallbacks(callbacks) {
  playerCallbacks = { ...playerCallbacks, ...callbacks };
}

export function playSong(song, fromIndex = -1) {
  if (!song || !song.audioUrl) { showToast('Song URL not available.', 'error'); return; }
  const cdnUrl = convertToCdnUrl(song.audioUrl);

  if (state.currentSong && state.currentSong.id === song.id) {
    togglePlayPause();
    return;
  }

  state.currentSong = song;
  state.currentIndex = fromIndex >= 0 ? fromIndex : state.songs.findIndex(s => s.id === song.id);

  audio.src = cdnUrl;
  audio.load();
  audio.play().then(() => {
    state.isPlaying = true;
    if (playerCallbacks.onPlay) playerCallbacks.onPlay(song);
    if (playerCallbacks.onSongChange) playerCallbacks.onSongChange(song);
  }).catch((err) => {
    console.error('Playback error:', err);
    showToast('Unable to play. Check audio URL.', 'error');
  });
}

export function togglePlayPause() {
  if (!state.currentSong) return;
  if (audio.paused) {
    audio.play().then(() => {
      state.isPlaying = true;
      if (playerCallbacks.onPlay) playerCallbacks.onPlay(state.currentSong);
    }).catch(() => {});
  } else {
    audio.pause();
    state.isPlaying = false;
    if (playerCallbacks.onPause) playerCallbacks.onPause();
  }
}

export function getNextSong() {
  const songs = state.songs;
  const currentIdx = state.currentIndex;

  if (state.shuffleMode) {
    const available = songs.filter(s => s.id !== state.currentSong?.id);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  if (currentIdx === -1) return songs[0] || null;
  const nextIdx = (currentIdx + 1) % songs.length;
  if (nextIdx === currentIdx) return null;
  return songs[nextIdx] || null;
}

export function playNext() {
  if (state.songs.length === 0) return;
  const next = getNextSong();
  if (next) playSong(next);
  else if (state.songs.length > 0) playSong(state.songs[0]);
}

export function playPrev() {
  if (state.songs.length === 0) return;
  let idx = state.currentIndex > 0 ? state.currentIndex - 1 : state.songs.length - 1;
  if (state.shuffleMode) {
    const available = state.songs.filter(s => s.id !== state.currentSong?.id);
    if (available.length > 0) {
      const song = available[Math.floor(Math.random() * available.length)];
      if (song) playSong(song);
      return;
    }
  }
  const song = state.songs[idx];
  if (song) playSong(song);
}

export function seekTo(seconds) {
  if (audio && audio.duration) {
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
  }
}

export function getCurrentTime() {
  return audio ? audio.currentTime : 0;
}

export function getDuration() {
  return audio ? audio.duration : 0;
}

export function toggleShuffle() {
  state.shuffleMode = !state.shuffleMode;
  return state.shuffleMode;
}

export function toggleRepeat() {
  if (state.repeatMode === 'none') state.repeatMode = 'all';
  else if (state.repeatMode === 'all') state.repeatMode = 'one';
  else state.repeatMode = 'none';
  return state.repeatMode;
}

export function setVolume(vol) {
  if (audio) audio.volume = Math.max(0, Math.min(1, vol));
}

export function getVolume() {
  return audio ? audio.volume : 0.8;
}

export function resetPlayer() {
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  state.isPlaying = false;
  state.currentSong = null;
  state.currentIndex = -1;
    }
