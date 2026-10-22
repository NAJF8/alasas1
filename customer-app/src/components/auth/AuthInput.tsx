import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  passwordToggle?: boolean;
};

export const AuthInput = ({ label, hint, error, passwordToggle = false, id, type, ...props }: AuthInputProps) => {
  const [visible, setVisible] = useState(false);
  const inputId = id || `auth-${label.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <label className="aa-auth-input" htmlFor={inputId}>
      <span className="aa-auth-label">{label}</span>
      <span className={`aa-auth-input-wrap ${error ? 'has-error' : ''}`}>
        <input id={inputId} type={passwordToggle && visible ? 'text' : type} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
        {passwordToggle && <button type="button" className="aa-auth-visibility" aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </span>
      {hint && <small id={`${inputId}-hint`} className="aa-auth-hint">{hint}</small>}
      {error && <small id={`${inputId}-error`} className="aa-auth-field-error">{error}</small>}
    </label>
  );
};
