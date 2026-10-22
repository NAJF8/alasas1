import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { firebaseData as supabase } from '../lib/firebaseData';

type RegistrationRequest = {
  id: string; full_name: string; phone_e164: string; role: string; gender: string;
  province_id: string; area_id: string | null; birth_date: string | null;
  university_id: string | null; stage: string | null; status: string;
  rejection_reason: string | null; reviewed_at: string | null; created_at: string;
  whatsapp_url: string | null;
};

const statusLabel: Record<string, string> = { PENDING: 'بانتظار المراجعة', VERIFIED: 'تمت الموافقة', REJECTED: 'مرفوض', SUSPENDED: 'موقوف' };

export const RegistrationRequestsPage = () => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('registration-admin', { body: { action: 'list' } });
    if (invokeError || !Array.isArray(data?.requests)) setError(invokeError?.message || 'Backend طلبات التسجيل غير متاح أو لم يُفعّل بعد.');
    else setRequests(data.requests as RegistrationRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (request: RegistrationRequest, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('سبب الرفض (اختياري):', '') : null;
    if (action === 'reject' && reason === null) return;
    setBusyId(request.id); setError(null); setMessage(null);
    const { data, error: invokeError } = await supabase.functions.invoke('registration-admin', { body: { action, request_id: request.id, reason: reason || undefined } });
    if (invokeError || data?.status !== (action === 'approve' ? 'VERIFIED' : 'REJECTED')) setError(invokeError?.message || 'لم يؤكد Backend القرار عبر Readback.');
    else { setMessage(action === 'approve' ? 'تمت الموافقة والتحقق من قراءة القرار.' : 'تم رفض الطلب والتحقق من قراءة القرار.'); await load(); }
    setBusyId(null);
  };

  return <AdminLayout><div className="management-heading"><div><span className="dashboard-eyebrow">الإدارة والتشغيل</span><h1>طلبات تسجيل الحسابات</h1><p>طلبات حقيقية من Backend التسجيل، مع حالة القرار وReadback بعد كل عملية.</p></div><button className="dashboard-action" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> تحديث</button></div>{message && <div className="settings-inline-success"><CheckCircle2 size={16} /> {message}</div>}<section className="admin-panel management-panel"><div className="admin-notice"><ShieldCheck size={18} /><span><b>بوابة الموافقات الآمنة</b><small>لا تظهر كلمات المرور. الموافقة لا تنشئ جلسة أو تفعّل الدخول قبل استكمال مسار التحقق.</small></span></div>{loading ? <div className="empty-panel"><Loader2 className="animate-spin" /> جارٍ تحميل الطلبات…</div> : error ? <div className="admin-error"><AlertCircle size={18} /><span>{error}</span><button onClick={() => void load()}>إعادة المحاولة</button></div> : requests.length === 0 ? <div className="empty-panel"><Clock3 size={24} /><strong>لا توجد طلبات تسجيل محفوظة.</strong></div> : <div className="table-scroll"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>الدور</th><th>المحافظة</th><th>الحالة</th><th>وقت الطلب</th><th>الإجراءات</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><b>{request.full_name}</b><small className="cell-subtitle">{request.gender}</small></td><td dir="ltr">{request.phone_e164}</td><td>{request.role === 'STUDENT' ? 'طالب' : 'مريض'}</td><td>{request.province_id}</td><td>{statusLabel[request.status] || request.status}</td><td>{new Date(request.created_at).toLocaleString('ar-IQ')}</td><td className="row-actions">{request.status === 'PENDING' && <><button className="row-action" disabled={busyId === request.id} onClick={() => void decide(request, 'approve')}><CheckCircle2 size={14} /> موافقة</button><button className="row-action" disabled={busyId === request.id} onClick={() => void decide(request, 'reject')}><XCircle size={14} /> رفض</button></>}{request.whatsapp_url && <a className="row-action" href={request.whatsapp_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> واتساب</a>}</td></tr>)}</tbody></table></div>}</section></AdminLayout>;
};
