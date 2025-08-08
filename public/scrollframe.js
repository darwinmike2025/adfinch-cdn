(async () => {
  try {
    console.log("[ScrollFrame v2] boot");

    const currentScript = document.currentScript;
    const ds = currentScript?.dataset || {};
    const position = (ds.position || "popup").toLowerCase();

    // Support both new (embedId) and legacy (unitId)
    const idValue = ds.embedId || ds.unitId || "";
    const idKey = ds.embedId ? "embedId" : (ds.unitId ? "unitId" : null);

    if (!idKey || !idValue) {
      console.error("[ScrollFrame v2] No data-embed-id or data-unit-id found on script tag");
      // Visible inline error so it's obvious in tests
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = `
        color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; padding: 12px;
        border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; margin: 10px 0; max-width: 420px;`;
      errorDiv.textContent = "❌ ScrollFrame: missing data-embed-id or data-unit-id";
      currentScript?.parentNode?.insertBefore(errorDiv, currentScript.nextSibling);
      return;
    }

    // Fetch config with timeout
    let config;
    let slides = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(
        `https://mynqhurabkihzyqweyet.supabase.co/functions/v1/scrollframe-fetch?${idKey}=${encodeURIComponent(idValue)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();
      if (!data?.success) throw new Error(data?.error || "Config fetch unsuccessful");
      config = data.config || {};

      // Normalize slides
      if (Array.isArray(config.slides)) {
        slides = config.slides
          .map((s) => ({
            headline: s.headline || "",
            subheadline: s.subheadline || "",
            body: s.body || "",
            imageUrl: s.imageUrl || "",
            destinationUrl: s.destinationUrl || "",
            ctaText: s.ctaText || "Learn More",
          }))
          .filter((s) => s.headline);
      } else if (config.headline) {
        slides = [
          {
            headline: config.headline,
            subheadline: config.subheadline || "",
            body: config.body || "",
            imageUrl: config.imageUrl || "",
            destinationUrl: config.destinationUrl || "",
            ctaText: config.ctaText || "Learn More",
          },
        ];
      }
    } catch (err) {
      console.error("[ScrollFrame v2] fetch error:", err?.message || err);
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = `
        color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; padding: 12px;
        border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px; margin: 10px 0; max-width: 420px;`;
      errorDiv.textContent = "❌ ScrollFrame: fetch failed (timeout or CORS)";
      currentScript?.parentNode?.insertBefore(errorDiv, currentScript.nextSibling);
      return;
    }

    if (!slides.length) {
      console.error("[ScrollFrame v2] No valid slides");
      return;
    }

    // Styles injection (idempotent)
    const styleId = "adf-scrollframe-css";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .adf-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 2147483646; display: grid; place-items: center; padding: 20px; }
        .adf-modal { width: clamp(320px, 90vw, 900px); height: clamp(480px, 80vh, 720px); background: #fff; color: #0f172a; border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,.35); display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif; }
        .adf-header { background: linear-gradient(135deg, #10b981, #059669); color: #fff; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
        .adf-title { font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 8px; }
        .adf-close { background: transparent; border: none; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
        .adf-frame { position: relative; overflow: visible; height: 100%; display: grid; }
        .adf-content { overflow: auto; padding: 16px 20px; scrollbar-width: thin; scrollbar-color: rgba(17,24,39,.3) transparent; }
        .adf-content::-webkit-scrollbar { width: 8px; height: 8px; }
        .adf-content::-webkit-scrollbar-track { background: transparent; }
        .adf-content::-webkit-scrollbar-thumb { background: rgba(17,24,39,.3); border-radius: 999px; }
        .adf-footer { height: 56px; display: grid; place-items: center; border-top: 1px solid #e5e7eb; }
        .adf-dots { display: flex; gap: 8px; align-items: center; justify-content: center; }
        .adf-dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; border: none; cursor: pointer; }
        .adf-dot.is-active { background: #10b981; }
        .adf-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 999px; border: 1px solid #e5e7eb; background: #fff; color: #111827; display: grid; place-items: center; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.12); }
        .adf-prev { left: -20px; }
        .adf-next { right: -20px; }
        .adf-arrow[disabled] { opacity: .5; cursor: not-allowed; }
        .adf-slide { display: none; height: 100%; }
        .adf-slide.is-active { display: block; }
        .adf-media { width: 100%; aspect-ratio: 16/10; background: #f3f4f6; border-radius: 12px; overflow: hidden; }
        .adf-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .adf-stack { padding-top: 14px; }
        .adf-headline { margin: 0 0 8px 0; font-size: 20px; line-height: 1.3; font-weight: 700; color: #0f172a; }
        .adf-subheadline { margin: 0 0 12px 0; font-size: 16px; line-height: 1.35; color: #334155; font-weight: 600; }
        .adf-cta { margin-top: 16px; display: inline-block; padding: 12px 18px; border-radius: 10px; background: #10b981; color: #fff; text-decoration: none; font-weight: 600; }
        /* Markdown typography */
        .adf-content .adf-md { font-size: 16px; line-height: 1.6; color: #1f2937; }
        .adf-content .adf-md h1 { font-size: clamp(24px, 2.2vw, 28px); margin: 0 0 10px 0; line-height: 1.25; }
        .adf-content .adf-md h2 { font-size: clamp(20px, 2vw, 22px); margin: 16px 0 8px 0; line-height: 1.3; }
        .adf-content .adf-md h3 { font-size: clamp(18px, 1.8vw, 20px); margin: 14px 0 6px 0; line-height: 1.35; }
        .adf-content .adf-md p { margin: 0 0 12px 0; }
        .adf-content .adf-md ul, .adf-content .adf-md ol { margin: 0 0 12px 20px; }
        .adf-content .adf-md li { margin: 6px 0; }
        .adf-content .adf-md a { color: #059669; text-decoration: underline; }
        .adf-content .adf-md blockquote { margin: 12px 0; padding: 10px 14px; border-left: 3px solid #10b981; color: #475569; background: #f8fafc; border-radius: 6px; }
        .adf-content .adf-md img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 8px; }
        /* Popup placement */
        .adf-popup { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; }
        .adf-inline { position: relative; margin: 20px auto; }
      `;
      document.head.appendChild(style);
    }

    const primaryColor = (config?.styling_theme?.primary && typeof config.styling_theme.primary === 'string')
      ? config.styling_theme.primary
      : '#10b981';

    // header gradient support (fallback to demo gradient for now)
    const headerGradient = (() => {
      const g = config?.header_config?.gradient;
      if (typeof g === 'string' && g.includes('to-') && g.includes('from-')) {
        return 'linear-gradient(135deg, #10b981, #059669)';
      }
      return 'linear-gradient(135deg, #10b981, #059669)';
    })();

    // Markdown -> HTML (lightweight). If it already looks like HTML, pass through.
    const markdownToHtml = (src = "") => {
      if (!src) return "";
      if (/<[a-z][\s\S]*>/i.test(src)) return src;
      let s = src;
      s = s.replace(/^###\s+(.+)$/gim, '<h3>$1</h3>');
      s = s.replace(/^##\s+(.+)$/gim, '<h2>$1</h2>');
      s = s.replace(/^#\s+(.+)$/gim, '<h1>$1</h1>');
      s = s.replace(/\*\*(.+?)\*\*/gim, '<strong>$1</strong>');
      s = s.replace(/\*(.+?)\*/gim, '<em>$1</em>');
      s = s.replace(/`([^`]+)`/gim, '<code>$1</code>');
      s = s.replace(/^>\s+(.+)$/gim, '<blockquote>$1</blockquote>');
      // lists (basic)
      s = s.replace(/^(\s*)-\s+(.+)$/gim, '$1<li>$2</li>');
      s = s.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');
      // links
      s = s.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // paragraphs
      s = s
        .split(/\n{2,}/)
        .map((block) => (block.match(/^\s*<(h\d|ul|ol|blockquote|img|p|pre|code|table|li|ul|ol)/i) ? block : `<p>${block.trim()}</p>`))
        .join("");
      return s;
    };

    // Helpers
    const makeArrow = (cls, label, char) => {
      const btn = document.createElement("button");
      btn.className = `adf-arrow ${cls}`;
      btn.setAttribute("aria-label", label);
      btn.innerHTML = char;
      return btn;
    };

    const makeDots = (count) => {
      const wrap = document.createElement("div");
      wrap.className = "adf-dots";
      const dots = [];
      for (let i = 0; i < count; i++) {
        const d = document.createElement("button");
        d.className = "adf-dot";
        if (i === 0) d.classList.add("is-active");
        d.setAttribute("aria-label", `Go to slide ${i + 1}`);
        d.addEventListener("click", () => goToSlide(i));
        wrap.appendChild(d);
        dots.push(d);
      }
      return { wrap, dots };
    };

    // Build chrome
    let overlayEl = null;
    let rootEl = null;

    const headerEl = document.createElement("div");
    headerEl.className = "adf-header";
    headerEl.style.background = headerGradient;
    const titleEl = document.createElement("div");
    titleEl.className = "adf-title";
    titleEl.innerHTML = `${config.header_config?.icon === 'TrendingUp' ? '📈' : config.header_config?.icon === 'Wine' ? '🍷' : config.header_config?.icon === 'Heart' ? '💖' : '📈'} <span>${config.header_config?.title || 'Sponsored Content'}</span>`;
    const closeEl = document.createElement("button");
    closeEl.className = "adf-close";
    closeEl.setAttribute("aria-label", "Close modal");
    closeEl.textContent = "×";
    headerEl.appendChild(titleEl);
    headerEl.appendChild(closeEl);

    const frameEl = document.createElement("div");
    frameEl.className = "adf-frame";

    const contentEl = document.createElement("div");
    contentEl.className = "adf-content";

    // Slides
    const slideEls = slides.map((s, idx) => {
      const slide = document.createElement("div");
      slide.className = `adf-slide${idx === 0 ? " is-active" : ""}`;

      const parts = [];
      if (s.imageUrl) {
        parts.push(`<div class="adf-media"><img src="${s.imageUrl}" alt="${(s.headline || "").replace(/"/g, '&quot;')}" loading="lazy" /></div>`);
      }
      const bodyHtml = markdownToHtml(s.body || "");
      parts.push(`
        <div class="adf-stack">
          ${s.headline ? `<h2 class="adf-headline">${s.headline}</h2>` : ""}
          ${s.subheadline ? `<h3 class="adf-subheadline">${s.subheadline}</h3>` : ""}
          ${bodyHtml ? `<div class="adf-md">${bodyHtml}</div>` : ""}
          ${s.destinationUrl ? `<a class="adf-cta" href="${s.destinationUrl}" target="_blank" rel="noopener">${s.ctaText || 'Learn More'}</a>` : ''}
        </div>
      `);
      slide.innerHTML = parts.join("");
      return slide;
    });
    slideEls.forEach((el) => contentEl.appendChild(el));

    const prevBtn = makeArrow("adf-prev", "Previous", "‹");
    const nextBtn = makeArrow("adf-next", "Next", "›");

    frameEl.appendChild(prevBtn);
    frameEl.appendChild(contentEl);
    frameEl.appendChild(nextBtn);

    const footerEl = document.createElement("div");
    footerEl.className = "adf-footer";
    const { wrap: dotsWrap, dots } = makeDots(slides.length);
    footerEl.appendChild(dotsWrap);

    const modalEl = document.createElement("div");
    modalEl.className = "adf-modal";
    modalEl.appendChild(headerEl);
    modalEl.appendChild(frameEl);
    modalEl.appendChild(footerEl);

    // Close/focus handling
    const lastFocusedEl = document.activeElement;
    let originalOverflow = document.body.style.overflow;

    const closeAll = () => {
      if (overlayEl) overlayEl.remove();
      if (rootEl && rootEl.parentNode) rootEl.remove();
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      lastFocusedEl?.focus?.();
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") return closeAll();
      if (e.key === "ArrowLeft") return goToSlide(currentIndex - 1);
      if (e.key === "ArrowRight") return goToSlide(currentIndex + 1);
      if (overlayEl && e.key === 'Tab') {
        const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    // Touch swipe
    let touchStartX = 0, touchStartY = 0;
    frameEl.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      touchStartX = t.clientX; touchStartY = t.clientY;
    }, { passive: true });
    frameEl.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goToSlide(currentIndex + 1); else goToSlide(currentIndex - 1);
      }
    }, { passive: true });

    // Positioning
    if (position === "modal") {
      overlayEl = document.createElement("div");
      overlayEl.className = "adf-overlay";
      overlayEl.addEventListener("click", (e) => { if (e.target === overlayEl) closeAll(); });
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
      closeEl.addEventListener("click", closeAll);
      overlayEl.appendChild(modalEl);
      document.body.appendChild(overlayEl);
      setTimeout(() => (modalEl.querySelector("button, a") || modalEl).focus?.(), 0);
    } else if (position === "popup") {
      rootEl = document.createElement("div");
      rootEl.className = "adf-popup";
      closeEl.addEventListener("click", closeAll);
      rootEl.appendChild(modalEl);
      document.body.appendChild(rootEl);
      document.addEventListener("keydown", onKeyDown);
    } else { // inline
      rootEl = document.createElement("div");
      rootEl.className = "adf-inline";
      closeEl.addEventListener("click", closeAll);
      rootEl.appendChild(modalEl);
      const scriptTag = document.currentScript;
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(rootEl, scriptTag.nextSibling);
      } else {
        document.body.appendChild(rootEl);
      }
      document.addEventListener("keydown", onKeyDown);
    }

    // Navigation
    let currentIndex = 0;
    const setDisabledStates = () => {
      prevBtn.disabled = currentIndex <= 0;
      nextBtn.disabled = currentIndex >= slides.length - 1;
    };
    const updateDots = () => {
      dots.forEach((d, i) => d.classList.toggle("is-active", i === currentIndex));
    };
    const updateSlides = () => {
      slideEls.forEach((el, i) => {
        el.classList.toggle("is-active", i === currentIndex);
      });
      // reset internal scroll
      contentEl.scrollTop = 0;
    };
    const goToSlide = (idx) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, idx));
      if (clamped === currentIndex) return;
      currentIndex = clamped;
      updateSlides();
      updateDots();
      setDisabledStates();
    };

    prevBtn.addEventListener("click", () => goToSlide(currentIndex - 1));
    nextBtn.addEventListener("click", () => goToSlide(currentIndex + 1));

    // Initialize UI state
    setDisabledStates();
    updateDots();
    console.log(`[ScrollFrame v2] loaded ${slides.length} slide(s)`);
  } catch (err) {
    console.error("[ScrollFrame v2] error:", err);
  }
})();
