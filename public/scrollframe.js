(async () => {
  console.log('scrollframe.js loaded');

  // 1. Get the <script> tag that loaded this file
  const currentScript = document.currentScript;
  const unitId = currentScript?.getAttribute('data-unit-id');

  if (!unitId) {
    console.error('❌ No data-unit-id found in embed script tag.');
    return;
  }

  // 2. Fetch config from Supabase (public read)
  const res = await fetch(`https://mynqhurabkihzyqweyet.supabase.co/rest/v1/channel_partner_units?select=config&unit_id=eq.${unitId}`, {
    headers: {
      apikey: 'YOUR_ANON_KEY_HERE' // 🔐 Replace with actual anon key from Supabase
    },
  });

  const data = await res.json();
  const config = data?.[0]?.config;

  if (!config) {
    console.error('❌ No config found for unit_id:', unitId);
    return;
  }

  console.log('✅ Parsed config:', config);

  // 3. Build ad HTML from config
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

  // 4. Append ad to page (below the script tag)
  currentScript?.parentNode?.insertBefore(container, currentScript.nextSibling);

  console.log('✅ ScrollFrame ad rendered successfully');
})();
