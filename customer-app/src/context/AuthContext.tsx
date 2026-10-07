import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getOAuthRedirectUrl, supabase } from '../lib/supabase';

export type CustomerRole = 'PATIENT' | 'STUDENT' | 'DENTIST';

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
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  saveOnboarding: (values: Partial<Profile> & { role: CustomerRole }) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const PROFILE_FIELDS = 'id, role, status, full_name, phone, whatsapp, gender, birth_date, province_id, area_id, university_id, stage, workplace';

const metadataName = (user: User) =>
  user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'مستخدم جديد';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle();
      if (!error && data) return data as Profile;
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
    setProfile(await fetchProfile(session.user.id));
    setLoading(false);
  }, [fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));
    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getOAuthRedirectUrl() },
    });
    return error?.message ?? null;
  };

  const saveOnboarding = async (values: Partial<Profile> & { role: CustomerRole }) => {
    if (!user) return 'يجب تسجيل الدخول أولاً.';
    const role = ['PATIENT', 'STUDENT', 'DENTIST'].includes(values.role) ? values.role : 'PATIENT';
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...values, role, full_name: values.full_name || metadataName(user) })
      .eq('id', user.id)
      .select(PROFILE_FIELDS)
      .single();
    if (error) return error.message;
    setProfile(data as Profile);
    return null;
  };

  return <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut: async () => { await supabase.auth.signOut(); }, saveOnboarding }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
