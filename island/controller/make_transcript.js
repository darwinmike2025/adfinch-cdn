// Turns a run folder into a readable transcript (transcript.md): what the agent was shown,
// what it chose, what it chose to say (reflections), what it wrote in its journal, and what the
// island says happened. The model's private reasoning is not available from the API, so it is not here.
//   node controller/make_transcript.js runs/<run-folder>
const fs = require('fs'), path = require('path');
function makeTranscript(dir) {
  const rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
  const cfg = JSON.parse(rd('config.json'));
  const tr = rd('transcript.jsonl').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const log = JSON.parse(rd('island-log.json'));
  const fmt = s => { s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const actText = a => { if (!a) return '_(no action: chose to do nothing for now)_'; const p = Object.entries(a).filter(([k, v]) => k !== 'type' && v !== null && v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`); return '`' + a.type + '`' + (p.length ? ' (' + p.join(', ') + ')' : ''); };
  const sceneOf = obs => { try { const o = JSON.parse(obs); const s = o.self; const seen = o.visibleObjects.filter(v => v.distanceFt < 120).slice(0, 8).map(v => `${v.name} (${v.distanceFt} ft ${v.bearing || ''})`.trim());
      return `At (${s.position.x}, ${s.position.y}), ${s.level}${s.heightAboveGroundFt ? ' ' + s.heightAboveGroundFt + ' ft up' : ''}, ${s.underfoot}. Carrying: ${s.carrying.map(c => c.name).join(', ') || 'nothing'}${s.wearing.length ? '; wearing ' + s.wearing.map(w => w.name).join(', ') : ''}. Nearby: ${seen.join('; ') || 'nothing close'}.${o.notes && o.notes.length ? ' Notes: ' + o.notes.join(' ') : ''}`; } catch (_) { return null; } };
  const L = [];
  L.push(`# Transcript: ${cfg.runId}`, '');
  L.push(`${cfg.test ? '**TEST RUN** (' + (cfg.testLabel || 'test') + ')' : '**Experiment run**'} · model **${cfg.model}** · ${cfg.observationMode} observations · ${cfg.durationMinutes} min at ${cfg.timeSpeed}× · starting island: ${cfg.startingIsland.type}`, '');
  L.push('This shows what the agent was told, what it chose, what it chose to say ("reflections"), what it wrote in its journal, and what the island reports happened. The model\'s private reasoning is not provided by the API and is not shown. Reflections are what it chose to express, not a record of its thoughts.', '');
  L.push('## What it was told at the start', '', '> ' + cfg.introduction, '', cfg.observationMode === 'aerial' ? '_It was also shown the aerial picture of the island, once, at the start._\n' : '');
  L.push('## Turn by turn', '');
  let li = 0;
  const envBetween = (t0, t1) => { const out = []; while (li < log.length && log[li].sim <= t1) { const e = log[li++]; if (e.sim < t0) continue; if (['request', 'reflection', 'controller', 'start'].includes(e.kind)) continue; if (e.kind === 'system' && !/Run (started|ended)/.test(e.msg)) continue; out.push(`- [${fmt(e.sim)}] ${e.kind === 'journal' ? '📓 ' : ''}${e.msg}`); } return out; };
  let prevT = 0;
  for (const t of tr) {
    if (t.kind !== 'decision' && t.kind !== 'checkin') continue;
    const env = envBetween(prevT, t.simAtRequest); if (env.length) L.push('**What happened:**', ...env, '');
    L.push(`### ${fmt(t.simAtRequest)} · ${t.kind === 'checkin' ? 'check-in during an action' : 'decision'}${t.latencyMs ? ` (took ${(t.latencyMs / 1000).toFixed(1)} s to decide)` : ''}`);
    const obs = (t.sentToAgent || '').split('Observation:\n')[1]; const scene = obs ? sceneOf(obs.split('\n\nWhat do you do?')[0]) : null;
    const pre = (t.sentToAgent || '').split('\n\nObservation:')[0].replace(/^Check-in: /, '').trim();
    if (pre && !/^What do you do/.test(pre)) L.push('', '_Told:_ ' + pre.replace(/\n+/g, ' '));
    if (scene) L.push('', '_Saw:_ ' + scene);
    if (t.error) L.push('', `**Model error:** ${t.error}`);
    else { L.push('', `**Chose:** ${actText(t.reply && t.reply.action)}`); if (t.reply && t.reply.reflection) L.push('', `**Said (reflection):** "${t.reply.reflection}"`); }
    L.push(''); prevT = t.simAtRequest;
  }
  const rest = envBetween(prevT, Infinity); if (rest.length) L.push('**What happened:**', ...rest, '');
  try { L.push('## Its journal', '', rd('journal.txt').split('\n').slice(2).join('\n').trim() || '(blank)', ''); } catch (_) {}
  try { L.push('## Its report afterwards', '', rd('report.md').replace(/^# .*\n/, ''), ''); } catch (_) {}
  fs.writeFileSync(path.join(dir, 'transcript.md'), L.join('\n'));
  return path.join(dir, 'transcript.md');
}
if (require.main === module) console.log(makeTranscript(process.argv[2]));
module.exports = { makeTranscript };
