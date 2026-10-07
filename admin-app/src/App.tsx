
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedAdminRoute } from './components/auth/ProtectedRoute';
import { DashboardHome } from './pages/DashboardHome';
import { Login } from './pages/Login';

function App() {
  const Router = import.meta.env.BASE_URL === '/alasas1/admin/' ? HashRouter : BrowserRouter;
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/cases" element={<div className="p-8">صفحة حالات المرضى</div>} />
            <Route path="/requests" element={<div className="p-8">صفحة طلبات الطلاب</div>} />
            <Route path="/matches" element={<div className="p-8">صفحة المطابقات الذكية</div>} />
            <Route path="/appointments" element={<div className="p-8">صفحة المواعيد</div>} />
            <Route path="/users" element={<div className="p-8">صفحة المستخدمين</div>} />
            <Route path="/settings" element={<div className="p-8">صفحة الإعدادات</div>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
