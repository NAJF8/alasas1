import { Bell, CalendarDays, CheckCircle2, ExternalLink, FileHeart, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type CaseRow = { id: string; case_number: string; description: string; status: string; created_at: string };
type NotificationRow = { id: string; title: string; message: string; is_read: boolean; created_at: string };
type AppointmentRow = { id: string; appointment_date: string; location_name: string | null; status: string; notes: string | null };

const statusLabel: Record<string, string> = {
  NEW: 'بانتظار المراجعة', UNDER_REVIEW: 'قيد المراجعة', WAITING_FOR_MATCH: 'بانتظار المطابقة',
  APPOINTMENT_PENDING: 'بانتظار الموعد', APPOINTMENT_CONFIRMED: 'تم تأكيد الموعد',
  IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'مكتملة', REJECTED: 'مرفوضة', CANCELLED: 'ملغاة',
};

export const PatientDashboard = () => {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true); setError(null);
    const [caseResult, notificationResult, appointmentResult] = await Promise.all([
      supabase.from('patient_cases').select('id, case_number, description, status, created_at').eq('patient_id', user.id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('id, title, message, is_read, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('appointments').select('id, appointment_date, location_name, status, notes').eq('patient_id', user.id).order('appointment_date', { ascending: true }),
    ]);
    const firstError = caseResult.error || notificationResult.error || appointmentResult.error;
    if (firstError) setError(firstError.message);
    setCases((caseResult.data || []) as CaseRow[]);
    setNotifications((notificationResult.data || []) as NotificationRow[]);
    setAppointments((appointmentResult.data || []) as AppointmentRow[]);
    setBusy(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  const markRead = async (id: string) => {
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user?.id || '');
    if (!updateError) setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
  };
  const whatsapp = import.meta.env.VITE_ADMIN_WHATSAPP as string | undefined;
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('مرحباً، أحتاج متابعة طلبي في منصة أسنان الأساس.')}` : null;
  if (loading || busy) return <div className="min-h-screen grid place-items-center" dir="rtl"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <div className="min-h-screen bg-slate-50" dir="rtl"><Header /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><span className="text-sm font-bold text-primary-700">حساب المريض</span><h1 className="mt-1 text-3xl font-black text-slate-900">متابعة طلباتك</h1><p className="mt-2 text-slate-500">الحالة والمواعيد والإشعارات من البيانات الفعلية.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700"><RefreshCw size={16} /> تحديث</button><Link to="/patient/new-case" className="rounded-xl bg-primary-600 px-4 py-3 font-bold text-white">إرسال حالة جديدة</Link></div></div>{error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">تعذر تحميل بعض البيانات: {error}</p>}<div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-black"><FileHeart size={20} className="text-primary-600" /> حالاتي</h2><span className="text-sm text-slate-400">{cases.length} حالة</span></div>{cases.length === 0 ? <p className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-slate-500">لم ترسل أي حالة بعد.</p> : <div className="mt-4 space-y-3">{cases.map((item) => <article key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><b className="text-primary-700">{item.case_number}</b><p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p></div><span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{statusLabel[item.status] || item.status}</span></div><small className="mt-3 block text-slate-400">{new Date(item.created_at).toLocaleDateString('ar-IQ')}</small></article>)}</div>}</section><section className="space-y-6"><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><CalendarDays size={20} className="text-primary-600" /> مواعيدي</h2>{appointments.length === 0 ? <p className="mt-5 text-sm text-slate-500">لا توجد مواعيد مؤكدة حالياً.</p> : <div className="mt-4 space-y-3">{appointments.map((item) => <div key={item.id} className="rounded-xl bg-teal-50 p-4 text-sm"><b>{new Date(item.appointment_date).toLocaleString('ar-IQ')}</b><p className="mt-1">{item.location_name || 'سيحدد المكان من الإدارة'} · {item.status}</p>{item.notes && <p className="mt-1 text-slate-600">{item.notes}</p>}</div>)}</div>}</div><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><Bell size={20} className="text-primary-600" /> الإشعارات</h2>{notifications.length === 0 ? <p className="mt-5 text-sm text-slate-500">لا توجد إشعارات جديدة.</p> : <div className="mt-4 space-y-2">{notifications.map((item) => <button type="button" key={item.id} onClick={() => void markRead(item.id)} className={`block w-full rounded-xl p-3 text-right text-sm ${item.is_read ? 'bg-slate-50' : 'bg-blue-50'}`}><span className="flex items-center justify-between gap-2"><b>{item.title}</b>{!item.is_read && <CheckCircle2 size={16} className="text-blue-600" />}</span><span className="mt-1 block text-slate-600">{item.message}</span></button>)}</div>}</div>{whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-bold text-white"><MessageCircle size={18} /> التواصل مع الإدارة عبر واتساب <ExternalLink size={15} /></a> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">سيظهر رابط واتساب الإدارة بعد ضبط الرقم من إعدادات البيئة.</p>}</section></div></main></div>;
};
