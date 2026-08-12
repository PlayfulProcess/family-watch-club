# Movie Companion — Pause & Talk

A family conversation layer for movie night. Pauses the movie at moments you
choose and shows a discussion prompt — or a whole story-within-the-story —
then a big KEEP WATCHING button.

Works on Disney+, Netflix, YouTube, and most sites that play video in the
browser. (It can't reach smart-TV or tablet *apps* — for those, use the
bedtime storybook page instead.)

## Install (Chrome / Edge / Brave)

1. Unzip this folder somewhere permanent (it must stay on disk).
2. Go to `chrome://extensions`
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `movie-companion` folder.
5. Pin the icon. Open a movie in the browser and press play.

## What's included

- **Moana** — 10 discussion pause points (kid question + tap-to-answer quiz +
  a "for the grown-up" note with the mythology behind the scene).
- **Maui's Real Legends (told at sea)** — 4 authentic Polynesian Maui legends,
  retold in original words, placed at quiet voyage stretches of the film.
  These are traditional stories, over a thousand years old — not Disney text.
- **The Repair Lens** — 7 pause points that follow one arc through the film:
  rupture → armor → truth → return → restoration. Same movie, deeper game.
- **Frozen** — Discussion + Repair Lens sets (the gloves, the closed door,
  and the act of true love as a repair arc).
- **KPop Demon Hunters** — Discussion + Repair Lens sets (lantern vs idol,
  protecting vs shaming patterns, truth sung out loud). Timestamps are rough
  first drafts — verify with "Grab current movie time".

Pick the movie and theme in the extension popup.

## Quizzes

Any pause point can carry a `quiz`: a question with 2–3 big tap-able answers.
Wrong answers get a friendly nudge and you can keep tapping; the right one
celebrates and teaches something. Everything runs on the card — nothing is
recorded or sent anywhere. Format:

```json
"quiz": {
  "question": "Who is Maui, really?",
  "options": [
    { "text": "A movie invention", "reply": "Nope — he's over 1000 years old!" },
    { "text": "A real Pacific legend", "right": true, "reply": "YES! ..." }
  ]
}
```

## recursive.eco grammars — the live loop

Movies and themes are edited as **grammars** on recursive.eco (the grown-ups'
side); the extension renders them (the kids' side stays static). One grammar
per movie; each item is a pause point. Mapping: `metadata.time` (e.g.
`"58:40"`) → when it fires, `metadata.lens` → which Theme set it joins
(discussion / repair / legends...), `sections.Story` → story card,
`sections["Wonder Together"]` → kid question, `sections["For the Grown-up"]`
→ grown-up note, `metadata.quiz` → quiz. Items without a `metadata.time` are
skipped — one grammar can be both a book (all items) and a movie companion
(the timed ones).

Three ways in:

1. **Import file** — any prompt-set or grammar JSON from disk.
2. **Fetch URL** — paste a JSON URL. For your own PRIVATE grammar use
   `https://flow.recursive.eco/api/gpt/grammars/<grammar-id>` plus your
   API token (flow.recursive.eco/account → Generate token) in the token
   field. Public grammars need no token
   (`https://flow.recursive.eco/api/tarot-channel/decks/<grammar-id>`).
3. **⟳ Refresh active set from source** — re-fetches the URL a set came
   from. Edit on recursive.eco → click refresh → tonight's cards update.

The 👁 icon next to the Theme dropdown opens the active set's grammar in
the recursive.eco viewer (`flow.recursive.eco/g/<id>`).

## Timing

Timestamps are approximate (tuned for Disney+, no ads). If prompts land early
or late, use the -10s/-2s/+2s/+10s nudge buttons on any prompt card, or set a
global offset in the popup.

## Making your own pause points

1. Play the movie, pause where you want a prompt.
2. Click the extension icon → **Grab current movie time**.
3. Copy that timestamp into a JSON file (start from `prompts/moana.json` —
   the format is obvious: `time`, `title`, optional `story`, `kid` question,
   optional `parent` note).
4. Popup → **Import prompt set (JSON)**.

`ALL CAPS` mode renders prompts in uppercase for early readers.

## A note on use

This tool only pauses playback you already have legitimate access to and shows
your own words on top. It never copies, records, or redistributes the movie.
Keep it that way — prompt sets you share publicly should contain your own
writing (questions, commentary, traditional stories), not movie dialogue or
lyrics.
