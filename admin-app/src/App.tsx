
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProtectedAdminRoute } from './components/auth/ProtectedRoute';
import { DashboardHome } from './pages/DashboardHome';
import { Login } from './pages/Login';
import { ManagementPage } from './pages/ManagementPage';
import { SettingsPage } from './pages/SettingsPage';

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Admin render error', error, info); }
  render() {
    if (this.state.error) return <div className="admin-fatal-error" dir="rtl"><h1>تعذر تحميل صفحة الإدارة</h1><p>حدث خطأ في واجهة الإدارة. أعد المحاولة، وإذا استمر الخطأ أرسل رسالة الخطأ للدعم.</p><button onClick={() => window.location.reload()}>إعادة المحاولة</button></div>;
    return this.props.children;
  }
}

function App() {
  const Router = import.meta.env.BASE_URL === '/alasas1/admin/' || window.location.pathname.startsWith('/admin') ? HashRouter : BrowserRouter;
  return (
    <AppErrorBoundary><AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/branding" element={<SettingsPage mode="branding" />} />
            <Route path="/settings" element={<SettingsPage mode="content" />} />
            {['/users', '/patients', '/students', '/cases', '/requests', '/matches', '/appointments', '/universities', '/notifications', '/reports', '/admins'].map((path) => <Route key={path} path={path} element={<ManagementPage path={path} />} />)}
          </Route>
        </Routes>
      </Router>
    </AuthProvider></AppErrorBoundary>
  );
}

export default App;
