import { AlertCircle, Check, CheckCircle2, Download, Eye, Filter, Loader2, Pencil, Plus, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { displayValue } from '../lib/displayValue';
import { firebaseData } from '../lib/firebaseData';
import { UniversityPage as LinkedUniversityPage } from './UniversityPage';
const supabase = firebaseData;

type Column = { key: string; label: string };
type Row = Record<string, unknown> & { id?: string };
type PageConfig = { title: string; description: string; table: string; columns: Column[]; filter?: string };
const configs: Record<string, PageConfig> = {
  '/users': { title: 'إدارة المستخدمين', description: 'بيانات المستخدمين الفعلية وصلاحياتهم.', table: 'profiles', columns: [{ key: 'full_name', label: 'الاسم' }, { key: 'role', label: 'نوع الحساب' }, { key: 'university_id', label: 'الجامعة' }, { key: 'status', label: 'الحالة' }, { key: 'created_at', label: 'تاريخ التسجيل' }] },
  '/patients': { title: 'إدارة المرضى', description: 'ملفات المرضى الفعلية في المنصة.', table: 'profiles', filter: 'PATIENT', columns: [{ key: 'full_name', label: 'المريض' }, { key: 'phone', label: 'الهاتف' }, { key: 'status', label: 'الحالة' }, { key: 'created_at', label: 'تاريخ التسجيل' }] },
  '/students': { title: 'طلاب طب الأسنان', description: 'ملفات الطلاب وحالة الحساب الفعلية من Firestore.', table: 'profiles', filter: 'STUDENT', columns: [{ key: 'full_name', label: 'الطالب' }, { key: 'stage', label: 'المرحلة' }, { key: 'university_id', label: 'الجامعة' }, { key: 'status', label: 'الحساب' }, { key: 'created_at', label: 'تاريخ التسجيل' }] },
  '/cases': { title: 'حالات المرضى', description: 'الحالات السريرية ومراجعتها واعتمادها وحالتها التشغيلية من Firestore.', table: 'patient_cases', columns: [{ key: 'case_number', label: 'رقم الحالة' }, { key: 'patient_id', label: 'معرف المريض' }, { key: 'status', label: 'الحالة' }, { key: 'is_approved_for_student_view', label: 'منشورة للطلاب' }, { key: 'created_at', label: 'تاريخ الإنشاء' }] },
  '/requests': { title: 'طلبات الطلاب', description: 'الطلبات السريرية المسجلة فعلياً.', table: 'student_requests', columns: [{ key: 'request_number', label: 'رقم الطلب' }, { key: 'student_id', label: 'معرف الطالب' }, { key: 'status', label: 'الحالة' }, { key: 'matched_case_id', label: 'الحالة المطابقة' }, { key: 'created_at', label: 'تاريخ الإنشاء' }] },
  '/matches': { title: 'المطابقات', description: 'سجلات المطابقة الفعلية وتحديثات العلاج.', table: 'matches', columns: [{ key: 'id', label: 'المطابقة' }, { key: 'patient_case_id', label: 'الحالة' }, { key: 'student_request_id', label: 'الطلب' }, { key: 'status', label: 'الحالة' }] },
  '/appointments': { title: 'إدارة المواعيد', description: 'المواعيد المسجلة فعلياً.', table: 'appointments', columns: [{ key: 'id', label: 'الموعد' }, { key: 'patient_id', label: 'المريض' }, { key: 'student_id', label: 'الطالب' }, { key: 'status', label: 'الحالة' }] },
  '/notifications': { title: 'الإشعارات', description: 'الإشعارات المخزنة في المنصة.', table: 'notifications', columns: [{ key: 'title', label: 'العنوان' }, { key: 'user_id', label: 'المستخدم' }, { key: 'is_read', label: 'مقروء' }, { key: 'created_at', label: 'التاريخ' }] },
  '/reports': { title: 'التقارير', description: 'قراءة تشغيلية للبيانات الحالية.', table: 'audit_logs', columns: [{ key: 'action', label: 'الإجراء' }, { key: 'target', label: 'المورد' }, { key: 'actor_id', label: 'المنفذ' }, { key: 'created_at', label: 'التاريخ' }] },
  '/admins': { title: 'إدارة المدراء', description: 'حسابات الإدارة المخولة من قاعدة البيانات.', table: 'profiles', filter: 'ADMIN_ROLES', columns: [{ key: 'full_name', label: 'الاسم' }, { key: 'role', label: 'الدور' }, { key: 'status', label: 'الحالة' }, { key: 'created_at', label: 'تاريخ الإنشاء' }] },
};

type Province = Row & { name_ar: string; name_en: string; is_active: boolean };
const ProvincePage = () => {
  const [rows, setRows] = useState<Province[]>([]); const [query, setQuery] = useState(''); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null); const [editing, setEditing] = useState<string | null>(null); const [modalOpen, setModalOpen] = useState(false); const [form, setForm] = useState({ name_ar: '', name_en: '', is_active: true }); const [saving, setSaving] = useState(false); const [retry, setRetry] = useState(0);
  const load = useCallback(async () => { const result = await supabase.from('provinces').select('id,name_ar,name_en,is_active').order('is_active', { ascending: false }).order('name_ar'); if (result.error) setError(result.error.message); else setRows((result.data || []) as Province[]); }, []);
  useEffect(() => { void load(); }, [load, retry]);
  const filtered = useMemo(() => rows.filter((row) => `${row.name_ar} ${row.name_en}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [rows, query]);
  const close = () => { setEditing(null); setModalOpen(false); setForm({ name_ar: '', name_en: '', is_active: true }); };
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); const payload = { name_ar: form.name_ar.trim(), name_en: form.name_en.trim() || form.name_ar.trim(), is_active: form.is_active }; const result = editing ? await supabase.from('provinces').update(payload).eq('id', editing).select('id,name_ar,name_en,is_active').single() : await supabase.from('provinces').insert(payload).select('id,name_ar,name_en,is_active').single(); if (result.error || !result.data) setError(result.error?.message || 'لم يؤكد Firebase الحفظ.'); else { const readback = await supabase.from('provinces').select('id,name_ar,name_en,is_active').eq('id', result.data.id).single(); if (readback.error || !readback.data) setError(readback.error?.message || 'تمت الكتابة دون إعادة قراءة Firestore.'); else { setRows((current) => editing ? current.map((row) => row.id === editing ? readback.data as Province : row) : [...current, readback.data as Province]); setMessage('تم الحفظ والتحقق من القراءة.'); close(); } } setSaving(false); };
  const toggle = async (row: Province) => { setError(null); const result = await supabase.from('provinces').update({ is_active: !row.is_active }).eq('id', row.id).select('id,name_ar,name_en,is_active').single(); if (result.error || !result.data) setError(result.error?.message || 'تعذر تغيير الظهور.'); else { const readback = await supabase.from('provinces').select('id,name_ar,name_en,is_active').eq('id', row.id).single(); if (readback.error || !readback.data) setError(readback.error?.message || 'إعادة قراءة Firestore غير متاح.'); else { setRows((current) => current.map((item) => item.id === row.id ? readback.data as Province : item)); setMessage(readback.data.is_active ? 'تم إظهار المحافظة.' : 'تم إخفاء المحافظة؛ لم تُحذف البيانات المرتبطة.'); } } };
  return <AdminLayout><div className="management-heading"><div><span className="dashboard-eyebrow">إدارة البيانات المرجعية</span><h1>إدارة المحافظات</h1><p>تحكم بالظهور واستقبال الخيارات الجديدة دون حذف المحافظات المرتبطة تاريخياً.</p></div><button className="dashboard-action" onClick={() => { close(); setModalOpen(true); }}> <Plus size={16} /> محافظة جديدة</button></div>{message && <div className="settings-inline-success"><Check size={15} /> {message}</div>}<section className="admin-panel management-panel"><div className="management-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم المحافظة..." /></div><button onClick={() => setRetry((value) => value + 1)}><RefreshCw size={15} /> تحديث</button></div>{error && <div className="admin-error"><span>{error}</span></div>}<div className="table-scroll"><table><thead><tr><th>المحافظة</th><th>الاسم الإنجليزي</th><th>الظهور واستقبال الطلبات</th><th>الإجراءات</th></tr></thead><tbody>{filtered.map((row) => <tr key={String(row.id)}><td>{row.name_ar}</td><td>{row.name_en}</td><td><span className={`status ${row.is_active ? 'green' : 'red'}`}>{row.is_active ? 'فعالة' : 'مخفية'}</span></td><td className="row-actions"><button className="row-action" onClick={() => { setEditing(String(row.id)); setForm({ name_ar: row.name_ar, name_en: row.name_en, is_active: row.is_active }); setModalOpen(true); }}>تعديل</button><button className="row-action" onClick={() => void toggle(row)}>{row.is_active ? 'إيقاف الطلبات' : 'تفعيل الطلبات'}</button></td></tr>)}</tbody></table></div></section>{modalOpen && <div className="modal-backdrop"><form className="admin-modal" onSubmit={(event) => void save(event)}><div className="panel-heading"><h2>{editing ? 'تعديل محافظة' : 'إضافة محافظة'}</h2><button type="button" onClick={close}><X size={18} /></button></div><label>اسم المحافظة بالعربية<input required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} /></label><label>الاسم بالإنجليزية<input value={form.name_en} onChange={(event) => setForm({ ...form, name_en: event.target.value })} /></label><label className="checkbox-row"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> ظاهرة وتستقبل الخيارات الجديدة</label><div className="modal-actions"><button type="button" onClick={close}>إلغاء</button><button className="dashboard-action" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} حفظ</button></div></form></div>}</AdminLayout>;
};

const GenericManagementPage = ({ path }: { path: string }) => {
  const config = configs[path] || configs['/users'];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retry, setRetry] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [matchCase, setMatchCase] = useState<Row | null>(null);
  const [verifiedRequests, setVerifiedRequests] = useState<Row[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [detailImages, setDetailImages] = useState<Array<{ id: string; file_name: string; signed_url: string; mime_type: string }>>([]);
  const [editUserRow, setEditUserRow] = useState<{ id: string; full_name: string; whatsapp: string; stage: string; status: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await (() => {
      let request = supabase.from(config.table).select('*').limit(150);
      if (config.table === 'profiles') {
        if (config.filter === 'PATIENT' || config.filter === 'STUDENT') request = request.eq('role', config.filter);
        if (config.filter === 'ADMIN_ROLES') request = request.in('role', ['ADMIN', 'SUPER_ADMIN', 'STAFF']);
      } else if (config.table !== 'audit_logs' && config.table !== 'notifications') {
        request = request.order('created_at', { ascending: false });
      }
      return request;
    })();
    if (result.error) setError(result.error.message);
    else setRows((result.data || []) as unknown as Row[]);
    setLoading(false);
  }, [config]);

  useEffect(() => {
    let active = true;
    setStatusFilter('');
    void load().then(() => {
      if (!active) return;
      setMessage(null);
    });
    return () => {
      active = false;
    };
  }, [config, retry, load]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const roleMatches =
          config.filter === 'PATIENT' || config.filter === 'STUDENT'
            ? row.role === config.filter
            : config.filter === 'ADMIN_ROLES'
              ? ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(String(row.role))
              : true;
        const statusMatches = !statusFilter || String(row.status || '') === statusFilter;
        return roleMatches && statusMatches && (!query || Object.values(row).some((value) => displayValue(value).toLocaleLowerCase().includes(query.toLocaleLowerCase())));
      }),
    [rows, query, statusFilter, config],
  );

  const decisionBlocked = ['/cases', '/requests', '/matches', '/students', '/patients', '/users'].includes(path);

  const invokeAction = async (key: string, endpoint: string, body: Record<string, unknown>, expectedStatus?: string) => {
    setActionBusy(key);
    setError(null);
    setMessage(null);
    const result = await supabase.functions.invoke(endpoint, { body });
    const returnedStatus = result.data?.status || result.data?.data?.status;
    if (result.error || (expectedStatus && returnedStatus && returnedStatus !== expectedStatus)) {
      setError(result.error?.message || `لم يؤكد Worker العملية (${expectedStatus || ''}).`);
    } else {
      setMessage('تم تنفيذ العملية عبر Worker والتحقق من إعادة قراءة Firestore.');
      await load();
    }
    setActionBusy(null);
  };

  const decide = async (row: Row, action: 'approve' | 'reject' | 'hide' | 'restore' | 'in_progress' | 'complete' | 'cancel') => {
    const reason = action === 'reject' ? 'مرفوض بعد المراجعة الإدارية' : undefined;
    const id = String(row.id || '');
    if (path === '/cases') {
      const expected =
        action === 'hide'
          ? 'HIDDEN'
          : action === 'reject'
            ? 'REJECTED'
            : action === 'in_progress'
              ? 'IN_PROGRESS'
              : action === 'complete'
                ? 'COMPLETED'
                : action === 'cancel'
                  ? 'CANCELLED'
                  : 'WAITING_FOR_MATCH';
      return invokeAction(id, 'case-approval', { action, case_id: id, reason }, expected);
    }
    return invokeAction(id, 'student-request-review', { action, request_id: id, reason }, action === 'reject' ? 'REJECTED' : 'VERIFIED');
  };

  const decideUser = async (row: Row, action: 'approve' | 'reject' | 'suspend') => {
    const id = String(row.id || '');
    const expected = action === 'approve' ? 'VERIFIED' : action === 'reject' ? 'REJECTED' : 'SUSPENDED';
    await invokeAction(id, 'admin-user-update', { profile_id: id, action }, expected);
  };

  const saveEditUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!editUserRow) return;
    await invokeAction(`edit-${editUserRow.id}`, 'admin-user-update', {
      profile_id: editUserRow.id,
      action: 'update',
      full_name: editUserRow.full_name,
      whatsapp: editUserRow.whatsapp || null,
      stage: editUserRow.stage || null,
      status: editUserRow.status,
    });
    setEditUserRow(null);
  };

  const openCaseDetail = async (row: Row) => {
    setDetailRow(row);
    setDetailImages([]);
    if (path === '/cases' && row.id) {
      const imgRes = await supabase.storage.from('medical-images').listByCase(String(row.id));
      if (!imgRes.error) setDetailImages(imgRes.data || []);
    }
  };

  const openMatch = async (row: Row) => {
    setActionBusy(`match-load-${String(row.id)}`);
    setError(null);
    const result = await supabase.from('student_requests').select('id,request_number,student_id,status,requested_case_id').eq('status', 'VERIFIED').limit(100);
    if (result.error) setError(result.error.message);
    else {
      setMatchCase(row);
      setVerifiedRequests((result.data || []) as Row[]);
      setSelectedRequestId('');
    }
    setActionBusy(null);
  };

  const createMatch = async () => {
    if (!matchCase?.id || !selectedRequestId) return;
    await invokeAction(`match-${String(matchCase.id)}`, 'match', { case_id: String(matchCase.id), request_id: selectedRequestId }, 'MATCHED');
    setMatchCase(null);
    setSelectedRequestId('');
  };

  const updateTreatment = async (row: Row, action: 'in_progress' | 'complete' | 'cancel' = 'complete') => {
    const expected = action === 'in_progress' ? 'IN_PROGRESS' : action === 'cancel' ? 'CANCELLED' : 'COMPLETED';
    await invokeAction(String(row.id), 'complete-treatment', { match_id: String(row.id), action }, expected);
  };

  const csv = async () => {
    const text = [config.columns.map((column) => column.label).join(','), ...filtered.map((row) => config.columns.map((column) => JSON.stringify(displayValue(row[column.key], column.key))).join(','))].join('\n');
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
    setMessage('تم نسخ البيانات إلى الحافظة بصيغة CSV.');
  };
  const clearSearch = () => {
    setQuery('');
    setStatusFilter('');
    setMessage('تم مسح البحث الحالي.');
  };

  return (
    <AdminLayout>
      <div className="management-heading">
        <div>
          <span className="dashboard-eyebrow">الإدارة والتشغيل</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
      </div>
      {decisionBlocked && (
        <div className="admin-notice">
          <AlertCircle size={17} />
          <span>
            <b>الإجراءات محكومة بالـWorker</b>
            <small>كل اعتماد أو رفض أو مطابقة أو تحديث حالة يرسل JWT إلى Worker موثق، ثم تُعاد قراءة النتيجة من Firestore.</small>
          </span>
        </div>
      )}
      {message && (
        <div className="settings-inline-success">
          <Check size={15} /> {message}
        </div>
      )}
      <section className="admin-panel management-panel">
        <div className="management-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في النتائج..." />
          </div>
          {['/cases', '/requests', '/matches', '/students', '/patients', '/users'].includes(path) && (
            <select aria-label="تصفية حسب الحالة" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ borderRadius: 10, border: '1px solid #d7e4ec', padding: '7px 10px', fontSize: 12 }}>
              <option value="">كل الحالات</option>
              <option value="PENDING">PENDING</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="WAITING_FOR_MATCH">WAITING_FOR_MATCH</option>
              <option value="MATCHED">MATCHED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="HIDDEN">HIDDEN</option>
            </select>
          )}
          <button onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={15} /> تحديث
          </button>
          <button onClick={clearSearch} disabled={!query && !statusFilter}>
            <Filter size={16} /> مسح البحث
          </button>
          <button onClick={() => void csv()}>
            <Download size={16} /> تصدير
          </button>
        </div>
        {loading ? (
          <div className="empty-panel">
            <Loader2 className="animate-spin" /> جارٍ تحميل البيانات…
          </div>
        ) : error ? (
          <div className="admin-error">
            <strong>تعذر تحميل هذا القسم</strong>
            <span>{error}</span>
            <button onClick={() => setRetry((value) => value + 1)}>إعادة المحاولة</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-panel">لا توجد سجلات مطابقة حالياً.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => {
                  const isSuperAdminRow = row.role === 'SUPER_ADMIN' || String(row.email || '').toLowerCase() === 'mohameadalhaear100@gmail.com';
                  return (
                    <tr key={String(row.id || index)}>
                      {config.columns.map((column) => (
                        <td key={column.key}>{displayValue(row[column.key], column.key)}</td>
                      ))}
                      <td className="row-actions">
                        {path === '/cases' && (
                          <>
                            <button className="row-action" onClick={() => void openCaseDetail(row)}>
                              <Eye size={13} /> تفاصيل
                            </button>
                            {(row.status === 'PENDING' || row.status === 'NEW' || row.status === 'UNDER_REVIEW' || row.status === 'REJECTED' || (row.status === 'WAITING_FOR_MATCH' && !row.is_approved_for_student_view)) && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'approve')}>
                                <CheckCircle2 size={13} /> موافقة
                              </button>
                            )}
                            {['PENDING', 'NEW', 'UNDER_REVIEW', 'WAITING_FOR_MATCH'].includes(String(row.status)) && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'reject')}>
                                <XCircle size={13} /> رفض
                              </button>
                            )}
                            {row.status === 'WAITING_FOR_MATCH' && Boolean(row.is_approved_for_student_view) && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void openMatch(row)}>
                                إنشاء مطابقة
                              </button>
                            )}
                            {row.status === 'MATCHED' && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'in_progress')}>
                                بدء المعالجة
                              </button>
                            )}
                            {['MATCHED', 'IN_PROGRESS'].includes(String(row.status)) && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'complete')}>
                                <CheckCircle2 size={13} /> إكمال العلاج
                              </button>
                            )}
                            {['WAITING_FOR_MATCH', 'MATCHED'].includes(String(row.status)) && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'hide')}>
                                إخفاء
                              </button>
                            )}
                            {row.status === 'HIDDEN' && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'restore')}>
                                <CheckCircle2 size={13} /> إعادة إظهار
                              </button>
                            )}
                          </>
                        )}

                        {path === '/requests' && (
                          <>
                            <button className="row-action" onClick={() => setDetailRow(row)}>
                              <Eye size={13} /> تفاصيل
                            </button>
                            {row.status === 'PENDING' && (
                              <>
                                <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'approve')}>
                                  <CheckCircle2 size={13} /> موافقة
                                </button>
                                <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decide(row, 'reject')}>
                                  <XCircle size={13} /> رفض
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {path === '/matches' && (
                          <>
                            {row.status === 'MATCHED' && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void updateTreatment(row, 'in_progress')}>
                                قيد المعالجة
                              </button>
                            )}
                            {['MATCHED', 'IN_PROGRESS'].includes(String(row.status)) && (
                              <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void updateTreatment(row, 'complete')}>
                                إكمال العلاج
                              </button>
                            )}
                            {row.status === 'COMPLETED' && <span className="status green">مكتملة</span>}
                          </>
                        )}

                        {['/students', '/patients', '/users'].includes(path) && (
                          isSuperAdminRow ? (
                            <span className="status green">مالك النظام (محمي)</span>
                          ) : ['STUDENT', 'PATIENT'].includes(String(row.role)) ? (
                            <>
                              <button
                                className="row-action"
                                onClick={() =>
                                  setEditUserRow({
                                    id: String(row.id),
                                    full_name: String(row.full_name || ''),
                                    whatsapp: String(row.whatsapp || row.phone || ''),
                                    stage: String(row.stage || ''),
                                    status: String(row.status || 'VERIFIED'),
                                  })
                                }
                              >
                                <Pencil size={12} /> تعديل
                              </button>
                              {row.status !== 'VERIFIED' && (
                                <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decideUser(row, 'approve')}>
                                  <CheckCircle2 size={13} /> اعتماد
                                </button>
                              )}
                              {row.status === 'VERIFIED' && (
                                <button className="row-action" disabled={actionBusy === String(row.id)} onClick={() => void decideUser(row, 'suspend')}>
                                  <XCircle size={13} /> إيقاف
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">قراءة فقط</span>
                          )
                        )}

                        {!['/cases', '/requests', '/matches', '/students', '/patients', '/users'].includes(path) && <span className="text-slate-400">قراءة فقط</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>عرض {filtered.length} نتيجة من البيانات الحقيقية</span>
          <span>الحد الأقصى المعروض 150</span>
        </div>
      </section>

      {matchCase && (
        <div className="modal-backdrop">
          <form
            className="admin-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void createMatch();
            }}
          >
            <div className="panel-heading">
              <h2>إنشاء مطابقة للحالة {displayValue(matchCase.case_number || matchCase.id)}</h2>
              <button type="button" onClick={() => setMatchCase(null)}>
                <X size={18} />
              </button>
            </div>
            <label>
              طلب الطالب المعتمد
              <select required value={selectedRequestId} onChange={(event) => setSelectedRequestId(event.target.value)}>
                <option value="">اختر طلباً</option>
                {verifiedRequests.map((request) => (
                  <option key={String(request.id)} value={String(request.id)}>
                    {displayValue(request.request_number || request.id)} — {displayValue(request.student_id)}
                  </option>
                ))}
              </select>
            </label>
            {verifiedRequests.length === 0 && <div className="empty-panel">لا توجد طلبات طلاب معتمدة للمطابقة.</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setMatchCase(null)}>
                إلغاء
              </button>
              <button className="dashboard-action" disabled={!selectedRequestId || actionBusy === `match-${String(matchCase.id)}`}>
                {actionBusy === `match-${String(matchCase.id)}` ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} إنشاء المطابقة
              </button>
            </div>
          </form>
        </div>
      )}

      {editUserRow && (
        <div className="modal-backdrop">
          <form className="admin-modal" onSubmit={(e) => void saveEditUser(e)}>
            <div className="panel-heading">
              <h2>تعديل ملف الحساب</h2>
              <button type="button" onClick={() => setEditUserRow(null)}>
                <X size={18} />
              </button>
            </div>
            <label>
              الاسم الكامل
              <input required value={editUserRow.full_name} onChange={(e) => setEditUserRow({ ...editUserRow, full_name: e.target.value })} />
            </label>
            <label>
              رقم واتساب
              <input value={editUserRow.whatsapp} onChange={(e) => setEditUserRow({ ...editUserRow, whatsapp: e.target.value })} />
            </label>
            <label>
              حالة الحساب
              <select value={editUserRow.status} onChange={(e) => setEditUserRow({ ...editUserRow, status: e.target.value })}>
                <option value="VERIFIED">VERIFIED (معتمد)</option>
                <option value="PENDING">PENDING (بانتظار الاعتماد)</option>
                <option value="SUSPENDED">SUSPENDED (موقوف)</option>
                <option value="REJECTED">REJECTED (مرفوض)</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setEditUserRow(null)}>
                إلغاء
              </button>
              <button className="dashboard-action" disabled={actionBusy === `edit-${editUserRow.id}`}>
                <Check size={16} /> حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {detailRow && (
        <div className="modal-backdrop">
          <div className="admin-modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="panel-heading">
              <h2>تفاصيل السجل {displayValue(detailRow.case_number || detailRow.request_number || detailRow.id)}</h2>
              <button type="button" onClick={() => setDetailRow(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              {Object.entries(detailRow)
                .filter(([k]) => k !== 'status_history')
                .map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #eef3f7', paddingBottom: 6 }}>
                    <b>{k}</b>
                    <span>{displayValue(v, k)}</span>
                  </div>
                ))}
            </div>
            {Array.isArray(detailRow.status_history) && detailRow.status_history.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>سجل تغييرات الحالة</h3>
                <ul style={{ fontSize: 12, paddingRight: 18 }}>
                  {(detailRow.status_history as any[]).map((item, idx) => (
                    <li key={idx}>
                      <b>{item.status}</b> — {item.at ? new Date(item.at).toLocaleString('ar-IQ') : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detailImages.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>المرفقات الطبية الخاصة (روابط موقعة مؤقتة)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {detailImages.map((img) => (
                    <div key={img.id} style={{ border: '1px solid #d7e4ec', borderRadius: 10, padding: 8 }}>
                      {img.mime_type?.startsWith('image/') ? (
                        <img src={img.signed_url} alt={img.file_name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <a href={img.signed_url} target="_blank" rel="noreferrer">
                          فتح PDF ({img.file_name})
                        </a>
                      )}
                      <small style={{ display: 'block', marginTop: 4, fontSize: 11 }}>{img.file_name}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setDetailRow(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export const ManagementPage = ({ path }: { path: string }) =>
  path === '/universities' ? <LinkedUniversityPage /> : path === '/provinces' ? <ProvincePage /> : <GenericManagementPage path={path} />;
