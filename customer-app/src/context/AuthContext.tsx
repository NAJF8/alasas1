import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getOAuthRedirectUrl, supabase } from '../lib/supabase';

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
}

export type AuthFlow = 'login' | 'register';

export const AUTH_INTENT_KEY = 'customer-app:auth-intent';
const AUTH_INTENT_TTL_MS = 10 * 60 * 1000;
type AuthIntent = { flow: AuthFlow; role?: CustomerRole; createdAt: number };

export const readAuthIntent = (): AuthIntent | null => {
  try {
    const raw = localStorage.getItem(AUTH_INTENT_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as AuthIntent;
    if (!intent || (intent.flow !== 'login' && intent.flow !== 'register') || !Number.isFinite(intent.createdAt) || Date.now() - intent.createdAt > AUTH_INTENT_TTL_MS) {
      localStorage.removeItem(AUTH_INTENT_KEY);
      return null;
    }
    if (intent.role && intent.role !== 'PATIENT' && intent.role !== 'STUDENT') return { flow: intent.flow, createdAt: intent.createdAt };
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
  signOut: () => Promise<void>;
  saveOnboarding: (values: Partial<Profile> & { role: CustomerRole }) => Promise<string | null>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const PROFILE_FIELDS = 'id, role, status, full_name, phone, whatsapp, gender, birth_date, province_id, area_id, university_id, stage, workplace';

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

  const fetchProfile = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle();
      if (!error && data) {
        const profile = data as Profile;
        if (profile.role === 'PATIENT' || profile.role === 'STUDENT') {
          const table = profile.role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities';
          const column = profile.role === 'PATIENT' ? 'patient_id' : 'student_id';
          const { data: preferences, error: preferenceError } = await supabase.from(table).select('university_id').eq(column, userId);
          if (preferenceError) console.error('Preferred universities fetch error:', preferenceError.message);
          profile.preferred_university_ids = (preferences || []).map((row) => row.university_id as string);
        }
        return profile;
      }
      if (error && error.code !== 'PGRST116') console.error('Profile fetch error:', error.message);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
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
    if (nextProfile && intent?.flow === 'register' && intent.role && (nextProfile.role === 'PATIENT' || nextProfile.role === 'STUDENT') && !isProfileComplete(nextProfile)) {
      if (nextProfile.role !== intent.role) {
        const { error: roleError } = await supabase.from('profiles').update({ role: intent.role }).eq('id', session.user.id);
        if (roleError) console.error('Registration role resolution error:', roleError.message);
        else {
          nextProfile = await fetchProfile(session.user.id);
          clearAuthIntent();
        }
      } else {
        clearAuthIntent();
      }
    }
    setProfile(nextProfile);
    setLoading(false);
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const nextProfile = await fetchProfile(user.id);
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
    localStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({ flow, ...(role ? { role } : {}), createdAt: Date.now() }));
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

  const saveOnboarding = async (values: Partial<Profile> & { role: CustomerRole }) => {
    if (!user) return 'يجب تسجيل الدخول أولاً.';
    if (profile && profile.role !== 'PATIENT' && profile.role !== 'STUDENT') return 'لا يمكن تعديل هذا النوع من الحساب من تطبيق العملاء.';
    const role = profile && isProfileComplete(profile) ? profile.role : (values.role === 'STUDENT' ? 'STUDENT' : 'PATIENT');
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ ...values, id: user.id, role, full_name: values.full_name || metadataName(user) }, { onConflict: 'id' })
      .select(PROFILE_FIELDS)
      .single();
    if (error) return error.message;
    const savedProfile = data as Profile;
    const table = role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities';
    const column = role === 'PATIENT' ? 'patient_id' : 'student_id';
    const { data: preferences, error: preferenceError } = await supabase.from(table).select('university_id').eq(column, user.id);
    if (preferenceError) return preferenceError.message;
    savedProfile.preferred_university_ids = (preferences || []).map((row) => row.university_id as string);
    setProfile(savedProfile);
    return null;
  };

  return <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut: async () => { clearAuthIntent(); await supabase.auth.signOut(); }, saveOnboarding, refreshProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
