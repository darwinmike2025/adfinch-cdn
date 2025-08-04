(async () => {
  console.log("✅ scrollframe.js loaded");

  const currentScript = document.currentScript;
  const unitId = currentScript?.dataset?.unitId;
  const position = currentScript?.dataset?.position || "popup";

  if (!unitId) {
    console.error("❌ No data-unit-id found on script tag");
    return;
  }

  let config;

  try {
    const res = await fetch(
      "https://mynqhurabkihzyqweyet.supabase.co/functions/v1/scrollframe-fetch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      }
    );
    const result = await res.json();
    if (!res.ok || !result?.config) {
      console.error("❌ Error fetching config for unit:", unitId, result);
      return;
    }
    config = result.config;
  } catch (err) {
    console.error("❌ Failed to load ScrollFrame config:", err);
    return;
  }

  const tailwindColors = {
    "emerald-600": "#059669",
    "emerald-700": "#047857",
    "green-500": "#10b981",
    "green-600": "#059669",
    "blue-600": "#2563eb",
    "blue-700": "#1d4ed8",
    "purple-600": "#9333ea",
    "purple-700": "#7c3aed",
    "red-600": "#dc2626",
    "red-700": "#b91c1c",
  };

  const parseGradient = (gradient) => {
    const match = gradient?.match(/from-([a-z\-]+)\s+to-([a-z\-]+)/);
    if (match) {
      const from = tailwindColors[match[1]] || "#10b981";
      const to = tailwindColors[match[2]] || "#059669";
      return `background: linear-gradient(135deg, ${from}, ${to});`;
    }
    return "background: #10b981;";
  };

  const {
    template_type = "investment",
    header_config = {},
    navigation_enabled = true,
    trust_indicators = [],
    styling_theme = {
      buttonColor: "#10b981",
      buttonText: "#ffffff",
    },
    auto_advance = true,
    slide_duration = 5000,
    slides = [],
    imageUrl, headline, subheadline, body, destinationUrl, ctaText
  } = config;

  const isMulti = Array.isArray(slides) && slides.length > 0;
  const slideData = isMulti ? slides : [{ imageUrl, headline, subheadline, body, destinationUrl, ctaText }];
  let currentSlideIndex = 0;
  let autoAdvanceTimer = null;

  const renderSlide = (index) => {
    const s = slideData[index];
    if (!s) return '';
    return `
      <div class="slide-content" style="opacity:1; transition:opacity 0.3s ease-in-out;">
        <div style="width:100%; max-height:220px; overflow:hidden;">
          <img src="${s.imageUrl || ''}" alt="Ad" style="width:100%; object-fit:cover;" />
        </div>
        <div style="padding:12px 16px;">
          <h3 style="font-size:18px; font-weight:bold; margin-bottom:8px;">${s.headline || ''}</h3>
          <p style="font-size:14px; color:#555; margin-bottom:12px;">${s.subheadline || ''}</p>
          ${s.body ? `<div style="font-size:13px; color:#666; margin-bottom:16px;">${s.body}</div>` : ''}
          <a href="${s.destinationUrl || '#'}" target="_blank" style="
            display:inline-block;
            background:${styling_theme.buttonColor};
            color:${styling_theme.buttonText};
            padding:10px 16px;
            border-radius:4px;
            text-decoration:none;
            font-weight:bold;
            font-size:14px;
          ">${s.ctaText || 'Learn More'}</a>
        </div>
      </div>
    `;
  };

  const renderNav = () => {
    if (!navigation_enabled || slideData.length <= 1) return '';
    const dots = slideData.map((_, i) => `
      <span class="nav-dot ${i === currentSlideIndex ? 'active' : ''}" data-slide="${i}" style="
        width:8px; height:8px; border-radius:50%;
        background:${i === currentSlideIndex ? styling_theme.buttonColor : '#ccc'};
        cursor:pointer;"></span>
    `).join('');
    return `
      <div class="scrollframe-nav" style="margin-top:16px; text-align:center;">
        <div style="display:flex; justify-content:center; gap:16px;">
          <span class="nav-arrow nav-prev" style="cursor:${currentSlideIndex > 0 ? 'pointer' : 'default'}; font-size:18px; color:${currentSlideIndex > 0 ? styling_theme.buttonColor : '#aaa'};">◀</span>
          <div class="nav-dots" style="display:flex; gap:8px;">${dots}</div>
          <span class="nav-arrow nav-next" style="cursor:${currentSlideIndex < slideData.length - 1 ? 'pointer' : 'default'}; font-size:18px; color:${currentSlideIndex < slideData.length - 1 ? styling_theme.buttonColor : '#aaa'};">▶</span>
        </div>
      </div>
    `;
  };

  const updateSlide = () => {
    const content = container.querySelector('.slide-content');
    const nav = container.querySelector('.scrollframe-nav');
    if (content) {
      content.style.opacity = '0';
      setTimeout(() => {
        content.outerHTML = renderSlide(currentSlideIndex);
        container.querySelector('.slide-content').style.opacity = '1';
      }, 150);
    }
    if (nav) {
      nav.outerHTML = renderNav();
      setupNav();
    }
  };

  const nextSlide = () => {
    if (currentSlideIndex < slideData.length - 1) {
      currentSlideIndex++;
      updateSlide();
      resetAutoAdvance();
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      currentSlideIndex--;
      updateSlide();
      resetAutoAdvance();
    }
  };

  const goToSlide = (i) => {
    if (i >= 0 && i < slideData.length && i !== currentSlideIndex) {
      currentSlideIndex = i;
      updateSlide();
      resetAutoAdvance();
    }
  };

  const setupNav = () => {
    container.querySelector('.nav-prev')?.addEventListener('click', prevSlide);
    container.querySelector('.nav-next')?.addEventListener('click', nextSlide);
    container.querySelectorAll('.nav-dot')?.forEach((dot, i) => {
      dot.addEventListener('click', () => goToSlide(i));
    });
  };

  const startAutoAdvance = () => {
    if (auto_advance && slideData.length > 1) {
      autoAdvanceTimer = setInterval(() => {
        currentSlideIndex = (currentSlideIndex + 1) % slideData.length;
        updateSlide();
      }, slide_duration);
    }
  };

  const resetAutoAdvance = () => {
    clearInterval(autoAdvanceTimer);
    autoAdvanceTimer = null;
    startAutoAdvance();
  };

  const container = document.createElement("div");
  container.className = `scrollframe-wrapper ${template_type}`;
  container.style.cssText = `
    border:1px solid #ddd;
    border-radius:8px;
    max-width:460px;
    font-family:Inter,sans-serif;
    overflow:hidden;
    box-shadow:0 8px 24px rgba(0,0,0,0.08);
    background:#fff;
    position: relative;
  `;

  container.innerHTML = `
    <div style="${parseGradient(header_config.gradient)}; color:#fff; padding:14px 20px; font-weight:600; font-size:16px;">
      ${header_config.icon || "💡"} ${header_config.title}
    </div>
    <div style="padding:20px;">
      ${renderSlide(currentSlideIndex)}
      ${trust_indicators?.length ? `
        <ul style="list-style:none; padding:0; font-size:12px; color:#888; text-align:center;">
          ${trust_indicators.map((ti) => `<li style="margin-bottom:4px;">${ti}</li>`).join('')}
        </ul>` : ''}
      ${renderNav()}
    </div>
  `;

  let overlay = null;
  if (position === "modal") {
    overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9998;
    `;
    document.body.appendChild(overlay);
    container.style.position = "fixed";
    container.style.left = "50%";
    container.style.top = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.zIndex = "9999";

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "×";
    closeBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 16px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      border: 1px solid #fff;
      border-radius: 4px;
      font-size: 24px;
      width: 36px;
      height: 36px;
      cursor: pointer;
      z-index: 10000;
    `;
    closeBtn.addEventListener("click", () => {
      document.body.removeChild(container);
      if (overlay) document.body.removeChild(overlay);
      document.body.style.overflow = originalOverflow;
    });
    container.appendChild(closeBtn);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(container);
        if (overlay) document.body.removeChild(overlay);
        document.body.style.overflow = originalOverflow;
      }
    });

    overlay.addEventListener("click", () => {
      document.body.removeChild(container);
      document.body.removeChild(overlay);
      document.body.style.overflow = originalOverflow;
    });
  } else if (position === "popup") {
    container.style.position = "fixed";
    container.style.bottom = "30px";
    container.style.right = "30px";
    container.style.zIndex = "9999";
  } else {
    currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
  }

  if (position === "modal" || position === "popup") {
    document.body.appendChild(container);
  }

  setupNav();
  startAutoAdvance();

  container.addEventListener("mouseenter", () => clearInterval(autoAdvanceTimer));
  container.addEventListener("mouseleave", () => resetAutoAdvance());

  console.log("✅ ScrollFrame rendered in", position, "mode with", slideData.length, "slides");
})();
