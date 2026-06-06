// Simple in-memory LRU cache for recently viewed profile cards.
// Avoids repeated network calls when popping the profile popup on the
// same user multiple times in a short window.

import type { ProfileCard } from '@/src/types/profile';

const TTL_MS = 60 * 1000; // 1 minute
const MAX_ENTRIES = 30;

type Entry = {
  data: ProfileCard;
  fetchedAt: number;
};

const cache = new Map<string, Entry>();

export function getCachedProfile(userId: string): ProfileCard | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(userId);
    return null;
  }
  // Refresh LRU position
  cache.delete(userId);
  cache.set(userId, entry);
  return entry.data;
}

export function setCachedProfile(userId: string, data: ProfileCard) {
  if (cache.has(userId)) cache.delete(userId);
  cache.set(userId, { data, fetchedAt: Date.now() });
  // Evict oldest if exceeded
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function invalidateProfile(userId: string) {
  cache.delete(userId);
}

export function clearProfileCache() {
  cache.clear();
}
