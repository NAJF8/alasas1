import { HashRouter, Navigate, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { clearAuthIntent, isProfileComplete, readAuthIntent, useAuth, type CustomerRole } from './context/AuthContext';

const NewCase = lazy(() => import('./pages/patient/NewCase').then((module) => ({ default: module.NewCase })));
const SearchCases = lazy(() => import('./pages/student/SearchCases').then((module) => ({ default: module.SearchCases })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((module) => ({ default: module.Onboarding })));
const NewRequest = lazy(() => import('./pages/student/NewRequest').then((module) => ({ default: module.NewRequest })));
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard').then((module) => ({ default: module.PatientDashboard })));
const Verification = lazy(() => import('./pages/student/Verification').then((module) => ({ default: module.Verification })));

const AuthNotice = () => {
  const { authNotice } = useAuth();
  return authNotice ? <div className="auth-error" style={{ position: 'fixed', top: 20, left: 20, right: 20, zIndex: 50, textAlign: 'center' }}>{authNotice}</div> : null;
};

const HomeRoute = () => {
  const { user, profile, loading } = useAuth();
  if (!loading && user) {
    const intent = readAuthIntent();
    // A persisted session can outlive the short-lived OAuth intent. A customer
    // with an incomplete profile must still be sent to onboarding.
    if (profile && (profile.role === 'PATIENT' || profile.role === 'STUDENT')) {
      clearAuthIntent();
      return <Navigate to={isProfileComplete(profile) ? '/dashboard' : '/onboarding'} replace />;
    }
    if (intent) {
      if (intent.flow === 'register') {
        if (profile) {
          clearAuthIntent();
          if (profile.role !== 'PATIENT' && profile.role !== 'STUDENT') return <Home />;
          return <Navigate to={isProfileComplete(profile) ? '/dashboard' : '/onboarding'} replace />;
        }
        return <Navigate to="/onboarding" replace />;
      }
      clearAuthIntent();
      if (profile) return <Navigate to={isProfileComplete(profile) ? '/dashboard' : '/onboarding'} replace />;
      return <Navigate to="/register" replace />;
    }
    if (!profile) return <Navigate to="/register" replace />;
  }
  return <Home />;
};

const DashboardRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return profile.role === 'STUDENT' ? <Navigate to="/student/search" replace /> : <Navigate to="/patient/dashboard" replace />;
};

const ProtectedDashboard = ({ role, children }: { role: CustomerRole; children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
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
      <HashRouter><Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/patient/new-case" element={<ProtectedDashboard role="PATIENT"><NewCase /></ProtectedDashboard>} />
        <Route path="/patient/dashboard" element={<ProtectedDashboard role="PATIENT"><PatientDashboard /></ProtectedDashboard>} />
        <Route path="/student/search" element={<ProtectedDashboard role="STUDENT"><SearchCases /></ProtectedDashboard>} />
        <Route path="/student/request" element={<ProtectedDashboard role="STUDENT"><NewRequest /></ProtectedDashboard>} />
        <Route path="/student/verification" element={<ProtectedDashboard role="STUDENT"><Verification /></ProtectedDashboard>} />
        {/* Placeholder for other routes */}
        <Route path="/how-it-works" element={<PublicSectionRoute sectionId="how-it-works" />} />
        <Route path="/patients" element={<Navigate to="/patient/new-case" replace />} />
        <Route path="/students" element={<Navigate to="/student/search" replace />} />
        <Route path="/faq" element={<PublicSectionRoute sectionId="faq" />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/patient" element={<Navigate to="/login" replace />} />
        <Route path="/register/student" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes></HashRouter>
    </Suspense></AuthProvider></BrandingProvider>;
}

export default App;
