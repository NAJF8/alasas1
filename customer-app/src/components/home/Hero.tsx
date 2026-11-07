import { ArrowLeft, ShieldCheck } from 'lucide-react';
import heroImage from '../../assets/dental-hero.webp';
import { useBranding } from '../../context/BrandingContext';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { useT } from '../../lib/i18n';

export const Hero = ({ accountAction }: { accountAction: React.ReactNode }) => {
  const branding = useBranding();
  const { t, lang } = useT();
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <div className="hero-kicker">
          <span className="live-dot" /> {t('منصة آمنة للتعاون مع الجامعات')}
        </div>
        <h1>
          {(lang === 'ar' && branding.hero_title_ar) || t('رعاية أسنان أفضل')}
          <br />
          <em>{(lang === 'ar' && branding.hero_subtitle_ar) || t('بالتعاون مع جامعات العراق')}</em>
        </h1>
        <p>
          {(lang === 'ar' && branding.site_description) ||
            t('نربط المرضى بطلاب طب الأسنان في الجامعات القريبة بطريقة منظمة وآمنة. ارفع حالتك أو اطلب الحالة التي تحتاجها، والإدارة تتولى المطابقة والتنسيق.')}
        </p>
        <div className="hero-actions">{accountAction}</div>
        <div className="hero-note hero-note-desktop">
          <ShieldCheck size={17} /> {t('لا نعرض رقم هاتفك أو بيانات التواصل لأي طرف آخر')}
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <ImageWithFallback
          src={branding.hero_image_url || heroImage}
          fallbackSrc={heroImage}
          alt={t('واجهة منصة الأساس لطب الأسنان')}
        />
        <div className="hero-float-card">
          <div className="float-check">
            <ShieldCheck size={18} />
          </div>
          <span>
            <b>{t('مطابقة مناسبة')}</b>
            <small>{t('جامعة قريبة منك')}</small>
          </span>
          <strong>{t('مطابقة موثوقة')}</strong>
        </div>
        <div className="hero-float-chip">
          <span /> {t('جامعات قريبة منك')}
        </div>
      </div>
      <div className="hero-note hero-note-mobile">
        <ShieldCheck size={16} /> {t('لا نعرض رقم هاتفك أو بيانات التواصل لأي طرف آخر')}
      </div>
      <div className="hero-scroll">
        <span>{t('اكتشف المنصة')}</span>
        <ArrowLeft size={17} />
      </div>
    </section>
  );
};
