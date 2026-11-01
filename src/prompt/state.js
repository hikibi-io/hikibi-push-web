// Remembers, per instance ID, how often a visitor said "Not now", so the
// prompt waits before asking again and stops after a few tries.

const KEY_PREFIX = 'hibira-push-prompt:';
const DAY = 24 * 60 * 60 * 1000;

function storage() {
  try {
    return window.localStorage || null;
  } catch {
    return null; // blocked third-party storage, privacy modes
  }
}

export function readState(instanceId) {
  const s = storage();
  if (!s) return { asks: 0, last: 0 };
  try {
    const v = JSON.parse(s.getItem(KEY_PREFIX + instanceId) || 'null');
    if (v && typeof v === 'object') {
      return { asks: Number(v.asks) || 0, last: Number(v.last) || 0 };
    }
  } catch {
    // unreadable value: start over
  }
  return { asks: 0, last: 0 };
}

export function recordDismissal(instanceId, now = Date.now()) {
  const next = { asks: readState(instanceId).asks + 1, last: now };
  const s = storage();
  try {
    if (s) s.setItem(KEY_PREFIX + instanceId, JSON.stringify(next));
  } catch {
    // storage full or blocked: the prompt shows again next time
  }
  return next;
}

export function resetState(instanceId) {
  const s = storage();
  try {
    if (s) s.removeItem(KEY_PREFIX + instanceId);
  } catch {
    // nothing to reset
  }
}

// canAsk says whether the cooldown and the ask limit allow showing the
// prompt now. cooldownDays 0 asks on every page load; maxAsks 0 means no limit.
export function canAsk(state, { cooldownDays = 7, maxAsks = 3 } = {}, now = Date.now()) {
  if (maxAsks > 0 && state.asks >= maxAsks) return false;
  if (state.last && now - state.last < cooldownDays * DAY) return false;
  return true;
}
