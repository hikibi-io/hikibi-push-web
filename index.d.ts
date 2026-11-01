export interface TokenProviderResponse {
  token: string;
}
export interface ITokenProvider {
  fetchToken(userId: string): Promise<TokenProviderResponse>;
}

interface TokenProviderOptions {
  url: string;
  queryParams?: { [key: string]: any };
  headers?: { [key: string]: string };
  credentials?: string;
}

export class TokenProvider implements ITokenProvider {
  constructor(options: TokenProviderOptions);
  fetchToken(userId: string): Promise<TokenProviderResponse>;
}

export enum RegistrationState {
  PERMISSION_GRANTED_REGISTERED_WITH_BEAMS = 'PERMISSION_GRANTED_REGISTERED_WITH_BEAMS',
  PERMISSION_GRANTED_NOT_REGISTERED_WITH_BEAMS = 'PERMISSION_GRANTED_NOT_REGISTERED_WITH_BEAMS',
  PERMISSION_PROMPT_REQUIRED = 'PERMISSION_PROMPT_REQUIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

export class Client {
  instanceId: string;
  deviceId: string;
  userId: string;

  constructor(options: ClientOptions);

  start(): Promise<undefined>;
  getDeviceId(): Promise<string>;
  addDeviceInterest(interest: string): Promise<undefined>;
  removeDeviceInterest(interest: string): Promise<undefined>;
  getDeviceInterests(): Promise<Array<string>>;
  setDeviceInterests(interests: Array<string>): Promise<undefined>;
  clearDeviceInterests(): Promise<undefined>;
  getUserId(): Promise<string>;
  setUserId(userId: string, tokenProvider: ITokenProvider): Promise<undefined>;
  stop(): Promise<undefined>;
  clearAllState(): Promise<undefined>;
  getRegistrationState(): Promise<RegistrationState>;
}

export const DEFAULT_ENDPOINT: string;

interface ClientOptions {
  instanceId: string;
  serviceWorkerRegistration?: ServiceWorkerRegistration;
  /** Push API base URL; defaults to https://ws.hibira.io. */
  endpoint?: string;
  /** Same as endpoint; accepted for code written for the Beams web SDK. */
  endpointOverride?: string;
}

export type PromptLocale = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'th' | 'vi';
export const PROMPT_LOCALES: PromptLocale[];

export interface PromptText {
  /** Headline. {site} is replaced with siteName. */
  title: string;
  body: string;
  /** Primary button: opens the browser's permission box. */
  allow: string;
  later: string;
  /** Close button label and tooltip. */
  close: string;
  /** Shown while the browser's permission box is open. */
  pending: string;
  granted: string;
  /** How to unblock notifications in the browser. */
  blocked: string;
  error: string;
}

export enum PromptOutcome {
  GRANTED = 'granted',
  DENIED = 'denied',
  DISMISSED = 'dismissed',
  SKIPPED = 'skipped',
  UNSUPPORTED = 'unsupported',
  ERROR = 'error',
}

export interface PromptResult {
  outcome: PromptOutcome | `${PromptOutcome}`;
  error?: unknown;
}

export interface PromptOptions {
  /** An existing client. Or pass instanceId (and clientOptions) and one is made for you. */
  client?: Client;
  instanceId?: string;
  clientOptions?: Omit<ClientOptions, 'instanceId'>;
  /** Interests added once the visitor agrees. */
  interests?: string[];
  /** Ties the device to a signed-in user once the visitor agrees. */
  userId?: string;
  tokenProvider?: ITokenProvider;
  /** Defaults to the browser's language; English when it is not one of PROMPT_LOCALES. */
  locale?: PromptLocale;
  /** Replaces any of the built-in strings. */
  text?: Partial<PromptText>;
  /** Fills {site} in the text; defaults to the page's host name. */
  siteName?: string;
  /** 'bar' spans the page edge (default); 'card' floats in a corner. */
  layout?: 'bar' | 'card';
  /** bar: 'top' (default) | 'bottom'. card: 'bottom-right' (default) | 'bottom-left' | 'top-right' | 'top-left'. */
  position?: 'top' | 'bottom' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'auto' | 'light' | 'dark';
  /** Any CSS color for the button and icon. */
  accent?: string;
  /** Text color on the accent button; defaults to white. */
  accentText?: string;
  /** Image URL shown instead of the bell. */
  icon?: string;
  zIndex?: number;
  /** Where the banner is attached; defaults to document.body. */
  container?: HTMLElement;
  /** Milliseconds to wait before showing the banner. */
  delay?: number;
  /** Days to wait after "Not now" before asking again (default 7; 0 asks every time). */
  cooldownDays?: number;
  /** Stop asking after this many "Not now" answers (default 3; 0 never stops). */
  maxAsks?: number;
  /** Ignore cooldownDays and maxAsks, for a "Turn on notifications" button. */
  force?: boolean;
  /** When notifications are blocked, show how to unblock them (default false). */
  showBlockedHelp?: boolean;
  onShow?: () => void;
  onResult?: (result: PromptResult) => void;
}

export function promptForNotifications(options: PromptOptions): Promise<PromptResult>;
/** Forgets earlier "Not now" answers for this instance. */
export function resetNotificationPrompt(instanceId: string): void;
