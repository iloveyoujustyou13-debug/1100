/* ============================================================
   FILE: js/utils.js
   ============================================================ */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function convertToCdnUrl(url) {
  if (!url) return url;
  if (url.includes('cdn.jsdelivr.net/gh/')) return url;
  const rawMatch = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
  if (rawMatch) {
    const [, username, repo, branch, path] = rawMatch;
    return `https://cdn.jsdelivr.net/gh/${username}/${repo}@${branch}/${path}`;
  }
  return url;
}

export function buildCdnLink(owner, repo, branch, filename) {
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${filename}`;
}

export function generateRandomCounts() {
  let views, likes, downloads;
  do {
    views = Math.floor(Math.random() * 4000) + 1000;
    likes = Math.floor(Math.random() * 4000) + 1000;
    downloads = Math.floor(Math.random() * 4000) + 1000;
  } while (!(views > likes && likes > downloads));
  return { views, likes, downloads };
}

export function extractTitleArtistFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  if (base.includes(' - ')) {
    const parts = base.split(' - ');
    return { title: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() };
  }
  return { title: base.trim(), artist: '' };
}

export function getUserId() {
  const KEY = 'melodify_user_id';
  let uid = localStorage.getItem(KEY);
  if (!uid) {
    uid = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(KEY, uid);
  }
  return uid;
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function showToast(message, type = 'info', containerId = 'toastContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = '0.25s ease';
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}
