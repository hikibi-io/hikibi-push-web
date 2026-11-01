import doRequest from './do-request';
import TokenProvider from './token-provider';
import DeviceStateStore from './device-state-store';
import {
  promptForNotifications as promptWithClient,
  resetNotificationPrompt,
  PromptOutcome,
} from './prompt/index.js';
import { LOCALES as PROMPT_LOCALES } from './prompt/messages.js';
import pkg from '../package.json' with { type: 'json' };

const sdkVersion = pkg.version;

// DEFAULT_ENDPOINT is Hibira's hosted push API. Apps on another cluster or a
// self-hosted server pass `endpoint`.
export const DEFAULT_ENDPOINT = 'https://ws.hibira.io';

const INTERESTS_REGEX = new RegExp('^(_|\\-|=|@|,|\\.|;|[A-Z]|[a-z]|[0-9])*$');
const MAX_INTEREST_LENGTH = 164;
const MAX_INTERESTS_NUM = 5000;

const SERVICE_WORKER_URL = `/service-worker.js?hibiraPushWebSDKVersion=${sdkVersion}`;

export const RegistrationState = Object.freeze({
  PERMISSION_PROMPT_REQUIRED: 'PERMISSION_PROMPT_REQUIRED',
  PERMISSION_GRANTED_NOT_REGISTERED_WITH_BEAMS:
    'PERMISSION_GRANTED_NOT_REGISTERED_WITH_BEAMS',
  PERMISSION_GRANTED_REGISTERED_WITH_BEAMS:
    'PERMISSION_GRANTED_REGISTERED_WITH_BEAMS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
});

export class Client {
  constructor(config) {
    if (!config) {
      throw new Error('Config object required');
    }
    const {
      instanceId,
      endpoint = null,
      endpointOverride = null, // accepted for code written for the Beams SDK
      serviceWorkerRegistration = null,
    } = config;

    if (instanceId === undefined) {
      throw new Error('Instance ID is required');
    }
    if (typeof instanceId !== 'string') {
      throw new Error('Instance ID must be a string');
    }
    if (instanceId.length === 0) {
      throw new Error('Instance ID cannot be empty');
    }

    if (!('indexedDB' in window)) {
      throw new Error(
        'Hibira Push does not support this browser version (IndexedDB not supported)'
      );
    }

    if (!window.isSecureContext) {
      throw new Error(
        'Hibira Push relies on Service Workers, which only work in secure contexts. Check that your page is being served from localhost/over HTTPS'
      );
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error(
        'Hibira Push does not support this browser version (Service Workers not supported)'
      );
    }

    if (!('PushManager' in window)) {
      throw new Error(
        'Hibira Push does not support this browser version (Web Push not supported)'
      );
    }

    if (serviceWorkerRegistration) {
      const serviceWorkerScope = serviceWorkerRegistration.scope;
      const currentURL = window.location.href;
      const scopeMatchesCurrentPage = currentURL.startsWith(serviceWorkerScope);
      if (!scopeMatchesCurrentPage) {
        throw new Error(
          `Could not initialize Hibira Push: current page not in serviceWorkerRegistration scope (${serviceWorkerScope})`
        );
      }
    }

    this.instanceId = instanceId;
    this._deviceId = null;
    this._token = null;
    this._userId = null;
    this._serviceWorkerRegistration = serviceWorkerRegistration;
    this._deviceStateStore = new DeviceStateStore(instanceId);
    this._endpoint = trimEndpoint(endpoint || endpointOverride || DEFAULT_ENDPOINT);

    this._ready = this._init();
  }

  async _init() {
    if (this._deviceId !== null) {
      return;
    }

    await this._deviceStateStore.connect();

    if (this._serviceWorkerRegistration) {
      // If we have been given a service worker, wait for it to be ready
      await window.navigator.serviceWorker.ready;
    } else {
      // Otherwise register our own one
      this._serviceWorkerRegistration = await getServiceWorkerRegistration();
    }

    await this._detectSubscriptionChange();

    this._deviceId = await this._deviceStateStore.getDeviceId();
    this._token = await this._deviceStateStore.getToken();
    this._userId = await this._deviceStateStore.getUserId();
  }

  // Ensure SDK is loaded and is consistent
  async _resolveSDKState() {
    await this._ready;
    await this._detectSubscriptionChange();
  }

  async _detectSubscriptionChange() {
    const storedToken = await this._deviceStateStore.getToken();
    const actualToken = await getWebPushToken(this._serviceWorkerRegistration);

    const pushTokenHasChanged = storedToken !== actualToken;

    if (pushTokenHasChanged) {
      // The web push subscription has changed out from underneath us.
      // This can happen when the user disables the web push permission
      // (potentially also renabling it, thereby changing the token)
      //
      // This means the SDK has effectively been stopped, so we should update
      // the SDK state to reflect that.
      await this._deviceStateStore.clear();
      this._deviceId = null;
      this._token = null;
      this._userId = null;
    }
  }

  async getDeviceId() {
    await this._resolveSDKState();
    return this._ready.then(() => this._deviceId);
  }

  async getToken() {
    await this._resolveSDKState();
    return this._ready.then(() => this._token);
  }

  async getUserId() {
    await this._resolveSDKState();
    return this._ready.then(() => this._userId);
  }

  get _baseURL() {
    return this._endpoint;
  }

  _throwIfNotStarted(message) {
    if (!this._deviceId) {
      throw new Error(
        `${message}. SDK not registered with Hibira Push. Did you call .start?`
      );
    }
  }

  async start() {
    await this._resolveSDKState();

    if (!isSupportedBrowser()) {
      return this;
    }

    if (this._deviceId !== null) {
      return this;
    }

    const { vapidPublicKey: publicKey } = await this._getPublicKey();

    // register with pushManager, get endpoint etc
    const token = await this._getPushToken(publicKey);

    // get device id from errol
    const deviceId = await this._registerDevice(token);

    await this._deviceStateStore.setToken(token);
    await this._deviceStateStore.setDeviceId(deviceId);
    await this._deviceStateStore.setLastSeenSdkVersion(sdkVersion);
    await this._deviceStateStore.setLastSeenUserAgent(
      window.navigator.userAgent
    );

    this._token = token;
    this._deviceId = deviceId;
    return this;
  }

  async getRegistrationState() {
    await this._resolveSDKState();

    if (Notification.permission === 'denied') {
      return RegistrationState.PERMISSION_DENIED;
    }

    if (Notification.permission === 'granted' && this._deviceId !== null) {
      return RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS;
    }

    if (Notification.permission === 'granted' && this._deviceId === null) {
      return RegistrationState.PERMISSION_GRANTED_NOT_REGISTERED_WITH_BEAMS;
    }

    return RegistrationState.PERMISSION_PROMPT_REQUIRED;
  }

  async addDeviceInterest(interest) {
    await this._resolveSDKState();
    this._throwIfNotStarted('Could not add Device Interest');

    validateInterestName(interest);

    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/interests/${encodeURIComponent(interest)}`;
    const options = {
      method: 'POST',
      path,
    };
    await doRequest(options);
  }

  async removeDeviceInterest(interest) {
    await this._resolveSDKState();
    this._throwIfNotStarted('Could not remove Device Interest');

    validateInterestName(interest);

    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/interests/${encodeURIComponent(interest)}`;
    const options = {
      method: 'DELETE',
      path,
    };
    await doRequest(options);
  }

  async getDeviceInterests() {
    await this._resolveSDKState();
    this._throwIfNotStarted('Could not get Device Interests');

    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/interests`;
    const options = {
      method: 'GET',
      path,
    };
    return (await doRequest(options))['interests'] || [];
  }

  async setDeviceInterests(interests) {
    await this._resolveSDKState();
    this._throwIfNotStarted('Could not set Device Interests');

    if (interests === undefined || interests === null) {
      throw new Error('interests argument is required');
    }
    if (!Array.isArray(interests)) {
      throw new Error('interests argument must be an array');
    }
    if (interests.length > MAX_INTERESTS_NUM) {
      throw new Error(
        `Number of interests (${
          interests.length
        }) exceeds maximum of ${MAX_INTERESTS_NUM}`
      );
    }
    for (let interest of interests) {
      validateInterestName(interest);
    }

    const uniqueInterests = Array.from(new Set(interests));
    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/interests`;
    const options = {
      method: 'PUT',
      path,
      body: {
        interests: uniqueInterests,
      },
    };
    await doRequest(options);
  }

  async clearDeviceInterests() {
    await this._resolveSDKState();
    this._throwIfNotStarted('Could not clear Device Interests');

    await this.setDeviceInterests([]);
  }

  async setUserId(userId, tokenProvider) {
    await this._resolveSDKState();

    if (!isSupportedBrowser()) {
      return;
    }

    if (this._deviceId === null) {
      const error = new Error('.start must be called before .setUserId');
      return Promise.reject(error);
    }
    if (typeof userId !== 'string') {
      throw new Error(`User ID must be a string (was ${userId})`);
    }
    if (userId === '') {
      throw new Error('User ID cannot be the empty string');
    }
    if (this._userId !== null && this._userId !== userId) {
      throw new Error('Changing the `userId` is not allowed.');
    }

    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/user`;

    const { token: beamsAuthToken } = await tokenProvider.fetchToken(userId);
    const options = {
      method: 'PUT',
      path,
      headers: {
        Authorization: `Bearer ${beamsAuthToken}`,
      },
    };
    await doRequest(options);

    this._userId = userId;
    return this._deviceStateStore.setUserId(userId);
  }

  async stop() {
    await this._resolveSDKState();

    if (!isSupportedBrowser()) {
      return;
    }

    if (this._deviceId === null) {
      return;
    }

    await this._deleteDevice();
    await this._deviceStateStore.clear();
    this._clearPushToken().catch(() => {}); // Not awaiting this, best effort.

    this._deviceId = null;
    this._token = null;
    this._userId = null;
  }

  async clearAllState() {
    if (!isSupportedBrowser()) {
      return;
    }

    await this.stop();
    await this.start();
  }

  async _getPublicKey() {
    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/web-vapid-public-key`;

    const options = { method: 'GET', path };
    return doRequest(options);
  }

  async _getPushToken(publicKey) {
    try {
      // The browser might already have a push subscription to different key.
      // Lets clear it out first.
      await this._clearPushToken();
      const sub = await this._serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUInt8Array(publicKey),
      });
      return btoa(JSON.stringify(sub));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async _clearPushToken() {
    return navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (sub) sub.unsubscribe();
      });
  }

  async _registerDevice(token) {
    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web`;

    const device = {
      token,
      metadata: {
        sdkVersion,
      },
    };

    const options = { method: 'POST', path, body: device };
    const response = await doRequest(options);
    return response.id;
  }

  async _deleteDevice() {
    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${encodeURIComponent(this._deviceId)}`;

    const options = { method: 'DELETE', path };
    await doRequest(options);
  }

  /**
   * Submit SDK version and browser details (via the user agent) to the push API.
   */
  async _updateDeviceMetadata() {
    const userAgent = window.navigator.userAgent;
    const storedUserAgent = await this._deviceStateStore.getLastSeenUserAgent();
    const storedSdkVersion = await this._deviceStateStore.getLastSeenSdkVersion();

    if (userAgent === storedUserAgent && sdkVersion === storedSdkVersion) {
      // Nothing to do
      return;
    }

    const path = `${this._baseURL}/device_api/v1/instances/${encodeURIComponent(
      this.instanceId
    )}/devices/web/${this._deviceId}/metadata`;

    const metadata = {
      sdkVersion,
    };

    const options = { method: 'PUT', path, body: metadata };
    await doRequest(options);

    await this._deviceStateStore.setLastSeenSdkVersion(sdkVersion);
    await this._deviceStateStore.setLastSeenUserAgent(userAgent);
  }
}

const validateInterestName = interest => {
  if (interest === undefined || interest === null) {
    throw new Error('Interest name is required');
  }
  if (typeof interest !== 'string') {
    throw new Error(`Interest ${interest} is not a string`);
  }
  if (!INTERESTS_REGEX.test(interest)) {
    throw new Error(
      `interest "${interest}" contains a forbidden character. ` +
        'Allowed characters are: ASCII upper/lower-case letters, ' +
        'numbers or one of _-=@,.;'
    );
  }
  if (interest.length > MAX_INTEREST_LENGTH) {
    throw new Error(
      `Interest is longer than the maximum of ${MAX_INTEREST_LENGTH} chars`
    );
  }
};

async function getServiceWorkerRegistration() {
  // Check that service worker file exists
  const { status: swStatusCode } = await fetch(SERVICE_WORKER_URL);
  if (swStatusCode !== 200) {
    throw new Error(
      'Cannot start SDK, service worker missing: No file found at /service-worker.js'
    );
  }

  window.navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    // explicitly opting out of `importScripts` caching just in case our
    // customers decides to host and serve the imported scripts and
    // accidentally set `Cache-Control` to something other than `max-age=0`
    updateViaCache: 'none',
  });
  return window.navigator.serviceWorker.ready;
}

function getWebPushToken(swReg) {
  return swReg.pushManager
    .getSubscription()
    .then(sub => (!sub ? null : encodeSubscription(sub)));
}

function encodeSubscription(sub) {
  return btoa(JSON.stringify(sub));
}

function urlBase64ToUInt8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// Any browser with standard Web Push (VAPID) works, including Safari 16.4+
// (the Beams SDK allowed only Chromium-based browsers and Firefox).
function isSupportedBrowser() {
  const isSupported =
    'PushManager' in window && 'serviceWorker' in window.navigator;
  if (!isSupported) {
    console.warn('Hibira Push needs a browser with Web Push support.');
  }
  return isSupported;
}

export { TokenProvider, resetNotificationPrompt, PromptOutcome, PROMPT_LOCALES };

// promptForNotifications shows an in-page banner asking the visitor to turn
// on desktop notifications, and registers the browser when they agree.
export function promptForNotifications(options) {
  return promptWithClient({ ...options, Client });
}

function trimEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !/^https?:\/\//.test(endpoint)) {
    throw new Error('endpoint must be an http(s) URL, for example https://ws.hibira.io');
  }
  return endpoint.replace(/\/+$/, '');
}
