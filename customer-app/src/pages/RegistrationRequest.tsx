import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getActiveProvinces, getActiveUniversities, type ProvinceOption, type UniversityOption } from '../lib/referenceData';
import { normalizeIraqiPhone } from '../lib/phoneAuth';
import { isRegistrationRole, isStrongRegistrationPin, normalizeArabicDigits, readRegistrationRole, writeRegistrationRole, type RegistrationRole } from '../lib/registrationFlow';
import { supabase } from '../lib/supabase';

type AreaOption = { id: string; name_ar: string };
type Values = {
  phone: string;
  pin: string;
  confirmPin: string;
  fullName: string;
  gender: string;
  provinceId: string;
  areaId: string;
  birthDate: string;
  universityId: string;
  stage: string;
};

const initialValues: Values = { phone: '', pin: '', confirmPin: '', fullName: '', gender: '', provinceId: '', areaId: '', birthDate: '', universityId: '', stage: '' };
const stages = [{ value: 'THIRD', label: 'الثالثة' }, { value: 'FOURTH', label: 'الرابعة' }, { value: 'FIFTH', label: 'الخامسة' }];
const roleLabel = (role: RegistrationRole) => role === 'PATIENT' ? 'مريض' : 'طالب طب أسنان';

const RolePicker = ({ onSelect }: { onSelect: (role: RegistrationRole) => void }) => <main className="auth-page register-page" dir="rtl"><section className="register-shell registration-picker"><span className="auth-eyebrow">أسنان الأساس</span><h1>كيف ستستخدم المنصة؟</h1><p>اختر دورك مرة واحدة، وسنجهّز لك نموذج التسجيل المناسب فقط.</p><div className="register-cards"><button type="button" onClick={() => onSelect('PATIENT')} className="register-card register-card-blue"><span className="register-icon"><UserRound size={26} /></span><span className="register-card-copy"><strong>أنا مريض</strong><small>عرض حالة أسنان والعثور على طالب مناسب</small></span><span className="register-radio">→</span></button><button type="button" onClick={() => onSelect('STUDENT')} className="register-card register-card-teal"><span className="register-icon"><GraduationCap size={26} /></span><span className="register-card-copy"><strong>أنا طالب طب أسنان</strong><small>طلب حالات تدريبية مناسبة لجامعتك</small></span><span className="register-radio">→</span></button></div><p className="auth-switch"><Link to="/">العودة إلى الصفحة الرئيسية</Link></p></section></main>;

export const RegistrationRequest = () => {
  const [params, setParams] = useSearchParams();
  const requestedRoleParam = params.get('role');
  const requestedRole = isRegistrationRole(requestedRoleParam) ? requestedRoleParam : null;
  const [role, setRole] = useState<RegistrationRole | null>(() => requestedRole || readRegistrationRole());
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Values>(initialValues);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const normalizedPhone = useMemo(() => normalizeIraqiPhone(values.phone), [values.phone]);
  const isStudent = role === 'STUDENT';

  useEffect(() => {
    if (!requestedRole || requestedRole === role) return;
    writeRegistrationRole(requestedRole);
    setRole(requestedRole);
    setStep(1);
    setValues(initialValues);
    setError(null);
  }, [requestedRole, role]);

  useEffect(() => {
    if (!role) return;
    if (requestedRole && requestedRole !== role) return;
    writeRegistrationRole(role);
    if (params.get('role') !== role || params.get('start')) {
      const nextParams = new URLSearchParams(params);
      nextParams.set('role', role);
      nextParams.delete('start');
      setParams(nextParams, { replace: true });
    }
  }, [params, requestedRole, role, setParams]);

  useEffect(() => {
    let active = true;
    void Promise.all([getActiveProvinces(), getActiveUniversities()]).then(([provinceRows, universityRows]) => {
      if (!active) return;
      setProvinces(provinceRows);
      setUniversities(universityRows);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!values.provinceId) return;
    let active = true;
    void supabase.from('areas').select('id,name_ar').eq('province_id', values.provinceId).eq('is_active', true).order('name_ar').then(({ data, error: areaError }) => {
      if (areaError) console.error('Area list load failed:', areaError.message);
      if (active) setAreas((data || []) as AreaOption[]);
    });
    return () => { active = false; };
  }, [values.provinceId]);

  const set = <Key extends keyof Values>(key: Key, value: Values[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setProfileReady(false);
    setError(null);
  };

  const chooseRole = (nextRole: RegistrationRole) => {
    writeRegistrationRole(nextRole);
    setRole(nextRole);
    setParams({ role: nextRole }, { replace: true });
  };

  const validateCredentials = () => {
    if (!normalizedPhone) return 'أدخل رقماً عراقياً صحيحاً بصيغة 07XXXXXXXXX.';
    const pin = normalizeArabicDigits(values.pin);
    const confirmation = normalizeArabicDigits(values.confirmPin);
    if (!/^\d{6}$/.test(pin)) return 'يجب أن يكون الرمز السري مكوّناً من 6 أرقام.';
    if (!isStrongRegistrationPin(pin)) return 'اختر رمزاً من 6 أرقام يصعب تخمينه، وليس أرقاماً متكررة أو متسلسلة.';
    if (pin !== confirmation) return 'تأكيد الرمز السري غير مطابق.';
    return null;
  };

  const validateProfile = () => {
    if (!values.fullName.trim() || !values.gender || !values.provinceId) return 'أكمل الاسم والجنس والمحافظة.';
    if (isStudent && (!values.universityId || !values.stage)) return 'اختر الجامعة والمرحلة الدراسية.';
    if (!isStudent && (!values.areaId || !values.birthDate)) return 'أكمل المنطقة وتاريخ الميلاد للمريض.';
    return null;
  };

  const continueToProfile = (event: FormEvent) => {
    event.preventDefault();
    const message = validateCredentials();
    if (message) { setError(message); return; }
    setError(null);
    setStep(2);
  };

  const reviewProfile = (event: FormEvent) => {
    event.preventDefault();
    const message = validateProfile();
    if (message) { setError(message); return; }
    setError(null);
    setProfileReady(true);
  };

  if (!role) return <RolePicker onSelect={chooseRole} />;

  return <main className="auth-page register-page" dir="rtl"><section className="register-shell registration-flow-shell"><header className="registration-header"><div><span className="auth-eyebrow">أسنان الأساس</span><h1>إنشاء حساب جديد</h1><p>{isStudent ? 'أكمل بيانات الطالب المناسبة لك.' : 'أكمل بيانات المريض المناسبة لك.'}</p></div><div className="registration-role-badge"><ShieldCheck size={17} /> الدور المحدد: {roleLabel(role)}</div></header><div className="registration-progress" aria-label="مراحل التسجيل"><div className={`registration-progress-step ${step === 1 ? 'is-current' : 'is-done'}`}><span>{step === 1 ? '1' : <CheckCircle2 size={17} />}</span><small>الهاتف والرمز السري</small></div><div className={`registration-progress-line ${step === 2 ? 'is-done' : ''}`} /><div className={`registration-progress-step ${step === 2 ? 'is-current' : ''}`}><span>2</span><small>البيانات الشخصية</small></div></div>{step === 1 ? <form onSubmit={continueToProfile} className="registration-form"><div className="registration-step-heading"><span>الخطوة 1 من 2</span><h2>أنشئ بيانات الدخول</h2><p>لا توجد رسائل SMS أو رموز OTP. اختر رقماً سرياً خاصاً بك.</p></div><label className="auth-field"><span>رقم الهاتف العراقي</span><input required inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXXX" value={values.phone} onChange={(event) => set('phone', event.target.value)} /><small>{normalizedPhone ? `الصيغة المعتمدة: ${normalizedPhone}` : 'يُقبل 07XXXXXXXXX أو +9647XXXXXXXXX'}</small></label><div className="onboarding-grid"><label className="onboarding-field"><span>رمز سري من 6 أرقام</span><div className="registration-pin-field"><input required inputMode="numeric" autoComplete="new-password" maxLength={6} type={showPin ? 'text' : 'password'} value={values.pin} onChange={(event) => set('pin', normalizeArabicDigits(event.target.value).replace(/\D/g, '').slice(0, 6))} /><button type="button" aria-label={showPin ? 'إخفاء الرمز السري' : 'إظهار الرمز السري'} onClick={() => setShowPin((visible) => !visible)}>{showPin ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><label className="onboarding-field"><span>تأكيد الرمز السري</span><div className="registration-pin-field"><input required inputMode="numeric" autoComplete="new-password" maxLength={6} type={showConfirmPin ? 'text' : 'password'} value={values.confirmPin} onChange={(event) => set('confirmPin', normalizeArabicDigits(event.target.value).replace(/\D/g, '').slice(0, 6))} /><button type="button" aria-label={showConfirmPin ? 'إخفاء تأكيد الرمز السري' : 'إظهار تأكيد الرمز السري'} onClick={() => setShowConfirmPin((visible) => !visible)}>{showConfirmPin ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label></div><div className="registration-security-note"><ShieldCheck size={18} /><span>الرمز السري يبقى في هذه الخطوة فقط ولا يُحفظ في المتصفح.</span></div>{error && <p className="auth-error" role="alert"><AlertCircle size={18} /> {error}</p>}<button type="submit" className="auth-primary-button"><ShieldCheck size={19} /> إنشاء الحساب</button></form> : <form onSubmit={reviewProfile} className="registration-form"><div className="registration-step-heading"><span>الخطوة 2 من 2</span><h2>بيانات {isStudent ? 'الطالب' : 'المريض'}</h2><p>أجب عن بيانات الدور المحدد فقط. لن يُعاد طلب اختيار الدور.</p></div><div className="registration-phone-summary"><span>رقم الهاتف</span><strong>{normalizedPhone}</strong><button type="button" onClick={() => setStep(1)}>تعديل</button></div><div className="onboarding-grid"><label className="onboarding-field"><span>الاسم الكامل</span><input required autoComplete="name" value={values.fullName} onChange={(event) => set('fullName', event.target.value)} /></label><label className="onboarding-field"><span>الجنس</span><select required value={values.gender} onChange={(event) => set('gender', event.target.value)}><option value="">اختر الجنس</option><option value="MALE">ذكر</option><option value="FEMALE">أنثى</option></select></label><label className="onboarding-field"><span>المحافظة</span><select required value={values.provinceId} onChange={(event) => { set('provinceId', event.target.value); set('areaId', ''); }}><option value="">اختر المحافظة</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></label>{!isStudent && <><label className="onboarding-field"><span>المنطقة</span><select required value={values.areaId} onChange={(event) => set('areaId', event.target.value)}><option value="">اختر المنطقة</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></label><label className="onboarding-field"><span>تاريخ الميلاد</span><input required type="date" value={values.birthDate} onChange={(event) => set('birthDate', event.target.value)} /></label></>}{isStudent && <><label className="onboarding-field"><span>الجامعة</span><select required value={values.universityId} onChange={(event) => set('universityId', event.target.value)}><option value="">اختر الجامعة</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></label><label className="onboarding-field"><span>المرحلة الدراسية</span><select required value={values.stage} onChange={(event) => set('stage', event.target.value)}><option value="">اختر المرحلة</option>{stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></>}</div>{error && <p className="auth-error" role="alert"><AlertCircle size={18} /> {error}</p>}{profileReady && <div className="registration-unavailable" role="status"><AlertCircle size={20} /><div><strong>الحفظ غير متاح حالياً</strong><p>Backend التسجيل غير مفعّل على Production. لم تُرسل البيانات، ولم يُنشأ حساب أو جلسة.</p></div></div>}<div className="registration-actions"><button type="button" className="wizard-back" onClick={() => setStep(1)}><ArrowRight size={18} /> السابق</button>{!profileReady ? <button type="submit" className="auth-primary-button"><ArrowLeft size={18} /> مراجعة طلب التسجيل</button> : <button type="button" className="auth-primary-button" disabled title="Backend التسجيل غير مفعّل على Production"><ShieldCheck size={18} /> إرسال طلب التسجيل — غير متاح حالياً</button>}</div></form>}<div className="registration-footer-note"><ShieldCheck size={16} /><span>لن تظهر رسالة نجاح إلا بعد حفظ الطلب فعلياً وقراءة النتيجة من Backend.</span></div><p className="auth-switch"><Link to="/">العودة إلى الصفحة الرئيسية</Link><span> · </span><Link to="/login">تسجيل الدخول للحسابات الحالية</Link></p></section></main>;
};
