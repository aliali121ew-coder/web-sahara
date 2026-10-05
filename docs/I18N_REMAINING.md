# ترجمة المنظومة (i18n): ما بقي وكيف يُكمَل

آخر تحديث: 2026-10-05 — الفرع `develop`

## ما اكتمل
- الأساس: `src/i18n/` (i18next + ملفات JSON + `format.ts` + `errors.ts` + `enums.ts` + `glossary.json`) وفحص البناء `scripts/i18n-check.mjs`.
- الهيكل العام: القائمة الجانبية، الهيدر، بطاقة الملف الشخصي، مؤشر الحفظ، لوحة الأوامر، شريط المسار.
- تسجيل الدخول (الحاسوب والهاتف والدعم والشرائح) + زر اللغة.
- الإعدادات، وإدارة المستخدمين كاملة.
- لوحة القيادة.
- الخزانات كاملة.
- الأسعار (`prices`) والتقويم المشترك `ui/DateRangeCalendar.tsx` (مفاتيحه في `common.calendar`).
- رصيد الصحاري (`finance`): النصوص المشتركة بين سجلات الأيام في `finance:ledger.*`، والأرشيفات في `finance:archive.*`. ترويسة الطباعة الرسمية `print/OfficialReportHeader.tsx` وعناصر الطباعة المشتركة (التوقيعات، تاريخ الطباعة، الاتجاه) في `common.print`، وترقيم الصفحات في `common.pagination`.
- رصيد الاتحاد (`finance`): البوابة والتبويبات (`finance:hub.*`)، الحركات والأرشيف والطباعة (`tx`, `etihadArchive`, `etihadPrint`)، جرد الخزانات (`tanksReport`, `tanksView`)، الاحتياطي (`reservesView`). بيانات المواقع التجريبية الثابتة في `EtihadMultiSiteReservesView` (أسماء ومواقع ومسؤولون) تُركت بيانات كما هي.
- الوارد والنافذة السريعة (`deliveries`): الصفحة وكشف الطباعة ونافذة التسجيل/الاستيراد. القيم المخزّنة (الشركات، المجهز الافتراضي، ألوان المنتج، حالات الشحنة، «الكل» في الفلاتر) تبقى بالعربية في البيانات وتُعرض عبر `enumText`. قائمة رموز المحافظات `IRAQ_PROVINCE_CODES` غير مستخدمة حاليًا.

## ما بقي
الرقم = عدد الأسطر التي فيها عربي (يشمل بيانات ومقارنات تبقى كما هي).

### 6. المحادثات (`chat`)
`ChatModals.tsx` (76)، `ChatApp.tsx` (51)، `AdminModal.tsx` (35)، `MessageBubble.tsx` (30)، `Composer.tsx` (18)، `Attachments.tsx` (8)، `DispatchChat.tsx` (6)، `Lightbox.tsx` (5)، و`chatUtils.ts` (`lastSeenText`, `formatDay` → استخدم `fmtRelative`/`fmtDayLabel`).

### 7. إدارة النظام (`system`)
`SystemConsole.tsx` (68)، `systemUi.tsx` (36)، `BackupsPanel.tsx` (27)، `DbBrowser.tsx` (13)

### 8. صفحات مخفية من القائمة (اختياري الآن)
`reports/ReportsAnalytics.tsx` (30)، `tasks/TasksLogistics.tsx` (8)، `managers/SiteManagers.tsx` (4)

### 9. رسائل الخادم
`worker/chat.ts` (177 سطرًا عربيًا): أضف `code` لكل خطأ يُعاد للواجهة، وترجم في الواجهة عبر `errorText(e, ns)` (ابحث في `src/i18n/locales/*/auth.json` → `errors` كمثال). تفاصيل سجل العمليات (`audit detail`) تُخزَّن نصًا عربيًا؛ إن أردت ترجمتها فخزّن رموزًا منظمة بدل النص.

### 10. ضمان الجودة
- `eslint-plugin-i18next` لمنع النصوص المكتوبة مباشرة في JSX.
- اختبارات Vitest/Playwright لتبديل اللغة والاتجاه.
- cspell للإنجليزية.
- بعد اكتمال كل ما سبق: احذف النظام القديم (`src/lib/translations.ts`، `translateDomTree`، و`tr`/`t` القديمة في `src/context/LanguageContext.tsx`) وأبقِ `direction`/`setLanguage` مبنية على i18next.

## قواعد إلزامية
1. ملفات الترجمة: `src/i18n/locales/{ar,en}/<namespace>.json`، مفاتيح وصفية (مثل `balance.totalInbound`) وليست نصوصًا.
2. في المكوّن: `const { t } = useTranslation(['<ns>', 'common'])` ثم `t('<ns>:key')`. احذف `tr` من `useLanguage()` عندما لا يعود مستخدمًا.
3. المشترك من `common`: `units.liter|iqd|meter|days`، `actions.save|cancel|delete|close|done|edit|saveChanges|confirm`، `status.*`، `time.*`.
4. الجمع: العربية 6 صيغ (`_zero _one _two _few _many _other`)، الإنجليزية (`_one _other`). مثال صحيح: «3 أيام»، «15 يومًا»، «100 يوم».
5. جملة يتوسطها اسم أو رقم → جملة كاملة بـ `<Trans t={t} i18nKey="..." values={{ name }} components={{ 1: <strong /> }} />`، لا تركيب أجزاء.
6. القيم الثابتة المخزّنة بالعربية في البيانات (أيام، شركات، أصناف، تصنيفات، حالات) → `enumText(value)` من `src/i18n/enums.ts` (أضف القيمة إلى `SLUG` ومفتاحها في `common.enum`). ما يدخله المستخدم (أسماء محطات/موردين/خزانات/ملاحظات) يُعرض كما هو. لا تغيّر قيم البيانات ولا المقارنات (`=== 'حكومي'`).
7. الأرقام والتواريخ: `src/i18n/format.ts` (`fmtNumber`, `fmtDate`, `fmtTime`, `fmtRelative`, `fmtDayLabel`)، أرقام غربية دائمًا. `formatNumber/formatIQD/formatLiters` في `src/lib/utils.ts` تتبع اللغة.
8. الاتجاه: `start/end`, `ms/me`, `ps/pe`, `text-start/end`, `border-s/e` بدل left/right. الأسهم حسب `i18n.dir()`. الحقول `dir="ltr"` تحسب الجهات من اتجاه الصفحة. لا تستخدم أسماء أصناف Tailwind مركّبة ديناميكيًا (`pl-${x}`).
9. العربية: فصحى سليمة (الهمزات، التنوين «يومًا»، «تحديث» لا «تحديت»). الإنجليزية: Sentence case، طبيعية لا حرفية، طبقًا لـ `src/i18n/glossary.json`.
10. ترجم أيضًا: `placeholder`, `title`, `aria-label`, `alt`, رسائل `alert/confirm`, رؤوس CSV وأسماء الملفات المصدَّرة.
11. عند البحث الآلي عن `tr(` قيّده بكلمة مستقلة `(?<![\w.])tr\(` حتى لا يلتقط `setCapacityStr(`.
12. نصوص كتبها المستخدم يدويًا (مثل مسافات زائدة أو صياغة خاصة) احترمها: نظّف المسافات فقط وأبقِ الصياغة، وأضف مقابلها الإنجليزي.

## التحقق بعد كل مرحلة
```
npm run i18n:check
npm run build
```
ثم في المتصفح على `http://localhost:3715`: بدّل اللغة إلى English، وافتح الصفحة، وتأكد ألا يبقى نص عربي إلا البيانات. فحص سريع من Console:
```js
[...document.querySelectorAll('main *')].filter(e=>!e.children.length&&/[؀-ۿ]/.test(e.textContent)&&e.getClientRects().length).map(e=>e.textContent.trim()).slice(0,50)
```
بعد كل مرحلة: commit منفصل ثم `git push origin develop` (لا دمج إلى main).
