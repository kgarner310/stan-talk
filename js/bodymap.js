/**
 * Pain diagram. Point at where it hurts instead of reading a list of body
 * parts — the one screen where a word list fails hardest for someone who
 * reads poorly, and the one where being slow does actual harm.
 *
 * Regions are deliberately chunky and non-overlapping. Precision is not the
 * goal; "somewhere in my chest" gets a nurse into the room, and the follow-up
 * questions can be asked out loud.
 */

const REGIONS = [
  { id: 'head', label: 'in my head', shape: 'ellipse', cx: 100, cy: 42, rx: 30, ry: 34 },
  { id: 'throat', label: 'in my throat', shape: 'rect', x: 84, y: 78, w: 32, h: 20 },
  { id: 'chest', label: 'in my chest', shape: 'rect', x: 60, y: 100, w: 80, h: 62 },
  { id: 'belly', label: 'in my stomach', shape: 'rect', x: 64, y: 164, w: 72, h: 58 },
  { id: 'armR', label: 'in my arm', shape: 'rect', x: 26, y: 102, w: 30, h: 132 },
  { id: 'armL', label: 'in my arm', shape: 'rect', x: 144, y: 102, w: 30, h: 132 },
  { id: 'legR', label: 'in my leg', shape: 'rect', x: 64, y: 226, w: 33, h: 160 },
  { id: 'legL', label: 'in my leg', shape: 'rect', x: 103, y: 226, w: 33, h: 160 },
];

/** Choices the front-on diagram can't show, offered as tiles beside it. */
export const EXTRA_PARTS = [
  { icon: '🔙', label: 'in my back' },
  { icon: '🦷', label: 'in my mouth' },
  { icon: '🌐', label: 'everywhere' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Build the diagram. `onPick(label)` fires with the sentence fragment, e.g.
 * "in my chest".
 */
export function buildBodyMap(onPick) {
  const svg = el('svg', {
    viewBox: '0 0 200 396',
    class: 'bodymap',
    role: 'group',
    'aria-label': 'Point to where it hurts',
  });

  for (const r of REGIONS) {
    const node =
      r.shape === 'ellipse'
        ? el('ellipse', { cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry })
        : el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 14 });

    node.setAttribute('class', 'region');
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `It hurts ${r.label}`);

    const pick = () => {
      node.classList.add('picked');
      // Let the fill land before the screen changes, so the tap is visibly
      // acknowledged even when speech is slow to start.
      setTimeout(() => onPick(r.label), 120);
    };

    node.addEventListener('click', pick);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });

    svg.appendChild(node);
  }

  return svg;
}
