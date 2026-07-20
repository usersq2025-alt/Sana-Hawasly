/* ============================================================
   Sana Hawasly — Site application
   - Fetches content from Google Apps Script API (Sheets CMS)
   - Falls back to local data/content.json for offline/dev
   - Renders every section from data (no hardcoded content)
   - Bilingual EN/AR with RTL handling
   ============================================================ */

(() => {
  "use strict";

  /* -------- CONFIG -------- */
  // Paste your deployed Apps Script Web App URL here.
  // Leave as-is (empty) to use the bundled local JSON during development.
  const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbwfJynEnO7uevZGDR4LdtiDcEhT6BGnbHe6VXIz-D-R0c-j4KQ2JshARV-ca5_mucDu/exec", // e.g. "https://script.google.com/macros/s/AKfy...XXXX/exec"
    LOCAL_FALLBACK: "data/content.json",
    CACHE_KEY: "sana_cms_cache_v1",
    CACHE_TTL_MS: 1000 * 60 * 30, // 30 min client cache
  };

  /* -------- i18n dictionary (UI chrome only; content comes from CMS) -------- */
  const UI = {
    en: {
      nav_about: "About", nav_experience: "Experience", nav_education: "Education",
      nav_awards: "Awards", nav_publications: "Writing", nav_news: "News",
      nav_gallery: "Gallery", nav_contact: "Contact",
      idx_about: "01", idx_exp: "02", idx_edu: "03", idx_awards: "04",
      idx_training: "05", idx_skills: "06", idx_pubs: "07", idx_news: "08",
      idx_gallery: "09", idx_contact: "10",
      t_about: "About", t_exp: "Experience", t_edu: "Education", t_awards: "Awards & Honors",
      t_training: "Training & Certification", t_skills: "Skills", t_pubs: "Writing & Research",
      t_news: "News", t_gallery: "Gallery", t_contact: "Get in touch",
      cta_contact: "Get in touch", cta_cv: "Download CV",
      awards_all: "All", awards_business: "Business", awards_personal: "Personal",
      loading: "Loading…", error: "Content could not be loaded. Showing the latest saved copy.",
      empty: "Nothing here yet.",
      refs: "References available on request.",
      view: "Visit", contact_lead_a: "Open to collaborations in", contact_lead_b: "education technology, humanitarian programs, and youth entrepreneurship.",
      rights: "All rights reserved.",
    },
    ar: {
      nav_about: "نبذة", nav_experience: "الخبرات", nav_education: "التعليم",
      nav_awards: "الجوائز", nav_publications: "الكتابات", nav_news: "الأخبار",
      nav_gallery: "المعرض", nav_contact: "تواصل",
      idx_about: "٠١", idx_exp: "٠٢", idx_edu: "٠٣", idx_awards: "٠٤",
      idx_training: "٠٥", idx_skills: "٠٦", idx_pubs: "٠٧", idx_news: "٠٨",
      idx_gallery: "٠٩", idx_contact: "١٠",
      t_about: "نبذة", t_exp: "الخبرات العملية", t_edu: "التعليم الأكاديمي", t_awards: "الجوائز والتكريمات",
      t_training: "الدورات والشهادات", t_skills: "المهارات", t_pubs: "الكتابات والأبحاث",
      t_news: "الأخبار", t_gallery: "المعرض", t_contact: "لنتواصل",
      cta_contact: "تواصلي معي", cta_cv: "تحميل السيرة الذاتية",
      awards_all: "الكل", awards_business: "أعمال", awards_personal: "شخصية",
      loading: "جارٍ التحميل…", error: "تعذّر تحميل المحتوى. يتم عرض آخر نسخة محفوظة.",
      empty: "لا يوجد محتوى بعد.",
      refs: "المراجع المهنية متاحة عند الطلب.",
      view: "زيارة", contact_lead_a: "منفتحة على التعاون في", contact_lead_b: "تكنولوجيا التعليم والبرامج الإنسانية وريادة أعمال الشباب.",
      rights: "جميع الحقوق محفوظة.",
    }
  };

  /* -------- State -------- */
  let DATA = null;
  let LANG = (localStorage.getItem("sana_lang") || document.documentElement.getAttribute("lang") || "en").toLowerCase();
  if (LANG !== "ar" && LANG !== "en") LANG = "en";

  /* -------- Tiny helpers -------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (str = "") => String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (k) => (UI[LANG] && UI[LANG][k]) || UI.en[k] || k;
  const pick = (obj, base) => LANG === "ar" ? (obj[base + "_ar"] || obj[base + "_en"] || "") : (obj[base + "_en"] || obj[base + "_ar"] || "");
  const splitList = (s) => (s ? String(s).split("|").map(x => x.trim()).filter(Boolean) : []);

  /* SVG icon set */
  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.2 12.2 7 22l5-3 5 3-1.2-9.8"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M18 3v18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>',
  };
  const iconFor = (name) => ICON[name] || ICON.globe;

  /* Decorative circuit SVG generator */
  function circuitSVG(w = 400, h = 500, seed = 1) {
    let r = seed * 9301 + 49297;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    let paths = "", nodes = "";
    const cols = 6, rows = 8;
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(rnd() * cols) * (w / cols) + 20;
      const y = Math.floor(rnd() * rows) * (h / rows) + 20;
      const horiz = rnd() > .5;
      const len = (horiz ? w / cols : h / rows) * (1 + Math.floor(rnd() * 2));
      const x2 = horiz ? Math.min(x + len, w - 10) : x;
      const y2 = horiz ? y : Math.min(y + len, h - 10);
      paths += `<path d="M${x} ${y} L${x2} ${y2}" />`;
      nodes += `<circle cx="${x}" cy="${y}" r="${2 + rnd() * 2}" />`;
      if (rnd() > .5) nodes += `<circle cx="${x2}" cy="${y2}" r="2.5" class="hot"/>`;
    }
    return `<svg class="circuit-svg" viewBox="0 0 ${w} ${h}" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="rgba(192,138,62,.55)" stroke-width="1.2">${paths}</g>
      <g fill="rgba(247,244,236,.6)">${nodes}</g>
      <style>.hot{fill:#2f9c8d}</style>
    </svg>`;
  }

  /* ============================================================
     DATA LAYER
     ============================================================ */
  async function loadData() {
    // 1) client cache
    try {
      const cached = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || "null");
      if (cached && (Date.now() - cached.ts) < CONFIG.CACHE_TTL_MS && cached.data) {
        DATA = cached.data;
        renderAll();
        refreshInBackground(); // still refresh silently
        return;
      }
    } catch (_) {}

    // 2) live fetch (API if configured, else local JSON)
    try {
      DATA = await fetchLive();
      cacheData(DATA);
      renderAll();
    } catch (err) {
      console.warn("Live fetch failed:", err);
      // 3) stale cache as last resort
      const cached = safeCache();
      if (cached) { DATA = cached; renderAll(true); }
      else {
        try { DATA = await fetchJSON(CONFIG.LOCAL_FALLBACK); cacheData(DATA); renderAll(); }
        catch (e2) { showFatal(); }
      }
    }
  }

  async function fetchLive() {
    if (CONFIG.API_URL) {
      const res = await fetch(CONFIG.API_URL, { redirect: "follow" });
      if (!res.ok) throw new Error("API " + res.status);
      const json = await res.json();
      // Apps Script returns { ok, data } — unwrap if needed
      return json && json.data ? json.data : json;
    }
    return fetchJSON(CONFIG.LOCAL_FALLBACK);
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function cacheData(data) {
    try { localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
  }
  function safeCache() {
    try { const c = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || "null"); return c && c.data; }
    catch (_) { return null; }
  }
  async function refreshInBackground() {
    try { const fresh = await fetchLive(); cacheData(fresh); DATA = fresh; renderAll(); } catch (_) {}
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function renderAll(stale = false) {
    if (!DATA) return;
    // First-time visitors (no saved preference) follow the CMS default_lang.
    if (!localStorage.getItem("sana_lang")) {
      const def = String((DATA.Settings && DATA.Settings.default_lang) || "").toLowerCase();
      if (def === "ar" || def === "en") LANG = def;
    }
    applyLang();
    renderSettings();
    renderAbout();
    renderExperience();
    renderEducation();
    renderAwards();
    renderTraining();
    renderSkills();
    renderPublications();
    renderNews();
    renderGallery();
    renderContact();
    renderFooter();
    if (stale) flagStale();
    initReveal();
    initScrollSpy();
  }

  const S = () => DATA.Settings || {};
  const arr = (k) => Array.isArray(DATA[k]) ? DATA[k].slice().sort((a,b)=>(+a.order||0)-(+b.order||0)) : [];

  function renderSettings() {
    const s = S();
    document.title = (LANG==="ar" ? (s.site_title_ar||s.site_title_en) : (s.site_title_en||s.site_title_ar)) + " — " + (LANG==="ar"?"الموقع الشخصي":"Personal Site");
    // brand
    $$(".js-brand").forEach(n => n.textContent = LANG==="ar" ? (s.site_title_ar||"") : (s.site_title_en||""));
    // CV button
    const cv = LANG==="ar" ? (s.cv_pdf_ar||s.cv_pdf_en) : (s.cv_pdf_en||s.cv_pdf_ar);
    $$(".js-cv").forEach(n => { if (cv) n.href = cv; });
  }

  function renderAbout() {
    const a = DATA.About || {}; const s = S();
    // hero
    const title = LANG==="ar" ? (s.site_title_ar||"") : (s.site_title_en||"");
    const parts = title.split(" ");
    const firstName = parts.shift() || title;
    const rest = parts.join(" ");
    $("#hero-name").innerHTML = `${esc(firstName)} <span class="accent">${esc(rest)}</span>`;
    $("#hero-role").textContent = pick(s, "role");
    $("#hero-tagline").textContent = pick(s, "tagline");
    $("#hero-loc").innerHTML = `${ICON.pin}<span>${esc(pick(s,"location"))}</span>`;
    $("#hero-mail").innerHTML = `${ICON.mail}<span>${esc(s.email||"")}</span>`;
    $("#hero-initials").textContent = initials(title);
    $("#portrait-role").textContent = pick(s, "role");

    // about body
    $("#about-lead").innerHTML = highlightLead(pick(a, "intro"));
    const stats = $("#about-stats"); stats.innerHTML = "";
    [1,2,3].forEach(i => {
      const num = LANG==="ar" ? a[`highlight_${i}_number_ar`] : a[`highlight_${i}_number_en`];
      const lab = LANG==="ar" ? a[`highlight_${i}_label_ar`] : a[`highlight_${i}_label_en`];
      if (!num && !lab) return;
      const c = el("div", "stat-card reveal");
      c.dataset.d = String(i);
      c.innerHTML = `<div class="stat-num">${esc(num||"")}</div><div class="stat-label">${esc(lab||"")}</div>`;
      stats.appendChild(c);
    });
  }

  function highlightLead(text) {
    // emphasize a couple of key terms subtly
    const terms = LANG==="ar" ? ["أنظمة تعلّم","الأثر الإنساني","UCL"] : ["learning systems","humanitarian impact","UCL"];
    let out = esc(text);
    terms.forEach(term => {
      out = out.replace(esc(term), `<span class="mark">${esc(term)}</span>`);
    });
    return out;
  }

  function renderExperience() {
    const box = $("#experience-list"); box.innerHTML = "";
    const items = arr("Experience");
    if (!items.length) return emptyInto(box);
    items.forEach((x, i) => {
      const points = splitList(LANG==="ar" ? x.points_ar : x.points_en)
        .map(p => `<li>${esc(p)}</li>`).join("");
      const summary = pick(x, "summary");
      const item = el("div", "exp-item reveal");
      item.dataset.d = String((i % 3) + 1);
      item.innerHTML = `
        <span class="exp-node"></span>
        <div class="exp-card">
          <div class="exp-top">
            <h3 class="exp-role">${esc(pick(x,"role"))}</h3>
            <span class="exp-period">${esc(LANG==="ar" ? (x.period_ar||x.period) : x.period)}</span>
          </div>
          <a class="exp-org" href="${esc(x.url||"#")}" target="_blank" rel="noopener">
            ${esc(pick(x,"org"))} ${x.url ? ICON.external : ""}
          </a>
          ${summary ? `<p class="exp-summary">${esc(summary)}</p>` : ""}
          <ul class="exp-points">${points}</ul>
        </div>`;
      box.appendChild(item);
    });
  }

  function renderEducation() {
    const box = $("#education-list"); box.innerHTML = "";
    const items = arr("Education");
    if (!items.length) return emptyInto(box);
    items.forEach((x, i) => {
      const c = el("div", "card edu-card reveal");
      c.dataset.d = String((i % 3) + 1);
      c.innerHTML = `
        <div class="edu-degree">${esc(pick(x,"degree"))}</div>
        <div class="edu-inst">${esc(pick(x,"institution"))}</div>
        <div class="edu-period">${esc(x.period||"")}</div>`;
      box.appendChild(c);
    });
  }

  function renderAwards() {
    const grid = $("#awards-grid");
    const items = arr("Awards");
    const filterBox = $("#awards-filter");
    let current = "all";

    const draw = () => {
      grid.innerHTML = "";
      const filtered = items.filter(x => {
        if (current === "all") return true;
        const type = (x.type_en || "").toLowerCase();
        return type === current;
      });
      if (!filtered.length) return emptyInto(grid);
      filtered.forEach((x, i) => {
        const c = el("div", "card award-card reveal");
        c.dataset.d = String((i % 3) + 1);
        c.innerHTML = `
          <div class="award-top">
            <span class="award-badge">${ICON.award}</span>
            <span class="award-year">${esc(x.year||"")}</span>
          </div>
          <h3 class="award-title">${esc(pick(x,"title"))}</h3>
          <div class="award-org">${esc(pick(x,"org"))}</div>
          <span class="award-tag">${esc(pick(x,"type"))}</span>`;
        if (x.url) { c.style.cursor = "pointer"; c.addEventListener("click", () => window.open(x.url, "_blank", "noopener")); }
        grid.appendChild(c);
      });
      initReveal();
    };

    filterBox.innerHTML = "";
    [["all", t("awards_all")], ["business", t("awards_business")], ["personal", t("awards_personal")]].forEach(([key, label], i) => {
      const b = el("button", "filter-btn" + (i===0?" active":""), esc(label));
      b.addEventListener("click", () => {
        current = key;
        $$(".filter-btn", filterBox).forEach(x => x.classList.remove("active"));
        b.classList.add("active"); draw();
      });
      filterBox.appendChild(b);
    });
    draw();
  }

  function renderTraining() {
    const box = $("#training-list"); box.innerHTML = "";
    const items = arr("Training");
    if (!items.length) return emptyInto(box);
    items.forEach(x => {
      const row = el("div", "training-row reveal");
      row.innerHTML = `
        <span class="training-year">${esc(x.year||"")}</span>
        <span class="training-title">${esc(pick(x,"title"))}</span>
        <span class="training-org">${esc(pick(x,"org"))}</span>`;
      box.appendChild(row);
    });
  }

  function renderSkills() {
    const box = $("#skills-grid"); box.innerHTML = "";
    const items = arr("Skills");
    if (!items.length) return emptyInto(box);
    items.forEach((x, i) => {
      const tags = splitList(LANG==="ar" ? x.items_ar : x.items_en)
        .map(s => `<span class="skill-tag">${esc(s)}</span>`).join("");
      const g = el("div", "skill-group reveal");
      g.dataset.d = String((i % 3) + 1);
      g.innerHTML = `<div class="skill-cat">${esc(pick(x,"category"))}</div><div class="skill-tags">${tags}</div>`;
      box.appendChild(g);
    });
  }

  function renderPublications() {
    const box = $("#publications-list"); box.innerHTML = "";
    const items = arr("Publications");
    if (!items.length) return emptyInto(box);
    items.forEach((x, i) => {
      const c = el("div", "card pub-card reveal");
      c.dataset.d = String((i % 2) + 1);
      const date = LANG==="ar" ? (x.date_ar||x.date_en) : (x.date_en||x.date_ar);
      c.innerHTML = `
        <span class="pub-icon">${ICON.book}</span>
        <div>
          <h3 class="pub-title">${esc(pick(x,"title"))}</h3>
          <p class="pub-desc">${esc(pick(x,"desc"))}</p>
          <div class="pub-meta">${esc(pick(x,"publisher"))} · ${esc(date||"")}</div>
        </div>`;
      if (x.url) { c.style.cursor="pointer"; c.addEventListener("click", ()=>window.open(x.url,"_blank","noopener")); }
      box.appendChild(c);
    });
  }

  function renderNews() {
    const sec = $("#news"); const box = $("#news-grid"); box.innerHTML = "";
    const items = arr("News").filter(x => String(x.published).toUpperCase() !== "FALSE")
      .sort((a,b)=> String(b.date||"").localeCompare(String(a.date||"")));
    if (!items.length) { sec.style.display = "none"; return; }
    sec.style.display = "";
    items.forEach((x, i) => {
      const c = el("article", "card news-card reveal");
      c.dataset.d = String((i % 3) + 1);
      c.innerHTML = `
        <div class="news-date">${esc(formatDate(x.date))}</div>
        <h3 class="news-title">${esc(pick(x,"title"))}</h3>
        <p class="news-body">${esc(pick(x,"body"))}</p>
        ${x.url ? `<a class="news-link" href="${esc(x.url)}" target="_blank" rel="noopener">${t("view")} ${ICON.arrow}</a>` : ""}`;
      box.appendChild(c);
    });
  }

  function renderGallery() {
    const sec = $("#gallery"); const box = $("#gallery-grid"); box.innerHTML = "";
    const items = arr("Gallery").filter(x => String(x.published).toUpperCase() !== "FALSE");
    if (!items.length) { sec.style.display = "none"; return; }
    sec.style.display = "";
    items.forEach((x, i) => {
      const c = el("figure", "gal-item reveal");
      c.dataset.d = String((i % 3) + 1);
      const img = x.image ? `<img src="${esc(x.image)}" alt="${esc(pick(x,"title"))}" loading="lazy">` : circuitSVG(400, 300, i + 3).replace('class="circuit-svg"','class="gal-circuit"');
      c.innerHTML = `${img}
        <figcaption class="gal-cap">
          <div class="gal-title">${esc(pick(x,"title"))}</div>
          <div class="gal-sub">${esc(pick(x,"caption"))}</div>
        </figcaption>`;
      box.appendChild(c);
    });
  }

  function renderContact() {
    const s = S();
    $("#contact-lead").innerHTML =
      `${esc(t("contact_lead_a"))} <span class="mark">${esc(t("contact_lead_b"))}</span>`;
    const box = $("#social-list"); box.innerHTML = "";
    arr("Social").forEach(x => {
      const a = el("a", "social-item");
      a.href = x.url || "#"; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `
        <span class="social-icon">${iconFor(x.icon)}</span>
        <span class="social-text">
          <span class="social-platform">${esc(x.platform||"")}</span>
          <span class="social-label">${esc(x.label||"")}</span>
        </span>`;
      box.appendChild(a);
    });
  }

  function renderFooter() {
    const s = S();
    $("#footer-brand-name").textContent = LANG==="ar" ? (s.site_title_ar||"") : (s.site_title_en||"");
    $("#footer-year").textContent = new Date().getFullYear();
    $("#footer-rights").textContent = t("rights");
    $("#footer-refs").textContent = t("refs");
  }

  /* ============================================================
     i18n / language switching
     ============================================================ */
  function applyLang() {
    const html = document.documentElement;
    html.setAttribute("lang", LANG);
    html.setAttribute("dir", LANG === "ar" ? "rtl" : "ltr");
    // static UI text nodes
    $$("[data-ui]").forEach(n => { n.textContent = t(n.dataset.ui); });
    // toggle button faces
    const on = $(".lang-toggle .on"), off = $(".lang-toggle .off");
    if (on && off) {
      if (LANG === "en") { on.textContent = "EN"; off.textContent = "ع"; }
      else { on.textContent = "ع"; off.textContent = "EN"; }
    }
  }

  function toggleLang() {
    LANG = LANG === "en" ? "ar" : "en";
    localStorage.setItem("sana_lang", LANG);
    renderAll();
    // keep scroll position roughly stable
  }

  /* ============================================================
     UI behaviors
     ============================================================ */
  function initHeader() {
    const header = $(".site-header");
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 20);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

    $(".nav-burger").addEventListener("click", () => document.body.classList.toggle("menu-open"));
    $$(".nav-links a").forEach(a => a.addEventListener("click", () => document.body.classList.remove("menu-open")));
    $(".lang-toggle").addEventListener("click", toggleLang);
  }

  let revealObs;
  function initReveal() {
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach(n => n.classList.add("in")); return; }
    if (!revealObs) {
      revealObs = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } });
      }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    }
    $$(".reveal:not(.in)").forEach(n => revealObs.observe(n));
  }

  function initScrollSpy() {
    const links = $$(".nav-links a[data-section]");
    const map = new Map(links.map(l => [l.dataset.section, l]));
    const sections = $$("section[id]").filter(s => map.has(s.id));
    if (!("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove("active"));
          const link = map.get(e.target.id); if (link) link.classList.add("active");
        }
      });
    }, { threshold: .3, rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(s => obs.observe(s));
  }

  /* ============================================================
     Utilities
     ============================================================ */
  function initials(name) {
    return (name || "").trim().split(/\s+/).slice(0,2).map(w => w[0] || "").join("").toUpperCase();
  }
  function formatDate(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString(LANG === "ar" ? "ar" : "en", { year: "numeric", month: "long" });
  }
  function emptyInto(node) { node.innerHTML = `<div class="data-state">${esc(t("empty"))}</div>`; }
  function showFatal() {
    $$(".js-datazone").forEach(z => z.innerHTML = `<div class="data-state error">${esc(t("error"))}</div>`);
  }
  function flagStale() {
    const b = $("#stale-banner");
    if (b) { b.textContent = t("error"); b.hidden = false; setTimeout(() => b.hidden = true, 6000); }
  }

  /* Boot */
  function boot() {
    // Inject decorative circuits
    const p = $("#portrait-circuit"); if (p) p.innerHTML = circuitSVG(400, 500, 7);
    const cbg = $("#contact-circuit"); if (cbg) cbg.innerHTML = circuitSVG(1200, 500, 4).replace('class="circuit-svg"','class="circuit-bg-svg"');
    initHeader();
    loadData();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
