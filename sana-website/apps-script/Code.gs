/**
 * ============================================================
 *  Sana Hawasly — Personal Site CMS API
 *  Google Apps Script Web App
 *
 *  Turns a Google Spreadsheet into a headless CMS.
 *  Serves all site content as JSON, and supports optional
 *  token-protected writes (add / update / delete rows).
 *
 *  DEPLOY: Extensions ▸ Apps Script ▸ paste this file ▸
 *          Deploy ▸ New deployment ▸ Web app
 *          Execute as: Me   |   Who has access: Anyone
 *  Then copy the /exec URL into js/app.js  →  CONFIG.API_URL
 * ============================================================
 */

/* -------- Configuration -------- */
var CONFIG = {
  // Optional: set a secret to protect write operations (add/update/delete).
  // Read (GET) is always public so the website can load content.
  WRITE_TOKEN: '',            // e.g. 'change-me-to-a-long-random-string'
  CACHE_SECONDS: 300,         // server-side cache for GET (5 min). 0 to disable.
  // Sheets that hold a single object (key/value in columns A/B) instead of a table.
  SINGLE_OBJECT_SHEETS: ['Settings', 'About']
};

/* -------- Web entry points -------- */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    // Single-sheet fetch: ?sheet=Experience
    if (params.sheet) {
      return json_({ ok: true, data: readSheet_(params.sheet) });
    }
    // Full payload (cached)
    var cache = CacheService.getScriptCache();
    var cacheKey = 'cms_all_v1';
    if (CONFIG.CACHE_SECONDS > 0) {
      var hit = cache.get(cacheKey);
      if (hit) return json_(JSON.parse(hit));
    }
    var payload = { ok: true, data: readAll_(), generatedAt: new Date().toISOString() };
    if (CONFIG.CACHE_SECONDS > 0) cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
    return json_(payload);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
    // Auth for writes
    if (CONFIG.WRITE_TOKEN && body.token !== CONFIG.WRITE_TOKEN) {
      return json_({ ok: false, error: 'Unauthorized' }, 401);
    }
    var action = body.action;
    var result;
    switch (action) {
      case 'add':    result = addRow_(body.sheet, body.row); break;
      case 'update': result = updateRow_(body.sheet, body.id, body.row); break;
      case 'delete': result = deleteRow_(body.sheet, body.id); break;
      default: return json_({ ok: false, error: 'Unknown action: ' + action }, 400);
    }
    CacheService.getScriptCache().remove('cms_all_v1'); // bust cache on write
    return json_({ ok: true, result: result });
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

/**
 * Manually clear the server-side content cache.
 * Run this from the Apps Script editor to make Sheets edits appear
 * on the site immediately instead of waiting for the cache to expire.
 */
function clearCache() {
  CacheService.getScriptCache().remove('cms_all_v1');
  Logger.log('Cache cleared. Latest Sheets content will be served on next request.');
}

/* -------- Core readers -------- */

function readAll_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = {};
  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    if (name.charAt(0) === '_') return;         // skip helper sheets like "_docs"
    out[name] = readSheet_(name);
  });
  return out;
}

/**
 * Reads a sheet.
 * - SINGLE_OBJECT_SHEETS → returns an object built from column A (key) / B (value).
 * - Otherwise → returns an array of row objects keyed by the header row.
 */
function readSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  var values = sheet.getDataRange().getValues();
  if (!values.length) return isSingle_(name) ? {} : [];

  if (isSingle_(name)) {
    var obj = {};
    values.forEach(function (r) {
      var key = String(r[0]).trim();
      if (key && key.charAt(0) !== '#') obj[key] = normalize_(r[1]);
    });
    return obj;
  }

  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue; // skip blank
    var obj = {};
    headers.forEach(function (h, j) { if (h) obj[h] = normalize_(row[j]); });
    rows.push(obj);
  }
  return rows;
}

function isSingle_(name) { return CONFIG.SINGLE_OBJECT_SHEETS.indexOf(name) !== -1; }

function normalize_(v) {
  if (v instanceof Date) {
    // ISO date (yyyy-mm-dd) for consistent client parsing
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return v;
}

/* -------- Writers (optional admin) -------- */

function addRow_(name, rowObj) {
  var sheet = getTableSheet_(name);
  var headers = headers_(sheet);
  if (!rowObj.id) rowObj.id = name.toLowerCase() + '-' + Date.now();
  var line = headers.map(function (h) { return rowObj[h] != null ? rowObj[h] : ''; });
  sheet.appendRow(line);
  return rowObj;
}

function updateRow_(name, id, rowObj) {
  var sheet = getTableSheet_(name);
  var headers = headers_(sheet);
  var idCol = headers.indexOf('id');
  if (idCol === -1) throw new Error('Sheet "' + name + '" has no id column');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      headers.forEach(function (h, j) {
        if (rowObj.hasOwnProperty(h)) sheet.getRange(i + 1, j + 1).setValue(rowObj[h]);
      });
      return { updated: id };
    }
  }
  throw new Error('Row not found: ' + id);
}

function deleteRow_(name, id) {
  var sheet = getTableSheet_(name);
  var headers = headers_(sheet);
  var idCol = headers.indexOf('id');
  if (idCol === -1) throw new Error('Sheet "' + name + '" has no id column');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { deleted: id };
    }
  }
  throw new Error('Row not found: ' + id);
}

function getTableSheet_(name) {
  if (isSingle_(name)) throw new Error('"' + name + '" is a settings sheet, not a table');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}
function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

/* -------- JSON response helper (with permissive CORS) -------- */

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 *  ONE-TIME SETUP
 *  Run setupSheets() once from the Apps Script editor to build
 *  every sheet with headers and seed data extracted from the CV.
 *  Safe to re-run: it only creates sheets that don't exist.
 * ============================================================
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var schema = {
    Settings: { single: true, rows: [
      ['# key', 'value'],
      ['site_title_en', 'Sana Hawasly'],
      ['site_title_ar', 'سنا حواصلي'],
      ['tagline_en', 'Education technologist, humanitarian, and engineer building learning systems where they are needed most.'],
      ['tagline_ar', 'مهندسة وخبيرة في تكنولوجيا التعليم والعمل الإنساني، تبني أنظمة تعلّم حيث تشتدّ الحاجة إليها.'],
      ['role_en', 'Senior Education Program Officer · Molham Team'],
      ['role_ar', 'مسؤولة أولى لبرنامج التعليم · فريق ملهم'],
      ['location_en', 'Damascus, Syria'],
      ['location_ar', 'دمشق، سوريا'],
      ['email', 'sana.haw@gmail.com'],
      ['phone', '+963937699037'],
      ['website', 'https://www.sanahawasly.com'],
      ['cv_pdf_en', 'assets/Sana-Hawasly-CV.pdf'],
      ['cv_pdf_ar', 'assets/Sana-Hawasly-CV-AR.pdf'],
      ['default_lang', 'ar']
    ]},
    About: { single: true, rows: [
      ['# key', 'value'],
      ['intro_en', 'I work at the intersection of engineering, education, and humanitarian impact. From computer engineering in Damascus to a Master\'s in Education & Technology at UCL, my thread has always been the same: designing learning systems that reach the people who need them most, and building the teams, tools, and partnerships to make them last.'],
      ['intro_ar', 'أعمل عند تقاطع الهندسة والتعليم والأثر الإنساني. من هندسة الحواسيب في دمشق إلى ماجستير في التعليم والتكنولوجيا من كلية لندن الجامعية UCL، ظلّ خيطي الناظم واحدًا: تصميم أنظمة تعلّم تصل إلى من هم في أمسّ الحاجة إليها، وبناء الفرق والأدوات والشراكات التي تجعلها مستدامة.'],
      ['highlight_1_number_en', '10+'],
      ['highlight_1_number_ar', '+10'],
      ['highlight_1_label_en', 'years building education & entrepreneurship programs'],
      ['highlight_1_label_ar', 'سنوات في بناء برامج التعليم وريادة الأعمال'],
      ['highlight_2_number_en', 'UCL'],
      ['highlight_2_number_ar', 'UCL'],
      ['highlight_2_label_en', 'MA in Education & Technology, London'],
      ['highlight_2_label_ar', 'ماجستير في التعليم والتكنولوجيا، لندن'],
      ['highlight_3_number_en', 'UN'],
      ['highlight_3_number_ar', 'UN'],
      ['highlight_3_label_en', 'agency initiatives coordinated (UNDP · UNFPA)'],
      ['highlight_3_label_ar', 'مبادرات نسّقتها مع وكالات الأمم المتحدة (UNDP · UNFPA)']
    ]},
    Experience: { headers: ['id','order','role_en','role_ar','org_en','org_ar','url','period','period_ar','summary_en','summary_ar','points_en','points_ar'] },
    Education:  { headers: ['id','order','degree_en','degree_ar','institution_en','institution_ar','period'] },
    Awards:     { headers: ['id','order','title_en','title_ar','org_en','org_ar','url','year','type_en','type_ar'] },
    Training:   { headers: ['id','order','title_en','title_ar','org_en','org_ar','year'] },
    Publications:{ headers: ['id','order','title_en','title_ar','desc_en','desc_ar','publisher_en','publisher_ar','date_en','date_ar','url'] },
    Skills:     { headers: ['id','order','category_en','category_ar','items_en','items_ar'] },
    News:       { headers: ['id','order','title_en','title_ar','body_en','body_ar','date','url','published'] },
    Gallery:    { headers: ['id','order','title_en','title_ar','image','caption_en','caption_ar','published'] },
    Social:     { headers: ['id','order','platform','label','url','icon'] },
    References: { headers: ['id','order','name_en','name_ar','title_en','title_ar','contact'] }
  };

  Object.keys(schema).forEach(function (name) {
    var def = schema[name];
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() > 0) return; // don't clobber existing data
    if (def.single) {
      sheet.getRange(1, 1, def.rows.length, 2).setValues(def.rows);
      sheet.setColumnWidth(1, 220); sheet.setColumnWidth(2, 640);
    } else {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#0B1F3A').setFontColor('#F7F4EC');
      sheet.setFrozenRows(1);
    }
  });

  // Remove the default empty "Sheet1" if present and unused
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);

  SpreadsheetApp.getUi && SpreadsheetApp.getUi().alert('Setup complete. Now run seedData() to fill in the CV content, or paste rows manually.');
}

/**
 * Fills the table sheets with the CV data. Run AFTER setupSheets().
 * Re-running appends duplicates, so only run once (or clear rows first).
 */
function seedData() {
  var seed = {
    Experience: [
      ['exp-molham',1,'Senior Education Program Officer','مسؤولة أولى لبرنامج التعليم','Molham Team','فريق ملهم التطوعي','https://www.molhamteam.com','2025 — Present','2025 — الآن','A humanitarian organization delivering integrated support to displaced communities, with education as a core driver of recovery and resilience.','منظمة إنسانية تقدّم دعمًا متكاملًا للمجتمعات النازحة، وتضع التعليم في صميم التعافي وتعزيز القدرة على الصمود.','Lead and expand education programs that improve access, quality, and learning outcomes.|Coordinate schools, partners, donors, and field teams for timely and impactful delivery.|Strengthen education quality through teacher development, monitoring, innovation, and alignment with global standards.','قيادة برامج التعليم وتوسيع نطاقها بما يسهم في تحسين الوصول إلى التعليم وجودته ومخرجات التعلّم.|تنسيق العمل بين المدارس والشركاء والمانحين والفرق الميدانية لضمان تنفيذ البرامج في الوقت المحدد.|تعزيز جودة التعليم من خلال تطوير المعلمين والمتابعة المستمرة والابتكار.'],
      ['exp-osea',2,'Board Member','عضو مجلس إدارة','Syrian Engineers Association — Damascus','نقابة المهندسين السوريين — فرع دمشق','https://www.osea.org.sy','2025 — Present','2025 — الآن','','','Contribute to strategic planning and the development of digital transformation initiatives.|Support data-driven decision-making through improved collection and analysis systems.|Advocate for youth engagement and representation within professional engineering bodies.|Participate in change management to improve organizational efficiency.','المساهمة في التخطيط الاستراتيجي وتطوير مبادرات التحول الرقمي.|دعم اتخاذ القرارات القائمة على البيانات.|مناصرة مشاركة الشباب وتعزيز تمثيلهم ضمن الهيئات الهندسية.|المشاركة في إدارة التغيير بهدف رفع الكفاءة.'],
      ['exp-daraty',3,'Co-founder & CEO','شريك مؤسس ومدير تنفيذي','Daraty','دارتي','https://www.daraty.com','2014 — Present','2014 — الآن','A startup that teaches children the basics of electronic circuits through an interactive learning kit.','مشروع ناشئ يهدف إلى تعليم الأطفال أساسيات الدارات الإلكترونية من خلال مجموعة أدوات تعليمية تفاعلية.','Lead the development of the startup\'s short- and long-term strategy.|Ensure the product roadmap aligns with the startup\'s vision.|Pilot fundraising efforts and manage finances.','قيادة تطوير استراتيجية المشروع على المدى القصير والطويل.|ضمان توافق خارطة طريق المنتج مع رؤية المشروع.|قيادة جهود جمع التمويل وإدارة الشؤون المالية.'],
      ['exp-wikilogia',4,'Managing Member','عضو إداري','Wikilogia','ويكيولوجيا','https://www.wikilogia.org','2011 — 2019','2011 — 2019','A collaboration platform for Syrian students and professionals offering lectures and hackathons.','منصة تعاونية للطلاب والمهنيين السوريين تقدّم محاضرات وهاكاثونات متنوعة.','Design educational programs for youth, women, and children.|Develop scientific content, lecture, and train in workshops.|Coordinate UN agency initiatives: Wikilogia Hackathon (UNFPA) and Innovation Lab (UNDP).','تصميم برامج تعليمية للشباب والنساء والأطفال وتطوير محتوى علمي.|تنسيق مبادرات وكالات الأمم المتحدة: هاكاثون (UNFPA) ومختبر الابتكار (UNDP).'],
      ['exp-innovationlab',5,'Program Coordinator','منسق برنامج','Damascus Innovation Lab','مختبر الابتكار بدمشق','https://www.innovationlabsy.org','Jul — Nov 2019','يوليو — ديسمبر 2019','A UNDP–Wikilogia program offering youth-led projects a co-working space, training, guidance, and equipment.','برنامج مشترك بين UNDP وويكيولوجيا يوفّر للمشاريع الشبابية مساحة عمل وتدريبًا وإرشادًا ومعدات.','Coordinate and supervise the day-to-day activities of program staff and participants.|Monitor program activities and submit monthly reports to UNDP Syria.|Lead market assessment and context analysis studies.','تنسيق والإشراف على الأنشطة اليومية للفريق والمشاركين.|متابعة الأنشطة وتقديم تقارير شهرية إلى UNDP.|قيادة دراسات تقييم السوق وتحليل السياق.'],
      ['exp-iecd',6,'Entrepreneurship Trainer & Mentor','مدرب ومرشد ريادة أعمال','IECD Syria','IECD سوريا','https://www.iecd.org','2018 — 2019','2018 — 2019','Worked with future entrepreneurs through the BRIDGES program, supporting Syrian youth aged 16–24.','عملت مع رواد الأعمال من خلال برنامج BRIDGES الذي يدعم الشباب السوريين بين 16 و24 عامًا.','Co-develop training material, exercises, and deliverables.|Facilitate business training for individuals with startup ideas and SMEs.|Provide continuous feedback on participants\' progress.','المساهمة في تطوير المواد التدريبية والتمارين.|تسهيل التدريب التجاري لأصحاب الأفكار والمشاريع الصغيرة.|تقديم ملاحظات مستمرة حول التقدم.'],
      ['exp-icti',7,'Organizer & Trainer','منظم ومدرب','ICTI Entrepreneurship Program','برنامج ريادة الأعمال لحاضنة تقانة المعلومات ICTI','https://www.ti-scs.org','2015 — 2018','2015 — 2018','The first Syrian tech-startup incubator, providing youth with entrepreneurship boot camps.','أول حاضنة مشاريع تقنية ناشئة في سوريا تقدّم معسكرات تدريبية للشباب.','Design multiple business-training and startup-education programs.|Train and supervise participants as they advance their projects.|Coordinate logistics and plan events.','تصميم برامج تدريبية متعددة في ريادة الأعمال.|تدريب المشاركين والإشراف عليهم.|تنسيق اللوجستيات والتخطيط للفعاليات.']
    ],
    Education: [
      ['edu-ucl',1,'MA in Education & Technology','ماجستير في التعليم والتكنولوجيا','University College London (UCL), UK','كلية لندن الجامعية UCL، بريطانيا','2019 — 2022'],
      ['edu-svu',2,'Postgraduate Diploma in Education','دبلوم التأهيل التربوي','Syrian Virtual University, Syria','الجامعة الافتراضية السورية','2019 — 2021'],
      ['edu-damascus',3,'BS in Computer Engineering','بكالوريوس في هندسة الحواسيب','Damascus University, Syria','جامعة دمشق، سوريا','2011 — 2016']
    ],
    Awards: [
      ['aw-1',1,'Smart Toys Awards — Finalist','التأهل إلى المرحلة النهائية في جائزة الألعاب الذكية','UAE Center for 4th Industrial Revolution','مركز الإمارات للثورة الصناعية الرابعة','https://www.c4ir.ae','2022','Business','أعمال'],
      ['aw-2',2,'Best Arab Digital Content','جائزة أفضل محتوى رقمي عربي','WSA Digital Innovation Forum','منتدى الابتكار الرقمي — جوائز القمة العالمية','https://www.worldsummitawards.org','2019','Business','أعمال'],
      ['aw-3',3,'Top 100 Arab Startups — 4th Industrial Revolution','أفضل 100 شركة عربية ناشئة','World Economic Forum','المنتدى الاقتصادي العالمي','https://www.weforum.org','2019','Business','أعمال'],
      ['aw-4',4,'European Youth Award','جائزة الشباب الأوروبية','European Youth Award','جائزة الشباب الأوروبية','https://www.eu-youthaward.org','2017','Business','أعمال'],
      ['aw-5',5,'Top 100 Arab Startups — 4th Industrial Revolution','أفضل 100 شركة عربية ناشئة','World Economic Forum','المنتدى الاقتصادي العالمي','https://www.weforum.org','2017','Business','أعمال'],
      ['aw-6',6,'Bridges Project Fund','تمويل مشروع جسور','IECD & UNICEF Syria','المعهد الأوروبي للتعاون والتنمية واليونيسف','https://www.iecd-bridges.org','2017','Business','أعمال'],
      ['aw-7',7,'Impact Startup Sprint — 3rd Place','سباق المشاريع ذات الأثر — المركز الثالث','Elevate','Elevate','https://www.elevatemena.com','2017','Business','أعمال'],
      ['aw-8',8,'GIST Tech-I — Finalist','التأهل إلى نهائيات GIST Tech-I','GIST Network','شبكة GIST','https://www.gistnetwork.org','2016','Business','أعمال'],
      ['aw-9',9,'The Saïd Foundation Scholarship','منحة مؤسسة سعيد','The Saïd Foundation','مؤسسة سعيد','https://www.saidfoundation.org','2019','Personal','شخصي'],
      ['aw-10',10,'World Summit Award Ambassador','سفيرة جوائز القمة العالمية','World Summit Awards','جوائز القمة العالمية','https://www.worldsummitawards.org/youth-ambassadors','2019','Personal','شخصي'],
      ['aw-11',11,'European Youth Award Ambassador','سفيرة جائزة الشباب الأوروبية','European Youth Award','جائزة الشباب الأوروبية','https://eu-youthaward.org/ambassadors-2019','2018','Personal','شخصي'],
      ['aw-12',12,'Global Entrepreneurship Summit — Delegate','مندوبة في القمة العالمية لريادة الأعمال','GES 2016','GES 2016','https://www.ges2016.org','2016','Personal','شخصي']
    ],
    Training: [
      ['tr-pmp',1,'Project Management Professional (PMP)® Certification','شهادة محترف إدارة المشاريع (PMP)®','Venture International Group (VIG) — Online','مجموعة Venture International — عبر الإنترنت','2025'],
      ['tr-shai',2,'Expert Data Analyst Track','مسار خبير في تحليل البيانات','SHAI for AI, Amman, Jordan','مؤسسة SHAI للذكاء الاصطناعي، عمّان','2024'],
      ['tr-wip',3,'UNDP WIP 3 — Women Innovator Program','برنامج الأمم المتحدة للمبتكرات WIP 3','4YFN, Barcelona, Spain','مؤتمر 4YFN، برشلونة','2023'],
      ['tr-ttt',4,'Train the Trainer Workshop','ورشة تدريب المدربين','Venture International, Damascus','مؤسسة Venture International، دمشق','2017'],
      ['tr-yc',5,'Startup School Online — Founder Track','مدرسة الشركات الناشئة — مسار المؤسسين','Y Combinator — Online','حاضنة Y Combinator — عبر الإنترنت','2017'],
      ['tr-jusoor',6,'Entrepreneurship Bootcamp','المعسكر التدريبي لريادة الأعمال','Jusoor / Oasis 500, Beirut','جسور / Oasis 500، بيروت','2015']
    ],
    Publications: [
      ['pub-1',1,'Empowering Educators, Inspiring Innovators','تمكين المعلّمين وإلهام المبتكرين','White paper on problem-solving training using Design Thinking and Micro:bit.','ورقة بيضاء حول التدريب على حل المشكلات باستخدام التفكير التصميمي وMicro:bit.','Kids & Codes','مؤسسة Kids & Codes','June 2023','حزيران 2023',''],
      ['pub-2',2,'Fostering Agripreneurship in Oman','تعزيز ريادة الأعمال الزراعية في عُمان','Policy study report on agricultural entrepreneurship.','تقرير دراسة السياسات حول ريادة الأعمال الزراعية.','Green Mawared','Green Mawared','September 2024','أيلول 2024','']
    ],
    Skills: [
      ['sk-mgmt',1,'Management','المهارات الإدارية','Planning|Decision-making|Project management|Business development|Market research|Business intelligence|Budgeting|Proposal writing|Volunteer management|Training|Consulting|Reporting','التخطيط|اتخاذ القرار|إدارة المشاريع|تطوير الأعمال|بحوث السوق|ذكاء الأعمال|إعداد الموازنات|صياغة المقترحات|إدارة المتطوعين|التدريب|الاستشارات|إعداد التقارير'],
      ['sk-research',2,'Research & Instructional Design','البحث والتصميم التعليمي','Research question design|Data collection & analysis|Experiment design|Design thinking|Curriculum design|Instructional design|Content development|Learning theories|Adaptive learning design','صياغة الأسئلة البحثية|جمع البيانات وتحليلها|تصميم التجارب|التفكير التصميمي|تصميم المناهج|التصميم التعليمي|تطوير المحتوى|نظريات التعلّم|تصميم التعلّم التكيفي'],
      ['sk-tech',3,'Technology','المهارات التقنية','Microsoft Office|Notion|Digital learning platforms|Programming|Hardware & electronics development','Microsoft Office|منصة Notion|منصات التعلّم الرقمية|البرمجة|تطوير الأجهزة والإلكترونيات'],
      ['sk-soft',4,'Leadership & Soft Skills','المهارات الشخصية والقيادية','Leadership|Proactivity|Problem-solving|Communication|Teamwork|Negotiation|Self-discipline|Multitasking|Public speaking|Presentation|Storytelling|Adaptive & life-long learning','القيادة|المبادرة|حل المشكلات|التواصل|العمل الجماعي|التفاوض|الانضباط الذاتي|تعدد المهام|التحدث أمام الجمهور|مهارات العرض|السرد القصصي|التعلّم مدى الحياة']
    ],
    News: [
      ['news-1',1,'Joined Molham Team as Senior Education Program Officer','الانضمام إلى فريق ملهم كمسؤولة أولى لبرنامج التعليم','Leading and scaling education programs for displaced communities.','قيادة وتوسيع برامج التعليم للمجتمعات النازحة.','2025-01-01','https://www.molhamteam.com','TRUE'],
      ['news-2',2,'Elected Board Member, Syrian Engineers Association','انتخابها عضوًا في مجلس إدارة نقابة المهندسين السوريين','Contributing to digital transformation at the Damascus branch.','المساهمة في التحول الرقمي في فرع دمشق.','2025-02-01','https://www.osea.org.sy','TRUE'],
      ['news-3',3,'Earned PMP® Certification','الحصول على شهادة PMP®','Completed the Project Management Professional certification.','إتمام شهادة محترف إدارة المشاريع.','2025-03-01','','TRUE']
    ],
    Gallery: [
      ['g-1',1,'Barcelona · 4YFN — UNDP Women Innovator Program','برشلونة · 4YFN','','Representing the region at the UNDP WIP 3 program.','تمثيل المنطقة في برنامج WIP 3.','TRUE'],
      ['g-2',2,'Daraty — Interactive Circuits Kit','دارتي — مجموعة الدارات التفاعلية','','Teaching children the basics of electronics through play.','تعليم الأطفال أساسيات الإلكترونيات عبر اللعب.','TRUE'],
      ['g-3',3,'Damascus Innovation Lab','مختبر الابتكار بدمشق','','Supporting youth-led social-impact ventures with UNDP.','دعم المشاريع الشبابية مع UNDP.','TRUE']
    ],
    Social: [
      ['so-email',1,'Email','sana.haw@gmail.com','mailto:sana.haw@gmail.com','mail'],
      ['so-phone',2,'Phone','+963 937 699 037','tel:+963937699037','phone'],
      ['so-web',3,'Website','sanahawasly.com','https://www.sanahawasly.com','globe'],
      ['so-linkedin',4,'LinkedIn','Sana Hawasly','https://www.linkedin.com/in/sanahawasly','linkedin']
    ],
    References: [
      ['ref-1',1,'Ms. Fadwa Murad','السيدة فدوى مراد','Former Director, ICT Incubator','المديرة السابقة لحاضنة تقانة المعلومات','fadwa.murad@gmail.com'],
      ['ref-2',2,'Mr. Al Amjad Tawfiq Isstaif','السيد الأمجد توفيق اصطيف','Main Coordinator, Wikilogia','المنسق الرئيسي في ويكيولوجيا','isstaif@gmail.com']
    ]
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(seed).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var rows = seed[name];
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  });
}
