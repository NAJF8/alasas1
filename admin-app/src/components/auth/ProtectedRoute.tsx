import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2, ShieldX, AlertCircle } from 'lucide-react';

export const ProtectedAdminRoute = () => {
  const { user, profile, loading, isAdmin, signOut } = useAuth();

  useEffect(() => {
    if (!user || !profile || isAdmin) return;
    const timer = window.setTimeout(() => { void signOut(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [user, profile, isAdmin, signOut]);

  // 1. Still loading → spinner (prevents flash of login or content)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="font-medium text-lg">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  // 2. No user → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. User exists but profile is missing
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-orange-100 max-w-md w-full mx-4 text-center">
          <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">تعذر العثور على ملف المستخدم</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            لم يتم العثور على ملف تعريف لهذا الحساب في النظام.
            <br />
            يرجى التواصل مع مدير النظام.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 transition-colors"
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    );
  }

  // 4. User + profile exist but NOT admin → denial
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-100 max-w-md w-full mx-4 text-center">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">غير مصرح بالدخول</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            هذا الحساب غير مخول للدخول إلى لوحة الإدارة.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            تسجيل خروج والعودة
          </button>
        </div>
      </div>
    );
  }

  // 5. Authorized admin → render protected content
  return <Outlet />;
};
