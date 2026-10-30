import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { isProfileComplete, useAuth } from '../context/AuthContext';
import { AuthErrorMessage } from '../components/auth/AuthErrorMessage';
import { AuthInput } from '../components/auth/AuthInput';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthMethodSelector, type AuthMethod } from '../components/auth/AuthMethodSelector';
import { AuthSubmitButton } from '../components/auth/AuthSubmitButton';
import { GoogleMark } from '../components/auth/GoogleMark';

export const Login = () => {
  const { user, profile, loading, signInWithGoogle, signInWithPhonePassword, sendEmailOtp } = useAuth();
  const [method, setMethod] = useState<AuthMethod>('phone');
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (loading) return <main className="aa-auth-loading" dir="rtl"><span className="aa-auth-loading-spinner" role="status" aria-label="جارٍ تحميل تسجيل الدخول" /></main>;
  if (user) return <Navigate to={profile ? (profile.role !== 'PATIENT' && profile.role !== 'STUDENT' ? '/' : (isProfileComplete(profile) ? '/dashboard' : '/onboarding')) : '/register'} replace />;
  const run = async (action: () => Promise<string | null>) => { setBusy(true); setError(null); setError(await action()); setBusy(false); };
  return <AuthLayout title="مرحباً بعودتك" description="سجّل دخولك للوصول إلى طلباتك وحالاتك ومتابعة رحلتك مع أسنان الأساس." footer={<p className="aa-auth-footer">ليس لديك حساب؟ <Link to="/register">إنشاء حساب جديد</Link></p>}>
    <div className="aa-auth-intro-mobile"><span>تسجيل الدخول</span><h1>مرحباً بعودتك</h1><p>اختر الطريقة المناسبة للدخول إلى حسابك.</p></div>
    <AuthMethodSelector value={method} onChange={(next) => { setMethod(next); setError(null); }} methods={[{ id: 'phone', label: 'الهاتف وكلمة المرور', icon: <Phone size={17} /> }, { id: 'email', label: 'البريد الإلكتروني', icon: <Mail size={17} /> }, { id: 'google', label: 'Google', icon: <GoogleMark /> }]} />
    <div className="aa-auth-method-panel" role="tabpanel">
      {method === 'phone' && <form onSubmit={(event) => { event.preventDefault(); void run(() => signInWithPhonePassword(phone, password)); }} className="aa-auth-form"><AuthInput label="رقم الهاتف العراقي" inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} required /><AuthInput label="كلمة المرور" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} passwordToggle required /><AuthSubmitButton type="submit" busy={busy}><Phone size={19} aria-hidden="true" /> تسجيل الدخول</AuthSubmitButton></form>}
      {method === 'email' && <form onSubmit={(event) => { event.preventDefault(); void run(() => sendEmailOtp(email)); }} className="aa-auth-form"><AuthInput label="البريد الإلكتروني الموثق" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><AuthSubmitButton type="submit" busy={busy}><Mail size={19} aria-hidden="true" /> إرسال رابط الدخول</AuthSubmitButton></form>}
      {method === 'google' && <div className="aa-auth-google-panel"><p>استخدم حساب Google الموثق للمتابعة بأمان.</p><AuthSubmitButton type="button" busy={busy} onClick={() => void run(() => signInWithGoogle('login'))}><GoogleMark /> المتابعة باستخدام Google</AuthSubmitButton></div>}
    </div>
    <AuthErrorMessage message={error} /><div className="aa-auth-create-account"><span>أول مرة هنا؟</span><Link to="/register">إنشاء حساب جديد <ArrowLeft size={16} /></Link></div>
  </AuthLayout>;
};
