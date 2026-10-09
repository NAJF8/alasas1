import { FileUp, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../context/AuthContext';

export const Verification = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile || profile.role !== 'STUDENT') return <Navigate to="/dashboard" replace />;
  return <div className="min-h-screen bg-slate-50" dir="rtl"><Header /><main className="mx-auto max-w-2xl px-4 py-10"><section className="rounded-3xl bg-white p-6 shadow-sm sm:p-9"><div className="flex items-center gap-3"><FileUp className="text-primary-600" /><div><h1 className="text-2xl font-black">توثيق الطالب</h1><p className="mt-1 text-sm text-slate-500">لا يمكن استلام الحالات قبل اعتماد الإثبات من الإدارة.</p></div></div><div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">الحالة الحالية: <b>{profile.status === 'VERIFIED' ? 'موثق' : 'غير مفعّل في Production'}</b></div><div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><b>رفع وثائق التوثيق غير متاح حالياً</b><p className="mt-2">لم يتم العثور في Production على جدول/أعمدة التوثيق أو Bucket مخصص للطلاب. لم يتم تفعيل الرفع حتى لا نعرض وظيفة غير مدعومة.</p></div><button type="button" disabled className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-300 px-5 py-3 font-bold text-slate-600">رفع الوثيقة غير مفعّل</button></section></main></div>;
};
