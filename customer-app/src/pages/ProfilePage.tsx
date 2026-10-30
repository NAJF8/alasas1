import { AlertCircle, CheckCircle2, Loader2, Save, ShieldAlert, University, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { CustomerFooter } from '../components/layout/PreferencesBar';
import { useAuth } from '../context/AuthContext';
import { callBackend, firebaseData as supabase } from '../lib/firebaseData';
import { getActiveProvinces, getActiveUniversities } from '../lib/referenceData';

type Option = { id: string; name_ar: string; province_id?: string };
const stages = [
  { value: 'THIRD', label: 'المرحلة الثالثة' },
  { value: 'FOURTH', label: 'المرحلة الرابعة' },
  { value: 'FIFTH', label: 'المرحلة الخامسة' },
];
const genderOptions = [
  { value: 'MALE', label: 'ذكر' },
  { value: 'FEMALE', label: 'أنثى' },
];

export const ProfilePage = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const submitLock = useRef(false);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [preferredUniversityIds, setPreferredUniversityIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    full_name: '',
    whatsapp: '',
    gender: '',
    birth_date: '',
    province_id: '',
    area_id: '',
    university_id: '',
    stage: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || '',
      whatsapp: profile.whatsapp || profile.phone || '',
      gender: profile.gender || '',
      birth_date: profile.birth_date || '',
      province_id: profile.province_id || '',
      area_id: profile.area_id || '',
      university_id: profile.university_id || '',
      stage: profile.stage || '',
    });
    if (profile.preferred_university_ids?.length) {
      setPreferredUniversityIds(profile.preferred_university_ids);
    }
  }, [profile]);

  useEffect(() => {
    void Promise.all([getActiveProvinces(), getActiveUniversities()]).then(([pRows, uRows]) => {
      setProvinces(pRows as Option[]);
      setUniversities(uRows as Option[]);
    });
  }, []);

  useEffect(() => {
    if (!form.province_id) {
      setAreas([]);
      return;
    }
    void supabase
      .from('areas')
      .select('id, name_ar, province_id, is_active')
      .limit(500)
      .then(({ data }) => {
        setAreas(
          ((data || []) as any[])
            .filter((row) => row.province_id === form.province_id && row.is_active)
            .sort((a, b) => String(a.name_ar).localeCompare(String(b.name_ar), 'ar')) as Option[],
        );
      });
  }, [form.province_id]);

  if (loading) {
    return (
      <div className="customer-loading" dir="rtl">
        <Loader2 className="animate-spin" size={26} /> جارٍ تحميل الملف الشخصي…
      </div>
    );
  }
  if (!user || !profile) return <Navigate to="/login" replace />;

  const isCustomer = profile.role === 'PATIENT' || profile.role === 'STUDENT';
  if (!isCustomer) {
    return (
      <div className="customer-app-page min-h-screen bg-slate-50" dir="rtl">
        <Header />
        <main className="customer-app-main mx-auto max-w-xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center border border-slate-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <ShieldAlert size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">حساب إداري محمي</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              هذا الحساب يملك صلاحيات إدارية ({profile.role === 'SUPER_ADMIN' ? 'مدير عام Super Admin' : profile.role === 'ADMIN' ? 'مدير نظام Admin' : 'فريق عمل Staff'}).
              <br />
              إدارة الحسابات وتعديل البيانات الإدارية تتم حصراً عبر لوحة الإدارة، ولا يمكن تعديلها من واجهة المرضى والطلاب لحماية الأمان المؤسسي.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/admin/"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-bold text-white hover:bg-slate-800 transition-colors"
              >
                الانتقال إلى لوحة الإدارة
              </a>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                الصفحة الرئيسية
              </Link>
            </div>
          </div>
        </main>
        <CustomerFooter />
      </div>
    );
  }

  const isStudent = profile.role === 'STUDENT';

  const toggleUniversity = (uniId: string) => {
    setPreferredUniversityIds((current) =>
      current.includes(uniId)
        ? current.filter((item) => item !== uniId)
        : current.length < 4
          ? [...current, uniId]
          : current,
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLock.current) return;
    setError(null);
    setSuccess(null);
    if (form.full_name.trim().length < 2) {
      setError('أدخل الاسم الكامل بشكل صحيح.');
      return;
    }
    if (!form.province_id) {
      setError('اختر المحافظة.');
      return;
    }
    if ((profile.role === 'STUDENT' || profile.role === 'PATIENT') && (preferredUniversityIds.length < 1 || preferredUniversityIds.length > 4)) {
      setError('اختر جامعة واحدة على الأقل وبحد أقصى 4 جامعات.');
      return;
    }
    if (isStudent && (!form.university_id || !form.stage)) {
      setError('اختر الجامعة الأساسية والمرحلة الدراسية.');
      return;
    }
    submitLock.current = true;
    setSaving(true);
    try {
      await callBackend('/api/profile-update', {
        full_name: form.full_name.trim(),
        whatsapp: form.whatsapp.trim() || null,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        province_id: form.province_id,
        area_id: form.area_id || null,
        university_id: isStudent ? form.university_id : preferredUniversityIds[0] || null,
        stage: isStudent ? form.stage : null,
        preferred_university_ids: preferredUniversityIds,
      });
      const updated = await refreshProfile();
      if (!updated || updated.full_name !== form.full_name.trim()) {
        setError('تم إرسال التعديل لكن تعذر التحقق من قراءة البيانات المحدثة.');
      } else {
        setSuccess('تم حفظ تعديلات الملف الشخصي والتحقق منها على الخادم بنجاح.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ تعديلات الملف الشخصي.');
    } finally {
      setSaving(false);
      submitLock.current = false;
    }
  };

  return (
    <div className="customer-app-page min-h-screen bg-slate-50" dir="rtl">
      <Header />
      <main className="customer-app-main mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="customer-page-heading flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="customer-kicker">إعدادات الحساب</span>
            <h1 className="mt-1 text-3xl font-black text-slate-900">تعديل الملف الشخصي</h1>
            <p className="mt-2 text-sm text-slate-500">تحديث بياناتك الشخصية والجامعات المعتمدة مع التحقق الفوري من الخادم.</p>
          </div>
          <div className="customer-page-actions">
            <Link to="/dashboard" className="customer-secondary-action rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">
              العودة إلى لوحتي
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-slate-800">
              <UserRound size={20} className="text-teal-600" />
              <h2 className="text-lg font-black">البيانات الأساسية</h2>
            </div>
            <span className="customer-status">
              {profile.role === 'STUDENT' ? 'طالب طب أسنان' : 'مريض'} · {profile.status === 'VERIFIED' ? 'موثق' : 'بانتظار الاعتماد'}
            </span>
          </div>

          {error && (
            <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div role="status" className="mb-5 flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">الاسم الكامل</span>
              <input
                required
                aria-label="الاسم الكامل"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">رقم الهاتف المسجل</span>
              <input
                disabled
                value={profile.phone || ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-500"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">رقم واتساب</span>
              <input
                aria-label="رقم واتساب"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="07XXXXXXXXX"
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">الجنس</span>
              <select
                aria-label="الجنس"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              >
                <option value="">اختر الجنس</option>
                {genderOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">تاريخ الميلاد</span>
              <input
                type="date"
                aria-label="تاريخ الميلاد"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">المحافظة</span>
              <select
                required
                aria-label="المحافظة"
                value={form.province_id}
                onChange={(e) => setForm({ ...form, province_id: e.target.value, area_id: '' })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              >
                <option value="">اختر المحافظة</option>
                {provinces.map((item) => (
                  <option key={item.id} value={item.id}>{item.name_ar}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">المنطقة</span>
              <select
                aria-label="المنطقة"
                value={form.area_id}
                onChange={(e) => setForm({ ...form, area_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              >
                <option value="">اختر المنطقة</option>
                {areas.map((item) => (
                  <option key={item.id} value={item.id}>{item.name_ar}</option>
                ))}
              </select>
            </label>

            {isStudent && (
              <>
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-700">الجامعة الأساسية</span>
                  <select
                    required
                    aria-label="الجامعة الأساسية"
                    value={form.university_id}
                    onChange={(e) => setForm({ ...form, university_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <option value="">اختر الجامعة الأساسية</option>
                    {universities.map((item) => (
                      <option key={item.id} value={item.id}>{item.name_ar}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-700">المرحلة الدراسية</span>
                  <select
                    required
                    aria-label="المرحلة الدراسية"
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <option value="">اختر المرحلة</option>
                    {stages.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          <section className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <University size={19} className="text-teal-600" />
                <h3 className="font-bold text-slate-800">الجامعات المفضلة للمطابقة (من 1 إلى 4 جامعات)</h3>
              </div>
              <span className="text-xs font-bold text-teal-700">{preferredUniversityIds.length} / 4 جامعات محددة</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {universities.map((item) => {
                const selected = preferredUniversityIds.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleUniversity(item.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-right text-sm font-bold transition ${
                      selected ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.name_ar}</span>
                    {selected && <CheckCircle2 size={17} className="text-teal-600" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="customer-primary-action inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 font-bold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              حفظ التعديلات
            </button>
          </div>
        </form>
      </main>
      <CustomerFooter />
    </div>
  );
};
