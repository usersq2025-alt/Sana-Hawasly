# هيكل Google Sheets — Sheets Schema Reference

جدول البيانات يحتوي **12 ورقة**. نوعان من الأوراق:

- **أوراق مفتاح/قيمة (Key/Value):** عمودان فقط — `key` في العمود A و`value` في العمود B. تُستخدم للإعدادات العامة. الأوراق: `Settings`, `About`.
- **أوراق جدولية (Tables):** الصف الأول عناوين الأعمدة، وكل صف بعده = عنصر يظهر في الموقع. باقي الأوراق كلها من هذا النوع.

### قواعد عامة
- **الحقول ثنائية اللغة** تنتهي بـ `_en` (إنجليزي) و`_ar` (عربي). الموقع يختار الحقل حسب اللغة النشطة.
- **`order`**: رقم يحدّد ترتيب الظهور (تصاعديًا). غيّر الأرقام لإعادة الترتيب.
- **`id`**: معرّف فريد للصف (يُستخدم للتعديل/الحذف عبر الـ API). اتركه كما هو أو أعطِ قيمة فريدة عند الإضافة اليدوية.
- **القوائم داخل خلية واحدة**: افصل العناصر بعلامة **`|`** (pipe). مثال في `points_en`:
  `Lead programs | Coordinate donors | Strengthen quality`
- **`published`** (في News وGallery): اكتب `TRUE` للنشر أو `FALSE` للإخفاء.
- أي ورقة يبدأ اسمها بـ `_` (مثل `_Drafts`) يتجاهلها النظام.

---

## 1. Settings — الإعدادات العامة (key/value)
| key | مثال القيمة | الوصف |
|-----|------|-------|
| `site_title_en` / `site_title_ar` | Sana Hawasly / سنا حواصلي | الاسم/عنوان الموقع |
| `tagline_en` / `tagline_ar` | نص تعريفي قصير | يظهر في الـ hero |
| `role_en` / `role_ar` | Education & Technology Leader | المسمّى المهني |
| `location_en` / `location_ar` | Damascus, Syria / دمشق، سوريا | الموقع |
| `email` | sana.haw@gmail.com | البريد |
| `phone` | +963937699037 | الهاتف |
| `website` | www.sanahawasly.com | الموقع |
| `primary_color` | #0B1F3A | لون الحبر الأساسي |
| `accent_color` | #C08A3E | لون النحاس (accent) |
| `signal_color` | #1E7A6E | لون الإشارة (teal) |
| `paper_color` | #F7F4EC | لون الخلفية الورقية |
| `og_image` | assets/og-image.png | صورة المشاركة الاجتماعية |
| `cv_pdf_en` / `cv_pdf_ar` | assets/Sana-Hawasly-CV.pdf | روابط السيرة PDF |
| `default_lang` | en أو ar | اللغة الافتراضية عند فتح الموقع |

## 2. About — نبذة وأرقام (key/value)
| key | الوصف |
|-----|-------|
| `intro_en` / `intro_ar` | فقرة التعريف |
| `highlight_1_number_en/_ar` … `highlight_3_number_en/_ar` | الأرقام الثلاثة البارزة (مثل +10) |
| `highlight_1_label_en/_ar` … `highlight_3_label_en/_ar` | تسمية كل رقم |

## 3. Experience — الخبرات (table)
`id · order · role_en · role_ar · org_en · org_ar · url · period · period_ar · summary_en · summary_ar · points_en · points_ar`
- `period`: مثل `2025 – Present` / `period_ar`: `2025 – الآن`
- `points_en/_ar`: النقاط مفصولة بـ `|`

## 4. Education — التعليم (table)
`id · order · degree_en · degree_ar · institution_en · institution_ar · period`

## 5. Awards — الجوائز (table)
`id · order · title_en · title_ar · org_en · org_ar · url · year · type_en · type_ar`
- `type_en`: `Business` أو `Personal` (يُستخدم لفلترة الجوائز) / `type_ar`: `أعمال` أو `شخصية`

## 6. Training — الدورات (table)
`id · order · title_en · title_ar · org_en · org_ar · year`

## 7. Publications — المنشورات (table)
`id · order · title_en · title_ar · desc_en · desc_ar · publisher_en · publisher_ar · date_en · date_ar · url`

## 8. Skills — المهارات (table)
`id · order · category_en · category_ar · items_en · items_ar`
- `items_en/_ar`: المهارات مفصولة بـ `|`

## 9. News — الأخبار (table)
`id · order · title_en · title_ar · body_en · body_ar · date · url · published`
- `date`: صيغة `YYYY-MM-DD` (مثل `2024-09-01`)

## 10. Gallery — المعرض (table)
`id · order · title_en · title_ar · image · caption_en · caption_ar · published`
- `image`: رابط صورة كامل، أو مسار مثل `assets/photo.jpg`. إن تُرك فارغًا يُرسم رسم دارة زخرفي تلقائيًا.

## 11. Social — روابط التواصل (table)
`id · order · platform · label · url · icon`
- `icon`: أحد `linkedin, twitter, github, instagram, facebook, youtube, globe, mail`

## 12. References — المراجع (table)
`id · order · name_en · name_ar · title_en · title_ar · contact`

---

### كيف يُقرأ كل هذا؟
`Google Apps Script` يقرأ كل ورقة: الأوراق في `SINGLE_OBJECT_SHEETS` (Settings, About) تُقرأ كـ كائن مفاتيح/قيم، والباقي كمصفوفة صفوف مفاتيحها عناوين الأعمدة. الناتج JSON واحد يستهلكه الموقع مباشرة. لإضافة **قسم جديد** بالكامل، راجع `README.md ▸ التوسّع`.
