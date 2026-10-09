import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getOAuthRedirectUrl, supabase } from '../lib/supabase';
import { AUTH_INTENT_TTL_MS, isFreshRegistrationCandidate, isValidRegistrationIntent, type RegistrationIntent } from './authRegistrationSecurity';
import { formatPhoneAuthError, normalizeIraqiPhone } from '../lib/phoneAuth';

export type CustomerRole = 'PATIENT' | 'STUDENT';

export interface Profile {
  id: string;
  role: CustomerRole | 'ADMIN' | 'SUPER_ADMIN' | 'STAFF';
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
  full_name: string;
  phone: string;
  whatsapp: string | null;
  gender: string | null;
  birth_date: string | null;
  province_id: string | null;
  area_id: string | null;
  university_id: string | null;
  stage: string | null;
  workplace: string | null;
  preferred_university_ids?: string[];
  created_at: string;
  updated_at: string;
}

export type AuthFlow = 'login' | 'register';

export const AUTH_INTENT_KEY = 'customer-app:auth-intent';
type AuthIntent = RegistrationIntent;

export const readAuthIntent = (): AuthIntent | null => {
  try {
    const raw = localStorage.getItem(AUTH_INTENT_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as AuthIntent;
    if (!intent || !['login', 'register'].includes(intent.flow) || !Number.isSafeInteger(intent.createdAt) || Date.now() - intent.createdAt > AUTH_INTENT_TTL_MS) {
      localStorage.removeItem(AUTH_INTENT_KEY);
      return null;
    }
    if (intent.flow === 'register' && !isValidRegistrationIntent(intent)) {
      localStorage.removeItem(AUTH_INTENT_KEY);
      return null;
    }
    return intent;
  } catch {
    localStorage.removeItem(AUTH_INTENT_KEY);
    return null;
  }
};

export const clearAuthIntent = () => {
  localStorage.removeItem(AUTH_INTENT_KEY);
  sessionStorage.removeItem('customer-app:auth-flow');
  sessionStorage.removeItem('customer-app:intended-role');
};

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: (flow?: AuthFlow, role?: CustomerRole) => Promise<string | null>;
  sendPhoneOtp: (phone: string, flow?: AuthFlow, role?: CustomerRole) => Promise<string | null>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<string | null>;
  sendEmailOtp: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  saveOnboarding: (values: Partial<Profile> & { role: CustomerRole }) => Promise<string | null>;
  refreshProfile: () => Promise<Profile | null>;
  authNotice: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const PROFILE_FIELDS = 'id, role, status, full_name, phone, whatsapp, gender, birth_date, province_id, area_id, university_id, stage, workplace, created_at, updated_at';

const metadataName = (user: User) =>
  user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'مستخدم جديد';

export const isProfileComplete = (profile: Profile | null) => {
  if (!profile || (profile.role !== 'PATIENT' && profile.role !== 'STUDENT')) return false;
  if (!profile.phone || !profile.province_id || !profile.preferred_university_ids?.length) return false;
  if (profile.role === 'STUDENT') return Boolean(profile.university_id && profile.stage);
  return true;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const profileCache = useRef(new Map<string, Profile | null>());
  const profileInFlight = useRef(new Map<string, Promise<Profile | null>>());
  const fetchProfile = useCallback(async (userId: string, force = false) => {
    if (!force && profileCache.current.has(userId)) return profileCache.current.get(userId) || null;
    if (!force && profileInFlight.current.has(userId)) return profileInFlight.current.get(userId) || null;
    const request = (async () => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle();
      if (error) { if (error.code !== 'PGRST116') console.error('Profile fetch error:', error.message); profileCache.current.set(userId, null); return null; }
      if (!data) { profileCache.current.set(userId, null); return null; }
      const profile = data as Profile;
      if (profile.role === 'PATIENT' || profile.role === 'STUDENT') {
        const table = profile.role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities';
        const column = profile.role === 'PATIENT' ? 'patient_id' : 'student_id';
        const { data: preferences, error: preferenceError } = await supabase.from(table).select('university_id').eq(column, userId);
        if (preferenceError) console.error('Preferred universities fetch error:', preferenceError.message);
        profile.preferred_university_ids = (preferences || []).map((row) => row.university_id as string);
      }
      profileCache.current.set(userId, profile);
      return profile;
    })();
    profileInFlight.current.set(userId, request);
    try { return await request; } finally { profileInFlight.current.delete(userId); }
  }, []);

  const handleSession = useCallback(async (session: Session | null) => {
    setUser(session?.user ?? null);
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let nextProfile = await fetchProfile(session.user.id);
    const intent = readAuthIntent();
    if (intent?.flow === 'register' && intent.role) {
      const freshCandidate = isFreshRegistrationCandidate(session.user, intent, nextProfile?.created_at);
      const customerProfile = nextProfile && (nextProfile.role === 'PATIENT' || nextProfile.role === 'STUDENT') ? nextProfile : null;
      if (customerProfile && freshCandidate && !isProfileComplete(customerProfile)) {
        if (customerProfile.role !== intent.role) {
        const { error: roleError } = await supabase.from('profiles').update({ role: intent.role }).eq('id', session.user.id);
        if (roleError) console.error('Registration role resolution error:', roleError.message);
        else {
          nextProfile = await fetchProfile(session.user.id, true);
          clearAuthIntent();
        }
        } else {
          clearAuthIntent();
        }
      } else if (customerProfile) {
        const roleMismatch = Boolean(intent?.role && intent.role !== customerProfile.role);
        clearAuthIntent();
        if (roleMismatch) setAuthNotice(`هذا الحساب مسجل كـ${customerProfile.role === 'PATIENT' ? 'مريض' : 'طالب طب أسنان'}؛ تم الحفاظ على دوره الحالي.`);
      } else if (intent && !freshCandidate) {
        clearAuthIntent();
        setAuthNotice('تعذر ربط نية التسجيل بهذا الحساب. اختر نوع الحساب المطابق أو سجّل الخروج أولاً.');
      }
    }
    setProfile(nextProfile);
    setLoading(false);
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const nextProfile = await fetchProfile(user.id, true);
    setProfile(nextProfile);
    return nextProfile;
  }, [fetchProfile, user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));
    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signInWithGoogle = async (flow: AuthFlow = 'login', role?: CustomerRole) => {
    setAuthNotice(null);
    localStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({ flow, ...(role ? { role } : {}), createdAt: Date.now(), nonce: crypto.randomUUID() }));
    sessionStorage.removeItem('customer-app:auth-flow');
    sessionStorage.removeItem('customer-app:intended-role');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirectUrl(),
        ...(flow === 'register' ? { queryParams: { prompt: 'select_account' } } : {}),
      },
    });
    if (error) {
      clearAuthIntent();
    }
    return error?.message ?? null;
  };

  const sendPhoneOtp = async (phone: string) => {
    const normalized = normalizeIraqiPhone(phone);
    if (!normalized) return 'أدخل رقماً عراقياً صحيحاً بصيغة 07XXXXXXXXX.';
    return 'تسجيل الهاتف غير مفعّل حالياً: لم يتم اعتماد مزود SMS في Supabase، لذلك لم تُرسل أي رسالة مدفوعة. استخدم البريد الإلكتروني أو Google.';
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    const normalized = normalizeIraqiPhone(phone);
    if (!normalized) return 'رقم الهاتف غير صالح.';
    if (!/^\d{6}$/.test(token.trim())) return 'أدخل رمز التحقق المكوّن من 6 أرقام.';
    const { error } = await supabase.auth.verifyOtp({ phone: normalized, token: token.trim(), type: 'sms' });
    if (error) return formatPhoneAuthError(error.message);
    return null;
  };

  const sendEmailOtp = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'أدخل بريداً إلكترونياً صحيحاً.';
    const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: false, emailRedirectTo: getOAuthRedirectUrl() } });
    return error ? 'تعذر إرسال رابط الدخول. تحقق من إعدادات البريد ثم أعد المحاولة.' : null;
  };

  const saveOnboarding = async (values: Partial<Profile> & { role: CustomerRole }) => {
    if (!user) return 'يجب تسجيل الدخول أولاً.';
    const normalizedPhone = normalizeIraqiPhone(String(values.phone || ''));
    if (!normalizedPhone) return 'أدخل رقماً عراقياً صحيحاً بصيغة 07XXXXXXXXX.';
    if (profile && profile.role !== 'PATIENT' && profile.role !== 'STUDENT') return 'لا يمكن تعديل هذا النوع من الحساب من تطبيق العملاء.';
    const intent = readAuthIntent();
    if (!profile && !isFreshRegistrationCandidate(user, intent)) {
      clearAuthIntent();
      setAuthNotice('تم تسجيل الدخول بحساب موجود مسبقًا. لم يتم تغيير دوره.');
      return 'هذا الحساب موجود مسبقًا ولا يمكن تغيير دوره من خلال التسجيل.';
    }
    const role = profile ? profile.role : (values.role === 'STUDENT' ? 'STUDENT' : 'PATIENT');
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ ...values, id: user.id, role, phone: normalizedPhone, full_name: values.full_name || metadataName(user) }, { onConflict: 'id' })
      .select(PROFILE_FIELDS)
      .single();
    if (error) return error.message;
    const savedProfile = data as Profile;
    const table = role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities';
    const column = role === 'PATIENT' ? 'patient_id' : 'student_id';
    const { data: preferences, error: preferenceError } = await supabase.from(table).select('university_id').eq(column, user.id);
    if (preferenceError) return preferenceError.message;
    savedProfile.preferred_university_ids = (preferences || []).map((row) => row.university_id as string);
    profileCache.current.set(user.id, savedProfile);
    setProfile(savedProfile);
    return null;
  };

  return <AuthContext.Provider value={{ user, profile, loading, authNotice, signInWithGoogle, sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, signOut: async () => { clearAuthIntent(); await supabase.auth.signOut(); }, saveOnboarding, refreshProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
