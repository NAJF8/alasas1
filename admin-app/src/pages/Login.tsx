import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, AlertCircle, Globe2, Loader2, ShieldX } from 'lucide-react';

export const Login = () => {
  const { user, profile, loading: authLoading, isAdmin, signInWithGoogle, signOut } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile || isAdmin) return;
    const timer = window.setTimeout(() => { void signOut(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [user, profile, isAdmin, signOut]);

  // --- Redirect & denial logic (no hooks below this) ---

  // Still loading auth state → full-screen spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="font-medium text-gray-500">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  // Authenticated admin → go to dashboard
  if (user && isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Authenticated but NOT admin (wrong role or not VERIFIED) → denial screen
  if (user && profile && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-100 max-w-md w-full mx-4 text-center">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">غير مصرح بالدخول</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            هذا الحساب غير مخول للدخول إلى لوحة الإدارة.
            <br />
            يرجى التواصل مع إدارة المنصة إذا كنت تعتقد أن هذا خطأ.
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

  // Authenticated but profile is missing → error screen
  if (user && !profile) {
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

  // --- Login form ---

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
      }
      // If no error, auth context will update → component re-renders → redirect or denial
    } catch {
      setError('حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg">
            <Activity size={40} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          تسجيل الدخول للإدارة
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          أسنان الأساس — منصة إدارة الحالات السريرية
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100">
          <div className="space-y-6">

            {error && (
              <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3 border border-red-100">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={submitting}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><Globe2 className="w-5 h-5" aria-label="Google" /> تسجيل الدخول باستخدام Google</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
