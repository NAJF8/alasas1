import { supabase } from './supabase';

export type UniversityOption = { id: string; name_ar: string; province_id?: string | null };
export type ProvinceOption = { id: string; name_ar: string };

let universitiesPromise: Promise<UniversityOption[]> | null = null;
let provincesPromise: Promise<ProvinceOption[]> | null = null;

export const getActiveUniversities = () => {
  if (!universitiesPromise) universitiesPromise = Promise.resolve(supabase.from('universities').select('id,name_ar,province_id').eq('is_active', true).eq('has_dental_college', true).order('name_ar').limit(100).then(({ data, error }) => {
    if (error) { console.error('University list load failed:', error.message); return []; }
    return (data || []) as UniversityOption[];
  }));
  return universitiesPromise;
};

export const getActiveProvinces = () => {
  if (!provincesPromise) provincesPromise = Promise.resolve(supabase.from('provinces').select('id,name_ar').eq('is_active', true).order('name_ar').limit(100).then(({ data, error }) => {
    if (error) { console.error('Province list load failed:', error.message); return []; }
    return (data || []) as ProvinceOption[];
  }));
  return provincesPromise;
};
