(async () => {
  console.log('scrollframe.js loaded');

  const currentScript = document.currentScript;
  const unitId = currentScript?.getAttribute('data-unit-id');

  if (!unitId) {
    console.error('❌ No data-unit-id found in embed script tag.');
    return;
  }

  const res = await fetch(`https://mynqhurabkihzyqweyet.supabase.co/rest/v1/channel_partner_units?select=config&unit_id=eq.${unitId}`, {
    headers: {
      apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15bnFodXJhYmtpaHp5cXdleWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTM2OTUsImV4cCI6MjA2NjY4OTY5NX0.TO-_oG0yheW-GbWx9n0fP3IJm7M_-4_Z2Jf8d4I1wBE' // ✅ REAL ANON KEY
    },
  });

  const data = await res.json();
  const config = data?.[0]?.config;

  if (!config) {
    console.error('❌ No config found for unit_id:', unitId);
    return;
  }

  console.log('✅ Parsed config:', config);

  const container = document.createElement('div');
  container.style.border = '1px solid #ccc';
  container.style.padding = '16px';
  container.style.margin = '20px 0';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.background = config.theme === 'dark' ? '#1e1e1e' : '#fff';
  container.style.color = config.theme === 'dark' ? '#fff' : '#000';

  container.innerHTML = `
    <img src="${config.imageUrl}" alt="" style="max-width: 100%; border-radius: 8px;"/>
    <h2>${config.headline}</h2>
    <p>${config.subheadline}</p>
    <a href="${config.destinationUrl}" target="_blank" style="
      display: inline-block;
      background: #6c5ce7;
      color: #fff;
      padding: 10px 16px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
    ">${config.ctaText}</a>
  `;

  currentScript?.parentNode?.insertBefore(container, currentScript.nextSibling);

  console.log('✅ ScrollFrame ad rendered successfully');
})();
