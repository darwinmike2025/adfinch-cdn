(async () => {
  try {
    console.log("[ScrollFrame v2] boot");

    // Robust currentScript detection (document.currentScript can be null in some cases)
    const getCurrentScript = () => {
      if (document.currentScript) return document.currentScript;
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.reverse().find(s => /scrollframe\.js(\?|$)/.test(s.src)) || null;
    };

    const currentScript = getCurrentScript();
    const embedId = currentScript?.dataset?.embedId;
    const position = (currentScript?.dataset?.position || "popup").toLowerCase();
    const noIframe = String(currentScript?.dataset?.noIframe || "").toLowerCase() === "true";

    if (!embedId) {
      console.error("[ScrollFrame v2] error: No data-embed-id found on script tag");
      return;
    }

    // Fetch config with timeout
    console.log("[ScrollFrame v2] starting fetch...");
    let config;
    let slides = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(
        `https://mynqhurabkihzyqweyet.supabase.co/functions/v1/scrollframe-fetch?embedId=${encodeURIComponent(embedId)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!resp.ok) {
        console.error("[ScrollFrame v2] fetch failed:", resp.status, resp.statusText);
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data = await resp.json();
      if (!data?.success) {
        console.error("[ScrollFrame v2] fetch unsuccessful:", data?.error);
        throw new Error(data?.error || "Config fetch unsuccessful");
      }

      config = data.config || {};

      // Normalize slides; require headline, image optional
      if (Array.isArray(config.slides)) {
        slides = config.slides
          .map(s => ({
            headline: s.headline || "",
            subheadline: s.subheadline || "",
            body: s.body || s.body_copy || s.description || "",
            imageUrl: s.imageUrl || s.image_url || "",
            destinationUrl: s.destinationUrl || s.url || "#",
            ctaText: s.ctaText || s.cta_text || "Learn More"
          }))
          .filter(s => s.headline);
      } else if (config.headline) {
        slides = [{
          headline: config.headline || "",
          subheadline: config.subheadline || "",
          body: config.body || config.body_copy || config.description || "",
          imageUrl: config.imageUrl || config.image_url || "",
          destinationUrl: config.destinationUrl || config.url || "#",
          ctaText: config.ctaText || config.cta_text || "Learn More"
        }];
      }

      if (!slides.length) throw new Error("No valid slides found");

      console.log(`[ScrollFrame v2] fetched ${slides.length} slide(s)`);

    } catch (err) {
      console.error("[ScrollFrame v2] error:", err?.message || err);

      // Visible error near script tag
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = `
        color: #dc2626;
        background: #fef2f2;
        border: 1px solid #fecaca;
        padding: 12px;
        border-radius: 8px;
        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Arial,sans-serif;
        font-size: 14px;
        margin: 10px 0;
        max-width: 420px;
      `;
      errorDiv.textContent = "❌ ScrollFrame: fetch failed (timeout or CORS error)";
      if (currentScript?.parentNode) {
        currentScript.parentNode.insertBefore(errorDiv, currentScript.nextSibling);
      } else {
        document.body.appendChild(errorDiv);
      }
      return;
    }

    // Colors and header gradient helpers
    const tailwindColors = {
      emerald: "#10b981",
      red: "#ef4444",
      blue: "#3b82f6",
      purple: "#8b5cf6",
      pink: "#ec4899",
      indigo: "#6366f1",
      yellow: "#f59e0b",
      green: "#22c55e"
    };

    const parseGradient = (gradientClass) => {
      if (!gradientClass || typeof gradientClass !== "string") return "";
      const m = gradientClass.match(/from-(\w+)-(\d+)\s+to-(\w+)-(\d+)/);
      if (m) {
        const [, fromColor, , toColor] = m;
        const fromColorValue = tailwindColors[fromColor] || fromColor || "#10b981";
        const toColorValue = tailwindColors[toColor] || toColor || "#059669";
        return `linear-gradient(135deg, ${fromColorValue}, ${toColorValue})`;
      }
      return "";
    };

    const primaryColor =
      tailwindColors[config?.styling_theme?.primary] ||
      config?.styling_theme?.primary ||
      "#10b981";
    const headerGradient =
      parseGradient(config?.header_config?.gradient) ||
      `linear-gradient(135deg, ${primaryColor}, #059669)`;
    const headerTitle = config?.header_config?.title || "Sponsored Content";
    const headerIcon = (() => {
      const ic = (config?.header_config?.icon || "").toLowerCase();
      if (ic === "trendingup") return "📈";
      if (ic === "wine") return "🍷";
      if (ic === "heart") return "💖";
      return "📈";
    })();

    // Inject CSS once
    const STYLE_ID = "adf-scrollframe-css";
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
      :root {
        --adf-primary: ${primaryColor};
        --adf-header-bg: ${headerGradient};
        --adf-text: #111827;
        --adf-muted: #6b7280;
        --adf-bg: #ffffff;
        --adf-border: #e5e7eb;
        --adf-shadow: 0 20px 50px rgba(0,0,0,0.15);
        --adf-radius: 14px;
      }

      .adf-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }

      .adf-modal {
        width: clamp(320px, 90vw, 900px);
        height: clamp(480px, 80vh, 720px);
        background: var(--adf-bg);
        color: var(--adf-text);
        border-radius: var(--adf-radius);
        box-shadow: var(--adf-shadow);
        display: grid;
        grid-template-rows: auto 1fr auto;
        overflow: visible; /* allow arrows to sit slightly outside */
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      }

      /* Popup positioning (no overlay) */
      .adf-popup {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483646;
      }

      .adf-header {
        background: var(--adf-header-bg);
        color: white;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top-left-radius: var(--adf-radius);
        border-top-right-radius: var(--adf-radius);
        min-height: 52px; /* match demo band height */
      }

      .adf-header .adf-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }

      .adf-close {
        background: transparent;
        border: none;
        color: white;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        border-radius: 8px;
        padding: 2px 6px;
      }
      .adf-close:focus { outline: 2px solid rgba(255,255,255,0.6); outline-offset: 2px; }

      .adf-frame {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        align-items: stretch;
        justify-items: stretch;
        padding: 12px 28px; /* space so arrows can sit just outside content frame */
        background: var(--adf-bg);
      }

      .adf-content {
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 10px;
        border: 1px solid var(--adf-border);
        padding: 16px;
        background: #fff;
        /* Professional typography base */
        font-size: 16px;
        line-height: 1.6;
      }

      /* Cleaner scrollbar (WebKit) */
      .adf-content::-webkit-scrollbar { width: 10px; height: 10px; }
      .adf-content::-webkit-scrollbar-track { background: transparent; }
      .adf-content::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; }
      .adf-content:hover::-webkit-scrollbar-thumb { background: #9ca3af; }

      /* Typography for markdown */
      .adf-content h1 { font-size: clamp(24px, 2.4vw, 28px); line-height: 1.25; margin: 0 0 10px; font-weight: 700; }
      .adf-content h2 { font-size: clamp(20px, 2.1vw, 22px); line-height: 1.3; margin: 12px 0 8px; font-weight: 700; }
      .adf-content h3 { font-size: clamp(18px, 2vw, 20px); line-height: 1.35; margin: 12px 0 8px; font-weight: 600; color: var(--adf-text); }
      .adf-content p { margin: 10px 0; color: #1f2937; }
      .adf-content a { color: var(--adf-primary); text-decoration: underline; }
      .adf-content ul, .adf-content ol { padding-left: 20px; margin: 10px 0; }
      .adf-content li { margin: 6px 0; }
      .adf-content blockquote { margin: 12px 0; padding: 8px 12px; border-left: 3px solid var(--adf-primary); color: #374151; background: #f9fafb; border-radius: 6px; }
      .adf-content code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
      .adf-content pre { background: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 8px; overflow: auto; }

      .adf-media {
        width: 100%;
        border-radius: 10px;
        overflow: hidden;
        background: #f3f4f6;
        margin-bottom: 12px;
        aspect-ratio: 16 / 10; /* keep media region consistent */
      }
      .adf-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .adf-cta {
        display: inline-block;
        background: var(--adf-primary);
        color: white;
        padding: 12px 16px;
        border-radius: 10px;
        font-weight: 600;
        text-decoration: none;
        margin-top: 12px;
      }

      .adf-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: #ffffff;
        color: #374151;
        border: 1px solid #e5e7eb;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        width: 36px;
        height: 36px;
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .adf-arrow:disabled { opacity: 0.5; cursor: default; }
      .adf-prev { left: -20px; }
      .adf-next { right: -20px; }

      .adf-footer {
        border-top: 1px solid var(--adf-border);
        background: #fff;
        padding: 10px 16px;
        border-bottom-left-radius: var(--adf-radius);
        border-bottom-right-radius: var(--adf-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
      }

      .adf-dots { display: inline-flex; gap: 8px; }
      .adf-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #d1d5db;
        border: none;
        padding: 0;
        cursor: pointer;
      }
      .adf-dot[aria-current="true"] { background: var(--adf-primary); }

      /* Slide container inside content */
      .adf-slide { display: none; }
      .adf-slide.active { display: block; }

      @media (max-width: 420px) {
        .adf-prev { left: -16px; }
        .adf-next { right: -16px; }
      }
      `;
      document.head.appendChild(style);
    }

    // Simple Markdown to HTML
    const markdownToHtml = (txt) => {
      if (!txt) return "";
      const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(txt);
      if (looksLikeHtml) return txt;

      // Basic escapes
      let s = txt.replace(/&/g, "&").replace(//g, ">");

      // Code blocks ```
      s = s.replace(/```([\s\S]*?)```/g, (_, code) => `${code.replace(/</g, "<").replace(/>/g, ">")}`);

      // Headings
      s = s.replace(/^###\s+(.+)$/gm, "$1");
      s = s.replace(/^##\s+(.+)$/gm, "$1");
      s = s.replace(/^#\s+(.+)$/gm, "$1");

      // Bold/Italic
      s = s.replace(/\*\*(.+?)\*\*/g, "$1");
      s = s.replace(/\*(.+?)\*/g, "$1");

      // Links [text](url)
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `$1`);

      // Blockquote
      s = s.replace(/^\>\s+(.+)$/gm, "$1");

      // Lists
      // Ordered
      s = s.replace(/^(?:\d+\.\s.+(?:\n|$))+?/gm, (m) => {
        const items = m.trim().split(/\n/).map(l => l.replace(/^\d+\.\s+/, "").trim()).filter(Boolean);
        return `${items.map(i => `${i}`).join("")}`;
      });
      // Unordered
      s = s.replace(/^(?:[-*]\s.+(?:\n|$))+?/gm, (m) => {
        const items = m.trim().split(/\n/).map(l => l.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
        return `${items.map(i => `${i}`).join("")}`;
      });

      // Paragraphs (naive)
      s = s.split(/\n{2,}/).map(block => {
        if (/^\s*<(h1|h2|h3|ul|ol|pre|blockquote)/.test(block)) return block;
        return `${block.replace(/\n/g, "")}`;
      }).join("");

      return s;
    };

    // Build slide DOM as HTML string
    const renderSlideHtml = (slide) => {
      const imgHtml = slide.imageUrl
        ? ``
        : "";
      const sub = slide.subheadline ? `${slide.subheadline}` : "";
      const bodyHtml = slide.body ? `${markdownToHtml(slide.body)}` : "";
      const ctaHtml = slide.destinationUrl
        ? `${slide.ctaText || "Learn More"}`
        : "";

      return `
        ${imgHtml}
        ${slide.headline}
        ${sub}
        ${bodyHtml}
        ${ctaHtml}
      `;
    };

    // Create shell
    const overlay = document.createElement("div");
    const modal = document.createElement("div");
    modal.className = "adf-modal";
    // Header
    const header = document.createElement("div");
    header.className = "adf-header";
    header.innerHTML = `
      ${headerIcon}${headerTitle}
      ×
    `;
    // Frame (content area + arrows)
    const frame = document.createElement("div");
    frame.className = "adf-frame";

    // Content scroller
    const content = document.createElement("div");
    content.className = "adf-content";
    content.setAttribute("role", "region");
    content.setAttribute("aria-label", "Sponsored content");

    // Slides container
    const slideEls = slides.map((s, i) => {
      const el = document.createElement("div");
      el.className = "adf-slide" + (i === 0 ? " active" : "");
      el.innerHTML = renderSlideHtml(s);
      return el;
    });
    slideEls.forEach(el => content.appendChild(el));

    // Arrows (outside content frame)
    const prevBtn = document.createElement("button");
    prevBtn.className = "adf-arrow adf-prev";
    prevBtn.setAttribute("aria-label", "Previous");
    prevBtn.textContent = "‹";

    const nextBtn = document.createElement("button");
    nextBtn.className = "adf-arrow adf-next";
    nextBtn.setAttribute("aria-label", "Next");
    nextBtn.textContent = "›";

    // Footer (dots)
    const footer = document.createElement("div");
    footer.className = "adf-footer";
    const dotsWrap = document.createElement("div");
    dotsWrap.className = "adf-dots";
    const dotEls = slides.map((_, i) => {
      const b = document.createElement("button");
      b.className = "adf-dot";
      b.type = "button";
      b.setAttribute("aria-label", `Go to slide ${i + 1}`);
      if (i === 0) b.setAttribute("aria-current", "true");
      return b;
    });
    dotEls.forEach(d => dotsWrap.appendChild(d));
    footer.appendChild(dotsWrap);

    // Assemble
    frame.appendChild(content);
    frame.appendChild(prevBtn);
    frame.appendChild(nextBtn);
    modal.appendChild(header);
    modal.appendChild(frame);
    modal.appendChild(footer);

    // Insert by position
    let root;
    if (position === "modal") {
      overlay.className = "adf-overlay";
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    } else if (position === "popup") {
      root = document.createElement("div");
      root.className = "adf-popup";
      root.appendChild(modal);
      document.body.appendChild(root);
    } else {
      // inline
      root = document.createElement("div");
      root.style.position = "relative";
      root.appendChild(modal);
      if (currentScript?.parentNode) {
        currentScript.parentNode.insertBefore(root, currentScript.nextSibling);
      } else {
        document.body.appendChild(root);
      }
    }

    // Body scroll locking for modal
    const lockBody = () => {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    };
    const unlockBody = () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
    if (position === "modal") lockBody();

    // Focus management (trap within modal in modal mode)
    let previouslyFocused = document.activeElement;
    const focusablesSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])'
    ].join(",");
    const getFocusables = () => Array.from(modal.querySelectorAll(focusablesSelector));
    const focusFirst = () => { const f = getFocusables()[0]; if (f) f.focus(); };
    setTimeout(focusFirst, 0);

    const handleFocusTrap = (e) => {
      if (position !== "modal") return;
      if (!modal.contains(e.target)) {
        e.stopPropagation();
        focusFirst();
      }
    };
    document.addEventListener("focusin", handleFocusTrap);

    // Close logic
    const teardown = () => {
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("focusin", handleFocusTrap);
      window.removeEventListener("resize", onResize);
      if (position === "modal") unlockBody();
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (root && root.parentNode) root.parentNode.removeChild(root);
      if (previouslyFocused && previouslyFocused.focus) {
        try { previouslyFocused.focus(); } catch {}
      }
    };

    const closeBtn = header.querySelector(".adf-close");
    closeBtn?.addEventListener("click", teardown);
    if (position === "modal") {
      overlay.addEventListener("click", (e) => { if (e.target === overlay) teardown(); });
    }

    // State + navigation
    let current = 0;
    const total = slides.length;

    const setActive = (idx) => {
      if (idx < 0 || idx >= total) return;
      // hide old
      slideEls[current].classList.remove("active");
      // show new
      current = idx;
      slideEls[current].classList.add("active");
      // update dots
      dotEls.forEach((d, i) => {
        if (i === current) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
      // reset scroll in content
      content.scrollTop = 0;
      // enable/disable arrows (no wrap)
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;
    };

    prevBtn.addEventListener("click", () => setActive(current - 1));
    nextBtn.addEventListener("click", () => setActive(current + 1));
    dotEls.forEach((d, i) => d.addEventListener("click", () => setActive(i)));

    // Keyboard support
    const keyHandler = (e) => {
      if (e.key === "Escape") { teardown(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); setActive(current - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); setActive(current + 1); }
    };
    document.addEventListener("keydown", keyHandler);

    // Touch swipe (ignore when vertical scrolling dominates)
    let touchStartX = 0, touchStartY = 0, touching = false;
    frame.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touching = true;
    }, { passive: true });
    frame.addEventListener("touchend", (e) => {
      if (!touching) return;
      touching = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) setActive(current + 1);
        else setActive(current - 1);
      }
    });

    // Initial arrow disabled state
    prevBtn.disabled = true;
    nextBtn.disabled = total <= 1;

    // Keep outer shell balanced on resize (no layout shift within clamps)
    const onResize = () => {
      // No-op placeholder: clamps handled via CSS; we keep for future tuning
    };
    window.addEventListener("resize", onResize);

    console.log("[ScrollFrame v2] render completed successfully");
  } catch (error) {
    console.error("[ScrollFrame v2] fatal error:", error);
  }
})();
```
