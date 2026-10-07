import { Globe2, Loader2, ShieldCheck } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (user) return <Navigate to="/" replace />;

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError(await signInWithGoogle());
    setSubmitting(false);
  };

  return <main className="min-h-screen bg-slate-50 grid place-items-center px-4" dir="rtl">
    <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl border border-slate-100 text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary-600 text-white"><ShieldCheck size={34} /></div>
      <h1 className="text-3xl font-black text-slate-900">تسجيل الدخول</h1>
      <p className="mt-3 text-slate-500">ادخل إلى منصة أسنان الأساس بحساب Google الآمن.</p>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">تعذر بدء تسجيل الدخول: {error}</p>}
      <button onClick={handleGoogleLogin} disabled={submitting} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white transition hover:bg-slate-700 disabled:opacity-60">
        {submitting ? <Loader2 className="animate-spin" size={20} /> : <Globe2 size={20} aria-label="Google" />}
        المتابعة باستخدام Google
      </button>
    </section>
  </main>;
};
