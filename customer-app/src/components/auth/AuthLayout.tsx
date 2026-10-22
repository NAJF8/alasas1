import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AuthBrandHeader } from './AuthBrandHeader';

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  headerContent?: ReactNode;
  className?: string;
};

export const AuthLayout = ({ title, description, children, footer, headerContent, className = '' }: AuthLayoutProps) => (
  <main className={`aa-auth-page ${className}`} dir="rtl">
    <div className="aa-auth-frame">
      <aside className="aa-auth-brand-panel" aria-label="أسنان الأساس">
        <AuthBrandHeader title={title} description={description}>{headerContent}</AuthBrandHeader>
        <div className="aa-auth-brand-footnote">
          <span className="aa-auth-brand-rule" />
          <span>رعاية أوضح، قرار أسهل</span>
        </div>
      </aside>
      <section className="aa-auth-form-panel" aria-label={title}>
        <div className="aa-auth-form-content">
          <div className="aa-auth-mobile-brand">
            <img src="/brand/official-logo-white.png" alt="شعار أسنان الأساس" />
          </div>
          {children}
          {footer}
          <Link className="aa-auth-home-link" to="/">العودة إلى الصفحة الرئيسية</Link>
        </div>
      </section>
    </div>
  </main>
);
