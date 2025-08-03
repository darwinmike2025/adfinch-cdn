(async () => {
  console.log("✅ scrollframe.js loaded");

  const currentScript = document.currentScript;
  const unitId = currentScript?.dataset?.unitId;

  if (!unitId) {
    console.error("❌ No data-unit-id found on script tag");
    return;
  }

  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bnFodXJhYmtpaHp5cXdleWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTM2OTUsImV4cCI6MjA2NjY4OTY5NX0.TO-_oG0yheW-GbWx9n0fP3IJm7M_-4_Z2Jf8d4I1wBE";

  const res = await fetch(
    `https://mynqhurabkihzyqweyet.supabase.co/rest/v1/channel_partner_units?select=config&unit_id=eq.${unitId}&is_active=eq.true`,
    {
      headers: {
        apikey: supabaseAnonKey,
      },
    }
  );

  const result = await res.json();
  const config = result?.[0]?.config;

  if (!config) {
    console.error("❌ No config found for unit:", unitId);
    return;
  }

  console.log("✅ CONFIG RAW:", JSON.stringify(config, null, 2));

  // Tailwind color mapping
  const tailwindColors = {
    'emerald-600': '#059669',
    'emerald-700': '#047857',
    'green-500': '#10b981',
    'green-600': '#059669',
    'blue-600': '#2563eb',
    'blue-700': '#1d4ed8',
    'purple-600': '#9333ea',
    'purple-700': '#7c3aed',
    'red-600': '#dc2626',
    'red-700': '#b91c1c'
  };

  // Function to parse Tailwind gradient and convert to CSS
  const parseGradient = (gradientString) => {
    console.log("🔍 [DEBUG] Parsing gradient:", gradientString);
    
    if (!gradientString || typeof gradientString !== 'string') {
      return 'background: #10b981;'; // fallback
    }
    
    // Match Tailwind gradient format: "from-emerald-600 to-green-500"
    const match = gradientString.match(/from-([a-z]+-\d+)\s+to-([a-z]+-\d+)/);
    
    if (match) {
      const fromColor = tailwindColors[match[1]] || '#10b981';
      const toColor = tailwindColors[match[2]] || '#059669';
      
      console.log("🔍 [DEBUG] Converted colors:", { from: fromColor, to: toColor });
      return `background: linear-gradient(135deg, ${fromColor}, ${toColor});`;
    }
    
    // Fallback for unrecognized format
    return 'background: #10b981;';
  };

  // Check if config has slides (new multi-slide format) or is legacy single-slide
  const isMultiSlide = config.slides && Array.isArray(config.slides);
  
  if (Array.isArray(config.slides)) {
    console.log("✅ FIRST SLIDE:", config.slides[0]);
  }
  
  const {
    template_type = "investment",
    header_config = {
      title: "💰 Premium Investment Insights",
      gradient: "from-emerald-600 to-green-500",
      icon: "💰",
    },
    navigation_enabled = true,
    trust_indicators = ["✓ Secure Checkout", "⭐ 5-Star Rated"],
    styling_theme = {
      primary: "emerald",
      accent: "white",
      text: "white",
      buttonColor: "#10b981",
      buttonText: "#ffffff",
    },
    auto_advance = true,
    slide_duration = 5000,
    slides = [],
    // Legacy single-slide fields (fallback)
    imageUrl,
    headline,
    subheadline,
    destinationUrl,
    ctaText,
    body,
  } = config;

  console.log("✅ HEADER CONFIG:", header_config);

  // For legacy configs, create a single slide array
  const slideData = isMultiSlide ? slides : [{
    imageUrl,
    headline,
    subheadline,
    body,
    destinationUrl,
    ctaText,
  }];
  
  console.log("✅ SLIDE DATA:", slideData);
  console.log("✅ IS MULTI SLIDE:", isMultiSlide);
  console.log("✅ STYLING THEME:", styling_theme);

  // Multi-slide state management
  let currentSlideIndex = 0;
  let autoAdvanceTimer = null;

  // Helper functions for multi-slide functionality
  const renderSlide = (slideIndex) => {
    console.log("🔍 [DEBUG] renderSlide called with slideIndex:", slideIndex);
    console.log("🔍 [DEBUG] slideData:", slideData);
    console.log("🔍 [DEBUG] styling_theme:", styling_theme);
    
    const slide = slideData[slideIndex];
    console.log("🔍 [DEBUG] Current slide object:", slide);
    
    if (!slide) return '';
    
    return `
      <div class="slide-content" style="opacity: 1; transition: opacity 0.3s ease-in-out; padding: 0;">
        <div style="width: 100%; max-height: 220px; overflow: hidden;">
          <img src="${slide?.imageUrl || ''}" alt="Ad Image" style="width: 100%; height: auto; object-fit: cover; display: block;" />
        </div>
         <div style="padding: 12px 16px;">
           <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold;">${slide?.headline || ''}</h3>
           <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.4; color: #555;">${slide?.subheadline || ''}</p>
           ${slide?.body ? `
             <div style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #666; text-align: left;">
               ${slide.body}
             </div>
           ` : ''}
           <a href="${slide?.destinationUrl || '#'}" target="_blank" style="
            display: inline-block;
            background: ${styling_theme?.buttonColor || '#6c5ce7'};
            color: ${styling_theme?.buttonText || '#fff'};
            padding: 10px 16px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: bold;
            font-size: 14px;
          ">${slide?.ctaText || 'Learn More'}</a>
        </div>
      </div>
    `;
  };

  const renderNavigation = () => {
    if (!navigation_enabled || slideData.length <= 1) return '';
    
    const dots = slideData.map((_, index) => 
      `<span class="nav-dot ${index === currentSlideIndex ? 'active' : ''}" 
             data-slide="${index}"
             style="width: 8px; height: 8px; border-radius: 50%; 
                    background: ${index === currentSlideIndex ? styling_theme.buttonColor : '#ccc'}; 
                    box-shadow: 0 ${index === currentSlideIndex ? '2' : '1'}px ${index === currentSlideIndex ? '4' : '2'}px rgba(0,0,0,0.1);
                    cursor: pointer;"></span>`
    ).join('');

    return `
      <div class="scrollframe-nav" style="margin-top: 16px; text-align: center;">
        <div class="nav-controls" style="display: flex; align-items: center; justify-content: center; gap: 16px;">
          <span class="nav-arrow nav-prev" 
                style="cursor: ${currentSlideIndex > 0 ? 'pointer' : 'default'}; 
                       padding: 8px; font-size: 18px; 
                       color: ${currentSlideIndex > 0 ? styling_theme.buttonColor : '#aaa'}; 
                       user-select: none;">◀</span>
          <div class="nav-dots" style="display: flex; align-items: center; gap: 8px;">
            ${dots}
          </div>
          <span class="nav-arrow nav-next" 
                style="cursor: ${currentSlideIndex < slideData.length - 1 ? 'pointer' : 'default'}; 
                       padding: 8px; font-size: 18px; 
                       color: ${currentSlideIndex < slideData.length - 1 ? styling_theme.buttonColor : '#aaa'}; 
                       user-select: none;">▶</span>
        </div>
      </div>
    `;
  };

  const updateSlide = () => {
    const contentArea = container.querySelector('.slide-content');
    const navArea = container.querySelector('.scrollframe-nav');
    
    // Fade out current content
    if (contentArea) {
      contentArea.style.opacity = '0';
      setTimeout(() => {
        contentArea.outerHTML = renderSlide(currentSlideIndex);
        const newContent = container.querySelector('.slide-content');
        if (newContent) {
          newContent.style.opacity = '1';
        }
      }, 150);
    }
    
    // Update navigation
    if (navArea) {
      navArea.outerHTML = renderNavigation();
      setupNavigation();
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

  const goToSlide = (index) => {
    if (index >= 0 && index < slideData.length && index !== currentSlideIndex) {
      currentSlideIndex = index;
      updateSlide();
      resetAutoAdvance();
    }
  };

  const startAutoAdvance = () => {
    if (auto_advance && slideData.length > 1) {
      autoAdvanceTimer = setInterval(() => {
        if (currentSlideIndex < slideData.length - 1) {
          nextSlide();
        } else {
          currentSlideIndex = 0;
          updateSlide();
        }
      }, slide_duration);
    }
  };

  const resetAutoAdvance = () => {
    if (autoAdvanceTimer) {
      clearInterval(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    startAutoAdvance();
  };

  const setupNavigation = () => {
    // Previous arrow
    const prevArrow = container.querySelector('.nav-prev');
    if (prevArrow) {
      prevArrow.onclick = prevSlide;
    }

    // Next arrow
    const nextArrow = container.querySelector('.nav-next');
    if (nextArrow) {
      nextArrow.onclick = nextSlide;
    }

    // Dots
    const dots = container.querySelectorAll('.nav-dot');
    dots.forEach((dot, index) => {
      dot.onclick = () => goToSlide(index);
    });
  };

  // Create the container
  const container = document.createElement("div");
  container.className = `scrollframe-wrapper ${template_type}`;
  container.style.cssText = `
    border: 1px solid #ddd;
    border-radius: 8px;
    max-width: 460px;
    margin: 30px auto;
    font-family: Inter, sans-serif;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  `;

  // Create header background using dynamic gradient parsing
  const getHeaderBackground = () => {
    console.log("🔍 [DEBUG] getHeaderBackground called with header_config:", header_config);
    
    if (header_config && header_config.gradient) {
      console.log("🔍 [DEBUG] Using database gradient:", header_config.gradient);
      return parseGradient(header_config.gradient);
    }
    
    // Fallback
    console.log("🔍 [DEBUG] Using fallback background color");
    return 'background: #10b981;';
  };

  // Initial render
  container.innerHTML = `
    <div style="${getHeaderBackground()}; color: #fff; padding: 14px 20px; font-weight: 600; font-size: 16px;">
      ${header_config.icon || "💡"} ${header_config.title}
    </div>
    <div style="padding: 20px; background: #fff;">
      ${renderSlide(currentSlideIndex)}
      ${
        trust_indicators?.length
          ? `<ul style="list-style: none; padding: 0; margin: 0; font-size: 12px; color: #888; text-align: center;">
            ${trust_indicators
              .map((ti) => `<li style="margin-bottom: 4px;">${ti}</li>`)
              .join("")}
          </ul>`
          : ""
      }
      ${renderNavigation()}
    </div>
  `;

  // Insert into DOM
  currentScript?.parentNode?.insertBefore(container, currentScript.nextSibling);

  // Setup interactivity
  setupNavigation();
  startAutoAdvance();

  // Pause auto-advance on hover
  container.addEventListener('mouseenter', () => {
    if (autoAdvanceTimer) {
      clearInterval(autoAdvanceTimer);
    }
  });

  container.addEventListener('mouseleave', () => {
    resetAutoAdvance();
  });

  console.log("✅ ScrollFrame ad rendered successfully with", slideData.length, "slides");
})();
