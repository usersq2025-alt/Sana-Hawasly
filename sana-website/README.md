# موقع سنا حواصلي — Sana Hawasly Personal Website

موقع شخصي احترافي **ثنائي اللغة** (عربي RTL / إنجليزي LTR)، فاخر ومتجاوب بالكامل، تُدار كل بياناته من **Google Sheets** عبر **Google Apps Script** كنظام إدارة محتوى (CMS). أي تعديل في Sheets ينعكس على الموقع **دون أي تغيير في الكود**.

A production-ready, fully bilingual, responsive personal website driven entirely by a **Google Sheets CMS** through a **Google Apps Script** API. Edit the sheet → the site updates. No code changes ever.

---

## ✨ المزايا — Features
- **ثنائي اللغة كامل**: تبديل فوري بين العربية (RTL, خطوط Amiri/Tajawal) والإنجليزية (LTR, خطوط Fraunces/Inter)، مع أرقام عربية وتخطيط معكوس صحيح.
- **مُدار بالكامل من Google Sheets**: 12 ورقة تغطي كل قسم. لا محتوى داخل الكود.
- **هوية بصرية أصلية**: لغة تصميم مستوحاة من لوحات الدارات الإلكترونية (nodes/traces) ترمز لخلفية سنا الهندسية ومشروع "دارتي" وقصة الربط الإنساني. لوحة ألوان: حبر كحلي، ورق دافئ، نحاس، تركواز.
- **يعمل دون إنترنت**: نسخة احتياطية محلية `data/content.json` للتطوير والعرض.
- **جاهز للإنتاج**: SEO (Open Graph, Twitter, JSON-LD Person)، Accessibility (ARIA, skip-link, focus states, reduced-motion)، أداء (كاش ثلاثي الطبقات)، وحالات تحميل/خطأ.
- **قابل للتوسّع**: إضافة قسم جديد = ورقة جديدة + قالب عرض بسيط.

---

## 📁 هيكل المشروع — Project structure
```
sana-website/
├── index.html                  # هيكل HTML الدلالي + وسوم SEO + خطافات data-*
├── css/
│   └── styles.css              # نظام التصميم الكامل: tokens, RTL, مكوّنات, حركات
├── js/
│   └── app.js                  # منطق التطبيق: جلب البيانات, i18n, بناء الأقسام ديناميكيًا
├── data/
│   └── content.json            # نسخة محلية احتياطية تطابق بنية Google Sheets
├── apps-script/
│   └── Code.gs                 # واجهة API: doGet/doPost + setupSheets + seedData
├── assets/
│   ├── Sana-Hawasly-CV.pdf     # السيرة الإنجليزية
│   ├── Sana-Hawasly-CV-AR.pdf  # السيرة العربية
│   ├── favicon.svg             # أيقونة الموقع (دارة كحلية)
│   └── og-image.png            # صورة المشاركة الاجتماعية 1200×630
└── docs/
    ├── SETUP.md                # النشر والإعداد خطوة بخطوة
    ├── SHEETS.md               # مرجع هيكل الأوراق والأعمدة
    └── EDITING.md              # تعديل المحتوى دون برمجة
```

---

## 🚀 البدء السريع — Quick start
1. **Sheets + API:** أنشئ جدول بيانات ▸ Extensions ▸ Apps Script ▸ الصق `apps-script/Code.gs` ▸ شغّل `setupSheets` ثم `seedData`.
2. **انشر الـ API:** Deploy ▸ New deployment ▸ Web app (Execute as: Me, Access: Anyone) ▸ انسخ رابط `/exec`.
3. **اربط الموقع:** الصق الرابط في `CONFIG.API_URL` داخل `js/app.js`.
4. **انشر الموقع:** ارفع المجلد إلى Netlify / Vercel / GitHub Pages.

التفاصيل الكاملة في **[`docs/SETUP.md`](docs/SETUP.md)**.

> تشغيل محلي: `python3 -m http.server 8000` ثم افتح `http://localhost:8000` (يعمل على البيانات المحلية إن كان `API_URL` فارغًا).

---

## 🧩 كيف يعمل النظام — How it fits together
1. **Google Sheets** يخزّن المحتوى في 12 ورقة (قسم لكل ورقة).
2. **`Code.gs`** ينشر Web App: `doGet` يحوّل كل الأوراق إلى JSON واحد (مع كاش 5 دقائق)؛ `doPost` يتيح كتابة اختيارية محميّة برمز (add/update/delete).
3. **`app.js`** يجلب الـ JSON، يخزّنه محليًا (30 دقيقة) مع تحديث بالخلفية، ثم **يبني كل قسم ديناميكيًا** ويطبّق الترجمة حسب اللغة النشطة.
4. **`content.json`** مرآة لنفس البنية، يُستخدم عندما يكون `API_URL` فارغًا.

---

## 🔧 التوسّع: إضافة قسم جديد — Extending with a new section
مثال: إضافة قسم "المشاريع / Projects".
1. **الورقة:** أضف ورقة `Projects` بعناوين مثل `id, order, title_en, title_ar, desc_en, desc_ar, url` (أو أضفها إلى `schema` في `setupSheets` ثم أعد تشغيلها).
2. **الجلب:** لا حاجة لتغيير — `readAll_()` يقرأ كل الأوراق تلقائيًا، فيصبح `data.Projects` متاحًا فورًا في الموقع.
3. **العرض:** في `index.html` أضف عنصر `<section id="projects">`، وفي `app.js` أضف دالة عرض صغيرة تستهلك `data.Projects` (يمكن نسخ نمط `renderTraining` أو `renderAwards` كقالب).
4. **الترجمة:** استخدم مساعد `pick(item,'title')` ليختار `title_en`/`title_ar` حسب اللغة.

> الأوراق التي يبدأ اسمها بـ `_` تُتجاهَل — مفيدة للمسودّات.

---

## 🎨 نظام التصميم — Design system
- **الألوان:** حبر كحلي `#0B1F3A` · ورق `#F7F4EC` · نحاس `#C08A3E` · تركواز `#1E7A6E` · إردوازي `#5C6B7A` (قابلة للتعديل من ورقة `Settings`).
- **الخطوط:** Fraunces + Inter (إنجليزي)، Amiri + Tajawal (عربي)، Space Mono (عناصر تقنية).
- **RTL:** عبر الخصائص المنطقية (logical properties) وتبديل الخطوط والاتجاه تلقائيًا حسب اللغة.

---

## 🔒 الأمان — Security notes
- القراءة (GET) عامة ليقرأ الموقع المحتوى — لا تضع بيانات حساسة في الأوراق.
- الكتابة (POST) اختيارية ومحمية: اضبط `WRITE_TOKEN` في `Code.gs` لتفعيلها. الموقع الحالي للقراءة فقط، والتحرير يتم من واجهة Google Sheets نفسها.

---

## 📄 الترخيص — License
محتوى وسيرة سنا حواصلي مملوكة لصاحبتها. الكود متاح لسنا حواصلي للاستخدام والتعديل بحرية.
