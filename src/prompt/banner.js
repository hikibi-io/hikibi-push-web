// The in-page banner that asks a visitor to turn on notifications. It lives
// in a shadow root, so the host page's CSS cannot restyle it and its CSS
// cannot leak into the page. Every control is our own element: no native
// dialogs, and the close button explains itself with a styled tooltip.

const BELL =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>';
const X =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

const CSS = `
:host { all: initial; }
.wrap {
  --accent: #2563eb; --accent-ink: #fff;
  --bg: #fff; --fg: #1f2328; --muted: #57606a; --line: rgba(31,35,40,.12);
  --hover: rgba(31,35,40,.06); --tip-bg: #1f2328; --tip-fg: #fff;
  position: fixed; z-index: var(--z, 2147483000); box-sizing: border-box;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial,
    "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", "Malgun Gothic", sans-serif;
  color: var(--fg); background: var(--bg);
  box-shadow: 0 8px 24px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08);
  animation: in .22s ease-out;
}
.wrap.dark {
  --bg: #1f2329; --fg: #e6edf3; --muted: #9da7b3; --line: rgba(230,237,243,.14);
  --hover: rgba(230,237,243,.08); --tip-bg: #e6edf3; --tip-fg: #1f2329;
}
@media (prefers-color-scheme: dark) {
  .wrap.auto {
    --bg: #1f2329; --fg: #e6edf3; --muted: #9da7b3; --line: rgba(230,237,243,.14);
    --hover: rgba(230,237,243,.08); --tip-bg: #e6edf3; --tip-fg: #1f2329;
  }
}
*, *::before, *::after { box-sizing: border-box; }
.bar { left: 0; right: 0; border-bottom: 1px solid var(--line); }
.bar.top { top: 0; }
.bar.bottom { bottom: 0; border-bottom: 0; border-top: 1px solid var(--line); --dir: 1; }
.bar .inner {
  max-width: 1080px; margin: 0 auto; padding: 10px 12px 10px 16px;
  display: flex; align-items: center; gap: 12px;
}
.card {
  width: min(380px, calc(100vw - 32px)); border-radius: 12px; border: 1px solid var(--line);
}
.card .inner { padding: 16px; display: grid; grid-template-columns: auto 1fr auto; gap: 4px 12px; align-items: start; }
.card.top-right { top: 16px; right: 16px; }
.card.top-left { top: 16px; left: 16px; }
.card.bottom-right { bottom: 16px; right: 16px; --dir: 1; }
.card.bottom-left { bottom: 16px; left: 16px; --dir: 1; }
.icon {
  flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.icon img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: block; }
.text { flex: 1; min-width: 0; }
.title { font-weight: 600; margin: 0; font-size: 14px; }
.body { margin: 0; color: var(--muted); font-size: 13px; }
.actions { display: flex; align-items: center; gap: 8px; flex: none; }
.card .actions { grid-column: 2 / 4; justify-content: flex-end; margin-top: 10px; }
.card .close { grid-column: 3; grid-row: 1; margin: -6px -6px 0 0; }
button {
  font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; border: 0; margin: 0;
  border-radius: 8px; padding: 7px 14px; line-height: 1.3; -webkit-appearance: none; appearance: none;
}
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button[disabled] { opacity: .6; cursor: default; }
.allow { background: var(--accent); color: var(--accent-ink); }
.allow:not([disabled]):hover { filter: brightness(1.08); }
.later { background: transparent; color: var(--fg); }
.later:not([disabled]):hover { background: var(--hover); }
.close {
  position: relative; flex: none; width: 32px; height: 32px; padding: 0; display: grid; place-items: center;
  background: transparent; color: var(--muted); border-radius: 50%;
}
.close:hover { background: var(--hover); color: var(--fg); }
.close::after {
  content: attr(data-tip); position: absolute; top: calc(100% + 6px); right: 0; white-space: nowrap;
  font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 6px;
  background: var(--tip-bg); color: var(--tip-fg); pointer-events: none; opacity: 0; transform: translateY(-2px);
  transition: opacity .12s, transform .12s;
}
.bottom .close::after, .bottom-right .close::after, .bottom-left .close::after { top: auto; bottom: calc(100% + 6px); }
.close:hover::after, .close:focus-visible::after { opacity: 1; transform: none; }
.hidden { display: none !important; }
.status .body { color: var(--fg); }
.out { animation: out .18s ease-in forwards; }
@keyframes in { from { opacity: 0; transform: translateY(calc(-8px * (1 - 2 * var(--dir, 0)))); } }
@keyframes out { to { opacity: 0; transform: translateY(calc(-8px * (1 - 2 * var(--dir, 0)))); } }
@media (prefers-reduced-motion: reduce) { .wrap, .out { animation: none; } }
@media (max-width: 600px) {
  .bar .inner { flex-wrap: wrap; padding: 12px 8px 12px 14px; gap: 8px 12px; }
  .bar .text { flex-basis: calc(100% - 100px); }
  .bar .actions { order: 3; width: 100%; justify-content: flex-end; }
  .bar .close { order: 2; }
}
`;

const BAR_POSITIONS = ['top', 'bottom'];
const CARD_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

export function createBanner({
  text,
  layout = 'bar',
  position,
  theme = 'auto',
  accent,
  accentText,
  icon,
  zIndex,
  container,
  onAllow,
  onLater,
  onClose,
}) {
  const doc = window.document;
  const isCard = layout === 'card';
  const positions = isCard ? CARD_POSITIONS : BAR_POSITIONS;
  const pos = positions.includes(position) ? position : positions[0];

  const host = doc.createElement('div');
  host.setAttribute('data-hibira-push-prompt', '');
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const wrap = doc.createElement('div');
  wrap.className = `wrap ${isCard ? 'card' : 'bar'} ${pos} ${['light', 'dark'].includes(theme) ? theme : 'auto'}`;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', text.title);
  if (accent) wrap.style.setProperty('--accent', accent);
  if (accentText) wrap.style.setProperty('--accent-ink', accentText);
  if (zIndex !== undefined) wrap.style.setProperty('--z', String(zIndex));

  const inner = el('div', 'inner');
  const iconBox = el('div', 'icon');
  if (icon) {
    const img = doc.createElement('img');
    img.src = icon;
    img.alt = '';
    iconBox.appendChild(img);
  } else {
    iconBox.innerHTML = BELL;
  }
  const textBox = el('div', 'text');
  const title = el('p', 'title', text.title);
  const body = el('p', 'body', text.body);
  body.setAttribute('aria-live', 'polite');
  textBox.append(title, body);

  const actions = el('div', 'actions');
  const later = el('button', 'later', text.later);
  const allow = el('button', 'allow', text.allow);
  later.type = allow.type = 'button';
  actions.append(later, allow);

  const close = el('button', 'close');
  close.type = 'button';
  close.innerHTML = X;
  close.setAttribute('aria-label', text.close);
  close.setAttribute('data-tip', text.close);

  if (isCard) inner.append(iconBox, textBox, close, actions);
  else inner.append(iconBox, textBox, actions, close);
  wrap.appendChild(inner);
  root.appendChild(wrap);

  allow.addEventListener('click', () => onAllow && onAllow());
  later.addEventListener('click', () => onLater && onLater());
  close.addEventListener('click', () => onClose && onClose());
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && onClose) onClose();
  });

  (container || doc.body).appendChild(host);

  let removed = false;
  let timer = null;

  return {
    host,
    root,
    // setStatus swaps the question for a status line: 'pending' while the
    // browser's own box is open, then 'granted', 'blocked' or 'error'.
    setStatus(kind, message) {
      if (kind === 'ask') {
        wrap.classList.remove('status');
        title.classList.remove('hidden');
        body.textContent = text.body;
        actions.classList.remove('hidden');
        allow.disabled = later.disabled = false;
        return;
      }
      wrap.classList.add('status');
      body.textContent = message;
      if (kind === 'pending') {
        allow.disabled = later.disabled = true;
        return;
      }
      title.classList.add('hidden');
      actions.classList.add('hidden');
    },
    remove(delay = 0) {
      if (removed) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        removed = true;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return host.remove();
        wrap.classList.add('out');
        setTimeout(() => host.remove(), 200);
      }, delay);
    },
    get removed() {
      return removed;
    },
  };

  function el(tag, cls, content) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  }
}
