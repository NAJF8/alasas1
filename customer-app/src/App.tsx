import { BrowserRouter, Link, Navigate, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { ShieldAlert, UserCheck } from 'lucide-react';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { RegistrationRequest } from './pages/RegistrationRequest';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { clearAuthIntent, isProfileComplete, readAuthIntent, useAuth, type CustomerRole } from './context/AuthContext';
import './components/layout/PreferencesBar';

const NewCase = lazy(() => import('./pages/patient/NewCase').then((module) => ({ default: module.NewCase })));
const SearchCases = lazy(() => import('./pages/student/SearchCases').then((module) => ({ default: module.SearchCases })));
const NewRequest = lazy(() => import('./pages/student/NewRequest').then((module) => ({ default: module.NewRequest })));
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard').then((module) => ({ default: module.PatientDashboard })));
const Verification = lazy(() => import('./pages/student/Verification').then((module) => ({ default: module.Verification })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));

const AuthNotice = () => {
  const { authNotice } = useAuth();
  return authNotice ? <div className="auth-error" style={{ position: 'fixed', top: 20, left: 20, right: 20, zIndex: 50, textAlign: 'center' }}>{authNotice}</div> : null;
};

const IncompleteProfileNotice = () => (
  <main className="auth-page" dir="rtl">
    <section className="auth-card">
      <div className="auth-mark"><UserCheck size={30} /></div>
      <h1>بيانات الحساب غير مكتملة</h1>
      <p>يحتوي ملفك على بعض البيانات المفقودة (مثل المحافظة أو الجامعة المفضلة). يرجى إكمالها من صفحة الملف الشخصي للمتابعة بأمان.</p>
      <Link className="auth-primary-button" to="/profile">تعديل الملف الشخصي</Link>
    </section>
  </main>
);

const HomeRoute = () => {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  if (!loading && user && profileError) return <ProfileLoadError message={profileError} retry={() => void refreshProfile()} />;
  if (!loading && user) {
    const intent = readAuthIntent();
    if (profile && (profile.role === 'PATIENT' || profile.role === 'STUDENT')) {
      clearAuthIntent();
      if (!isProfileComplete(profile)) return <IncompleteProfileNotice />;
      return <Navigate to="/dashboard" replace />;
    }
    if (intent) {
      if (intent.flow === 'register') {
        if (profile) {
          clearAuthIntent();
          if (profile.role !== 'PATIENT' && profile.role !== 'STUDENT') return <Home />;
          if (!isProfileComplete(profile)) return <IncompleteProfileNotice />;
          return <Navigate to="/dashboard" replace />;
        }
        return <Navigate to="/register" replace />;
      }
      clearAuthIntent();
      if (profile) {
        if (!isProfileComplete(profile)) return <IncompleteProfileNotice />;
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/register" replace />;
    }
    if (!profile) return <Navigate to="/register" replace />;
  }
  return <Home />;
};

const DashboardRoute = () => {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profileError) return <ProfileLoadError message={profileError} retry={() => void refreshProfile()} />;
  if (!profile) return <Navigate to="/register" replace />;
  if (!isProfileComplete(profile)) return <IncompleteProfileNotice />;
  if (profile.status === 'SUSPENDED') return <AccountStatus />;
  if (profile.role === 'STUDENT' && profile.status !== 'VERIFIED') return <Navigate to="/student/verification" replace />;
  return profile.role === 'STUDENT' ? <Navigate to="/student/search" replace /> : <Navigate to="/patient/dashboard" replace />;
};

const AccountStatus = () => <main className="auth-page" dir="rtl"><section className="auth-card"><div className="auth-mark"><ShieldAlert size={30} /></div><h1>الحساب موقوف</h1><p>لا يمكن فتح الصفحات المحمية لهذا الحساب. تواصل مع إدارة المنصة لمراجعة الحالة.</p><Link className="auth-primary-button" to="/">العودة إلى الصفحة الرئيسية</Link></section></main>;
const ProfileLoadError = ({ message, retry }: { message: string; retry: () => void }) => <main className="auth-page" dir="rtl"><section className="auth-card"><div className="auth-mark"><ShieldAlert size={30} /></div><h1>تعذر تحميل الحساب</h1><p>{message || 'تعذر تحميل ملف الحساب حالياً.'}</p><button type="button" className="auth-primary-button" onClick={retry}>إعادة المحاولة</button></section></main>;

const ProtectedDashboard = ({ role, children }: { role: CustomerRole; children: React.ReactNode }) => {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profileError) return <ProfileLoadError message={profileError} retry={() => void refreshProfile()} />;
  if (!profile) return <Navigate to="/register" replace />;
  if (!isProfileComplete(profile)) return <IncompleteProfileNotice />;
  if (profile.status === 'SUSPENDED') return <AccountStatus />;
  if (role === 'STUDENT' && profile.status !== 'VERIFIED') return <Navigate to="/student/verification" replace />;
  if (profile.role !== role) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicSectionRoute = ({ sectionId }: { sectionId: string }) => {
  useEffect(() => {
    document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
  }, [sectionId]);
  return <Home />;
};

function App() {
  return <BrandingProvider><AuthProvider><AuthNotice /><Suspense fallback={<div className="min-h-screen grid place-items-center" dir="rtl">جارٍ تحميل الصفحة...</div>}>
      <BrowserRouter><Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/patient/new-case" element={<ProtectedDashboard role="PATIENT"><NewCase /></ProtectedDashboard>} />
        <Route path="/patient/cases/new" element={<ProtectedDashboard role="PATIENT"><NewCase /></ProtectedDashboard>} />
        <Route path="/patient/dashboard" element={<ProtectedDashboard role="PATIENT"><PatientDashboard /></ProtectedDashboard>} />
        <Route path="/student/dashboard" element={<ProtectedDashboard role="STUDENT"><Navigate to="/student/search" replace /></ProtectedDashboard>} />
        <Route path="/student/search" element={<ProtectedDashboard role="STUDENT"><SearchCases /></ProtectedDashboard>} />
        <Route path="/student/request" element={<ProtectedDashboard role="STUDENT"><NewRequest /></ProtectedDashboard>} />
        <Route path="/student/verification" element={<Verification />} />
        <Route path="/how-it-works" element={<PublicSectionRoute sectionId="how-it-works" />} />
        <Route path="/patients" element={<Navigate to="/patient/new-case" replace />} />
        <Route path="/students" element={<Navigate to="/student/search" replace />} />
        <Route path="/faq" element={<PublicSectionRoute sectionId="faq" />} />
        <Route path="/register" element={<RegistrationRequest />} />
        <Route path="/register-request" element={<RegistrationRequest />} />
        <Route path="/register/patient" element={<Navigate to="/register?role=PATIENT&start=1" replace />} />
        <Route path="/register/student" element={<Navigate to="/register?role=STUDENT&start=1" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Navigate to="/profile" replace />} />
        <Route path="/complete-profile" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></BrowserRouter>
    </Suspense></AuthProvider></BrandingProvider>;
}

export default App;
