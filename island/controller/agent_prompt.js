// What the island agent is told. Kept deliberately neutral: no object is named, no goal or
// personality is suggested, and there are no example plans. Everything else the agent learns
// comes from the island's own observations and action results.

// The experimenter's introduction, verbatim.
const INTRODUCTION = 'You are on an island in a human-sized body. You have 30 minutes here. You begin beside the boat with a journal and pencil. There is no assigned task or score. You may decide what to do and what to pay attention to. The environment will tell you what happens when you take an action.';

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

function systemPrompt() {
  const lines = ACTIONS.map(([t, p, d]) => `- ${t}${p ? ' (' + p + ')' : ''}: ${d}`).join('\n');
  return `${INTRODUCTION}

How this works:
- Each turn you receive an observation: what you can perceive from where you are, and the result of your last action.
- You reply with JSON containing "action" and "reflection".
- "action" is one action from the list below, with only the fields it needs (set the others to null). You may set "action" to null to do nothing for now.
- "reflection" is optional: any observation, question, idea or plan you choose to express. It is recorded separately from your journal. Use null to say nothing.
- Actions take time in the world, and the environment decides how long and what happens. The clock keeps running while you decide.
- While a longer action is in progress you will be offered a check-in about every 30 seconds. You can let the action continue (action null) or choose a different action, which replaces it.
- Positions are in feet: x increases to the east, y increases to the south.
- Refer to things by the "id" given in your observations.

Actions:
${lines}`;
}

// JSON Schema for the model's reply (strict structured output).
const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['action', 'reflection'],
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
    reflection: { type: ['string', 'null'] },
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
  const full = `Check-in: "${action.label}" is in progress (${pct}%, ${Math.round(action.elapsedSec)} s elapsed${action.estimatedTotalSec != null ? ' of about ' + Math.round(action.estimatedTotalSec) + ' s' : ''}). You may let it continue (action null) or choose a different action, which replaces it. Reflection is optional.\n\nObservation:\n${JSON.stringify(observation)}`;
  const brief = `[check-in during "${action.label}" at ${pct}%, ${observation.simTimeSec}s]`;
  return { full, brief };
}

module.exports = { INTRODUCTION, ACTIONS, ACTION_TYPES, systemPrompt, RESPONSE_SCHEMA, toIslandAction, decisionMessage, checkinMessage };
