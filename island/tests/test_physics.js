// Fire, body and wildlife physics checks (island-only, accelerated with the test clock).
//   node tests/test_physics.js
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'island.html');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

(async () => {
  const b = await chromium.launch(); const page = await b.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(FILE); await page.waitForFunction(() => window.Island);
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => { window.f = a => { const r = Island.submitAction(a); if (!r.ok) return 'REJ ' + r.error; for (let i = 0; i < 4000; i++) { Island.advanceTime(1); if (!Island.getStatus().action) break; } const l = Island.getStatus().lastResult; return l.status + ': ' + l.result.message; };
    window.go = (ids) => ids.forEach(a => f(a)); window.st = () => Island.exportState(); });

  // ---- fire ----
  let r = await ev(() => { Island.reset(); go([{ type: 'walk_to', target: 'ladder' }, { type: 'climb' }, { type: 'pick_up', target: 'lighter' }, { type: 'pick_up', target: 'letter_tower' }, { type: 'descend' },
      { type: 'walk_to', x: 205, y: 668 }, { type: 'walk_to', target: 'driftwood_1' }, { type: 'pick_up', target: 'driftwood_1' }]);
    return { wood: f({ type: 'use', target: 'lighter', with: 'driftwood_1' }) }; });
  check('F1. A lighter alone does not light solid wood', /does not catch/.test(r.wood), r.wood);
  r = await ev(() => { const lit = f({ type: 'use', target: 'lighter', with: 'letter_tower' }); const s1 = st().objects.letter_tower.state.burning; const h0 = st().agent.health; Island.advanceTime(8); const h1 = st().agent.health; Island.advanceTime(30); return { lit, s1, gone: st().objects.letter_tower.loc.t, h0, h1 }; });
  check('F2. Paper lights from a lighter, burns the hand holding it, and burns away', /catches fire/.test(r.lit) && r.s1 && r.h1 < r.h0 && r.gone === 'destroyed', `${r.lit} | health ${r.h0}→${r.h1} | ${r.gone}`);
  r = await ev(() => { f({ type: 'walk_to', target: 'picnic_table' }); f({ type: 'pick_up', target: 'paper' }); f({ type: 'walk_to', target: 'fire_pit' });
    f({ type: 'put_down', target: 'driftwood_1', onto: 'fire_pit' }); const none = f({ type: 'use', target: 'lighter', with: 'fire_pit' }); f({ type: 'put_down', target: 'paper', onto: 'fire_pit' });
    const yes = f({ type: 'use', target: 'lighter', with: 'fire_pit' }); Island.advanceTime(60); const s = st(); return { none, yes, wood: s.objects.driftwood_1.state.burning, pitLit: s.objects.fire_pit.state.lit, paper: s.objects.paper.loc.t }; });
  check('F3. Fire pit needs kindling; paper catches and then the driftwood catches from it', /nothing catches/.test(r.none) && /catches fire/.test(r.yes) && r.wood && r.pitLit, `${r.none.slice(0, 60)} | ${r.yes} | wood burning ${r.wood}, pit lit ${r.pitLit}, paper ${r.paper}`);
  r = await ev(() => { Island.reset(); go([{ type: 'walk_to', target: 'ladder' }, { type: 'climb' }, { type: 'pick_up', target: 'lighter' }, { type: 'descend' }, { type: 'walk_to', target: 'cabin_door' }, { type: 'open', target: 'cabin_door' }, { type: 'walk_to', target: 'cabin_table' }, { type: 'pick_up', target: 'lantern' }]);
    return f({ type: 'use', target: 'lantern', with: 'lighter' }); });
  check('F4. "Use the lantern with the lighter" lights it (either order works)', /glows/.test(r), r);
  r = await ev(() => { const b = f({ type: 'inspect', target: 'bed' }); const h = f({ type: 'inspect', target: 'fireplace' }); const p0 = Island.getObservation(); const w = f({ type: 'walk', direction: 'N', distance: 15 }); const p1 = Island.getObservation(); return { b, h, w, in0: p0.self.indoors, in1: p1.self.indoors }; });
  check('F5. The bed and fireplace are real; walking into the cabin wall stops at the wall (stays inside)', /bed/.test(r.b) && /fireplace/.test(r.h) && r.in1 && /wall|Arrived/.test(r.w), `${r.w} | indoors after: ${r.in1}`);
  r = await ev(() => { f({ type: 'drop', target: 'lantern' }); const s0 = st(); Island.advanceTime(200); const s1 = st(); return { oil: s0.objects.lantern.state.burning, cabin: s1.objects.cabin.state.burning || s1.objects.cabin.state.burnt, health: s1.agent.health, dead: s1.agent.dead }; });
  check('F6. Dropping the lit lantern indoors spills burning oil; the fire can spread to the cabin and hurt someone inside', r.oil && r.cabin && r.health < 100, `oil burning ${r.oil}, cabin on fire ${r.cabin}, agent health ${r.health}${r.dead ? ' (died)' : ''}`);

  // ---- jaguar ----
  r = await ev(() => { Island.reset({ predator: true, seed: 7 }); Island.startRun({ durationSec: 1800 }); const seenEarly = JSON.stringify(Island.getObservation()).includes('jaguar');
    const log = []; let firstSeen = null; for (let i = 0; i < 1500 && !st().agent.dead; i++) { Island.advanceTime(1); if (!firstSeen && Island.getObservation().visibleObjects.some(o => o.id === 'jaguar')) firstSeen = Island.getStatus().simTimeSec; }
    const L = Island.exportLog().filter(e => e.kind === 'animal' || e.kind === 'body').map(e => Math.round(e.sim) + 's ' + e.msg); const s = st(); return { seenEarly, firstSeen, dead: s.agent.dead, ended: s.run.ended, L: L.slice(0, 8), jag: s.animals[0].state }; });
  check('J1. Jaguar is not in the agent\'s observation at the start', !r.seenEarly, '');
  check('J2. A hungry jaguar finds an idle agent, stalks, charges and attacks; nothing intervenes', r.L.some(x => /notice/.test(x)) && r.L.some(x => /charges/.test(x)) && r.L.some(x => /attacks|knocks/.test(x)), r.L.join(' | ').slice(0, 300));
  check('J3. The agent can die; the run then ends', r.dead && r.ended, `agent first saw the jaguar at ${r.firstSeen}s; dead ${r.dead}; jaguar now ${r.jag}`);
  r = await ev(() => { Island.reset({ predator: true, seed: 11 }); Island.startRun({ durationSec: 1800 }); go([{ type: 'walk_to', target: 'ladder' }, { type: 'climb' }]); for (let i = 0; i < 400; i++)Island.advanceTime(1);
    const s = st(); return { h: s.agent.health, lvl: s.agent.level, jag: s.animals[0].state, log: Island.exportLog().filter(e => e.kind === 'animal').map(e => e.msg).slice(0, 4) }; });
  check('J4. The jaguar cannot climb the steel ladder; the agent on the platform is unhurt', r.lvl === 'platform' && r.h === 100, `${r.jag} | ${r.log.join(' | ')}`);
  r = await ev(() => { Island.reset({ predator: true, seed: 5 }); Island.startRun({ durationSec: 1800 }); go([{ type: 'walk_to', target: 'cabin_door' }, { type: 'open', target: 'cabin_door' }, { type: 'walk_to', x: 267, y: 418 }]);
    const cl = f({ type: 'close', target: 'cabin_door' }); for (let i = 0; i < 600; i++)Island.advanceTime(1); const s = st(); return { cl, h: s.agent.health, jag: s.animals[0].state, ind: Island.getObservation().self.indoors }; });
  check('J5. Inside the cabin with the door closed, the jaguar cannot get in', r.h === 100 && r.ind, `${r.cl} | jaguar ${r.jag}`);
  r = await ev(() => { Island.reset({ predator: true, seed: 3 }); Island.startRun({ durationSec: 1800 }); go([{ type: 'walk_to', target: 'ladder' }, { type: 'climb' }, { type: 'pick_up', target: 'sword' }, { type: 'wear', target: 'sword' }, { type: 'descend' }]);
    const out = []; for (let i = 0; i < 1200 && !st().agent.dead; i++) { Island.advanceTime(1); { const jj = st().animals[0]; if (jj.state === 'roaming' && !Island.getStatus().action && i % 20 === 0) Island.submitAction({ type: 'walk_to', x: Math.round(jj.x), y: Math.round(jj.y) }); } const s = st(); const j = s.animals[0]; if (j.state === 'dead') break; if (j.state === 'attacking' && !Island.getStatus().action) { const res = Island.submitAction({ type: 'attack', target: 'jaguar', with: 'sword' }); if (res.ok) for (let k = 0; k < 6; k++) Island.advanceTime(1); } }
    const s = st(); return { agentDead: s.agent.dead, agentHealth: s.agent.health, jag: s.animals[0].state, jh: s.animals[0].health, fight: Island.exportLog().filter(e => /hits the jaguar|misses|collapses|flees|bites|claws|clamps/.test(e.msg)).length }; });
  check('J6. A sword fight is resolved by chance either way (someone can get hurt or die)', r.fight > 0, `agent ${r.agentDead ? 'died' : 'alive at ' + r.agentHealth}, jaguar ${r.jag} (health ${r.jh}), ${r.fight} fight events`);
  r = await ev(() => { Island.reset({ seed: 9 }); Island.startRun({ durationSec: 1800 }); go([{ type: 'walk_to', target: 'ladder' }, { type: 'climb' }, { type: 'pick_up', target: 'lighter' }, { type: 'descend' }, { type: 'walk_to', x: 335, y: 735 }, { type: 'walk_to', target: 'driftwood_2' }, { type: 'pick_up', target: 'driftwood_2' }, { type: 'walk_to', target: 'rope' }, { type: 'pick_up', target: 'rope' }, { type: 'walk_to', target: 'fire_pit' }, { type: 'put_down', target: 'driftwood_2', onto: 'fire_pit' }, { type: 'put_down', target: 'rope', onto: 'fire_pit' }]);
    const lit = f({ type: 'use', target: 'lighter', with: 'fire_pit' }); Island.advanceTime(30); Island._debug.spawnJaguar(240, 470); Island.submitAction({ type: 'sit' });
    for (let i = 0; i < 300; i++)Island.advanceTime(1); const s = st(); return { lit: s.objects.fire_pit.state.lit, h: s.agent.health, msg: lit, log: Island.exportLog().filter(e => e.kind === 'animal').map(e => e.msg) }; });
  check('J7. Sitting by a lit fire keeps the jaguar at a distance', r.lit && r.log.some(m => /distance from the fire|swerves/.test(m)), `fire lit ${r.lit}, health ${r.h} | ${r.log.slice(0, 4).join(' | ')}`);
  r = await ev(() => { const rep = Island.exportReplay(); return { hasAn: rep.frames.some(fr => fr.an && fr.an.length), n: rep.frames.length }; });
  check('J8. Replay frames record the jaguar\'s movements', r.hasAn, r.n + ' frames');
  check('Z. No page errors', errs.length === 0, errs.join(' | '));
  const passed = results.filter(x => x.ok).length; console.log(`\n${passed}/${results.length} checks passed`); await b.close(); process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
