// FILE: js/firebase-config.js (মোবাইল ভার্সন - সরাসরি এপিআই কী বসানো)

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// =====================================================
// এখানে সরাসরি আপনার আসল কনফিগ ডেটা বসিয়ে দিন
// =====================================================
const firebaseConfig = {
  apiKey: "AIzaSyBYFY3eNn69NG54PsIvJkOwh2UMeTpJVdU",
  authDomain: "melodify-85954.firebaseapp.com",
  projectId: "melodify-85954",
  storageBucket: "melodify-85954.firebasestorage.app",
  messagingSenderId: "635746561853",
  appId: "1:635746561853:web:fcc711d983cc9332f89f54"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  client_id: '635746561853-62pjvjs4mt6hjh4dspl8on1uo5pcbejj.apps.googleusercontent.com'
});

export const ADMIN_EMAIL = 'gamingmanojit14@gmail.com';
