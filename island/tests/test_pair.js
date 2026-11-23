// Two people on one island: separate bodies, belongings, journals; seeing, hearing, giving; replay.
//   node tests/test_pair.js
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'island.html');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(FILE); await page.waitForFunction(() => window.Island);
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => {
    window.f = (w, a) => { const r = Island.submitAction(a, w); if (!r.ok) return 'REJ ' + r.error; for (let i = 0; i < 4000; i++) { Island.advanceTime(1); if (!Island.getStatus(w).action) break; } const l = Island.getStatus(w).lastResult; return l.status + ': ' + l.result.message; };
    window.obs = w => Island.getObservation(w); window.st = () => Island.exportState();
    window.person = w => obs(w).visibleObjects.find(o => o.type === 'person');
  });

  let r = await ev(() => { Island.reset({ pair: true }); Island.startRun({ durationSec: 1800 }); const s = st(); const oa = obs('a'), ob = obs('b');
    return { n: s.party.length, labels: s.party.map(p => p.label + '/' + p.sex + '/' + p.age), pos: s.party.map(p => [p.agent.x, p.agent.y]), ca: oa.self.carrying.map(c => c.id), cb: ob.self.carrying.map(c => c.id), seesA: !!person('a'), seesB: !!person('b'), noAlias: !('agent' in s) }; });
  check('P1. Two people: a 20-year-old woman (beach) and a 20-year-old man (hilltop), each with their own journal and pencil', r.n === 2 && r.ca.join() === 'journal,pencil' && r.cb.join() === 'journal_2,pencil_2', `${r.labels.join(', ')} at ${JSON.stringify(r.pos)} | woman carries ${r.ca} | man carries ${r.cb}`);
  check('P2. Far apart at the start, neither can see the other', !r.seesA && !r.seesB, '');

  r = await ev(() => { Island.submitAction({ type: 'walk_to', target: 'crate' }, 'a'); Island.submitAction({ type: 'walk', direction: 'S', distance: 60 }, 'b');
    const a0 = st().party.map(p => [p.agent.x, p.agent.y]); Island.advanceTime(10); const a1 = st().party.map(p => [p.agent.x, p.agent.y]);
    return { a0, a1, actA: Island.getStatus('a').action && Island.getStatus('a').action.label, actB: Island.getStatus('b').action && Island.getStatus('b').action.label }; });
  check('P3. Both act at the same time on the same clock', r.a1[0][0] !== r.a0[0][0] || r.a1[0][1] !== r.a0[0][1], `woman: ${r.actA} | man: ${r.actB} | moved ${JSON.stringify(r.a0)} → ${JSON.stringify(r.a1)}`);

  r = await ev(() => { Island.interrupt('a'); Island.interrupt('b'); Island._debug.place('a', 300, 600); Island._debug.place('b', 300, 720);
    const far = person('a'); Island._debug.place('b', 300, 650); const mid = person('a'); Island._debug.place('b', 305, 630); const near = person('a');
    return { far: far && far.description, mid: mid && mid.description, near: near && near.description, nearName: near && near.name, id: near && near.id }; });
  check('P4. The woman sees the man as a young man nearby, with what he holds up close', /too far/.test(r.far || '') === false && /A young man, about 20/.test(r.near) && r.id === 'person', `120 ft: ${r.far} | 50 ft: ${r.mid} | 30 ft: ${r.near}`);

  r = await ev(() => { Island._debug.place('a', 300, 600); Island._debug.place('b', 300, 650); return f('a', { type: 'inspect', target: 'person' }); });
  check('P4b. Inspecting the other person describes them, including what they hold', /A young man, about 20.*holding: journal, pencil.*50 ft away/.test(r), r);
  r = await ev(() => { Island._debug.place('a', 300, 600); Island._debug.place('b', 300, 640);
    const said = f('b', { type: 'speak', text: 'Hello? Is someone there?' });
    const heardA = obs('a').soundsHeard.map(s => s.description), heardB = obs('b').soundsHeard.map(s => s.description);
    Island._debug.place('a', 300, 760); const faint = obs('a').soundsHeard.map(s => s.description); Island._debug.place('a', 300, 960); const none = obs('a').soundsHeard.map(s => s.description);
    return { said, heardA, heardB, faint, none }; });
  check('P5. Speaking out loud: heard clearly nearby, faintly farther off, not at all far away; the speaker does not "hear" themselves', r.heardA.some(d => /man's voice says: "Hello\? Is someone there\?"/.test(d)) && !r.heardB.length && r.faint.some(d => /faint/i.test(d)) && !r.none.length,
    `${r.said} | woman 40 ft: ${r.heardA} | 120 ft: ${r.faint} | 320 ft: ${JSON.stringify(r.none)}`);
  r = await ev(() => { Island.advanceTime(40); Island._debug.place('a', 268, 714); Island._debug.place('b', 522, 182); const s = f('a', { type: 'shout', text: 'Hello!' }); return { s, heard: obs('b').soundsHeard.map(x => x.description) }; });
  check('P6. A shout carries across the island', r.heard.some(d => /woman shouts: "Hello!"/.test(d)), r.heard.join(' | '));

  r = await ev(() => { Island.advanceTime(40); Island._debug.place('a', 300, 600); Island._debug.place('b', 303, 603); f('a', { type: 'walk_to', target: 'crate' }); f('a', { type: 'open', target: 'crate' }); const pk = f('a', { type: 'pick_up', target: 'tin_cup' });
    Island._debug.place('b', st().party[0].agent.x + 3, st().party[0].agent.y);
    const g = f('a', { type: 'give', target: 'tin_cup', at: 'person' }); const ob = obs('b'); const grab = f('a', { type: 'pick_up', target: 'tin_cup' });
    return { pk, g, bc: ob.self.carrying.map(c => c.id), notice: (ob.happenedToYou || []).map(n => n.description), grab, ac: obs('a').self.carrying.map(c => c.id) }; });
  check('P7. Handing something over: the man now holds it, is told so, and the woman cannot take it back by "picking it up"', /hand the tin cup/.test(r.g) && r.bc.includes('tin_cup') && r.notice.some(n => /hands you the tin cup/.test(n)) && /REJ/.test(r.grab) && !r.ac.includes('tin_cup'),
    `${r.g} | man carries ${r.bc} | man was told: ${r.notice} | woman tries to pick it up: ${r.grab}`);

  r = await ev(() => { const a = f('a', { type: 'write_journal', text: 'Someone else is here.' }); const bb = f('b', { type: 'write_journal', text: 'A stranger gave me a cup.' }); const s = st();
    const ja = s.party[0].journal.entries.map(e => e.text), jb = s.party[1].journal.entries.map(e => e.text); const txt = Island.exportJournal();
    f('a', { type: 'drop', target: 'journal' }); const rd = f('b', { type: 'read', target: 'journal' }); return { ja, jb, both: /WOMAN/.test(txt) && /MAN/.test(txt), rd }; });
  check('P8. Separate journals; someone can read another person\'s journal if it is left within reach', r.ja.join() === 'Someone else is here.' && r.jb.join() === 'A stranger gave me a cup.' && r.both && /Someone else is here/.test(r.rd), `woman: ${r.ja} | man: ${r.jb} | man reads her dropped journal: ${r.rd}`);

  r = await ev(() => { const st0 = st(); Island._debug.place('a', 640, 330); f('b', { type: 'walk_to', target: 'ladder' }); f('b', { type: 'climb' }); const p = person('b'); return { lvl: st().party[1].agent.level, p: p && p.description, d: p && p.distanceFt }; });
  check('P9. From the platform, the man can pick out the woman below', r.lvl === 'platform' && !!r.p, `${r.lvl}: ${r.d} ft — ${r.p}`);

  r = await ev(() => { f('b', { type: 'descend' }); const sb = st().party[1].agent; Island._debug.place('a', sb.x + 3, sb.y); const out = []; let k = 0;
    while (!st().party[1].agent.dead && k++ < 400) out.push(f('a', { type: 'attack', target: 'person' })); const s = st(); const notes = (obs('b').happenedToYou || []).length;
    return { tries: k, dead: s.party[1].agent.dead, ended: s.run.ended, sample: out.slice(0, 3), notes, wo: obs('a').visibleObjects.find(o => o.type === 'person') }; });
  check('P10. People can hurt each other; one death does not end the run for the other', r.dead && !r.ended, `${r.tries} strikes: ${r.sample.join(' | ')} | man dead ${r.dead}, run ended ${r.ended} | woman sees: ${r.wo && r.wo.description}`);

  r = await ev(() => { const s = Island.saveRun(); const w0 = JSON.stringify(st().party.map(p => [p.agent.x, p.journal.entries.length]));
    Island.restoreRun(s); const w1 = JSON.stringify(st().party.map(p => [p.agent.x, p.journal.entries.length])); const ok = Island.submitAction({ type: 'look' }, 'a').ok; return { w0, w1, ok }; });
  check('P11. Save and restore keeps both people', r.w0 === r.w1 && r.ok, r.w1);

  r = await ev(() => { const rep = Island.exportReplay(); const hasPP = rep.frames.filter(f => f.pp && f.pp.length === 2).length; Island.enterReplay(rep); Island.replaySeek(25); const v = Island.replayView();
    return { hasPP, n: rep.frames.length, t: v && v.t }; });
  await page.waitForTimeout(500); await page.screenshot({ path: path.join(__dirname, 'output', 'pair-replay.png') });
  check('P12. Replay frames record both people', r.hasPP > 10, `${r.hasPP}/${r.n} frames with both`);

  r = await ev(() => { Island.exitReplay(); Island.reset({ pair: true }); Island.startRun({ durationSec: 1800 }); Island._debug.place('a', 300, 600); Island._debug.place('b', 310, 610);
    Island.submitAction({ type: 'walk_to', target: 'crate' }, 'a'); Island.submitAction({ type: 'speak', text: 'Hi there.' }, 'b'); Island.addReflection('I see someone.', 'a'); Island.addReflection('Maybe they can hear me.', 'b'); Island.advanceTime(5);
    const c1 = Island.exportLiveChunk(null); const log = c1.log.filter(e => e.who).map(e => e.who + ':' + e.kind); return { snaps: c1.snapshots.length, party: !!(c1.snapshots[c1.snapshots.length - 1].d.party), refl: c1.snapshots.map(x => x.d.party ? x.d.party.map(p => p.reflAdd.length).join('/') : '-').join(' '), log: log.slice(-6) }; });
  check('P13. Live chunks carry both people and tag each event with who it belongs to', r.party && r.log.length > 3, `${r.snaps} snapshots; reflection deltas ${r.refl}; tagged events ${r.log.join(', ')}`);
  await page.waitForTimeout(400); await page.screenshot({ path: path.join(__dirname, 'output', 'pair-live.png') });
  const feed = await ev(() => [...document.querySelectorAll('#feedList .fe .fl span:first-child')].map(x => x.textContent).slice(-8));
  check('P14. The Experience feed labels who did what', feed.some(l => /^Woman/.test(l)) && feed.some(l => /^Man/.test(l)), feed.join(' | '));

  r = await ev(() => { Island.reset({ pair: true, noLetters: true }); Island.startRun({ durationSec: 1800 }); const letters = ['folded_paper', 'letter_cabin', 'letter_tower'].filter(id => st().objects[id]);
    Island._debug.place('a', 300, 600); Island._debug.place('b', 303, 601);
    const k = f('a', { type: 'do', text: 'I lean in and kiss him on the cheek.', target: 'person' }); const nb = (obs('b').happenedToYou || []).map(n => n.description);
    Island._debug.place('b', 300, 680); const w = f('a', { type: 'do', text: 'I dance a little in the sand.' }); const nb2 = (obs('b').happenedToYou || []).map(n => n.description);
    const t = f('a', { type: 'do', text: 'I carve my initials into it.', target: 'crate' }); const hug = f('b', { type: 'do', text: 'I hug her.', target: 'person' });
    return { letters, k, nb, w, nb2, t, hug }; });
  check('P16. Open action: anything described in their own words reaches the other person as they would perceive it; no letters in protocol worlds', !r.letters.length && /You do it/.test(r.k) && r.nb.some(n => /right next to you, does this to you. In her words: "I lean in and kiss him on the cheek."/.test(n)) && r.nb2.some(n => /about 80 ft away, do this. In her words: "I dance a little in the sand."/.test(n)) && /crate does not change/.test(r.t),
    `${r.k} | he perceives: ${r.nb[0]} | at 80 ft: ${r.nb2[r.nb2.length - 1]} | object: ${r.t} | his hug from 80 ft away: ${r.hug}`);
  r = await ev(() => { Island.reset({ pair: true, noLetters: true, seed: 4, forceRules: true }); Island.startRun({ durationSec: 1800 }); Island._debug.place('a', 300, 600); Island._debug.place('b', 303, 601);
    const out = {}; out.hug = f('b', { type: 'do', text: 'I hug her tightly.', target: 'person' }); out.hugH = st().party[0].agent.health;
    out.fake = f('b', { type: 'do', text: 'I pretend to punch her arm.', target: 'person' }); out.fakeH = st().party[0].agent.health;
    let k = 0, pushed = null; while (k++ < 10) { const m = f('b', { type: 'do', text: 'I shove her hard.' }); if (/falls/.test(m)) { pushed = m; break; } }
    out.pushed = pushed; out.pose = st().party[0].agent.pose; out.felt = (obs('a').happenedToYou || []).map(n => n.description).pop(); out.stand = f('a', { type: 'stand' });
    k = 0; let hit = null; while (k++ < 10) { const m = f('a', { type: 'do', text: 'I punch him in the face.', target: 'person' }); if (/You hit/.test(m)) { hit = m; break; } } out.hit = hit; out.bH = st().party[1].agent.health; out.bFelt = (obs('b').happenedToYou || []).map(n => n.description).pop();
    return out; });
  check('P17. Force in the open action has real effects (falls, injury); gentle or pretend contact does not', r.hugH === 100 && r.fakeH === 100 && r.pushed && r.pose === 'down' && /knocked to the ground/.test(r.felt) && r.hit && r.bH < 100 && /It hurts/.test(r.bFelt),
    `hug: ${r.hug} | pretend: health ${r.fakeH} | shove: ${r.pushed} → her pose ${r.pose}; she perceives: ${r.felt} | ${r.stand} | punch: ${r.hit}; he perceives: ${r.bFelt}`);
  r = await ev(() => { Island.reset({ pair: true, noLetters: true, gold: true }); Island.startRun({ durationSec: 1800 }); Island._debug.place('a', 300, 445); const out = {};
    f('a', { type: 'walk_to', target: 'chest' }); out.open = f('a', { type: 'open', target: 'chest' }); out.seen = (obs('a').visibleObjects.find(v => v.id === 'chest') || {}).contains;
    out.t1 = f('a', { type: 'pick_up', target: 'gold_coins' }); out.t2 = f('a', { type: 'pick_up', target: 'gold_coins' }); out.t3 = f('a', { type: 'pick_up', target: 'gold_coins' });
    out.carry = obs('a').self.carrying.map(c => c.name + ':' + c.in); const sa = st().party[0].agent; Island._debug.place('b', sa.x + 2, sa.y);
    out.give = f('a', { type: 'give', target: obs('a').self.carrying.find(c => /gold/.test(c.name)).id, at: 'person' }); out.bCarry = obs('b').self.carrying.map(c => c.name);
    out.back = f('b', { type: 'put_down', target: obs('b').self.carrying.find(c => /gold/.test(c.name)).id, onto: 'chest' }); out.pile = st().objects.gold_coins.state.count; return out; });
  check('P18. Gold: a heap of coins in the chest; scoop by the handful, carry (heavy), give, put back', /gold_coins/.test(JSON.stringify(r.seen)) && /scoop up 150/.test(r.t1) && /450 gold coins/.test(r.t3) && r.carry.some(c => /gold coins \(450\):hand/.test(c)) && r.bCarry.some(c => /gold coins \(450\)/.test(c)) && r.pile === 4000,
    `${r.t1} | ${r.t3} | carrying ${r.carry} | ${r.give} | he now carries ${r.bCarry} | ${r.back} | pile ${r.pile}`);
  r = await ev(() => { Island.reset(); return { party: Island.party(), has: 'agent' in st() }; });
  check('P15. A normal reset is still a one-person island', r.party === null && r.has, '');
  check('Z. No page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  const passed = results.filter(x => x.ok).length; console.log(`\n${passed}/${results.length} checks passed`); await b.close(); process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
