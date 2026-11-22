// Example external controller for Watchable Island.
//
// This shows the simplest tested way for a separate program to drive the locally opened island:
// Playwright opens island.html in a real browser window (you can watch it), and this script talks
// to the page's window.Island API with page.evaluate(). No server is needed.
//
// THERE IS NO AI HERE. decideNextAction() is a simple scripted placeholder. To connect a model,
// replace decideNextAction() with a call to your model provider, passing it the observation and the
// action schema, and parsing its reply into one action object. Keep API keys in this controller
// (environment variables), never inside island.html.
//
// Setup:  npm i playwright && npx playwright install chromium
// Run:    node controller/example_controller.js              (real time, visible window, 30-min run)
//         node controller/example_controller.js --speed 60 --headless --minutes 5   (quick test)
//         add --video to record the run to a .webm in controller/output/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const SPEED = +opt('speed', 1);              // 1 = real time. Anything else is logged as TEST SPEED.
const HEADLESS = !!opt('headless', false);
const MINUTES = +opt('minutes', 30);
const VIDEO = !!opt('video', false);
const OUT = path.resolve(__dirname, 'output');
const ISLAND = 'file://' + path.resolve(__dirname, '..', 'island.html');

// ---- Replace this with your model call ------------------------------------------------------
// Input: the agent's observation (what it can perceive), the action schema, and recent results.
// Output: { action: {type, ...params}, reflection?: string }
let step = 0;
async function decideNextAction(observation, schema, history) {
  const plan = [
    { action: { type: 'look' } },
    { action: { type: 'write_journal', text: 'I am on a beach next to a rowboat. I can see a tall ladder to the northeast.' } },
    { action: { type: 'walk_to', target: 'ladder' } },
    { action: { type: 'climb' }, reflection: 'Placeholder reflection: climbing to see the whole island.' },
    { action: { type: 'look' } },
    { action: { type: 'pick_up', target: 'snorkel' } },
    { action: { type: 'wear', target: 'snorkel' } },
    { action: { type: 'descend' } },
    { action: { type: 'walk_to', target: 'pond' } },
    { action: { type: 'use', target: 'snorkel' } },
    { action: { type: 'sit' } },
    { action: { type: 'write_journal', text: 'I looked under the pond surface with the snorkel.' } },
  ];
  const next = plan[step++];
  return next || { action: { type: 'rest', seconds: 60 } };
}
// ------------------------------------------------------------------------------------------------

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', e => console.error('[island error]', e.message));
  let videoSaved = null;   // the island triggers a browser download when a video stops
  page.on('download', async d => { const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); videoSaved = f; console.log('Video saved:', f); });
  await page.goto(ISLAND);
  await page.waitForFunction(() => window.Island && Island.getStatus);
  const call = (fn, arg) => page.evaluate(fn, arg);

  // Stream environment events to this console (the island keeps the authoritative log itself).
  await page.exposeFunction('__onIslandEvent', e => console.log(`[${e.sim.toFixed(1)}s] ${e.kind.padEnd(10)} ${e.msg}`));
  await call(() => Island.on(e => window.__onIslandEvent(e)));

  await call(s => { Island.reset({ speed: s }); }, SPEED);
  if (VIDEO) await call(() => Island.startVideo({}));
  await call(m => Island.startRun({ durationSec: m * 60 }), MINUTES);
  const schema = await call(() => Island.getActionSchema());
  const history = [];

  while (true) {
    const status = await call(() => Island.getStatus());
    if (status.run.ended) break;
    if (status.action) { await new Promise(r => setTimeout(r, 500)); continue; }   // wait for the current action

    const observation = await call(() => Island.getObservation());              // NOT the full world state
    const decision = await decideNextAction(observation, schema, history);
    if (decision.reflection) await call(t => Island.addReflection(t), decision.reflection);
    const res = await call(a => Island.submitAction(a), decision.action);
    history.push({ request: decision.action, response: res });
    if (!res.ok) console.log('  -> rejected:', res.error);                        // the model should see this and adapt
    await new Promise(r => setTimeout(r, 300));
  }

  // Export everything at the end of the run.
  const replay = await call(() => Island.exportReplay());
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.writeFileSync(path.join(OUT, `replay-${stamp}.json`), JSON.stringify(replay));
  fs.writeFileSync(path.join(OUT, `log-${stamp}.json`), JSON.stringify(await call(() => Island.exportLog()), null, 1));
  fs.writeFileSync(path.join(OUT, `journal-${stamp}.txt`), await call(() => Island.exportJournal()));
  if (VIDEO) {
    await call(() => Island.stopVideo());   // the video normally auto-stops when the run ends
    for (let i = 0; i < 100 && !videoSaved; i++) await new Promise(r => setTimeout(r, 200));
  }
  console.log('Run finished. Files written to', OUT);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
