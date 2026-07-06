export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const PRODUCT_DRILL_STORAGE_KEYS = {
  products: "product-drill:mvp:products",
  historyRecords: "product-drill:mvp:history-records"
} as const;

export function loadFromLocalStorage<T>(storage: StorageLike | null | undefined, key: string, fallback: T): T {
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToLocalStorage<T>(storage: StorageLike | null | undefined, key: string, value: T): void {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}
