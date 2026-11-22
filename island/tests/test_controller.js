// Tests for the AI-controller features of the island, plus an audit of a recorded run.
//   node tests/test_controller.js                 (island-side checks)
//   node tests/test_controller.js runs/<run-dir>  (also audits that run's records)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.resolve(__dirname, '..', 'island.html');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE); await page.waitForFunction(() => window.Island);
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => { window.fast = a => { const r = Island.submitAction(a); if (!r.ok) return r; for (let i = 0; i < 4000; i++) { Island.advanceTime(2); if (!Island.getStatus().action) break; } return Island.getStatus().lastResult; }; });

  // C1. Start Experiment panel
  const p = ev(() => Island.showExperimentSetup({ info: 'test', models: [{ id: 'gpt-5-mini', label: 'gpt-5-mini' }, { id: 'MOCK', label: 'MOCK' }], defaultModel: 'gpt-5-mini', defaultMaxCost: 1.5 }));
  await page.waitForSelector('#expSetup', { state: 'visible' });
  await page.selectOption('#esObs', 'aerial'); await page.fill('#esCost', '3'); await page.check('#esVideo');
  const note = await page.textContent('#esObsNote');
  await page.click('#esGo');
  const ch = await p;
  check('C1. Start Experiment panel returns the chosen settings', !ch.cancelled && ch.start === 'fresh' && ch.obsMode === 'aerial' && ch.maxCostUsd === 3 && ch.video === true && /including things a person on the beach could not see/.test(note), JSON.stringify(ch));

  // C2. hidden names cannot be probed
  const a = await ev(() => Island.submitAction({ type: 'pick_up', target: 'brass_key' }));
  const b = await ev(() => Island.submitAction({ type: 'pick_up', target: 'zzz_nothing' }));
  const c = await ev(() => Island.submitAction({ type: 'walk_to', target: 'lighter' }));
  check('C2. Undiscovered and non-existent targets get the same reply', !a.ok && !b.ok && a.error.replace('brass_key', 'X') === b.error.replace('zzz_nothing', 'X') && !c.ok, a.error + ' | ' + c.error);

  // C3. invalid replacement leaves the current action running; valid one replaces it
  await ev(() => Island.setSpeed(1));
  await ev(() => Island.submitAction({ type: 'walk', direction: 'N', distance: 200 }));
  const bad = await ev(() => Island.submitAction({ type: 'climb', interruptCurrent: true }));
  const stillWalking = await ev(() => Island.getStatus().action && Island.getStatus().action.type);
  const good = await ev(() => Island.submitAction({ type: 'look', interruptCurrent: true }));
  const nowType = await ev(() => Island.getStatus().action && Island.getStatus().action.type);
  check('C3. Rejected replacement keeps the current action; accepted one replaces it', !bad.ok && stillWalking === 'walk' && good.ok && nowType === 'look', bad.error);

  // C4. deadline with an action in progress
  await ev(() => { Island.reset(); Island.startRun({ durationSec: 60 }); fast({ type: 'write_journal', text: 'first' }); Island.submitAction({ type: 'walk_to', target: 'crate' }); Island.advanceTime(80); });
  const dl = await ev(() => { const L = Island.exportLog(); const it = L.filter(e => e.kind === 'interrupt').pop(); return { st: Island.getStatus(), it, after: Island.submitAction({ type: 'look' }) }; });
  check('C4. At the deadline the action is interrupted where it is and new actions are refused', dl.st.run.ended && dl.st.run.elapsedSec === 60 && dl.it && dl.it.data.result.progressAtStop > 0 && dl.it.data.result.progressAtStop < 1 && !dl.after.ok && dl.after.code === 'run_over', `${dl.it && dl.it.msg} | progress ${dl.it && dl.it.data.result.progressAtStop} | after: ${dl.after.error}`);

  // C5. saved island: physical changes kept, history hidden, fresh journal
  await ev(() => { Island.reset(); fast({ type: 'write_journal', text: 'Secret note from agent one.' }); fast({ type: 'walk_to', target: 'crate' }); fast({ type: 'open', target: 'crate' }); fast({ type: 'pick_up', target: 'tin_cup' }); fast({ type: 'walk_to', target: 'rope' }); fast({ type: 'pick_up', target: 'rope' }); fast({ type: 'walk', direction: 'N', distance: 60 }); Island.addReflection('agent one reflection'); });
  const save1 = await ev(() => Island.saveRun());
  const inh = await ev(s => Island.inheritWorld(s, { sourceLabel: 'test-save.json' }), save1);
  const st2 = await ev(() => Island.exportState());
  const obs2 = await ev(() => Island.getObservation());
  const log2 = await ev(() => Island.exportLog());
  const rd = await ev(p => { fast({ type: 'walk_to', x: p.x, y: p.y }); return Island.getObservation(); }, { x: save1.state.agent.x, y: save1.state.agent.y });
  const oldJ = st2.objects.old_journal_1;
  check('C5a. Saved island keeps physical changes (crate open, items moved)', st2.objects.crate.container.open && st2.objects.rope.loc.t === 'ground' && Math.abs(st2.objects.rope.loc.x - save1.state.agent.x) < 3 && inh.carriedItemsLeft.includes('tin_cup'), 'left at previous final position: ' + inh.carriedItemsLeft.join(', '));
  check('C5b. New agent: beside the boat, fresh blank journal + pencil, no reflections or memory', st2.agent.x === 268 && st2.journal.entries.length === 0 && st2.objects.journal.loc.t === 'carried' && st2.reflections.length === 0 && Object.keys(st2.seen).every(k => k.startsWith('feature:') ? obs2.terrainFeatures.some(f => 'feature:' + f.id === k) : obs2.visibleObjects.some(o => o.id === k)), 'remembers only what is visible on arrival: ' + Object.keys(st2.seen).length + ' things');
  check('C5c. Previous journal stays on the island as a physical object; its writing is only found by reading it', oldJ && oldJ.readable.includes('Secret note') && !JSON.stringify(obs2).includes('Secret note') && rd.visibleObjects.some(o => o.id === 'old_journal_1'), 'old_journal_1 at ' + (oldJ && JSON.stringify(oldJ.loc)));
  check('C5d. The new run\'s log and agent observations contain none of the previous run\'s events', log2.length <= 2 && !JSON.stringify(log2).includes('agent one') && !JSON.stringify(obs2).includes('agent one'), log2.map(e => e.msg).join(' | ').slice(0, 160));
  const inhR = await ev(s => Island.inheritWorld(s, { priorJournal: 'remove' }), save1);
  check('C5e. Option to remove the previous journal', inhR.ok && !(await ev(() => Island.exportState().objects.old_journal_1)), '');

  // C6. controller notes appear in the log as CTRL
  await ev(() => Island.controllerNote('test note'));
  await page.waitForTimeout(500);
  check('C6. Controller notes are logged separately (CTRL)', (await ev(() => document.getElementById('logList').innerText)).includes('CTRL'), '');

  // C7. Stop experiment button sets the flag the controller polls
  await ev(() => Island.setExperimentBanner('AI: test'));
  page.once('dialog', d => d.accept());
  await page.click('#expStop');
  check('C7. "Stop experiment" button is shown during a run and signals the controller', await ev(() => Island.experimentStopRequested()), '');

  // ---------- audit a recorded run ----------
  const runDir = process.argv[2];
  if (runDir) {
    const rdp = p => path.join(runDir, p);
    const tr = fs.readFileSync(rdp('transcript.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const log = JSON.parse(fs.readFileSync(rdp('island-log.json'), 'utf8'));
    const cfg = JSON.parse(fs.readFileSync(rdp('config.json'), 'utf8'));
    const sent = tr.filter(t => t.kind === 'decision' || t.kind === 'checkin');
    // A1: nothing resembling the full world state was ever sent
    const forbidden = ['"objects":{', '"nextActionId"', '"history"', '"seen"', '"loc":{"t"', 'underwater', '"trail"', 'old_journal'];
    const leaks = sent.filter(t => forbidden.some(f => (t.sentToAgent || '').includes(f)));
    // A2: ladder-top items never mentioned before the agent was high on the ladder
    const firstHigh = log.find(e => e.kind === 'move' && /Climbing: 75|Reached the platform/.test(e.msg));
    const tHigh = firstHigh ? firstHigh.sim : Infinity;
    const early = sent.filter(t => t.simAtRequest < tHigh && /"id":"(lighter|sword|snorkel)"/.test(t.sentToAgent || ''));
    // A3: the key-bearing pond, chest contents etc. not revealed: brass_key never appears unless looked underwater
    const lookedUnder = log.some(e => /Looked underwater/.test(e.msg));
    const keyLeak = !lookedUnder && sent.some(t => /brass_key/.test(t.sentToAgent || ''));
    check('A1. Agent was never sent full world state', sent.length > 0 && leaks.length === 0, `${sent.length} observations checked`);
    check('A2. Ladder-top items not revealed before the agent climbed high', early.length === 0, firstHigh ? 'agent got high at ' + firstHigh.sim + ' s' : 'agent never climbed high');
    check('A3. Hidden key never revealed without looking underwater', !keyLeak, '');
    // A4: system prompt is neutral (no object names) and intro verbatim
    const objNames = ['ladder', 'cabin', 'bell', 'chest', 'key', 'map', 'snorkel', 'sword', 'lighter', 'tower', 'pond', 'mirror'];
    const named = objNames.filter(n => new RegExp('\\b' + n + '\\b', 'i').test(cfg.systemPrompt.replace(cfg.introduction, '')));
    check('A4. Agent instructions are neutral (no objects named beyond the given introduction)', named.length === 0 && cfg.systemPrompt.startsWith(cfg.introduction), named.join(', ') || 'none named');
    // A5: every accepted request matches what the model chose (no substitution)
    const reqs = log.filter(e => e.kind === 'request').map(e => e.data.request);
    const chosen = sent.map(t => t.reply && t.reply.action).filter(Boolean).map(a => a.type);
    check('A5. Every action request came from the model\'s own choice (no substitutes)', reqs.length === chosen.length && reqs.every((r, i) => r.type === chosen[i]), `${reqs.length} requests vs ${chosen.length} chosen`);
    // A6: replay matches logged positions
    await page.reload(); await page.waitForFunction(() => window.Island);
    const rep = JSON.parse(fs.readFileSync(rdp('replay.json'), 'utf8'));
    await ev(r => Island.enterReplay(r), rep);
    const pts = log.filter(e => e.kind === 'move' && e.data && typeof e.data.x === 'number');
    let maxErr = 0; for (const e of pts) { const v = await ev(t => { Island.replaySeek(t); return Island.replayView(); }, e.sim); maxErr = Math.max(maxErr, Math.hypot(v.agent.x - e.data.x, v.agent.y - e.data.y)); }
    const endV = await ev(t => { Island.replaySeek(t); return Island.replayView(); }, rep.endSim);
    const fin = JSON.parse(fs.readFileSync(rdp('state-at-end.json'), 'utf8'));
    check('A6. Replay reconstructs the recorded positions and end state', maxErr < 1 && endV.journal.entries.length === fin.journal.entries.length && Math.hypot(endV.agent.x - fin.agent.x, endV.agent.y - fin.agent.y) < 1, `${pts.length} logged positions, max error ${maxErr.toFixed(2)} ft`);
    // A7: journal entries and reflections were recorded during the run, at the time they happened
    const jl = log.filter(e => e.kind === 'journal' && /entry #/.test(e.msg)), rl = log.filter(e => e.kind === 'reflection');
    const tm = tr.filter(t => t.reply && (t.reply.say || t.reply.reflection) && (t.kind === 'decision' || t.kind === 'checkin') && t.simAtReply <= JSON.parse(fs.readFileSync(rdp('state-at-end.json'),'utf8')).run.endSim + 0.5);
    check('A7. Journal entries and reflections were logged during the run, when they happened', jl.every(e => e.sim <= fin.run.endSim) && rl.length === tm.length && rl.every((e, i) => Math.abs(e.sim - tm[i].simAtReply) < 3), `${jl.length} journal entries, ${rl.length} reflections`);
    // A8: no secrets in any file
    const files = fs.readdirSync(runDir).filter(f => /\.(json|jsonl|md|txt)$/.test(f));
    const secret = files.filter(f => /sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9_-]{16,}/.test(fs.readFileSync(rdp(f), 'utf8')));
    check('A8. No credentials in any run file', secret.length === 0, files.length + ' files scanned');
  }
  check('Z. No page errors', errors.length === 0, errors.join(' | '));
  const passed = results.filter(r => r.ok).length; console.log(`\n${passed}/${results.length} checks passed`);
  await browser.close(); process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
