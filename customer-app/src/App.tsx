import { BrowserRouter, HashRouter, Navigate, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Home } from './pages/Home';
import { NewCase } from './pages/patient/NewCase';
import { SearchCases } from './pages/student/SearchCases';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { NewRequest } from './pages/student/NewRequest';
import { Register } from './pages/Register';
import { AuthProvider } from './context/AuthContext';
import { clearAuthIntent, isProfileComplete, readAuthIntent, useAuth, type CustomerRole } from './context/AuthContext';

const HomeRoute = () => {
  const { user, profile, loading } = useAuth();
  if (!loading && user) {
    const intent = readAuthIntent();
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
  }
  return <Home />;
};

const DashboardRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return profile.role === 'STUDENT' ? <Navigate to="/student/search" replace /> : <Navigate to="/patient/new-case" replace />;
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
  const Router = import.meta.env.BASE_URL === '/alasas1/' ? HashRouter : BrowserRouter;
  return <AuthProvider><Router>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/patient/new-case" element={<ProtectedDashboard role="PATIENT"><NewCase /></ProtectedDashboard>} />
        <Route path="/student/search" element={<ProtectedDashboard role="STUDENT"><SearchCases /></ProtectedDashboard>} />
        <Route path="/student/request" element={<ProtectedDashboard role="STUDENT"><NewRequest /></ProtectedDashboard>} />
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
      </Routes>
    </Router></AuthProvider>;
}

export default App;
