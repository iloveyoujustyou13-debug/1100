/* ============================================================
   FILE: js/playlist.js
   ============================================================ */
import { showToast } from './utils.js';

const PLAYLISTS_KEY = 'melodify_playlists';
let playlists = [];

export function loadPlaylists() {
  try {
    const data = localStorage.getItem(PLAYLISTS_KEY);
    playlists = data ? JSON.parse(data) : [];
  } catch { playlists = []; }
  return playlists;
}

export function savePlaylists() {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function getPlaylists() {
  return playlists;
}

export function getPlaylistById(id) {
  return playlists.find(p => p.id === id);
}

export function createPlaylist(name) {
  const id = 'pl_' + Date.now();
  const playlist = { id, name: name.trim(), songs: [] };
  playlists.push(playlist);
  savePlaylists();
  showToast(`Playlist "${name}" created.`, 'success');
  return playlist;
}

export function deletePlaylist(id) {
  if (!confirm('Delete this playlist?')) return false;
  playlists = playlists.filter(p => p.id !== id);
  savePlaylists();
  showToast('Playlist deleted.', 'info');
  return true;
}

export function addSongToPlaylist(playlistId, songId) {
  const playlist = getPlaylistById(playlistId);
  if (!playlist) { showToast('Playlist not found.', 'error'); return false; }
  if (playlist.songs.includes(songId)) { showToast('Song already in playlist.', 'info'); return false; }
  playlist.songs.push(songId);
  savePlaylists();
  showToast('Song added to playlist.', 'success');
  return true;
}

export function removeSongFromPlaylist(playlistId, songId) {
  const playlist = getPlaylistById(playlistId);
  if (!playlist) return false;
  playlist.songs = playlist.songs.filter(id => id !== songId);
  savePlaylists();
  showToast('Song removed from playlist.', 'info');
  return true;
}

export function getPlaylistSongs(playlistId) {
  const playlist = getPlaylistById(playlistId);
  return playlist ? playlist.songs : [];
}
