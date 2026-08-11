/**
 * Behavioural smoke test.
 *
 *   npm run test          (needs: npm i -D playwright)
 *
 * These are the rules that are easy to break by accident and hard to notice
 * by eye — especially the sentence-lifecycle ones, where a regression means
 * every utterance silently costs an extra tap.
 *
 * Starts its own server, so nothing needs to be running first.
 */

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8199;
const URL = `http://localhost:${PORT}/`;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed.  npm i -D playwright  (then rerun)');
  process.exit(1);
}

const server = spawn(process.execPath, [join(HERE, 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
const stop = () => server.kill();
process.on('exit', stop);

await new Promise((r) => setTimeout(r, 700));

const results = [];
const errors = [];
const check = (name, actual, expected) => {
  const ok = String(actual) === String(expected);
  results.push({ ok, name, actual, expected });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`         got:  ${actual}\n         want: ${expected}`);
};

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}
);

try {
  for (const [name, viewport] of [
    ['iPad landscape', { width: 1194, height: 834 }],
    ['phone portrait', { width: 412, height: 915 }],
  ]) {
    console.log(`\n${name}`);
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const strip = () => page.locator('#chips').innerText().then((t) => t.replace(/\s+/g, ' ').trim());
    const tap = async (label) => {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForTimeout(140);
    };

    await tap('I want');
    await tap('my medicines');
    await tap('my pain medicine');
    check(`${name}: builds a sentence`, await strip(), '🙋 I want 💊 my pain medicine');

    // Red flags must be reachable in one tap from their category, not buried
    // in a subgroup: a tube that has come out needs a nurse now.
    for (const [category, phrase] of [
      ['My feeding tube', 'My feeding tube came out'],
      ['My feeding tube', 'My tube is blocked'],
      ['My neck', 'My stoma is bleeding'],
    ]) {
      await tap(category);
      const oneTap = await page.getByRole('button', { name: phrase, exact: true }).count();
      check(`${name}: "${phrase}" is one tap inside ${category}`, oneTap, 1);
      await page.getByRole('button', { name: '🏠 Home' }).click();
      await page.waitForTimeout(120);
    }
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);

    // The one that matters most: a finished sentence must not become the
    // prefix of the next thought.
    await tap('I feel');
    check(`${name}: next tap starts a new sentence`, await strip(), '❤️ I feel');

    await tap('in my head');
    await tap('frustrated');
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.waitForTimeout(140);
    await tap('It hurts');
    check(`${name}: undo resumes editing`, await strip(), '❤️ I feel 🤕 It hurts');

    // Sounding a word out is a reading aid, not an input: it must leave both
    // the sentence and the current screen exactly as they were.
    const before = await strip();
    const crumbBefore = await page.locator('#crumb').innerText();
    await page.locator('#grid .tile-say').first().click();
    await page.waitForTimeout(160);
    check(`${name}: sound-it-out leaves the sentence alone`, await strip(), before);
    check(`${name}: sound-it-out does not navigate`, await page.locator('#crumb').innerText(), crumbBefore);

    // Quick words speak alone; they must never join the sentence.
    await page.getByRole('button', { name: 'I need help' }).click();
    await page.waitForTimeout(140);
    check(`${name}: quick word leaves the strip alone`, await strip(), '❤️ I feel 🤕 It hurts');

    // Add a third chip via the body diagram, so the sentence is long enough to
    // overflow a phone-width strip — the visibility check is toothless otherwise.
    await tap('here');
    await page.getByRole('button', { name: 'It hurts in my chest' }).click();
    await page.waitForTimeout(200);
    check(`${name}: body diagram adds to the sentence`, await strip(), '❤️ I feel 🤕 It hurts 📍 in my chest');

    // The whole sentence must be VISIBLE, not merely present in the DOM. A
    // strip that scrolls to the newest chip hides the start of the sentence on
    // a narrow screen, which is the part he reads back to check himself.
    const chipsInBounds = () =>
      page.evaluate(() => {
        const box = document.getElementById('chips').getBoundingClientRect();
        return [...document.querySelectorAll('#chips .chip')].every((c) => {
          const r = c.getBoundingClientRect();
          return r.left >= box.left - 1 && r.right <= box.right + 1 &&
                 r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
        });
      });
    check(`${name}: whole sentence stays visible`, await chipsInBounds(), true);

    // The neck-breather alert is one very long chip — the sentence a stranger
    // must be able to READ after it is spoken. It has to wrap inside the strip
    // rather than being clipped by it.
    await tap('My neck');
    await tap('I am a neck breather');
    check(`${name}: the neck-breather alert stays readable`, await chipsInBounds(), true);

    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);
    check(`${name}: clear empties the strip`, await strip(), 'Tap pictures to build a sentence');

    // A person opens their own screen; nobody is offered "Is Bandy coming?"
    // about someone who died.
    await tap('People');
    await tap('Family');
    await tap('Tracey');
    check(`${name}: a person opens their phrases`, await page.getByRole('button', { name: 'Call my sister Tracey', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Call my sister Tracey', exact: true }).click();
    await page.waitForTimeout(200);
    check(`${name}: person phrase speaks in full`, await strip(), '📞 Call my sister Tracey');
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);
    await tap('People');
    await tap('Family');
    await tap('Bandy');
    const bandy = await page.locator('#grid .tile .tile-label').allInnerTexts();
    check(`${name}: no "coming" phrase for someone who died`, bandy.some((t) => /coming|Call/.test(t)), false);
    // They had parted ways before she passed — remembering stays light, and
    // the board must not put "I miss" or "I wish" in his mouth about her.
    check(`${name}: Bandy's screen stays light`, bandy.some((t) => /miss|wish/.test(t)), false);
    check(`${name}: Bandy can still be brought up`, bandy.includes('I was thinking about Bandy'), true);
    await page.getByRole('button', { name: '🏠 Home' }).click();
    await page.waitForTimeout(140);
    // His son gets the full remembering screen.
    await tap('People');
    await tap('Family');
    await tap('Eric');
    const eric = await page.locator('#grid .tile .tile-label').allInnerTexts();
    check(`${name}: Eric has the full remembering screen`, eric.includes('I miss Eric') && eric.includes('I wish Eric was here'), true);
    check(`${name}: no "coming" or "call" phrases for Eric`, eric.some((t) => /coming|Call/.test(t)), false);
    await page.getByRole('button', { name: '🏠 Home' }).click();
    await page.waitForTimeout(140);

    // The rest of his world: friends and neighbors grouped, his errands under
    // "I want", and his work stories under Talking.
    await tap('People');
    await tap('Friends');
    check(`${name}: friends are grouped`, await page.getByRole('button', { name: 'Kyle', exact: true }).count(), 1);
    await page.getByRole('button', { name: '🏠 Home' }).click();
    await page.waitForTimeout(140);
    await tap('People');
    await tap('Neighbors');
    check(`${name}: neighbors are grouped`, await page.getByRole('button', { name: 'Dnasia', exact: true }).count(), 1);
    await page.getByRole('button', { name: '🏠 Home' }).click();
    await page.waitForTimeout(140);
    await tap('I want');
    await tap('to go somewhere');
    await tap('Food Lion');
    check(`${name}: errands compose`, await strip(), '🙋 I want 🛒 to go to Food Lion');
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);
    await tap('Talking');
    await tap('my stories');
    await tap('I worked on oil rigs in the Gulf');
    check(`${name}: his stories speak whole`, await strip(), '🛢️ I worked on oil rigs in the Gulf');
    // A story is a leaf: speaking it already returned the board home.
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);

    // The rail's 🤬 is a door: one tap from anywhere to the strong words,
    // without touching whatever sentence is in progress.
    await tap('I want');
    const midSentence = await strip();
    await page.getByRole('button', { name: 'Strong words', exact: true }).click();
    await page.waitForTimeout(200);
    check(`${name}: rail shortcut opens strong words`, await page.getByRole('button', { name: 'Bullshit', exact: true }).count(), 1);
    check(`${name}: rail shortcut leaves the sentence alone`, await strip(), midSentence);
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);

    // Swearing is his vocabulary and speaks as itself — "Bullshit", not "I feel
    // Bullshit" — and the switch that hides it must not shift any tile above it.
    await tap('I feel');
    const feelTilesWith = await page.locator('#grid .tile').count();
    await tap('strong words');
    check(`${name}: strong words are reachable`, await page.getByRole('button', { name: 'Bullshit', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Bullshit', exact: true }).click();
    await page.waitForTimeout(200);
    check(`${name}: swearing speaks as itself`, await strip(), '🐂 This is bullshit');
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(140);

    // Hiding it removes exactly one tile, and it is the last one.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('stan.settings.v1') || '{}');
      localStorage.setItem('stan.settings.v1', JSON.stringify({ ...s, strongWords: false }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await tap('I feel');
    check(`${name}: hiding strong words drops exactly one tile`, await page.locator('#grid .tile').count(), feelTilesWith - 1);
    check(`${name}: first tile under "I feel" is unmoved`, await page.locator('#grid .tile .tile-label').first().innerText(), 'in my body');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('stan.settings.v1') || '{}');
      localStorage.setItem('stan.settings.v1', JSON.stringify({ ...s, strongWords: true }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // Clear also returns to the root, so the board below is the home grid.
    // Every tile needs a picture — a text-only tile is a reading test.
    const missing = await page.$$eval('#grid .tile', (tiles) =>
      tiles.filter((t) => !t.querySelector('.tile-emoji, .tile-img')).length
    );
    check(`${name}: every tile has a picture`, missing, 0);

    // His own words carry everything personal — drug names, clinicians — so
    // they must survive a reload. If they don't, the privacy design has simply
    // thrown his vocabulary away.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(300);
    await page.selectOption('select.name-input', 'want');
    await page.locator('.card input.name-input[placeholder="What it should say"]').fill('my blue pill');
    await page.getByRole('button', { name: 'Add word', exact: true }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '⬅️ Done' }).click();
    await page.waitForTimeout(200);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await tap('I want');
    const survived = await page.getByRole('button', { name: 'my blue pill', exact: true }).count();
    check(`${name}: his own words survive a reload`, survived, 1);

    await page.getByRole('button', { name: 'my blue pill', exact: true }).click();
    await page.waitForTimeout(200);
    check(`${name}: his own words build a sentence`, await strip(), '🙋 I want 💬 my blue pill');

    await page.close();
  }
} finally {
  await browser.close();
  stop();
}

const failed = results.filter((r) => !r.ok).length;
if (errors.length) console.log('\nPage errors:\n' + errors.join('\n'));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed || errors.length ? 1 : 0);
