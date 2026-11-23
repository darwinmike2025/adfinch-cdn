#!/usr/bin/env node
// Runs an AI agent on the Watchable Island.
//
// The island (island.html) stays in charge of time, movement, objects and consequences. This
// controller only: shows the setup panel, sends the agent ITS OWN observations, passes the agent's
// chosen action to the island, and records everything. The agent gets no tools other than island
// actions and no access to files, credentials or the internet.
//
//   npm i playwright && npx playwright install chromium
//   export OPENAI_API_KEY=...            (never put the key in a file in this folder)
//   node controller/run_experiment.js     (opens the island and the "Start experiment" panel)
//
// Useful flags (see README): --model gpt-5-mini --obs text|aerial --max-cost 2 --video
//   --start fresh|saved --saved runs/<run>/island-save-at-end.json --prior-journal keep|remove
//   --provider mock (no AI)   --minutes 3 / --speed 10 (TEST runs, labelled)   --headless --auto-start
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const P = require('./agent_prompt');
const { makeProvider, priceFor, costOf } = require('./providers');

// ---------------- options ----------------
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); if (i < 0) return d; const v = argv[i + 1]; return (v === undefined || v.startsWith('--')) ? true : v; };
const flag = n => argv.includes('--' + n);
const opts = {
  provider: arg('provider', 'openai'), model: arg('model', 'gpt-5-mini'), reasoning: arg('reasoning', 'low'),
  obsMode: arg('obs', 'text'), minutes: +arg('minutes', 30), speed: +arg('speed', 1),
  maxCost: +arg('max-cost', 2), maxCalls: +arg('max-calls', 600), checkin: +arg('checkin', 30), timeoutSec: +arg('timeout', 90),
  headless: flag('headless'), autoStart: flag('auto-start'), start: arg('start', 'fresh'), saved: arg('saved', null),
  priorJournal: arg('prior-journal', 'keep'), video: flag('video'), historyTurns: +arg('history', 60),
  report: !flag('no-report'), check: !flag('no-check'), out: path.resolve(arg('out', path.join(__dirname, '..', 'runs'))),
  startAt: arg('start-at', 'beach'), predator: flag('predator'), pair: flag('pair'), seed: +arg('world-seed', 20261122),
  liveDir: arg('live-dir', null), liveInterval: +arg('live-interval', 20),
  priceIn: arg('price-in', null), priceOut: arg('price-out', null), mockSeed: +arg('seed', 7),
};
// A frozen protocol (controller/protocols/<v>.json) fixes every setting for comparable runs.
const PROTO = arg('protocol', null) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'protocols', arg('protocol') + '.json'), 'utf8')) : null;
if (PROTO) Object.assign(opts, { model: PROTO.model, reasoning: PROTO.reasoning, minutes: PROTO.minutes, pair: !!PROTO.pair, obsMode: PROTO.observationMode, predator: !!PROTO.predator, seed: PROTO.worldSeed, checkin: PROTO.checkinSeconds, historyTurns: PROTO.historyTurns, maxCost: PROTO.maxCostUsd, noLetters: !!PROTO.removeLetters, menu: PROTO.menu, speed: 1 });
if (PROTO && arg('test-minutes', null)) opts.minutes = +arg('test-minutes'); // TEST ONLY: shorter run under a protocol (labelled TEST)
if (PROTO && arg('test-speed', null)) opts.speed = +arg('test-speed');
if (PROTO && arg('test-history', null)) opts.historyTurns = +arg('test-history');
const ISLAND = 'file://' + path.resolve(__dirname, '..', 'island.html');
const AERIAL = path.resolve(__dirname, '..', 'screenshots', 'reference-image.png');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
let stopFlag = null;
process.on('SIGINT', () => { if (stopFlag) process.exit(130); stopFlag = 'interrupted (Ctrl+C in the controller)'; console.log('\nStopping… (press Ctrl+C again to quit immediately)'); });

async function listOpenAIModels() {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY } });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    const j = await r.json();
    return j.data.map(m => m.id).filter(id => /^(gpt-4o|gpt-4\.1|gpt-5|gpt-6|o3|o4)/.test(id) && !/(audio|realtime|transcribe|tts|search|image|codex|pro|\d{4}-\d{2}-\d{2})/.test(id)).sort();
  } catch (e) { return { error: e.message }; }
}

(async () => {
  // ---------------- browser + island ----------------
  const browser = await chromium.launch({ headless: opts.headless, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await context.newPage();
  let pageClosed = false; page.on('close', () => { pageClosed = true; if (!stopFlag) stopFlag = 'interrupted (the island window was closed)'; });
  page.on('pageerror', e => console.error('[island error]', e.message));
  await page.goto(ISLAND);
  await page.waitForFunction(() => window.Island && Island.getStatus);
  const isl = (fn, a) => page.evaluate(fn, a);

  // ---------------- setup (panel, or flags with --auto-start) ----------------
  let choice;
  if (opts.autoStart) {
    choice = { start: opts.start, saved: opts.saved ? JSON.parse(fs.readFileSync(opts.saved, 'utf8')) : null, savedName: opts.saved ? path.basename(opts.saved) : null, priorJournal: opts.priorJournal, model: opts.provider === 'mock' ? 'MOCK' : opts.model, obsMode: opts.obsMode, maxCostUsd: opts.maxCost, video: opts.video };
  } else {
    const avail = opts.provider === 'mock' ? [] : await listOpenAIModels();
    const ids = Array.isArray(avail) ? avail : [opts.model];
    if (!ids.includes(opts.model)) ids.unshift(opts.model);
    const models = ids.map(id => { const pr = priceFor(id); return { id, label: id + (pr ? `  (~$${pr.in}/$${pr.out} per 1M tokens in/out, estimate)` : '  (price unknown: limit enforced by call count only)') }; });
    models.push({ id: 'MOCK', label: 'MOCK policy (no AI, free; for testing only)' });
    const keyInfo = process.env.OPENAI_API_KEY ? 'OpenAI key found in OPENAI_API_KEY (not shown).' : 'No OPENAI_API_KEY set: only the MOCK policy will work.';
    if (process.env.ISLAND_PANEL_AUTOCLICK) setTimeout(() => page.click('#esGo').catch(() => {}), 1500); // TEST HOOK ONLY: clicks Start for automated tests
    choice = await isl(o => Island.showExperimentSetup(o), {
      info: `Provider: OpenAI. ${keyInfo} Duration: ${opts.minutes} min${opts.minutes !== 30 ? ' (TEST duration)' : ''} at ${opts.speed}×${opts.speed !== 1 ? ' (TEST speed)' : ' (real time)'}. Keep this window open until the run finishes.`,
      models, defaultModel: opts.provider === 'mock' ? 'MOCK' : opts.model, defaultMaxCost: opts.maxCost, defaultVideo: opts.video,
      warning: Array.isArray(avail) || opts.provider === 'mock' ? '' : 'Could not list models for this key (' + ((avail && avail.error) || 'no key') + ').',
    });
    if (choice.cancelled) { console.log('Cancelled.'); await browser.close(); return; }
  }
  const provName = choice.model === 'MOCK' ? 'mock' : opts.provider;
  const provider = makeProvider({ provider: provName, model: choice.model, reasoning: opts.reasoning, timeoutMs: opts.timeoutSec * 1000, seed: opts.mockSeed, latencyMs: arg('mock-latency', null) != null ? +arg('mock-latency') : undefined });
  if (!provider.hasKey()) throw new Error('OPENAI_API_KEY is not set. Set it in your shell (never in a file here), or choose the MOCK policy.');
  const price = provName === 'mock' ? { in: 0, cached: 0, out: 0, source: 'mock' } : priceFor(choice.model, opts.priceIn != null ? { in: +opts.priceIn, out: +opts.priceOut } : null);
  const obsMode = choice.obsMode === 'aerial' && provider.supportsImages ? 'aerial' : 'text';
  const isTest = opts.minutes < 30 || opts.speed !== 1 || provName === 'mock';
  const testLabel = [provName === 'mock' ? 'MOCK' : null, opts.minutes < 30 ? opts.minutes + 'min' : null, opts.speed !== 1 ? opts.speed + 'x' : null].filter(Boolean).join('-');
  const runId = stamp() + '_' + (provName === 'mock' ? 'MOCK' : choice.model) + (PROTO ? '_' + PROTO.version : '') + (isTest ? '_TEST' + (testLabel ? '-' + testLabel : '') : '');
  const dir = path.join(opts.out, runId); fs.mkdirSync(dir, { recursive: true });
  const W = (f, d) => fs.writeFileSync(path.join(dir, f), typeof d === 'string' ? d : JSON.stringify(d, null, 1));
  const A = (f, obj) => fs.appendFileSync(path.join(dir, f), JSON.stringify(obj) + '\n');
  const status = { runId, status: 'running', startedWall: new Date().toISOString(), test: isTest };
  W('status.json', status);
  page.on('download', async d => { try { await d.saveAs(path.join(dir, d.suggestedFilename())); console.log('Video saved:', d.suggestedFilename()); } catch (e) { console.error('video save failed', e.message); } });

  // ---------------- starting island ----------------
  if (opts.pair && opts.predator) throw new Error('--pair and --predator together are not supported.');
  await isl(([s, at, pr, sd, pair, nl, pv]) => Island.reset({ speed: s, startAt: at, predator: pr, seed: sd, pair, noLetters: nl, protocol: pv }), [opts.speed, opts.startAt, opts.predator, opts.seed, !!opts.pair, !!opts.noLetters, PROTO ? PROTO.version : null]);
  let startInfo = { type: 'fresh' };
  if (choice.start === 'saved') {
    if (opts.pair) throw new Error('A saved island with two people is not supported yet.');
    const raw = JSON.stringify(choice.saved);
    const r = await isl(([d, o]) => Island.inheritWorld(d, o), [choice.saved, { priorJournal: choice.priorJournal, sourceLabel: choice.savedName, speed: opts.speed }]);
    if (!r.ok) throw new Error('Could not load the saved island: ' + r.error);
    startInfo = { type: 'saved', file: choice.savedName, sha256: crypto.createHash('sha256').update(raw).digest('hex'), savedWall: choice.saved.savedWall, priorJournal: choice.priorJournal, carriedItemsLeft: r.carriedItemsLeft, previousJournalObject: r.previousJournal };
    W('prior-run-log.json', { note: 'Observer-only copy of the log stored in the saved island file. Never sent to the agent.', log: choice.saved.log || [] });
  }
  if (opts.speed !== 1) await isl(s => Island.setSpeed(s), opts.speed);
  W('initial-state.json', await isl(() => Island.exportState()));
  // one entry per person on the island (a single agent has who = null)
  const party = await isl(() => Island.party());
  const startPhrase = await isl(at => (Island.layout.starts[at] || {}).phrase || 'beside a boat', opts.startAt);
  const agents = party ? party.map(p => ({ who: p.id, label: p.label, identity: { sex: p.sex, age: p.age }, phrase: p.phrase, startAt: p.startAt }))
    : [{ who: null, label: 'Agent', identity: null, phrase: startPhrase, startAt: opts.startAt }];
  for (const ag of agents) { ag.sys = P.systemPrompt(ag.phrase, ag.identity, opts.minutes, opts.menu || null); ag.history = []; ag.slug = ag.label.toLowerCase(); }
  const sys = agents[0].sys;
  const SCHEMA = P.schemaFor(opts.menu || null);
  const config = {
    runId, test: isTest, testLabel: testLabel || null, islandVersion: await isl(() => Island.version),
    provider: provName, model: choice.model, reasoningEffort: provider.isReasoning ? opts.reasoning : null, priceUsdPer1M: price,
    observationMode: obsMode, aerialImage: obsMode === 'aerial' ? path.basename(AERIAL) : null,
    durationMinutes: opts.minutes, timeSpeed: opts.speed, checkinSeconds: opts.checkin, modelTimeoutSeconds: opts.timeoutSec,
    spendingLimitUsd: choice.maxCostUsd, maxModelCalls: opts.maxCalls, historyTurnsKept: opts.historyTurns,
    startingIsland: startInfo, introduction: P.introFor(agents[0].phrase, agents[0].identity, opts.minutes), startingPlace: agents[0].startAt, predator: opts.predator ? 'jaguar (hungry; the agent is not told)' : null, worldSeed: opts.seed, systemPrompt: sys, responseSchema: SCHEMA, protocol: PROTO || null, lettersRemoved: !!opts.noLetters, video: !!choice.video,
    people: party ? agents.map(a => ({ id: a.who, label: a.label, sex: a.identity.sex, age: a.identity.age, startingPlace: a.startAt, introduction: P.introFor(a.phrase, a.identity, opts.minutes), systemPrompt: a.sys, toldAboutOthers: false })) : null,
    credentials: provName === 'mock' ? 'none' : 'OPENAI_API_KEY environment variable (value never recorded)', startedWall: status.startedWall,
  };
  W('config.json', config);
  console.log(`Run ${runId}\n  ${provider.label} · ${obsMode} observations · limit $${choice.maxCostUsd} · ${opts.minutes} min at ${opts.speed}×${isTest ? '  [TEST]' : ''}${party ? '\n  People: ' + agents.map(a => a.label + ' (' + a.phrase + ')').join(', ') : ''}\n  Files: ${dir}`);

  // ---- cloud live viewer feed: chunk files a relay copies to the private watch page ----
  let live = null;
  if (opts.liveDir) {
    const ld = path.resolve(opts.liveDir); fs.mkdirSync(ld, { recursive: true });
    for (const f of fs.readdirSync(ld)) if (/^(chunk-\d+|current|final)\.json$|^STOP$/.test(f)) fs.unlinkSync(path.join(ld, f));
    const wj = (f, o) => { const tmp = path.join(ld, f + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(o)); fs.renameSync(tmp, path.join(ld, f)); };
    live = { ld, wj, n: 0, cursor: null, meta: { runId, model: provider.label + (party ? ' · ' + agents.map(a => a.label).join(' + ') : ''), obsMode, test: isTest, testLabel: testLabel || null, startedWall: status.startedWall } };
    live.flush = async (extra) => { const c = await isl(cur => Island.exportLiveChunk(cur), live.cursor); live.cursor = c.cursor; delete c.cursor; live.n++;
      // split so that no chunk document comes near the page database's 256 KiB limit
      const parts = []; const split = (x) => { const js = JSON.stringify(x); if (js.length < 180000 || (x.frames.length + x.snapshots.length + x.log.length) < 4) { parts.push(x); return; }
        const mid = x.frames.length ? x.frames[Math.floor(x.frames.length / 2)].t : (x.snapshots.length ? x.snapshots[Math.floor(x.snapshots.length / 2)].t : x.log[Math.floor(x.log.length / 2)].sim);
        const a = { frames: x.frames.filter(f => f.t < mid), snapshots: x.snapshots.filter(f => f.t < mid), log: x.log.filter(e => e.sim < mid), endSim: mid };
        const b = { frames: x.frames.filter(f => f.t >= mid), snapshots: x.snapshots.filter(f => f.t >= mid), log: x.log.filter(e => e.sim >= mid), endSim: x.endSim };
        if (!a.frames.length && !a.snapshots.length && !a.log.length) { parts.push(x); return; } split(a); split(b); };
      split(c);
      parts.forEach((pt, k) => { if (k > 0) live.n++; wj('chunk-' + String(live.n).padStart(4, '0') + '.json', Object.assign({ n: live.n, runId, wall: new Date().toISOString(), meta: Object.assign({ status: 'running', spend: +spentNow().toFixed(4) }, k === parts.length - 1 ? (extra || {}) : {}) }, pt)); }); };
    wj('current.json', Object.assign({ status: 'running' }, live.meta));
  }
  const stopFileSeen = () => live && fs.existsSync(path.join(live.ld, 'STOP'));
  await page.exposeFunction('__islandEvent', e => { A('island-events.jsonl', e); });
  await isl(() => Island.on(e => window.__islandEvent(e)));
  const note = (msg, data) => isl(([m, d]) => Island.controllerNote(m, d), [msg, data || null]).catch(() => {});

  // ---------------- conversation state (one conversation per person) ----------------
  let aerialDataUrl = null;
  if (obsMode === 'aerial') aerialDataUrl = 'data:image/png;base64,' + fs.readFileSync(AERIAL).toString('base64');
  function buildMessages(ag) {
    const history = ag.history;
    const msgs = [{ role: 'system', content: ag.sys }];
    const lastUser = history.map(h => h.role).lastIndexOf('user');
    let items = history.map((h, i) => ({ h, i }));
    const pinned = items.length ? [items[0]] : [];
    if (items.length > opts.historyTurns * 2 + 1) {
      const kept = items.slice(-opts.historyTurns * 2), dropped = items.slice(1, items.length - kept.length);
      // what this person heard, felt and said out loud is never lost when older turns are trimmed
      const mem = [];
      for (const { h } of dropped) {
        if (h.role === 'user') { for (const line of String(h.brief || '').split('\n')) if (/^(Heard|Happened) \(/.test(line)) mem.push(line); }
        else { try { const a = JSON.parse(h.content).action; if (a && (a.type === 'speak' || a.type === 'shout') && a.text) mem.push(`You said out loud${a.type === 'shout' ? ' (shouting)' : ''}: "${a.text}"`); else if (a && a.type === 'do' && a.text) mem.push(`You did: "${a.text}"`); } catch (_) {} }
      }
      const note = '(Earlier turns are not shown here.' + (mem.length ? ' What you heard, felt, said out loud and did toward others in them:\n' + mem.join('\n') : '') + ')';
      items = pinned.concat([{ h: { role: 'user', brief: note, full: note }, i: -1 }]).concat(kept);
    }
    for (const { h, i } of items) {
      if (h.role === 'assistant') { msgs.push({ role: 'assistant', content: h.content }); continue; }
      const text = i === lastUser ? h.full : h.brief;
      if (h.image) msgs.push({ role: 'user', content: [{ type: 'text', text: (i === lastUser ? h.full : h.brief) }, { type: 'image_url', image_url: { url: h.image } }] });
      else msgs.push({ role: 'user', content: text });
    }
    return msgs;
  }
  const spentNow = () => spent;
  let calls = 0, spent = 0, priceUnknownWarned = false;
  const reserve = Math.min(0.1 * choice.maxCostUsd, 0.25);
  const banner = s => isl(t => Island.setExperimentBanner(t), `AI: ${provider.label}${isTest ? ' [TEST]' : ''} · ${obsMode} · $${spent.toFixed(3)} of $${choice.maxCostUsd}${s ? ' · ' + s : ''}`).catch(() => {});
  const W1 = ag => ag.who; // island calls take the person's id (null = the only agent)

  async function callModel(ag, kind, m, image) {
    ag.history.push({ role: 'user', full: m.full, brief: m.brief, image: image || null });
    const messages = buildMessages(ag);
    if (process.env.ISLAND_DUMP_MESSAGES) fs.writeFileSync(path.join(dir, 'last-messages-' + (ag.who || 'agent') + '.json'), JSON.stringify(messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 3000) : '[parts]' })), null, 1)); // TEST ONLY
    const st0 = await isl(w => Island.getStatus(w), W1(ag));
    await banner((party ? ag.label + ' ' : '') + (kind === 'checkin' ? 'check-in…' : 'deciding…'));
    for (let attempt = 1; attempt <= 3; attempt++) {
      const t0 = Date.now();
      try {
        const r = await provider.decide(messages, SCHEMA);
        const ms = Date.now() - t0; calls++; ag.consecutiveErrors = 0;
        const c = costOf(r.usage, price); if (c != null) spent += c; else if (!priceUnknownWarned) { priceUnknownWarned = true; await note('Model price unknown: spending limit is enforced by call count (' + opts.maxCalls + ') only.'); }
        ag.history.push({ role: 'assistant', content: r.raw });
        const st1 = await isl(w => Island.getStatus(w), W1(ag));
        A('transcript.jsonl', { kind, who: ag.who, agent: party ? ag.label : undefined, wall: new Date().toISOString(), simAtRequest: st0.simTimeSec, simAtReply: st1.simTimeSec, latencyMs: ms, attempt, messagesInRequest: messages.length, sentToAgent: m.full, imageAttached: !!image, reply: r.parsed, servedModel: r.servedModel, finish: r.finish, usage: r.usage, costUsd: c, cumulativeCostUsd: +spent.toFixed(5) });
        if (ms > 10000) await note(`Model reply took ${(ms / 1000).toFixed(1)} s (${party ? ag.label + ', ' : ''}${kind}); the island clock kept running.`, { latencyMs: ms, who: ag.who });
        await banner(null);
        return r.parsed;
      } catch (e) {
        const ms = Date.now() - t0;
        A('transcript.jsonl', { kind, who: ag.who, agent: party ? ag.label : undefined, wall: new Date().toISOString(), simAtRequest: st0.simTimeSec, latencyMs: ms, attempt, sentToAgent: m.full, error: e.message, timeout: !!e.timeout });
        await note(`Model ${e.timeout ? 'timeout' : 'error'} (${party ? ag.label + ', ' : ''}${kind}, attempt ${attempt}/3): ${e.message}`, { status: e.status || null, who: ag.who });
        if (e.status === 401 || e.status === 403 || e.status === 404) { ag.consecutiveErrors = 99; break; }
        if (attempt < 3) await sleep(2000 * attempt);
      }
    }
    ag.consecutiveErrors = (ag.consecutiveErrors || 0) + 1;
    await banner('model unavailable');
    return { __error: true };
  }

  // what makes someone look up from what they are doing (perception, like noticing)
  const salientKey = (w) => isl(w => { const o = Island.getObservation(w); const band = d => d < 60 ? 'near' : d < 150 ? 'mid' : 'far';
    return o.visibleObjects.filter(v => v.type === 'animal' || v.type === 'person').map(v => v.id + ':' + (v.type === 'animal' ? v.description : v.name + ':' + band(v.distanceFt))).join('|') + '#' + o.soundsHeard.map(x => x.description).join('|') + '#' + (o.happenedToYou || []).map(x => x.description).join('|'); }, w);
  const nonEmptyKey = k => k.replace(/#/g, '') !== '';

  // ---------------- run ----------------
  if (choice.video) { const v = await isl(() => Island.startVideo({})); if (!v.ok) await note('Video not started: ' + v.error); }
  await isl(d => Island.startRun({ durationSec: d }), opts.minutes * 60);
  await note(`Controller attached: ${provider.label}, ${obsMode} observations, check-ins every ${opts.checkin} s, spending limit $${choice.maxCostUsd}.${party ? ' ' + agents.length + ' people, each with their own separate conversation; neither is told about the other.' : ''}${isTest ? ' TEST RUN.' : ''}`);
  let lastAutosave = Date.now(), stopReason = null, done = false;
  for (const ag of agents) Object.assign(ag, { lastObsSummary: null, lastSalient: null, first: true, rejected: null, lastResultId: null, lastCheckinSim: 0, idleUntil: null, idleFrom: null, consecutiveErrors: 0, finished: false, heard: new Set() });

  async function agentStep(ag) {
    const w = W1(ag);
    const st = await isl(w => Island.getStatus(w), w);
    if (st.run.ended || done) return false;
    if (st.dead) { if (!ag.finished) { ag.finished = true; await note(`${party ? ag.label : 'The agent'} has died; no more model calls for ${party ? 'this person' : 'it'}.`, { who: ag.who }); } return false; }
    if (!st.action) {
      if (ag.idleUntil != null && st.simTimeSec < ag.idleUntil) {
        const k = await salientKey(w); const changed = ag.lastSalient !== null && k !== ag.lastSalient && nonEmptyKey(k); ag.lastSalient = k;
        if (!changed) return true;
      }
      const obs = await isl(w => Island.getObservation(w), w);
      let lastResult = null;
      if (st.lastResult && st.lastResult.id !== ag.lastResultId) { ag.lastResultId = st.lastResult.id; lastResult = { type: st.lastResult.type, status: st.lastResult.status, message: st.lastResult.result && st.lastResult.result.message }; }
      const idleNote = ag.idleFrom != null ? `You did nothing for ${Math.round(st.simTimeSec - ag.idleFrom)} seconds.` : null;
      ag.idleUntil = null; ag.idleFrom = null;
      { const sum = P.observationSummary(obs); if (sum !== ag.lastObsSummary) { ag.lastObsSummary = sum; await isl(([t, w]) => Island.noteObservation(t, w), [sum, w]); } }
      const msg = P.decisionMessage({ observation: obs, lastResult, rejected: ag.rejected, idleNote, first: ag.first, aerialNote: obsMode === 'aerial' ? 'Attached is an aerial picture of the whole island, taken from above. It is not your view from where you stand.' : null, memory: P.memoryNote(obs, ag.heard) });
      const out = await callModel(ag, 'decision', msg, ag.first && aerialDataUrl ? aerialDataUrl : null);
      ag.first = false; ag.rejected = null;
      if (out.__error) { ag.idleFrom = (await isl(w => Island.getStatus(w), w)).simTimeSec; ag.idleUntil = ag.idleFrom + 10; await note(`No decision received; ${party ? 'the ' + ag.slug : 'the agent'} stands still. Trying again in about 10 s.`, { who: ag.who }); return true; }
      const now = await isl(w => Island.getStatus(w), w);
      if (now.run.ended) { await note('A reply arrived after time ran out; it is kept in transcript.jsonl but not applied.', { who: ag.who }); return false; }
      if (now.dead) return false;
      { const said = out.say != null ? out.say : out.reflection; if (said && String(said).trim()) await isl(([t, w]) => Island.addReflection(t, w), [said, w]); }
      const action = P.toIslandAction(out.action);
      if (!action) { const t = now.simTimeSec; ag.idleFrom = t; ag.idleUntil = t + opts.checkin; ag.lastSalient = await salientKey(w); await note(`${party ? ag.label : 'Agent'} chose no action; ${party ? (ag.identity.sex === 'female' ? 'she' : 'he') : 'it'} will be asked again in ${opts.checkin} s.`, { who: ag.who }); return true; }
      const r = await isl(([a, w]) => Island.submitAction(a, w), [action, w]);
      if (!r.ok) ag.rejected = r.error; else ag.lastCheckinSim = (await isl(w => Island.getStatus(w), w)).simTimeSec;
      return true;
    }
    let due = st.simTimeSec - ag.lastCheckinSim >= opts.checkin;
    if (!due) { const k = await salientKey(w); due = ag.lastSalient !== null && k !== ag.lastSalient && nonEmptyKey(k); ag.lastSalient = k; }
    if (!due) return true;
    ag.lastCheckinSim = st.simTimeSec;
    const obs = await isl(w => Island.getObservation(w), w);
    const out = await callModel(ag, 'checkin', P.checkinMessage({ observation: obs, action: st.action, memory: P.memoryNote(obs, ag.heard) }));
    if (out.__error) return true;
    const now = await isl(w => Island.getStatus(w), w);
    if (now.run.ended) { await note('A reply arrived after time ran out; it is kept in transcript.jsonl but not applied.', { who: ag.who }); return false; }
    if (now.dead) return false;
    { const said = out.say != null ? out.say : out.reflection; if (said && String(said).trim()) await isl(([t, w]) => Island.addReflection(t, w), [said, w]); }
    const action = P.toIslandAction(out.action);
    if (action) {
      let r;
      if (action.type === 'stop') r = now.action ? await isl(w => Island.interrupt(w), w) : { ok: false, error: 'There was no action left to stop; it had already finished.' };
      else r = await isl(([a, w]) => Island.submitAction(Object.assign({}, a, { interruptCurrent: true }), w), [action, w]);
      if (!r.ok) ag.rejected = r.error; else ag.lastCheckinSim = (await isl(w => Island.getStatus(w), w)).simTimeSec;
    }
    return true;
  }
  async function agentLoop(ag) {
    try { while (!done && await agentStep(ag)) await sleep(200); }
    catch (e) { if (!done) { stopReason = stopReason || 'interrupted: controller error: ' + e.message; console.error(e); done = true; } }
  }
  async function supervisor() {
    try {
      while (!done) {
        if (pageClosed) { stopReason = stopFlag; break; }
        const st = await isl(() => Island.getStatus());
        if (st.run.ended) break;
        const halt = async (why, n) => { stopReason = why; if (n) await note(n); await isl(() => Island.endRun()); };
        if (stopFlag) { await halt(stopFlag); break; }
        if (await isl(() => Island.experimentStopRequested())) { await halt('stopped by the experimenter', 'Experimenter pressed Stop.'); break; }
        if ((price && spent >= choice.maxCostUsd - reserve) || calls >= opts.maxCalls) { const why = `stopped: spending limit reached ($${spent.toFixed(3)} of $${choice.maxCostUsd}, ${calls} calls)`; await halt(why, why); break; }
        if (agents.some(a => a.consecutiveErrors >= 5)) { const why = 'interrupted: the model was unavailable for 5 decisions in a row'; await halt(why, why); break; }
        if (stopFileSeen()) { await halt('stopped by the experimenter (from the watch page)', 'Experimenter pressed Stop on the watch page.'); break; }
        if (live && Date.now() - (live.lastFlush || 0) >= opts.liveInterval * 1000) { live.lastFlush = Date.now(); await live.flush(); }
        if (Date.now() - lastAutosave > 60000) { W('autosave.json', await isl(() => Island.saveRun())); lastAutosave = Date.now(); }
        await sleep(250);
      }
    } catch (e) { stopReason = stopReason || 'interrupted: controller error: ' + e.message; console.error(e); }
    done = true;
  }
  await Promise.all([supervisor(), ...agents.map(agentLoop)]);

  // ---------------- end of run: record everything ----------------
  const finalize = async () => {
    const st = await isl(() => Island.getStatus());
    if (!st.run.ended) await isl(() => Island.endRun());
    await sleep(500);
    W('state-at-end.json', await isl(() => Island.exportState()));
    W('island-save-at-end.json', await isl(() => Island.saveRun()));
    W('island-log.json', await isl(() => Island.exportLog()));
    W('replay.json', await isl(() => Island.exportReplay()));
    W('journal.txt', await isl(() => Island.exportJournal()));
    const s = await isl(() => Island.exportState());
    W('reflections.json', s.party ? s.party.map(p => ({ person: p.label, reflections: p.reflections })) : s.reflections);
    if (choice.video) { await isl(() => Island.stopVideo()).catch(() => {}); for (let i = 0; i < 50 && !fs.readdirSync(dir).some(f => /\.(webm|mp4)$/.test(f)); i++) await sleep(200); }
    return s;
  };
  let finalState = null;
  try { finalState = await finalize(); } catch (e) { console.error('Could not read the final state from the island:', e.message, '(last autosave.json is kept)'); stopReason = stopReason || 'interrupted: ' + e.message; }
  // phone-friendly MP4 copy of the screen recording (if ffmpeg is installed)
  try { const v = fs.readdirSync(dir).find(f => /\.webm$/.test(f)); if (v) { const { spawnSync } = require('child_process');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, v), '-vf', 'scale=1280:-2', '-r', '15', '-c:v', 'libx264', '-preset', 'medium', '-crf', '30', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(dir, v.replace(/\.webm$/, '.mp4'))], { stdio: 'ignore' });
    if (r.status === 0) console.log('MP4 copy saved:', v.replace(/\.webm$/, '.mp4')); } } catch (_) {}
  try { const fs2 = await isl(() => Island.exportState()); if (fs2.party) { status.deaths = fs2.party.filter(p => p.agent.dead).map(p => p.label); if (fs2.party.every(p => p.agent.dead) && !stopReason) status.died = true; } else if (fs2.agent.dead && !stopReason) status.died = true; } catch (_) {}
  status.status = stopReason ? (stopReason.startsWith('stopped') ? 'stopped' : 'interrupted') : 'completed';
  status.reason = stopReason || (status.died ? (party ? 'everyone on the island died' : 'the agent died') : 'the run reached its time limit');
  status.endedWall = new Date().toISOString(); status.modelCalls = calls; status.estimatedCostUsd = +spent.toFixed(4);
  W('status.json', status);
  if (live) { try { await live.flush({ status: 'ended', result: status.status }); } catch (e) { console.error('live flush failed', e.message); } }

  // ---------------- final report (agent) and experimenter summary ----------------
  const personView = (st, ag) => party ? Object.assign({}, st.party.find(p => p.id === ag.who)) : st;
  if (finalState && opts.report) {
    const log = JSON.parse(fs.readFileSync(path.join(dir, 'island-log.json'), 'utf8'));
    const reports = [];
    for (const ag of agents) {
      try {
        // only what this person did or perceived, plus island-wide events (never the other person's private record)
        const own = log.filter(e => !['controller'].includes(e.kind) && !(e.kind === 'system' && /speed|Video|Saved|Restored|ready|reset/i.test(e.msg)) && (!party || !e.who || e.who === ag.who));
        const factual = own.map(e => `[${fmt(e.sim)}] ${e.kind.toUpperCase()}: ${e.msg}`).join('\n');
        const pv = personView(finalState, ag);
        const journal = pv.journal.entries.map(e => `#${e.n} [${fmt(e.simTime)}, ${e.where}]${e.interrupted ? ' (interrupted)' : ''}: ${e.text}`).join('\n') || '(no entries)';
        const reportPrompt = [
          { role: 'system', content: 'You were the agent in a simulated island experiment. Your time on the island has now ended. Write a report for the experimenter in Markdown.' },
          { role: 'user', content: `Your journal entries:\n${journal}\n\nThe environment's factual activity record (times are minutes:seconds since the start):\n${factual}\n\nPlease write a report covering:\n1. What you did, in chronological order.\n2. What you wrote in your journal.\n3. What attracted your attention and what you ignored.\n4. Any questions or plans you developed or changed.\n5. Where you ended up and what changed on the island.\n6. What you might choose to do with another 30 minutes.\n\nKeep what the record shows separate from your interpretation (label interpretation as such). Do not present feelings or experiences as established facts.` },
        ];
        if (price && spent >= choice.maxCostUsd) { reports.push({ ag, text: '# Report not generated\n\nThe spending limit had been reached.' }); continue; }
        const r = await provider.text(reportPrompt, 8000, 300000); const c = costOf(r.usage, price) || 0; spent += c;
        A('transcript.jsonl', { kind: 'report', who: ag.who, agent: party ? ag.label : undefined, wall: new Date().toISOString(), sentToAgent: reportPrompt[1].content, reply: r.text, usage: r.usage, costUsd: c });
        let check = null;
        if (opts.check && provName !== 'mock') {
          const chk = await provider.text([{ role: 'system', content: 'You check reports against logs. Be precise and brief.' }, { role: 'user', content: `Activity record:\n${factual}\n\nJournal:\n${journal}\n\nReport:\n${r.text}\n\nList every statement in the report that is not supported by, or contradicts, the activity record or journal. Quote the statement and give the record line. If there are none, say so.` }], 4000);
          const c2 = costOf(chk.usage, price) || 0; spent += c2;
          A('transcript.jsonl', { kind: 'report-check', who: ag.who, wall: new Date().toISOString(), reply: chk.text, usage: chk.usage, costUsd: c2 });
          check = chk.text;
        }
        reports.push({ ag, text: r.text, check });
      } catch (e) { reports.push({ ag, text: '# Report failed\n\n' + e.message }); }
    }
    const head = `_Generated after the run by the same model, from ${party ? 'that person\'s own' : 'its'} journal and activity record. It is the model's account, not a verified record; see summary.md for checks against the log._\n\n`;
    if (party) {
      for (const x of reports) W('report-' + x.ag.slug + '.md', `# ${x.ag.label}'s report (${provider.label})\n\n` + head + x.text);
      W('report.md', reports.map(x => `# ${x.ag.label}'s report (${provider.label})\n\n` + head + x.text).join('\n\n---\n\n'));
      status.reportCheck = reports.map(x => `**${x.ag.label}:** ${x.check || 'not checked'}`).join('\n\n');
    } else if (reports[0]) { W('report.md', `# Agent report (${provider.label})\n\n` + head + reports[0].text); status.reportCheck = reports[0].check || undefined; }
  }
  // deterministic summary from the records
  try {
    const log = JSON.parse(fs.readFileSync(path.join(dir, 'island-log.json'), 'utf8'));
    const tr = fs.readFileSync(path.join(dir, 'transcript.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    const dec = tr.filter(t => (t.kind === 'decision' || t.kind === 'checkin') && !t.error), errs = tr.filter(t => t.error);
    const lat = dec.map(t => t.latencyMs).sort((a, b) => a - b);
    const count = k => log.filter(e => e.kind === k).length;
    const init = JSON.parse(fs.readFileSync(path.join(dir, 'initial-state.json'), 'utf8'));
    const changed = finalState ? Object.keys(finalState.objects).filter(id => JSON.stringify(finalState.objects[id].loc) !== JSON.stringify((init.objects[id] || {}).loc) || JSON.stringify(finalState.objects[id].state) !== JSON.stringify((init.objects[id] || {}).state) || JSON.stringify(finalState.objects[id].container || null) !== JSON.stringify((init.objects[id] || {}).container || null)) : [];
    const people = finalState ? (party ? agents.map(ag => ({ label: ag.label, ...personView(finalState, ag) })) : [{ label: 'Agent', agent: finalState.agent, journal: finalState.journal, reflections: finalState.reflections }]) : [];
    const lines = [
      `# Experimenter summary: ${runId}`, '', isTest ? '**TEST RUN** (' + (testLabel || 'test') + '). Not the actual experiment.' : '**Actual experiment run.**', '',
      `- Status: **${status.status}** (${status.reason})`,
      `- Model: ${provider.label}; observation mode: ${obsMode}; starting island: ${startInfo.type}${startInfo.file ? ' (' + startInfo.file + ')' : ''}`,
      `- Run time on the island clock: ${finalState ? fmt((finalState.run.endSim || finalState.simTime) - finalState.run.startSim) : '?'} (speed ${opts.speed}×)`,
      `- Model calls: ${dec.length}${party ? ' (' + agents.map(ag => ag.label + ' ' + dec.filter(t => t.who === ag.who).length).join(', ') + ')' : ''} (${tr.filter(t => t.kind === 'decision' && !t.error).length} decisions, ${tr.filter(t => t.kind === 'checkin' && !t.error).length} check-ins); errors/timeouts: ${errs.length}`,
      `- Decision latency: median ${lat.length ? (lat[Math.floor(lat.length / 2)] / 1000).toFixed(1) : '-'} s, max ${lat.length ? (lat[lat.length - 1] / 1000).toFixed(1) : '-'} s`,
      `- Estimated cost: $${spent.toFixed(4)} (price source: ${price ? price.source : 'unknown'})`,
      `- Actions: ${count('start')} started, ${count('complete')} completed, ${count('fail')} failed, ${count('interrupt')} interrupted, ${count('rejected')} rejected`,
      ...people.map(p => { const a = p.agent; return `- ${party ? p.label + ': ' : ''}journal entries ${p.journal.entries.length}; reported reflections ${p.reflections.length}; final position (${Math.round(a.x)}, ${Math.round(a.y)}) ft, ${a.level}${a.level !== 'ground' ? ' at ' + Math.round(a.ladderFt) + ' ft' : ''}, ${a.dead ? 'dead' : a.pose}${a.health != null && a.health < 100 && !a.dead ? ' (' + a.health + '% health)' : ''}`; }),
      `- Objects changed during the run: ${changed.join(', ') || 'none'}`,
      `- Controller notes (delays, errors, idle choices): ${count('controller')}`,
      '', '## Rejected actions', ...(log.filter(e => e.kind === 'rejected').map(e => `- [${fmt(e.sim)}] ${e.msg}`)), log.some(e => e.kind === 'rejected') ? '' : '- none',
      '', '## Report vs. log', status.reportCheck ? '_Model-assisted check (a second call to the same model). Verify before relying on it._\n\n' + status.reportCheck : '_No automated check was run._',
      '', '## Technical notes', ...(log.filter(e => e.kind === 'controller').map(e => `- [${fmt(e.sim)}] ${e.msg}`)),
    ];
    W('summary.md', lines.join('\n'));
  } catch (e) { console.error('summary failed', e.message); }
  status.estimatedCostUsd = +spent.toFixed(4); W('status.json', status);
  try { require('./make_transcript').makeTranscript(dir); } catch (e) { console.error('transcript failed', e.message); }
  if (live) {
    const rd = f => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (_) { return ''; } };
    live.wj('final.json', { report: rd('report.md').slice(0, 60000), summary: rd('summary.md').slice(0, 30000), transcript: rd('transcript.md').slice(0, 150000), wall: new Date().toISOString() });
    live.wj('current.json', Object.assign({}, live.meta, { status: 'ended', result: status.status, reportReady: true, spend: +spent.toFixed(4) }));
  }
  await isl(t => Island.setExperimentBanner(t), `Run ${status.status}. Files saved in runs/${runId}`).catch(() => {});
  console.log(`\nRun ${status.status}: ${status.reason}\nModel calls ${calls}, estimated cost $${spent.toFixed(4)}\nFiles: ${dir}`);
  if (!opts.headless && !pageClosed) { console.log('The island window stays open for replay. Close it (or press Ctrl+C) when done.'); await new Promise(r => page.on('close', r)); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
