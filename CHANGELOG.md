# Changelog

## 1.3.0 - unreleased

- `promptForNotifications()`: an in-page banner that asks visitors to turn on
  desktop notifications before the browser's own permission box, then
  registers the browser and sets interests and the user ID. "Not now"
  cooldown, seven languages, bar or card layout, light and dark themes.
- `resetNotificationPrompt()`, `PromptOutcome` and `PROMPT_LOCALES`.

## 1.2.1 - 2026-10-29

- The package homepage on npm now links to https://hibira.io. No code changes.

## 1.2.0 - 2026-10-24

- The default endpoint is now `https://ws.hibira.io`. `https://ws.hikibi.io` keeps
  working, so apps on 1.1.0 and earlier need no change.
- Links and the support address moved to hibira.io.
- Removed the `HikibiPush` alias of `HibiraPush` (CDN script and service worker).

## 1.1.0 - 2026-10-24

Renamed for the Hikibi → Hibira rebrand. No API changes.

- Published as `@hibira-io/push-web` (was `@hikibi/push-web`); the repository is now
  github.com/hibira-io/hibira-push-web.
- Global and service-worker namespace `HibiraPush`; `HikibiPush` stays as an alias.
- The default endpoint is still `https://ws.hikibi.io`.

## 1.0.0 - 2026-10-22

First release: a fork of `@pusher/push-notifications-web` 1.1.0 (MIT) for Hikibi Push.

- `endpoint` option, default `https://ws.hikibi.io` (`endpointOverride` still works).
- Global and service-worker namespace `self.HikibiPush`.
- Safari 16.4+ enabled through feature detection.
