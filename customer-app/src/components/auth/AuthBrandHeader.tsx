import type { ReactNode } from 'react';

type AuthBrandHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export const AuthBrandHeader = ({ eyebrow = 'أسنان الأساس', title, description, children }: AuthBrandHeaderProps) => (
  <header className="aa-auth-header">
    <div className="aa-auth-logo-wrap">
      <img src="/brand/official-logo-white.png" alt="شعار أسنان الأساس" className="aa-auth-logo" />
    </div>
    <div className="aa-auth-heading">
      <span className="aa-auth-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {children}
  </header>
);
