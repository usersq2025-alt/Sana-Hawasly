# دليل النشر والإعداد — Setup & Deployment Guide
### موقع سنا حواصلي — Sana Hawasly Personal Website

> نظام موقع ثنائي اللغة (عربي/إنجليزي) تُدار كامل بياناته من Google Sheets عبر Google Apps Script.
> A bilingual (Arabic RTL / English LTR) website whose entire content is managed from Google Sheets through a Google Apps Script API — **no code changes ever needed to edit content.**

---

## نظرة عامة على المعمارية — Architecture at a glance

```
┌─────────────────┐      GET  (JSON)      ┌──────────────────┐      reads      ┌─────────────────┐
│  Static Website │  ◀──────────────────  │  Google Apps     │  ◀────────────  │  Google Sheets  │
│  (HTML/CSS/JS)  │      POST (writes)    │  Script Web App  │      writes     │   (the "CMS")   │
│  any host       │  ──────────────────▶  │  /exec endpoint  │  ────────────▶  │  12 sheets      │
└─────────────────┘                       └──────────────────┘                 └─────────────────┘
```

- **Google Sheets** = قاعدة البيانات / لوحة التحكم (CMS). كل قسم في الموقع = ورقة (sheet).
- **Apps Script** = واجهة API. تحوّل الجداول إلى JSON وتخدمها للموقع، وتتيح الكتابة الاختيارية.
- **الموقع الثابت** = يقرأ الـ JSON ويبني كل الأقسام ديناميكيًا. لا يوجد محتوى مكتوب داخل الكود.

يعمل الموقع أيضًا **بدون إنترنت/بدون Sheets** اعتمادًا على `data/content.json` كنسخة احتياطية للتطوير المحلي.

---

## الجزء الأول: إعداد Google Sheets — Part 1: Set up Google Sheets

### الطريقة التلقائية (موصى بها) — Automatic (recommended)

1. اذهب إلى [sheets.new](https://sheets.new) لإنشاء جدول بيانات فارغ. سمّه مثلًا **Sana Hawasly — CMS**.
2. من القائمة العلوية: **Extensions ▸ Apps Script** (الإضافات ▸ برمجة تطبيقات).
3. احذف أي كود موجود، والصق كامل محتوى الملف `apps-script/Code.gs`.
4. احفظ (💾)، ثم من قائمة الدوال بالأعلى اختر **`setupSheets`** واضغط **Run** (تشغيل).
   - أول مرة سيطلب صلاحيات → **Review permissions ▸ اختر حسابك ▸ Advanced ▸ Go to project (unsafe) ▸ Allow**. هذا طبيعي لأنه سكربتك الخاص.
   - سيقوم تلقائيًا بإنشاء الأوراق الـ12 بالعناوين والتنسيق الصحيح.
5. شغّل الدالة **`seedData`** لتعبئة الأوراق ببيانات السيرة الذاتية كاملة (عربي/إنجليزي).

✅ الآن جدول البيانات جاهز ومملوء. افتح تبويب Sheets لتراجعه.

### إذا فضّلت البناء اليدوي — Manual alternative
أنشئ 12 ورقة بالأسماء التالية **بالحروف نفسها تمامًا**، وضع العناوين (الصف الأول) كما هي موضّحة في `docs/SHEETS.md`:
`Settings, About, Experience, Education, Awards, Training, Publications, Skills, News, Gallery, Social, References`

> **تنبيه:** أسماء الأوراق وأسماء الأعمدة (الصف الأول) حسّاسة لحالة الأحرف. أي ورقة يبدأ اسمها بشرطة سفلية `_` يتم تجاهلها (مفيدة للمسودّات).

---

## الجزء الثاني: نشر الـ API — Part 2: Deploy the Apps Script Web App

1. داخل محرر Apps Script اضغط **Deploy ▸ New deployment** (نشر ▸ نشر جديد).
2. بجانب "Select type" اضغط ⚙️ واختر **Web app**.
3. اضبط الحقول:
   - **Description:** `Sana CMS API v1`
   - **Execute as:** **Me** (نفّذ باسمي)
   - **Who has access:** **Anyone** (أي شخص) — ضروري ليتمكن الموقع من القراءة.
4. اضغط **Deploy**، وامنح الصلاحيات إذا طُلبت.
5. انسخ رابط **Web app URL** المنتهي بـ `/exec`. مثال:
   `https://script.google.com/macros/s/AKfy........./exec`

> **عند كل تعديل على الكود** أعد النشر عبر **Deploy ▸ Manage deployments ▸ ✏️ Edit ▸ Version: New version ▸ Deploy** حتى يسري التغيير. تعديل *المحتوى* في Sheets لا يحتاج إعادة نشر إطلاقًا.

---

## الجزء الثالث: ربط الموقع بالـ Sheets — Part 3: Connect the site

1. افتح الملف **`js/app.js`**.
2. في الأعلى ستجد:
   ```js
   var CONFIG = {
     API_URL: "", // e.g. "https://script.google.com/macros/s/AKfy...XXXX/exec"
     ...
   };
   ```
3. الصق رابط `/exec` بين علامتي التنصيص:
   ```js
   API_URL: "https://script.google.com/macros/s/AKfy........./exec",
   ```
4. احفظ الملف. **هذا هو الربط الوحيد المطلوب.** الموقع الآن يقرأ مباشرة من Google Sheets.

> إذا تركت `API_URL` فارغًا، يعمل الموقع على البيانات المحلية في `data/content.json` (وضع تطوير/عرض دون إنترنت).

---

## الجزء الرابع: نشر الموقع — Part 4: Publish the website

الموقع **ثابت (static)** بالكامل — لا يحتاج خادمًا. اختر أي خيار:

| الخيار | الخطوات | التكلفة |
|-------|---------|--------|
| **Netlify Drop** | اسحب مجلد المشروع إلى [app.netlify.com/drop](https://app.netlify.com/drop) | مجاني |
| **Vercel** | `vercel` في مجلد المشروع، أو ارفع عبر الواجهة | مجاني |
| **GitHub Pages** | ارفع المجلد لمستودع، فعّل Pages من الإعدادات | مجاني |
| **Cloudflare Pages** | اربط المستودع أو ارفع المجلد | مجاني |
| **استضافة تقليدية** | ارفع الملفات عبر FTP إلى `public_html` | حسب المزوّد |

### الربط بالنطاق `sanahawasly.com`
بعد النشر على أي منصة أعلاه، أضف النطاق من إعدادات المنصة (**Custom domain**) واتبع تعليمات DNS (عادةً سجل `CNAME` أو `A`). يُنصح بتفعيل HTTPS (تلقائي في المنصات المذكورة).

### تشغيل محلي للاختبار — Run locally
```bash
cd sana-website
python3 -m http.server 8000
# افتح http://localhost:8000
```

---

## قائمة تحقّق نهائية — Final checklist
- [ ] شغّلت `setupSheets` ثم `seedData`.
- [ ] نشرت الـ Web app ونسخت رابط `/exec`.
- [ ] لصقت الرابط في `CONFIG.API_URL` داخل `js/app.js`.
- [ ] رفعت الموقع على منصة استضافة.
- [ ] فتحت الموقع وجرّبت زر تبديل اللغة (EN · ع).
- [ ] عدّلت خلية في Sheets وتأكدت أن التغيير ظهر (خلال 5 دقائق بسبب الكاش، أو فورًا بعد مسح الكاش — انظر `EDITING.md`).
