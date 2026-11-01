// Covers the notification prompt's decisions that need no DOM: locale and
// text, the "Not now" cooldown, and the paths where no banner is shown.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { MESSAGES, LOCALES, pickLocale, messagesFor } from '../src/prompt/messages.js';
import { canAsk, readState, recordDismissal, resetState } from '../src/prompt/state.js';

const store = new Map();
globalThis.window = globalThis;
window.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
window.isSecureContext = true;
window.PushManager = class {};
window.Notification = { permission: 'default', requestPermission: async () => 'granted' };
window.location = { href: 'https://shop.example/', hostname: 'shop.example' };

let subscription = null;
const registration = {
  scope: 'https://shop.example/',
  pushManager: {
    getSubscription: async () => subscription,
    subscribe: async () => (subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' }, unsubscribe: async () => {} }),
  },
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { languages: ['zh-TW'], userAgent: 'Mozilla/5.0 Chrome/130', serviceWorker: { ready: Promise.resolve(registration), register() {} } },
});
const requests = [];
globalThis.fetch = async (url, opts = {}) => {
  requests.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
  const path = new URL(url, 'https://shop.example').pathname;
  let body = {};
  if (path.endsWith('/web-vapid-public-key')) body = { vapidPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' };
  if (path.endsWith('/devices/web')) body = { id: 'web-1' };
  if (path.endsWith('/interests') && (opts.method || 'GET') === 'GET') body = { interests: ['news'] };
  return { ok: true, status: 200, json: async () => body };
};

const { promptForNotifications, resetNotificationPrompt, PROMPT_LOCALES } = await import('../dist/push-web.js');

beforeEach(() => {
  store.clear();
  requests.length = 0;
  subscription = null;
  window.Notification.permission = 'default';
});

test('every locale has every string, and {site} only where English has it', () => {
  assert.deepEqual(LOCALES, ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'th', 'vi']);
  assert.deepEqual(PROMPT_LOCALES, LOCALES);
  for (const l of LOCALES) {
    assert.deepEqual(Object.keys(MESSAGES[l]), Object.keys(MESSAGES.en), l);
    for (const [k, v] of Object.entries(MESSAGES[l])) {
      assert.ok(v.length > 0, `${l}.${k}`);
      assert.equal(v.includes('{site}'), MESSAGES.en[k].includes('{site}'), `${l}.${k}`);
    }
  }
});

test('pickLocale follows the browser languages', () => {
  assert.equal(pickLocale(['zh-TW', 'en']), 'zh-TW');
  assert.equal(pickLocale(['zh-HK']), 'zh-TW');
  assert.equal(pickLocale(['zh-Hant-TW']), 'zh-TW');
  assert.equal(pickLocale(['zh']), 'zh-CN');
  assert.equal(pickLocale(['zh-SG']), 'zh-CN');
  assert.equal(pickLocale('ja-JP'), 'ja');
  assert.equal(pickLocale(['fr-FR', 'ko-KR']), 'ko');
  assert.equal(pickLocale(['th_TH']), 'th');
  assert.equal(pickLocale(['de']), 'en');
  assert.equal(pickLocale(undefined), 'en');
});

test('messagesFor fills {site} and applies overrides', () => {
  const m = messagesFor('en', { allow: 'Yes please', title: 'Hi from {site}' }, 'Acme');
  assert.equal(m.allow, 'Yes please');
  assert.equal(m.title, 'Hi from Acme');
  assert.match(m.body, /from Acme,/);
  assert.equal(messagesFor('xx', null, 's').later, 'Not now');
});

test('cooldown and ask limit', () => {
  const day = 86400000;
  const now = 100 * day;
  assert.equal(canAsk({ asks: 0, last: 0 }, {}, now), true);
  assert.equal(canAsk({ asks: 1, last: now - 6 * day }, {}, now), false);
  assert.equal(canAsk({ asks: 1, last: now - 7 * day }, {}, now), true);
  assert.equal(canAsk({ asks: 3, last: now - 99 * day }, {}, now), false);
  assert.equal(canAsk({ asks: 3, last: now - 99 * day }, { maxAsks: 0 }, now), true);
  assert.equal(canAsk({ asks: 1, last: now }, { cooldownDays: 0 }, now), true);

  recordDismissal('inst', now);
  recordDismissal('inst', now + 1);
  assert.deepEqual(readState('inst'), { asks: 2, last: now + 1 });
  resetState('inst');
  assert.deepEqual(readState('inst'), { asks: 0, last: 0 });
  store.set('hibira-push-prompt:bad', '{not json');
  assert.deepEqual(readState('bad'), { asks: 0, last: 0 });
});

test('already granted: registers quietly, adds missing interests, shows nothing', async () => {
  window.Notification.permission = 'granted';
  const seen = [];
  const r = await promptForNotifications({ instanceId: 'granted-1', interests: ['news', 'deals'], onShow: () => assert.fail('shown'), onResult: (x) => seen.push(x) });
  assert.deepEqual(r, { outcome: 'granted' });
  assert.deepEqual(seen, [r]);
  assert.ok(requests.some((q) => q.method === 'POST' && q.url.endsWith('/devices/web')));
  const put = requests.find((q) => q.method === 'PUT' && q.url.endsWith('/interests'));
  assert.deepEqual(put.body, { interests: ['news', 'deals'] });
});

test('blocked: no banner unless showBlockedHelp', async () => {
  window.Notification.permission = 'denied';
  const r = await promptForNotifications({ instanceId: 'denied-1', onShow: () => assert.fail('shown') });
  assert.equal(r.outcome, 'denied');
  assert.equal(requests.length, 0);
});

test('cooldown: skipped without showing; force and reset bring it back', async () => {
  recordDismissal('cool-1');
  const r = await promptForNotifications({ instanceId: 'cool-1', onShow: () => assert.fail('shown') });
  assert.equal(r.outcome, 'skipped');
  resetNotificationPrompt('cool-1');
  assert.deepEqual(readState('cool-1'), { asks: 0, last: 0 });
});

test('no Web Push (iOS Safari tab, http): unsupported', async () => {
  const saved = window.PushManager;
  delete window.PushManager;
  try {
    const r = await promptForNotifications({ instanceId: 'nopush', onShow: () => assert.fail('shown') });
    assert.equal(r.outcome, 'unsupported');
  } finally {
    window.PushManager = saved;
  }
});

test('needs a client or an instanceId', async () => {
  await assert.rejects(() => promptForNotifications({}), /client or an instanceId/);
});
