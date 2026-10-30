import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, RecaptchaVerifier, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithCustomToken, signInWithEmailLink, signInWithPhoneNumber, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { apiBaseUrl, auth, authPersistenceReady, db } from '../lib/firebase';
import { AUTH_INTENT_TTL_MS, isFreshRegistrationCandidate, isValidRegistrationIntent, type RegistrationIntent } from './authRegistrationSecurity';
import { formatPhoneAuthError, normalizeIraqiPhone } from '../lib/phoneAuth';
import { isProfileComplete, type CustomerRole, type Profile } from '../lib/profileValidation';

export type { CustomerRole, Profile };
export { isProfileComplete };
export type AuthFlow = 'login' | 'register';
export const AUTH_INTENT_KEY = 'customer-app:auth-intent';
type AuthIntent = RegistrationIntent;
export const readAuthIntent = (): AuthIntent | null => { try { const raw = localStorage.getItem(AUTH_INTENT_KEY); if (!raw) return null; const intent = JSON.parse(raw) as AuthIntent; if (!intent || !['login', 'register'].includes(intent.flow) || !Number.isSafeInteger(intent.createdAt) || Date.now() - intent.createdAt > AUTH_INTENT_TTL_MS || (intent.flow === 'register' && !isValidRegistrationIntent(intent))) { localStorage.removeItem(AUTH_INTENT_KEY); return null; } return intent; } catch { localStorage.removeItem(AUTH_INTENT_KEY); return null; } };
export const clearAuthIntent = () => { localStorage.removeItem(AUTH_INTENT_KEY); sessionStorage.removeItem('customer-app:auth-flow'); sessionStorage.removeItem('customer-app:intended-role'); };
interface AuthContextValue { user: User | null; profile: Profile | null; loading: boolean; profileError: string | null; signInWithGoogle: (flow?: AuthFlow, role?: CustomerRole) => Promise<string | null>; signInWithPhonePassword: (phone: string, password: string) => Promise<string | null>; sendPhoneOtp: (phone: string, flow?: AuthFlow, role?: CustomerRole) => Promise<string | null>; verifyPhoneOtp: (phone: string, token: string) => Promise<string | null>; sendEmailOtp: (email: string) => Promise<string | null>; signOut: () => Promise<void>; refreshProfile: () => Promise<Profile | null>; authNotice: string | null; }
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const asProfile = (value: any, id: string): Profile => ({ id, ...value, preferred_university_ids: value.preferred_university_ids || [], created_at: value.created_at || new Date().toISOString(), updated_at: value.updated_at || new Date().toISOString() }) as Profile;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null); const [profile, setProfile] = useState<Profile | null>(null); const [loading, setLoading] = useState(true); const [profileError, setProfileError] = useState<string | null>(null); const [authNotice, setAuthNotice] = useState<string | null>(null); const userLoadId = useRef(0);
  const fetchProfile = useCallback(async (uid: string) => { const snapshot = await getDoc(doc(db, 'profiles', uid)); if (!snapshot.exists()) return null; const next = asProfile(snapshot.data(), uid); const table = next.role === 'PATIENT' ? 'patient_preferred_universities' : next.role === 'STUDENT' ? 'student_preferred_universities' : null; if (table) { const preferences = await getDocs(query(collection(db, table), where(next.role === 'PATIENT' ? 'patient_id' : 'student_id', '==', uid))); next.preferred_university_ids = preferences.docs.map((item) => item.data().university_id as string); } return next; }, []);
  const handleUser = useCallback(async (nextUser: User | null) => {
    const loadId = ++userLoadId.current;
    setUser(nextUser);
    setAuthNotice(null);
    setProfileError(null);
    if (!nextUser) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    try {
      const nextProfile = await fetchProfile(nextUser.uid);
      if (loadId !== userLoadId.current) return;
      const intent = readAuthIntent();
      if (intent?.flow === 'register' && intent.role && nextProfile && isFreshRegistrationCandidate(nextUser as any, intent, nextProfile.created_at) && !isProfileComplete(nextProfile)) clearAuthIntent(); else if (intent) clearAuthIntent();
      setProfile(nextProfile);
    } catch (error) {
      if (loadId !== userLoadId.current) return;
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : 'تعذر تحميل ملف الحساب. تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      if (loadId === userLoadId.current) setLoading(false);
    }
  }, [fetchProfile]);
  useEffect(() => { let active = true; let unsubscribe: () => void = () => undefined; void authPersistenceReady.then(() => { if (active) unsubscribe = onAuthStateChanged(auth, (nextUser) => { if (nextUser) Object.assign(nextUser, { id: nextUser.uid, user_metadata: { full_name: nextUser.displayName, name: nextUser.displayName } }); void handleUser(nextUser); }); }).catch(() => { if (active) { setProfileError('تعذر تهيئة جلسة الحساب. أعد تحميل الصفحة وحاول مرة أخرى.'); setLoading(false); } }); return () => { active = false; unsubscribe(); }; }, [handleUser]);
  useEffect(() => { if (!isSignInWithEmailLink(auth, window.location.href)) return; const email = localStorage.getItem('customer-app:email-link'); if (!email) return; void signInWithEmailLink(auth, email, window.location.href).then(() => localStorage.removeItem('customer-app:email-link')).catch(() => setAuthNotice('تعذر إكمال رابط البريد الإلكتروني. أعد إرسال الرابط.')); }, []);
  const signInWithGoogle = async (flow: AuthFlow = 'login', role?: CustomerRole) => { setAuthNotice(null); localStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({ flow, ...(role ? { role } : {}), createdAt: Date.now(), nonce: crypto.randomUUID() })); try { await signInWithPopup(auth, new GoogleAuthProvider()); return null; } catch (error) { clearAuthIntent(); return error instanceof Error ? error.message : 'تعذر تسجيل الدخول باستخدام Google.'; } };
  const signInWithPhonePassword = async (phone: string, password: string) => { const normalized = normalizeIraqiPhone(phone); if (!normalized) return 'أدخل رقماً عراقياً صحيحاً بصيغة 07XXXXXXXXX.'; if (!password.trim()) return 'أدخل كلمة المرور.'; try { const response = await fetch(`${apiBaseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized, password }) }); const result = await response.json().catch(() => ({})); if (!response.ok) return result.error === 'ACCOUNT_PENDING' ? 'حسابك قيد المراجعة. ستتمكن من الدخول بعد اعتماد الطلب.' : result.error === 'ACCOUNT_SUSPENDED' ? 'هذا الحساب موقوف. تواصل مع إدارة المنصة.' : 'رقم الهاتف أو كلمة المرور غير صحيحة.'; if (!result.custom_token) return 'لم يؤكد الخادم إنشاء جلسة آمنة.'; await signInWithCustomToken(auth, result.custom_token); return null; } catch (error) { return error instanceof TypeError ? 'تعذر الاتصال بالخادم. تحقق من الشبكة ثم حاول تسجيل الدخول مرة أخرى.' : 'تعذر تسجيل الدخول حالياً. حاول مرة أخرى.'; } };
  const sendPhoneOtp = async (phone: string, flow: AuthFlow = 'login', role?: CustomerRole) => { const normalized = normalizeIraqiPhone(phone); if (!normalized) return 'أدخل رقماً عراقياً صحيحاً بصيغة 07XXXXXXXXX.'; localStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({ flow, ...(role ? { role } : {}), createdAt: Date.now(), nonce: crypto.randomUUID() })); try { const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' }); (window as any).__dentalConfirmation = await signInWithPhoneNumber(auth, normalized, verifier); return null; } catch (error) { return formatPhoneAuthError(error instanceof Error ? error.message : 'تعذر إرسال رمز الهاتف.'); } };
  const verifyPhoneOtp = async (_phone: string, token: string) => { if (!/^\d{6}$/.test(token.trim())) return 'أدخل رمز التحقق المكوّن من 6 أرقام.'; try { await (window as any).__dentalConfirmation?.confirm(token.trim()); return null; } catch (error) { return formatPhoneAuthError(error instanceof Error ? error.message : 'رمز التحقق غير صحيح.'); } };
  const sendEmailOtp = async (email: string) => { const normalized = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'أدخل بريداً إلكترونياً صحيحاً.'; try { await sendSignInLinkToEmail(auth, normalized, { url: `${window.location.origin}/login`, handleCodeInApp: true }); localStorage.setItem('customer-app:email-link', normalized); return null; } catch { return 'تعذر إرسال رابط الدخول. تحقق من إعدادات Firebase Auth.'; } };
  const refreshProfile = useCallback(async () => { if (!user) return null; setProfileError(null); try { const next = await fetchProfile(user.uid); setProfile(next); return next; } catch (error) { setProfileError(error instanceof Error ? error.message : 'تعذر تحميل ملف الحساب. تحقق من الاتصال ثم أعد المحاولة.'); return null; } }, [fetchProfile, user]);
  return <AuthContext.Provider value={{ user, profile, loading, profileError, authNotice, signInWithGoogle, signInWithPhonePassword, sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, signOut: async () => { clearAuthIntent(); await firebaseSignOut(auth); }, refreshProfile }}>{children}<div id="recaptcha-container" /></AuthContext.Provider>;
};
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context; };
