import 'firebase/auth';
declare module 'firebase/auth' {
  interface User {
    id: string;
    user_metadata?: { full_name?: string; name?: string };
    app_metadata?: { provider?: string; providers?: string[] };
    identities?: Array<{ provider: string }>;
    created_at?: string;
    last_sign_in_at?: string;
  }
}
