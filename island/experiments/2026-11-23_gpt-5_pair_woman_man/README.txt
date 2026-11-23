Run 4: two people (a 20-year-old woman from the beach, a 20-year-old man from the hilltop), GPT-5, aerial picture, 45 min planned.
Stopped at 42:31 when the $4 spending limit was reached (412 model calls, about $4.04 including reports).
Known issues in this run (both fixed afterwards):
- Older turns were shortened without the words each person had heard, so they forgot parts of the conversation
  (she gave her name as Skye, later Mira; he introduced himself as Alex several times).
- "inspect" on the other person was not supported: the man tried it 99 times and was rejected each time.
replay.json.gz and island-save-at-end.json.gz: gunzip, then load in island.html. The MP4 video was sent separately.
