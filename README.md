# @hibira-io/push-web

Web push notifications for [Hibira Push](https://hibira.io). It is the web
client for the Beams-compatible push API: an MIT-licensed fork of the Pusher
Beams web SDK with the host made configurable, so code written for that SDK
keeps working after changing the import.

Works in browsers with standard Web Push: Chrome, Edge, Firefox, Opera and
Safari 16.4+ (the Beams SDK did not enable Safari).

## Install

```sh
npm install @hibira-io/push-web
```

Or load the script, which defines the global `HibiraPush`:

```html
<script src="https://cdn.jsdelivr.net/npm/@hibira-io/push-web@1/dist/push-web.min.js"></script>
```

## Service worker

Serve a `/service-worker.js` at your site root that loads ours:

```js
importScripts('https://cdn.jsdelivr.net/npm/@hibira-io/push-web@1/dist/service-worker.js');
// Only if your app is not on the default cluster:
// self.HibiraPush.endpoint = 'https://ws-tyo.hibira.io';
```

You can also copy `node_modules/@hibira-io/push-web/dist/service-worker.js`
into your site. To handle notifications yourself, set
`self.HibiraPush.onNotificationReceived` (same arguments as Beams'
`onNotificationReceived`).

## Use

```js
import { Client, TokenProvider } from '@hibira-io/push-web';

const push = new Client({
  instanceId: 'YOUR_INSTANCE_ID', // portal: app page → Push notifications
  // endpoint: 'https://ws.hibira.io', // the default
});

await push.start();
await push.addDeviceInterest('news');

// Authenticated users: your backend returns a user token
// (generateToken in the server SDKs).
await push.setUserId('alice', new TokenProvider({ url: '/push/user-token' }));
```

`endpoint` is the push API base URL shown on the app page in the portal.
`endpointOverride` is accepted as a synonym.

## Ask visitors to turn on notifications

Browsers only let a site show their permission box a few times, and a visitor
who clicks "Block" can't be asked again. `promptForNotifications` shows our
own banner first (like the one Gmail shows) and opens the browser's box only
after the visitor clicks "Turn on". Once they allow it, the browser is
registered, and the interests and user ID you pass are set.

```js
import { promptForNotifications } from '@hibira-io/push-web';

const { outcome } = await promptForNotifications({
  instanceId: 'YOUR_INSTANCE_ID',
  interests: ['orders'],
  siteName: 'Acme Shop',
});
// outcome: 'granted' | 'denied' | 'dismissed' | 'skipped' | 'unsupported' | 'error'
```

Call it on every page load: it shows nothing to visitors who already allowed
notifications (it just makes sure they are registered), to browsers without
Web Push, or while a "Not now" is cooling down.

- **"Not now"** waits `cooldownDays` (7) before asking again, and stops after
  `maxAsks` (3). `resetNotificationPrompt(instanceId)` forgets the answers;
  `force: true` asks anyway, for a "Turn on notifications" button in your
  settings.
- **Blocked**: `showBlockedHelp: true` shows how to unblock notifications in the
  browser instead of nothing.
- **Language**: English, 繁體中文, 简体中文, 日本語, 한국어, ไทย and Tiếng Việt,
  picked from the browser. Set `locale`, or replace any string with `text`
  (`{site}` is filled with `siteName`).
- **Look**: `layout: 'bar'` (default, along the top or bottom edge) or `'card'`
  (a corner), `position`, `theme` (`auto`/`light`/`dark`), `accent`, `icon`,
  `zIndex`, `delay`. The banner sits in a shadow root, so your CSS doesn't
  affect it and its CSS doesn't leak into your page.
- `client`, `userId` with `tokenProvider`, `onShow` and `onResult` are also
  accepted; see `index.d.ts` for every option.

With the CDN script it is `HibiraPush.promptForNotifications({...})`. Either
way, the `/service-worker.js` above is still needed.

## Moving from @hikibi/push-web

Hikibi is now Hibira, and this package moved from `@hikibi/push-web` to
`@hibira-io/push-web`. The API is the same: change the import and the
`importScripts` URL, and use `HibiraPush` where you used `HikibiPush` (the
old name is gone since 1.2.0). `@hikibi/push-web` 1.0.0 stays on npm
(deprecated) and gets no new versions.

## Moving from the Beams web SDK

| Beams web SDK | @hibira-io/push-web |
|---|---|
| `import * as PusherPushNotifications from '@pusher/push-notifications-web'` | `import * as HibiraPush from '@hibira-io/push-web'` |
| `new PusherPushNotifications.Client({ instanceId })` | `new HibiraPush.Client({ instanceId })` |
| `importScripts('https://js.pusher.com/beams/service-worker.js')` | `importScripts('https://cdn.jsdelivr.net/npm/@hibira-io/push-web@1/dist/service-worker.js')` |
| `PusherPushNotifications.onNotificationReceived = …` in the service worker | `HibiraPush.onNotificationReceived = …` |

Everything else (`start`, interests, `setUserId`, `stop`, `clearAllState`,
`getRegistrationState` and its values) is unchanged. Browsers that were
registered with Beams register again on the first `start()`.

## License

MIT. Based on the Pusher Beams web SDK, Copyright (c) 2019 Pusher; see
LICENSE.
