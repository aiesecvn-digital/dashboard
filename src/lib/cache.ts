// Cache utility for storing data locally
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class LocalCache {
  private static instance: LocalCache;
  private cache: Map<string, CacheItem<any>> = new Map();

  static getInstance(): LocalCache {
    if (!LocalCache.instance) {
      LocalCache.instance = new LocalCache();
    }
    return LocalCache.instance;
  }

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache size for debugging
  size(): number {
    return this.cache.size;
  }
}

// Cache keys
export const CACHE_KEYS = {
  UTM_LINKS: 'utm_links',
  UNIVERSITY_MAPPING: 'university_mapping',
  PHASES: 'phases',
  USER_PROFILE: 'user_profile',
  FORM_SUBMISSIONS: 'form_submissions',
  USERS_LIST: 'users_list'
} as const;

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  UTM_LINKS: 10 * 60 * 1000, // 10 minutes
  UNIVERSITY_MAPPING: 30 * 60 * 1000, // 30 minutes
  PHASES: 60 * 60 * 1000, // 1 hour
  USER_PROFILE: 5 * 60 * 1000, // 5 minutes
  FORM_SUBMISSIONS: 2 * 60 * 1000, // 2 minutes
  USERS_LIST: 5 * 60 * 1000 // 5 minutes
} as const;
