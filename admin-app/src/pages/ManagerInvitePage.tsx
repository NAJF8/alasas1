import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export const ManagerInvitePage = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const [message, setMessage] = useState('جارٍ التحقق من الدعوة…');
  const invitation = new URLSearchParams(window.location.search).get('invitation') || new URLSearchParams(window.location.hash.split('?')[1] || '').get('invitation');
  useEffect(() => { if (!user || !invitation) return; void supabase.rpc('admin_accept_manager_invitation', { p_invitation_id: invitation }).then(({ error }) => setMessage(error ? `تعذر قبول الدعوة: ${error.message}` : 'تم تفعيل الحساب. يمكنك فتح لوحة الإدارة.')); }, [user, invitation]);
  if (loading) return <main className="admin-invite-page" dir="rtl"><Loader2 className="animate-spin" /></main>;
  return <main className="admin-invite-page" dir="rtl"><section className="admin-invite-card"><div className="admin-invite-mark"><ShieldCheck size={28} /></div><span className="dashboard-eyebrow">AL ASAS DENTAL</span><h1>دعوة إدارة المنصة</h1>{!invitation ? <div className="admin-error"><span>رابط الدعوة غير صحيح أو انتهت صلاحيته.</span></div> : user ? <><div className="admin-notice"><CheckCircle2 size={18} /><span>{message}</span></div>{message.startsWith('تم تفعيل') && <a className="admin-auth-submit" href="/admin/">فتح لوحة الإدارة</a>}</> : <><p>سجّل الدخول بحساب Google المطابق للبريد المدعو لقبول الدعوة.</p><button className="admin-auth-submit" onClick={() => void signInWithGoogle()}>تسجيل الدخول عبر Google</button></>}</section></main>;
};
