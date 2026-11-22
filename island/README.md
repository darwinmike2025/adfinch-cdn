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

- Map: 1000 × 800 ft. The island is about 913 ft across at its widest point.
- **Coordinates:** feet, origin at the **north-west corner**, **x increases east, y increases south** (north is up). Elevation is in feet.
- All positions are in the `LAYOUT` block near the top of the script. **Note:** no reference image came with the original request, so the layout is a reasonable arrangement of the requested features. To match a picture, edit the `LAYOUT` numbers.

| Feature | Position (ft) | Notes |
|---|---|---|
| Agent start | (478, 698) | Sandy beach beside the boat, carrying a blank **journal** and a **pencil** |
| Rowboat | (470, 688) | Holds an **oar** and a **coil of rope**. Launching the boat is not implemented. |
| Driftwood ×2, smooth stones ×2 | south beach | Driftwood is fuel for the fire pit |
| Cabin | x 280–320, y 410–440 | Door on the south wall (closed at start). Inside: a table with an **oil lantern** (fragile) and a **tin cup**, plus a **locked chest** holding a **folded letter** |
| Fire pit | (300, 482) | Put driftwood in, then use the lighter on it |
| Hill | peak at (440, 210), ~65 ft high | Slopes slow walking |
| Stone circle + bronze bell | (440, 208) | Nine standing stones. The **bell** can be rung. |
| Stream | hill spring → pond → east coast | Wading is slow (0.32× speed) |
| Pond | centre (590, 400), 110 × 76 ft | Can't be walked into. A **brass key** lies underwater near the west bank. |
| Bridge | (675, 414) | Crosses the stream at normal speed |
| Tall ladder | base (770, 271), concrete foundation at (770, 262) | **100 ft** steel ladder up to a platform. On the platform's table: **lighter**, **sword**, **snorkel** |
| Forests | NW, W, N, scattered | Rough ground (0.72× speed). Trunks are obstacles. |

## Simulation rules (the environment decides all of these)

**Time.** Real time by default (1×). Test speeds are 2, 5, 10, 30 and 60×, and they're logged. Time advances in 0.25 s steps.

**Walking.** 4 ft/s on clear, level grass. The speed is multiplied by:
- terrain: beach 0.85, forest 0.72, rocky hilltop 0.85, stream 0.32, bridge/grass/floor 1.0
- slope: `1 / (1 + 2.5·uphill grade + 1.0·downhill grade)`
- load: each awkward item carried (oar, sword in hand) 0.85; total weight over 10 lb slows you further (up to 0.6×)

Routes are found by A* pathfinding on a 5 ft grid that minimises travel time. Walking 300 ft on clear ground takes about 75 s.

**Climbing.** 2.4 s per ft up (4:00 for 100 ft) and 2.1 s per ft down (3:30). Both hands must be free: pocket-sized items are fine, and worn items are fine (wearing the sword makes climbing 10% slower). If you stop, the agent holds on at its current height.

**Hands and pockets.** Small items go in pockets (up to 6). Medium items (oar, rope, driftwood, lantern, sword) take one hand each, and you have 2 hands. The snorkel can be worn, and so can the sword (by its shoulder strap).

**Action durations.** Look 4 s · inspect 6 s · pick up 3 s (10 s underwater) · put down 3 s · drop 1 s · open/close 2–3 s · wear 6 s · remove 5 s · ring bell 6 s · light fire 15 s · light lantern 8 s · look underwater 20 s · write ≈2.5 s per word (minimum 8 s) · read ≈0.3 s per word · sit 3 s · stand 2 s · rest/wait as requested.

**Interrupting.** Walking stops at the agent's real position. Climbing holds on at the current height. Writing keeps the words already written (marked "interrupted"). Other actions have no effect if stopped early.

**Consequences.**
- Objects stay exactly where they're put until reset.
- **Put down** places an item gently. **Drop** lets it fall: fragile items (the lantern) break. Dropped from the ladder or platform, an item lands near the ladder base, with a thud others can hear.
- The chest is locked. Opening it fails until the brass key is used on it.
- Fire needs driftwood in the pit. Each log burns about 15 minutes and is then gone. Burnable items put into a lit fire are destroyed, including the journal.
- The bell is heard island-wide for 30 s.
- The tin cup can be filled at the pond or stream, then drunk from.
- The cabin door blocks movement when closed.

**What the agent can perceive** (`getObservation()`). This is deliberately not the full world state.
- Small items are visible within 40 ft on the same level, with details within 10 ft. Fixed landmarks are visible from further away (the ladder and hill from anywhere, the boat within 400 ft, and so on).
- Objects at the top of the ladder are **only** visible from the platform, or from the ladder at 85 ft or higher. From the ground the agent is told there is a platform, but not what's on it.
- From the platform or high on the ladder, all landmarks are visible, but small objects on the ground are too far away.
- Things inside the cabin are visible only from inside, or through the open door from within 20 ft. Contents of closed containers are hidden.
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

Targets are object ids (`ladder`, `boat`, `cabin_door`, `chest`, `snorkel`…) or terrain features (`pond`, `stream`, `hill`, `ocean`, `beach`, `forest`). Names also work (`"rowboat"`, `"oil lantern"`).

**`use` combinations that are implemented:** `bell`; `lighter` alone, or with `fire_pit` or `lantern`; `brass_key` with `chest`; `snorkel` (worn, at the pond edge); `tin_cup` with `pond`/`stream`, or alone to drink. Anything else returns a clear "not implemented" message and changes nothing.

Example observation, trimmed:

```json
{
  "simTimeSec": 12.0,
  "run": {"active": true, "ended": false, "elapsedSec": 12.0, "remainingSec": 1788.0},
  "self": {"position": {"x": 478, "y": 698}, "groundElevationFt": 0.9, "heightAboveGroundFt": 0,
           "level": "ground", "pose": "standing", "indoors": false, "underfoot": "sandy beach",
           "carrying": [{"id": "journal", "in": "pocket"}, {"id": "pencil", "in": "pocket"}], "wearing": [], "handsFree": 2},
  "currentAction": null,
  "lastActionResult": {"id": 1, "type": "look", "status": "completed", "message": "You look around..."},
  "visibleObjects": [{"id": "boat", "name": "rowboat", "distanceFt": 13, "bearing": "NW", "reachable": true,
                      "description": "...", "contains": ["oar", "rope"]},
                     {"id": "ladder", "distanceFt": 513, "bearing": "NE", "reachable": false}],
  "terrainFeatures": [{"id": "ocean", "distanceFt": 28, "bearing": "S"}],
  "soundsHeard": [],
  "notes": ["There is a platform at the top of the ladder. You cannot see what, if anything, is on it from here."]
}
```

## Connecting an AI later

A web page opened from a file can't accept connections from another program. Browsers don't let pages listen on a network port. So a separate controller has to reach into the page. The simplest method, **built and tested**:

**Browser automation (Playwright).** `controller/example_controller.js` opens `island.html` in a visible Chromium window. It then loops: read the observation, decide, submit the action, wait for it to finish. It streams events to the terminal and saves the replay, log, journal and (optionally) video at the end. It was tested headless at 60× for a 12-minute run: the timer ended the run on schedule and all files were written.

```
npm i playwright && npx playwright install chromium
node controller/example_controller.js                     # real time, visible window, 30-minute run
node controller/example_controller.js --speed 60 --headless --minutes 5 --video   # quick test
```

To plug in a model, replace `decideNextAction(observation, schema, history)` with a call to Claude, ChatGPT or any other model. Send it the observation, the action schema and recent results, and parse its reply into one action (and optionally a reflection). Keep API keys in the controller's environment variables, never in `island.html`. **This model connection has not been built or tested yet.**

Things to decide when you build it:
- The clock keeps running while the model thinks, as in real life. To pause the world during model calls, use `setPaused(true/false)` around each call. That changes the meaning of "30 real minutes", so record which you chose.
- What the model receives: text observation only, a screenshot (Playwright can capture the map), or both.
- How often to call the model. The example waits for each action to finish, but a controller can also interrupt.

Other options, **not built**: a small local server that relays between the page and a model (would need the page to poll it), or pasting a controller script into the browser's developer console (not recommended if it involves API keys).

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

`tests/test_island.js` runs 37 automated checks in headless Chromium (`node tests/test_island.js`). Screenshots and downloaded files go to `tests/output/`. Last run: **37/37 passed**, covering:

1. The interface loads (clock, log, journal, reflections) with no errors.
2. Real-time walking measured at **3.97 ft/s** on level grass (44 ft in 11.1 s of wall time). Interrupting leaves the agent where it stopped. A 300 ft estimate comes to about 73 s.
3. The climb takes 4:00 and runs at 0.42 ft/s in real time. Mid-climb height and the gauge are captured in a screenshot. The agent reaches the platform at 100 ft.
4. Objects keep their state: the sword left on the platform, the lighter put in the boat, the snorkel worn. The key is hidden until the agent looks underwater. The locked chest fails to open, then opens with the key. The dropped lantern breaks and stays broken. Unsupported actions get clear messages.
5. Journal entries persist and appear in the panel. An interrupted entry keeps its partial text. Reflections appear in their own panel.
6. The beach observation does not mention the lighter, sword or snorkel. The platform observation does.
7. Reset, save, restore (by API and from a downloaded file through the UI), and journal/log/CSV/replay exports all work. The log contains every required event kind.
8. Replay, after a full page reload, from the exported file, matches the live positions within 0.43 ft and the live heights within 0.08 ft. The end state matches. Play, pause and speed work. Video recording produced a playable 1280×720 WebM.
9. It opens and runs with the network blocked and makes no network requests. There are no remote URLs in the file.

## Limits and simplifications

- Top-down 2D view, not 3D. The figure is drawn larger than true scale so it's easy to follow. The ladder is drawn as a projection rising up the screen, plus a side gauge.
- Animations are simple: walking legs and bob, climbing limbs, sitting, writing (book and moving pencil), reaching and interacting poses. Other actions are shown through the action label, the progress bar and the log.
- Line of sight uses distance rules. Trees and the hill don't block the view. There's no day/night cycle or weather.
- The platform is a single spot: everything on it is reachable, and you can't walk around on it. The ladder top is the only high place.
- No swimming, throwing, boat launching, combat, cutting, hunger or fatigue. These are refused with clear messages, not faked.
- Underwater items within 12 ft of the bank can be picked up while wearing the snorkel. There's no real diving.
- One agent, one action at a time.
- Quick save uses browser storage, which can be unavailable in private windows. Save to file always works.
