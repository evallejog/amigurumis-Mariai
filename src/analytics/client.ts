import type { AnalyticsEventInput } from '../types/analytics';

const CONSENT_KEY = 'amigurumis_mariai_analytics_consent_v1';
const SESSION_KEY = 'amigurumis_mariai_analytics_session_v1';
const ANON_KEY = 'amigurumis_mariai_analytics_anon_v1';

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function hasAnalyticsConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
}

export function setAnalyticsConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    if (!granted) { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(ANON_KEY); }
  } catch {}
}

export function getAnalyticsIdentity(): { sessionId: string; anonymousId: string } | null {
  if (!hasAnalyticsConsent()) return null;
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    let anonymousId = sessionStorage.getItem(ANON_KEY);
    if (!sessionId) sessionStorage.setItem(SESSION_KEY, (sessionId = makeId()));
    if (!anonymousId) sessionStorage.setItem(ANON_KEY, (anonymousId = makeId()));
    return { sessionId, anonymousId };
  } catch { return null; }
}

export function track(event: Omit<AnalyticsEventInput, 'session_id' | 'anonymous_id' | 'timestamp' | 'schema_version'>): void {
  const identity = getAnalyticsIdentity();
  if (!identity) return;
  const payload: AnalyticsEventInput = {
    ...event,
    session_id: identity.sessionId,
    anonymous_id: identity.anonymousId,
    timestamp: new Date().toISOString(),
    schema_version: '1.0.0',
  };
  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [payload] }),
    keepalive: true,
  }).catch(() => {});
}

export function getAnalyticsSessionId(): string | null { return getAnalyticsIdentity()?.sessionId || null; }
