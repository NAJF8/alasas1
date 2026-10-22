import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AuthSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; children: ReactNode };

export const AuthSubmitButton = ({ busy = false, children, disabled, ...props }: AuthSubmitButtonProps) => (
  <button {...props} className={`aa-auth-submit ${props.className || ''}`} disabled={busy || disabled}>
    {busy ? <><Loader2 className="aa-auth-spinner" size={19} aria-hidden="true" /><span>جارٍ التحقق…</span></> : children}
  </button>
);
