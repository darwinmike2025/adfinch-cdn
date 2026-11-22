# Watchable Island

A self-contained simulation island that you watch in a browser while an agent moves around it. Everything lives in one file, **`island.html`**. It has no server, no install, no internet access, no API keys and no AI calls.

No AI is connected yet. The island runs on its own and has manual test controls. The `window.Island` API (below) is the hook for a future AI controller.

## Open it

Double-click `island.html`, or drag it into Chrome, Edge, Firefox or Safari. That's all.

- Works offline (tested with the network fully blocked).
- Video recording works best in **Chrome or Edge** (WebM). Firefox records WebM too. Safari support depends on the version (it may produce MP4 or nothing).

## What's on screen

| Area | What it shows |
|---|---|
| Island view | Terrain, objects and the agent (the figure with the pulsing yellow ring). The 100 ft ladder is drawn rising "up the screen". Scroll to zoom, drag to pan. **Follow figure** zooms in and tracks the agent. |
| Ladder side view (bottom-left) | The agent's height on the ladder, 0 to 100 ft, live. |
| Clock | Run elapsed and time remaining for the 30-minute run, the simulation clock, and the time speed. |
| Current action | What the agent is doing, a progress bar, elapsed vs estimated time, position, and what it's carrying or wearing. |
| Activity log | Timestamped events. **ENV** = decided by the environment, **REQ** = action requested, **REJECT/FAIL** = refused or failed, **JOURNAL**, **REFLECT**, **SYS**. Hover a row for wall-clock time and speed. |
| Journal | In-world journal entries. An entry being written shows live with a dashed border. |
| Reflections | Things the agent *reports* about itself. These are kept separate and are not verified by the environment. |

The header chip shows **1× REAL TIME** (green) or **TEST SPEED n×** (orange). Every speed change is logged.

**Manual test controls** (the drawer under the map) are for testing only. They submit actions through the same API a controller uses. You can also click the map to walk there.

## The island

The layout follows the reference image (`screenshots/reference-image.png`, an angled view looking north from the south-west), turned into a top-down map.

- Map: 1000 × 800 ft. The island is about 930 ft across at its widest point (west to east).
- **Coordinates:** feet, origin at the **north-west corner**, **x increases east, y increases south** (north is up). Elevation is in feet.
- All positions are in the `LAYOUT` block near the top of the script. Edit those numbers to adjust the map.
- Shoreline: sandy beach along the south-west, south and west; rocky cliffs along the east, north-east and south-east (impassable at the edge); a narrow rocky rim elsewhere.

| Feature | Position (ft) | Notes |
|---|---|---|
| Agent start | (268, 714) | Sandy beach beside the boat, carrying a blank **journal** and a **pencil** |
| Rowboat | (260, 705) | Holds an **oar**. Launching the boat is not implemented. |
| Coil of rope, wooden crate | (400, 720), (455, 725) | On the beach. The crate opens and holds a **tin cup**. |
| Driftwood table | (361, 640) | A **sheet of paper** on it is a hand-drawn map you can read |
| Fire pit | (286, 570) | Stone ring. Put driftwood in, then use the lighter on it. |
| Wheelbarrow | (205, 522) | Pick it up to push it (both hands); anything inside comes along |
| Cabin | x 245–285, y 395–425 | In the western trees, door on the south wall (closed at start). Inside: a table with an **oil lantern** (fragile) and a bed. |
| Wooden chest | (302, 432) | Outside, beside the cabin door. **Locked**; holds a **folded letter**. |
| Standing mirror | (160, 455) | Round mirror by a tree. "Use" it to look at yourself. |
| Stream | hill steps (470, 250) → footbridge → south beach (540, 795) | Rocky; wading is slow (0.25× speed) |
| Footbridge | (430, 505) | Arched, crosses the stream at normal speed |
| Hill | peak at (525, 170), ~60 ft high | Boulders on top; stone steps beside the stream |
| Pond | centre (590, 420), 140 × 76 ft | Lily pads. Can't be walked into. A **brass key** lies underwater near the west bank. |
| Tower and ladder | foundation centre (690, 530), 30 ft square; climb from (690, 549) | **100 ft** ladder up the middle of a four-legged steel tower to a railed platform. On the platform's table: **lighter**, **sword**, **snorkel** |
| Stepladder | (575, 520) | Small wooden A-frame, movable (both hands) |
| Red ball, blue blanket, wooden blocks | (582, 610), (645, 615), (735, 612) | On the grass south of the tower |
| Stone circle | (800, 420) | Low ring of stones near the eastern cliffs |
| Bronze bell | (845, 310) | On a wooden frame on the north-east headland. Can be rung. |
| Forests | west and north-west, around the cabin | Rough ground (0.72× speed). Trunks are obstacles. |

## Simulation rules (the environment decides all of these)

**Time.** Real time by default (1×). Test speeds are 2, 5, 10, 30 and 60×, and they're logged. Time advances in 0.25 s steps.

**Walking.** 4 ft/s on clear, level grass. The speed is multiplied by:
- terrain: beach 0.85, forest 0.72, rocky ground 0.65, stream 0.25, bridge/grass/floor 1.0
- slope: `1 / (1 + 2.5·uphill grade + 1.0·downhill grade)`
- load: each awkward item carried (oar, sword in hand) 0.85; total weight over 10 lb slows you further (up to 0.6×)

Routes are found by A* pathfinding on a 5 ft grid that minimises travel time. Walking 300 ft on clear ground takes about 75 s.

**Climbing.** 2.4 s per ft up (4:00 for 100 ft) and 2.1 s per ft down (3:30). Both hands must be free: pocket-sized items are fine, and worn items are fine (wearing the sword makes climbing 10% slower). If you stop, the agent holds on at its current height.

**Hands and pockets.** Small items go in pockets (up to 6). Medium items (oar, rope, driftwood, lantern, sword, ball, blanket, blocks) take one hand each, and you have 2 hands. Large items (wheelbarrow, stepladder) take both hands. The snorkel can be worn, and so can the sword (by its shoulder strap).

**Action durations.** Look 4 s · inspect 6 s · pick up 3 s (10 s underwater) · put down 3 s · drop 1 s · open/close 2–3 s · wear 6 s · remove 5 s · ring bell 6 s · light fire 15 s · light lantern 8 s · look underwater 20 s · write ≈2.5 s per word (minimum 8 s) · read ≈0.3 s per word · sit 3 s · stand 2 s · rest/wait as requested.

**Interrupting.** Walking stops at the agent's real position. Climbing holds on at the current height. Writing keeps the words already written (marked "interrupted"). Other actions have no effect if stopped early.

**Consequences.**
- Objects stay exactly where they're put until reset.
- **Put down** places an item gently. **Drop** lets it fall: fragile items (the lantern) break. Dropped from the ladder or platform, an item lands near the ladder base, with a thud others can hear.
- The chest is locked. Opening it fails until the brass key is used on it.
- Fire needs driftwood in the pit. Each log burns about 15 minutes and is then gone. Burnable items put into a lit fire are destroyed, including the journal.
- The bell is heard island-wide for 30 s.
- The tin cup can be filled at the pond or stream, then drunk from.
- The wheelbarrow carries whatever is inside it when you push it. Picking up the blanket folds it. Picking up the blocks scatters the stack.
- The east cliffs can't be walked onto.
- The cabin door blocks movement when closed.

**What the agent can perceive** (`getObservation()`). This is deliberately not the full world state.
- Items are visible on the same level within 40 ft (small), 80 ft (medium) or 120 ft (large), with details within 10 ft. Fixed landmarks are visible from further away (the ladder and hill from anywhere, the boat within 400 ft, and so on).
- Objects at the top of the ladder are **only** visible from the platform, or from the ladder at 85 ft or higher. From the ground the agent is told there is a platform, but not what's on it.
- From the platform or high on the ladder, all landmarks are visible, but small objects on the ground are too far away.
- Things inside the cabin are visible only from inside, or through the open door (standing within 20 ft of it, seeing up to 40 ft in). Contents of closed containers are hidden.
- The underwater key is visible only after wearing the snorkel and using it ("look underwater") at the pond edge.
- **Memory:** fixed features the agent has seen once (boat, cabin door, bell…) can be walked to later by name. Movable items must be currently visible.
- The observation includes the agent's own coordinates. Remove `self.position` in `getObservation()` if an experiment shouldn't give that away.

## Controller API (`window.Island`)

All inputs and outputs are plain JSON-compatible objects.

| Call | Purpose |
|---|---|
| `reset({speed?})` | Fresh island (default 1× real time) |
| `getObservation()` | What the agent can perceive right now (see the example below) |
| `getActionSchema()` | Every action, its description and parameters |
| `submitAction({type, ...params})` | Start an action. Returns `{ok:true, actionId, label, estimatedDurationSec}` or `{ok:false, error, code}`. Codes: `busy`, `invalid`, `unsupported`, `run_over`, `replay_mode`. One action at a time. Pass `interruptCurrent:true` to replace the running one. |
| `getStatus()` | Clock, run timer (`elapsedSec`, `remainingSec`), current action progress, and the last result |
| `getActionResult(id)` | Final result of an action (`completed` / `failed` / `interrupted`, plus a message) |
| `interrupt()` | Stop the current action (same as `submitAction({type:"stop"})`) |
| `addReflection(text)` | Record an agent-reported reflection. This is not an in-world action and takes no time. |
| `startRun({durationSec?})` / `endRun()` | The timed run (default 30 minutes). When time runs out, the current action is interrupted and further actions are refused. |
| `setSpeed(n)` / `setPaused(bool)` | Time speed (1, 2, 5, 10, 30, 60) and pause (testing) |
| `advanceTime(sec)` | **Test only.** Jumps the clock forward instantly. |
| `exportState()` | The **full** world state, for the observer and debugging only. Don't give it to the agent. |
| `exportLog()`, `exportLogCsv()`, `exportJournal()` | Logs and journal |
| `exportReplay()` | Replay file (see below) |
| `saveRun()` / `restoreRun(data)` | Save and restore everything: state, log and recording |
| `enterReplay(file)`, `replaySeek(t)`, `replayPlay(bool)`, `replayView()`, `exitReplay()` | Replay mode |
| `startVideo()`, `stopVideo()`, `videoSupported()`, `lastVideo()` | Video recording |
| `on(fn)` | Subscribe to every log event as it happens. Returns an unsubscribe function. |

**Actions:** `look`, `inspect{target}`, `walk_to{target | x,y}`, `walk{direction, distance}`, `climb`, `descend`, `pick_up{target}` (alias `take`), `put_down{target, onto?}` (alias `put_in`), `drop{target}`, `open{target}`, `close{target}`, `use{target, with?}`, `wear{target}`, `remove{target}`, `read{target}`, `read_journal`, `write_journal{text}`, `sit`, `stand`, `rest{seconds}`, `wait{seconds}`, `stop`.

Targets are object ids (`ladder`, `boat`, `cabin_door`, `chest`, `crate`, `wheelbarrow`, `snorkel`…) or terrain features (`pond`, `stream`, `hill`, `ocean`, `beach`, `forest`, `cliffs`). Names also work (`"rowboat"`, `"oil lantern"`).

**`use` combinations that are implemented:** `bell`; `lighter` alone, or with `fire_pit` or `lantern`; `brass_key` with `chest`; `snorkel` (worn, at the pond edge); `tin_cup` with `pond`/`stream`, or alone to drink; `mirror` (describes what you look like and what you carry); `ball` (toss and catch); `blanket` (spread or fold); `blocks` (stack or knock over). Anything else returns a clear "not implemented" message and changes nothing.

Example observation, trimmed:

```json
{
  "simTimeSec": 12.0,
  "run": {"active": true, "ended": false, "elapsedSec": 12.0, "remainingSec": 1788.0},
  "self": {"position": {"x": 268, "y": 714}, "groundElevationFt": 0.9, "heightAboveGroundFt": 0,
           "level": "ground", "pose": "standing", "indoors": false, "underfoot": "sandy beach",
           "carrying": [{"id": "journal", "in": "pocket"}, {"id": "pencil", "in": "pocket"}], "wearing": [], "handsFree": 2},
  "currentAction": null,
  "lastActionResult": {"id": 1, "type": "look", "status": "completed", "message": "You look around..."},
  "visibleObjects": [{"id": "boat", "name": "rowboat", "distanceFt": 13, "bearing": "NW", "reachable": true,
                      "description": "...", "contains": ["oar"]},
                     {"id": "ladder", "distanceFt": 457, "bearing": "NE", "reachable": false}],
  "terrainFeatures": [{"id": "ocean", "distanceFt": 28, "bearing": "S"}],
  "soundsHeard": [],
  "notes": ["There is a platform at the top of the ladder. You cannot see what, if anything, is on it from here."]
}
```

## Running an AI agent on the island

`controller/run_experiment.js` connects a real model (OpenAI) to the island. The island still decides everything physical: clock, movement, durations, objects and outcomes. The model can only *choose* actions; it cannot make one succeed by claiming it did.

### Launch (on your computer, to watch live)

```
cd island
npm i playwright && npx playwright install chromium
export OPENAI_API_KEY=sk-...        # Windows PowerShell: $env:OPENAI_API_KEY="sk-..."
node controller/run_experiment.js
```

A browser window opens on the island with a **Start experiment** panel. In it you choose:
- the starting island (original, or a saved island file from an earlier run)
- the model
- what the agent receives (text only, or the aerial picture plus text)
- a spending limit
- whether to record video

Then click **Start Experiment**. The run lasts 30 real minutes. Watch the figure, clock, log, journal and reflections as they happen. The header shows the model, the estimated spend so far, and a **Stop experiment** button.

Never put the key in a file in this folder. The controller reads it from the environment and never writes it anywhere.

### Watching from a phone (cloud run, nothing to install)

The run can happen in a Claude Code cloud session and be watched on a private claude.ai page:

- **Watch page:** `watch/watch.html`, published as a private claude.ai page that only its owner can open. It is `island.html` in viewer mode: no test controls, and no simulation of its own.
- **How data reaches it:** the controller runs with `--live-dir live --live-interval 20` and writes a small chunk every 20 seconds (positions, state changes, log lines). Claude copies each chunk into the page's database, and the page plays it back. Chunks carry only what changed and split if large, staying far below the 256 KB document limit.
- **Delay:** the page runs about 20 to 30 seconds behind the island. **Go live** jumps to the newest data. The timeline replays anything already received. Once the run ends, the same page is a full replay, and **Report** shows the agent's report and the experimenter summary.
- **Stop:** the owner can tap **Stop experiment** twice. The page writes `control/stop`, the relay creates `live/STOP`, and the controller ends the run cleanly and marks it stopped.
- **Requirements:** the relay only runs while Claude's session keeps working through the run, about 90 copy steps for 30 minutes. If the session is interrupted, the run itself carries on and is fully recorded in `runs/`, but the page stops updating until the relay resumes. Missed chunks are then copied in order.
- **Key safety:** the OpenAI key is saved in the cloud environment's network settings and added by its proxy. It never appears in the page, the database, the chunks or any file.
- **Tests:** `watch/test_watch_page.js` checks the page at iPhone size against a stand-in database fed from real chunk files.

### How a turn works

1. The controller asks the island for the agent's observation: only what it can perceive from where it stands. It never sees the full world state.
2. The model gets the neutral introduction (verbatim), a neutral action list (no objects named, no examples), the result of its last action, and the observation.
3. It replies in strict JSON: `{"action": {...} or null, "reflection": "..." or null}`.
4. The controller submits the action to the island unchanged. Rejected or impossible actions get the island's real reply on the next turn. Nothing is substituted.
5. During any action longer than 30 s, the model gets a **check-in** about every 30 s. It can continue (`action: null`), add a reflection, or choose a different action, which replaces the current one. An invalid replacement leaves the current action running.
6. `action: null` at a decision means "do nothing for now". The agent stays put and is asked again 30 s later.
7. The clock never stops for the model. Slow replies (over 10 s), errors, timeouts and retries are logged as **CTRL** lines.
8. At the deadline, the island interrupts any action exactly where it is and refuses new ones.
9. Afterwards, the model gets its journal and the factual activity record and writes `report.md`. A second call checks the report against the log for unsupported claims. That check is model-assisted, so treat it as a pointer, not proof.

The model's context keeps the system prompt, the first observation, and the last 60 exchanges (older observations are shortened to one line). Everything sent is saved in `transcript.jsonl`.

### What the agent can receive

| Mode | What it reveals |
|---|---|
| `text` (default) | Only what the island's perception rules allow from the agent's position. It never sees an image. |
| `aerial` | The full reference picture once, at the start, then text. The picture shows the whole island from above, **including things a person on the beach could not see** (for example the items on the tower platform). It is not a ground-level view. |
| Position-specific views | **Not built.** The observer canvas draws hidden things (underwater key, cabin interior, platform items), so a crop of it would leak information. Doing this properly needs a separate renderer that draws only what the agent perceives. |

### Starting island

- **Original island:** a fresh island.
- **Saved island:** choose `runs/<earlier run>/island-save-at-end.json`. Physical changes are kept: moved, opened, broken or burned things, writing, door state, and fire. Defined behaviour:
  - Items the previous agent was carrying or wearing are left where it ended: on the ground there, on the platform, or at the ladder base if it was on the ladder.
  - Its journal stays on the island as a "used journal" whose writing can be read if found. The panel lets you choose to remove it instead.
  - The new agent gets a fresh blank journal and pencil, starts beside the boat, and remembers nothing.
  - The previous log is copied to `prior-run-log.json` for you only. It is never sent to the agent.
  - A fire that was burning continues; no time passes between runs.

### Run folder (`runs/<time>_<model>[_TEST…]/`)

| File | Contents |
|---|---|
| `config.json` | Model, provider, observation mode, introduction, full system prompt, response schema, starting island (with a SHA-256 hash for saved files), limits, prices used |
| `transcript.jsonl` | Every model call: exactly what was sent, the reply, latency, tokens, cost, errors and retries |
| `island-events.jsonl` | Island log streamed live (survives a crash) |
| `island-log.json`, `replay.json`, `journal.txt`, `reflections.json` | Full log, replay file, journal, reflections |
| `initial-state.json`, `state-at-end.json` | World state at the start and at the deadline (observer only) |
| `island-save-at-end.json` | Use this to start a "saved island" run |
| `report.md` | The agent's report (model-written, labelled as such) |
| `summary.md` | Experimenter summary built from the records: status, timing, costs, actions, changes, rejections, technical notes, and the model-assisted report check |
| `status.json` | `completed`, `stopped` (experimenter or spending limit) or `interrupted` (crash, closed window, Ctrl+C, model unavailable) |
| `autosave.json` | Full save every minute, kept if anything crashes |
| `prior-run-log.json` | Saved-island runs only, observer-only |
| video file | If recording was chosen |

### Models, cost and limits

- Provider: OpenAI (`providers.js`). Other providers can be added by implementing `decide()` and `text()`. A **MOCK** policy (no AI, free) exists only for testing, and its runs are labelled MOCK everywhere.
- Default model: `gpt-5-mini` (reasoning effort `low`). Any chat model on your account can be chosen in the panel or with `--model`.
- Costs are **estimates** from a built-in price table (verify on OpenAI's pricing page). For models not in the table, pass `--price-in` and `--price-out` (USD per 1M tokens). Otherwise only the call cap (`--max-calls`, default 600) protects you.
- **Measured:** the real 3-minute test (`gpt-5-mini`) made 13 calls and cost about **$0.017** including the report. Expect roughly 120 to 200 calls in 30 minutes (one per action, plus check-ins), with each call growing as history builds up (capped at 60 exchanges, and repeated prefixes are cached).
- **Estimates for a 30-minute run** (from the built-in price table, not guaranteed): `gpt-5-mini` about $0.15 to $0.40; `gpt-4.1-mini` similar; `gpt-5` about $0.75 to $2. Aerial mode adds about 1,800 tokens per call, because the picture stays in the conversation. Newer models (`gpt-5.x`, `gpt-6.x`) have no price in the table: pass `--price-in` and `--price-out` from OpenAI's pricing page.
- The spending limit stops the run when the estimate reaches it, leaving a small reserve for the report. For a hard cap, also set a budget on your OpenAI project.

### Reliability

- The browser window must stay open. It doesn't need to be visible for the simulation (background throttling is disabled), but video is smoothest when visible.
- Closing the window, pressing Ctrl+C, or 5 failed model decisions in a row ends the run cleanly. Everything is saved and `status.json` says `interrupted`. Runs are never silently restarted.
- If the controller process itself is killed, `island-events.jsonl`, `transcript.jsonl` and the last `autosave.json` remain.
- The agent has no tools other than island actions. It cannot reach your files, accounts or the internet.

### Test flags (results labelled TEST)

`--provider mock`, `--minutes N`, `--speed N`, `--headless`, `--auto-start` (use flags instead of the panel: `--start saved --saved <file> --obs aerial --video --max-cost 1`). Don't use any of these for the real 30-minute experiment.

## Saving, logs, replay and video

- **Reset / Save to file / Restore from file / Quick save / Quick restore** (quick save uses this browser's storage).
- **Exports:** journal (.txt, with reflections listed separately), activity log (.json and .csv), replay (.json).
- **Log entries** have a sequence number, simulation time, wall-clock ISO time, time speed, kind, message and data. They cover action requests, starts and ends (with durations), interruptions, movement (start, terrain changes, arrival or stop position), object changes, journal entries, reflections, sounds, rejections and errors, and speed/run/save events.
- **Replay file:** the initial state, a full-state snapshot after every change (objects, journal, reflections), agent position frames every 0.25 s of simulation time, and the complete log. **Replay mode** rebuilds the run from these records only. It never re-simulates and never asks an AI. It has play/pause, a timeline slider and 1–60× speed. Use **Replay this session**, or **Load replay file** for an exported file.
- **Video:** **Start video recording** captures a 1280×720 composite: the island view, ladder gauge, clock, current action, recent log lines, the latest journal entry and the latest reflection. It uses the browser's built-in MediaRecorder, so no permission prompt is needed. The file downloads automatically when you stop, or when the run ends. A 30-minute run is up to about 340 MB at the default 1.5 Mbit/s cap (often less, since much of the frame stays still).
  - **Keep the tab visible while recording.** Browsers slow down hidden tabs, so the video drops to about 1 frame per second while the tab is hidden. The simulation itself keeps correct time.
  - Alternative: record afterwards from a replay. **Record replay video** in replay mode plays the replay and records it, so a faster replay speed gives a time-lapse.
  - Fallback if a browser can't record: use your operating system's screen recorder. The replay file always keeps an exact record.

## Tests

- `tests/test_island.js`: 39 island checks (movement rates, climbing, objects, journal, perception, save/restore, exports, replay, video, offline). Last run: **39/39 passed**.
- `tests/test_controller.js`: 12 controller-feature checks (Start panel, hidden-name probing, safe action replacement, deadline behaviour, saved-island inheritance, CTRL notes, Stop button). Pass a run folder to also audit that run: hidden state never sent, ladder-top items and key never revealed early, neutral instructions, no substituted actions, replay matches the log, reflections timed correctly, no credentials in any file.
- `test-runs/real-gpt-5-mini-3min/`: records (without video) of the **real model test**: `gpt-5-mini`, 1× real time, 3-minute TEST run. It completed and passed the 20-check audit.

What was verified end to end with the real model (TEST durations, not the experiment):

| Check | Result |
|---|---|
| Agent receives an observation, chooses through the real OpenAI API, controller validates and submits | Yes. 13 calls, median decision 3.1 s, no errors |
| Figure performs actions over island-enforced time | Yes: walks at about 3 to 4 ft/s, wading slower |
| Rejected action returned unchanged ("Your hands are full…"), agent adapted | Yes |
| Check-in during a long walk (agent chose to continue) | Yes. Replacing an action at a check-in was verified with the MOCK policy and the island test (C3) |
| Reflections recorded when they occurred; journal entries | 13 reflections logged live. That agent wrote no journal entries; journal timing is verified by the island tests and the MOCK run |
| Log and replay match | Max replay error 0.04 ft |
| No hidden world state sent | Audit passed |
| 3-minute deadline with an action under way | Walk interrupted at (523, 667), 148 ft along; no further actions accepted |
| Saved island from that run (MOCK agent) | Oar, rope, old journal and pencil left where the real agent stopped; new agent got a blank journal; prior log observer-only |
| Aerial mode with the real model | Image attached at the start; agent referred to places only visible in the picture |
| Video with the controller | 1280×720 WebM, 3:00 long, about 26 MB (a 30-minute run ≈ 260 MB) |
| Report and model-assisted check | Report written; the check found no unsupported claims |

## Limits and simplifications

- Top-down 2D view, not 3D. The figure is drawn larger than true scale so it's easy to follow. The ladder is drawn as a projection rising up the screen, plus a side gauge.
- Animations are simple: walking legs and bob, climbing limbs, sitting, writing (book and moving pencil), reaching and interacting poses. Other actions are shown through the action label, the progress bar and the log.
- Line of sight uses distance rules. Trees and the hill don't block the view. There's no day/night cycle or weather.
- The platform is a single spot: everything on it is reachable, and you can't walk around on it. The ladder top is the only high place.
- No swimming, throwing, boat launching, combat, cutting, hunger or fatigue. These are refused with clear messages, not faked.
- Underwater items within 12 ft of the bank can be picked up while wearing the snorkel. There's no real diving.
- One agent, one action at a time.
- Quick save uses browser storage, which can be unavailable in private windows. Save to file always works.
