import { useCallback, useSyncExternalStore } from 'react';
import { enMore } from './i18nMore';
import { LANG_KEY, applyLangToDom, readStoredLang, type LangMode } from './theme';

// Shared language store: the language toggle and every translated component
// read the same value, so switching language re-renders the site immediately.
let current: LangMode = readStoredLang();
const listeners = new Set<() => void>();

export const getLang = () => current;

export const setLang = (next: LangMode) => {
  if (next === current) return;
  current = next;
  applyLangToDom(next);
  try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useLang = (): LangMode => useSyncExternalStore(subscribe, getLang, () => 'ar');

// Arabic text is the source/key. Missing entries fall back to the Arabic text.
export const en: Record<string, string> = {
  // header / nav
  'كيف تعمل المنصة': 'How it works',
  'للمرضى': 'For patients',
  'للطلاب': 'For students',
  'توثيق الطالب': 'Student verification',
  'الأسئلة الشائعة': 'FAQ',
  'القائمة الرئيسية': 'Main menu',
  'إغلاق القائمة': 'Close menu',
  'القائمة': 'Menu',
  'الملف الشخصي': 'My profile',
  'الإشعارات': 'Notifications',
  'المظهر واللغة': 'Appearance & language',
  'تسجيل الخروج': 'Log out',
  'تسجيل الدخول': 'Log in',
  'إنشاء حساب': 'Create account',
  'أهلاً،': 'Hello,',
  'مستخدم': 'User',
  'مريض': 'Patient',
  'طالب طب أسنان': 'Dental student',
  'إدارة': 'Admin',
  'تواصل معنا': 'Contact us',
  'شعار الأساس': 'AL ASAS logo',
  'أسنان الأساس': 'AL ASAS Dental',
  'الأساس لطب الأسنان': 'AL ASAS Dental',
  // hero
  'منصة آمنة للتعاون مع الجامعات': 'A secure platform for working with universities',
  'رعاية أسنان أفضل': 'Better dental care',
  'بالتعاون مع جامعات العراق': 'in partnership with Iraqi universities',
  'نربط المرضى بطلاب طب الأسنان في الجامعات القريبة بطريقة منظمة وآمنة. ارفع حالتك أو اطلب الحالة التي تحتاجها، والإدارة تتولى المطابقة والتنسيق.':
    'We connect patients with dental students at nearby universities in an organized and safe way. Submit your case or request the case you need, and our team handles matching and coordination.',
  'لا نعرض رقم هاتفك أو بيانات التواصل لأي طرف آخر': 'We never show your phone number or contact details to anyone else',
  'واجهة منصة الأساس لطب الأسنان': 'AL ASAS Dental platform',
  'مطابقة مناسبة': 'A suitable match',
  'جامعة قريبة منك': 'A university near you',
  'مطابقة موثوقة': 'Trusted matching',
  'جامعات قريبة منك': 'Universities near you',
  'اكتشف المنصة': 'Discover the platform',
  // home
  'ابدأ كمريض': 'Start as a patient',
  'ابدأ كطالب': 'Start as a student',
  'جاري التحقق من الحساب...': 'Checking your account...',
  'الذهاب إلى حسابي': 'Go to my account',
  'تعديل الملف الشخصي': 'Edit profile',
  'خصوصيتك أولاً': 'Your privacy first',
  'بيانات التواصل للإدارة فقط': 'Contact details are visible to admins only',
  'جامعات قريبة': 'Nearby universities',
  'اختيار يصل إلى 4 جامعات': 'Choose up to 4 universities',
  'مطابقة أذكى': 'Smarter matching',
  'عوامل سريرية ومكانية واضحة': 'Clear clinical and location factors',
  'بخطوات واضحة': 'In clear steps',
  'كيف تعمل المنصة؟': 'How does the platform work?',
  'من تسجيل الحساب إلى الموعد، كل مرحلة مصممة لتكون بسيطة وآمنة.': 'From signing up to your appointment, every stage is designed to be simple and safe.',
  'أنشئ حسابك': 'Create your account',
  'اختر حساب مريض أو طالب طب أسنان وأكمل بياناتك الأساسية.': 'Choose a patient or dental student account and complete your basic details.',
  'أرسل طلبك': 'Send your request',
  'ارفع الحالة أو حدّد المواصفات السريرية التي تبحث عنها.': 'Upload the case or specify the clinical requirements you are looking for.',
  'تساعد الإدارة في ترشيح أفضل تطابق حسب الجامعة والموقع والتوفر.': 'Our team helps nominate the best match by university, location and availability.',
  'موعد منسّق': 'A coordinated appointment',
  'تواصل آمن عبر المنصة وتنسيق الموعد دون كشف بياناتك الشخصية.': 'Safe communication through the platform and appointment coordination without revealing your personal details.',
  'اختر طريقك': 'Choose your path',
  'منصة واحدة، احتياجان واضحان': 'One platform, two clear needs',
  'لا توجد حسابات وسيطة للعميل. اختر الدور الذي يناسبك وابدأ.': 'There are no intermediary accounts. Pick the role that suits you and start.',
  'م': 'P',
  'ط': 'S',
  'أنا مريض': 'I am a patient',
  'أرغب في عرض حالة أسنان والعثور على طالب مناسب في جامعة قريبة.': 'I want to submit a dental case and find a suitable student at a nearby university.',
  'أنا طالب طب أسنان': 'I am a dental student',
  'أبحث عن حالات سريرية مناسبة لمتطلبات التدريب في جامعتي.': 'I am looking for clinical cases that fit my university training requirements.',
  'أمان وخصوصية': 'Security & privacy',
  'بياناتك لا تُعرض للطرف الآخر': 'Your data is never shown to the other party',
  'نخفي الاسم ورقم الهاتف وواتساب والبريد عن العملاء. الإدارة وحدها تنسّق التواصل عند وجود تطابق مناسب.': 'We hide names, phone numbers, WhatsApp and email from other users. Only the admin team coordinates contact when a suitable match exists.',
  'اعرف المزيد': 'Learn more',
  'شركاؤنا القريبون': 'Our nearby partners',
  'جامعات طب الأسنان': 'Dental universities',
  'اختر الجامعات الأنسب لك أثناء إنشاء ملفك أو حالتك.': 'Choose the universities that suit you while creating your profile or case.',
  'عرض الجامعات': 'View universities',
  'كلية طب الأسنان': 'College of Dentistry',
  'النجف / العراق': 'Najaf / Iraq',
  'جامعة الكوفة': 'University of Kufa',
  'جامعة الكفيل': 'Al-Kafeel University',
  'علاج الجذور': 'Root canal treatment',
  'حشوات الأسنان': 'Dental fillings',
  'تنظيف الأسنان': 'Teeth cleaning',
  'أسنان الأطفال': 'Pediatric dentistry',
  'مجالات التدريب': 'Training areas',
  'التصنيفات السريرية': 'Clinical categories',
  'تعرف على المجالات المتاحة قبل بدء التسجيل.': 'Explore the available areas before you sign up.',
  'تدريب سريري معتمد': 'Accredited clinical training',
  'أسئلة شائعة': 'Common questions',
  'قبل أن تبدأ': 'Before you start',
  'هل يمكنني اختيار أكثر من جامعة؟': 'Can I choose more than one university?',
  'نعم، يمكنك اختيار جامعة واحدة إلى أربع جامعات مناسبة لك، ويمكن تعديلها عند إضافة الحالة.': 'Yes, you can choose one to four universities that suit you, and change them when adding the case.',
  'هل تظهر بياناتي للطلاب؟': 'Is my data visible to students?',
  'لا. تظهر حالة مجهّلة فقط، وتبقى بيانات التواصل لدى إدارة المنصة.': 'No. Only an anonymized case is shown; contact details stay with the platform admins.',
  'هل التسجيل مجاني؟': 'Is registration free?',
  'إنشاء الحساب وإرسال الحالة متاحان من خلال المنصة، وأي تنسيق يتم عبر الإدارة.': 'Creating an account and submitting a case are available through the platform, and any coordination happens via the admins.',
  // footer
  'منصة تربط المرضى بطلاب طب الأسنان': 'A platform connecting patients with dental students',
  'رعاية أسنان أفضل بالتعاون مع جامعات العراق.': 'Better dental care in partnership with Iraqi universities.',
  'جميع الحقوق محفوظة لشركة الأساس للحلول البرمجية': 'All rights reserved to AL ASAS Software Solutions',
  // preferences
  'إعدادات العرض واللغة': 'Display and language settings',
  'المظهر': 'Appearance',
  'تلقائي حسب النظام': 'Automatic (system)',
  'الوضع الفاتح': 'Light mode',
  'الوضع الليلي': 'Dark mode',
  'تغيير اللغة إلى الإنجليزية': 'Switch language to English',
  'Switch language to Arabic': 'Switch language to Arabic',
};

export const translate = (lang: LangMode, text: string): string => (lang === 'en' ? en[text] ?? enMore[text] ?? text : text);

export const useT = () => {
  const lang = useLang();
  const t = useCallback((text: string) => translate(lang, text), [lang]);
  return { t, lang, dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const) };
};
