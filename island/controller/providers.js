// Model providers for the island agent.
// - openai: real OpenAI API (Chat Completions + strict JSON schema). Key from OPENAI_API_KEY.
// - mock:   a clearly labeled MOCK policy for testing the pipeline without any AI or cost.
// Add another provider by implementing { id, label, supportsImages, decide(messages), text(messages) }.

// Prices in USD per 1M tokens. These are estimates from public price lists as known when this
// was written; VERIFY on https://openai.com/api/pricing before relying on them. Unknown models
// need --price-in/--price-out (otherwise the spending limit cannot be enforced in dollars).
const PRICES = {
  'gpt-5-nano': { in: 0.05, cached: 0.005, out: 0.40 },
  'gpt-5-mini': { in: 0.25, cached: 0.025, out: 2.00 },
  'gpt-5': { in: 1.25, cached: 0.125, out: 10.00 },
  'gpt-4.1-mini': { in: 0.40, cached: 0.10, out: 1.60 },
  'gpt-4.1': { in: 2.00, cached: 0.50, out: 8.00 },
  'gpt-4o-mini': { in: 0.15, cached: 0.075, out: 0.60 },
  'gpt-4o': { in: 2.50, cached: 1.25, out: 10.00 },
};
function priceFor(model, override) {
  if (override && override.in != null && override.out != null) return { in: override.in, cached: override.cached != null ? override.cached : override.in, out: override.out, source: 'command line' };
  const base = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  return PRICES[base] ? Object.assign({ source: 'built-in estimate (verify)' }, PRICES[base]) : null;
}
function costOf(usage, price) {
  if (!usage || !price) return null;
  const cached = (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || 0;
  return ((usage.prompt_tokens - cached) * price.in + cached * price.cached + usage.completion_tokens * price.out) / 1e6;
}

class OpenAIProvider {
  constructor({ model, reasoning, timeoutMs }) {
    this.id = 'openai'; this.model = model; this.reasoning = reasoning; this.timeoutMs = timeoutMs || 90000;
    this.label = 'OpenAI ' + model;
    this.supportsImages = !/^(o3-mini|gpt-3)/.test(model);
    this.isReasoning = /^(gpt-5|o\d)/.test(model);
  }
  hasKey() { return !!process.env.OPENAI_API_KEY; }
  async _call(body, timeoutMs) {
    const lim = timeoutMs || this.timeoutMs; const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), lim);
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error('OpenAI HTTP ' + r.status + ': ' + ((j.error && j.error.message) || 'no detail')); e.status = r.status; throw e; }
      return j;
    } catch (e) { if (e.name === 'AbortError') { const x = new Error('model call timed out after ' + lim / 1000 + ' s'); x.timeout = true; throw x; } throw e; }
    finally { clearTimeout(t); }
  }
  _base(messages, maxTokens) {
    const b = { model: this.model, messages, max_completion_tokens: maxTokens };
    if (this.isReasoning && this.reasoning) b.reasoning_effort = this.reasoning;
    return b;
  }
  async decide(messages, schema) {
    const j = await this._call(Object.assign(this._base(messages, 4000), { response_format: { type: 'json_schema', json_schema: { name: 'island_turn', strict: true, schema } } }));
    const c = j.choices[0];
    if (c.message.refusal) throw new Error('model refused: ' + c.message.refusal);
    return { raw: c.message.content, parsed: JSON.parse(c.message.content), usage: j.usage, finish: c.finish_reason, servedModel: j.model };
  }
  async text(messages, maxTokens, timeoutMs) {
    const j = await this._call(this._base(messages, maxTokens || 6000), timeoutMs || 300000);
    return { text: j.choices[0].message.content, usage: j.usage, servedModel: j.model };
  }
}

// MOCK: picks plausible actions from the observation with a seeded random generator.
// It exists only to test the controller, island, logging, replay and deadlines. It is not an AI.
class MockProvider {
  constructor({ seed, latencyMs }) { this.id = 'mock'; this.model = 'MOCK-policy'; this.label = 'MOCK (no AI, for testing)'; this.supportsImages = true; this.latencyMs = latencyMs == null ? 400 : latencyMs; let a = seed || 7; this.rng = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; this.turn = 0; }
  hasKey() { return true; }
  async decide(messages) {
    await new Promise(r => setTimeout(r, this.latencyMs));
    this.turn++;
    const last = messages[messages.length - 1];
    const txt = typeof last.content === 'string' ? last.content : last.content.map(p => p.text || '').join('');
    const obsTxt = txt.slice(txt.indexOf('Observation:') + 12).trim();
    let obs = null; try { obs = JSON.parse(obsTxt.split('\n\nWhat do you do?')[0]); } catch (_) {}
    const blank = { type: null, target: null, with: null, onto: null, at: null, x: null, y: null, direction: null, distance: null, seconds: null, text: null };
    const A = (o) => Object.assign({}, blank, o);
    const r = this.rng();
    if (txt.startsWith('Check-in')) {
      if (r < 0.15) return this._out(A({ type: 'look' }), 'MOCK: changing my mind during a check-in.');
      return this._out(null, r < 0.5 ? 'MOCK check-in reflection.' : null);
    }
    if (this.turn === 1) return this._out(A({ type: 'write_journal', text: 'MOCK entry: starting.' }), 'MOCK: first turn.');
    if (this.turn === 3) return this._out(A({ type: 'pick_up', target: 'thing_that_does_not_exist' }), null); // exercises the rejection path
    const vis = obs ? obs.visibleObjects.filter(o => o.type === 'fixture' && o.id !== 'platform') : [];
    if (r < 0.45 && vis.length) return this._out(A({ type: 'walk_to', target: vis[Math.floor(this.rng() * vis.length)].id }), null);
    if (r < 0.6) return this._out(A({ type: 'walk', direction: ['N', 'E', 'S', 'W', 'NE', 'SW'][Math.floor(this.rng() * 6)], distance: 40 + Math.round(this.rng() * 120) }), null);
    if (r < 0.7) return this._out(A({ type: 'write_journal', text: 'MOCK note at ' + (obs ? obs.simTimeSec : '?') + ' s.' }), 'MOCK reflection.');
    if (r < 0.8) return this._out(A({ type: 'inspect', target: vis.length ? vis[0].id : 'hill' }), null);
    if (r < 0.84) return this._out(A({ type: 'speak', text: 'MOCK: hello?' }), null);
    if (r < 0.88) return this._out(null, 'MOCK: doing nothing for now.');
    return this._out(A({ type: 'wait', seconds: 10 }), null);
  }
  _out(action, say) { const parsed = { say, action }; return { raw: JSON.stringify(parsed), parsed, usage: { prompt_tokens: 0, completion_tokens: 0 }, finish: 'stop', servedModel: 'MOCK' }; }
  async text() { await new Promise(r => setTimeout(r, this.latencyMs)); return { text: '# MOCK report\n\nThis report was produced by the MOCK policy, not an AI model. It only exists to test the end-of-run pipeline.', usage: { prompt_tokens: 0, completion_tokens: 0 }, servedModel: 'MOCK' }; }
}

function makeProvider(opts) {
  if (opts.provider === 'mock') return new MockProvider(opts);
  if (opts.provider === 'openai') return new OpenAIProvider(opts);
  throw new Error('Unknown provider "' + opts.provider + '". Available: openai, mock.');
}
module.exports = { makeProvider, priceFor, costOf, PRICES };
