import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { configurationError } from '../lib/supabase';
import { Activity, AlertCircle, Globe2, Loader2, ShieldCheck, ShieldX } from 'lucide-react';

export const Login = () => {
  const { user, profile, loading: authLoading, isAdmin, signInWithGoogle, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile || isAdmin) return;
    const timer = window.setTimeout(() => { void signOut(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [user, profile, isAdmin, signOut]);

  if (authLoading) return <div className="admin-auth-page" dir="rtl"><Loader2 className="animate-spin" size={28} /><span>جاري التحقق من صلاحية الحساب…</span></div>;
  if (user && isAdmin) return <Navigate to="/" replace />;
  if (user && profile && !isAdmin) return <div className="admin-auth-page" dir="rtl"><section className="admin-auth-card admin-auth-state"><div className="admin-auth-state-icon danger"><ShieldX size={28} /></div><h2>غير مصرح بالدخول</h2><p>هذا الحساب غير مخول للدخول إلى لوحة الإدارة.<br />يرجى التواصل مع إدارة المنصة إذا كنت تعتقد أن هذا خطأ.</p><button className="admin-auth-submit danger-button" onClick={() => void signOut()}>تسجيل خروج والعودة</button></section></div>;
  if (user && !profile) return <div className="admin-auth-page" dir="rtl"><section className="admin-auth-card admin-auth-state"><div className="admin-auth-state-icon warning"><AlertCircle size={28} /></div><h2>تعذر العثور على ملف المستخدم</h2><p>لم يتم العثور على ملف تعريف لهذا الحساب في النظام.<br />يرجى التواصل مع مدير النظام.</p><button className="admin-auth-submit warning-button" onClick={() => void signOut()}>تسجيل خروج</button></section></div>;

  const handleLogin = async () => {
    setError(null); setSubmitting(true);
    try { const result = await signInWithGoogle(); if (result.error) { setError(result.error); setSubmitting(false); } }
    catch { setError('حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.'); setSubmitting(false); }
  };

  return <main className="admin-auth-page" dir="rtl"><div className="admin-auth-orb orb-a" /><div className="admin-auth-orb orb-b" /><div className="admin-auth-head"><div className="admin-auth-mark"><Activity size={30} /></div><span className="admin-auth-kicker">أسنان الأساس</span><h1>مساحة الإدارة الآمنة</h1><p>لوحة متابعة الحالات السريرية والمستخدمين والجامعات.</p></div><section className="admin-auth-card"><div className="admin-auth-card-heading"><ShieldCheck size={20} /><div><h2>تسجيل الدخول للإدارة</h2><p>الوصول متاح للحسابات الإدارية الموثقة فقط.</p></div></div>{error && <div className="admin-auth-message error"><AlertCircle size={18} /><span>{error}</span></div>}{configurationError && <div className="admin-auth-message warning"><AlertCircle size={18} /><span>{configurationError}</span></div>}<button type="button" onClick={() => void handleLogin()} disabled={submitting} className="admin-auth-submit">{submitting ? <Loader2 className="animate-spin" size={19} /> : <Globe2 size={19} />} تسجيل الدخول باستخدام Google</button><small className="admin-auth-footnote">تخضع كل صلاحية للدور والحالة في ملف Supabase الموثق.</small></section></main>;
};
