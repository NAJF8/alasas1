import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDO4QHtOT0HQ-t7CgbdwDfgTuYPni23Vxc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'al-asas-dental-staging.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'al-asas-dental-staging',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'al-asas-dental-staging.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '915871985225',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:915871985225:web:882308a631a4ef87df9998',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);
export const configurationError = null;
export const getOAuthRedirectUrl = () => new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();

export const apiBaseUrl = (import.meta.env.VITE_FIREBASE_BACKEND_URL || 'https://alasas-dental-staging-worker.coffee101.workers.dev').replace(/\/$/, '');
