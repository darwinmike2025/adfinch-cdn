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

    console.info('[ScrollFrame] slides', slides.length, { layout: config?.layout, hasBody: !!slides[0]?.body, bodyLength: slides[0]?.body?.length || 0, textColor: config?.styling_theme?.text, mode: 'embed', position });

    // Enhanced styles injection with comprehensive overrides
    const styleId = "adf-scrollframe-css";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .adf-overlay { 
          position: fixed !important; 
          inset: 0 !important; 
          background: rgba(0,0,0,.5) !important; 
          z-index: 2147483646 !important; 
          display: grid !important; 
          place-items: center !important; 
          padding: 20px !important; 
        }
        
        .adf-modal { 
          width: clamp(320px, 90vw, 900px) !important; 
          height: clamp(480px, 80vh, 720px) !important; 
          max-height: 90vh !important;
          background: #fff !important; 
          color: #0f172a !important; 
          border-radius: 16px !important; 
          box-shadow: 0 30px 80px rgba(0,0,0,.35) !important; 
          display: grid !important; 
          grid-template-rows: auto 1fr auto !important; 
          overflow: hidden !important; 
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif !important; 
        }
        
        .adf-header { 
          background: linear-gradient(135deg, #10b981, #059669) !important; 
          color: #fff !important; 
          height: 64px !important; 
          display: flex !important; 
          align-items: center !important; 
          justify-content: space-between !important; 
          padding: 0 20px !important; 
        }
        
        .adf-title { 
          font-weight: 600 !important; 
          font-size: 16px !important; 
          display: flex !important; 
          align-items: center !important; 
          gap: 8px !important; 
        }
        
        .adf-close { 
          background: transparent !important; 
          border: none !important; 
          color: #fff !important; 
          font-size: 22px !important; 
          cursor: pointer !important; 
          line-height: 1 !important; 
        }
        
        .adf-frame { 
          position: relative !important; 
          overflow: visible !important; 
          height: 100% !important; 
          display: grid !important; 
        }
        
        .adf-content { 
          overflow-y: auto !important; 
          max-height: calc(100vh - 200px) !important; 
          padding: 16px 20px !important; 
          scrollbar-width: thin !important; 
          scrollbar-color: rgba(17,24,39,.3) transparent !important; 
          color: #111827 !important;
          line-height: 1.6 !important;
        }
        
        .adf-content::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
        .adf-content::-webkit-scrollbar-track { background: transparent !important; }
        .adf-content::-webkit-scrollbar-thumb { background: rgba(17,24,39,.3) !important; border-radius: 999px !important; }
        
        .adf-footer { 
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 16px 20px !important;
          background: #f9fafb !important;
          border-top: 1px solid #e5e7eb !important;
        }
        
        .adf-dots { 
          display: flex !important; 
          gap: 8px !important; 
          align-items: center !important; 
          justify-content: center !important; 
        }
        
        .adf-dot { 
          width: 8px !important; 
          height: 8px !important; 
          border-radius: 50% !important; 
          background: #d1d5db !important; 
          border: none !important; 
          cursor: pointer !important; 
        }
        
        .adf-dot.is-active { background: #10b981 !important; }
        
        /* FIXED: Position arrows inside modal content area */
        .adf-arrow { 
          display: grid !important;
          place-items: center !important;
          position: absolute !important; 
          top: 50% !important; 
          transform: translateY(-50%) !important; 
          width: 40px !important; 
          height: 40px !important; 
          border-radius: 50% !important; 
          border: 2px solid #e5e7eb !important; 
          background: white !important; 
          color: #111827 !important; 
          cursor: pointer !important; 
          box-shadow: 0 6px 18px rgba(0,0,0,0.12) !important; 
          z-index: 1000 !important;
          font-size: 18px !important;
          font-weight: bold !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        .adf-arrow:hover {
          background: #f9fafb !important;
          border-color: #d1d5db !important;
          transform: translateY(-50%) scale(1.05) !important;
        }
        
        .adf-arrow:disabled {
          opacity: 0.4 !important;
          cursor: not-allowed !important;
        }
        
        /* FIXED: Position arrows inside the modal */
        .adf-prev { left: 20px !important; }
        .adf-next { right: 20px !important; }
        
        .adf-slide { display: none !important; height: 100% !important; }
        .adf-slide.is-active { display: block !important; }
        
        .adf-media { 
          width: 100% !important; 
          aspect-ratio: 16/10 !important; 
          background: #f3f4f6 !important; 
          border-radius: 12px !important; 
          overflow: hidden !important; 
        }
        
        .adf-media img { 
          width: 100% !important; 
          height: 100% !important; 
          object-fit: cover !important; 
          display: block !important; 
        }
        
        .adf-stack { padding-top: 14px !important; }
        
        .adf-headline { 
          margin: 0 0 8px 0 !important; 
          font-size: 20px !important; 
          line-height: 1.3 !important; 
          font-weight: 700 !important; 
          color: #0f172a !important; 
        }
        
        .adf-subheadline { 
          margin: 0 0 12px 0 !important; 
          font-size: 16px !important; 
          line-height: 1.35 !important; 
          color: #334155 !important; 
          font-weight: 600 !important; 
        }
        
        .adf-cta { 
          margin-top: 16px !important; 
          display: inline-block !important; 
          padding: 12px 18px !important; 
          border-radius: 10px !important; 
          background: #10b981 !important; 
          color: #fff !important; 
          text-decoration: none !important; 
          font-weight: 600 !important; 
        }
        
        /* Enhanced body text visibility with comprehensive overrides */
        .adf-content, 
        .adf-content p, 
        .adf-content .adf-body { 
          color: #111827 !important; 
          line-height: 1.6 !important; 
          font-size: 16px !important; 
        }
        
        .adf-content .adf-body { color: #1f2937 !important; }
        .adf-content .adf-body h1, 
        .adf-content .adf-body h2, 
        .adf-content .adf-body h3 { color: #111827 !important; }
        .adf-content .adf-body p { color: #374151 !important; margin-bottom: 12px !important; }
        .adf-content .adf-body strong { color: #111827 !important; }
        .adf-content .adf-body em { color: #4b5563 !important; }
        .adf-content .adf-body ul, 
        .adf-content .adf-body ol { color: #374151 !important; }
        .adf-content .adf-body li { color: #374151 !important; }
        .adf-content .adf-body blockquote { 
          color: #6b7280 !important; 
          background: #f9fafb !important; 
          border-left: 3px solid #10b981 !important; 
          padding: 12px 16px !important; 
          margin: 16px 0 !important; 
          border-radius: 6px !important; 
        }
        .adf-content .adf-body a { 
          color: #059669 !important; 
          text-decoration: underline !important; 
        }
        
        /* Popup and inline positioning */
        .adf-popup { 
          position: fixed !important; 
          right: 20px !important; 
          bottom: 20px !important; 
          z-index: 2147483646 !important; 
        }
        
        .adf-inline { 
          position: relative !important; 
          margin: 20px auto !important; 
        }
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
          ${bodyHtml ? `<div class="adf-body">${bodyHtml}</div>` : ""}
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
