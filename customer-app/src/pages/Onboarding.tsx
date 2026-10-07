import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isProfileComplete, useAuth, type CustomerRole } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Option = { id: string; name_ar: string };

export const Onboarding = () => {
  const { user, profile, loading, saveOnboarding } = useAuth();
  const [role, setRole] = useState<CustomerRole>('PATIENT');
  const [values, setValues] = useState({ full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || '', phone: '', whatsapp: '', gender: '', birth_date: '', province_id: '', area_id: '', university_id: '', stage: '', workplace: '' });
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setRole(profile.role === 'STUDENT' ? 'STUDENT' : 'PATIENT');
      setValues((current) => ({ ...current, full_name: profile.full_name || user?.user_metadata?.full_name || '', phone: profile.phone || '', whatsapp: profile.whatsapp || '', gender: profile.gender || '', birth_date: profile.birth_date || '', province_id: profile.province_id || '', area_id: profile.area_id || '', university_id: profile.university_id || '', stage: profile.stage || '', workplace: profile.workplace || '' }));
    }
  }, [profile, user]);

  useEffect(() => { void supabase.from('provinces').select('id, name_ar').eq('is_active', true).order('name_ar').then(({ data }) => setProvinces((data || []) as Option[])); }, []);
  useEffect(() => { if (!values.province_id) return setAreas([]); void supabase.from('areas').select('id, name_ar').eq('province_id', values.province_id).eq('is_active', true).order('name_ar').then(({ data }) => setAreas((data || []) as Option[])); }, [values.province_id]);
  useEffect(() => { if (role !== 'STUDENT') return setUniversities([]); void supabase.from('universities').select('id, name_ar').eq('is_active', true).eq('has_dental_college', true).order('name_ar').then(({ data }) => setUniversities((data || []) as Option[])); }, [role]);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (isProfileComplete(profile)) return <Navigate to="/dashboard" replace />;

  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    const payload: Record<string, string | null> = { role, full_name: values.full_name, phone: values.phone, whatsapp: values.whatsapp || null, province_id: values.province_id, area_id: values.area_id || null, gender: role === 'PATIENT' ? values.gender || null : null, birth_date: role === 'PATIENT' ? values.birth_date || null : null, university_id: role === 'STUDENT' ? values.university_id || null : null, stage: role === 'STUDENT' ? values.stage || null : null };
    const result = await saveOnboarding({ ...payload, role } as never); if (result) setError(result); setSaving(false);
  };

  const field = (label: string, key: keyof typeof values, type = 'text', required = true) => <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><input required={required} type={type} value={values[key]} onChange={(event) => set(key, event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500" /></label>;
  return <main className="min-h-screen bg-slate-50 px-4 py-10" dir="rtl"><form onSubmit={submit} className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-xl sm:p-10"><h1 className="text-3xl font-black text-slate-900">أهلاً بك، أكمل معلومات حسابك</h1><p className="mt-2 text-slate-500">تُستخدم هذه المعلومات لتجهيز ملفك فقط، ولا يمكن اختيار صلاحيات الإدارة.</p>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">{field('الاسم الكامل', 'full_name')}{field('رقم الهاتف', 'phone', 'tel')}{field('واتساب', 'whatsapp', 'tel')}
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">نوع الحساب</span><select value={role} onChange={(event) => setRole(event.target.value as CustomerRole)} className="w-full rounded-xl border border-slate-200 px-4 py-3"><option value="PATIENT">مريض</option><option value="STUDENT">طالب طب أسنان</option></select></label>
      {role === 'PATIENT' && <>{field('الجنس', 'gender')}{field('تاريخ الميلاد', 'birth_date', 'date')}</>}
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">المحافظة</span><select required value={values.province_id} onChange={(event) => { set('province_id', event.target.value); set('area_id', ''); }} className="w-full rounded-xl border border-slate-200 px-4 py-3"><option value="">اختر المحافظة</option>{provinces.map((option) => <option key={option.id} value={option.id}>{option.name_ar}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">المنطقة</span><select required value={values.area_id} onChange={(event) => set('area_id', event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"><option value="">اختر المنطقة</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name_ar}</option>)}</select></label>
      {role === 'STUDENT' && <>{field('المرحلة', 'stage')}{<label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">الجامعة</span><select required value={values.university_id} onChange={(event) => set('university_id', event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"><option value="">اختر الجامعة</option>{universities.map((option) => <option key={option.id} value={option.id}>{option.name_ar}</option>)}</select></label>}</>}
    </div>{error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">تعذر حفظ المعلومات: {error}</p>}<button disabled={saving} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 font-bold text-white hover:bg-primary-700 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}حفظ ومتابعة</button>
  </form></main>;
};
