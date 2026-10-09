
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProtectedAdminRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/Login';
const DashboardHome = lazy(() => import('./pages/DashboardHome').then((module) => ({ default: module.DashboardHome })));
const ManagementPage = lazy(() => import('./pages/ManagementPage').then((module) => ({ default: module.ManagementPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

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
      <Router><Suspense fallback={<div className="min-h-screen grid place-items-center" dir="rtl">جارٍ تحميل الصفحة...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/branding" element={<SettingsPage mode="branding" />} />
            <Route path="/settings" element={<SettingsPage mode="content" />} />
            {['/users', '/patients', '/students', '/cases', '/requests', '/matches', '/appointments', '/universities', '/notifications', '/reports', '/admins'].map((path) => <Route key={path} path={path} element={<ManagementPage path={path} />} />)}
          </Route>
        </Routes>
      </Suspense></Router>
    </AuthProvider></AppErrorBoundary>
  );
}

export default App;
