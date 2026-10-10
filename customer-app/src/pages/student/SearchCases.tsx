import { Activity, AlertCircle, CheckCircle, Loader2, MapPin, Search, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type CaseRow = { id: string; case_number: string; patient_age: number | null; patient_gender: string | null; description: string; symptoms: string[] | null; ai_tags: string[] | null; ai_summary: string | null; created_at: string };

export const SearchCases = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    void supabase.rpc('search_anonymized_patient_cases', { p_limit: 30, p_offset: 0 }).then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message);
      else setCases((data || []) as CaseRow[]);
      setBusy(false);
    });
  }, [user]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return cases;
    return cases.filter((item) => [item.case_number, item.description, item.ai_summary, ...(item.symptoms || []), ...(item.ai_tags || [])].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized));
  }, [cases, query]);

  if (loading || busy) return <div className="customer-loading" dir="rtl"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return <div className="customer-app-page" dir="rtl"><Header /><main className="customer-app-main">
    <div className="customer-page-heading"><div><span className="customer-kicker">المطابقة السريرية</span><h1>البحث عن الحالات</h1><p className="mt-2 text-sm text-slate-500">حالات مجهّلة وموافق عليها للمطابقة السريرية.</p></div><div className="customer-page-actions"><Link to="/student/request" className="customer-primary-action">إنشاء طلب سريري</Link></div></div>
    {error && <div className="customer-alert customer-alert-error" role="alert"><AlertCircle size={18} /> <span>تعذر تحميل الحالات: {error}</span></div>}
    {!error && <section className="customer-section-card"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="customer-section-heading mb-0"><h2>الحالات المتاحة</h2><span className="customer-status">{filteredCases.length} حالة</span></div><p className="mt-2 text-xs text-slate-500">ابحث في رقم الحالة والوصف والأعراض المجهّلة.</p></div><label className="relative block sm:w-72"><Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input aria-label="البحث في الحالات" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الحالات..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pe-10 ps-3 text-sm outline-none focus:border-teal-500" /></label></div></section>}
    {!error && filteredCases.length === 0 && <div className="customer-empty mt-5">{cases.length === 0 ? 'لا توجد حالات منشورة للمطابقة حالياً.' : 'لا توجد نتائج تطابق البحث الحالي.'}</div>}
    <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{filteredCases.map((patientCase) => <article key={patientCase.id} className="customer-section-card flex flex-col"><div className="flex items-start justify-between gap-3"><span className="customer-status">{patientCase.case_number}</span><span className="customer-status"><CheckCircle size={14} /> متاحة</span></div><div className="mt-5 flex gap-4 text-sm text-slate-500"><span className="flex items-center gap-1"><User size={15} /> {patientCase.patient_age || '—'} سنة</span><span className="flex items-center gap-1"><MapPin size={15} /> محافظة محددة</span></div><h2 className="mt-5 text-lg font-black text-slate-800">حالة سريرية مجهّلة</h2><p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{patientCase.description}</p><div className="mt-4 flex flex-wrap gap-2">{(patientCase.symptoms || []).map((item) => <span key={item} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{item}</span>)}{(patientCase.ai_tags || []).map((item) => <span key={item} className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700"><Activity size={12} />{item}</span>)}</div><button type="button" onClick={() => navigate(`/student/request?case=${patientCase.id}`)} className="customer-secondary-action mt-6 w-full">طلب مطابقة لهذه الحالة</button></article>)}</div>
  </main></div>;
};
