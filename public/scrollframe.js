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

  console.log("✅ Parsed config:", config);

  const {
    template_type = "investment",
    header_config = {
      title: "💰 Premium Investment Insights",
      background: "#2ecc71",
      icon: "💰",
    },
    navigation_enabled = true,
    trust_indicators = ["✓ Secure Checkout", "⭐ 5-Star Rated"],
    styling_theme = {
      buttonColor: "#6c5ce7",
      buttonText: "#fff",
    },
    imageUrl,
    headline,
    subheadline,
    destinationUrl,
    ctaText,
  } = config;

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

  container.innerHTML = `
    <div style="background: ${header_config.background}; color: #fff; padding: 14px 20px; font-weight: 600; font-size: 16px;">
      ${header_config.icon || "💡"} ${header_config.title}
    </div>
    <div style="padding: 20px; background: #fff;">
      <img src="${imageUrl}" alt="" style="width: 100%; border-radius: 6px; margin-bottom: 16px;" />
      <h2 style="font-size: 20px; margin: 0 0 10px;">${headline}</h2>
      <p style="font-size: 14px; color: #555; margin-bottom: 16px;">${subheadline}</p>
      <a href="${destinationUrl}" target="_blank" style="
        display: block;
        text-align: center;
        background: ${styling_theme.buttonColor};
        color: ${styling_theme.buttonText};
        text-decoration: none;
        font-weight: 600;
        padding: 12px 16px;
        border-radius: 4px;
        margin-bottom: 16px;
      ">
        ${ctaText}
      </a>
      ${
        trust_indicators?.length
          ? `<ul style="list-style: none; padding: 0; margin: 0; font-size: 12px; color: #888; text-align: center;">
            ${trust_indicators
              .map((ti) => `<li style="margin-bottom: 4px;">${ti}</li>`)
              .join("")}
          </ul>`
          : ""
      }
      ${
        navigation_enabled
          ? `<div style="margin-top: 12px; text-align: center;">
              <span style="height: 8px; width: 8px; background: #ccc; border-radius: 50%; display: inline-block; margin: 0 4px;"></span>
              <span style="height: 8px; width: 8px; background: #ccc; border-radius: 50%; display: inline-block; margin: 0 4px;"></span>
              <span style="height: 8px; width: 8px; background: #ccc; border-radius: 50%; display: inline-block; margin: 0 4px;"></span>
            </div>`
          : ""
      }
    </div>
  `;

  currentScript?.parentNode?.insertBefore(container, currentScript.nextSibling);

  console.log("✅ ScrollFrame ad rendered successfully");
})();
