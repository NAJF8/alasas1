import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const requiredEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  backendUrl: import.meta.env.VITE_FIREBASE_BACKEND_URL,
} as Record<string, string | undefined>;

// No silent production defaults: a build without explicit Firebase/Worker
// configuration must fail loudly instead of reading or writing production.
const missingEnv = Object.entries(requiredEnv).filter(([, value]) => !value).map(([key]) => key);
if (missingEnv.length) {
  throw new Error(`Missing Firebase environment configuration: ${missingEnv.join(', ')}. Set the VITE_FIREBASE_* variables (see .env.example).`);
}

const config = {
  apiKey: requiredEnv.apiKey,
  authDomain: requiredEnv.authDomain,
  projectId: requiredEnv.projectId,
  storageBucket: requiredEnv.storageBucket,
  messagingSenderId: requiredEnv.messagingSenderId,
  appId: requiredEnv.appId,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);
export const configurationError = null;
export const getOAuthRedirectUrl = () => new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();

export const apiBaseUrl = (requiredEnv.backendUrl as string).replace(/\/$/, '');
