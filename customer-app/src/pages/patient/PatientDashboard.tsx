import { Bell, CalendarDays, CheckCircle2, Edit3, Eye, ExternalLink, FileHeart, Loader2, MessageCircle, RefreshCw, Save, UploadCloud, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { CustomerFooter } from '../../components/layout/PreferencesBar';
import { useAuth } from '../../context/AuthContext';
import { callBackend, firebaseData as supabase } from '../../lib/firebaseData';

type CaseRow = {
  id: string;
  case_number: string;
  title?: string | null;
  description: string;
  patient_age?: number;
  status: string;
  rejection_reason?: string | null;
  matched_student_id?: string | null;
  created_at: string;
};
type NotificationRow = { id: string; title: string; message: string; is_read: boolean; created_at: string };
type AppointmentRow = { id: string; appointment_date: string; location_name: string | null; status: string; notes: string | null };

const statusLabel: Record<string, string> = {
  PENDING: 'بانتظار مراجعة الإدارة',
  NEW: 'بانتظار المراجعة',
  UNDER_REVIEW: 'قيد المراجعة',
  WAITING_FOR_MATCH: 'معتمدة وبانتظار المطابقة',
  MATCHED: 'تمت المطابقة مع طالب',
  APPOINTMENT_PENDING: 'بانتظار الموعد',
  APPOINTMENT_CONFIRMED: 'تم تأكيد الموعد',
  IN_PROGRESS: 'قيد المعالجة',
  COMPLETED: 'مكتملة',
  REJECTED: 'مرفوضة',
  CANCELLED: 'ملغاة',
  HIDDEN: 'مؤرشفة',
};

export const PatientDashboard = () => {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<{ id: string; case_number: string; description: string; patient_age: string } | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [imagesModal, setImagesModal] = useState<{ caseId: string; caseNumber: string; images: Array<{ id: string; file_name: string; signed_url: string; mime_type: string; storage_path: string }> } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const [caseResult, notificationResult] = await Promise.all([
      supabase.from('patient_cases').select('id, case_number, title, description, patient_age, status, rejection_reason, matched_student_id, created_at').eq('patient_id', user.id),
      supabase.from('notifications').select('id, title, message, is_read, created_at').eq('user_id', user.id).limit(10),
    ]);
    const firstError = caseResult.error || notificationResult.error;
    if (firstError) setError(firstError.message);
    const byDate = (left: any, right: any, field: string, ascending = false) => {
      const a = Date.parse(String(left?.[field] || '')) || 0;
      const b = Date.parse(String(right?.[field] || '')) || 0;
      return ascending ? a - b : b - a;
    };
    setCases(([...(caseResult.data || [])] as CaseRow[]).sort((a, b) => byDate(a, b, 'created_at')));
    setNotifications(([...(notificationResult.data || [])] as NotificationRow[]).sort((a, b) => byDate(a, b, 'created_at')));
    setAppointments([]);
    setBusy(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user?.id || '');
    if (!updateError) setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  };

  const saveEditCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCase) return;
    setActionBusy(editingCase.id);
    setError(null);
    try {
      await callBackend('/api/patient-case-update', {
        case_id: editingCase.id,
        action: 'update',
        description: editingCase.description.trim(),
        patient_age: Number(editingCase.patient_age || 25),
      });
      setEditingCase(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الحالة.');
    } finally {
      setActionBusy(null);
    }
  };

  const cancelCase = async (caseId: string) => {
    setActionBusy(caseId);
    setError(null);
    try {
      await callBackend('/api/patient-case-update', { case_id: caseId, action: 'cancel' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الحالة.');
    } finally {
      setActionBusy(null);
    }
  };

  const openImagesModal = async (item: CaseRow) => {
    setActionBusy(`img-${item.id}`);
    setError(null);
    try {
      const res = await supabase.storage.from('medical-images').listByCase(item.id);
      if (res.error) throw new Error(res.error.message);
      setImagesModal({ caseId: item.id, caseNumber: item.case_number, images: res.data || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مرفقات الحالة.');
    } finally {
      setActionBusy(null);
    }
  };

  const uploadCaseFile = async (file: File) => {
    if (!imagesModal) return;
    setActionBusy(`upload-${imagesModal.caseId}`);
    setError(null);
    try {
      const res = await supabase.storage.from('medical-images').upload(`cases/${imagesModal.caseId}/${file.name}`, file);
      if (res.error) throw new Error(res.error.message);
      const listRes = await supabase.storage.from('medical-images').listByCase(imagesModal.caseId);
      setImagesModal({ ...imagesModal, images: listRes.data || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع المرفق الطبي.');
    } finally {
      setActionBusy(null);
    }
  };

  const whatsapp = import.meta.env.VITE_ADMIN_WHATSAPP as string | undefined;
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('مرحباً، أحتاج متابعة طلبي في منصة أسنان الأساس.')}` : null;

  if (loading || busy) return <div className="customer-loading" dir="rtl"><Loader2 className="animate-spin" size={26} /> جارٍ تحميل حسابك…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="customer-app-page customer-patient-dashboard min-h-screen bg-slate-50" dir="rtl">
      <Header />
      <main className="customer-app-main mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="customer-page-heading flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="customer-kicker">حساب المريض</span>
            <h1 className="mt-1 text-3xl font-black text-slate-900">متابعة طلباتك</h1>
            <p className="mt-2 text-slate-500">الحالة والمواعيد والإشعارات من البيانات الفعلية.</p>
          </div>
          <div className="customer-page-actions flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="customer-secondary-action inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">
              <RefreshCw size={16} /> تحديث
            </button>
            <Link to="/profile" className="customer-secondary-action rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">
              تعديل الملف الشخصي
            </Link>
            <Link to="/patient/new-case" className="customer-primary-action rounded-xl bg-primary-600 px-4 py-3 font-bold text-white">
              إرسال حالة جديدة
            </Link>
          </div>
        </div>
        {error && <p className="customer-alert customer-alert-error mt-6" role="alert">تعذر تنفيذ العملية: {error}</p>}
        <div className="customer-dashboard-grid mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="customer-section-card rounded-2xl bg-white p-5 shadow-sm">
            <div className="customer-section-heading flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <FileHeart size={20} className="text-primary-600" /> حالاتي
              </h2>
              <span className="text-sm text-slate-400">{cases.length} حالة</span>
            </div>
            {cases.length === 0 ? (
              <p className="customer-empty mt-8 rounded-xl bg-slate-50 p-8 text-center text-slate-500">لم ترسل أي حالة بعد.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {cases.map((item) => {
                  const canModify = ['PENDING', 'NEW', 'UNDER_REVIEW', 'WAITING_FOR_MATCH'].includes(item.status);
                  return (
                    <article className="customer-list-row rounded-xl border border-slate-100 p-4" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <b className="text-primary-700">{item.case_number}</b>
                          {item.title && <div className="mt-1 text-sm font-bold text-slate-800">{item.title}</div>}
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>
                        </div>
                        <span className="customer-status whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {statusLabel[item.status] || item.status}
                        </span>
                      </div>
                      {item.status === 'REJECTED' && item.rejection_reason && (
                        <div className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                          <b>سبب الرفض:</b> {item.rejection_reason}
                        </div>
                      )}
                      {item.matched_student_id && (
                        <div className="mt-2 rounded-lg bg-teal-50 p-2.5 text-xs text-teal-800">
                          تم ربط حالتك بطالب طب أسنان معتمد وجارٍ التنسيق عبر الإدارة.
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3">
                        <small className="text-slate-400">{new Date(item.created_at).toLocaleDateString('ar-IQ')}</small>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openImagesModal(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <Eye size={13} /> المرفقات الطبية
                          </button>
                          {canModify && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingCase({ id: item.id, case_number: item.case_number, description: item.description, patient_age: String(item.patient_age || 25) })}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50"
                              >
                                <Edit3 size={13} /> تعديل
                              </button>
                              <button
                                type="button"
                                disabled={actionBusy === item.id}
                                onClick={() => void cancelCase(item.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                              >
                                <XCircle size={13} /> إلغاء الحالة
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="customer-dashboard-side space-y-6">
            <div className="customer-section-card rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <CalendarDays size={20} className="text-primary-600" /> مواعيدي
              </h2>
              {appointments.length === 0 ? (
                <p className="customer-empty mt-5 text-sm text-slate-500">لا توجد مواعيد مؤكدة حالياً.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {appointments.map((item) => (
                    <div className="customer-appointment rounded-xl bg-teal-50 p-4 text-sm" key={item.id}>
                      <b>{new Date(item.appointment_date).toLocaleString('ar-IQ')}</b>
                      <p className="mt-1">
                        {item.location_name || 'سيحدد المكان من الإدارة'} · {item.status}
                      </p>
                      {item.notes && <p className="mt-1 text-slate-600">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="customer-section-card rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <Bell size={20} className="text-primary-600" /> الإشعارات
              </h2>
              {notifications.length === 0 ? (
                <p className="customer-empty mt-5 text-sm text-slate-500">لا توجد إشعارات جديدة.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {notifications.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => void markRead(item.id)}
                      className={`customer-notification block w-full rounded-xl p-3 text-right text-sm ${item.is_read ? 'bg-slate-50' : 'bg-blue-50'}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <b>{item.title}</b>
                        {!item.is_read && <CheckCircle2 size={16} className="text-blue-600" />}
                      </span>
                      <span className="mt-1 block text-slate-600">{item.message}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="customer-whatsapp flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white">
                <MessageCircle size={18} /> التواصل مع الإدارة عبر واتساب <ExternalLink size={15} />
              </a>
            ) : (
              <p className="customer-alert customer-alert-warning rounded-xl p-3 text-sm">سيظهر رابط واتساب الإدارة بعد ضبط الرقم من إعدادات البيئة.</p>
            )}
          </section>
        </div>
      </main>

      {editingCase && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={saveEditCase} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black">تعديل الحالة {editingCase.case_number}</h3>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold">العمر</span>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={editingCase.patient_age}
                onChange={(e) => setEditingCase({ ...editingCase, patient_age: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold">وصف المشكلة</span>
              <textarea
                required
                minLength={10}
                value={editingCase.description}
                onChange={(e) => setEditingCase({ ...editingCase, description: e.target.value })}
                className="h-32 w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCase(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">
                إلغاء
              </button>
              <button type="submit" disabled={actionBusy === editingCase.id} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white">
                <Save size={15} /> حفظ التعديل
              </button>
            </div>
          </form>
        </div>
      )}

      {imagesModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black">المرفقات الطبية للحالة {imagesModal.caseNumber}</h3>
              <button type="button" onClick={() => setImagesModal(null)} className="rounded-lg px-3 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100">
                إغلاق
              </button>
            </div>
            <div className="mt-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm font-bold text-teal-700 hover:bg-slate-50">
                <UploadCloud size={18} />
                <span>رفع صورة أو أشعة جديدة (JPG, PNG, WEBP, PDF)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCaseFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {imagesModal.images.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">لا توجد صور أو أشعة مرفقة بهذه الحالة حالياً.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {imagesModal.images.map((img) => (
                  <div key={img.id} className="rounded-xl border border-slate-200 p-3">
                    {img.mime_type?.startsWith('image/') ? (
                      <ImageWithFallback src={img.signed_url} fallbackSrc="/images/categories/default-category.svg" alt={img.file_name} className="h-36 w-full rounded-lg object-cover" />
                    ) : (
                      <a href={img.signed_url} target="_blank" rel="noreferrer" className="block rounded-lg bg-slate-100 p-4 text-center text-sm font-bold text-teal-700">
                        فتح ملف PDF ({img.file_name})
                      </a>
                    )}
                    <small className="mt-2 block truncate text-xs text-slate-500">{img.file_name}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CustomerFooter />
    </div>
  );
};
