# One-shot prompt

Everything below the line is a single self-contained prompt. Paste it into a
fresh Claude session to rebuild this app from nothing, or trim it to redesign
one part. It carries the constraints that were expensive to learn — the ones a
fresh session would otherwise get wrong the same way this one did.

Names and personal details are deliberately absent. Keep it that way.

---

Build me a picture speech board as a web app. Plain HTML, CSS and JavaScript —
no framework, no build step, no dependencies, no backend. It must work offline
and be hosted as static files.

**Who it's for.** A man in his sixties who has had a total laryngectomy: he has
no voice at all and breathes through a stoma in his neck. He is a few days out
of surgery. He reads fine but spells badly and phonetically — he writes "no" for
"know". Right now he communicates by writing on a grease board, which is slow,
tiring, and makes whoever he's talking to stand there waiting. He has no
electrolarynx and no voice prosthesis yet, so this app is his voice.

He is also nothing-by-mouth and tube-fed by bolus six times a day with water
flushes before and after each one; he has a surgical drain; he starts radiation
tomorrow; and he is on narcotic pain medication.

**The core interaction.** Tap a category, tap what you mean, hear it spoken out
loud in the device's own voice. Two taps to a finished sentence for the common
case, three at the very most.

**Design rules — these matter more than the visuals:**

1. **Every tile leads with a picture**, with the words underneath as backup. He
   reads, but a picture is faster and doesn't stall him. Never a text-only tile.
2. **Ten tiles per screen, maximum.** A screen he scans is a search task; a
   screen he sees is a shortcut. Big tiles, high contrast, dark background.
3. **One tap must be worth five words.** Whole phrases, not single words —
   "Please call the nurse", not "call" + "the" + "nurse". If a tap only emits
   one word, the grease board is still faster and the app has failed.
4. **Position and colour are motor memory.** Once he knows pain is the red tile
   top-right, moving it costs more than any new tile gains. Append; don't
   reorder.
5. **Nothing identifying anywhere in the app.** No drug names, no doses, no
   clinician or hospital names, no appointment times. Say "my pain medicine",
   not the brand. Personal specifics go in as tiles he adds on the device.

**Behaviours that are easy to get wrong — get these right:**

- **A spoken sentence must not become the prefix of the next one.** After it is
  spoken, leave it on screen faded so a listener can still read it, but have the
  next tile start fresh. Otherwise every single utterance costs an extra tap on
  Clear.
- **Undo means "still editing"** — after an undo, the next tile appends rather
  than starting over.
- **Quick words speak instantly and alone.** Yes, No, Wait, Stop, Help, Pain,
  Thanks, and a one-tap "I cannot breathe, my stoma is blocked, I am a neck
  breather" must never join the sentence being built. A blocked stoma is a
  minutes-level emergency and cannot wait for a sentence to be finished.
- **The whole sentence must stay visible**, not merely present in the DOM. Wrap
  the picture chips; never scroll them sideways. On a narrow phone, scrolling to
  the newest chip pushes the start of the sentence off the left edge, and that
  sequence is how he checks what he built.
- **A 🔊 on every tile sounds the word out** without adding it to the sentence
  or navigating anywhere — a one-second check for a word he half-recognises.

**Screens and features:**

- Sentence strip at the top showing picture chips, with Say it / Undo / Clear.
  On a phone those three move to their own row so the sentence gets full width.
- A grid of category tiles, with Back / Home and a breadcrumb.
- **Pain uses a tappable body diagram**, not a list of body parts. Pointing
  beats reading, and it's the screen where being slow does real harm.
- **A keyboard, always one tap away**, for anything the grid can't say. Tell him
  to spell it however it sounds — the listener hears the sound, not the
  spelling, so phonetic spelling still comes out right.
- **"Said before"**: the last dozen spoken phrases, one tap to replay.
- **Tiles he adds himself**, stored on the device: pick a category, type the
  words, choose an emoji or take a photo. This is where anything personal lives.
- **Pictures resolve in a cascade**: a photo taken on the device, then a bundled
  AAC pictogram (ARASAAC, CC BY-NC-SA), then an emoji. So it is usable the
  moment it loads and improves as pictures are added, rather than waiting on
  artwork.
- Settings: voice, speed, pitch, and toggles for showing words, sounding out,
  and speaking each tile as it is tapped.

**Vocabulary.** Organise the home screen roughly as: I want · I feel · It hurts
· My neck · My feeding tube · I want to ask · Please… · Talking · People · Said
before. The laryngectomy and feeding-tube categories are the ones a generic AAC
app cannot do and he needs many times a day — stoma blocked, need suction, HME
and baseplate, voice prosthesis leaking, feed due, water flush, tube blocked,
tube came out, feeling full. Include radiation side effects (fatigue, skin
burning, thicker secretions, taste loss) and the narcotic cluster (pain
medicine, nausea, constipation, stool softener). Because he is NPO, replace food
and drink with mouth care: dry mouth, swabs, lip balm, "am I allowed ice chips?".
Put red flags — tube out, tube blocked, bleeding, can't breathe — one tap deep,
never nested.

Keep the whole vocabulary in one plain data file that a non-programmer can edit,
with comments explaining the rules above so they survive the next edit.

**Technical:** Web Speech API for the voice (works offline, costs nothing, and
nothing leaves the device). A service worker precaching everything so it works
with no signal. A web manifest so it installs to the home screen on both Android
and iPad. iOS will not speak unless the first utterance happens inside a real
user gesture — prime it on the first touch. Store data in localStorage, and
photos in IndexedDB downscaled to about 480px. Disable pinch-zoom; on a speech
board it only ever fires by accident. Size tile contents from the tile, not the
viewport, or a phone in portrait will crush them.

Write automated browser tests for the behaviours listed above — especially that
a spoken sentence doesn't prefix the next one, that quick words stay out of the
sentence, and that every chip is inside the strip's visible bounds. Test at both
iPad-landscape and phone-portrait sizes. A text assertion passes happily while
the words are scrolled out of sight, so assert on geometry, not just content.
