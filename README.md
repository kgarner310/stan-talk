# Stan

A picture speech board that runs in a browser. Tap a picture, tap the next one,
hear the sentence out loud.

Built for someone who can't speak, spells phonetically ("know" comes out as
"no"), and is currently getting by with a grease board. Writing a whole sentence
by hand while someone stands there waiting is slow and exhausting. Three taps
should do it instead.

It's a web app on purpose: one link works on his Android phone and on the iPad,
with no App Store, no accounts, and no install. Add it to the home screen and it
opens full-screen like a normal app.

```
┌──────────────────────────────────────────────┬─────────┐
│  🙋 I want   💧 water         [🔊 Say it][⬅️][🗑️]│ 👍 Yes  │
├──────────────────────────────────────────────┤ 👎 No   │
│  [⬅️ Back] [🏠 Home]   I want › to drink       │ ✋ Wait │
├──────────────────────────────────────────────┤ 🛑 Stop │
│    💧          🧊          ☕                  │ 🆘 Help │
│   water     ice chips    coffee               │ 🤕 Pain │
│    ❄️          🥛          ✋                  │ 🙏 Thanks│
│  cold       warm       nothing                │ 🤷 ?    │
└──────────────────────────────────────────────┴─────────┘
```

## Does this already exist?

Yes. The category is **AAC** (Augmentative and Alternative Communication), and
there are mature apps: Proloquo2Go, TouchChat, LAMP Words for Life, TD Snap,
CoughDrop. They're worth trying — genuinely, before investing here.

What makes this one different is the shape of the problem. Most AAC apps are
built for people who have never had language, so they use dense grids of 60+
small cells and a deep vocabulary tree that takes weeks of training. Stan
already has language. He has a lifetime of it. He just can't get it out of his
mouth, and he can't reliably spell it either. So the tree here is deliberately
shallow and wide-tiled: nine big pictures, two levels deep, whole phrases rather
than single words.

The one design rule underneath all of it: **one tap has to be worth five words,
or the grease board wins.**

## Getting it onto his devices

Once it's hosted (see below), open the link on the device:

- **Android (Chrome):** menu ⋮ → *Add to Home screen*
- **iPad (Safari):** Share ⬆️ → *Add to Home Screen*

That gives it an icon, full-screen with no browser bars, and **it keeps working
with no signal** — everything is cached on the device after the first load. The
voice is the phone's own built-in speech, so nothing is ever sent anywhere and
there's nothing to pay for.

Everything he changes — photos, people, recent phrases, voice settings — is
stored on that device only. The phone and the iPad each keep their own.

### Hosting it

The app is plain static files. Any static host works. With GitHub Pages:

1. Push this folder to a public repo.
2. Settings → Pages → Source: **GitHub Actions**.
3. The included `.github/workflows/pages.yml` publishes it on every push.

## Privacy — read before adding anything

**Nothing identifying goes in this repo.** No drug names, no doses, no MRN, no
clinician or hospital names, no appointment dates or phone numbers. The app says
"I need my pain medicine" and "my speech therapist", never the specifics.

This is not caution for its own sake. The app is served from a public URL, and a
GitHub Pages site is public even when the repo behind it is private. Anything
committed here is on the open internet permanently.

Personal detail belongs in **His own words** (Settings → *His own words*), which
is stored on the device and never uploaded. That is where his actual medicine
names, his doctors, and his appointments go.

He loses nothing by this. "I need my pain medicine" communicates better to a
listener than a brand name most people wouldn't recognise anyway.

## Editing what he can say

`js/vocabulary.js` is the whole vocabulary, and it's meant to be edited
constantly. The starter phrases in it are guesses. The real vocabulary is
whatever he actually needs to say this week.

```js
const want = {
  id: 'want',
  icon: '🙋',            // the picture — never leave this out
  label: 'I want',       // the words under the picture
  text: 'I want',        // what gets spoken (defaults to label)
  color: COLORS.want,
  children: [
    w('💧', 'water'),
    g('want-move', '🚶', 'to move', COLORS.want, [w('🪑', 'to sit up')]),
  ],
};
```

- `w(icon, label)` — a leaf. Finishes the sentence and speaks it.
- `g(id, icon, label, color, children)` — a group. Navigates, adds no words.
- `silent: true` — a tile that navigates without contributing words.

Two rules worth holding to:

1. **Every tile gets a picture.** A text-only tile is a reading test, and
   reading is the thing he's working around.
2. **Append, don't reorder.** Position and colour become motor memory within
   days. Once he knows pain is the red tile in the top right, moving it costs
   more than any new tile gains.

## Pictures: three layers

Each tile shows the best picture available, in this order:

| Priority | Source | Setup |
| --- | --- | --- |
| 1 | **A photo from the device** | In the app: Settings → *Change tile pictures*, then tap any tile |
| 2 | **ARASAAC symbol** | `npm run symbols` (see below) |
| 3 | **Emoji** | Already there, nothing to do |

This is why the board is usable the moment it loads and gets better as pictures
are added, instead of needing all its artwork up front.

**Photos are the strongest layer** and cost nothing but a minute with the
camera. A real photo of his wife on the "my wife" tile is instantly recognisable
in a way no symbol is. Photos are downscaled on device and stored locally.

### Adding the ARASAAC symbol pack

ARASAAC pictograms are purpose-built AAC symbols — clearer than emoji, and
identical on Android and Apple instead of changing between them.

```bash
npm run symbols     # downloads ~200 pictograms into symbols/
```

Then bump `CACHE_VERSION` in `sw.js` so installed devices pick them up, and
redeploy. The app switches over automatically; no code changes.

> **Not included in this repo yet.** The sandbox this was built in blocks
> `arasaac.org`, so the fetch script has never actually been run end to end.
> Run it on a normal machine — it prints a line per symbol, and any tile it
> can't match just keeps its emoji. Pictograms are CC BY-NC-SA 4.0 (author
> Sergio Palao, origin ARASAAC, owner Government of Aragón); attribution is
> written into `symbols/ATTRIBUTION.md` automatically. Non-commercial use only,
> which covers this.

## Working on it

```bash
npm start           # http://localhost:8080, and prints a LAN address
                    # you can open on the actual phone over wifi
npm test            # behavioural checks (needs: npm i -D playwright)
npm run icons       # regenerates the app icons
```

No dependencies, no build step, no framework. Editing a file and reloading is
the whole loop.

`npm test` covers the rules that are easy to break by accident — most
importantly that a spoken sentence doesn't become the prefix of the next one,
that the quick words never join the sentence being built, and that no tile ever
renders without a picture.

**Changed a file? Bump `CACHE_VERSION` in `sw.js`.** Otherwise devices keep
serving the cached old version forever. This is the single easiest thing to
forget.

## How it's put together

| Path | What |
| --- | --- |
| `js/vocabulary.js` | **The vocabulary.** Edit this first and most. |
| `js/app.js` | Screens, sentence state, navigation |
| `js/images.js` | The photo → symbol → emoji cascade |
| `js/photos.js` | Camera photos, downscaling, on-device storage |
| `js/bodymap.js` | The pain diagram |
| `js/speech.js` | Browser speech, plus the iOS/Chrome quirks |
| `sw.js` | Offline caching |
| `tools/` | Local server, symbol fetcher, icon generator, tests |

A few decisions that aren't obvious from the code:

- **Quick words speak instantly and alone.** Yes / No / Stop / Pain never join
  the sentence being built, because "Stop" can't wait for a sentence to be
  finished first.
- **A spoken sentence fades and the next tap starts fresh.** It stays on screen
  so the listener can still read it, but he never has to hit Clear first.
- **Pain has a body diagram, not a word list.** Pointing beats reading, and this
  is the screen where being slow does real harm.
- **The keyboard is always one tap away.** And spelling it the way it sounds
  still works — the listener hears the sound, not the spelling, so "no" for
  "know" comes out right. That makes typing genuinely usable for him, not a
  fallback that fails.
- **Pinch-zoom is off.** On a speech board it only ever fires by accident and
  strands the layout mid-sentence. One line in `index.html` if you disagree.

## Not built yet

- **No backup or export.** His own words and photos live on one device. Losing
  the phone loses them. An export/import file is the next thing I'd build.
- **No prediction or most-used-first ordering.** Real speed win, but it fights
  motor memory, so it would need to be a setting that's off by default.

## When his situation changes

The vocabulary is aimed at where he is now: nothing by mouth, tube-fed, drain in,
radiation running, no voice prosthesis yet. Three changes are already
predictable:

- **After the swallow study**, if he is cleared to eat, `I want → my mouth`
  should get food and drink tiles back. The originals are in git history.
- **When the drain comes out**, `My neck → my drain` can go.
- **Once he has an electrolarynx or a voice prosthesis**, this stops being his
  only voice and becomes the backup for when it fails or he is too tired. At
  that point speed matters more than coverage, and the tree should get shorter,
  not longer.

## What to watch in the first week

1. **Does he reach for it, or the grease board?** The board is the honest
   benchmark. If it loses, the tree is wrong, not the idea.
2. **Check "Said before" at the end of each day.** Anything he had to type is a
   missing tile. Promote it into `vocabulary.js`.
3. **Is the voice one he'll tolerate?** A voice he finds embarrassing kills
   adoption faster than any missing feature. Speed, pitch and voice are all in
   Settings — try several with him, not for him.
