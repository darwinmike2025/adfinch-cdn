(async () => {
  try {
    console.log("[ScrollFrame] boot");

    const currentScript = document.currentScript;
    const embedId = currentScript?.dataset?.embedId;
    const position = currentScript?.dataset?.position || "popup";

    if (!embedId) {
      console.error("[ScrollFrame] error: No data-embed-id found on script tag");
      return;
    }

    console.log("[ScrollFrame] starting fetch...");

    let config;
    let slideData = [];

    try {
      // Create fetch with 8-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://mynqhurabkihzyqweyet.supabase.co/functions/v1/scrollframe-fetch?embedId=${embedId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("[ScrollFrame] error: Failed to fetch config:", response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[ScrollFrame] fetch success");

      if (!data.success) {
        console.error("[ScrollFrame] error: Config fetch unsuccessful:", data.error);
        throw new Error(data.error || 'Config fetch unsuccessful');
      }

      config = data.config;

      // Extract slides from config - normalize to camelCase
      if (config.slides && Array.isArray(config.slides)) {
        slideData = config.slides.filter(slide => slide.headline && slide.imageUrl);
      } else if (config.headline && config.imageUrl) {
        // Fallback to single slide format
        slideData = [{
          headline: config.headline,
          imageUrl: config.imageUrl,
          destinationUrl: config.destinationUrl || '#',
          ctaText: config.ctaText || 'Learn More'
        }];
      }

      console.log("[ScrollFrame] render starting...");

    } catch (error) {
      console.error("[ScrollFrame] error:", error.message);
      
      // Inject visible error message near script tag
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        color: #dc2626;
        background: #fef2f2;
        border: 1px solid #fecaca;
        padding: 12px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        margin: 10px 0;
        max-width: 400px;
      `;
      errorDiv.textContent = "❌ Fetch failed (timeout or CORS error)";
      
      // Insert error message after script tag
      if (currentScript && currentScript.parentNode) {
        currentScript.parentNode.insertBefore(errorDiv, currentScript.nextSibling);
      } else {
        document.body.appendChild(errorDiv);
      }
      return;
    }

    if (!slideData.length) {
      console.error("[ScrollFrame] error: No valid slides found");
      return;
    }

    // Define tailwind colors as mapping
    const tailwindColors = {
      emerald: '#10b981',
      red: '#ef4444',
      blue: '#3b82f6',
      purple: '#8b5cf6',
      pink: '#ec4899',
      indigo: '#6366f1',
      yellow: '#f59e0b',
      green: '#22c55e'
    };

    // Parse gradient class to CSS
    const parseGradient = (gradientClass) => {
      if (!gradientClass || typeof gradientClass !== 'string') return '';
      
      const matches = gradientClass.match(/from-(\w+)-(\d+)\s+to-(\w+)-(\d+)/);
      if (matches) {
        const [, fromColor, fromShade, toColor, toShade] = matches;
        const fromColorValue = tailwindColors[fromColor] || fromColor;
        const toColorValue = tailwindColors[toColor] || toColor;
        return `linear-gradient(135deg, ${fromColorValue}, ${toColorValue})`;
      }
      return '';
    };

    // Render slide content
    const renderSlide = (slide, index) => {
      const imageUrl = slide.imageUrl || '';
      const headline = slide.headline || '';
      const subheadline = slide.subheadline || '';
      const body = slide.body || '';
      const ctaText = slide.ctaText || 'Learn More';
      const destinationUrl = slide.destinationUrl || '#';

      return `
        <div class="scrollframe-slide" style="display: ${index === 0 ? 'block' : 'none'};">
          <div style="
            position: relative;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.15);
            max-width: 400px;
            width: 100%;
          ">
            <div style="position: relative; height: 200px; overflow: hidden;">
              <img 
                src="${imageUrl}" 
                alt="${headline}"
                style="
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  display: block;
                "
                onerror="this.style.display='none'"
              />
            </div>
            <div style="padding: 20px;">
              <h3 style="
                margin: 0 0 16px 0;
                font-size: 18px;
                font-weight: bold;
                color: #1f2937;
                line-height: 1.3;
              ">${headline}</h3>
              ${subheadline ? `<h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #6b7280; line-height: 1.4;">${subheadline}</h4>` : ''}
              ${body ? `<div style="margin: 0 0 16px 0; font-size: 14px; color: #374151; line-height: 1.5;">${body}</div>` : ''}
              <a 
                href="${destinationUrl}"
                target="_blank"
                rel="noopener"
                style="
                  display: inline-block;
                  background: ${config.styling_theme?.primary ? tailwindColors[config.styling_theme.primary] || config.styling_theme.primary : '#10b981'};
                  color: white;
                  padding: 12px 24px;
                  border-radius: 8px;
                  text-decoration: none;
                  font-weight: 600;
                  font-size: 14px;
                  transition: all 0.2s ease;
                "
                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                onmouseout="this.style.transform=''; this.style.boxShadow=''"
              >${ctaText}</a>
            </div>
          </div>
        </div>
      `;
    };

    // Render navigation if enabled and multiple slides
    const renderNav = () => {
      if (!config.navigation_enabled || slideData.length <= 1) return '';
      
      const dots = slideData.map((_, index) => 
        `<button class="scrollframe-dot" data-slide="${index}" style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: ${index === 0 ? '#10b981' : '#d1d5db'};
          margin: 0 4px;
          cursor: pointer;
          transition: background 0.2s ease;
        "></button>`
      ).join('');

      const arrows = slideData.length > 1 ? `
        <button class="scrollframe-prev" style="
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.9);
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          cursor: pointer;
          font-size: 18px;
          color: #374151;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transition: all 0.2s ease;
        ">‹</button>
        <button class="scrollframe-next" style="
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.9);
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          cursor: pointer;
          font-size: 18px;
          color: #374151;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transition: all 0.2s ease;
        ">›</button>
      ` : '';

      return arrows + `
        <div style="
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 16px;
        ">${dots}</div>
      `;
    };

    // State management
    let currentSlide = 0;
    let autoAdvanceInterval = null;

    // Update slide display
    const updateSlide = (index) => {
      // Hide all slides
      document.querySelectorAll('.scrollframe-slide').forEach(slide => {
        slide.style.display = 'none';
      });
      
      // Show current slide
      const currentSlideEl = document.querySelectorAll('.scrollframe-slide')[index];
      if (currentSlideEl) {
        currentSlideEl.style.display = 'block';
      }
      
      // Update dots
      document.querySelectorAll('.scrollframe-dot').forEach((dot, i) => {
        dot.style.background = i === index ? '#10b981' : '#d1d5db';
      });
      
      currentSlide = index;
    };

    // Navigate to specific slide
    const goToSlide = (index) => {
      if (index >= 0 && index < slideData.length) {
        updateSlide(index);
        resetAutoAdvance();
      }
    };

    // Setup navigation event listeners
    const setupNav = () => {
      const prevBtn = document.querySelector('.scrollframe-prev');
      const nextBtn = document.querySelector('.scrollframe-next');
      const dots = document.querySelectorAll('.scrollframe-dot');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          const newIndex = currentSlide > 0 ? currentSlide - 1 : slideData.length - 1;
          goToSlide(newIndex);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          const newIndex = currentSlide < slideData.length - 1 ? currentSlide + 1 : 0;
          goToSlide(newIndex);
        });
      }

      dots.forEach((dot, index) => {
        dot.addEventListener('click', () => goToSlide(index));
      });
    };

    // Auto-advance functionality
    const startAutoAdvance = () => {
      if (config.auto_advance && slideData.length > 1) {
        autoAdvanceInterval = setInterval(() => {
          const nextIndex = currentSlide < slideData.length - 1 ? currentSlide + 1 : 0;
          updateSlide(nextIndex);
        }, config.slide_duration || 5000);
      }
    };

    const resetAutoAdvance = () => {
      if (autoAdvanceInterval) {
        clearInterval(autoAdvanceInterval);
        autoAdvanceInterval = null;
      }
      startAutoAdvance();
    };

    // Create main container
    const container = document.createElement('div');
    container.className = 'scrollframe-wrapper';
    container.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 9999;
      position: fixed;
    `;

    // Header with gradient background
    const headerGradient = parseGradient(config.header_config?.gradient);
    const headerStyle = headerGradient ? `background: ${headerGradient};` : 'background: linear-gradient(135deg, #10b981, #059669);';
    
    container.innerHTML = `
      <div style="${headerStyle} color: white; padding: 12px 20px; border-radius: 12px 12px 0 0; position: relative;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${config.header_config?.icon === 'TrendingUp' ? '📈' : config.header_config?.icon === 'Wine' ? '🍷' : config.header_config?.icon === 'Heart' ? '💖' : '📈'}</span>
            <span style="font-weight: 600; font-size: 14px;">${config.header_config?.title || 'Sponsored Content'}</span>
          </div>
          <button onclick="this.closest('.scrollframe-wrapper').remove()" style="
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
          ">×</button>
        </div>
      </div>
      <div style="
        background: white;
        padding: 20px;
        border-radius: 0 0 12px 12px;
        position: relative;
      ">
        <div class="scrollframe-content">
          ${slideData.map((slide, index) => renderSlide(slide, index)).join('')}
        </div>
        ${renderNav()}
        ${config.trust_indicators && config.trust_indicators.length ? `
          <div style="
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
          ">
            ${config.trust_indicators.map(indicator => 
              `<span style="
                font-size: 12px;
                color: #10b981;
                background: #f0fdf4;
                padding: 4px 8px;
                border-radius: 4px;
                white-space: nowrap;
              ">${indicator}</span>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Position based on mode
    if (position === 'modal') {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      `;
      
      container.style.cssText += `
        position: relative;
        max-width: 440px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
      `;
      
      overlay.appendChild(container);
      document.body.appendChild(overlay);
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
        }
      });
      
      // Close on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          overlay.remove();
        }
      });
      
    } else if (position === 'popup') {
      container.style.cssText += `
        bottom: 20px;
        right: 20px;
        max-width: 360px;
        width: calc(100vw - 40px);
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
        border-radius: 12px;
      `;
      document.body.appendChild(container);
      
    } else {
      // inline mode
      container.style.cssText += `
        position: relative;
        max-width: 400px;
        width: 100%;
        margin: 20px auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
      `;
      
      // Insert after the script tag
      const scriptTag = document.currentScript;
      if (scriptTag && scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
      } else {
        document.body.appendChild(container);
      }
    }

    // Mouse enter/leave for auto-advance control
    container.addEventListener('mouseenter', () => {
      if (autoAdvanceInterval) {
        clearInterval(autoAdvanceInterval);
        autoAdvanceInterval = null;
      }
    });

    container.addEventListener('mouseleave', () => {
      startAutoAdvance();
    });

    // Setup navigation and auto-advance after DOM is ready
    setTimeout(() => {
      setupNav();
      startAutoAdvance();
    }, 100);

    console.log("[ScrollFrame] render completed successfully");

  } catch (error) {
    console.error("[ScrollFrame] error:", error);
  }
})();
