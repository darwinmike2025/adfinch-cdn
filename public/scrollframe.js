(async () => {
  console.log("✅ scrollframe.js loaded");

  const currentScript = document.currentScript;
  const unitId = currentScript?.getAttribute("data-unit-id");
  if (!unitId) {
    console.error("❌ No data-unit-id found in embed script tag.");
    return;
  }

  const res = await fetch(`https://mynqhurabkihzyqweyet.supabase.co/rest/v1/channel_partner_units?select=config&unit_id=eq.${unitId}`, {
    headers: {
      apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bnFodXJhYmtpaHp5cXdleWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTM2OTUsImV4cCI6MjA2NjY4OTY5NX0.TO-_oG0yheW-GbWx9n0fP3IJm7M_-4_Z2Jf8d4I1wBE',
    },
  });

  const data = await res.json();
  const config = data?.[0]?.config;
  if (!config) {
    console.error("❌ No config found for unit_id:", unitId);
    return;
  }

  console.log("✅ Parsed config:", config);

  const isMulti = Array.isArray(config.slides);
  const slides = isMulti ? config.slides : [config];
  let current = 0;
  let timer;

  const container = document.createElement("div");
  container.style.maxWidth = "600px";
  container.style.margin = "0 auto";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.border = "1px solid #ddd";
  container.style.borderRadius = "8px";
  container.style.overflow = "hidden";
  container.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
  container.style.background = config.styling_theme?.background || "#fff";
  container.style.color = config.styling_theme?.text || "#000";

  function renderSlide(index) {
    const slide = slides[index];
    if (!slide) return;

    container.innerHTML = `
      <div style="background: ${config.header_config?.background || "#2ecc71"}; padding: 12px 16px; color: #fff; font-weight: bold; font-size: 16px;">
        ${config.header_config?.icon || "💡"} ${config.header_config?.title || "Featured Offer"}
      </div>

      <img src="${slide.imageUrl}" alt="Ad Image" style="width: 100%; display: block;" />

      <h2 style="padding: 0 16px;">${slide.headline || ""}</h2>
      <p style="padding: 0 16px;">${slide.subheadline || ""}</p>

      <div style="padding: 0 16px 16px;">
        <a href="${slide.destinationUrl}" target="_blank" style="
          display: inline-block;
          background: ${config.styling_theme?.buttonColor || "#6c5ce7"};
          color: ${config.styling_theme?.buttonText || "#fff"};
          padding: 12px 16px;
          border-radius: 4px;
          text-decoration: none;
          font-weight: bold;
        ">${slide.ctaText || "Learn More"}</a>
      </div>

      ${config.trust_indicators?.length ? `
        <ul style="padding: 0 16px 16px; font-size: 14px;">
          ${config.trust_indicators.map(item => `<li>${item}</li>`).join("")}
        </ul>` : ""
      }

      ${config.navigation_enabled && slides.length > 1 ? `
        <div style="text-align:center; padding: 8px 0;">
          <button id="prevBtn" style="margin: 0 8px;">◀</button>
          ${slides.map((_, i) => `
            <span style="
              display: inline-block;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${i === current ? "#6c5ce7" : "#ddd"};
              margin: 0 4px;
            "></span>
          `).join("")}
          <button id="nextBtn" style="margin: 0 8px;">▶</button>
        </div>` : ""
      }
    `;

    // Bind navigation
    if (config.navigation_enabled && slides.length > 1) {
      const prevBtn = container.querySelector("#prevBtn");
      const nextBtn = container.querySelector("#nextBtn");

      if (prevBtn) prevBtn.onclick = () => updateSlide(-1);
      if (nextBtn) nextBtn.onclick = () => updateSlide(1);
    }
  }

  function updateSlide(offset) {
    current = (current + offset + slides.length) % slides.length;
    renderSlide(current);
    if (config.auto_advance) {
      clearInterval(timer);
      timer = setInterval(() => updateSlide(1), config.slide_duration || 5000);
    }
  }

  renderSlide(current);

  if (config.auto_advance) {
    timer = setInterval(() => updateSlide(1), config.slide_duration || 5000);
  }

  currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
  console.log("✅ ScrollFrame rendered successfully");
})();
