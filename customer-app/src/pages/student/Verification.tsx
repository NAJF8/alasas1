import { CheckCircle2, FileUp, Loader2, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export const Verification = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!user) return; void supabase.from('profiles').select('student_id_image_url').eq('id', user.id).maybeSingle().then(({ data }) => setDocumentPath((data?.student_id_image_url as string | null) || null)); }, [user]);
  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile || profile.role !== 'STUDENT') return <Navigate to="/dashboard" replace />;
  const submit = async () => {
    setError(null); setMessage(null);
    if (!file) { setError('اختر ملف إثبات الانتساب أولاً.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('يسمح بصورة JPG أو PNG أو WEBP أو PDF بحجم أقصى 10MB.'); return; }
    setSaving(true);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await supabase.storage.from('student-verification-documents').upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) { setError(`تعذر رفع الملف: ${upload.error.message}`); setSaving(false); return; }
    const update = await supabase.from('profiles').update({ student_id_image_url: path }).eq('id', user.id);
    if (update.error) { setError(`تم رفع الملف لكن تعذر إرسال طلب التوثيق: ${update.error.message}`); setSaving(false); return; }
    await refreshProfile(); setFile(null); setMessage('تم رفع الإثبات وإرساله إلى الإدارة للمراجعة.'); setSaving(false);
  };
  const status: string = profile.status === 'VERIFIED' ? 'verified' : documentPath ? 'pending' : 'missing';
  return <div className="min-h-screen bg-slate-50" dir="rtl"><Header /><main className="mx-auto max-w-2xl px-4 py-10"><section className="rounded-3xl bg-white p-6 shadow-sm sm:p-9"><div className="flex items-center gap-3"><FileUp className="text-primary-600" /><div><h1 className="text-2xl font-black">توثيق الطالب</h1><p className="mt-1 text-sm text-slate-500">لا يمكن استلام الحالات قبل اعتماد الإثبات من الإدارة.</p></div></div><div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">الحالة الحالية: <b>{status === 'verified' ? 'موثق' : status === 'rejected' ? 'مرفوض — ارفع ملفاً جديداً' : status === 'pending' ? 'بانتظار المراجعة' : 'لم يُرفع بعد'}</b></div><label className="mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center"><UploadCloud className="text-primary-600" size={38} /><b>{file?.name || 'اختر بطاقة أو إثبات الانتساب'}</b><small className="text-slate-500">JPG, PNG, WEBP أو PDF — حتى 10MB</small><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>{error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="mt-5 flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-800"><CheckCircle2 size={18} />{message}</p>}<button type="button" disabled={saving} onClick={() => void submit()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />} إرسال إثبات التوثيق</button></section></main></div>;
};
