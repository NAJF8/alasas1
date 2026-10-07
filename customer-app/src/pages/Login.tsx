import { Globe2, Loader2, ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { isProfileComplete, useAuth } from '../context/AuthContext';

export const Login = () => {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (user) return <Navigate to={profile ? (isProfileComplete(profile) ? '/dashboard' : '/onboarding') : '/register'} replace />;

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError(await signInWithGoogle('login'));
    setSubmitting(false);
  };

  return <main className="auth-page" dir="rtl"><section className="auth-card"><div className="auth-mark"><ShieldCheck size={32} /></div><span className="auth-eyebrow">أسنان الأساس</span><h1>تسجيل الدخول</h1><p>ادخل إلى منصتك الآمنة لإدارة حالتك أو متابعة فرصك السريرية.</p>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">تعذر بدء تسجيل الدخول: {error}</p>}
      <button onClick={handleGoogleLogin} disabled={submitting} className="auth-google-button">
        {submitting ? <Loader2 className="animate-spin" size={20} /> : <Globe2 size={20} aria-label="Google" />}
        المتابعة باستخدام Google
      </button><div className="auth-footer-link">ليس لديك حساب؟ <Link to="/register">إنشاء حساب جديد</Link></div></section></main>;
};
