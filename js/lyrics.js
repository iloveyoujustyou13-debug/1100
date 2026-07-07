/* ============================================================
   FILE: js/lyrics.js
   ============================================================ */
import { showToast } from './utils.js';

let lyricsState = {
  currentSongId: null,
  lines: [],
  activeIndex: -1,
  fontScale: 1.0,
  searchQuery: '',
  isMinimized: false,
  isFullscreen: false,
  isVisible: false,
  editingSongId: null,
  unsavedChanges: false,
  undoStack: [],
  redoStack: [],
};

let lyricsCallbacks = {};

export function initLyrics(callbacks) {
  lyricsCallbacks = { ...lyricsCallbacks, ...callbacks };
  loadState();
  return lyricsState;
}

function loadState() {
  try {
    const data = localStorage.getItem('melodify_lyrics_state');
    if (data) {
      const parsed = JSON.parse(data);
      Object.assign(lyricsState, parsed);
    }
  } catch (e) {}
}

function saveState() {
  try {
    const data = {
      fontScale: lyricsState.fontScale,
      isVisible: lyricsState.isVisible,
      isMinimized: lyricsState.isMinimized,
      isFullscreen: lyricsState.isFullscreen,
    };
    localStorage.setItem('melodify_lyrics_state', JSON.stringify(data));
  } catch (e) {}
}

export function parseLrc(text) {
  const lines = [];
  const raw = text.split('\n');
  const timestampRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;
  let plainTextLines = [];

  for (const line of raw) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(timestampRegex);
    if (match) {
      if (plainTextLines.length > 0) {
        const plainText = plainTextLines.join(' ');
        lines.push({ timestamp: null, text: plainText, valid: true, duplicate: false });
        plainTextLines = [];
      }
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const cent = parseInt(match[3]);
      const timestamp = mins * 60 + secs + cent / 100;
      const text = trimmed.replace(timestampRegex, '').trim() || '';
      lines.push({ timestamp, text, valid: true, duplicate: false });
    } else {
      plainTextLines.push(trimmed);
    }
  }

  if (plainTextLines.length > 0) {
    const plainText = plainTextLines.join(' ');
    lines.push({ timestamp: null, text: plainText, valid: true, duplicate: false });
  }

  const timestamps = new Set();
  for (const line of lines) {
    if (line.timestamp !== null) {
      const key = line.timestamp.toFixed(2);
      if (timestamps.has(key)) line.duplicate = true;
      else timestamps.add(key);
    }
  }

  lines.sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) return 0;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return a.timestamp - b.timestamp;
  });

  return { lines };
}

export function formatTimestamp(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '--:--.--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const cent = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
}

export function parseTimestamp(str) {
  const match = str.match(/^(\d{2}):(\d{2})\.(\d{2})$/);
  if (!match) return null;
  const mins = parseInt(match[1]);
  const secs = parseInt(match[2]);
  const cent = parseInt(match[3]);
  if (isNaN(mins) || isNaN(secs) || isNaN(cent)) return null;
  if (secs >= 60 || cent >= 100) return null;
  return mins * 60 + secs + cent / 100;
}

export function convertLyricsToLrc(text) {
  const lines = text.split('\n');
  const timestampRegex = /(\d{2}):(\d{2})\.(\d{2})/;
  let output = [];
  let plainBuffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(timestampRegex);
    if (match) {
      if (plainBuffer.length > 0) {
        output.push(plainBuffer.join(' '));
        plainBuffer = [];
      }
      output.push(trimmed);
    } else {
      plainBuffer.push(trimmed);
    }
  }
  if (plainBuffer.length > 0) output.push(plainBuffer.join(' '));
  return output.join('\n');
}

export function updateActiveLyric(currentTime) {
  if (lyricsState.lines.length === 0) return;
  let activeIdx = -1;
  for (let i = 0; i < lyricsState.lines.length; i++) {
    const line = lyricsState.lines[i];
    if (line.timestamp !== null && line.timestamp <= currentTime) {
      activeIdx = i;
    }
  }
  if (activeIdx !== lyricsState.activeIndex) {
    lyricsState.activeIndex = activeIdx;
    if (lyricsCallbacks.onLyricUpdate) {
      lyricsCallbacks.onLyricUpdate(activeIdx, lyricsState.lines);
    }
  }
}

export function setLyricsForSong(songId, lines) {
  lyricsState.currentSongId = songId;
  lyricsState.lines = lines || [];
  lyricsState.activeIndex = -1;
}

export function clearLyrics() {
  lyricsState.lines = [];
  lyricsState.activeIndex = -1;
  lyricsState.currentSongId = null;
}

export function toggleLyricsWindow() {
  lyricsState.isVisible = !lyricsState.isVisible;
  saveState();
  return lyricsState.isVisible;
}

export function getLyricsState() {
  return lyricsState;
}

export function undoLyricsEdit() {
  if (lyricsState.undoStack.length === 0) return;
  const current = JSON.stringify(lyricsState.lines);
  lyricsState.redoStack.push(current);
  const prev = lyricsState.undoStack.pop();
  try {
    lyricsState.lines = JSON.parse(prev);
    lyricsState.unsavedChanges = true;
    return true;
  } catch (e) { return false; }
}

export function redoLyricsEdit() {
  if (lyricsState.redoStack.length === 0) return;
  const current = JSON.stringify(lyricsState.lines);
  lyricsState.undoStack.push(current);
  const next = lyricsState.redoStack.pop();
  try {
    lyricsState.lines = JSON.parse(next);
    lyricsState.unsavedChanges = true;
    return true;
  } catch (e) { return false; }
}
