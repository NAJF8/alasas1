import { Activity, AlertCircle, CheckCircle, Eye, FileText, Filter, Loader2, MapPin, RefreshCw, Search, User, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { CustomerFooter } from '../../components/layout/PreferencesBar';
import { useAuth } from '../../context/AuthContext';
import { callBackend, firebaseData as supabase } from '../../lib/firebaseData';
import { getActiveCategories, getActiveProvinces } from '../../lib/referenceData';

type CaseRow = {
  id: string;
  case_number: string;
  province_id?: string | null;
  area_id?: string | null;
  clinical_category_id?: string | null;
  title?: string | null;
  patient_age: number | null;
  patient_gender: string | null;
  description: string;
  symptoms: string[] | null;
  available_days?: string[] | null;
  preferred_periods?: string[] | null;
  ai_tags?: string[] | null;
  ai_summary?: string | null;
  created_at: string;
};

type StudentRequestRow = {
  id: string;
  request_number: string;
  clinical_category_id?: string | null;
  tooth_area?: string | null;
  requested_case_id?: string | null;
  requested_case_number?: string | null;
  matched_case_id?: string | null;
  status: string;
  created_at: string;
};

type MatchRow = {
  id: string;
  status: string;
  patient_case_id: string;
  student_request_id: string;
  case_number: string | null;
  case_description: string | null;
  case_status: string | null;
  request_number: string | null;
  created_at: string;
};

const requestStatusLabel: Record<string, string> = {
  PENDING: 'بانتظار مراجعة الإدارة',
  VERIFIED: 'معتمد وجاهز للمطابقة',
  MATCHED: 'تمت المطابقة مع حالة',
  IN_PROGRESS: 'قيد المعالجة',
  COMPLETED: 'مكتمل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغى',
};

export const SearchCases = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [myRequests, setMyRequests] = useState<StudentRequestRow[]>([]);
  const [myMatches, setMyMatches] = useState<MatchRow[]>([]);
  const [provinces, setProvinces] = useState<Array<{ id: string; name_ar: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name_ar: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [caseImagesModal, setCaseImagesModal] = useState<{ caseNumber: string; images: Array<{ id: string; file_name: string; signed_url: string; mime_type: string }> } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setCases([]);
      setMyRequests([]);
      setMyMatches([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    const [casesRes, reqRes, matchRes, provRows, catRows] = await Promise.all([
      supabase.rpc('search_anonymized_patient_cases', { p_limit: 50, p_offset: 0 }),
      supabase.from('student_requests').select('*').eq('student_id', user.id),
      callBackend<{ data: MatchRow[] }>('/api/my-matches').catch(() => ({ data: [] as MatchRow[] })),
      getActiveProvinces(),
      getActiveCategories(),
    ]);
    if (casesRes.error) {
      setError(casesRes.error.message);
    } else {
      const data = casesRes.data;
      const rows = Array.isArray(data) ? data : data && Array.isArray((data as { data?: unknown }).data) ? (data as { data: CaseRow[] }).data : [];
      setCases(rows);
    }
    const sortedReqs = ([...(reqRes.data || [])] as StudentRequestRow[]).sort(
      (a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0),
    );
    setMyRequests(sortedReqs);
    setMyMatches(matchRes.data || []);
    setProvinces(provRows.map((p) => ({ id: p.id, name_ar: p.name_ar })));
    setCategories(catRows.map((c) => ({ id: c.id, name_ar: c.name_ar })));
    setBusy(false);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const provinceName = useCallback((id?: string | null) => provinces.find((p) => p.id === id)?.name_ar || 'محافظة محددة', [provinces]);
  const categoryName = useCallback((id?: string | null) => categories.find((c) => c.id === id)?.name_ar || null, [categories]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return cases.filter((item) => {
      if (provinceFilter && item.province_id !== provinceFilter) return false;
      if (categoryFilter && item.clinical_category_id !== categoryFilter) return false;
      if (!normalized) return true;
      const searchable = [
        item.case_number,
        item.title,
        item.description,
        item.ai_summary,
        provinceName(item.province_id),
        categoryName(item.clinical_category_id),
        ...(item.symptoms || []),
        ...(item.ai_tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return searchable.includes(normalized);
    });
  }, [cases, query, provinceFilter, categoryFilter, provinceName, categoryName]);

  const cancelRequest = async (requestId: string) => {
    setActionBusy(requestId);
    setError(null);
    try {
      await callBackend('/api/student-request-update', { request_id: requestId, action: 'cancel' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الطلب.');
    } finally {
      setActionBusy(null);
    }
  };

  const viewMatchedCaseImages = async (caseId: string, caseNumber: string) => {
    setActionBusy(`img-${caseId}`);
    setError(null);
    try {
      const res = await supabase.storage.from('medical-images').listByCase(caseId);
      if (res.error) throw new Error(res.error.message);
      setCaseImagesModal({ caseNumber, images: res.data || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الصور الطبية للحالة.');
    } finally {
      setActionBusy(null);
    }
  };

  if (loading || busy) return <div className="customer-loading" dir="rtl"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="customer-app-page" dir="rtl">
      <Header />
      <main className="customer-app-main">
        <div className="customer-page-heading">
          <div>
            <span className="customer-kicker">المطابقة السريرية</span>
            <h1>البحث عن الحالات</h1>
            <p className="mt-2 text-sm text-slate-500">حالات مجهّلة ومعتمدة من الإدارة للمطابقة السريرية.</p>
          </div>
          <div className="customer-page-actions flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="customer-secondary-action inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700"
            >
              <RefreshCw size={16} /> تحديث
            </button>
            <Link to="/profile" className="customer-secondary-action rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">
              تعديل الملف الشخصي
            </Link>
            <Link to="/student/request" className="customer-primary-action">
              إنشاء طلب سريري
            </Link>
          </div>
        </div>

        {error && (
          <div className="customer-alert customer-alert-error" role="alert">
            <AlertCircle size={18} /> <span>تعذر إتمام العملية: {error}</span>
          </div>
        )}

        <section className="customer-section-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="customer-section-heading mb-0">
                <h2>الحالات المتاحة</h2>
                <span className="customer-status">{filteredCases.length} حالة</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">ابحث في رقم الحالة والوصف والأعراض المجهّلة أو صفِّ حسب المحافظة والتصنيف السريري.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative block sm:w-64">
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  aria-label="البحث في الحالات"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث في الحالات..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pe-10 ps-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <select
                aria-label="تصفية حسب المحافظة"
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
              >
                <option value="">كل المحافظات</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_ar}</option>
                ))}
              </select>
              <select
                aria-label="تصفية حسب التصنيف السريري"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
              >
                <option value="">كل التصنيفات</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_ar}</option>
                ))}
              </select>
              {(query || provinceFilter || categoryFilter) && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setProvinceFilter(''); setCategoryFilter(''); }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Filter size={14} /> مسح التصفية
                </button>
              )}
            </div>
          </div>
        </section>

        {filteredCases.length === 0 && (
          <div className="customer-empty mt-5">
            {cases.length === 0 ? 'لا توجد حالات منشورة للمطابقة حالياً.' : 'لا توجد نتائج تطابق البحث الحالي.'}
          </div>
        )}

        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredCases.map((patientCase) => {
            const catLabel = categoryName(patientCase.clinical_category_id);
            const alreadyRequested = myRequests.some(
              (r) => r.requested_case_id === patientCase.id && ['PENDING', 'VERIFIED', 'MATCHED'].includes(r.status),
            );
            return (
              <article key={patientCase.id} className="customer-section-card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="customer-status">{patientCase.case_number}</span>
                  <span className="customer-status">
                    <CheckCircle size={14} /> متاحة
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <User size={15} /> {patientCase.patient_age || '—'} سنة
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={15} /> {provinceName(patientCase.province_id)}
                  </span>
                  {catLabel && <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">{catLabel}</span>}
                </div>
                <h2 className="mt-4 text-lg font-black text-slate-800">{patientCase.title || 'حالة سريرية مجهّلة'}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{patientCase.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(patientCase.symptoms || []).map((item) => (
                    <span key={item} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {item}
                    </span>
                  ))}
                  {(patientCase.ai_tags || []).map((item) => (
                    <span key={item} className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700">
                      <Activity size={12} />
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-auto pt-6">
                  {alreadyRequested ? (
                    <span className="block w-full rounded-xl bg-teal-50 py-2.5 text-center text-xs font-bold text-teal-800">
                      تم إرسال طلب مطابقة لهذه الحالة
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/student/request?case=${encodeURIComponent(patientCase.id)}&case_number=${encodeURIComponent(patientCase.case_number)}`)}
                      className="customer-secondary-action w-full"
                    >
                      طلب مطابقة لهذه الحالة
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <section className="customer-section-card mt-8">
          <div className="customer-section-heading">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <FileText size={19} className="text-teal-600" /> طلباتي ومطابقاتي السريرية
            </h2>
            <span className="customer-status">{myRequests.length} طلب</span>
          </div>
          {myRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">لم تقم بإرسال أي طلب سريري بعد.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {myRequests.map((req) => {
                const linkedMatch = myMatches.find((m) => m.student_request_id === req.id);
                return (
                  <div key={req.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm text-slate-900">{req.request_number}</b>
                      <span className="customer-status text-xs">{requestStatusLabel[req.status] || req.status}</span>
                    </div>
                    {req.requested_case_number && (
                      <p className="mt-1 text-xs text-teal-700">الحالة المطلوبة: {req.requested_case_number}</p>
                    )}
                    {req.tooth_area && <p className="mt-1 text-xs text-slate-600">المنطقة/السن: {req.tooth_area}</p>}
                    {linkedMatch && (
                      <div className="mt-3 rounded-lg bg-teal-50 p-3 text-xs text-teal-900">
                        <b>مرتبط بالحالة: {linkedMatch.case_number || linkedMatch.patient_case_id}</b>
                        {linkedMatch.case_description && <p className="mt-1">{linkedMatch.case_description}</p>}
                        <button
                          type="button"
                          disabled={actionBusy === `img-${linkedMatch.patient_case_id}`}
                          onClick={() => void viewMatchedCaseImages(linkedMatch.patient_case_id, linkedMatch.case_number || linkedMatch.patient_case_id)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 font-bold text-white"
                        >
                          <Eye size={13} /> عرض المرفقات الطبية للحالة
                        </button>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>{new Date(req.created_at).toLocaleDateString('ar-IQ')}</span>
                      {['PENDING', 'VERIFIED'].includes(req.status) && (
                        <button
                          type="button"
                          disabled={actionBusy === req.id}
                          onClick={() => void cancelRequest(req.id)}
                          className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline"
                        >
                          <XCircle size={13} /> إلغاء الطلب
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {caseImagesModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black">المرفقات الطبية للحالة {caseImagesModal.caseNumber}</h3>
              <button type="button" onClick={() => setCaseImagesModal(null)} className="rounded-lg px-3 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100">
                إغلاق
              </button>
            </div>
            {caseImagesModal.images.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">لا توجد صور أو أشعة مرفقة بهذه الحالة.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {caseImagesModal.images.map((img) => (
                  <div key={img.id} className="rounded-xl border border-slate-200 p-3">
                    {img.mime_type?.startsWith('image/') ? (
                      <img src={img.signed_url} alt={img.file_name} className="h-40 w-full rounded-lg object-cover" />
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
