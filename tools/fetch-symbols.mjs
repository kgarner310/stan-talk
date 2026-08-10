/**
 * Downloads ARASAAC pictograms for every tile in the vocabulary.
 *
 *   node tools/fetch-symbols.mjs            # fill in anything missing
 *   node tools/fetch-symbols.mjs --force    # re-download everything
 *   node tools/fetch-symbols.mjs --only water,coffee
 *
 * ARASAAC pictograms are purpose-built AAC symbols — far clearer than emoji
 * for someone who reads poorly, and identical on every device instead of
 * changing between Android and Apple. They are free under CC BY-NC-SA 4.0
 * (author Sergio Palao, origin ARASAAC, owned by the Government of Aragón),
 * which covers personal use like this. See symbols/ATTRIBUTION.md.
 *
 * This must be run on a machine with open internet — it cannot run inside a
 * sandbox that blocks arasaac.org. The app works on emoji until it has been
 * run, and picks the symbols up automatically once symbols/index.json exists.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT, QUICK } from '../js/vocabulary.js';
import { EXTRA_PARTS } from '../js/bodymap.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'symbols');

const API_BASES = ['https://api.arasaac.org/v1', 'https://api.arasaac.org/api'];
const RESOLUTION = 300;
const PAUSE_MS = 120;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i === -1 ? null : new Set(args[i + 1].split(','));
})();

/**
 * Search terms for tiles whose wording makes a poor query. ARASAAC matches on
 * single concrete concepts, so phrases and comparisons need a hand.
 */
const QUERY_OVERRIDES = {
  'i-want': 'want',
  'i-feel': 'feel',
  'it-hurts': 'pain',
  'i-want-to-ask': 'ask',
  please: 'please',
  talking: 'talk',
  people: 'people',
  when: 'time',
  'said-before': 'repeat',
  'the-bathroom': 'toilet',
  'to-be-alone-for-a-while': 'alone',
  'you-to-stay': 'stay',
  'my-medicine': 'medicine',
  'something-to-eat': 'eat',
  'something-soft': 'pudding',
  'real-food': 'meal',
  'a-little-not-a-lot': 'little',
  'to-wait-until-later': 'wait',
  'nothing-right-now': 'nothing',
  'sick-to-my-stomach': 'nausea',
  'wide-awake': 'awake',
  'better-than-yesterday': 'better',
  'worse-than-yesterday': 'worse',
  'about-the-same': 'equal',
  'better-than-this-morning': 'better',
  'worse-than-this-morning': 'worse',
  'like-something-changed': 'change',
  'fine-really': 'fine',
  'like-i-need-a-minute': 'wait',
  'like-myself-today': 'happy',
  'not-right-and-i-cannot-explain-it': 'confused',
  'the-worst-it-has-been': 'very bad',
  'worse-than-before': 'worse',
  'but-i-can-handle-it': 'okay',
  'dull-and-constant': 'ache',
  'pins-and-needles': 'tingle',
  'when-i-move': 'move',
  'when-i-breathe': 'breathe',
  'when-you-touch-it': 'touch',
  'and-i-need-something-for-it-now': 'painkiller',
  'and-the-medicine-is-not-working': 'medicine',
  'but-it-is-getting-better': 'better',
  'i-cannot-breathe-well': 'breathe',
  'what-time-is-it': 'clock',
  'what-is-going-on': 'what',
  'what-did-the-doctor-say': 'doctor',
  'am-i-okay': 'okay',
  'is-it-serious': 'serious',
  'can-you-say-that-again': 'repeat',
  'did-you-understand-me': 'understand',
  'get-someone-who-can-help': 'help',
  'raise-the-bed': 'bed up',
  'lower-the-bed': 'bed down',
  'fix-my-pillow': 'pillow',
  'straighten-my-blanket': 'blanket',
  'help-me-sit-up': 'sit',
  'suction-me': 'suction',
  'check-that-line': 'tube',
  'come-here': 'come',
  'wait-a-second': 'wait',
  'slow-down': 'slow',
  'give-me-a-minute': 'wait',
  'write-that-down-for-me': 'write',
  'let-me-finish': 'talk',
  'do-not-touch-that': 'do not touch',
  'i-am-glad-you-came': 'happy',
  'how-are-you': 'how are you',
  'i-am-listening': 'listen',
  'that-is-funny': 'laugh',
  'i-missed-you': 'miss',
  'never-mind-it-is-not-important': 'never mind',
  'right-now-please': 'now',
  'in-a-minute': 'minute',
  'in-five-minutes': 'five minutes',
  'take-your-time': 'slow',
  'not-yet': 'no',
  'my-board-and-marker': 'whiteboard',
  'another-pillow': 'pillow',
  'the-light-on': 'light on',
  'the-light-off': 'light off',
  'the-tv-on': 'television',
  'the-tv-off': 'television off',
  'it-quieter': 'quiet',
  'it-louder': 'loud',
  'the-door-closed': 'close door',
  'the-door-open': 'open door',
  'the-window-open': 'window',
  'you-to-move-my-legs': 'leg',
  'you-to-move-my-arm': 'arm',
  'you-to-help-me-up': 'help',
  'to-go-back-to-bed': 'bed',
  'to-turn-over': 'turn',
  'something-cold': 'cold drink',
  'something-warm': 'warm drink',
  'ice-chips': 'ice',
  'quick-dont-get-it': 'confused',
  'quick-cannot-breathe': 'cannot breathe',

  // Laryngectomy, feeding tube, radiation, and medicines vocabulary.
  'neck-alert': 'tracheostomy',
  'my-stoma-is-blocked': 'blocked',
  'i-need-suction': 'suction',
  feed: 'feeding tube',
  'feed-time': 'feeding',
  'feed-how': 'stomach',
  'it-is-time-for-my-feed': 'feeding',
  'i-am-ready-for-my-feed': 'ready',
  'can-we-do-the-feed-later': 'later',
  'please-go-slower': 'slow',
  'i-need-my-water-flush': 'syringe',
  'i-need-my-extra-water': 'water',
  'i-need-my-protein-drink': 'milkshake',
  'that-is-enough': 'enough',
  'i-finished-it-all': 'finished',
  'i-feel-full': 'full',
  'i-feel-sick': 'nausea',
  'i-have-cramps': 'stomach ache',
  'i-am-bloated': 'swollen',
  'it-is-coming-back-up': 'vomit',
  'i-am-still-hungry': 'hungry',
  'i-am-thirsty': 'thirsty',
  'that-went-down-fine': 'good',
  'my-tube-is-blocked': 'blocked',
  'my-feeding-tube-came-out': 'feeding tube',
  'the-skin-around-my-tube-is-sore': 'skin',
  'it-is-leaking-around-the-tube': 'leak',
  'am-i-allowed-anything-by-mouth-yet': 'eat',
  'want-mouth': 'mouth',
  'something-for-my-dry-mouth': 'dry mouth',
  'a-mouth-swab': 'cotton swab',
  'lip-balm': 'lip balm',
  'to-rinse-my-mouth': 'mouthwash',
  'my-mouth-cleaned': 'toothbrush',
  'ice-chips-if-i-am-allowed': 'ice',
  'to-know-if-i-can-have-anything-by-mouth-yet': 'question',
  'want-meds': 'medicine',
  'my-pain-medicine': 'painkiller',
  'something-for-feeling-sick': 'nausea',
  'my-stool-softener': 'laxative',
  'something-for-the-fever': 'thermometer',
  'to-skip-the-strong-one-this-time': 'no',
  'to-know-when-my-next-dose-is': 'clock',
  'neck-radiation': 'radiotherapy',
  'i-am-too-tired-for-this': 'tired',
  'my-skin-is-burning': 'burn',
  'my-neck-is-sore-from-the-radiation': 'neck pain',
  'i-need-my-skin-cream': 'cream',
  'my-mouth-is-dry-from-the-radiation': 'dry mouth',
  'everything-tastes-wrong': 'taste',
  'it-is-worse-today': 'worse',
  'how-many-treatments-are-left': 'how many',
  'neck-drain': 'drainage',
  'my-drain-hurts': 'pain',
  'my-drain-is-full': 'full',
  'my-drain-is-leaking': 'leak',
  'my-drain-came-out': 'tube',
  'when-does-the-drain-come-out': 'when',
  constipated: 'constipation',
  'like-i-have-a-fever': 'fever',
  'like-my-mouth-is-very-dry': 'dry mouth',
  'do-when': 'time',
  'do-it-now': 'now',
  'do-it-right-now': 'now',
  'come-back-in-a-minute': 'wait',
  'come-back-in-five-minutes': 'five minutes',
  'do-it-later': 'later',
  'leave-it-until-tonight': 'night',
  'leave-it-until-tomorrow': 'tomorrow',
};

/** Walk the whole vocabulary and collect every tile that can show a picture. */
function collectTiles() {
  const out = new Map();

  const visit = (node, inherited) => {
    if (node.id && node.label) out.set(node.id, node.label);
    for (const child of node.children || []) visit(child, inherited);
  };

  for (const node of ROOT) visit(node);
  for (const q of QUICK) out.set(`quick-${slug(q.label)}`, q.label);
  for (const p of EXTRA_PARTS) out.set(`part-${slug(p.label)}`, p.label);
  return out;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

function queryFor(id, label) {
  if (QUERY_OVERRIDES[id]) return QUERY_OVERRIDES[id];
  // Strip leading function words that only ever dilute the search.
  return label
    .toLowerCase()
    .replace(/[?.,!]/g, '')
    .replace(/^(i|to|the|a|an|in|my|you|it|and|but|is|am|can|did|what|when|where)\s+/g, '')
    .trim();
}

async function search(term) {
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}/pictograms/en/search/${encodeURIComponent(term)}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) continue;
      const list = await res.json();
      if (Array.isArray(list) && list.length) return list[0]._id ?? list[0].id ?? null;
    } catch {
      /* try the next base */
    }
  }
  return null;
}

async function download(id) {
  const url = `https://static.arasaac.org/pictograms/${id}/${id}_${RESOLUTION}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT, { recursive: true });

  const tiles = collectTiles();
  const indexPath = join(OUT, 'index.json');
  const existing = existsSync(indexPath) ? JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(indexPath, 'utf8'))) : { files: {} };
  const files = FORCE ? {} : { ...existing.files };

  let done = 0;
  let missed = 0;

  for (const [id, label] of tiles) {
    if (ONLY && !ONLY.has(id)) continue;
    if (files[id] && existsSync(join(OUT, files[id]))) continue;

    const term = queryFor(id, label);
    process.stdout.write(`  ${id.padEnd(38)} "${term}" … `);

    try {
      const picto = await search(term);
      if (!picto) {
        console.log('no match (keeps emoji)');
        missed++;
        await sleep(PAUSE_MS);
        continue;
      }
      const png = await download(picto);
      const name = `${id}.png`;
      writeFileSync(join(OUT, name), png);
      files[id] = name;
      done++;
      console.log(`#${picto} ✓`);
    } catch (err) {
      console.log(`failed (${err.message}) — keeps emoji`);
      missed++;
    }
    await sleep(PAUSE_MS);
  }

  writeFileSync(
    indexPath,
    JSON.stringify(
      {
        source: 'ARASAAC',
        license: 'CC BY-NC-SA 4.0',
        attribution:
          'Pictograms author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). Owner: Government of Aragón. Licence: CC BY-NC-SA 4.0.',
        generated: new Date().toISOString(),
        files,
      },
      null,
      2
    ) + '\n'
  );

  writeFileSync(
    join(OUT, 'ATTRIBUTION.md'),
    [
      '# Symbol attribution',
      '',
      'The pictograms in this folder come from ARASAAC and are used under',
      'Creative Commons BY-NC-SA 4.0.',
      '',
      '- Author: Sergio Palao',
      '- Origin: ARASAAC (https://arasaac.org)',
      '- Owner: Government of Aragón',
      '- Licence: https://creativecommons.org/licenses/by-nc-sa/4.0/',
      '',
      'Non-commercial use only. Personal use on a communication device is',
      'covered; selling this app is not.',
      '',
      'Regenerate with `npm run symbols`.',
      '',
    ].join('\n')
  );

  console.log(`\n${done} symbols downloaded, ${missed} left on emoji, ${Object.keys(files).length} total.`);
  console.log('Bump CACHE_VERSION in sw.js so devices pick up the new pictures.');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  console.error('If this is a network block, run it from a machine with open internet.');
  process.exit(1);
});
