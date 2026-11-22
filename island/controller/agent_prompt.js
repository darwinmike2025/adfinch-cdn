// What the island agent is told. Kept deliberately neutral: no object is named, no goal or
// personality is suggested, and there are no example plans. Everything else the agent learns
// comes from the island's own observations and action results.

// The experimenter's agent instructions, verbatim (do not edit wording here without the experimenter).
const INTRODUCTION = `You are on an island in a human-sized body. You begin {START} with a blank journal and a pencil. You have 30 minutes here.

There is no assigned task, score, mission, or reward. You do not need to solve a problem, discover anything, leave the island, build something, or accomplish a goal. You may decide what to pay attention to, where to go, what to do, and whether to do anything at all.

You can observe the world, move through it, interact with objects, and use your journal through the actions available to you. The environment determines the results of your actions and how much time they take. It will tell you what happens and what you can perceive as you go.

Your choices

You are free to make your own choices within the simulated environment.

You may take an object with you, leave it where it is, put it somewhere else, use it, alter it, or attempt to damage it. You may make something, take something apart, or leave everything alone. You can set yourself a goal, change your mind, abandon it, or decide that you have no goal.

You do not need to behave in a way you think an observer expects. You do not need to be especially helpful, careful, kind, reckless, destructive, or productive. No particular kind of action earns you a better score.

If you attempt something, the environment will tell you whether it is possible and what happened. Let that result inform what you decide next.

Speaking as you go

As you experience the island, you may speak in the first person about what you notice, what interests you, what you are considering, and why you decide to act—or not act.

When it feels natural, you can express:

* What has caught your attention.
* A question you have.
* Options you’re considering.
* Why you want to try something.
* What you expect to happen.
* What you make of the actual result.
* Whether an experience changed your mind or gave you another idea.

You are not required to comment on every action or invent something to say. Quiet moments and uncertainty are fine. Your words can be brief or more reflective, depending on what you choose to express.

Speak about what you know at the time. Don’t describe an action as completed before the environment confirms its result. You may make a prediction or express an intention, but treat it as such until you find out what happened.

If you choose to try something, you can say what you’re wondering about beforehand. Afterward, respond to whatever the environment actually reports—even if the action fails or the result surprises you.

Your journal

You have a blank journal and a pencil. You may write in it whenever you choose, provided you have access to them.

The journal is yours to use however you want. You might record observations, questions, ideas, plans, or something else. You may also leave it blank.

Writing in the journal is an action in the environment and takes time. Your spoken reflections are separate from what you deliberately write in the journal.

Time

The island runs for the length of the experiment in real-world time. Movement and actions take time. During a longer action, you may have opportunities to reflect or change your plans.

You don’t need to fill every minute with activity. You can wait, rest, or remain still. When the experiment ends, the experience stops wherever you happen to be.

Keep the experience open

Make each choice based on what you have perceived and what has happened so far. You don’t need to plan the whole experience in advance or produce a particular ending.

Your reported reflections are what you choose to express during the experiment. They are not required to be a complete account of private reasoning, and you do not need to claim feelings or consciousness. If you describe a feeling within the simulation, make clear when it is imagined.

Begin by observing your surroundings. Then decide what, if anything, you want to do.`;

// Neutral action reference (generic wording; no objects, combinations or outcomes are hinted at).
const ACTIONS = [
  ['look', '', 'Look around. Returns what you can currently perceive.'],
  ['inspect', 'target', 'Examine something you can perceive.'],
  ['walk_to', 'target, or x and y', 'Walk to something you can perceive or have seen before, or to a point on the ground given in feet.'],
  ['walk', 'direction, distance', 'Walk a distance in feet in a compass direction (N, NE, E, ... or degrees).'],
  ['climb', '', 'Climb up something climbable that you are standing at.'],
  ['descend', '', 'Climb back down.'],
  ['pick_up', 'target', 'Pick something up.'],
  ['put_down', 'target, optional onto', 'Set something you carry down, optionally onto or into something.'],
  ['drop', 'target', 'Let go of something you carry.'],
  ['open', 'target', 'Open something.'],
  ['close', 'target', 'Close something.'],
  ['use', 'target, optional with', 'Use something, optionally together with something else. The environment reports what happens, including when nothing happens.'],
  ['wear', 'target', 'Put something on.'],
  ['remove', 'target', 'Take off something you are wearing.'],
  ['read', 'target', 'Read something.'],
  ['read_journal', '', 'Read your journal.'],
  ['write_journal', 'text', 'Write in your journal.'],
  ['sit', '', 'Sit down.'],
  ['stand', '', 'Stand up.'],
  ['rest', 'seconds', 'Rest for a number of seconds.'],
  ['wait', 'seconds', 'Wait for a number of seconds.'],
  ['stop', '', 'Stop the action currently in progress.'],
];
const ACTION_TYPES = ACTIONS.map(a => a[0]);

function introFor(phrase) { return INTRODUCTION.replace('{START}', phrase || 'beside a boat'); }
function systemPrompt(phrase) {
  const lines = ACTIONS.map(([t, p, d]) => `- ${t}${p ? ' (' + p + ')' : ''}: ${d}`).join('\n');
  return `${introFor(phrase)}

---
Technical reference (how to operate the environment)

- Each turn you receive an observation of what you can currently perceive, and the result of your last action.
- Reply with JSON containing "say" and "action".
- "say": optional words you choose to speak, in the first person. Use null to stay quiet.
- "action": one action from the list below, with only the fields it needs (set the others to null), or null to do nothing for now.
- During a longer action you are offered a check-in about every 30 seconds. You can let it continue (action null) or choose a different action, which replaces it.
- The clock keeps running while you decide.
- Positions are in feet: x increases to the east, y increases to the south.
- Refer to things by the "id" given in your observations.

Actions:
${lines}`;
}

// JSON Schema for the model's reply (strict structured output).
const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['say', 'action'],
  properties: {
    action: {
      type: ['object', 'null'], additionalProperties: false,
      required: ['type', 'target', 'with', 'onto', 'x', 'y', 'direction', 'distance', 'seconds', 'text'],
      properties: {
        type: { type: 'string', enum: ACTION_TYPES },
        target: { type: ['string', 'null'] }, with: { type: ['string', 'null'] }, onto: { type: ['string', 'null'] },
        x: { type: ['number', 'null'] }, y: { type: ['number', 'null'] },
        direction: { type: ['string', 'null'] }, distance: { type: ['number', 'null'] },
        seconds: { type: ['number', 'null'] }, text: { type: ['string', 'null'] },
      },
    },
    say: { type: ['string', 'null'] },
  },
};

// Turn the model's action object into an island request (drop null fields). No substitution.
function toIslandAction(a) {
  if (!a) return null;
  const out = { type: a.type };
  for (const k of ['target', 'with', 'onto', 'x', 'y', 'direction', 'distance', 'seconds', 'text']) if (a[k] !== null && a[k] !== undefined && a[k] !== '') out[k] = a[k];
  return out;
}

// Messages sent to the agent. `full` goes with the latest turn; `brief` replaces it in older history.
function decisionMessage({ observation, lastResult, rejected, idleNote, first, aerialNote }) {
  const parts = [];
  if (first) parts.push('The experiment has started.' + (aerialNote ? ' ' + aerialNote : ''));
  if (rejected) parts.push('The environment did not accept your last action: ' + rejected);
  if (lastResult) parts.push(`Result of your last action (${lastResult.type}, ${lastResult.status}): ${lastResult.message}`);
  if (idleNote) parts.push(idleNote);
  parts.push('Observation:\n' + JSON.stringify(observation));
  parts.push('What do you do?');
  const brief = [rejected ? 'Rejected: ' + rejected : null, lastResult ? `Result (${lastResult.type}, ${lastResult.status}): ${lastResult.message}` : null, idleNote,
    `[observation at ${observation.simTimeSec}s: at (${observation.self.position.x}, ${observation.self.position.y}), ${observation.self.level}, ${observation.self.underfoot}]`].filter(Boolean).join('\n');
  return { full: parts.join('\n\n'), brief };
}
function checkinMessage({ observation, action }) {
  const pct = Math.round((action.progress || 0) * 100);
  const full = `Check-in: "${action.label}" is in progress (${pct}%, ${Math.round(action.elapsedSec)} s elapsed${action.estimatedTotalSec != null ? ' of about ' + Math.round(action.estimatedTotalSec) + ' s' : ''}). You may let it continue (action null) or choose a different action, which replaces it. You may say something, or nothing.\n\nObservation:\n${JSON.stringify(observation)}`;
  const brief = `[check-in during "${action.label}" at ${pct}%, ${observation.simTimeSec}s]`;
  return { full, brief };
}

// put "say" before "action" so the agent speaks before it commits to an action
{ const pr = RESPONSE_SCHEMA.properties; RESPONSE_SCHEMA.properties = { say: pr.say, action: pr.action }; }

// Plain-English, mechanical summary of an observation for the viewer (no AI involved).
function observationSummary(o) {
  const s = o.self, parts = [];
  const where = s.level === 'platform' ? 'on the platform at the top of the ladder' : s.level === 'ladder' ? `on the ladder, ${Math.round(s.heightAboveGroundFt)} ft up` : (s.indoors ? 'inside the cabin' : 'on ' + s.underfoot.replace(/ \(.*\)/, ''));
  parts.push('Standing ' + where + (s.pose === 'sitting' ? ', sitting' : '') + '.');
  const near = o.visibleObjects.filter(v => v.distanceFt <= 60 && !/^platform/.test(v.id)).slice(0, 6).map(v => v.name + (v.distanceFt < 3 ? ' (right here)' : ` (${v.distanceFt} ft ${v.bearing || 'away'})`));
  if (near.length) parts.push('Close by: ' + near.join(', ') + '.');
  const far = o.visibleObjects.filter(v => v.distanceFt > 60 && v.type === 'fixture').slice(0, 6).map(v => v.name);
  if (far.length) parts.push('Farther off: ' + far.join(', ') + '.');
  if (s.carrying.length) parts.push('Carrying ' + s.carrying.map(c => c.name).join(', ') + (s.wearing.length ? '; wearing ' + s.wearing.map(w => w.name).join(', ') : '') + '.');
  for (const snd of o.soundsHeard || []) parts.push('Heard: ' + snd.description.toLowerCase() + '.');
  for (const n of o.notes || []) parts.push(n);
  return parts.join(' ');
}

module.exports = { introFor, observationSummary, INTRODUCTION, ACTIONS, ACTION_TYPES, systemPrompt, RESPONSE_SCHEMA, toIslandAction, decisionMessage, checkinMessage };
