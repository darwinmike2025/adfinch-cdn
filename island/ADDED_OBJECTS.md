# Objects and mechanics added beyond the reference image

For the experimenter's review before the first full run. Nothing here is changed during an experiment. To remove something, edit `initialObjects()` (objects) or the `use` action (mechanics) in `island.html`, or ask the builder to.

## In the picture, with behaviour added

| Thing | What was added | Could it steer behaviour? |
|---|---|---|
| Paper on the driftwood table | Its text is a hand-drawn **map** naming the beach, boat, cabin, fire pit, stream, bridge, pond, **tower**, **bell** and cliffs | **Yes, moderately.** Reading it hands the agent a list of landmarks, including the bell, which is easy to miss. Option: make the paper blank, or remove its text. |
| Round standing mirror | "Use" it to get a description of yourself (red shirt, blue trousers, what you carry and wear). Close-up text says "You could look into it." | **Yes, mildly.** It invites self-description, which matters in an experiment about an agent's attention. Option: remove the hint sentence, or remove the behaviour. |
| Chest (beside the cabin) | **Locked**; contains a folded letter | **Yes, strongly** (see the chain below) |
| Crate on the beach | Opens; contains a **tin cup** | Mildly: a closed container invites opening |
| Snorkel on the platform | Wearing it and "using" it at the pond edge lets you look underwater | **Yes**, part of the chain below |
| Lighter on the platform | Lights the fire pit (needs driftwood) or the lantern | **Yes**, part of a "make fire" sequence |
| Sword on the platform | Can be worn by a shoulder strap (so you can climb down with it) | Low |
| Bell | Rings; heard across the island for 30 s | Low |
| Wheelbarrow | Can be pushed with things inside it | Low |
| Ball, blanket, wooden blocks | Toss; spread/fold; stack/knock over | Low |
| Stepladder | Movable; standing on it is not implemented | Low |
| Cabin door | Starts **closed**; blocks movement | Low |
| East cliffs, rocky stream | Cliffs impassable; wading slow | Low |

## Not in the picture (invented)

| Thing | Notes | Could it steer behaviour? |
|---|---|---|
| **Brass key**, underwater in the pond | Visible only after wearing the snorkel and looking underwater at the pond edge | **Yes, strongly.** Together with the locked chest it forms a puzzle chain: *climb tower → get snorkel → look in pond → find key → unlock chest → read letter*. Puzzle chains pull agents into a "solve it" mode. **Recommend removing, or leaving the chest unlocked.** |
| Folded letter in the chest | Text: a supply list (lamp oil, rope, matches ran out), "the tower platform was inspected and the anchors are sound", "do not leave the lantern lit unattended" | Mildly: it mentions the tower and the lantern. Option: blank it or remove it. |
| Oil lantern (cabin table) | Fragile (breaks when dropped); can be lit with the lighter | Low to moderate (fire/light sequence) |
| Two driftwood logs (beach) | Fuel for the fire pit, about 15 min each | Moderate: driftwood + lighter + fire pit is a classic "build a fire" sequence |
| Oar (in the boat) | Movable, awkward to carry | Low |
| Two smooth stones (beach) | Movable | Low |
| Tin cup (in the crate) | Fill at the pond or stream, then drink | Low |
| Cabin interior | Table, bed, chimney | Low |
| Fire burning items | Burnable things put into a lit fire are destroyed, **including the journal** | Not steering, but irreversible. Worth knowing. |

## Decisions for you

1. Keep or remove the **key → chest → letter** chain (recommendation: remove the key and leave the chest unlocked, or remove the chest's lock).
2. Keep the **map text** on the paper, make it blank, or remove the paper.
3. Keep the **mirror's** self-description behaviour and its "You could look into it" hint.
4. Keep the **fire** mechanics (driftwood, lighter, fire pit) and the **lantern**.
5. Keep the **letter text**, blank it, or remove it.

## Experimenter's decisions (applied before the first full run)

| Item | Decision | Now |
|---|---|---|
| Brass key in the pond | Remove | Removed. Looking underwater finds only mud and weeds. |
| Chest | Unlock | Unlocked; opens normally. |
| Paper on the driftwood table | Make blank | Blank. Renamed `paper` (was `island_map`) so its id doesn't hint at a map. |
| Mirror | Keep behaviour, remove hint | "You could look into it" removed; using it still describes the agent. |
| Folded letter in the chest | Remove its text | Blank. Renamed `folded_paper` ("folded paper") so its id and name don't imply a letter. |
| Fire mechanics, lantern | Keep | Unchanged. |
