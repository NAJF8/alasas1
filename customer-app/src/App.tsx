import { BrowserRouter, HashRouter, Navigate, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { NewCase } from './pages/patient/NewCase';
import { SearchCases } from './pages/student/SearchCases';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';

const HomeRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق...</div>;
  if (user && (!profile || !profile.phone || !profile.province_id)) return <Navigate to="/onboarding" replace />;
  return <Home />;
};

function App() {
  const Router = import.meta.env.BASE_URL === '/alasas1/' ? HashRouter : BrowserRouter;
  return <AuthProvider><Router>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/patient/new-case" element={<NewCase />} />
        <Route path="/student/search" element={<SearchCases />} />
        {/* Placeholder for other routes */}
        <Route path="/how-it-works" element={<Navigate to="/#how-it-works" replace />} />
        <Route path="/patients" element={<Navigate to="/patient/new-case" replace />} />
        <Route path="/students" element={<Navigate to="/student/search" replace />} />
        <Route path="/faq" element={<Navigate to="/#faq" replace />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/register/patient" element={<Navigate to="/login" replace />} />
        <Route path="/register/student" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </Router></AuthProvider>;
}

export default App;
