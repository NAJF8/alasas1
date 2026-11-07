import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  CircleHelp,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Sparkles,
  University,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header';
import { Hero } from '../components/home/Hero';
import { isProfileComplete, useAuth } from '../context/AuthContext';
import { getActiveClinicalCategories, getActiveUniversities, type ClinicalCategoryOption } from '../lib/referenceData';
import { useT } from '../lib/i18n';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { getCategoryImage, getCategoryPlaceholder, getUniversityImage, getUniversityPlaceholder } from '../lib/cardPlaceholders';

const steps = [
  { number: '01', icon: UsersRound, title: 'أنشئ حسابك', body: 'اختر حساب مريض أو طالب طب أسنان وأكمل بياناتك الأساسية.' },
  { number: '02', icon: HeartHandshake, title: 'أرسل طلبك', body: 'ارفع الحالة أو حدّد المواصفات السريرية التي تبحث عنها.' },
  { number: '03', icon: Sparkles, title: 'مطابقة مناسبة', body: 'تساعد الإدارة في ترشيح أفضل تطابق حسب الجامعة والموقع والتوفر.' },
  { number: '04', icon: CalendarDays, title: 'موعد منسّق', body: 'تواصل آمن عبر المنصة وتنسيق الموعد دون كشف بياناتك الشخصية.' },
];

const currentYear = new Date().getFullYear();

type UniversityCard = {
  id: string;
  name_ar: string;
  name_en?: string | null;
  image_url?: string | null;
};

const defaultUniversities: UniversityCard[] = [
  { id: 'u-kufa', name_ar: 'جامعة الكوفة', name_en: 'University of Kufa', image_url: '/images/universities/kufa.svg' },
  { id: 'u-kafeel', name_ar: 'جامعة الكفيل', name_en: 'Al-Kafeel University', image_url: '/images/universities/kafeel.svg' },
];

const defaultCategories: ClinicalCategoryOption[] = [
  { id: 'c-class1', name_ar: 'Class I', image_url: '/images/categories/class-1.svg' },
  { id: 'c-class2', name_ar: 'Class II', image_url: '/images/categories/class-2.svg' },
  { id: 'c-class3', name_ar: 'Class III', image_url: '/images/categories/class-3.svg' },
  { id: 'c-class4', name_ar: 'Class IV', image_url: '/images/categories/class-4.svg' },
  { id: 'c-endo', name_ar: 'علاج الجذور', image_url: '/images/categories/endo.svg' },
  { id: 'c-filling', name_ar: 'حشوات الأسنان', image_url: '/images/categories/filling.svg' },
  { id: 'c-scaling', name_ar: 'تنظيف الأسنان', image_url: '/images/categories/scaling.svg' },
  { id: 'c-pediatric', name_ar: 'أسنان الأطفال', image_url: '/images/categories/pediatric.svg' },
];

export const Home = () => {
  const { t, dir, lang } = useT();
  const { user, profile, loading } = useAuth();
  const [universities, setUniversities] = useState<UniversityCard[]>(defaultUniversities);
  const [categories, setCategories] = useState<ClinicalCategoryOption[]>(defaultCategories);

  useEffect(() => {
    let active = true;
    void Promise.all([getActiveUniversities(), getActiveClinicalCategories()]).then(([universityRows, categoryRows]) => {
      if (!active) return;
      if (universityRows && universityRows.length > 0) {
        setUniversities(universityRows.slice(0, 8));
      }
      if (categoryRows && categoryRows.length > 0) {
        setCategories(categoryRows);
      }
    });
    return () => { active = false; };
  }, []);

  const accountName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || t('مستخدم');
  const accountAction = !user ? (
    <>
      <Link className="primary-button hero-primary" to="/register?role=PATIENT&start=1">
        {t('ابدأ كمريض')} <UserRound size={18} />
      </Link>
      <Link className="secondary-button" to="/register?role=STUDENT&start=1">
        {t('ابدأ كطالب')} <GraduationCap size={18} />
      </Link>
      <Link className="text-link" to="/login">{t('تسجيل الدخول')}</Link>
    </>
  ) : loading ? (
    <span className="hero-note">{t('جاري التحقق من الحساب...')}</span>
  ) : (
    <>
      <span className="hero-note">{t('أهلاً،')} {accountName}</span>
      <Link className="primary-button hero-primary" to={isProfileComplete(profile) ? '/dashboard' : '/profile'}>
        {isProfileComplete(profile) ? t('الذهاب إلى حسابي') : t('تعديل الملف الشخصي')} <ArrowLeft size={18} />
      </Link>
    </>
  );

  return (
    <div className="customer-shell" dir={dir}>
      <Header />
      <main>
        <Hero accountAction={accountAction} />

        <section className="trust-strip">
          <div>
            <ShieldCheck size={22} />
            <span>
              <b>{t('خصوصيتك أولاً')}</b>
              <small>{t('بيانات التواصل للإدارة فقط')}</small>
            </span>
          </div>
          <div>
            <University size={22} />
            <span>
              <b>{t('جامعات قريبة')}</b>
              <small>{t('اختيار يصل إلى 4 جامعات')}</small>
            </span>
          </div>
          <div>
            <Sparkles size={22} />
            <span>
              <b>{t('مطابقة أذكى')}</b>
              <small>{t('عوامل سريرية ومكانية واضحة')}</small>
            </span>
          </div>
        </section>

        <section className="section how-section" id="how-it-works">
          <div className="section-heading">
            <span>{t('بخطوات واضحة')}</span>
            <h2>{t('كيف تعمل المنصة؟')}</h2>
            <p>{t('من تسجيل الحساب إلى الموعد، كل مرحلة مصممة لتكون بسيطة وآمنة.')}</p>
          </div>
          <div className="steps-grid">
            {steps.map(({ number, icon: Icon, title, body }) => (
              <article className="step-card" key={number}>
                <div className="step-icon"><Icon size={23} /></div>
                <span className="step-number">{number}</span>
                <h3>{t(title)}</h3>
                <p>{t(body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section audience-section" id="patients">
          <div className="section-heading">
            <span>{t('اختر طريقك')}</span>
            <h2>{t('منصة واحدة، احتياجان واضحان')}</h2>
            <p>{t('لا توجد حسابات وسيطة للعميل. اختر الدور الذي يناسبك وابدأ.')}</p>
          </div>
          <div className="audience-grid">
            <article className="audience-card audience-patient">
              <div className="audience-mark">{t('م')}</div>
              <div>
                <h3>{t('أنا مريض')}</h3>
                <p>{t('أرغب في عرض حالة أسنان والعثور على طالب مناسب في جامعة قريبة.')}</p>
                <Link to="/register?role=PATIENT">{t('ابدأ كمريض')} <ArrowLeft size={17} /></Link>
              </div>
            </article>
            <article className="audience-card audience-student">
              <div className="audience-mark">{t('ط')}</div>
              <div>
                <h3>{t('أنا طالب طب أسنان')}</h3>
                <p>{t('أبحث عن حالات سريرية مناسبة لمتطلبات التدريب في جامعتي.')}</p>
                <Link to="/register?role=STUDENT">{t('ابدأ كطالب')} <ArrowLeft size={17} /></Link>
              </div>
            </article>
          </div>
        </section>

        <section className="section privacy-section">
          <div className="privacy-panel">
            <div className="privacy-icon"><LockKeyhole size={26} /></div>
            <div>
              <span>{t('أمان وخصوصية')}</span>
              <h2>{t('بياناتك لا تُعرض للطرف الآخر')}</h2>
              <p>{t('نخفي الاسم ورقم الهاتف وواتساب والبريد عن العملاء. الإدارة وحدها تنسّق التواصل عند وجود تطابق مناسب.')}</p>
            </div>
            <Link className="outline-button" to="/faq">{t('اعرف المزيد')} <ChevronLeft size={17} /></Link>
          </div>
        </section>

        <section className="section universities-section" id="universities">
          <div className="section-heading section-heading-row">
            <div>
              <span>{t('شركاؤنا القريبون')}</span>
              <h2>{t('جامعات طب الأسنان')}</h2>
              <p>{t('اختر الجامعات الأنسب لك أثناء إنشاء ملفك أو حالتك.')}</p>
            </div>
            <Link className="text-link" to="/login">{t('عرض الجامعات')} <ArrowLeft size={17} /></Link>
          </div>

          <div className="university-row">
            {universities.map((item) => (
              <div className="university-tile" key={item.id}>
                <div className="university-photo">
                  <ImageWithFallback
                    src={getUniversityImage(item)}
                    fallbackSrc={getUniversityPlaceholder(item)}
                    alt={t(item.name_ar)}
                    className="card-media"
                  />
                </div>
                <b>{lang === 'en' && 'name_en' in item && item.name_en ? item.name_en : t(item.name_ar)}</b>
                <small>{t('كلية طب الأسنان')}</small>
                <div className="tile-location">
                  <MapPin size={14} /> {t('النجف / العراق')}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section categories-section" id="categories">
          <div className="section-heading">
            <span>{t('مجالات التدريب')}</span>
            <h2>{t('التصنيفات السريرية')}</h2>
            <p>{t('تعرف على المجالات المتاحة قبل بدء التسجيل.')}</p>
          </div>

          <div className="category-row">
            {categories.map((item) => (
              <div className="category-tile" key={item.id}>
                <div className="category-photo">
                  <ImageWithFallback
                    src={getCategoryImage(item)}
                    fallbackSrc={getCategoryPlaceholder(item)}
                    alt={t(item.name_ar)}
                    className="card-media"
                  />
                </div>
                <b>{t(item.name_ar)}</b>
                <small>{t('تدريب سريري معتمد')}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="section faq-section" id="faq">
          <div className="section-heading">
            <span>{t('أسئلة شائعة')}</span>
            <h2>{t('قبل أن تبدأ')}</h2>
          </div>
          <div className="faq-grid">
            <details open>
              <summary>
                <CircleHelp size={18} /> {t('هل يمكنني اختيار أكثر من جامعة؟')} <ChevronLeft size={18} />
              </summary>
              <p>{t('نعم، يمكنك اختيار جامعة واحدة إلى أربع جامعات مناسبة لك، ويمكن تعديلها عند إضافة الحالة.')}</p>
            </details>
            <details>
              <summary>
                <CircleHelp size={18} /> {t('هل تظهر بياناتي للطلاب؟')} <ChevronLeft size={18} />
              </summary>
              <p>{t('لا. تظهر حالة مجهّلة فقط، وتبقى بيانات التواصل لدى إدارة المنصة.')}</p>
            </details>
            <details>
              <summary>
                <CircleHelp size={17} /> {t('هل التسجيل مجاني؟')} <ChevronLeft size={17} />
              </summary>
              <p>{t('إنشاء الحساب وإرسال الحالة متاحان من خلال المنصة، وأي تنسيق يتم عبر الإدارة.')}</p>
            </details>
          </div>
        </section>
      </main>

      <footer className="customer-footer">
        <div>
          <div className="brand-lockup">
            <div className="brand-tooth">✦</div>
            <span>{t('أسنان الأساس')}<small>{t('منصة تربط المرضى بطلاب طب الأسنان')}</small></span>
          </div>
          <p>{t('رعاية أسنان أفضل بالتعاون مع جامعات العراق.')}</p>
        </div>
        <div className="footer-links">
          <Link to="/how-it-works">{t('كيف تعمل المنصة')}</Link>
          <Link to="/patients">{t('للمرضى')}</Link>
          <Link to="/students">{t('للطلاب')}</Link>
          <Link to="/faq">{t('الأسئلة الشائعة')}</Link>
        </div>
        <small>© {currentYear} {t('جميع الحقوق محفوظة لشركة الأساس للحلول البرمجية')}</small>
        <small dir="ltr">Version 1.5.0</small>
      </footer>
    </div>
  );
};
