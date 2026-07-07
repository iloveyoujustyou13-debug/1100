/* ============================================================
   FILE: js/auth.js
   ============================================================ */
import { auth, googleProvider, ADMIN_EMAIL } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';

let authStateListeners = [];

export function onAuthState(callback) {
  authStateListeners.push(callback);
  return onAuthStateChanged(auth, (user) => {
    authStateListeners.forEach(fn => fn(user));
  });
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signupWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred;
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result;
}

export async function logoutUser() {
  await signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}

// Store user ID locally for likes etc.
const USER_ID_KEY = 'melodify_user_id';
export function getLocalUserId() {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}
