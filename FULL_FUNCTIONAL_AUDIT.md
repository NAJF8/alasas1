# ALASAS DENTAL — Full Functional Audit

تاريخ الفحص: 2026-10-10
Repository: `NAJF8/alasas1`
Production: https://alasas.tech/
Admin: https://alasas.tech/admin/
Supabase project: `nkzvxdobklsehdyzyzmy`

## حدود الفحص

تم فحص الكود المحلي، بناء التطبيقين، المسارات المنشورة، واجهات الزائر، مسار التسجيل، حدود حماية المسارات، وكتالوج Supabase Production بصلاحية قراءة فقط. لم تُنفذ أي Migration أو كتابة SQL أو تغيير Auth/RLS/Storage أو اختبار ببيانات حقيقية.

## نتيجة مختصرة

| النطاق | النتيجة | الدليل أو القيد |
|---|---|---|
| PUBLIC PAGES | PASS | الصفحة الرئيسية وFAQ وHow it works تُعرض، والروابط الرئيسية ظاهرة |
| REGISTRATION PATIENT | PASS جزئي | مسار الهاتف/كلمة المرور والملف الشخصي يعملان؛ الحفظ الفعلي غير متاح عمداً |
| REGISTRATION STUDENT | PASS جزئي | الجامعة والمرحلة تظهران للدور الصحيح؛ الحفظ الفعلي غير متاح عمداً |
| LOGIN & AUTH | BLOCKED | الواجهة وGoogle/Email/Phone OTP موجودة؛ لا توجد جلسة اختبار مصرح بها للتحقق من OAuth/Readback |
| PATIENT DASHBOARD | BLOCKED | محمي ويتحول للـLogin دون جلسة؛ لا يوجد حساب اختبار مصرح به |
| STUDENT DASHBOARD | BLOCKED | محمي ويتحول للـLogin دون جلسة؛ لا يوجد حساب اختبار مصرح به |
| ADMIN DASHBOARD | BLOCKED | شاشة Admin Login تعمل؛ لا توجد جلسة Admin اختبارية |
| ALL BUTTONS | PARTIAL | اختُبرت عناصر الواجهات العامة والتسجيل وحماية المسارات؛ لا يصح إعلان كل أزرار الحسابات دون جلسات |
| ALL ICONS | PARTIAL | الأيقونات الظاهرة في المسارات العامة عُرضت؛ لا يوجد اختبار شامل لكل حالة داخلية |
| ALL LINKS | PASS جزئي | الروابط العامة ومسارات الحماية استجابت؛ روابط العمليات الداخلية تحتاج جلسة |
| DATABASE CRUD | BLOCKED | المخطط موجود، لكن Readback الكتابي يحتاج هوية اصطناعية معزولة |
| STORAGE | BLOCKED | Bucket الحالات موجود؛ لم يُنفذ رفع حقيقي دون هوية اختبار |
| RLS SECURITY | NOT FULLY VERIFIED | RLS مفعّل والسياسات مقروءة؛ لا يوجد اختبار adversarial بجلسات JWT اصطناعية |
| RESPONSIVE | PARTIAL | فحص بصري في متصفح التطبيق؛ مصفوفة 375/390/768/1024/1366/1920 الكاملة غير منفذة |
| BUILD | PASS | Customer وAdmin Build + TypeScript نجحا |
| DEPLOY | PASS | GitHub Actions workflow `38081145531` نجح في build/deploy |
| LIVE VERIFICATION | PASS جزئي | المسارات العامة وRegistration وAdmin Login ظهرت على Production |

لا يوجد `FULL PASS` لأن الاختبار المصادق عليه للـCRUD وOAuth وStorage وRLS غير متاح دون هويات اصطناعية مصرح بها وبيئة معزولة.

## الصفحات والمسارات المكتشفة

### Customer App

- `/`
- `/dashboard`
- `/patient/new-case`
- `/patient/dashboard`
- `/student/search`
- `/student/request`
- `/student/verification`
- `/how-it-works`
- `/patients` → `/patient/new-case`
- `/students` → `/student/search`
- `/faq`
- `/register`
- `/register-request`
- `/register/patient` → `/register?role=PATIENT&start=1`
- `/register/student` → `/register?role=STUDENT&start=1`
- `/login`
- `/onboarding`

### Admin App

- `/login`
- `/manager-invite`
- `/`
- `/branding`
- `/settings`
- `/registration-requests`
- `/users`
- `/patients`
- `/students`
- `/cases`
- `/requests`
- `/matches`
- `/appointments`
- `/universities`
- `/provinces`
- `/notifications`
- `/reports`
- `/admins`

## الاختبار الوظيفي المنفذ

### Customer / Public

- الصفحة الرئيسية: ظهرت Hero image والنصوص وبطاقتا المريض والطالب وروابط تسجيل الدخول وFAQ.
- `/faq`: أعاد عرض القسم العام دون صفحة بيضاء.
- `/login`: ظهرت تبويبات الهاتف والبريد وGoogle.
- تبويب البريد: ظهر حقل البريد وزر رابط الدخول.
- تبويب Google: ظهر زر Google.
- مسار `/patient/dashboard` دون جلسة: تحول إلى `#/login`.
- Admin `/users` دون جلسة: تحول إلى `admin/#/login`.

### Registration

- PATIENT: الدور محفوظ في الرابط وظهر نموذج كلمة المرور ثم بيانات المريض.
- STUDENT: الدور محفوظ في الرابط وظهر نموذج كلمة المرور ثم الجامعة والمرحلة.
- رقم عراقي `07123456789` طُبّع إلى `+9647123456789`.
- كلمة المرور من 8–128 حرفاً، حروف/أرقام/رموز، ومؤشر القوة ظهرت.
- إظهار/إخفاء كلمة المرور غيّر الحالة المرئية للحقل.
- كلمة المرور غير المتطابقة أعطت رسالة عربية واضحة.
- بعد إكمال بيانات الطالب ظهر زر الإرسال معطلاً ورسالة: Backend التسجيل غير مفعّل، ولم تُرسل البيانات ولم تُنشأ جلسة.
- فتح `/register` بعد تحديد الدور حافظ على الدور في `localStorage` والرابط ولم يعرض اختيار الدور مجدداً.

## فروقات Backend المؤكدة

- Production يحتوي 26 جدولاً عاماً، وكل الجداول المفحوصة لديها RLS مفعّل.
- Production لا يحتوي `public.registration_requests`.
- Production لا يحتوي `create_registration_request` أو `review_registration_request`.
- قائمة Edge Functions في Production فارغة؛ لذلك `registration-request` و`registration-admin` المحليتان غير منشورتين.
- Production يحتوي Bucket واحداً فقط: `patient-case-images`، خاص، حد الملف 10 MiB، وMIME types للصور/PDF.
- الكود الإداري يستدعي `branding-assets` لرفع الصور، لكنه غير موجود في Production؛ الرفع يجب أن يبقى BLOCKED حتى اعتماد Bucket وسياساته.
- الكود الإداري يستدعي `admin_list_managers` و`admin_list_manager_invitations` و`admin_update_manager`، وهذه الدوال غير ظاهرة في كتالوج Production المقروء.
- صفحة تسجيل طلبات الحسابات معطلة عمداً ولا تنفذ قراءة أو كتابة.
- تسجيل الهاتف وكلمة المرور الجديد ما زال معطلاً؛ تسجيل الهاتف الحالي يستخدم OTP فقط عند استدعائه، ولا تم إنشاء JWT مخصص.

## أخطاء أصلحت أثناء التدقيق

1. صفحة Admin `/students` كانت تطلب `student_verification_status`، وهو عمود غير موجود في `public.profiles` Production. أزيل العمود من الطلب مع توضيح أن حالة التوثيق المنفصلة غير متاحة في المخطط الحالي.
2. صفحة Admin لطلبات التسجيل كانت تعرض كلمة PIN القديمة؛ تم تحديثها إلى كلمة المرور.

## أخطاء أو قيود متبقية

1. التسجيل الفعلي غير ممكن حتى اعتماد مخطط `registration_requests`، نشر Edge Functions، ضبط الأسرار، واختبار الموافقة/التفعيل في بيئة معزولة.
2. رفع صور الهوية/العلامة التجارية في Admin غير ممكن مع الكود الحالي لأن Bucket `branding-assets` غير موجود في Production. لا يجوز إعادة استخدام Bucket صور الحالات.
3. دعوات المدراء وتعديل صلاحياتهم غير قابلة للإثبات لأن RPCs وEdge Function المقابلة غير موجودة في Production.
4. الموافقات والرفض وحالات التوثيق لا يمكن اختبارها فعلياً دون Backend/هوية Admin معزولة.
5. إنشاء حالة المريض يكتب الحالة والجامعات والصور في عمليات منفصلة؛ عند فشل عملية لاحقة قد تبقى بيانات جزئية. إصلاح ذلك يحتاج RPC/transaction أو سياسة تعويض آمنة، ولم يتم اختلاقها في Production.
6. المصفوفة الكاملة لكل أحجام الشاشات الستة وكل المتصفحات لم تُثبت؛ المتاح حالياً فحص متصفح تطبيقي بصري محدود.
7. Lint ينجح مع تحذيرات React غير مانعة، منها `set-state-in-effect` و`Date` أثناء render وFast Refresh exports.

## أوامر التحقق

- `npm run build` في `customer-app`: PASS.
- `npm run lint` في `customer-app`: PASS مع warnings.
- `npm run build` في `admin-app`: PASS.
- `npm run lint` في `admin-app`: PASS مع warnings.
- فحص المسارات: `rg` على `Routes`, `Route`, `HashRouter`.
- فحص التكامل: `rg` على `from`, `rpc`, `storage`, `functions.invoke`, `auth`.
- Supabase catalog/advisors/SQL SELECT فقط؛ لا توجد كتابة Production.

## قرار النشر

تم نشر الإصلاحات الأمامية الآمنة فقط بعد نجاح Build: إزالة العمود غير الموجود من Admin `/students` وتحديث نص PIN القديم. Commit: `d3d6aeef4f3be549465cf6f2f896f86d5a7499a`. Workflow: `38081145531`. لم يُنشر أي Backend أو Migration ولم يتغير Auth/RLS/Storage.
