/* =========================================================
   Debian en tu bolsillo — comportamiento
   Vanilla JS, sin dependencias. Todo degrada bien sin JS.
   ========================================================= */
(() => {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado */ }
    }
  };

  /* ---------------------------------------------------------
     1. Tema claro / oscuro
     --------------------------------------------------------- */
  const THEME_KEY = "db:theme";
  const root = document.documentElement;
  const themeBtn = $("#themeBtn");
  const metaTheme = $('meta[name="theme-color"]');

  function applyTheme(theme, persist = true) {
    root.setAttribute("data-theme", theme);
    if (metaTheme) metaTheme.setAttribute("content", theme === "light" ? "#f7f8f7" : "#0b0f14");
    if (themeBtn) {
      const label = theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro";
      themeBtn.setAttribute("aria-label", label);
      themeBtn.setAttribute("title", label);
    }
    if (persist) store.set(THEME_KEY, theme);
  }

  const savedTheme = store.get(THEME_KEY);
  const preferLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(savedTheme || (preferLight ? "light" : "dark"), false);

  themeBtn?.addEventListener("click", () => {
    applyTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  /* ---------------------------------------------------------
     2. Copiar comandos
     --------------------------------------------------------- */
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback para file:// o navegadores viejos
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  $$(".cmd").forEach((cmd) => {
    const btn = $(".copy", cmd);
    const code = $("pre code", cmd);
    if (!btn || !code) return;

    btn.addEventListener("click", async () => {
      const text = code.innerText.replace(/\u00a0/g, " ");
      const ok = await copyText(text);
      const original = btn.textContent;
      btn.textContent = ok ? "¡Copiado!" : "No se pudo";
      btn.classList.toggle("is-copied", ok);
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("is-copied");
      }, 1600);
    });
  });

  /* ---------------------------------------------------------
     3. Progreso de las fases (localStorage)
     --------------------------------------------------------- */
  const PROGRESS_KEY = "db:progress";
  const checks = $$(".phase-check");
  const done = new Set((store.get(PROGRESS_KEY, []) || []).map(String));
  const bar = $("#progressBar");
  const label = $("#progressLabel");

  function paintProgress() {
    const total = checks.length || 1;
    const pct = Math.round((done.size / total) * 100);
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `${pct} %`;
    checks.forEach((input) => {
      const phase = input.dataset.phase;
      const isDone = done.has(phase);
      input.checked = isDone;
      input.closest(".phase")?.classList.toggle("is-done", isDone);
    });
  }

  checks.forEach((input) => {
    input.checked = done.has(input.dataset.phase);
    input.addEventListener("change", () => {
      const phase = input.dataset.phase;
      if (input.checked) done.add(phase); else done.delete(phase);
      store.set(PROGRESS_KEY, [...done]);
      paintProgress();
    });
  });

  paintProgress();

  $("#resetBtn")?.addEventListener("click", () => {
    if (!done.size) return;
    if (!window.confirm("¿Borrar las casillas marcadas? No afecta a tu instalación, solo al progreso de esta página.")) return;
    done.clear();
    store.set(PROGRESS_KEY, []);
    paintProgress();
  });

  /* ---------------------------------------------------------
     4. Scrollspy del índice
     --------------------------------------------------------- */
  const tocLinks = $$(".toc__list a");
  const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const sections = $$("main section[id]").filter((s) => byId.has(s.id));

  if ("IntersectionObserver" in window && sections.length) {
    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
        else visible.delete(e.target.id);
      });
      let best = null;
      let bestRatio = -1;
      visible.forEach((ratio, id) => {
        if (ratio > bestRatio) { bestRatio = ratio; best = id; }
      });
      // Si nada está visible, conservamos el último marcado (evita parpadeos).
      if (!best) return;
      tocLinks.forEach((a) => a.removeAttribute("aria-current"));
      byId.get(best)?.setAttribute("aria-current", "true");
    }, {
      rootMargin: "-15% 0px -55% 0px",
      threshold: [0.05, 0.25, 0.5, 0.75]
    });
    sections.forEach((s) => observer.observe(s));
  }

  /* ---------------------------------------------------------
     5. Barra de lectura
     --------------------------------------------------------- */
  const readBar = $("#readBar");
  let raf = 0;

  function updateReadBar() {
    raf = 0;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    if (readBar) readBar.style.width = `${pct}%`;
  }

  window.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(updateReadBar);
  }, { passive: true });
  window.addEventListener("resize", updateReadBar, { passive: true });
  updateReadBar();

  /* ---------------------------------------------------------
     6. Navegación móvil
     --------------------------------------------------------- */
  const navBtn = $("#navBtn");
  const sidebar = $("#sidebar");

  function setNav(open) {
    if (!sidebar || !navBtn) return;
    sidebar.classList.toggle("is-open", open);
    navBtn.setAttribute("aria-expanded", String(open));
  }

  navBtn?.addEventListener("click", () => {
    setNav(!sidebar.classList.contains("is-open"));
  });

  sidebar?.addEventListener("click", (e) => {
    if (e.target.closest("a")) setNav(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNav(false);
  });

  document.addEventListener("click", (e) => {
    if (!sidebar?.classList.contains("is-open")) return;
    if (sidebar.contains(e.target) || navBtn?.contains(e.target)) return;
    setNav(false);
  });

  /* ---------------------------------------------------------
     7. Botones con data-scroll
     --------------------------------------------------------- */
  $$("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.scroll.replace("#", ""));
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", btn.dataset.scroll);
    });
  });

  /* ---------------------------------------------------------
     8. Buscador de errores
     --------------------------------------------------------- */
  const errSearch = $("#errSearch");
  const errItems = $$("#errList .err");
  const errEmpty = $("#errEmpty");

  const normalize = (s) => s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  errItems.forEach((item) => {
    item.dataset.haystack = normalize(item.textContent || "");
  });

  errSearch?.addEventListener("input", () => {
    const q = normalize(errSearch.value.trim());
    let shown = 0;
    errItems.forEach((item) => {
      const match = !q || item.dataset.haystack.includes(q);
      item.hidden = !match;
      if (match) shown++;
      if (q && match) item.open = true;
      if (!q) item.open = false;
    });
    if (errEmpty) errEmpty.hidden = shown !== 0;
  });

  /* ---------------------------------------------------------
     9. Impresión y volver arriba
     --------------------------------------------------------- */
  $("#printBtn")?.addEventListener("click", () => window.print());
  $("#topBtn")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------------------------------------------------------
     10. Marcar el destino del ancla al cargar con hash
     --------------------------------------------------------- */
  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ block: "start" }), 40);
  }
})();
