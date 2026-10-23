import { firebaseData as supabase } from './firebaseData';

export type UniversityOption = { id: string; name_ar: string; province_id?: string | null; image_url?: string | null };
export type ProvinceOption = { id: string; name_ar: string };

let universitiesPromise: Promise<UniversityOption[]> | null = null;
let provincesPromise: Promise<ProvinceOption[]> | null = null;

export const getActiveUniversities = () => {
  if (!universitiesPromise) universitiesPromise = Promise.resolve(supabase.from('universities').select('id,name_ar,province_id,image_url,is_active,has_dental_college').limit(200).then(({ data, error }) => {
    if (error) { console.error('University list load failed:', error.message); return []; }
    return (data || []).filter((row: any) => row.is_active && row.has_dental_college).sort((a: any, b: any) => String(a.name_ar).localeCompare(String(b.name_ar), 'ar')) as UniversityOption[];
  }));
  return universitiesPromise;
};

export const getActiveProvinces = () => {
  if (!provincesPromise) provincesPromise = Promise.resolve(supabase.from('provinces').select('id,name_ar,is_active').limit(200).then(({ data, error }) => {
    if (error) { console.error('Province list load failed:', error.message); return []; }
    return (data || []).filter((row: any) => row.is_active).sort((a: any, b: any) => String(a.name_ar).localeCompare(String(b.name_ar), 'ar')) as ProvinceOption[];
  }));
  return provincesPromise;
};
