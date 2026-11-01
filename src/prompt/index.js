// promptForNotifications: a soft, in-page "turn on desktop notifications"
// banner in front of the browser's own permission box. The browser box only
// opens after the visitor clicks our button; a visitor who blocks the
// browser box can never be asked again by the site, so asking softly first
// keeps that door open.

import { createBanner } from './banner.js';
import { messagesFor, pickLocale } from './messages.js';
import { canAsk, readState, recordDismissal, resetState } from './state.js';

export const PromptOutcome = Object.freeze({
  GRANTED: 'granted', // permission given and the device is registered
  DENIED: 'denied', // the browser's box was blocked, or was blocked before
  DISMISSED: 'dismissed', // the visitor chose "Not now" or closed the banner
  SKIPPED: 'skipped', // cooldown or ask limit; nothing was shown
  UNSUPPORTED: 'unsupported', // no Web Push here (for example iOS Safari outside a home-screen app)
  ERROR: 'error', // permission given but registering the device failed
});

export async function promptForNotifications(options = {}) {
  const {
    client: givenClient,
    instanceId: givenInstanceId,
    clientOptions,
    interests = [],
    userId,
    tokenProvider,
    locale,
    text,
    siteName,
    layout = 'bar',
    position,
    theme = 'auto',
    accent,
    accentText,
    icon,
    zIndex,
    container,
    delay = 0,
    cooldownDays = 7,
    maxAsks = 3,
    force = false,
    showBlockedHelp = false,
    onShow,
    onResult,
  } = options;

  const instanceId = (givenClient && givenClient.instanceId) || givenInstanceId;
  if (!givenClient && !instanceId) {
    throw new Error('promptForNotifications needs a client or an instanceId');
  }

  const finish = (outcome, error) => {
    const result = error ? { outcome, error } : { outcome };
    if (onResult) {
      try {
        onResult(result);
      } catch (e) {
        console.error('[Hibira Push] onResult threw', e);
      }
    }
    return result;
  };

  if (!isPushSupported()) return finish(PromptOutcome.UNSUPPORTED);

  let client = givenClient || null;
  const getClient = () => {
    if (!client) client = new options.Client({ ...clientOptions, instanceId });
    return client;
  };

  const register = async () => {
    const c = getClient();
    await c.start();
    if (interests.length) {
      const have = await c.getDeviceInterests();
      const missing = interests.filter((i) => !have.includes(i));
      if (missing.length) await c.setDeviceInterests([...have, ...missing]);
    }
    if (userId && tokenProvider && (await c.getUserId()) !== userId) {
      await c.setUserId(userId, tokenProvider);
    }
  };

  const strings = messagesFor(
    locale || pickLocale(window.navigator.languages || window.navigator.language),
    text,
    siteName || (window.location && window.location.hostname) || ''
  );
  const bannerOptions = { text: strings, layout, position, theme, accent, accentText, icon, zIndex, container };

  const permission = window.Notification.permission;
  if (permission === 'granted') {
    // Already allowed: make sure this browser is registered, show nothing.
    try {
      await register();
      return finish(PromptOutcome.GRANTED);
    } catch (e) {
      return finish(PromptOutcome.ERROR, e);
    }
  }
  if (permission === 'denied') {
    if (showBlockedHelp && (force || canAsk(readState(instanceId), { cooldownDays, maxAsks }))) {
      await wait(delay);
      return new Promise((resolve) => {
        const banner = createBanner({
          ...bannerOptions,
          onClose: () => {
            recordDismissal(instanceId);
            banner.remove();
            resolve(finish(PromptOutcome.DENIED));
          },
        });
        banner.setStatus('blocked', strings.blocked);
        if (onShow) onShow();
      });
    }
    return finish(PromptOutcome.DENIED);
  }

  if (!force && !canAsk(readState(instanceId), { cooldownDays, maxAsks })) {
    return finish(PromptOutcome.SKIPPED);
  }

  await wait(delay);
  // Construct the client (and register the service worker) before the click,
  // so the browser box opens straight from the visitor's gesture.
  try {
    getClient();
  } catch (e) {
    return finish(PromptOutcome.UNSUPPORTED, e);
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome, error) => {
      if (settled) return;
      settled = true;
      resolve(finish(outcome, error));
    };
    const dismiss = () => {
      if (settled) return banner.remove();
      recordDismissal(instanceId);
      banner.remove();
      done(PromptOutcome.DISMISSED);
    };
    const banner = createBanner({
      ...bannerOptions,
      onLater: dismiss,
      onClose: dismiss,
      onAllow: async () => {
        banner.setStatus('pending', strings.pending);
        const result = await requestPermission();
        if (result === 'granted') {
          try {
            await register();
            resetState(instanceId);
            banner.setStatus('granted', strings.granted);
            banner.remove(2500);
            done(PromptOutcome.GRANTED);
          } catch (e) {
            banner.setStatus('error', strings.error);
            banner.remove(6000);
            done(PromptOutcome.ERROR, e);
          }
        } else if (result === 'denied') {
          banner.setStatus('blocked', strings.blocked);
          banner.remove(8000);
          done(PromptOutcome.DENIED);
        } else {
          // The visitor closed the browser's box without choosing.
          recordDismissal(instanceId);
          banner.remove();
          done(PromptOutcome.DISMISSED);
        }
      },
    });
    if (onShow) onShow();
  });
}

// resetNotificationPrompt forgets earlier "Not now" answers, for example
// when the visitor presses a "Turn on notifications" button in settings.
export function resetNotificationPrompt(instanceId) {
  resetState(instanceId);
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext !== false &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in window.navigator
  );
}

function requestPermission() {
  // Older Safari only supports the callback form.
  return new Promise((resolve) => {
    const p = window.Notification.requestPermission(resolve);
    if (p && typeof p.then === 'function') p.then(resolve, () => resolve('default'));
  });
}

function wait(ms) {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}
