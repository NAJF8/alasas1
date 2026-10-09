import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getOAuthRedirectUrl, supabase } from '../lib/supabase';

interface Profile {
  id: string;
  role: string;
  status: string;
  full_name: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'STAFF'] as const;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileCache = useRef(new Map<string, Profile | null>());

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId) || null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, status, full_name')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error.message);
        return null;
      }
      const nextProfile = data as Profile;
      profileCache.current.set(userId, nextProfile);
      return nextProfile;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  };

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    // Keep loading=true while we fetch the profile
    setLoading(true);
    setUser(session.user);

    const prof = await fetchProfile(session.user.id);
    setProfile(prof);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Register the listener before reading the current session so OAuth callback events cannot be missed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void handleSession(session);
      }
    );
    void supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getOAuthRedirectUrl() },
    });
    return { error: error?.message ?? null };
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    profileCache.current.clear();
  }, []);

  const isAdmin =
    !!profile &&
    profile.status === 'VERIFIED' &&
    ADMIN_ROLES.includes(profile.role as typeof ADMIN_ROLES[number]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
