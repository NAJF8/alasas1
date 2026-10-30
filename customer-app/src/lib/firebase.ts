import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDRTjsQ40m3atrNEc7MCp_j0FZOAKe4FRc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'al-asas-dental-prod.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'al-asas-dental-prod',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'al-asas-dental-prod.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '601386969849',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:601386969849:web:4c05dcc7dc3f81e5bc9028',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);
export const configurationError = null;
export const getOAuthRedirectUrl = () => new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();

export const apiBaseUrl = (import.meta.env.VITE_FIREBASE_BACKEND_URL || 'https://alasas-dental-prod-worker.coffee101.workers.dev').replace(/\/$/, '');
