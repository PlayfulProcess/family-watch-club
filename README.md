# Family Watch Club

Old stories, good questions, and movie nights that turn into conversations.
A noncommercial, family-made project on top of [recursive.eco](https://recursive.eco).

Two zones, kept strictly apart:

- **The Harbor** (`index.html`) — kid-safe and self-contained: books, the bedtime
  storybook, read-along audiobooks. No accounts, no forms, no tracking, no links
  that leave for the open internet.
- **The Launchpad** (`parents.html`) — for grown-ups: the Movie Companion browser
  extension, your family's own watch links (saved only in your browser), channels
  on recursive.eco, and the make-your-own course.

## What's here

- `extension/` — Movie Companion ("Pause & Talk"), a Chrome MV3 extension that
  pauses any in-browser movie at chosen moments and shows a conversation card
  (kid question + tap-quiz + grown-up note). See `extension/README.md`.
- `movie-companion.zip` — the same extension, zipped for download from the site.
- `grammars/moana/grammar.json` — the Moana companion as a recursive.eco grammar
  (repo-canonical). One grammar per movie; `metadata.lens` splits it into themes
  (discussion / repair / ...). The extension imports this file directly.
- `bedtime-storybook.html` — tablet bedtime version of the first four Maui legends.
- Companion book: [Legends of the Pacific](https://github.com/PlayfulProcess/recursive-kids-stories-club)
  (in the story-club repo).

## The content line

Public content is only: (a) traditional public-domain stories retold in our own
words, (b) our own commentary and questions about films (naming characters in
analysis is fine), (c) links to official content. **No film dialogue, lyrics, or
studio artwork — ever.**

## Licenses

- Content (questions, commentary, retellings, grammars): CC-BY-SA-4.0, PlayfulProcess.
- Extension code: see `extension/`.
