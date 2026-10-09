import { ArrowLeft, GraduationCap, Loader2, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { clearAuthIntent, isProfileComplete, readAuthIntent, useAuth, type CustomerRole } from '../context/AuthContext';

const roles = [
  { role: 'PATIENT' as const, title: 'مريض', body: 'اعرض حالتك وابحث عن طالب طب أسنان مناسب بالقرب منك.', icon: UserRound, tone: 'register-card-blue' },
  { role: 'STUDENT' as const, title: 'طالب طب أسنان', body: 'ابحث عن حالات سريرية مناسبة لمتطلبات التدريب في جامعتك.', icon: GraduationCap, tone: 'register-card-teal' },
];

export const Register = () => {
  const { user, profile, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const initialRole = requestedRole === 'PATIENT' || requestedRole === 'STUDENT' ? requestedRole : readAuthIntent()?.role || null;
  const [selectedRole, setSelectedRole] = useState<CustomerRole | null>(initialRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleSelectionOnly = Boolean(user);

  if (user && !roleSelectionOnly && readAuthIntent()?.role) return <Navigate to="/onboarding" replace />;

  const continueFlow = async () => {
    if (!selectedRole) { setError('اختر نوع الحساب أولاً.'); return; }
    if (user) {
      localStorage.setItem('customer-app:auth-intent', JSON.stringify({ flow: 'register', role: selectedRole, createdAt: Date.now(), nonce: crypto.randomUUID() }));
      if (profile) {
        if (profile.role !== selectedRole) {
          clearAuthIntent();
          setError(`هذا الحساب مسجل كـ${profile.role === 'PATIENT' ? 'مريض' : profile.role === 'STUDENT' ? 'طالب طب أسنان' : 'حساب إداري'}، ولا يمكن تغيير دوره من التسجيل العام. تواصل مع الإدارة إذا كنت تحتاج تغييراً رسمياً.`);
          return;
        }
        clearAuthIntent();
        navigate(isProfileComplete(profile) ? '/dashboard' : '/onboarding');
        return;
      }
      navigate('/onboarding');
      return;
    }
    setBusy(true); setError(await signInWithGoogle('register', selectedRole)); setBusy(false);
  };

  return <main className="auth-page register-page" dir="rtl"><section className="register-shell"><div className="register-intro"><span className="auth-eyebrow">أسنان الأساس</span><h1>{roleSelectionOnly ? 'إكمال حسابك' : 'إنشاء حساب جديد'}</h1><p>{roleSelectionOnly ? 'اختر نوع الحساب المطابق لحسابك الحالي لنكمل بياناتك دون تغيير صلاحياته.' : 'اختر المسار المناسب لك، ثم نكمل التسجيل بأمان عبر Google.'}</p></div><div className="register-cards">{roles.map(({ role, title, body, icon: Icon, tone }) => <button type="button" key={role} onClick={() => { setSelectedRole(role); setError(null); }} className={`register-card ${tone} ${selectedRole === role ? 'is-selected' : ''}`}><span className="register-icon"><Icon size={30} /></span><span className="register-card-copy"><strong>{title}</strong><small>{body}</small></span><span className="register-radio" aria-hidden="true">{selectedRole === role ? '✓' : ''}</span></button>)}</div>{error && <p className="auth-error">{error}</p>}<button type="button" onClick={() => void continueFlow()} disabled={busy} className="auth-primary-button">{busy ? <Loader2 className="animate-spin" size={19} /> : <ArrowLeft size={19} />}{roleSelectionOnly ? 'متابعة إلى إعداد الحساب' : 'المتابعة باستخدام Google'}</button>{!roleSelectionOnly && <p className="auth-switch">لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link></p>}</section></main>;
};
