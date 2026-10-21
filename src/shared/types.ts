export type ProfileStatus = 'idle' | 'running' | 'error';
export type ProxyScheme = 'http' | 'https' | 'socks5';

export interface Group {
  id: string;
  name: string;
  createdAt: number;
}

export interface Proxy {
  id: string;
  name: string;
  scheme: ProxyScheme;
  host: string;
  port: number;
  username: string | null;
  // password is NEVER in this type — never sent to renderer
  lastTestIp: string | null;
  lastTestCountry: string | null;
  lastTestLatencyMs: number | null;
  lastTestedAt: number | null;
  lastTestTimezone?: string | null | undefined;
  lastTestLoc?: string | null | undefined;
}

export interface Profile {
  id: string;
  name: string;
  groupId: string | null;
  proxyId: string | null;
  notes: string;
  status: ProfileStatus;
  userDataDir: string;
  createdAt: number;
  updatedAt: number;
  lastLaunchedAt: number | null;
  tags: string[]; // tag names, joined from profile_tags
  fingerprint?: FingerprintConfig | null | undefined;
  extensions?: string[] | undefined;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface ProxyTestResult {
  ip: string;
  country: string;
  latencyMs: number;
  timezone?: string | undefined;
  loc?: string | undefined;
  city?: string | undefined;
  languages?: string[] | undefined;
}

export interface AppSettings {
  userDataDir: string;
  customExecutablePath: string | null;
  apiPort: number;
  apiToken: string;
  apiEnabled: boolean;
}

export type CookieFormat = 'json' | 'netscape';

export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number | undefined;
  httpOnly?: boolean | undefined;
  secure?: boolean | undefined;
  sameSite?: 'Strict' | 'Lax' | 'None' | undefined;
}

export type ProxyAssignmentMode = 'none' | 'sequential' | 'random' | 'specific';

export interface BulkCreateProfilesOptions {
  count: number;
  namePrefix: string;
  templateId?: string | undefined;
  groupId?: string | null | undefined;
  proxyMode?: ProxyAssignmentMode | undefined;
  specificProxyId?: string | null | undefined;
  tags?: string[] | undefined;
}

export type FingerprintOS = 'windows' | 'macos' | 'linux';
export type WebRtcPolicy = 'proxy-only' | 'disabled' | 'real';
export type NoiseMode = 'noise' | 'real';

export interface UaMetadataBrand {
  brand: string;
  version: string;
}

export interface UaMetadata {
  brands: UaMetadataBrand[];
  fullVersionList?: UaMetadataBrand[] | undefined;
  platform: string;
  platformVersion: string;
  architecture: string;
  model: string;
  mobile: boolean;
  bitness?: string | undefined;
}

export interface ScreenConfig {
  width: number;
  height: number;
  dpr: number;
}

export interface WebGlConfig {
  vendor: string;
  renderer: string;
  noise: boolean;
}

export interface MediaDevicesConfig {
  audioIn: number;
  audioOut: number;
  videoIn: number;
}

export interface FingerprintConfig {
  seed: string; // stable per profile; drives all noise
  os: FingerprintOS;
  browserVersion: string; // must match installed Chromium major
  userAgent: string;
  uaMetadata: UaMetadata;
  screen: ScreenConfig;
  hardwareConcurrency: number;
  deviceMemory: number;
  languages: string[];
  timezone: string; // IANA
  geolocation?: { lat: number; lon: number; accuracy: number } | undefined;
  webrtc: WebRtcPolicy;
  canvas: NoiseMode;
  webgl: WebGlConfig;
  audio: NoiseMode;
  fonts: string[];
  mediaDevices: MediaDevicesConfig;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warn';
}

export interface FingerprintTemplate {
  id: string;
  name: string;
  os: FingerprintOS;
  screenResolutions: ScreenConfig[];
  hardwareConcurrencyOptions: number[];
  deviceMemoryOptions: number[];
  gpuOptions: Array<{ vendor: string; renderer: string }>;
  defaultFonts: string[];
}

export type ActivityEntityType = 'profile' | 'proxy' | 'group' | 'auth' | 'settings';

export interface ActivityLog {
  id: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string | null;
  details: string | null;
  createdAt: number;
}

export type PlanType = 'trial' | 'active' | 'expired';

export interface User {
  id: string;
  identifier: string; // email or phone number
  deviceId: string;
  planType: PlanType;
  trialEndsAt: number;
  subscriptionEndsAt: number | null;
  createdAt: number;
  lastLoginAt: number;
}

export interface AuthSession {
  user: User | null;
  deviceId: string;
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
  daysRemaining: number;
  canLaunchBrowser: boolean;
  trialDeniedReason?: string | null;
}

export type CryptoCurrency = 'USDT_TRC20' | 'USDT_ERC20' | 'BTC' | 'ETH' | 'SOL';

export interface CryptoWalletInfo {
  currency: CryptoCurrency;
  network: string;
  name: string;
  address: string;
  amountUsd: number;
  qrPayload?: string;
}

export interface CryptoTransaction {
  id: string;
  userId: string;
  currency: CryptoCurrency;
  amountUsd: number;
  txHash: string;
  status: string;
  createdAt: number;
}


