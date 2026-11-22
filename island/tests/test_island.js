// Automated acceptance tests for island.html.
// Run:  node tests/test_island.js        (needs: npm i playwright  &&  npx playwright install chromium)
// Writes screenshots and downloaded files to tests/output/ and prints a PASS/FAIL report.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, '..', 'island.html');
const OUT = path.resolve(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });

  // ---------- 9. offline: block the network entirely before loading ----------
  await context.setOffline(true);
  await context.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
  await page.goto(FILE);
  await page.waitForFunction(() => window.Island && Island.getStatus);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (n, follow) => { if (follow !== undefined) await page.click(follow ? '#btnFollow' : '#btnFit'); await sleep(follow !== undefined ? 700 : 150); await page.screenshot({ path: path.join(OUT, n + '.png') }); };
  const waitIdle = async (maxMs = 120000) => { const t = Date.now(); while (Date.now() - t < maxMs) { const s = await ev(() => Island.getStatus()); if (!s.action) return s; await sleep(100); } throw new Error('timeout waiting for action'); };
  // Run an action to completion quickly using the test-only clock jump (keeps tests fast).
  const doFast = async (a) => { const r = await ev(x => Island.submitAction(x), a); if (!r.ok) return r; for (let i = 0; i < 4000; i++) { const s = await ev(() => { Island.advanceTime(2); return Island.getStatus(); }); if (!s.action) return Object.assign(r, { result: s.lastResult }); } return r; };
  await shot('01_initial');
  check('9. Opens with no network (offline, all remote requests blocked)', requests.length === 0 && errors.length === 0, 'remote requests: ' + requests.length + ', console errors: ' + errors.length);
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'island.html'), 'utf8');
  check('9b. File references no remote URLs (http/https)', !/(src|href)\s*=\s*["']https?:/i.test(html) && !/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(html), 'no remote src/href, fetch, XHR, WebSocket or beacon');

  // ---------- 1. interface ----------
  const ui = await ev(() => ({ log: document.querySelectorAll('#logList .le').length, clock: document.getElementById('remain').textContent, journal: document.getElementById('journalList').textContent }));
  check('1. Interface shows clock, log and journal panels', ui.log > 0 && ui.clock === '30:00' && /blank/.test(ui.journal), JSON.stringify(ui));
  const obs0 = await ev(() => Island.getObservation());
  const boatD = obs0.visibleObjects.find(o => o.id === 'boat').distanceFt;
  check('1b. Agent starts beside the boat with journal + pencil', boatD <= 15 && obs0.self.carrying.map(c => c.id).join() === 'journal,pencil' && obs0.self.underfoot === 'sandy beach', 'boat ' + boatD + ' ft away, carrying ' + obs0.self.carrying.map(c => c.id));

  // ---------- 6. perception: ladder-top objects hidden from the beach ----------
  const obsStr = JSON.stringify(obs0);
  check('6. Beach observation does NOT reveal lighter, sword or snorkel', !/lighter|sword|snorkel/.test(obsStr), 'platform note: ' + (obs0.notes[0] || '') );

  // ---------- 2. movement rate in REAL TIME (1x) ----------
  // Walk on flat grass. First get to a flat grass start point quickly, then measure at 1x.
  await ev(() => Island.setSpeed(60));
  let r = await doFast({ type: 'walk_to', x: 380, y: 660 });
  const flat = await ev(() => ({ t: Island._debug.terrainAt(380, 660), h1: Island._debug.heightAt(380, 660), h2: Island._debug.heightAt(440, 660), t2: Island._debug.terrainAt(440, 660) }));
  await ev(() => Island.setSpeed(1));
  const before = await ev(() => Island.getObservation().self.position);
  r = await ev(() => Island.submitAction({ type: 'walk_to', x: 460, y: 660 }));
  const tA = Date.now(); const simA = (await ev(() => Island.getStatus())).simTimeSec;
  await shot('02a_walk_start', true);
  await sleep(5000); await shot('02b_walk_5s');
  await sleep(5000);
  const mid = await ev(() => ({ p: Island.getObservation().self.position, s: Island.getStatus() }));
  const wallS = (Date.now() - tA) / 1000, simS = mid.s.simTimeSec - simA;
  const moved = Math.hypot(mid.p.x - before.x, mid.p.y - before.y);
  check('2. Real-time walking speed ≈ 4 ft/s on level grass', Math.abs(moved / simS - 4) < 0.35 && Math.abs(simS - wallS) < 0.6, `moved ${moved.toFixed(1)} ft in ${simS.toFixed(2)} sim s (${wallS.toFixed(2)} wall s) = ${(moved / simS).toFixed(2)} ft/s; terrain ${flat.t}, rise ${(flat.h2 - flat.h1).toFixed(1)} ft over 60 ft; est total ${r.estimatedDurationSec}s for 80 ft`);
  // interrupt mid-walk -> stays at actual intermediate position
  const intr = await ev(() => { const i = Island.interrupt(); return { i, p: Island.getObservation().self.position }; });
  await sleep(1500);
  const after = await ev(() => Island.getObservation().self.position);
  check('2b. Interrupt leaves agent at its intermediate position', intr.i.ok && Math.abs(after.x - intr.p.x) < 0.01 && intr.p.x > 380.5 && intr.p.x < 459, `stopped at x=${intr.p.x}, still ${after.x} 1.5 s later`);
  // 300 ft estimate on the beach vs grass
  const est = await ev(() => { const r = Island.submitAction({ type: 'walk', direction: 'E', distance: 300 }); Island.interrupt(); return r; });
  check('2c. 300 ft walk estimate is plausible (≈75 s on clear ground, longer on rough/sloped ground)', est.ok && est.estimatedDurationSec >= 70 && est.estimatedDurationSec < 140, 'estimated ' + est.estimatedDurationSec + ' s: ' + est.label);

  // ---------- 3. climbing progress ----------
  await ev(() => Island.setSpeed(60));
  await doFast({ type: 'walk_to', target: 'cabin_door' });
  const logMark = await ev(() => Island.exportLog().length);
  r = await doFast({ type: 'walk_to', target: 'ladder' });
  check('3a. Walk from the cabin to the ladder succeeds', r.ok && /Arrived/.test(r.result.result.message), r.result && r.result.result.message);
  const bridgeLog = await ev(m => Island.exportLog().slice(m).some(e => /wooden bridge/.test(e.msg)), logMark);
  check('3a2. Route used the bridge rather than wading', bridgeLog, 'log mentions bridge: ' + bridgeLog);
  await ev(() => Island.setSpeed(1));
  r = await ev(() => Island.submitAction({ type: 'climb' }));
  check('3b. Climb estimate ≈ 4 minutes for 100 ft', r.ok && Math.abs(r.estimatedDurationSec - 240) < 3, r.estimatedDurationSec + ' s');
  await sleep(6000);
  let h1 = await ev(() => Island.getObservation().self.heightAboveGroundFt);
  check('3c. Real-time climb rate ≈ 0.42 ft/s', h1 > 1.9 && h1 < 3.1, h1 + ' ft after ~6 s');
  await ev(() => Island.setSpeed(30));
  await sleep(4000); // ~ +120 s sim
  const hMid = await ev(() => Island.getObservation().self.heightAboveGroundFt);
  await shot('03a_climbing_mid', true);
  const elevPx = await ev(() => { const c = document.getElementById('elev'); return c.toDataURL().length; });
  check('3d. Climb progress visible mid-way (height increases; side gauge drawn)', hMid > 30 && hMid < 99 && elevPx > 2000, 'height ' + hMid + ' ft (screenshot 03a)');
  const ladderObs = await ev(() => Island.getObservation());
  check('3e. Mid-ladder actions are restricted (cannot pick things up)', !(await ev(() => Island.submitAction({ type: 'pick_up', target: 'stone_1' }))).ok, ladderObs.notes.join(' '));
  await waitIdle(30000);
  const top = await ev(() => Island.getObservation());
  await shot('03b_platform', true);
  check('3f. Reached platform at 100 ft', top.self.level === 'platform' && top.self.heightAboveGroundFt === 100, top.self.level + ' ' + top.self.heightAboveGroundFt);
  check('6b. On the platform the lighter, sword and snorkel ARE visible', ['lighter', 'sword', 'snorkel'].every(id => top.visibleObjects.some(o => o.id === id && o.reachable)), top.visibleObjects.filter(o => o.location.includes('platform table')).map(o => o.id).join(', '));

  // ---------- 4. objects keep their state ----------
  await ev(() => Island.setSpeed(60));
  await doFast({ type: 'pick_up', target: 'snorkel' });
  await doFast({ type: 'wear', target: 'snorkel' });
  await doFast({ type: 'pick_up', target: 'sword' });
  const noDesc = await ev(() => Island.submitAction({ type: 'descend' }));
  check('4a. Cannot descend holding the sword (needs both hands)', !noDesc.ok && /both hands/.test(noDesc.error), noDesc.error);
  await doFast({ type: 'put_down', target: 'sword' });           // stays on the platform
  await doFast({ type: 'pick_up', target: 'lighter' });
  r = await doFast({ type: 'descend' });
  await doFast({ type: 'walk_to', target: 'boat' });
  r = await doFast({ type: 'put_down', target: 'lighter', onto: 'boat' });
  await doFast({ type: 'walk_to', x: 560, y: 560 });
  await ev(() => Island.advanceTime(300));
  const st = await ev(() => { const s = Island.exportState(); return { sword: s.objects.sword.loc, lighter: s.objects.lighter.loc, snorkel: s.objects.snorkel.loc }; });
  check('4b. Objects stay where placed (sword on platform, lighter in boat, snorkel worn)', st.sword.t === 'on' && st.sword.id === 'platform' && st.lighter.t === 'in' && st.lighter.id === 'boat' && st.snorkel.t === 'worn', JSON.stringify(st));
  // underwater key with snorkel
  await doFast({ type: 'walk_to', x: 516, y: 425 });
  const k0 = await ev(() => Island.getObservation().visibleObjects.some(o => o.id === 'brass_key'));
  r = await doFast({ type: 'use', target: 'snorkel' });
  const k1 = await ev(() => Island.getObservation().visibleObjects.some(o => o.id === 'brass_key'));
  r = await doFast({ type: 'pick_up', target: 'brass_key' });
  check('4c. Key in pond only visible after looking underwater, then can be picked up', !k0 && k1 && r.result.status === 'completed', `before ${k0}, after ${k1}, pickup ${r.result.status}`);
  // cabin: door, locked chest, key, fragile lantern
  const shut = await ev(() => Island.submitAction({ type: 'walk_to', target: 'cabin_table' }));
  check('4d. Cannot walk into the cabin while the door is closed', !shut.ok, shut.error);
  const shut2 = await ev(() => { Island.submitAction({ type: 'walk_to', target: 'cabin_door' }); Island.advanceTime(400); return Island.submitAction({ type: 'walk_to', x: 267, y: 410 }); });
  check('4d2. Walking to a point inside the closed cabin is refused', !shut2.ok, shut2.error);
  await doFast({ type: 'walk_to', target: 'cabin_door' });
  await doFast({ type: 'open', target: 'cabin_door' });
  await doFast({ type: 'walk_to', target: 'chest' });
  const lockd = await doFast({ type: 'open', target: 'chest' });
  await doFast({ type: 'use', target: 'brass_key', with: 'chest' });
  const opened = await doFast({ type: 'open', target: 'chest' });
  check('4e. Locked chest fails to open; opens after unlocking with key', lockd.result.status === 'failed' && opened.result.status === 'completed', opened.result.result.message);
  await doFast({ type: 'walk_to', target: 'cabin_door' });
  await doFast({ type: 'walk_to', target: 'cabin_table' });
  await doFast({ type: 'pick_up', target: 'lantern' });
  const drop = await doFast({ type: 'drop', target: 'lantern' });
  const ln = await ev(() => Island.exportState().objects.lantern);
  check('4f. Dropping the glass lantern breaks it, and it stays broken', ln.state.broken && ln.loc.t === 'ground', drop.result.result.message);
  const unsup = await ev(() => Island.submitAction({ type: 'use', target: 'cabin_table' }));
  const unsup2 = await ev(() => Island.submitAction({ type: 'swim' }));
  check('4g. Unsupported actions return a clear message', !unsup.ok && /No behavior is implemented/.test(unsup.error) && !unsup2.ok && /Unsupported/.test(unsup2.error), unsup.error + ' | ' + unsup2.error.slice(0, 60));
  await shot('04_cabin_open', true);

  // ---------- 4h. objects from the reference image ----------
  await doFast({ type: 'walk_to', x: 215, y: 540 });
  await doFast({ type: 'walk_to', target: 'wheelbarrow' });
  const wb1 = await doFast({ type: 'pick_up', target: 'wheelbarrow' });
  await doFast({ type: 'walk_to', target: 'picnic_table' });
  await doFast({ type: 'put_down', target: 'wheelbarrow' });
  const rd = await doFast({ type: 'read', target: 'island_map' });
  await doFast({ type: 'pick_up', target: 'island_map' });
  await doFast({ type: 'put_down', target: 'island_map', onto: 'wheelbarrow' });
  await doFast({ type: 'pick_up', target: 'wheelbarrow' });
  const slow = await ev(() => Island.submitAction({ type: 'walk_to', x: 600, y: 600 }));
  for (let i = 0; i < 400; i++) { const s = await ev(() => { Island.advanceTime(2); return Island.getStatus(); }); if (!s.action) break; }
  await doFast({ type: 'put_down', target: 'wheelbarrow' });
  const wbs = await ev(() => { const s = Island.exportState(); return { wb: s.objects.wheelbarrow.loc, map: s.objects.island_map.loc }; });
  await doFast({ type: 'walk_to', target: 'blanket' });
  const bl = await doFast({ type: 'use', target: 'blanket' });
  await doFast({ type: 'walk_to', x: 700, y: 600 });
  await doFast({ type: 'walk_to', target: 'blocks' });
  const bk = await doFast({ type: 'use', target: 'blocks' });
  const st2 = await ev(() => { const s = Island.exportState().objects; return { blanket: s.blanket.state.spread, blocks: s.blocks.state.stacked }; });
  check('4h. Image objects work: wheelbarrow carries contents, map is readable, blanket folds, blocks topple', wb1.result.status === 'completed' && /hand-drawn map/.test(rd.result.result.text || '') && wbs.wb.t === 'ground' && wbs.wb.x > 560 && wbs.map.t === 'in' && wbs.map.id === 'wheelbarrow' && st2.blanket === false && st2.blocks === false,
    `wheelbarrow now at (${Math.round(wbs.wb.x)}, ${Math.round(wbs.wb.y)}) with map inside; pushing estimate ${slow.estimatedDurationSec}s; ${bl.result.result.message} ${bk.result.result.message}`);
  await doFast({ type: 'walk_to', x: 600, y: 700 });
  const cliffWalk = await ev(() => Island.submitAction({ type: 'walk_to', x: 930, y: 560 }));
  check('4i. Cliffs on the east are impassable', !cliffWalk.ok && /cliff/.test(cliffWalk.error), cliffWalk.error);

  // ---------- 5. journal ----------
  r = await doFast({ type: 'write_journal', text: 'The chest held a letter. The lantern broke when I dropped it.' });
  await ev(() => Island.setSpeed(1));
  await ev(() => Island.submitAction({ type: 'write_journal', text: 'This second entry will be interrupted partway through writing it.' }));
  await sleep(6000);
  await ev(() => Island.interrupt());
  await sleep(400);
  const jr = await ev(() => ({ e: Island.exportState().journal.entries, dom: document.getElementById('journalList').innerText }));
  check('5. Journal entries persist in state and appear in the panel (partial text kept on interrupt)', jr.e.length === 2 && jr.e[1].interrupted && jr.dom.includes('The chest held a letter') && jr.dom.includes(jr.e[1].text), `${jr.e.length} entries; #2 = "${jr.e[1] && jr.e[1].text}"`);
  await ev(() => Island.addReflection('I notice I chose to unlock the chest before anything else.'));
  await sleep(400);
  const rf = await ev(() => document.getElementById('reflList').innerText);
  check('5b. Reflections appear in a separate panel', /unlock the chest/.test(rf) && !(await ev(() => document.getElementById('journalList').innerText)).includes('unlock the chest'), 'reflection panel ok');
  await page.click('summary'); await shot('05_panels'); await page.click('summary');

  // ---------- 7. save / restore / reset / exports ----------
  const saved = await ev(() => Island.saveRun());
  const sig = s => JSON.stringify({ a: [s.agent.x, s.agent.y], o: Object.fromEntries(Object.entries(s.objects).map(([k, v]) => [k, v.loc])), j: s.journal.entries.length });
  const sigBefore = sig(saved.state);
  await ev(() => Island.reset());
  const sigReset = sig(await ev(() => Island.exportState()));
  const rr = await ev(s => Island.restoreRun(s), saved);
  const sigRestored = sig(await ev(() => Island.exportState()));
  check('7a. Reset returns to the initial state', sigReset !== sigBefore && (await ev(() => Island.exportState().journal.entries.length)) === 2 ? true : sigReset !== sigBefore, 'reset differs from saved');
  check('7b. Restore brings back the exact saved state', rr.ok && sigRestored === sigBefore, 'match: ' + (sigRestored === sigBefore));
  await page.click('summary');
  const dl = async (sel) => { const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]); const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); return f; };
  const fLog = await dl('#tExpLog'), fCsv = await dl('#tExpLogCsv'), fJ = await dl('#tExpJournal'), fSave = await dl('#tSave'), fRep = await dl('#tExpReplay');
  const logJ = JSON.parse(fs.readFileSync(fLog, 'utf8'));
  const kinds = new Set(logJ.log.map(e => e.kind));
  check('7c. Log export has requests, starts, completions, interruptions, movement, objects, journal, errors and speed', ['request', 'start', 'complete', 'interrupt', 'move', 'object', 'journal', 'rejected', 'system'].every(k => kinds.has(k)) && logJ.log.some(e => /speed changed/i.test(e.msg)) && logJ.log.every(e => e.wall && typeof e.sim === 'number' && e.speed), [...kinds].join(','));
  check('7d. Journal (.txt), CSV log, save file and replay file downloaded', fs.readFileSync(fJ, 'utf8').includes('The chest held a letter') && fs.readFileSync(fCsv, 'utf8').split('\n').length > 20 && fs.statSync(fSave).size > 1000 && fs.statSync(fRep).size > 1000, [fJ, fCsv, fSave, fRep].map(f => path.basename(f)).join(', '));
  // restore from the downloaded file through the UI
  await ev(() => Island.reset());
  await page.click('#tLoad').catch(() => {});
  await page.setInputFiles('#fileIn', fSave);
  await sleep(500);
  check('7e. Restore from a saved file via the UI', sig(await ev(() => Island.exportState())) === sigBefore, '');

  // ---------- 8. replay ----------
  await ev(() => Island.reset({ speed: 1 }));
  await ev(() => Island.startRun());
  const samples = [];
  const plan = [{ type: 'write_journal', text: 'Starting the replay test.' }, { type: 'walk_to', target: 'ladder' }, { type: 'climb' }, { type: 'pick_up', target: 'snorkel' }, { type: 'wear', target: 'snorkel' }, { type: 'descend' }, { type: 'walk', direction: 'S', distance: 60 }];
  for (const a of plan) {
    await ev(x => Island.submitAction(x), a);
    for (let i = 0; i < 4000; i++) { const s = await ev(() => { Island.advanceTime(1.7); const o = Island.exportState(); return { t: o.simTime, x: o.agent.x, y: o.agent.y, h: o.agent.ladderFt, busy: !!o.action }; }); if (i % 5 === 0) samples.push(s); if (!s.busy) break; }
  }
  // interrupt one walk midway so the replay contains an interruption
  await ev(() => Island.submitAction({ type: 'walk_to', target: 'boat' })); await ev(() => Island.advanceTime(20)); await ev(() => Island.interrupt());
  const finalLive = await ev(() => { const s = Island.exportState(); return { t: s.simTime, x: s.agent.x, y: s.agent.y, sn: s.objects.snorkel.loc.t, j: s.journal.entries.length }; });
  samples.push({ t: finalLive.t, x: finalLive.x, y: finalLive.y, h: 0 });
  const rep = await ev(() => Island.exportReplay());
  // reload the page completely, then replay from the exported file (proves replay uses only the file)
  await page.reload(); await page.waitForFunction(() => window.Island);
  const er = await ev(r => Island.enterReplay(r), rep);
  let maxErr = 0, maxH = 0;
  for (const s of samples) { const v = await ev(t => { Island.replaySeek(t); return Island.replayView(); }, s.t); maxErr = Math.max(maxErr, Math.hypot(v.agent.x - s.x, v.agent.y - s.y)); maxH = Math.max(maxH, Math.abs(v.agent.ladderFt - s.h)); }
  const endV = await ev(t => { Island.replaySeek(t + 1); return Island.replayView(); }, finalLive.t);
  check('8a. Replay (after page reload, from exported file) matches live positions', er.ok && maxErr < 1.0 && maxH < 0.6, `${samples.length} samples, max position error ${maxErr.toFixed(3)} ft, max height error ${maxH.toFixed(3)} ft`);
  check('8b. Replay end state matches (objects, journal, final position)', endV.objects.snorkel.loc.t === finalLive.sn && endV.journal.entries.length === finalLive.j && Math.hypot(endV.agent.x - finalLive.x, endV.agent.y - finalLive.y) < 0.5, `snorkel ${endV.objects.snorkel.loc.t}, journal ${endV.journal.entries.length}`);
  const climbT = samples.find(s => s.h > 40 && s.h < 70);
  await ev(t => Island.replaySeek(t), climbT.t); await page.click('#btnFollow'); await sleep(800);
  await page.screenshot({ path: path.join(OUT, '08a_replay_climb.png') });
  // play controls
  await ev(() => { Island.replaySeek(0); }); await page.selectOption('#rpSpeed', '60'); await page.click('#rpPlay'); await sleep(2000);
  const playedTo = await ev(() => Island.replayView().t);
  check('8c. Replay play/pause/timeline/speed controls work', playedTo > 60 && playedTo < 160, 'played to ' + playedTo.toFixed(1) + ' s in 2 s at 60×');
  await page.click('#rpPlay'); await page.click('#btnFit'); await sleep(600);
  await page.screenshot({ path: path.join(OUT, '08b_replay_ui.png') });
  await page.click('#rpExit');

  // ---------- 8d. video recording ----------
  await ev(() => { document.getElementById('tests').open = true; Island.reset({ speed: 10 }); });
  const vs = await ev(() => Island.videoSupported());
  const [vd] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), (async () => {
    await page.click('#tVideo'); await ev(() => Island.submitAction({ type: 'walk_to', target: 'ladder' })); await sleep(6000); await page.click('#tVideo');
  })()]);
  const vf = path.join(OUT, vd.suggestedFilename()); await vd.saveAs(vf);
  const vinfo = await ev(async () => { const v = Island.lastVideo(); const el = document.createElement('video'); el.muted = true; el.src = v.url; await new Promise((res, rej) => { el.onloadeddata = res; el.onerror = () => rej(new Error('decode failed')); setTimeout(res, 5000); }); return { bytes: v.bytes, type: v.type, w: el.videoWidth, h: el.videoHeight, ready: el.readyState }; });
  check('8d. Video recording produces a playable file', vinfo.bytes > 20000 && vinfo.w === 1280 && vinfo.h === 720, `${path.basename(vf)} ${(vinfo.bytes / 1024).toFixed(0)} KB, ${vinfo.type}, ${vinfo.w}x${vinfo.h}, readyState ${vinfo.ready}, codec ${vs}`);
  // grab a frame from the video to look at
  const frame = await ev(async () => { const v = Island.lastVideo(); const el = document.createElement('video'); el.muted = true; el.src = v.url; await new Promise(r => { el.onloadeddata = r; }); el.currentTime = 3; await new Promise(r => { el.onseeked = r; setTimeout(r, 2000); }); const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').drawImage(el, 0, 0); return c.toDataURL('image/png'); });
  fs.writeFileSync(path.join(OUT, '09_video_frame.png'), Buffer.from(frame.split(',')[1], 'base64'));

  check('Z. No console/page errors during all tests', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('Z2. No network requests during all tests', requests.length === 0, requests.slice(0, 3).join(' | '));
  const passed = results.filter(r => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(OUT, 'test-report.json'), JSON.stringify({ when: new Date().toISOString(), passed, total: results.length, results }, null, 2));
  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
