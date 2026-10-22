import { AlertCircle } from 'lucide-react';

export const AuthErrorMessage = ({ message }: { message: string | null }) => message ? <div className="aa-auth-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{message}</span></div> : null;
