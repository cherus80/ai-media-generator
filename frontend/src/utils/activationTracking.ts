import type { ActivationEventContextPayload, ActivationEventPayload } from '../types/activation';
import { getStoredReferralCode } from './referralStorage';

const SESSION_ID_KEY = 'activation-session-id';
const FLOW_ID_KEY = 'activation-flow-id';
const ANON_ID_KEY = 'activation-anon-id';
const ENTRY_CONTEXT_KEY = 'activation-entry-context';
const UTM_CONTEXT_KEY = 'activation-utm-context';

type EntryContext = {
  route?: string | null;
  entry_source?: string | null;
};

type UtmContext = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

const safeStorage = (storage: Storage | undefined | null): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return storage ?? null;
};

const generateId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const readJson = <T>(storage: Storage | null, key: string): T | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (storage: Storage | null, key: string, value: unknown) => {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
};

export const getActivationSessionId = (): string | null => {
  const storage = safeStorage(typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!storage) return null;
  const existing = storage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const next = generateId('sess');
  storage.setItem(SESSION_ID_KEY, next);
  return next;
};

export const getActivationAnonymousId = (): string | null => {
  const storage = safeStorage(typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) return null;
  const existing = storage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  const next = generateId('anon');
  storage.setItem(ANON_ID_KEY, next);
  return next;
};

export const getActivationFlowId = (): string | null => {
  const storage = safeStorage(typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!storage) return null;
  const existing = storage.getItem(FLOW_ID_KEY);
  if (existing) return existing;
  const next = generateId('flow');
  storage.setItem(FLOW_ID_KEY, next);
  return next;
};

export const resetActivationFlowId = (): string | null => {
  const storage = safeStorage(typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!storage) return null;
  const next = generateId('flow');
  storage.setItem(FLOW_ID_KEY, next);
  return next;
};

const captureUtmFromLocation = (): UtmContext => {
  if (typeof window === 'undefined') {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const context: UtmContext = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
  };
  return context;
};

export const setActivationEntryContext = (context: EntryContext) => {
  const sessionStorageRef = safeStorage(typeof window !== 'undefined' ? window.sessionStorage : null);
  if (!sessionStorageRef) return;

  writeJson(sessionStorageRef, ENTRY_CONTEXT_KEY, context);

  const utm = captureUtmFromLocation();
  if (Object.values(utm).some(Boolean)) {
    writeJson(sessionStorageRef, UTM_CONTEXT_KEY, utm);
  }

  getActivationSessionId();
  getActivationFlowId();
  getActivationAnonymousId();
};

export function getActivationBasePayload(): ActivationEventContextPayload;
export function getActivationBasePayload(
  overrides: Partial<ActivationEventPayload> & Pick<ActivationEventPayload, 'event_name'>
): ActivationEventPayload;
export function getActivationBasePayload(
  overrides: ActivationEventContextPayload = {}
): ActivationEventContextPayload {
  const sessionStorageRef = safeStorage(typeof window !== 'undefined' ? window.sessionStorage : null);
  const entryContext = readJson<EntryContext>(sessionStorageRef, ENTRY_CONTEXT_KEY) || {};
  const utmContext = readJson<UtmContext>(sessionStorageRef, UTM_CONTEXT_KEY) || {};

  return {
    anonymous_id: getActivationAnonymousId(),
    session_id: getActivationSessionId(),
    flow_id: getActivationFlowId(),
    route: entryContext.route || (typeof window !== 'undefined' ? window.location.pathname : null),
    entry_source: entryContext.entry_source || null,
    utm_source: utmContext.utm_source || null,
    utm_medium: utmContext.utm_medium || null,
    utm_campaign: utmContext.utm_campaign || null,
    utm_content: utmContext.utm_content || null,
    utm_term: utmContext.utm_term || null,
    referral_code: getStoredReferralCode(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
};

export const buildActivationHeaders = (): Record<string, string> => {
  const payload = getActivationBasePayload();
  const headers: Record<string, string> = {};
  if (payload.anonymous_id) headers['X-Activation-Anon-Id'] = payload.anonymous_id;
  if (payload.session_id) headers['X-Activation-Session-Id'] = payload.session_id;
  if (payload.flow_id) headers['X-Activation-Flow-Id'] = payload.flow_id;
  if (payload.route) headers['X-Activation-Route'] = payload.route;
  if (payload.entry_source) headers['X-Activation-Entry-Source'] = payload.entry_source;
  if (payload.utm_source) headers['X-Activation-Utm-Source'] = payload.utm_source;
  if (payload.utm_medium) headers['X-Activation-Utm-Medium'] = payload.utm_medium;
  if (payload.utm_campaign) headers['X-Activation-Utm-Campaign'] = payload.utm_campaign;
  if (payload.utm_content) headers['X-Activation-Utm-Content'] = payload.utm_content;
  if (payload.utm_term) headers['X-Activation-Utm-Term'] = payload.utm_term;
  if (payload.referral_code) headers['X-Activation-Referral-Code'] = payload.referral_code;
  return headers;
};
