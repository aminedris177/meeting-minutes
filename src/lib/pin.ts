// الـ PIN: قفل للواجهة بس (مش تشفير للبيانات).
// بيتخزن hash بـ PBKDF2 + salt عشوائي — مش الرقم نفسه.
import { db, type AppDB } from '../db/schema';
import { getSetting, SETTING, setSetting } from '../db/repos/settings';

export interface StoredPin {
  salt: string; // base64
  hash: string; // base64
  iterations: number;
}

export const PIN_MIN = 4;
export const PIN_MAX = 8;
const ITERATIONS = 100_000;

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}

export async function hashPin(pin: string): Promise<StoredPin> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS };
}

export async function verifyPin(pin: string, stored: StoredPin): Promise<boolean> {
  const h = await derive(pin, unb64(stored.salt), stored.iterations);
  // مقارنة بطول ثابت
  if (h.length !== stored.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return diff === 0;
}

export async function getPin(d: AppDB = db): Promise<StoredPin | undefined> {
  return getSetting<StoredPin>(SETTING.pin, d);
}

export async function setPin(pin: string | null, d: AppDB = db): Promise<void> {
  if (pin === null) return setSetting(SETTING.pin, undefined, d);
  if (!isValidPin(pin)) throw new Error('Invalid PIN');
  await setSetting(SETTING.pin, await hashPin(pin), d);
}
