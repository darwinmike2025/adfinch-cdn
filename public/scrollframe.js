(async () => {
  try {
    console.log("✅ scrollframe.js loaded");

    const currentScript = document.currentScript;
    const embedId = currentScript?.dataset?.embedId;
    const position = currentScript?.dataset?.position || "popup";

    if (!embedId) {
      console.error("❌ No data-embed-id found on script tag");
      return;
    }

    console.log("🔍 Loading ScrollFrame for embedId:", embedId, "position:", position);

    let config;
    let slideData = [];

    try {
      const res = await fetch(
        "https://mynqhurabkihzyqweyet.supabase.co/functions/v1/scrollframe-fetch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedId }),
        }
      );
      const result = await res.json();
      console.log("🔍 Raw fetch result:", result);

      if (!res.ok || !result.success || !result.config) {
        console.warn("⚠️ Error fetching config for embedId:", embedId, result);
        return;
      }

      config = result.config;
      console.log("🔍 Config received from edge function:", config);

      // Extract slides from config.slides array, or fallback to single slide
      if (config.slides && Array.isArray(config.slides) && config.slides.length > 0) {
        slideData = config.slides.slice(0, 5); // Limit to 5 slides max
        console.log("🔍 Using", slideData.length, "slides from config.slides array");
      } else if (config.imageUrl || config.headline) {
        // Fallback to single slide from root config properties
        slideData = [{
          imageUrl: config.imageUrl,
          headline: config.headline,
          subheadline: config.subheadline,
          body: config.body,
          destinationUrl: config.destinationUrl,
          ctaText: config.ctaText
        }];
        console.log("🔍 Using single slide from config properties");
      } else {
        console.warn("⚠️ No valid slide data found in config");
        return;
      }
    } catch (err) {
      console.warn("⚠️ Failed to load ScrollFrame config:", err);
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

    // Destructure config with proper property names
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
      slide_duration = 5000
    } = config;

    console.log("🔍 Using template_type:", template_type);
    console.log("🔍 Header config:", header_config);
    console.log("🔍 Navigation enabled:", navigation_enabled);

    let currentSlideIndex = 0;
    let autoAdvanceTimer = null;

    console.log("🔍 Slide data prepared:", slideData.length, "slides");

    const renderSlide = (index) => {
      const s = slideData[index];
      if (!s) {
        console.warn("⚠️ No slide data for index:", index);
        return '';
      }
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
      try {
        const content = container.querySelector('.slide-content');
        const nav = container.querySelector('.scrollframe-nav');
        
        if (content) {
          content.style.opacity = '0';
          setTimeout(() => {
            content.outerHTML = renderSlide(currentSlideIndex);
            const newContent = container.querySelector('.slide-content');
            if (newContent) {
              newContent.style.opacity = '1';
            }
          }, 150);
        }
        
        if (nav) {
          nav.outerHTML = renderNav();
          setupNav();
        }
      } catch (err) {
        console.error("❌ Error updating slide:", err);
      }
    };

    const goToSlide = (i) => {
      if (i >= 0 && i < slideData.length && i !== currentSlideIndex) {
        console.log("🔍 Going to slide:", i);
        currentSlideIndex = i;
        updateSlide();
        resetAutoAdvance();
      }
    };

    const setupNav = () => {
      try {
        const prevBtn = container.querySelector('.nav-prev');
        const nextBtn = container.querySelector('.nav-next');
        const dots = container.querySelectorAll('.nav-dot');

        if (prevBtn) {
          prevBtn.addEventListener('click', () => {
            if (currentSlideIndex > 0) {
              currentSlideIndex--;
              updateSlide();
              resetAutoAdvance();
            }
          });
        }

        if (nextBtn) {
          nextBtn.addEventListener('click', () => {
            if (currentSlideIndex < slideData.length - 1) {
              currentSlideIndex++;
              updateSlide();
              resetAutoAdvance();
            }
          });
        }

        dots.forEach((dot, i) => {
          dot.addEventListener('click', () => goToSlide(i));
        });
      } catch (err) {
        console.error("❌ Error setting up navigation:", err);
      }
    };

    const startAutoAdvance = () => {
      try {
        if (auto_advance && slideData.length > 1) {
          console.log("🔍 Starting auto-advance with duration:", slide_duration);
          autoAdvanceTimer = setInterval(() => {
            currentSlideIndex = (currentSlideIndex + 1) % slideData.length;
            updateSlide();
          }, slide_duration);
        }
      } catch (err) {
        console.error("❌ Error starting auto-advance:", err);
      }
    };

    const resetAutoAdvance = () => {
      if (autoAdvanceTimer) {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
      startAutoAdvance();
    };

    // Create main container
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

    console.log("🔍 Building container with template:", template_type);

    // Build container content
    container.innerHTML = `
      <div style="${parseGradient(header_config.gradient)}; color:#fff; padding:14px 20px; font-weight:600; font-size:16px; position: relative;">
        ${header_config.icon || "💡"} ${header_config.title || ""}
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

    // Modal-specific setup with enhanced debugging
    let overlay = null;
    let originalOverflow = null;
    let keydownHandler = null;

    const closeModal = () => {
      console.log("🔍 closeModal called - removing elements");
      try {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
          console.log("🔍 Container removed from DOM");
        }
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
          console.log("🔍 Overlay removed from DOM");
        }
        if (originalOverflow !== null) {
          document.body.style.overflow = originalOverflow;
          console.log("🔍 Body overflow restored");
        }
        if (keydownHandler) {
          document.removeEventListener("keydown", keydownHandler);
          console.log("🔍 Keydown handler removed");
        }
        if (autoAdvanceTimer) {
          clearInterval(autoAdvanceTimer);
          console.log("🔍 Auto-advance timer cleared");
        }
      } catch (err) {
        console.error("❌ Error in closeModal:", err);
      }
    };

    // Position-specific rendering
    if (position === "modal") {
      console.log("🔍 Setting up modal mode");
      
      overlay = document.createElement("div");
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9998;
      `;

      container.style.position = "fixed";
      container.style.left = "50%";
      container.style.top = "50%";
      container.style.transform = "translate(-50%, -50%)";
      container.style.zIndex = "9999";

      originalOverflow = document.body.style.overflow;

      const closeBtn = document.createElement("button");
      closeBtn.innerText = "×";
      closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0,0,0,0.5);
        border: 2px solid white;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 10000;
        padding: 4px 6px;
        line-height: 1;
        border-radius: 4px;
        font-weight: bold;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      closeBtn.addEventListener("click", (e) => {
        console.log("🔍 Close button clicked");
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
      container.appendChild(closeBtn);

      keydownHandler = (e) => {
        if (e.key === "Escape") {
          console.log("🔍 Escape key pressed");
          closeModal();
        }
      };
      document.addEventListener("keydown", keydownHandler);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          console.log("🔍 Overlay clicked");
          closeModal();
        }
      });

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        try {
          document.body.appendChild(overlay);
          document.body.appendChild(container);
          document.body.style.overflow = "hidden";
          console.log("🔍 Modal elements added to DOM");
        } catch (err) {
          console.error("❌ Error adding modal to DOM:", err);
        }
      });

    } else if (position === "popup") {
      console.log("🔍 Setting up popup mode");
      
      container.style.position = "fixed";
      container.style.bottom = "30px";
      container.style.right = "30px";
      container.style.zIndex = "9999";

      const closeBtn = document.createElement("button");
      closeBtn.innerText = "×";
      closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0,0,0,0.5);
        border: 2px solid white;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 10000;
        padding: 4px 6px;
        line-height: 1;
        border-radius: 4px;
        font-weight: bold;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      closeBtn.addEventListener("click", (e) => {
        console.log("🔍 Popup close button clicked");
        e.preventDefault();
        e.stopPropagation();
        try {
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
          if (autoAdvanceTimer) {
            clearInterval(autoAdvanceTimer);
          }
          console.log("🔍 Popup closed successfully");
        } catch (err) {
          console.error("❌ Error closing popup:", err);
        }
      });
      container.appendChild(closeBtn);

      try {
        document.body.appendChild(container);
        console.log("🔍 Popup added to DOM");
      } catch (err) {
        console.error("❌ Error adding popup to DOM:", err);
      }

    } else {
      console.log("🔍 Setting up inline mode");
      try {
        currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
        console.log("🔍 Inline container added to DOM");
      } catch (err) {
        console.error("❌ Error adding inline container:", err);
      }
    }

    // Setup navigation and auto-advance with proper timing
    setTimeout(() => {
      try {
        setupNav();
        startAutoAdvance();

        container.addEventListener("mouseenter", () => {
          if (autoAdvanceTimer) {
            clearInterval(autoAdvanceTimer);
          }
        });
        
        container.addEventListener("mouseleave", () => {
          resetAutoAdvance();
        });

        console.log("✅ ScrollFrame rendered in", position, "mode with", slideData.length, "slides");
      } catch (err) {
        console.error("❌ Error in final setup:", err);
      }
    }, 100);

  } catch (err) {
    console.error("❌ ScrollFrame render failed:", err);
  }
})();
