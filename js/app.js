import { ROOT, QUICK, DEFAULT_PEOPLE, personActions } from './vocabulary.js';
import { say, hush, unlock, getVoices, refreshVoices, supported } from './speech.js';
import { load, save, KEYS, DEFAULT_SETTINGS } from './storage.js';
import { buildBodyMap, EXTRA_PARTS } from './bodymap.js';
import { loadSymbolIndex, mediaElement, setPhotos, setPhoto, clearPhoto, hasPhoto, symbolCount } from './images.js';
import { loadAllPhotos, putPhoto, deletePhoto, fileToTileImage } from './photos.js';

const MAX_RECENTS = 12;

const state = {
  path: [],          // stack of nodes we've navigated into
  words: [],         // [{ icon, text, id }]
  spoken: false,     // the strip holds a finished sentence, already said aloud
  settings: { ...DEFAULT_SETTINGS, ...load(KEYS.settings, {}) },
  people: load(KEYS.people, DEFAULT_PEOPLE),
  recents: load(KEYS.recents, []),
  custom: load(KEYS.custom, {}),
  editPhotos: false,
  screen: null,      // null | 'keyboard' | 'settings'
};

const $ = (id) => document.getElementById(id);
const els = {
  chips: $('chips'),
  speak: $('btn-speak'),
  undo: $('btn-undo'),
  clear: $('btn-clear'),
  back: $('btn-back'),
  home: $('btn-home'),
  keyboard: $('btn-keyboard'),
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
}

/** Called before adding a word: retire a sentence that has already been said. */
function beginSentence() {
  if (!state.spoken) return;
  state.words = [];
  state.spoken = false;
}

function remember(text, icons) {
  const next = [{ text, icons: icons.filter(Boolean).slice(0, 3) }, ...state.recents.filter((r) => r.text !== text)];
  state.recents = next.slice(0, MAX_RECENTS);
  save(KEYS.recents, state.recents);
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
    // than a bare fragment.
    return state.people.map((p) => ({
      id: `person-${slug(p.label)}`,
      icon: p.icon,
      label: p.label,
      silent: true,
      color: node.color,
      children: personActions(p),
    }));
  }
  if (node.dynamic === 'recents') {
    return state.recents.map((r, i) => ({
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

function renderRail() {
  els.rail.innerHTML = '';
  for (const q of QUICK) {
    const btn = document.createElement('button');
    btn.className = 'quick';
    btn.style.background = q.color;
    btn.setAttribute('aria-label', q.text);
    const media = mediaElement(`quick-${slug(q.label)}`, q.icon);
    media.classList.add('quick-icon');
    btn.appendChild(media);
    const label = document.createElement('span');
    label.className = 'quick-label';
    label.textContent = q.label;
    btn.appendChild(label);
    // Quick words speak alone and never join the sentence being built —
    // "Stop" cannot wait for a sentence to be finished first.
    btn.addEventListener('click', () => {
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

function render() {
  renderStrip();
  renderNav();
  renderBoard();
  renderRail();
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
  for (const r of state.recents) {
    const btn = h('button', 'recent-chip');
    btn.appendChild(h('span', 'recent-icon', (r.icons || []).join('') || '💬'));
    btn.appendChild(h('span', 'recent-text', r.text));
    btn.addEventListener('click', () => say(r.text, state.settings));
    chips.appendChild(btn);
  }
  if (!state.recents.length) chips.appendChild(h('p', 'hint', 'Nothing yet.'));
  els.screen.appendChild(chips);

  setTimeout(() => area.focus(), 50);
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
els.settings.addEventListener('click', () => openScreen('settings'));
els.editDone.addEventListener('click', () => {
  state.editPhotos = false;
  render();
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
