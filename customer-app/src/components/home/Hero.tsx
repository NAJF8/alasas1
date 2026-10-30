import { ArrowLeft, ShieldCheck } from 'lucide-react';
import heroImage from '../../assets/dental-hero.webp';
import { useBranding } from '../../context/BrandingContext';
import { ImageWithFallback } from '../common/ImageWithFallback';

export const Hero = ({ accountAction }: { accountAction: React.ReactNode }) => {
  const branding = useBranding();
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <div className="hero-kicker">
          <span className="live-dot" /> منصة آمنة بالتعاون مع الجامعات
        </div>
        <h1>
          {branding.hero_title_ar || 'رعاية أسنان أفضل'}
          <br />
          <em>{branding.hero_subtitle_ar || 'بالتعاون مع جامعات العراق'}</em>
        </h1>
        <p>
          {branding.site_description ||
            'نربط المرضى بطلاب طب الأسنان في الجامعات القريبة بطريقة منظمة وآمنة. ارفع حالتك أو اطلب الحالة التي تحتاجها، والإدارة تتولى المطابقة والتنسيق.'}
        </p>
        <div className="hero-actions">{accountAction}</div>
        <div className="hero-note">
          <ShieldCheck size={17} /> لا نعرض رقم هاتفك أو بيانات التواصل لأي طرف آخر
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <ImageWithFallback
          src={branding.hero_image_url || heroImage}
          fallbackSrc={heroImage}
          alt="واجهة منصة الأساس لطب الأسنان"
        />
        <div className="hero-float-card">
          <div className="float-check">
            <ShieldCheck size={18} />
          </div>
          <span>
            <b>مطابقة مناسبة</b>
            <small>جامعة قريبة منك</small>
          </span>
          <strong>مطابقة موثقة</strong>
        </div>
        <div className="hero-float-chip">
          <span /> جامعات قريبة منك
        </div>
      </div>
      <div className="hero-scroll">
        <span>اكتشف المنصة</span>
        <ArrowLeft size={17} />
      </div>
    </section>
  );
};
