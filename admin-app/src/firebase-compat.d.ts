import 'firebase/auth';
declare module 'firebase/auth' { interface User { id: string; user_metadata?: { full_name?: string; name?: string }; } }
