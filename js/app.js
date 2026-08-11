import { ROOT, QUICK, DEFAULT_PEOPLE, personActions } from './vocabulary.js';
import { say, hush, unlock, getVoices, refreshVoices, supported } from './speech.js';
import { load, save, KEYS, DEFAULT_SETTINGS } from './storage.js';
import { buildBodyMap, EXTRA_PARTS } from './bodymap.js';
import { loadSymbolIndex, mediaElement, setPhotos, setPhoto, clearPhoto, hasPhoto, symbolCount } from './images.js';
import { loadAllPhotos, putPhoto, deletePhoto, fileToTileImage } from './photos.js';

const MAX_PHRASES = 300; // kept in the store
const SHOWN = 10;        // shown on a screen — the tile ceiling

/** One-time migration: seed the counted phrase store from the old recents. */
function loadPhrases() {
  const phrases = load(KEYS.phrases, null);
  if (phrases) return phrases;
  const seeded = {};
  const legacy = load(KEYS.recents, []);
  for (const [i, r] of legacy.entries()) {
    if (r && r.text) seeded[r.text] = { icons: r.icons || [], count: 1, last: Date.now() - i };
  }
  return seeded;
}

const state = {
  path: [],          // stack of nodes we've navigated into
  words: [],         // [{ icon, text, id }]
  spoken: false,     // the strip holds a finished sentence, already said aloud
  settings: { ...DEFAULT_SETTINGS, ...load(KEYS.settings, {}) },
  people: load(KEYS.people, DEFAULT_PEOPLE),
  phrases: loadPhrases(),
  custom: load(KEYS.custom, {}),
  editPhotos: false,
  screen: null,      // null | 'keyboard' | 'settings'
};

const $ = (id) => document.getElementById(id);
const els = {
  suggest: $('suggest'),
  backupInput: $('backup-input'),
  chips: $('chips'),
  speak: $('btn-speak'),
  undo: $('btn-undo'),
  clear: $('btn-clear'),
  back: $('btn-back'),
  home: $('btn-home'),
  keyboard: $('btn-keyboard'),
  find: $('btn-find'),
  settings: $('btn-settings'),
  crumb: $('crumb'),
  grid: $('grid'),
  rail: $('rail'),
  screen: $('screen'),
  editBanner: $('edit-banner'),
  editDone: $('btn-edit-done'),
  photoInput: $('photo-input'),
};

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

const sentence = () => state.words.map((w) => w.text).join(' ').trim();

function speakSentence() {
  const text = sentence();
  if (!text) return;
  say(text, state.settings);
  remember(text, state.words.map((w) => w.icon));
  // Leave the words on screen so the listener can still read them, but mark
  // the sentence finished: the next tile starts a new one. Without this every
  // single utterance costs an extra tap on Clear first, which is exactly the
  // overhead this is supposed to remove.
  state.spoken = true;
  renderStrip();
  renderSuggest();
}

/** Called before adding a word: retire a sentence that has already been said. */
function beginSentence() {
  if (!state.spoken) return;
  state.words = [];
  state.spoken = false;
}

function remember(text, icons) {
  const prev = state.phrases[text];
  state.phrases[text] = {
    icons: icons.filter(Boolean).slice(0, 3),
    count: (prev ? prev.count : 0) + 1,
    last: Date.now(),
  };
  // Cap the store by keeping what he actually says: count first, then recency.
  const entries = Object.entries(state.phrases);
  if (entries.length > MAX_PHRASES) {
    entries.sort(([, a], [, b]) => b.count - a.count || b.last - a.last);
    state.phrases = Object.fromEntries(entries.slice(0, MAX_PHRASES));
  }
  save(KEYS.phrases, state.phrases);
}

/** His phrases, most-said first; deterministic ties by recency then text. */
function phrasesRanked() {
  return Object.entries(state.phrases)
    .sort(([ta, a], [tb, b]) => b.count - a.count || b.last - a.last || ta.localeCompare(tb))
    .map(([text, v]) => ({ text, icons: v.icons || [] }));
}

// ---------------------------------------------------------------------------
// Tile building
// ---------------------------------------------------------------------------

/**
 * A tile, wrapped so a "sound it out" speaker can sit over its corner without
 * nesting one button inside another.
 *
 * He reads well enough but doesn't spell, so a word he half-recognises is a
 * real stall. The speaker reads the tile aloud on its own — it does not add
 * anything to the sentence — which turns "I think that says suction" into a
 * one-second check instead of a guess.
 */
function tileButton({ id, icon, label, color, ariaLabel, onActivate }) {
  const wrap = document.createElement('div');
  wrap.className = 'tile-wrap';

  const btn = document.createElement('button');
  btn.className = 'tile';
  btn.style.background = color || '#262D38';
  btn.setAttribute('aria-label', ariaLabel || label);
  btn.appendChild(mediaElement(id, icon));

  if (state.settings.showWords) {
    const span = document.createElement('span');
    span.className = 'tile-label';
    if (label.length > 20) span.classList.add('tile-label-long');
    span.textContent = label;
    btn.appendChild(span);
  }

  btn.addEventListener('click', () => {
    if (state.editPhotos && id) {
      choosePhotoFor(id);
      return;
    }
    onActivate();
  });
  wrap.appendChild(btn);

  if (state.editPhotos) {
    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = hasPhoto(id) ? '🖼️' : '📷';
    wrap.appendChild(badge);
  } else if (state.settings.soundItOut) {
    const hear = document.createElement('span');
    hear.className = 'tile-say';
    hear.setAttribute('role', 'button');
    hear.setAttribute('tabindex', '0');
    hear.setAttribute('aria-label', `Sound out: ${label}`);
    hear.textContent = '🔊';
    const speak = (e) => {
      e.stopPropagation();
      // Just the word, nothing added to the sentence and nothing remembered.
      say(label, state.settings);
    };
    hear.addEventListener('click', speak);
    hear.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') speak(e);
    });
    wrap.appendChild(hear);
  }

  return wrap;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function currentNode() {
  return state.path.length ? state.path[state.path.length - 1] : null;
}

/** His own tiles for a category, appended after the built-in ones. */
function customFor(categoryId) {
  return (state.custom[categoryId] || []).map((c) => ({
    id: `custom-${categoryId}-${slug(c.label)}`,
    icon: c.icon || '💬',
    label: c.label,
  }));
}

function currentTiles() {
  const node = currentNode();
  if (!node) return [...ROOT, ...customFor('home')];
  if (node.dynamic === 'people') {
    // A person is a screen, not a word: tapping a name opens what he might
    // want to say about them, so "Call my sister Tracey" is three taps rather
    // than a bare fragment. There are too many people for one screen now, so
    // they fold into Family / Friends / Neighbors; anyone without a group
    // (Amanda, and people added in Settings) sits beside the group tiles.
    const personNode = (p) => ({
      id: `person-${slug(p.label)}`,
      icon: p.icon,
      label: p.label,
      silent: true,
      color: node.color,
      children: personActions(p),
    });
    const groups = [
      ['family', '👨‍👩‍👧', 'Family'],
      ['friends', '🤝', 'Friends'],
      ['neighbors', '🏘️', 'Neighbors'],
    ]
      .map(([key, icon, label]) => {
        const members = state.people.filter((p) => p.group === key);
        if (!members.length) return null;
        return { id: `people-${key}`, icon, label, silent: true, color: node.color, children: members.map(personNode) };
      })
      .filter(Boolean);
    const ungrouped = state.people.filter((p) => !['family', 'friends', 'neighbors'].includes(p.group));
    return [...groups, ...ungrouped.map(personNode)];
  }
  if (node.dynamic === 'recents') {
    return phrasesRanked().slice(0, SHOWN).map((r, i) => ({
      id: `recent-${i}`,
      icon: (r.icons || []).join('') || '💬',
      label: r.text,
      replay: true,
    }));
  }
  const kids = (node.children || []).filter((c) => !c.gated || state.settings[c.gated] !== false);
  return [...kids, ...customFor(node.id)];
}

function onTile(node) {
  const parent = currentNode();

  // A recent phrase is already a finished sentence — replay it whole rather
  // than appending it to whatever is half-built.
  // An exclamation stands on its own: it replaces whatever was half-built
  // rather than becoming the tail of it, and speaks the moment it is tapped.
  if (node.alone) {
    const text = node.text ?? node.label;
    state.words = [{ icon: node.icon, text, id: node.id }];
    state.path = [];
    render();
    speakSentence();
    return;
  }

  if (node.replay) {
    state.words = [{ icon: node.icon, text: node.label, id: node.id }];
    state.path = [];
    state.spoken = true;
    say(node.label, state.settings);
    render();
    return;
  }

  const addition = node.silent ? null : node.text ?? node.label;
  if (addition) {
    beginSentence();
    state.words.push({ icon: node.icon, text: addition, id: node.id });
    if (state.settings.speakEachTap) say(addition, state.settings);
  }

  const deeper = node.kind === 'bodymap' || (node.children && node.children.length) || node.dynamic;
  if (deeper) {
    state.path.push(node);
    render();
    return;
  }

  // Leaf: the thought is finished. Return home so the next one starts from a
  // known place instead of wherever the last one happened to end.
  state.path = [];
  render();
  if (state.settings.autoSpeakOnFinish) speakSentence();
}

function renderBoard() {
  const node = currentNode();
  els.grid.innerHTML = '';

  if (node && node.kind === 'bodymap') {
    els.grid.className = 'grid grid-bodymap';
    const wrap = document.createElement('div');
    wrap.className = 'bodymap-wrap';
    wrap.appendChild(
      buildBodyMap((label) => {
        beginSentence();
        state.words.push({ icon: '📍', text: label, id: null });
        state.path = [];
        render();
        if (state.settings.autoSpeakOnFinish) speakSentence();
      })
    );
    els.grid.appendChild(wrap);

    const extras = document.createElement('div');
    extras.className = 'bodymap-extras';
    for (const part of EXTRA_PARTS) {
      extras.appendChild(
        tileButton({
          id: `part-${slug(part.label)}`,
          icon: part.icon,
          label: part.label,
          color: '#C62F35',
          ariaLabel: `It hurts ${part.label}`,
          onActivate: () => onTile({ id: part.label, icon: part.icon, label: part.label }),
        })
      );
    }
    els.grid.appendChild(extras);
    return;
  }

  const tiles = currentTiles();
  els.grid.className = 'grid';

  if (!tiles.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent =
      node && node.dynamic === 'recents'
        ? 'Nothing said yet. Things you say show up here.'
        : 'Nothing here yet. Add people in Settings.';
    els.grid.appendChild(empty);
    return;
  }

  for (const tile of tiles) {
    els.grid.appendChild(
      tileButton({
        id: tile.id,
        icon: tile.icon,
        label: tile.label,
        color: tile.color || (node && node.color) || '#262D38',
        onActivate: () => onTile(tile),
      })
    );
  }
}

function colsForWidth() {
  return window.innerWidth >= 820 ? 3 : 2;
}

/** Depth-first lookup of a vocabulary node by id, for rail shortcuts. */
function findNode(id, nodes = ROOT) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children && findNode(id, n.children);
    if (hit) return hit;
  }
  return null;
}

function renderRail() {
  els.rail.innerHTML = '';
  for (const q of QUICK) {
    if (q.gated && state.settings[q.gated] === false) continue;
    const btn = document.createElement('button');
    btn.className = 'quick';
    btn.style.background = q.color;
    btn.setAttribute('aria-label', q.text || q.label);
    const media = mediaElement(`quick-${slug(q.label)}`, q.icon);
    media.classList.add('quick-icon');
    btn.appendChild(media);
    const label = document.createElement('span');
    label.className = 'quick-label';
    label.textContent = q.label;
    btn.appendChild(label);
    // Quick words speak alone and never join the sentence being built —
    // "Stop" cannot wait for a sentence to be finished first. A `goto` entry
    // is the one exception: it navigates instead of speaking, and still
    // leaves the sentence untouched.
    btn.addEventListener('click', () => {
      if (q.goto) {
        const target = findNode(q.goto);
        if (target) {
          state.path = [target];
          render();
        }
        return;
      }
      say(q.text, state.settings);
      remember(q.text, [q.icon]);
    });
    els.rail.appendChild(btn);
  }
}

function renderStrip() {
  els.chips.innerHTML = '';
  if (!state.words.length) {
    const hint = document.createElement('span');
    hint.className = 'chips-hint';
    hint.textContent = 'Tap pictures to build a sentence';
    els.chips.appendChild(hint);
  } else {
    for (const w of state.words) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      // A sentence-length chip (the neck-breather alert) drops its font size
      // so the whole thing fits the strip; normal chips keep the big text.
      if (w.text.length > 48) chip.classList.add('chip-long');
      const icon = document.createElement('span');
      icon.className = 'chip-icon';
      icon.textContent = w.icon || '💬';
      chip.appendChild(icon);
      const text = document.createElement('span');
      text.className = 'chip-text';
      text.textContent = w.text;
      chip.appendChild(text);
      els.chips.appendChild(chip);
    }
    // Keep the newest chip in view when a long sentence wraps past the strip.
    els.chips.scrollTop = els.chips.scrollHeight;
  }

  // Fade a sentence that has already been said, so it reads as a record of
  // what was just spoken rather than something still being built.
  els.chips.classList.toggle('spoken', state.spoken && !!state.words.length);

  const empty = !state.words.length;
  els.speak.disabled = empty;
  els.undo.disabled = empty;
  els.clear.disabled = empty;
}

function renderNav() {
  const deep = state.path.length > 0;
  els.back.disabled = !deep;
  els.home.disabled = !deep;
  els.crumb.textContent = state.path.map((n) => n.label).join('  ›  ');
  els.editBanner.hidden = !state.editPhotos;
}

/**
 * The suggestion strip — the only adaptive surface on the board.
 *
 * Empty strip: his three most-said phrases, one tap each. Mid-sentence: any
 * stored phrase that begins with what he has built so far, offered whole.
 * Pure counts and exact prefix matching, so it is explainable and never
 * surprising; and it lives in this one fixed row so the tile grid never
 * reorders underneath his hands.
 */
function suggestionsFor() {
  const ranked = phrasesRanked();
  if (!state.words.length || state.spoken) return ranked.slice(0, 3);
  const prefix = sentence() + ' ';
  return ranked.filter((r) => r.text.startsWith(prefix)).slice(0, 3);
}

function renderSuggest() {
  const off = state.settings.suggestions === false || state.editPhotos;
  const list = off ? [] : suggestionsFor();
  els.suggest.innerHTML = '';
  els.suggest.hidden = !list.length;
  for (const r of list) {
    const btn = h('button', 'suggest-chip');
    btn.appendChild(h('span', 'suggest-icon', (r.icons || []).join('') || '💬'));
    btn.appendChild(h('span', 'suggest-text', r.text));
    btn.addEventListener('click', () => {
      state.words = [{ icon: (r.icons || [])[0] || '💬', text: r.text, id: null }];
      state.path = [];
      render();
      speakSentence();
    });
    els.suggest.appendChild(btn);
  }
}

function render() {
  renderStrip();
  renderNav();
  renderBoard();
  renderRail();
  renderSuggest();
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

let pendingPhotoId = null;

function choosePhotoFor(id) {
  if (hasPhoto(id)) {
    const remove = window.confirm('Remove this picture?\n\nOK removes it. Cancel lets you pick a different one.');
    if (remove) {
      clearPhoto(id);
      void deletePhoto(id);
      render();
      return;
    }
  }
  pendingPhotoId = id;
  els.photoInput.value = '';
  els.photoInput.click();
}

els.photoInput.addEventListener('change', async () => {
  const file = els.photoInput.files && els.photoInput.files[0];
  if (!file || !pendingPhotoId) return;
  const id = pendingPhotoId;
  pendingPhotoId = null;
  try {
    const dataUrl = await fileToTileImage(file);
    await putPhoto(id, dataUrl);
    setPhoto(id, dataUrl);
    render();
    if (state.screen === 'settings') renderSettings();
  } catch {
    window.alert('Could not use that picture. Try taking a new photo.');
  }
});

// ---------------------------------------------------------------------------
// Overlay screens
// ---------------------------------------------------------------------------

function openScreen(name) {
  state.screen = name;
  els.screen.hidden = false;
  document.getElementById('app').setAttribute('aria-hidden', 'true');
  // One history entry so Android's back gesture closes the overlay instead of
  // leaving the app entirely.
  history.pushState({ screen: name }, '');
  if (name === 'keyboard') renderKeyboard();
  else if (name === 'find') renderFind();
  else renderSettings();
}

function closeScreen({ fromPop = false } = {}) {
  if (!state.screen) return;
  state.screen = null;
  els.screen.hidden = true;
  els.screen.innerHTML = '';
  document.getElementById('app').removeAttribute('aria-hidden');
  if (!fromPop) history.back();
  render();
}

window.addEventListener('popstate', () => {
  if (state.screen) closeScreen({ fromPop: true });
});

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// --- Type to speak ---------------------------------------------------------

function renderKeyboard() {
  els.screen.innerHTML = '';
  const top = h('div', 'screen-top');
  const back = h('button', 'nav-btn', '⬅️ Back to pictures');
  back.addEventListener('click', () => closeScreen());
  top.appendChild(back);

  const speakBtn = h('button', 'act act-speak act-wide');
  speakBtn.appendChild(h('span', 'act-icon', '🔊'));
  speakBtn.appendChild(h('span', 'act-label', 'Say it'));
  top.appendChild(speakBtn);

  const clearBtn = h('button', 'nav-btn', 'Clear');
  top.appendChild(clearBtn);
  els.screen.appendChild(top);

  const area = h('textarea', 'type-area');
  area.placeholder = 'Type here';
  area.autocapitalize = 'sentences';
  els.screen.appendChild(area);

  // Word completion from his own corpus — the board's vocabulary plus
  // everything he has said or typed — matched forgivingly, so a phonetic
  // start still finds the word. No outside dictionary: deterministic, and it
  // only ever offers words that are already his.
  const typeSuggest = h('div', 'type-suggest');
  els.screen.appendChild(typeSuggest);

  const corpus = (() => {
    const words = new Set();
    const add = (s) => {
      for (const word of String(s).toLowerCase().split(/[^a-z']+/)) {
        if (word.length >= 3) words.add(word);
      }
    };
    const walk = (n) => {
      add(n.text ?? n.label);
      (n.children || []).forEach(walk);
    };
    ROOT.forEach(walk);
    for (const p of state.people) personActions(p).forEach((a) => add(a.label));
    Object.values(state.custom).flat().forEach((c) => add(c.label));
    Object.keys(state.phrases).forEach(add);
    return [...words].sort();
  })();

  const updateTypeSuggest = () => {
    typeSuggest.innerHTML = '';
    const m = /([a-zA-Z']+)$/.exec(area.value);
    const part = m ? m[1].toLowerCase() : '';
    if (part.length < 2) return;
    const starts = corpus.filter((word) => word.startsWith(part) && word !== part);
    const sounds = corpus.filter(
      (word) => !starts.includes(word) && word !== part && soundsLike(word).startsWith(soundsLike(part))
    );
    for (const word of [...starts, ...sounds].slice(0, 3)) {
      const chip = h('button', 'type-suggest-chip', word);
      chip.addEventListener('click', () => {
        area.value = area.value.slice(0, m.index) + word + ' ';
        typeSuggest.innerHTML = '';
        area.focus();
      });
      typeSuggest.appendChild(chip);
    }
  };
  area.addEventListener('input', updateTypeSuggest);

  // Worth saying out loud: spelling it the way it sounds still comes out
  // right, because the listener hears the sound, not the spelling.
  els.screen.appendChild(
    h('p', 'hint', 'Spell it however it sounds. The voice reads the sound, so it still comes out right.')
  );

  speakBtn.addEventListener('click', () => {
    const text = area.value.trim();
    if (!text) return;
    say(text, state.settings);
    remember(text, ['⌨️']);
  });
  clearBtn.addEventListener('click', () => {
    area.value = '';
    area.focus();
  });

  els.screen.appendChild(h('h2', 'section-title', 'Said before'));
  const chips = h('div', 'recent-row');
  const ranked = phrasesRanked().slice(0, SHOWN);
  for (const r of ranked) {
    const btn = h('button', 'recent-chip');
    btn.appendChild(h('span', 'recent-icon', (r.icons || []).join('') || '💬'));
    btn.appendChild(h('span', 'recent-text', r.text));
    btn.addEventListener('click', () => say(r.text, state.settings));
    chips.appendChild(btn);
  }
  if (!ranked.length) chips.appendChild(h('p', 'hint', 'Nothing yet.'));
  els.screen.appendChild(chips);

  setTimeout(() => area.focus(), 50);
}

// --- Find a word -----------------------------------------------------------

/**
 * Spelled-how-it-sounds normalization, so his spelling still finds things:
 * "no" matches "know", "sistr" matches "sister". Applied to both sides.
 */
function soundsLike(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/kn/g, 'n')
    .replace(/wr/g, 'r')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c/g, 'k')
    .replace(/(.)\1+/g, '$1');
}

const dropVowels = (s) => s.replace(/(?!^)[aeiou]/g, '');

/**
 * Every place on the board, flat: [{ node, path }] where path is the chain of
 * ancestor nodes to navigate to. Rebuilt per search, so custom words and
 * people are always current.
 */
function searchIndex() {
  const out = [];
  const walk = (node, path) => {
    out.push({ node, path });
    for (const c of node.children || []) walk(c, [...path, node]);
  };
  for (const n of ROOT) walk(n, []);
  for (const p of state.people) {
    const pn = { id: `person-${slug(p.label)}`, icon: p.icon, label: p.label, silent: true, children: personActions(p) };
    walk(pn, []);
  }
  for (const [cat, items] of Object.entries(state.custom)) {
    for (const c of items) out.push({ node: { id: `custom-${cat}-${slug(c.label)}`, icon: c.icon || '💬', label: c.label }, path: [] });
  }
  return out;
}

function matchesQuery(entry, q) {
  const hay = `${entry.node.label} ${entry.node.text || ''}`.toLowerCase();
  if (hay.includes(q.toLowerCase())) return true;
  const hs = soundsLike(hay);
  const qs = soundsLike(q);
  if (qs.length >= 2 && hs.includes(qs)) return true;
  return qs.length >= 3 && dropVowels(hs).includes(dropVowels(qs));
}

function renderFind() {
  els.screen.innerHTML = '';
  const top = h('div', 'screen-top');
  const back = h('button', 'nav-btn', '⬅️ Back to pictures');
  back.addEventListener('click', () => closeScreen());
  top.appendChild(back);
  top.appendChild(h('h1', 'screen-title', 'Find a word'));
  els.screen.appendChild(top);

  const input = h('input', 'find-input');
  input.placeholder = 'Spell it any way you like';
  input.autocapitalize = 'none';
  els.screen.appendChild(input);

  const results = h('div', 'find-results');
  els.screen.appendChild(results);

  const update = () => {
    results.innerHTML = '';
    const q = input.value.trim();
    if (q.length < 2) return;
    for (const entry of searchIndex().filter((e) => matchesQuery(e, q)).slice(0, 12)) {
      const btn = h('button', 'find-hit');
      btn.appendChild(h('span', 'recent-icon', entry.node.icon || '💬'));
      const wrap = h('span', 'find-hit-text');
      wrap.appendChild(h('span', 'recent-text', entry.node.label));
      const crumbs = entry.path.map((n) => n.label).join(' › ');
      if (crumbs) wrap.appendChild(h('span', 'find-hit-path', crumbs));
      btn.appendChild(wrap);
      // Navigate to where it lives rather than speaking it bare: leaves like
      // "sharp" only make sense after their category's opening words.
      btn.addEventListener('click', () => {
        state.path = entry.node.children || entry.node.dynamic ? [...entry.path, entry.node] : [...entry.path];
        closeScreen();
      });
      results.appendChild(btn);
    }
    if (!results.children.length) results.appendChild(h('p', 'hint', 'Nothing yet — keep typing, any spelling is fine.'));
  };
  input.addEventListener('input', update);
  setTimeout(() => input.focus(), 50);
}

// --- Settings --------------------------------------------------------------

function patch(next) {
  state.settings = { ...state.settings, ...next };
  save(KEYS.settings, state.settings);
}

function renderSettings() {
  els.screen.innerHTML = '';
  const top = h('div', 'screen-top');
  const done = h('button', 'nav-btn', '⬅️ Done');
  done.addEventListener('click', () => closeScreen());
  top.appendChild(done);
  top.appendChild(h('h1', 'screen-title', 'Settings'));
  els.screen.appendChild(top);

  // Voice ---------------------------------------------------------------
  const voice = section('Voice');
  voice.appendChild(
    stepper('Speed', state.settings.rate, 0.5, 1.6, 0.1, (rate) => {
      patch({ rate });
      say('This is how I sound', state.settings);
      renderSettings();
    })
  );
  voice.appendChild(
    stepper('Pitch', state.settings.pitch, 0.6, 1.6, 0.1, (pitch) => {
      patch({ pitch });
      say('This is how I sound', state.settings);
      renderSettings();
    })
  );

  const voices = getVoices();
  if (voices.length) {
    const list = h('div', 'chip-wrap');
    for (const v of voices.slice(0, 14)) {
      const btn = h('button', 'pick' + (state.settings.voiceURI === v.voiceURI ? ' pick-on' : ''), v.name);
      btn.addEventListener('click', () => {
        patch({ voiceURI: v.voiceURI });
        say('This is how I sound', state.settings);
        renderSettings();
      });
      list.appendChild(btn);
    }
    voice.appendChild(list);
  } else {
    voice.appendChild(h('p', 'hint', supported() ? 'Loading voices…' : 'This browser has no speech. Try Chrome or Safari.'));
  }
  els.screen.appendChild(voice);

  // Behaviour -----------------------------------------------------------
  const behave = section('How it works');
  behave.appendChild(toggle('Show words under the pictures', state.settings.showWords, (showWords) => {
    patch({ showWords });
    renderSettings();
    render();
  }));
  behave.appendChild(toggle('Suggest his usual phrases', state.settings.suggestions, (suggestions) => {
    patch({ suggestions });
    renderSettings();
    render();
  }));
  behave.appendChild(toggle('Show the strong words under "I feel"', state.settings.strongWords, (strongWords) => {
    patch({ strongWords });
    renderSettings();
    render();
  }));
  behave.appendChild(toggle('Show a 🔊 on each tile to sound the word out', state.settings.soundItOut, (soundItOut) => {
    patch({ soundItOut });
    renderSettings();
    render();
  }));
  behave.appendChild(toggle('Say each picture as it is tapped', state.settings.speakEachTap, (speakEachTap) => {
    patch({ speakEachTap });
    renderSettings();
  }));
  behave.appendChild(toggle('Say the whole sentence when it is finished', state.settings.autoSpeakOnFinish, (autoSpeakOnFinish) => {
    patch({ autoSpeakOnFinish });
    renderSettings();
  }));
  els.screen.appendChild(behave);

  // Pictures ------------------------------------------------------------
  const pics = section('Pictures');
  pics.appendChild(
    h('p', 'hint', 'Photos beat symbols. A real picture of someone is the easiest thing to recognise.')
  );
  const editBtn = h('button', 'big-btn', '📷  Change tile pictures');
  editBtn.addEventListener('click', () => {
    state.editPhotos = true;
    closeScreen();
  });
  pics.appendChild(editBtn);
  const count = symbolCount();
  pics.appendChild(
    h('p', 'hint', count ? `${count} symbol pictures installed.` : 'Symbol pack not installed — using emoji. See the README to add ARASAAC symbols.')
  );
  els.screen.appendChild(pics);

  // His own words -------------------------------------------------------
  const own = section('His own words');
  own.appendChild(
    h(
      'p',
      'hint',
      'Anything personal goes here and nowhere else: medicine names, his doctors, appointments. It is saved on this device only — never uploaded, and not part of the app itself.'
    )
  );
  own.appendChild(
    h('p', 'hint', 'Words are added onto the end of the category, so under "I want" type "my blue pill", not "I want my blue pill".')
  );

  const catRow = h('div', 'add-row');
  const catSelect = document.createElement('select');
  catSelect.className = 'name-input';
  catSelect.setAttribute('aria-label', 'Which screen to add it to');
  const categories = [{ id: 'home', label: 'Home screen' }, ...ROOT.map((n) => ({ id: n.id, label: n.label }))];
  for (const c of categories) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    catSelect.appendChild(opt);
  }
  catSelect.value = customCategory;
  catSelect.addEventListener('change', () => {
    customCategory = catSelect.value;
  });
  catRow.appendChild(catSelect);
  own.appendChild(catRow);

  const wordRow = h('div', 'add-row');
  const wIcon = h('input', 'icon-input');
  wIcon.value = '💬';
  wIcon.setAttribute('aria-label', 'Emoji for this tile');
  const wText = h('input', 'name-input');
  wText.placeholder = 'What it should say';
  wText.setAttribute('aria-label', 'What it should say');
  const wAdd = h('button', 'big-btn', 'Add word');
  const addWord = () => {
    const label = wText.value.trim();
    if (!label) return;
    const cat = catSelect.value;
    const next = { ...state.custom, [cat]: [...(state.custom[cat] || []), { icon: wIcon.value.trim() || '💬', label }] };
    state.custom = next;
    save(KEYS.custom, next);
    customCategory = cat;
    wText.value = '';
    wIcon.value = '💬';
    renderSettings();
    render();
  };
  wAdd.addEventListener('click', addWord);
  wText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWord();
  });
  wordRow.append(wIcon, wText, wAdd);
  own.appendChild(wordRow);

  for (const cat of categories) {
    const items = state.custom[cat.id] || [];
    if (!items.length) continue;
    own.appendChild(h('h3', 'sub-title', cat.label));
    for (const [i, item] of items.entries()) {
      const row = h('div', 'person-row');
      const id = `custom-${cat.id}-${slug(item.label)}`;
      const thumb = h('span', 'person-thumb');
      thumb.appendChild(mediaElement(id, item.icon));
      row.appendChild(thumb);
      row.appendChild(h('span', 'person-name', item.label));

      const photoBtn = h('button', 'small-btn', hasPhoto(id) ? 'Photo' : 'Add photo');
      photoBtn.addEventListener('click', () => choosePhotoFor(id));
      row.appendChild(photoBtn);

      const rm = h('button', 'small-btn small-danger', 'Remove');
      rm.addEventListener('click', () => {
        const next = { ...state.custom, [cat.id]: items.filter((_, idx) => idx !== i) };
        state.custom = next;
        save(KEYS.custom, next);
        renderSettings();
        render();
      });
      row.appendChild(rm);
      own.appendChild(row);
    }
  }
  els.screen.appendChild(own);

  // People --------------------------------------------------------------
  const ppl = section('People');
  const addRow = h('div', 'add-row');
  const iconInput = h('input', 'icon-input');
  iconInput.value = '🙂';
  iconInput.setAttribute('aria-label', 'Emoji for this person');
  const nameInput = h('input', 'name-input');
  nameInput.placeholder = 'Name, e.g. my wife';
  nameInput.setAttribute('aria-label', 'Name');
  const addBtn = h('button', 'big-btn', 'Add person');
  const addPerson = () => {
    const label = nameInput.value.trim();
    if (!label) return;
    state.people = [...state.people, { icon: iconInput.value.trim() || '🙂', label }];
    save(KEYS.people, state.people);
    nameInput.value = '';
    iconInput.value = '🙂';
    renderSettings();
  };
  addBtn.addEventListener('click', addPerson);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPerson();
  });
  addRow.append(iconInput, nameInput, addBtn);
  ppl.appendChild(addRow);

  for (const [i, p] of state.people.entries()) {
    const row = h('div', 'person-row');
    const id = `person-${slug(p.label)}`;
    const thumb = h('span', 'person-thumb');
    thumb.appendChild(mediaElement(id, p.icon));
    row.appendChild(thumb);
    row.appendChild(h('span', 'person-name', p.label));

    const photoBtn = h('button', 'small-btn', hasPhoto(id) ? 'Change photo' : 'Add photo');
    photoBtn.addEventListener('click', () => choosePhotoFor(id));
    row.appendChild(photoBtn);

    const rm = h('button', 'small-btn small-danger', 'Remove');
    rm.addEventListener('click', () => {
      state.people = state.people.filter((_, idx) => idx !== i);
      save(KEYS.people, state.people);
      renderSettings();
    });
    row.appendChild(rm);
    ppl.appendChild(row);
  }
  els.screen.appendChild(ppl);

  // Backup --------------------------------------------------------------
  const backup = section('Backup');
  backup.appendChild(
    h('p', 'hint', 'Saves everything on this device — photos, his own words, people, and what he says — as one file. Load it on the other device so the iPad and the phone match, and keep a copy in case a browser clears itself.')
  );
  const saveBtn = h('button', 'big-btn', '💾  Save a backup file');
  saveBtn.addEventListener('click', async () => {
    const photos = {};
    for (const [id, dataUrl] of await loadAllPhotos()) photos[id] = dataUrl;
    const payload = {
      app: 'stan',
      version: 1,
      saved: new Date().toISOString(),
      settings: state.settings,
      people: state.people,
      custom: state.custom,
      phrases: state.phrases,
      photos,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stan-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  backup.appendChild(saveBtn);
  const loadBtn = h('button', 'big-btn', '📂  Load a backup file');
  loadBtn.addEventListener('click', () => {
    els.backupInput.value = '';
    els.backupInput.click();
  });
  backup.appendChild(loadBtn);
  els.screen.appendChild(backup);

  // About ---------------------------------------------------------------
  const about = section('About');
  about.appendChild(h('p', 'hint', 'Everything is stored on this device. Nothing is sent anywhere, and it works with no signal.'));
  about.appendChild(h('p', 'hint', 'Add to Home Screen for a full-screen icon: Android — Chrome menu → Add to Home screen. iPad — Share button → Add to Home Screen.'));
  els.screen.appendChild(about);
}

function section(title) {
  const box = h('section', 'card');
  box.appendChild(h('h2', 'section-title', title));
  return box;
}

function toggle(label, value, onChange) {
  const row = h('label', 'row');
  row.appendChild(h('span', 'row-label', label));
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'switch';
  input.checked = Boolean(value);
  input.addEventListener('change', () => onChange(input.checked));
  row.appendChild(input);
  return row;
}

function stepper(label, value, min, max, step, onChange) {
  const row = h('div', 'row');
  row.appendChild(h('span', 'row-label', label));
  const group = h('div', 'stepper');
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v * 10) / 10));
  const minus = h('button', 'step', '−');
  minus.addEventListener('click', () => onChange(clamp(value - step)));
  const val = h('span', 'step-value', value.toFixed(1));
  const plus = h('button', 'step', '+');
  plus.addEventListener('click', () => onChange(clamp(value + step)));
  group.append(minus, val, plus);
  row.appendChild(group);
  return row;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Remembered between Settings repaints so adding several words in a row
 *  doesn't reset the category picker each time. */
let customCategory = 'home';

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

els.speak.addEventListener('click', speakSentence);
els.undo.addEventListener('click', () => {
  state.words.pop();
  // Undo means "I am still working on this one", so keep it editable.
  state.spoken = false;
  render();
});
els.clear.addEventListener('click', () => {
  hush();
  state.words = [];
  state.path = [];
  state.spoken = false;
  render();
});
els.back.addEventListener('click', () => {
  state.path.pop();
  render();
});
els.home.addEventListener('click', () => {
  state.path = [];
  render();
});
els.keyboard.addEventListener('click', () => openScreen('keyboard'));
els.find.addEventListener('click', () => openScreen('find'));
els.settings.addEventListener('click', () => openScreen('settings'));
els.editDone.addEventListener('click', () => {
  state.editPhotos = false;
  render();
});

// Restoring a backup replaces everything on this device, so it confirms first
// and reloads after, which re-reads every store from scratch.
els.backupInput.addEventListener('change', async () => {
  const file = els.backupInput.files && els.backupInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'stan' || typeof data !== 'object') throw new Error('not a Stan backup');
    if (!window.confirm('Load this backup? It replaces what is on this device.')) return;
    if (data.settings) save(KEYS.settings, { ...DEFAULT_SETTINGS, ...data.settings });
    if (Array.isArray(data.people)) save(KEYS.people, data.people);
    if (data.custom && typeof data.custom === 'object') save(KEYS.custom, data.custom);
    if (data.phrases && typeof data.phrases === 'object') save(KEYS.phrases, data.phrases);
    for (const [id, dataUrl] of Object.entries(data.photos || {})) {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) await putPhoto(id, dataUrl);
    }
    location.reload();
  } catch {
    window.alert('That file is not a Stan backup.');
  }
});

// iOS refuses to speak unless the first utterance happens inside a real user
// gesture, so prime it on the very first touch anywhere.
window.addEventListener('pointerdown', () => unlock(), { once: true });

// Voice lists arrive late on both platforms; repaint Settings when they do.
if (window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    refreshVoices();
    if (state.screen === 'settings') renderSettings();
  });
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 120);
});

async function start() {
  render();
  const [, photoMap] = await Promise.all([loadSymbolIndex(), loadAllPhotos()]);
  setPhotos(photoMap);
  render();

  if ('serviceWorker' in navigator) {
    // Relative path so this works from a GitHub Pages sub-path as well as a
    // domain root.
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  }
}

start();
