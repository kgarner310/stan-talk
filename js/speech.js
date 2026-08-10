/**
 * Speech via the browser's built-in synthesizer. No network, no account, no
 * per-word cost — the system voices on both Android and iOS work offline.
 *
 * Two platform quirks are handled here:
 *
 * - iOS Safari will not speak unless the *first* utterance of the session
 *   happens inside a real user gesture. Every call here originates from a tap,
 *   and `unlock()` primes it on the first touch as a belt-and-braces measure.
 * - Voice lists load asynchronously and start empty on both platforms, so we
 *   re-read them on the `voiceschanged` event rather than once at startup.
 */

const synth = window.speechSynthesis;
let voices = [];
let unlocked = false;

export function refreshVoices() {
  if (!synth) return [];
  voices = synth.getVoices().filter((v) => v.lang && v.lang.startsWith('en'));
  return voices;
}

export function getVoices() {
  return voices.length ? voices : refreshVoices();
}

if (synth) {
  refreshVoices();
  synth.addEventListener('voiceschanged', refreshVoices);
}

/** Call once from the first user gesture so iOS lets us speak later. */
export function unlock() {
  if (unlocked || !synth) return;
  unlocked = true;
  // A space, not an empty string: some iOS versions discard empty utterances
  // without counting them as the unlocking gesture.
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  try {
    synth.speak(u);
  } catch {
    /* nothing to do — speech simply stays unavailable */
  }
}

export function supported() {
  return Boolean(synth);
}

/**
 * Speak `text`, replacing anything already being spoken. Tapping a second
 * phrase mid-utterance should interrupt, not queue behind it — waiting for a
 * queue to drain is exactly the delay this app exists to remove.
 *
 * The interrupt path is deferred by a beat: iOS Safari sometimes discards an
 * utterance queued in the same tick as cancel(), which here would mean tapping
 * a second phrase and hearing nothing at all. The very first speak (nothing
 * playing) stays synchronous so it still lands inside the user gesture that
 * iOS requires. `seq` makes the latest tap win if several arrive inside the
 * deferral window.
 */
let seq = 0;

export function say(text, settings = {}) {
  if (!synth) return;
  const trimmed = String(text || '').trim();
  if (!trimmed) return;

  const wasBusy = synth.speaking || synth.pending;
  const id = ++seq;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(trimmed);
  u.rate = settings.rate ?? 1;
  u.pitch = settings.pitch ?? 1;
  u.lang = 'en-US';

  if (settings.voiceURI) {
    const match = getVoices().find((v) => v.voiceURI === settings.voiceURI);
    if (match) u.voice = match;
  }

  const go = () => {
    if (id !== seq) return; // a newer tap superseded this one
    // Chrome pauses the queue when a tab backgrounds and does not always
    // resume on its own; a resume() before speaking costs nothing and avoids
    // a silent app after the screen has been off.
    try {
      synth.resume();
    } catch {
      /* not fatal */
    }
    synth.speak(u);
  };

  if (wasBusy) setTimeout(go, 60);
  else go();
}

export function hush() {
  seq++; // also cancels any speak still waiting out its deferral
  if (synth) synth.cancel();
}
