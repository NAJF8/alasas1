import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const configurationError = !supabaseUrl || !supabaseKey
  ? 'إعدادات Supabase غير موجودة في نسخة النشر. أعد بناء الموقع مع VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY.'
  : null;

export const supabase = createClient(
  supabaseUrl || 'https://configuration-missing.invalid',
  supabaseKey || 'configuration-missing',
);

export const getOAuthRedirectUrl = () => {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(base, window.location.origin).toString();
};
