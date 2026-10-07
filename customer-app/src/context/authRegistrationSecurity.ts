import type { User } from '@supabase/supabase-js';

export type RegistrationRole = 'PATIENT' | 'STUDENT';
export type RegistrationIntent = {
  flow: 'login' | 'register';
  role?: RegistrationRole;
  createdAt: number;
  nonce: string;
};

export const AUTH_INTENT_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

const timestampInRegistrationWindow = (value: string | null | undefined, intentCreatedAt: number, now: number) => {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= intentCreatedAt - CLOCK_SKEW_MS && timestamp <= now + CLOCK_SKEW_MS;
};

const hasGoogleIdentity = (user: User) => {
  const providers = [user.app_metadata?.provider, ...(user.app_metadata?.providers || []), ...(user.identities || []).map((identity) => identity.provider)]
    .filter((provider): provider is string => typeof provider === 'string');
  return providers.length === 0 || providers.includes('google');
};

export const isValidRegistrationIntent = (intent: RegistrationIntent | null, now = Date.now()) => {
  if (!intent || intent.flow !== 'register' || !intent.role || !['PATIENT', 'STUDENT'].includes(intent.role)) return false;
  if (!Number.isSafeInteger(intent.createdAt) || !intent.nonce || intent.nonce.length < 16) return false;
  const age = now - intent.createdAt;
  return age >= -CLOCK_SKEW_MS && age <= AUTH_INTENT_TTL_MS;
};

export const isFreshRegistrationCandidate = (user: User, intent: RegistrationIntent | null, profileCreatedAt?: string | null, now = Date.now()) => {
  if (!isValidRegistrationIntent(intent, now) || !hasGoogleIdentity(user) || !intent) return false;
  if (!timestampInRegistrationWindow(user.created_at, intent.createdAt, now)) return false;
  if (user.last_sign_in_at && !timestampInRegistrationWindow(user.last_sign_in_at, intent.createdAt, now)) return false;
  if (profileCreatedAt !== undefined && !timestampInRegistrationWindow(profileCreatedAt, intent.createdAt, now)) return false;
  return true;
};
