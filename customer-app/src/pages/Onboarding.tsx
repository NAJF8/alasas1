import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, MapPin, Save, University, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { clearAuthIntent, isProfileComplete, readAuthIntent, useAuth, type CustomerRole } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getActiveProvinces, getActiveUniversities } from '../lib/referenceData';

type Option = { id: string; name_ar: string; province_id?: string };
type Values = { full_name: string; phone: string; whatsapp: string; gender: string; birth_date: string; province_id: string; area_id: string; university_id: string; stage: string };
const MAX_UNIVERSITIES = 4;
const stages = [{ value: 'THIRD', label: 'الثالثة' }, { value: 'FOURTH', label: 'الرابعة' }, { value: 'FIFTH', label: 'الخامسة' }];
const genderOptions = [{ value: 'MALE', label: 'ذكر' }, { value: 'FEMALE', label: 'أنثى' }];
const initialValues = (name = ''): Values => ({ full_name: name, phone: '', whatsapp: '', gender: '', birth_date: '', province_id: '', area_id: '', university_id: '', stage: '' });

export const Onboarding = () => {
  const { user, profile, loading, saveOnboarding, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const pendingRole = readAuthIntent()?.role as CustomerRole | undefined;
  const profileRole = profile?.role === 'STUDENT' ? 'STUDENT' : profile?.role === 'PATIENT' ? 'PATIENT' : null;
  const role: CustomerRole | null = profileRole || pendingRole || null;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(() => initialValues(user?.user_metadata?.full_name || user?.user_metadata?.name || ''));
  const [provinces, setProvinces] = useState<Option[]>([]); const [areas, setAreas] = useState<Option[]>([]); const [universities, setUniversities] = useState<Option[]>([]); const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const isStudent = role === 'STUDENT';
  const steps = isStudent ? ['معلومات الحساب', 'المعلومات الأكاديمية', 'الجامعات المفضلة', 'المراجعة'] : ['معلومات الحساب', 'الجامعات المناسبة', 'المراجعة'];

  useEffect(() => { if (!profile) return; setValues((current) => ({ ...current, full_name: profile.full_name || current.full_name, phone: profile.phone || '', whatsapp: profile.whatsapp || '', gender: profile.gender || '', birth_date: profile.birth_date || '', province_id: profile.province_id || '', area_id: profile.area_id || '', university_id: profile.university_id || '', stage: profile.stage || '' })); }, [profile]);
  useEffect(() => { void Promise.all([getActiveProvinces(), getActiveUniversities()]).then(([provinceRows, universityRows]) => { setProvinces(provinceRows as Option[]); setUniversities(universityRows as Option[]); setLoadingData(false); }); }, []);
  useEffect(() => { if (!values.province_id) { setAreas([]); return; } void supabase.from('areas').select('id, name_ar').eq('province_id', values.province_id).eq('is_active', true).order('name_ar').then(({ data }) => setAreas((data || []) as Option[])); }, [values.province_id]);
  useEffect(() => { if (!user || !role) return; const table = role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities'; const column = role === 'PATIENT' ? 'patient_id' : 'student_id'; void supabase.from(table).select('university_id').eq(column, user.id).then(({ data }) => setSelectedIds((data || []).map((row) => row.university_id as string))); }, [role, user]);

  const selectedUniversities = useMemo(() => universities.filter((item) => selectedIds.includes(item.id)), [selectedIds, universities]);
  const set = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const toggleUniversity = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < MAX_UNIVERSITIES ? [...current, id] : current);
  const universityName = (id: string) => universities.find((item) => item.id === id)?.name_ar || '—';
  const provinceName = provinces.find((item) => item.id === values.province_id)?.name_ar || '—';
  const areaName = areas.find((item) => item.id === values.area_id)?.name_ar || '—';
  const field = (label: string, key: keyof Values, type = 'text', required = true) => <label className="onboarding-field"><span>{label}</span><input required={required} type={type} value={values[key]} onChange={(event) => set(key, event.target.value)} /></label>;

  if (loading || loadingData) return <div className="onboarding-loading" dir="rtl"><Loader2 className="animate-spin" size={26} /> جاري تجهيز حسابك...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && !profileRole) return <Navigate to="/" replace />;
  if (!role) return <Navigate to="/register" replace />;
  if (isProfileComplete(profile)) return <Navigate to="/dashboard" replace />;

  const universityStep = isStudent ? 2 : 1;
  const validate = () => {
    if (step === 0 && (!values.full_name.trim() || !values.phone.trim() || !values.province_id || !values.area_id || (!isStudent && (!values.gender || !values.birth_date)))) return 'أكمل معلومات الحساب قبل المتابعة.';
    if (isStudent && step === 1 && (!values.university_id || !values.stage)) return 'اختر الجامعة الأساسية والمرحلة.';
    if (step === universityStep && (selectedIds.length < 1 || selectedIds.length > MAX_UNIVERSITIES)) return 'اختر جامعة واحدة على الأقل وبحد أقصى 4 جامعات.';
    return null;
  };
  const next = () => { const message = validate(); if (message) { setError(message); return; } setError(null); setStep((current) => Math.min(current + 1, steps.length - 1)); };
  const back = () => { setError(null); if (step === 0) { clearAuthIntent(); navigate('/register'); } else setStep((current) => current - 1); };
  const save = async () => {
    const message = validate(); if (message) { setError(message); return; }
    setSaving(true); setError(null);
    const result = await saveOnboarding({ role, full_name: values.full_name.trim(), phone: values.phone.trim(), whatsapp: values.whatsapp.trim() || null, province_id: values.province_id, area_id: values.area_id, gender: isStudent ? null : values.gender, birth_date: isStudent ? null : values.birth_date, university_id: isStudent ? values.university_id : null, stage: isStudent ? values.stage : null });
    if (result) { setError(result); setSaving(false); return; }
    const table = role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities'; const column = role === 'PATIENT' ? 'patient_id' : 'student_id';
    const { error: deleteError } = await supabase.from(table).delete().eq(column, user.id);
    const { error: preferenceError } = deleteError ? { error: deleteError } : await supabase.from(table).insert(selectedIds.map((university_id) => ({ [column]: user.id, university_id })));
    if (preferenceError) setError(`تعذر حفظ الجامعات المفضلة: ${preferenceError.message}`); else {
      const { data: savedPreferences, error: readbackError } = await supabase.from(table).select('university_id').eq(column, user.id);
      const savedIds = (savedPreferences || []).map((row) => row.university_id as string).sort();
      const expectedIds = [...selectedIds].sort();
      if (readbackError || savedIds.length !== expectedIds.length || savedIds.some((id, index) => id !== expectedIds[index])) {
        setError(readbackError?.message || 'تم حفظ الملف لكن لم تتطابق قراءة الجامعات المحفوظة. لم يتم فتح الحساب.');
        setSaving(false);
        return;
      }
      const savedProfile = await refreshProfile();
      if (!savedProfile || !isProfileComplete(savedProfile)) setError('تم الحفظ لكن تعذر قراءة الملف والجامعات المحفوظة. أعد المحاولة.');
      else { clearAuthIntent(); navigate('/dashboard', { replace: true }); }
    }
    setSaving(false);
  };

  return <main className="onboarding-page" dir="rtl"><div className="onboarding-shell"><header className="onboarding-heading"><div><span className="auth-eyebrow">خطوة جديدة نحو تجربة أفضل</span><h1>أهلاً بك، أكمل حسابك</h1><p>{isStudent ? 'جهّز ملفك الأكاديمي لنجد لك الحالات السريرية المناسبة.' : 'أكمل معلوماتك لنساعدك في الوصول إلى طالب طب الأسنان المناسب.'}</p></div><div className="onboarding-role"><UserRound size={19} /> {isStudent ? 'طالب طب أسنان' : 'مريض'}</div></header><div className="onboarding-progress"><div className="progress-track"><span style={{ width: `${(step / (steps.length - 1)) * 100}%` }} /></div><div className="step-list">{steps.map((label, index) => <div className={`step-item ${index === step ? 'is-current' : ''} ${index < step ? 'is-done' : ''}`} key={label}><span>{index < step ? <Check size={16} /> : index + 1}</span><small>{label}</small></div>)}</div></div><section className="onboarding-card"><div className="onboarding-card-header"><div><span>الخطوة {step + 1} من {steps.length}</span><h2>{steps[step]}</h2></div><strong>{Math.round((step / (steps.length - 1)) * 100)}%</strong></div>{step === 0 && <div className="onboarding-grid">{field('الاسم الكامل', 'full_name')}{field('رقم الهاتف', 'phone', 'tel')}{field('واتساب', 'whatsapp', 'tel', false)}{!isStudent && <><label className="onboarding-field"><span>الجنس</span><select required value={values.gender} onChange={(event) => set('gender', event.target.value)}><option value="">اختر الجنس</option>{genderOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{field('تاريخ الميلاد', 'birth_date', 'date')}</>}<label className="onboarding-field"><span>المحافظة</span><select required value={values.province_id} onChange={(event) => { set('province_id', event.target.value); set('area_id', ''); }}><option value="">اختر المحافظة</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></label><label className="onboarding-field"><span>المنطقة</span><select required value={values.area_id} onChange={(event) => set('area_id', event.target.value)}><option value="">اختر المنطقة</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></label></div>}{isStudent && step === 1 && <div className="academic-panel"><p>الجامعة الأساسية هي الجامعة التي تدرس فيها حاليًا.</p><div className="university-card-grid">{universities.map((item) => <button type="button" key={item.id} onClick={() => set('university_id', item.id)} className={`university-select-card ${values.university_id === item.id ? 'is-selected' : ''}`}><span className="university-card-icon"><University size={22} /></span><span><b>{item.name_ar}</b><small>الجامعة الأساسية</small></span>{values.university_id === item.id && <CheckCircle2 size={20} />}</button>)}</div><label className="onboarding-field single-field"><span>المرحلة</span><select required value={values.stage} onChange={(event) => set('stage', event.target.value)}><option value="">اختر المرحلة</option>{stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>}{step === universityStep && <div className="university-step"><div className="university-step-copy"><div><span>اختياراتك</span><h3>اختر الجامعات المناسبة لك</h3><p>اختر الجامعات القريبة أو التي يمكنك المراجعة فيها، بحد أقصى 4 جامعات.</p></div><strong>{selectedIds.length} / {MAX_UNIVERSITIES}<small>جامعات مختارة</small></strong></div><div className="university-card-grid">{universities.map((item) => <button type="button" key={item.id} onClick={() => toggleUniversity(item.id)} className={`university-select-card ${selectedIds.includes(item.id) ? 'is-selected' : ''}`}><span className="university-card-icon"><University size={22} /></span><span><b>{item.name_ar}</b><small><MapPin size={13} /> {provinces.find((province) => province.id === item.province_id)?.name_ar || 'المحافظة'}</small></span>{selectedIds.includes(item.id) && <CheckCircle2 size={20} />}</button>)}</div></div>}{step === steps.length - 1 && <div className="review-grid"><div className="review-section"><h3><UserRound size={18} /> معلوماتك</h3><p><b>الاسم</b>{values.full_name || '—'}</p><p><b>الهاتف</b>{values.phone || '—'}</p><p><b>الموقع</b>{provinceName} / {areaName}</p>{!isStudent && <p><b>الجنس</b>{genderOptions.find((item) => item.value === values.gender)?.label || '—'} — {values.birth_date || '—'}</p>}{isStudent && <><p><b>الجامعة الأساسية</b>{universityName(values.university_id)}</p><p><b>المرحلة</b>{stages.find((item) => item.value === values.stage)?.label || '—'}</p></>}</div><div className="review-section"><h3><University size={18} /> الجامعات المختارة</h3>{selectedUniversities.length ? selectedUniversities.map((item) => <p className="review-university" key={item.id}><Check size={15} />{item.name_ar}</p>) : <p>لم تختر جامعات بعد.</p>}</div></div>}{error && <p className="onboarding-error">{error}</p>}<footer className="onboarding-actions"><button type="button" className="wizard-back" onClick={back}><ArrowRight size={18} /> السابق</button>{step < steps.length - 1 ? <button type="button" className="auth-primary-button" onClick={next}>التالي <ArrowLeft size={18} /></button> : <button type="button" className="auth-primary-button" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} إنشاء الحساب</button>}</footer></section></div></main>;
};
