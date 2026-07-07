/* ============================================================
   FILE: js/upload.js
   ============================================================ */
import { db } from './firebase-config.js';
import { collection, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { generateRandomCounts, convertToCdnUrl, readFileAsBase64, buildCdnLink, showToast } from './utils.js';
import { getGhCredsFromForm, uploadFileToGitHub } from './admin.js'; // will be defined

export async function uploadSingleSong(data) {
  const { title, artist, category, audioUrl, thumbUrl, lyrics } = data;
  const { views, likes, downloads } = generateRandomCounts();
  const songData = {
    title: title.trim(),
    artist: artist.trim(),
    category: category.trim(),
    thumbnailUrl: convertToCdnUrl(thumbUrl),
    audioUrl: convertToCdnUrl(audioUrl),
    lyrics: lyrics || '',
    downloads,
    likes,
    views,
    uploadDate: Timestamp.now(),
    lyricsUrl: '',
    videoUrl: null,
    videoType: null,
  };
  const docRef = await addDoc(collection(db, 'songs'), songData);

  // If lyrics provided, try to upload to CDN
  if (lyrics && lyrics.trim()) {
    try {
      const creds = getGhCredsFromForm();
      if (creds.token && creds.owner && creds.repo) {
        const lrcContent = convertLyricsToLrc(lyrics);
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
        const safeArtist = artist.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safeTitle}_${safeArtist}.lrc`;
        await uploadFileToGitHub(creds.token, creds.owner, creds.repo, creds.branch, filename,
          btoa(unescape(encodeURIComponent(lrcContent))), `Add lyrics: ${title}`, () => {});
        const cdnUrl = buildCdnLink(creds.owner, creds.repo, creds.branch, filename);
        await updateDoc(docRef, { lyricsUrl: cdnUrl });
      }
    } catch (e) { console.warn('Lyrics upload failed:', e); }
  }

  return docRef.id;
}
