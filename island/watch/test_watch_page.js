// Local test of watch.html with a stand-in for claude.ai's page database. Feeds the chunk files
// from a run's --live-dir one at a time (as the relay does) and checks the page follows along.
//   node watch/test_watch_page.js live   (after: node watch/build_watch_page.js)
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const liveDir = path.resolve(process.argv[2] || 'live'), out = path.join(__dirname, '..', 'tests', 'output'); fs.mkdirSync(out, { recursive: true });
const html = '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(__dirname, 'watch.html'), 'utf8') + '</body></html>';
const shim = `(() => { const store = {}, subs = [];
  const notify = () => subs.forEach(s => s());
  window.__dbPut = (p, id, d) => { (store[p] = store[p] || {})[id] = d; notify(); };
  window.__writes = [];
  const snapDoc = (p, id) => ({ id, exists: !!(store[p] && store[p][id]), data: () => store[p] && store[p][id], metadata: {} });
  const coll = (p) => { let ord = null; const q = { orderBy(f) { ord = f; return q; }, limit() { return q; },
      onSnapshot(next) { const seen = new Set(); const fire = () => { const docs = Object.keys(store[p] || {}).map(id => snapDoc(p, id)).sort((a, b) => (a.data()[ord] || 0) - (b.data()[ord] || 0));
        const ch = docs.filter(d => !seen.has(d.id)).map(d => (seen.add(d.id), { type: 'added', doc: d })); next({ docs, size: docs.length, empty: !docs.length, docChanges: () => ch, metadata: {} }); };
        subs.push(fire); setTimeout(fire, 0); return () => {}; },
      doc(id) { return { onSnapshot(next) { const f = () => next(snapDoc(p, id)); subs.push(f); setTimeout(f, 0); return () => {}; }, async set(d) { window.__writes.push({ p, id, d }); window.__dbPut(p, id, d); } }; } }; return q; };
  window.claude = { use: async (n) => n === 'db' ? { collection: coll } : n === 'user' ? { isOwner: async () => true } : null }; })();`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const tmp = path.join(require('os').tmpdir(), 'watch-test.html'); fs.writeFileSync(tmp, html); await p.addInitScript(shim); await p.goto('file://' + tmp); await p.waitForTimeout(1500);
  const waiting = await p.textContent('#liveStatus');
  const cur = JSON.parse(fs.readFileSync(path.join(liveDir, 'current.json'), 'utf8'));
  await p.evaluate(m => __dbPut('live', 'current', Object.assign({}, m, { status: 'running' })), cur);
  const chunks = fs.readdirSync(liveDir).filter(f => /^chunk-\d+\.json$/.test(f)).sort();
  const seen = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = JSON.parse(fs.readFileSync(path.join(liveDir, chunks[i]), 'utf8')); c.wall = new Date().toISOString();
    await p.evaluate(([id, c]) => __dbPut('runs/' + c.runId + '/chunks', id, c), ['c' + String(c.n).padStart(4, '0'), c]);
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => ({ t: document.getElementById('rpTime').textContent, clock: document.getElementById('elapsed').textContent, act: document.getElementById('actLabel').textContent, logN: document.querySelectorAll('#logList .le').length, j: document.getElementById('journalList').innerText.slice(0, 60) }));
    seen.push(st); if (i === 2) await p.screenshot({ path: path.join(out, 'watch_phone_live.png') });
  }
  if (fs.existsSync(path.join(liveDir, 'final.json'))) { const f = JSON.parse(fs.readFileSync(path.join(liveDir, 'final.json'), 'utf8'));
    await p.evaluate(([cur, f]) => { __dbPut('runs/' + cur.runId + '/final', 'report', f); __dbPut('live', 'current', Object.assign({}, cur, { status: 'ended', reportReady: true })); }, [cur, f]); }
  await p.waitForTimeout(1500);
  // Stop button (two taps) writes control/stop
  const stopVisible = await p.isVisible('#expStop');
  await p.evaluate(() => document.getElementById('rpSlider').value);
  await p.screenshot({ path: path.join(out, 'watch_phone_end.png') });
  // scrub the timeline & Report button
  await p.evaluate(() => { const s = document.getElementById('rpSlider'); s.value = 500; s.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(800); const mid = await p.textContent('#rpTime');
  console.log('WIDTH', await p.evaluate(()=>{const W=window.innerWidth;const out=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>391&&r.width>0)out.push(e.tagName+'#'+e.id+'.'+e.className+' right='+Math.round(r.right)+' w='+Math.round(r.width))});return 'inner '+W+' scroll '+document.documentElement.scrollWidth+' | '+out.slice(0,8).join(' | ')}));
  const hasReport = await p.isVisible('#rpReport'); if (hasReport) { await p.click('#rpReport'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(out, 'watch_phone_report.png') }); console.log('hit:', await p.evaluate(() => { const b = document.getElementById('rptClose').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return JSON.stringify(b) + ' ' + (e ? e.outerHTML.slice(0, 200) : 'none'); })); await p.click('#rptClose'); }
  console.log(JSON.stringify({ waiting, progress: seen.map(x => x.t + ' | ' + x.clock + ' | ' + x.act + ' | log ' + x.logN), journal: seen[seen.length - 1].j, scrubbedTo: mid, reportButton: hasReport, errors: errs }, null, 1));
  // separate: stop button flow while running
  await p.evaluate(m => __dbPut('live', 'current', Object.assign({}, m, { runId: m.runId, status: 'running' })), cur);
  const c9 = JSON.parse(fs.readFileSync(path.join(liveDir, chunks[0]), 'utf8')); c9.meta = { status: 'running' };
  await p.waitForTimeout(500); const vis = await p.isVisible('#expStop');
  if (vis) { await p.click('#expStop'); await p.click('#expStop'); await p.waitForTimeout(300); }
  console.log('stop button visible while running:', vis, 'writes:', JSON.stringify(await p.evaluate(() => window.__writes)));
  await b.close();
})();
