# Design brief: Stan's board

Hand this whole file to Claude, a designer, or any design AI. It is
self-contained. It says who this is for, what the app has to do, what the
visual direction is, and the nine rules a redesign is not allowed to break.

---

## Who this is for

Stan is a man in his sixties who just had a **total laryngectomy**. He has no
voice at all. He breathes through a **stoma** in his neck — he is a neck
breather, and that changes how CPR and oxygen work on him, which is why one
button on this board is a medical alert. He is fed through a **tube**. He is
in radiation. He does not have an electrolarynx or a voice prosthesis yet.

**This app is his voice in the meantime.** Before it, he was writing on a
grease board.

Things about him that drive every design decision:

- **He reads fine. He does not spell.** He writes "know" as "no". Anything
  that requires typing a correctly-spelled word will fail him.
- **The large-print mail he gets from his insurance company is his native
  format.** Big type, high contrast, one idea per line. He reads that
  comfortably. He does not read dense UI.
- **He is a Facebook user, not a phone person.** He knows tapping a thing to
  make it go. He does not know gestures, long-press, drawers, or settings.
- **He uses this on an Android phone and an iPad.** The phone is what is
  actually in his pocket in the waiting room. The phone case is the real case.
- **He is often tired, often in pain, sometimes in a hurry, sometimes
  frightened.** Every extra tap is a tax he pays at his worst moment.

## What the app does

Tap picture tiles to build a sentence, then press **Say it** and the phone
speaks it out loud in the room.

The core loop, in order of how often it happens:

1. **He wants to say a thing he says all the time.** ("I need suction." "I
   want a lottery ticket." "How is Jag?") This should take **one tap**, not
   four. The app learns what he says by counting it, and offers those back.
2. **He wants to say something in his life but not his top ten.** He walks the
   tile tree: a category on the home screen, then the specific thing. Two or
   three taps.
3. **Emergency.** Stoma blocked, cannot breathe, tube out, bleeding. One tap,
   speaks immediately, no sentence building.
4. **Something entirely new.** Type it with letter completion that forgives his
   spelling. Rare, and slow, and that is fine — it is the escape hatch.

The whole design should be shaped around loop 1 being instant and loop 3 being
unmissable.

## What is wrong with it right now

Kyle's words, and he is right on every count:

> "The design sucks and it takes too long to find things, too small on a phone
> too. Stan gets the large print mail from his insurance company. There's a lot
> of colors there. It's not really that intuitive. It doesn't bring up what
> he's wanting to say."

Concretely:

- **Nine saturated category colors.** Every category had its own hue. It reads
  like a bill from an insurer — busy, coded, and the code means nothing to him.
  Colour was carrying information he never asked for, and it drowned out the
  one place colour should mean something: the emergency button.
- **Type too small on the phone.** Labels shrank to fit rather than the layout
  growing to fit the labels. Words got clipped mid-word.
- **The learning layer was a footnote.** The app already knows his top phrases.
  They were sitting in a thin dashed strip that looks like decoration. The
  thing that makes it fast was the smallest thing on screen.

## The direction

**Large-print mail, not an app.** Calm dark ground, generous neutral tiles,
near-white text, big. One accent colour for "this is the fast path". One red,
and it means *medical emergency*, nothing else. One green, and it means *yes*.
Category identity comes from **position and picture**, never from hue.

**The suggestion is the front door.** What he probably wants to say goes above
the grid, full width, as the biggest tappable thing on the screen short of the
sentence itself. Idle, it offers his most-said phrases. Mid-sentence, it offers
completions of what he has started. The tile tree is the fallback, not the
front door.

**Phone first.** Design at 412×915 and make sure it survives at 1194×834, not
the other way round. On the phone: fewer, taller tiles; labels that wrap to two
lines rather than shrinking; the quick rail as one dense row of the things that
cannot wait; header chrome that collapses out of the way until he has actually
started a sentence.

## The nine rules

A redesign that breaks any of these is worse than no redesign.

1. **Tiles never move.** Not reordered by frequency, not sorted, not hidden.
   He is building motor memory — "I want" is top-left and it stays top-left
   forever. This is the LAMP principle and it is the difference between a board
   he can use without reading and one he has to re-read every time. All
   learning shows up in the suggestion region, which is a *separate, fixed
   place*. Nothing in the grid ever rearranges.
2. **Every tile has a picture.** He can't spell and shouldn't have to read
   under pressure. No text-only tiles, ever.
3. **One tap to speak, always visible.** Say it is never behind a menu, never
   scrolled off, never disabled when there is something to say.
4. **The emergency tiles speak immediately** and alone — they do not compose
   into a sentence, they do not wait for Say it. Same for the swear tiles, for
   the opposite reason: when he's angry he wants it out, now.
5. **Red is emergency. Nothing else is red.** If a redesign wants red for
   emphasis, it is wrong.
6. **It works with no network.** Static files, service worker, everything on
   device. He will be in a hospital basement.
7. **Nothing personal leaves the device.** Names, photos, phrases, counts —
   localStorage and IndexedDB only. No accounts, no analytics, no fonts or
   scripts from a CDN. The board carries his family's names.
8. **No gestures, no long-press, no swipe.** Tap only. Every action has a
   visible button with a word and a picture on it.
9. **No build step.** Vanilla HTML, CSS, ES modules, no dependencies. It has to
   still work in a year when nobody is maintaining it, and it has to be
   editable by whoever is sitting with him.

## Constraints that are not negotiable

- Minimum tile label size: **20px on the phone**, larger on tablet. Labels wrap;
  they do not shrink and they do not clip.
- Minimum tap target: **72px** for a suggestion bar, **44px** absolute floor for
  anything else.
- Contrast: text on tiles at or above **7:1**. He is older and often tired.
- **No horizontal scrolling, at any viewport.** Ever.
- The sentence he has built is **always fully visible** — it wraps, it does not
  scroll off to the left.

## How to verify a redesign

`stan/tools/smoke-test.mjs` runs the whole board in a real browser at both
sizes and asserts behaviour *and* design: label sizes, clipping, colour count,
that only one thing is red, that suggestions sit above the grid, that the top
suggestion is at least 72px tall. A design change is not done until that suite
is green at both viewports.

Run it with:

```
node tools/smoke-test.mjs
```

## What to hand back

Changes to `styles.css` first — the palette, the type scale, the phone
breakpoint. `js/vocabulary.js` only for the colour map and for flagging which
tiles are emergencies. `js/app.js` only for where the suggestion region renders.

Do not touch tile order, tile wording, or any behaviour.
