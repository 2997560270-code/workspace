import { describe, expect, test } from "vitest";
import { loadFromLocalStorage, saveToLocalStorage, type StorageLike } from "../../src/features/storage/local-persistence";

describe("local persistence", () => {
  function createMemoryStorage(): StorageLike {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); }
    };
  }

  test("saves and loads JSON data from localStorage", () => {
    const storage = createMemoryStorage();
    const records = [{ id: "record-1", title: "AI+ / 客户咨询", score: 3.2 }];

    saveToLocalStorage(storage, "pd:test-records", records);

    expect(loadFromLocalStorage(storage, "pd:test-records", [])).toEqual(records);
  });

  test("returns fallback when stored JSON is invalid", () => {
    const storage = createMemoryStorage();
    storage.setItem("pd:broken", "not-json");

    expect(loadFromLocalStorage(storage, "pd:broken", [{ id: "fallback" }])).toEqual([{ id: "fallback" }]);
  });
});
