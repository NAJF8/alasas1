import type { ReactNode } from 'react';

export type AuthMethod = 'phone' | 'email' | 'google';

type AuthMethodSelectorProps = {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
  methods: Array<{ id: AuthMethod; label: string; icon?: ReactNode }>;
};

export const AuthMethodSelector = ({ value, onChange, methods }: AuthMethodSelectorProps) => (
  <div className="aa-auth-methods" role="tablist" aria-label="طريقة تسجيل الدخول">
    {methods.map((method) => (
      <button
        key={method.id}
        type="button"
        role="tab"
        aria-selected={value === method.id}
        className={value === method.id ? 'is-active' : ''}
        onClick={() => onChange(method.id)}
      >
        {method.icon}
        <span>{method.label}</span>
      </button>
    ))}
  </div>
);
