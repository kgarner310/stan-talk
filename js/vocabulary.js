/**
 * The vocabulary tree. This is the file to edit, constantly.
 *
 * Design rules, so edits stay consistent:
 *
 * 1. EVERY TILE HAS A PICTURE. He spells phonetically ("know" -> "no"), so a
 *    text-only tile is a reading test, not a shortcut. The emoji is the
 *    primary content; the words underneath are the backup, not the other way
 *    around. Never add a tile without a symbol.
 * 2. SHALLOW. Two taps to a finished sentence for the common case, three at
 *    the very most.
 * 3. NINE TILES PER SCREEN, MAX. Scannable at a glance instead of searchable.
 * 4. WHOLE PHRASES, NOT WORDS. One tap has to emit five words, or the grease
 *    board is still faster.
 * 5. POSITION IS MEMORY. Append, don't reorder. Once he knows pain is the red
 *    tile top-right, moving it costs more than any new tile gains.
 *
 * Node shape:
 *   { id, icon, label, text?, silent?, color?, kind?, children? }
 *
 *   text    - what lands in the sentence (defaults to label)
 *   silent  - tile only navigates, contributes no words
 *   kind    - 'bodymap' renders the pain diagram instead of a grid
 */

export const COLORS = {
  neck: '#0891B2',
  feed: '#BE185D',
  want: '#1D6FE0',
  feel: '#7B4BD6',
  body: '#C62F35',
  ask: '#C97A05',
  doThis: '#0F8B7E',
  talk: '#2E7D32',
  people: '#3F4FBF',
  time: '#546276',
  recent: '#5A6472',
};

/** Group tile: navigates, adds nothing to the sentence. */
const g = (id, icon, label, color, children) => ({
  id,
  icon,
  label,
  silent: true,
  color,
  children,
});

/** Leaf tile: adds words and finishes the phrase. */
const w = (icon, label, text) => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  icon,
  label,
  text,
});

/**
 * Exclamation tile: speaks on its own instead of joining the sentence being
 * built. Swearing is not a clause — sitting under "I feel" it would otherwise
 * compose into "I feel This is bullshit".
 */
const x = (icon, label, text) => ({ ...w(icon, label, text), alone: true });

// ---------------------------------------------------------------------------

const want = {
  id: 'want',
  icon: '🙋',
  label: 'I want',
  text: 'I want',
  color: COLORS.want,
  children: [
    // He is NPO — nothing by mouth until the swallow study. Food and drink
    // tiles would be noise; dry mouth and mouth care are the daily reality.
    // Put the eating tiles back here once the esophagram clears him.
    g('want-mouth', '👄', 'my mouth', COLORS.want, [
      w('💧', 'something for my dry mouth'),
      w('🧽', 'a mouth swab'),
      w('💄', 'lip balm'),
      w('🚿', 'to rinse my mouth'),
      w('🪥', 'my mouth cleaned'),
      w('🧊', 'ice chips, if I am allowed'),
      w('❓', 'to know if I can have anything by mouth yet'),
    ]),
    g('want-meds', '💊', 'my medicines', COLORS.want, [
      w('💊', 'my pain medicine'),
      w('🤢', 'something for feeling sick'),
      w('🚽', 'my stool softener'),
      w('🌡️', 'something for the fever'),
      w('🚫', 'to skip the strong one this time'),
      w('⏰', 'to know when my next dose is'),
    ]),
    g('want-move', '🚶', 'to move', COLORS.want, [
      w('🪑', 'to sit up'),
      w('🛏️', 'to lie down'),
      w('🧍', 'to stand up'),
      w('🚶', 'to walk'),
      w('🔄', 'to turn over'),
      w('🛌', 'to go back to bed'),
      w('🦵', 'you to move my legs'),
      w('💪', 'you to move my arm'),
      w('🤲', 'you to help me up'),
    ]),
    g('want-thing', '📦', 'a thing', COLORS.want, [
      w('📱', 'my phone'),
      w('👓', 'my glasses'),
      w('📺', 'the remote'),
      w('✍️', 'my board and marker'),
      w('🧣', 'a blanket'),
      w('🛏️', 'another pillow'),
      w('🤧', 'a tissue'),
      w('👟', 'my shoes'),
      w('👛', 'my wallet'),
    ]),
    g('want-room', '🚪', 'the room', COLORS.want, [
      w('💡', 'the light on'),
      w('🌙', 'the light off'),
      w('📺', 'the TV on'),
      w('📴', 'the TV off'),
      w('🔉', 'it quieter'),
      w('🔊', 'it louder'),
      w('🚪', 'the door closed'),
      w('🔓', 'the door open'),
      w('🪟', 'the window open'),
    ]),
    w('🚻', 'the bathroom', 'to go to the bathroom'),
    w('🤫', 'to be alone for a while'),
    w('🤝', 'you to stay'),
    // His actual map: the towns he rides between and the stops that matter.
    // Brad drives. Health Smart is HIS pharmacy — named so the driver knows
    // which one, with CVS separate because it is a different errand.
    g('want-go', '🚗', 'to go somewhere', COLORS.want, [
      w('🛒', 'Food Lion', 'to go to Food Lion'),
      w('🏬', 'Walmart', 'to go to Walmart'),
      w('💊', 'Health Smart', 'to go to Health Smart, my pharmacy'),
      w('⚕️', 'CVS', 'to go to CVS'),
      w('🏥', 'the clinic', 'to go to the clinic'),
      w('🎟️', 'a lottery ticket', 'a lottery ticket'),
      w('🏘️', 'Maiden', 'to ride to Maiden'),
      w('🏙️', 'Hickory', 'to ride to Hickory'),
      w('🌆', 'Lincolnton', 'to ride to Lincolnton'),
      w('🏞️', 'Newton', 'to ride to Newton'),
    ]),
  ],
};

const feel = {
  id: 'feel',
  icon: '❤️',
  label: 'I feel',
  text: 'I feel',
  color: COLORS.feel,
  children: [
    g('feel-body', '🫀', 'in my body', COLORS.feel, [
      w('🥱', 'tired'),
      w('👀', 'wide awake'),
      w('🥵', 'hot'),
      w('🥶', 'cold'),
      // Hungry and thirsty live under the feeding tube instead — while he is
      // NPO they are about the feed, not about wanting a sandwich.
      w('🤢', 'sick to my stomach'),
      w('😵‍💫', 'dizzy'),
      w('😖', 'itchy'),
      w('🚽', 'constipated'),
      w('🌡️', 'like I have a fever'),
      w('👄', 'like my mouth is very dry'),
    ]),
    g('feel-head', '🧠', 'in my head', COLORS.feel, [
      w('👍', 'okay'),
      w('😀', 'good'),
      w('😤', 'frustrated'),
      w('😨', 'scared'),
      w('😟', 'worried'),
      w('😠', 'angry'),
      w('😢', 'sad'),
      w('😔', 'lonely'),
      w('😩', 'fed up'),
    ]),
    g('feel-trend', '📊', 'compared to before', COLORS.feel, [
      w('⬆️', 'better than yesterday'),
      w('⬇️', 'worse than yesterday'),
      w('➡️', 'about the same'),
      w('🌅', 'better than this morning'),
      w('🌇', 'worse than this morning'),
      w('❗', 'like something changed'),
    ]),
    // Straight out of his texts: "Down and out bro I'm fed up", "this place is
    // a drag". He should not have to write that longhand either.
    g('feel-stuck', '🏥', 'about this place', COLORS.feel, [
      w('😤', 'fed up with this place'),
      w('🏠', 'ready to be home'),
      w('🤐', 'like nobody tells me anything'),
      w('😔', 'like I am in the way here'),
      w('😴', 'like I cannot rest in here'),
      w('🛏️', 'like I want my own bed'),
      w('⬇️', 'down and out today'),
      w('💪', 'better than I did yesterday'),
    ]),
    w('👌', 'fine, really'),
    w('⏸️', 'like I need a minute'),
    w('🙂', 'like myself today'),
    w('❓', 'not right, and I cannot explain it', 'like something is not right, and I cannot explain it'),
    // Swearing. He writes "these beds are all nothing but bullshit" — this is
    // his register, and a board that cannot say what he would say is not his
    // voice. Standard AAC practice includes profanity for exactly this reason:
    // withholding it is voice-policing dressed up as politeness.
    //
    // These are statements on their own, so they carry `text` that ignores the
    // "I feel" prefix. Kept LAST in the list on purpose — `gated` lets Settings
    // hide the tile without shifting the position of anything above it, so
    // nobody's motor memory breaks either way.
    {
      id: 'feel-swear',
      icon: '🤬',
      label: 'strong words',
      silent: true,
      color: COLORS.feel,
      gated: 'strongWords',
      children: [
        x('🐂', 'Bullshit', 'This is bullshit'),
        x('💢', 'Damn it'),
        x('⚡', 'God damn it'),
        x('💩', 'Shit'),
        x('🤬', 'Fuck'),
        x('🚫', 'Fuck this'),
        x('😡', 'Fuck off'),
        x('👊', 'Son of a bitch'),
        x('🤷', 'What the hell'),
        x('✋', 'Hell no'),
      ],
    },
  ],
};

const pain = {
  id: 'pain',
  icon: '🤕',
  label: 'It hurts',
  text: 'It hurts',
  color: COLORS.body,
  children: [
    {
      id: 'pain-where',
      icon: '📍',
      label: 'here',
      silent: true,
      color: COLORS.body,
      kind: 'bodymap',
    },
    g('pain-howbad', '📈', 'this much', COLORS.body, [
      w('🙂', 'a little'),
      w('😣', 'a lot'),
      w('😫', 'very badly'),
      w('⬆️', 'worse than before'),
      w('🚨', 'the worst it has been', 'worse than it has ever been'),
      w('👌', 'but I can handle it'),
    ]),
    // These leaves carry a spoken `text` distinct from the tile label: the
    // label stays one glanceable word, while the sentence composes as real
    // English — "It hurts and it is sharp", not "It hurts sharp".
    g('pain-kind', '⚡', 'like this', COLORS.body, [
      w('🔪', 'sharp', 'and it is sharp'),
      w('🪨', 'dull and constant', 'and it is dull and constant'),
      w('🔥', 'burning', 'and it is burning'),
      w('😖', 'aching', 'and it is aching'),
      w('🌀', 'cramping', 'and it is cramping'),
      w('📌', 'pins and needles', 'and it feels like pins and needles'),
      w('🚶', 'when I move'),
      w('🫁', 'when I breathe'),
      w('👆', 'when you touch it'),
    ]),
    w('💊', 'and I need something for it now'),
    w('🚫', 'and the medicine is not working'),
    w('📉', 'but it is getting better'),
    // Shares its id with the same phrase under My neck on purpose, so one
    // photo or symbol covers both. The `text` makes it compose after
    // "It hurts" instead of producing "It hurts I cannot breathe well".
    w('🫁', 'I cannot breathe well', 'and I cannot breathe well'),
  ],
};

/**
 * Laryngectomy vocabulary.
 *
 * This is the category a general-purpose AAC board cannot cover and he needs
 * every single day: airway, secretions, the HME and baseplate kit, and the
 * voice prosthesis. Without it, "my baseplate is coming off" is a sentence he
 * has to write out by hand every time it happens.
 *
 * The first tile is a medical alert aimed at a stranger, not at family. A
 * blocked stoma is a minutes-level emergency, and someone attempting
 * mouth-to-mouth on a neck breather is spending the only minutes available.
 *
 * These phrases are a starting point written from general laryngectomy care.
 * Go through them with his SLT or head-and-neck nurse and cut, reword, and add
 * — they will know which of these he actually needs and what is missing.
 */
const neck = {
  id: 'neck',
  icon: '🫁',
  label: 'My neck',
  silent: true,
  color: COLORS.neck,
  children: [
    {
      id: 'neck-alert',
      icon: '🚨',
      label: 'I am a neck breather',
      text: 'I am a neck breather. I breathe through the opening in my neck, not my mouth or nose. Do not give mouth to mouth.',
    },
    g('neck-air', '💨', 'breathing', COLORS.neck, [
      w('😧', 'I cannot breathe well'),
      w('🚫', 'My stoma is blocked'),
      w('🌬️', 'I need suction'),
      w('😮‍💨', 'I need to cough'),
      w('⏸️', 'Give me a minute to get my breath'),
      w('✋', 'Do not cover my stoma'),
      w('💧', 'The air is too dry'),
      w('🫧', 'I need humidified air'),
      w('🛏️', 'I need to sit up to breathe'),
    ]),
    g('neck-mucus', '🤧', 'mucus', COLORS.neck, [
      w('😮‍💨', 'I need to cough something up'),
      w('🧻', 'I need a tissue'),
      w('🩹', 'I need gauze'),
      w('🪨', 'There is a plug I cannot shift'),
      w('🥄', 'It is thicker than usual'),
      w('💧', 'I need saline'),
      w('🩸', 'There is blood in it'),
      w('✅', 'It is clear today'),
    ]),
    // The real product names, because these are the words said out loud around
    // him every day: the HME cassette changes daily and gets checked three
    // times a day, the adhesive baseplate changes daily, and the LaryTube keeps
    // the stoma open. Using the actual names means a nurse or a supplier knows
    // exactly what he means on the first try.
    // Built from his own guidelines sheet, so the words match his actual kit:
    // LaryTube plus LaryClips with sticky pads and reusable Velcro wings — not
    // adhesive baseplates. His HME comes in a Home type and a Night type, and
    // the tube is cleaned at least twice a day with soap and the kit brush.
    g('neck-kit', '🧰', 'my kit', COLORS.neck, [
      w('🔁', 'I need a new HME'),
      w('🚫', 'My HME is clogged'),
      w('🏠', 'I need my Home HME'),
      w('🌙', 'I need my Night HME'),
      w('🫙', 'My LaryTube came out'),
      w('⬇️', 'I need my LaryTube put back in'),
      w('📎', 'My LaryClip is not sticking'),
      w('🩹', 'I need new sticky pads'),
      w('🤲', 'Help me put this on'),
    ]),
    g('neck-clean', '🧼', 'cleaning', COLORS.neck, [
      w('🧽', 'My LaryTube needs cleaning'),
      w('🪥', 'I need the brush and the soap'),
      w('🤏', 'I need a skin tac wipe'),
      w('⏳', 'Let it dry first'),
      w('💧', 'I need gauze and saline'),
      w('✨', 'Clean around my stoma'),
      w('🪨', 'There is crusting'),
      w('♻️', 'Save the Velcro wings'),
      w('😖', 'My stoma is sore'),
    ]),
    g('neck-supplies', '📦', 'supplies', COLORS.neck, [
      w('📉', 'We are running low on supplies'),
      w('🔁', 'I need more HMEs'),
      w('📎', 'I need more LaryClips'),
      w('🩹', 'I need more sticky pads'),
      w('🛒', 'We need to order more from Atos'),
      w('🗣️', 'Call my speech therapist'),
      w('❓', 'Where are my supplies?'),
      w('🚿', 'I need my shower cover'),
    ]),
    g('neck-voice', '🗣️', 'my voice', COLORS.neck, [
      w('📢', 'I need my electrolarynx'),
      w('💦', 'My voice prosthesis is leaking'),
      w('🥤', 'I cough when I drink'),
      w('🧼', 'Help me clean my prosthesis'),
      w('🔇', 'I cannot make any sound right now'),
      w('🩺', 'My valve needs changing'),
      w('🔋', 'The battery is dead'),
    ]),
    // Radiation thickens secretions and burns the skin over the stoma, so it
    // belongs beside the stoma vocabulary rather than in a category of its own.
    g('neck-radiation', '☢️', 'radiation', COLORS.neck, [
      w('😴', 'I am too tired for this'),
      w('🔥', 'My skin is burning'),
      w('🩹', 'My neck is sore from the radiation'),
      w('🧴', 'I need my skin cream'),
      w('👄', 'My mouth is dry from the radiation'),
      w('👅', 'Everything tastes wrong'),
      w('📉', 'It is worse today'),
      w('❓', 'How many treatments are left?'),
    ]),
    g('neck-drain', '🧵', 'my drain', COLORS.neck, [
      w('😣', 'My drain hurts'),
      w('🈵', 'My drain is full'),
      w('💧', 'My drain is leaking'),
      w('🚨', 'My drain came out'),
      w('❓', 'When does the drain come out?'),
    ]),
    w('🩸', 'My stoma is bleeding'),
  ],
};

/**
 * Feeding tube. Six bolus feeds a day plus water flushes before and after each
 * one, so this is the single most-used category after the stoma — it earns a
 * slot on the home screen rather than being buried a level down.
 *
 * "My tube came out" and "My tube is blocked" sit at the top level on purpose:
 * both need a nurse now, and neither should cost three taps.
 */
const feed = {
  id: 'feed',
  icon: '🥛',
  label: 'My feeding tube',
  silent: true,
  color: COLORS.feed,
  children: [
    g('feed-time', '⏰', 'my feed', COLORS.feed, [
      w('⏰', 'It is time for my feed'),
      w('👍', 'I am ready for my feed'),
      w('⏳', 'Can we do the feed later?'),
      w('🐢', 'Please go slower'),
      w('💧', 'I need my water flush'),
      w('🥤', 'I need my extra water'),
      w('🥛', 'I need my protein drink'),
      w('🛑', 'That is enough'),
      w('✅', 'I finished it all'),
    ]),
    g('feed-how', '🤢', 'how it feels', COLORS.feed, [
      w('🎈', 'I feel full'),
      w('🤢', 'I feel sick'),
      w('😣', 'I have cramps'),
      w('😖', 'I am bloated'),
      w('↩️', 'It is coming back up'),
      w('🍽️', 'I am still hungry'),
      w('🥤', 'I am thirsty'),
      w('👌', 'That went down fine'),
    ]),
    w('🚱', 'My tube is blocked'),
    w('🚨', 'My feeding tube came out'),
    w('🩹', 'The skin around my tube is sore'),
    w('💧', 'It is leaking around the tube'),
    w('❓', 'Am I allowed anything by mouth yet?'),
  ],
};

const ask = {
  id: 'ask',
  icon: '❓',
  label: 'I want to ask',
  silent: true,
  color: COLORS.ask,
  children: [
    w('🕐', 'What time is it?'),
    w('🤷', 'What is going on?'),
    w('🩺', 'What did the doctor say?'),
    g('ask-when', '⏰', 'When can I...', COLORS.ask, [
      w('🏠', 'When can I go home?'),
      w('🍽️', 'When can I eat?'),
      w('😴', 'When can I sleep?'),
      w('🩺', 'When does the doctor come?'),
      w('💊', 'When is my next medicine?'),
      w('🔙', 'When are you coming back?'),
    ]),
    g('ask-where', '📍', 'Where is...', COLORS.ask, [
      w('💗', 'Where is my wife?'),
      w('👨‍👩‍👧', 'Where is my family?'),
      w('📱', 'Where is my phone?'),
      w('🗺️', 'Where am I?'),
      w('🎒', 'Where are my things?'),
      w('🧑‍⚕️', 'Where is the nurse?'),
    ]),
    // Going home is the thing he asks about most, and the answer keeps moving —
    // told he is going tomorrow, then told maybe tomorrow again. That deserves
    // its own screen rather than one buried tile.
    g('ask-home', '🏠', 'going home', COLORS.ask, [
      w('🏠', 'When can I go home?'),
      w('📅', 'Am I going home today?'),
      w('🩺', 'Did they say anything about going home?'),
      w('🔄', 'They keep changing the day'),
      w('👍', 'I am ready to go home'),
      w('📋', 'What has to happen before I can go?'),
      w('🚗', 'Who is taking me home?'),
      w('🤝', 'Will someone stay with me?'),
    ]),
    w('🆗', 'Am I okay?'),
    w('😟', 'Is it serious?'),
    w('🔁', 'Can you say that again?'),
    w('👂', 'Did you understand me?'),
  ],
};

const doThis = {
  id: 'do',
  icon: '🙏',
  label: 'Please...',
  text: 'Please',
  color: COLORS.doThis,
  children: [
    // Names live under People, where each one opens its own set of phrases.
    // These stay generic on purpose — and note there is no "call my wife": his
    // partner died, and a board should never hand him that tile by accident.
    g('do-call', '📞', 'call someone', COLORS.doThis, [
      w('🧑‍⚕️', 'call the nurse'),
      w('🩺', 'call the doctor'),
      w('👨‍👩‍👧', 'call my family'),
      w('🆘', 'get someone who can help'),
    ]),
    g('do-adjust', '🛏️', 'adjust things', COLORS.doThis, [
      w('⬆️', 'raise the bed'),
      w('⬇️', 'lower the bed'),
      w('🛏️', 'fix my pillow'),
      w('🧣', 'straighten my blanket'),
      w('💪', 'move my arm'),
      w('🦵', 'move my leg'),
      w('🪑', 'help me sit up'),
      w('🌬️', 'suction me'),
      w('🔌', 'check that line'),
    ]),
    // The time words used to be a top-level category, appended to whatever
    // sentence was in progress. They live here instead: the home screen slot
    // went to the feeding tube, and "Please do it now" is a whole thought in
    // one tap rather than a modifier bolted onto a finished sentence.
    g('do-when', '🕐', 'when', COLORS.doThis, [
      w('⚡', 'do it now'),
      w('🚨', 'do it right now'),
      w('⏱️', 'come back in a minute'),
      w('⏳', 'come back in five minutes'),
      w('🔜', 'do it later'),
      w('✋', 'not yet', 'wait, not yet'),
      w('🐢', 'take your time'),
      w('🌙', 'leave it until tonight'),
      w('🌅', 'leave it until tomorrow'),
    ]),
    // "I don't know how to do all that I need to know myself. I guess I better
    // start taking some fast lessons." Learning his own stoma care is the thing
    // standing between him and home, so give him the words for being taught.
    g('do-teach', '🎓', 'teach me', COLORS.doThis, [
      w('👀', 'show me how to do this'),
      w('🐢', 'go slower so I can learn it'),
      w('🙋', 'let me try it myself'),
      w('✍️', 'write the steps down for me'),
      w('🔁', 'show me one more time'),
      w('🤲', 'watch me do it'),
      w('✅', 'I think I have got it'),
      w('❓', 'what happens if I get it wrong?'),
    ]),
    w('👋', 'come here'),
    w('✋', 'wait a second'),
    w('🐢', 'slow down'),
    w('⏱️', 'give me a minute'),
    w('🗣️', 'let me finish'),
    w('🚫', 'do not touch that'),
  ],
};

const talk = {
  id: 'talk',
  icon: '💬',
  label: 'Talking',
  silent: true,
  color: COLORS.talk,
  children: [
    // His dog carries more weight than anything else in this vocabulary. Put a
    // photo of him on this tile — Settings → Change tile pictures — and rename
    // these with his actual name using "His own words".
    g('talk-dog', '🐕', 'Jag', COLORS.talk, [
      w('❓', 'How is Jag?'),
      w('💭', 'I miss him'),
      w('📷', 'Show me a picture of him'),
      w('🌳', 'Has he been outside today?'),
      w('🤲', 'Give him a belly rub for me'),
      w('💦', 'Do not let him get too wet'),
      w('❤️', 'Tell him I love him'),
      w('🏠', 'I cannot wait to see him'),
      w('🙏', 'Thank you for taking care of him'),
    ]),
    // He apologises for having needs — "enough of my crybaby mouth", "I'm going
    // to owe you everything I got". Give him one tap for the thing he keeps
    // spending a whole handwritten paragraph on.
    g('talk-thanks', '🙏', 'thank you', COLORS.talk, [
      w('🙏', 'Thank you, I mean it'),
      w('💚', 'I cannot thank you enough'),
      w('🤝', 'You are a good friend'),
      w('🎱', 'I owe you a game of pool'),
      w('😞', 'I do not want to be a burden'),
      w('🤐', 'Sorry for complaining'),
      w('👊', 'Thanks, brother'),
      w('😊', 'I am glad you came'),
    ]),
    // His life before all this. A laryngectomy takes the voice that told
    // these stories; the tiles give the openers back, and a listener's
    // questions can carry it from there.
    g('talk-life', '📖', 'my stories', COLORS.talk, [
      w('🛢️', 'I worked on oil rigs in the Gulf'),
      w('🧱', 'I was a brick mason for years'),
      w('🏭', 'I worked at Carolina Mills'),
      w('🌱', 'I used to do lawn maintenance'),
      w('❓', 'Ask me about it'),
    ]),
    w('👋', 'Hello'),
    w('🌅', 'Good morning'),
    w('🌙', 'Good night'),
    w('❤️', 'I love you'),
    w('🤗', 'How are you?'),
    // He cannot laugh out loud anymore — a laryngectomy takes that too. This
    // tile is how amusement gets a voice.
    w('😄', 'That is funny'),
    w('🤷', 'Never mind, it is not important'),
  ],
};

const people = {
  id: 'people',
  icon: '👥',
  label: 'People',
  silent: true,
  color: COLORS.people,
  dynamic: 'people',
  children: [],
};

const recents = {
  id: 'recents',
  icon: '🔁',
  label: 'Said before',
  silent: true,
  color: COLORS.recent,
  dynamic: 'recents',
  children: [],
};

/**
 * Root grid. Order and colour are load-bearing — see rule 5.
 *
 * Ten tiles rather than nine: the stoma and the feeding tube both earn a slot
 * several times a day, and 3x4 on the iPad (2x5 on the phone) is still one
 * glance. Ten is the ceiling — past that it stops being a glance and becomes a
 * search. `When` lost its slot to the feeding tube and now lives under
 * `Please…`, which is where its words were actually being used.
 */
export const ROOT = [want, feel, pain, neck, feed, ask, doThis, talk, people, recents];

/**
 * Always on screen. These speak immediately and alone — they never join the
 * sentence being built, because "Stop" cannot wait for a sentence to finish.
 */
export const QUICK = [
  // First, and deliberately ahead of the more frequent Yes/No: a blocked stoma
  // is a minutes-level problem, and it must never cost more than one tap.
  { icon: '🚨', label: 'Cannot breathe', text: 'I cannot breathe. My stoma is blocked. I am a neck breather.', color: '#E11D48' },
  { icon: '👍', label: 'Yes', text: 'Yes', color: '#2E7D32' },
  { icon: '👎', label: 'No', text: 'No', color: '#C62F35' },
  { icon: '✋', label: 'Wait', text: 'Wait', color: '#C97A05' },
  { icon: '🛑', label: 'Stop', text: 'Stop', color: '#C62F35' },
  { icon: '🆘', label: 'Help', text: 'I need help', color: '#C97A05' },
  { icon: '🤕', label: 'Pain', text: 'I am in pain', color: '#C62F35' },
  { icon: '🙏', label: 'Thanks', text: 'Thank you', color: '#2E7D32' },
  { icon: '🤷', label: "Don't get it", text: 'I do not understand', color: '#5A6472' },
];

/**
 * His people. Put a real photo on every one of these — Settings → Change tile
 * pictures. A face is recognised instantly; a name has to be read.
 *
 * Two entries carry more than a name:
 *
 * - Zack and Zach sound identical and are spelled nearly alike, which on a
 *   picture board is a genuine mis-tap waiting to happen. Their labels carry
 *   the relationship to tell them apart, and photos will do it better still.
 * - `gone: true` marks someone who has died. It swaps the whole action list —
 *   nobody should be offered "Is Bandy coming?" about someone they lost.
 * - `light: true` softens that further, for someone remembered at more of a
 *   distance. Bandy and Stan had parted ways before she passed; a full
 *   missing-you screen would be the board deciding his feelings for him.
 *   Eric — his son — gets the full remembering screen.
 */
export const DEFAULT_PEOPLE = [
  // Family. The remembering entries sit together at the end of the group:
  // Eric (his son), his dad, his mom, and his grandma. Dad, Mom and Grandma
  // are marked gone on the family's timeline — if either parent is living,
  // flip the flag and they get the full call/visit set instead.
  { icon: '👩', label: 'Tracey', role: 'sister', group: 'family' },
  { icon: '👦', label: 'Zach (grandson)', name: 'Zach', role: 'grandson', group: 'family' },
  { icon: '🧑‍🦱', label: 'Zack (nephew)', name: 'Zack', role: 'nephew', group: 'family' },
  { icon: '👩‍🦰', label: 'Desiree', group: 'family' },
  { icon: '👨', label: 'Eric', role: 'son', gone: true, group: 'family' },
  { icon: '👨‍🦳', label: 'Dad', gone: true, group: 'family' },
  { icon: '👩‍🦳', label: 'Mom', gone: true, group: 'family' },
  { icon: '👵', label: 'Grandma', gone: true, group: 'family' },
  { icon: '👩‍🦱', label: 'Bandy', gone: true, light: true, group: 'family' },

  // Friends. Some icons are mnemonics until photos replace them — a moon for
  // Cindy, a bee for Melissa, a gem for Tiffany.
  { icon: '🧑', label: 'Kyle', role: 'friend', group: 'friends' },
  { icon: '🚗', label: 'Brad', role: 'friend', group: 'friends' },
  { icon: '🌙', label: 'Cindy', role: 'friend', group: 'friends' },
  { icon: '🌼', label: 'Angela', role: 'friend', group: 'friends' },
  { icon: '💎', label: 'Tiffany', role: 'friend', group: 'friends' },
  { icon: '🐝', label: 'Melissa', role: 'friend', group: 'friends' },
  { icon: '👧', label: 'Laney', group: 'friends' },
  { icon: '🧒', label: 'Evie', group: 'friends' },

  // Neighbors.
  { icon: '🧔', label: 'Alan', role: 'neighbor', group: 'neighbors' },
  { icon: '👓', label: 'Rick', role: 'neighbor', group: 'neighbors' },
  { icon: '🧢', label: 'Bobby', role: 'neighbor', group: 'neighbors' },
  { icon: '🌺', label: 'Dnasia', role: 'neighbor', group: 'neighbors' },

  // No group: shown at the top level of People, beside the group tiles.
  { icon: '👩‍⚕️', label: 'Amanda', role: 'nurse' },
];

/**
 * The things he might want to say about a person, generated per name.
 *
 * Deliberately free of he/she/him/her: the same eight phrases then work for
 * everyone on the list without the board having to know anyone's pronouns,
 * and without me guessing wrong about someone I have never met.
 */
export function personActions(person) {
  const name = person.name || person.label;
  const who = person.role ? `my ${person.role} ${name}` : name;

  if (person.gone) {
    if (person.light) {
      return [
        w('💭', `I was thinking about ${name}`),
        w('📷', `Show me a picture of ${name}`),
      ];
    }
    return [
      w('💭', `I miss ${name}`),
      w('❤️', `I was thinking about ${name}`),
      w('🕯️', `I wish ${name} was here`),
      w('🗣️', `Tell me about ${name}`),
      w('📷', `Show me a picture of ${name}`),
    ];
  }

  return [
    w('📞', `Call ${who}`),
    w('❓', `Where is ${name}?`),
    w('🕐', `Is ${name} coming?`),
    w('👀', `I want to see ${name}`),
    w('💭', `I miss ${name}`),
    w('❤️', `Give ${name} my love`),
    w('🙏', `Thank ${name} for me`),
    w('🤫', `Do not tell ${name}`),
  ];
}
