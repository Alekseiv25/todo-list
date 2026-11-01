import { describe, expect, it } from "vitest";
import { STORAGE_KEY, TodoStore, type KeyValueStorage } from "./todo";

const memoryStorage = (initial?: string): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};

const fixedNow = () => new Date(2024, 0, 15);

describe("TodoStore", () => {
  it("adds trimmed items and ignores blank text", () => {
    const store = new TodoStore(memoryStorage(), fixedNow);
    expect(store.add("   ")).toBeNull();
    const todo = store.add("  buy milk ");
    expect(todo).toMatchObject({ text: "buy milk", checked: false, date: fixedNow().toLocaleDateString() });
    expect(store.counts()).toEqual({ all: 1, active: 1, completed: 0 });
  });

  it("persists every change under the old storage key", () => {
    const storage = memoryStorage();
    const store = new TodoStore(storage, fixedNow);
    const { id } = store.add("a")!;
    store.toggle(id);
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).toEqual([
      { id, text: "a", checked: true, date: fixedNow().toLocaleDateString() },
    ]);
  });

  it("loads a list saved by the old app and survives corrupt data", () => {
    const saved = JSON.stringify([{ id: "x1", checked: true, text: "old", date: "1/1/2022" }, { bogus: 1 }]);
    expect(new TodoStore(memoryStorage(saved)).all()).toEqual([
      { id: "x1", checked: true, text: "old", date: "1/1/2022" },
    ]);
    expect(new TodoStore(memoryStorage("{not json")).all()).toEqual([]);
  });

  it("toggles completion both ways", () => {
    const store = new TodoStore(memoryStorage());
    const { id } = store.add("a")!;
    store.toggle(id);
    expect(store.counts().completed).toBe(1);
    store.toggle(id);
    expect(store.counts().completed).toBe(0);
  });

  it("edits text and rejects a blank edit", () => {
    const store = new TodoStore(memoryStorage());
    const { id } = store.add("a")!;
    expect(store.edit(id, "  b ")).toBe(true);
    expect(store.edit(id, "  ")).toBe(false);
    expect(store.all()[0].text).toBe("b");
  });

  it("removes one, the last, or all items", () => {
    const store = new TodoStore(memoryStorage());
    const a = store.add("a")!;
    store.add("b");
    store.add("c");
    store.remove(a.id);
    store.removeLast();
    expect(store.all().map((t) => t.text)).toEqual(["b"]);
    store.clear();
    expect(store.counts().all).toBe(0);
  });

  it("filters by status and case-insensitive search", () => {
    const store = new TodoStore(memoryStorage());
    store.add("Buy Milk");
    const done = store.add("buy bread")!;
    store.add("call mom");
    store.toggle(done.id);
    const texts = (f: Parameters<TodoStore["visible"]>[0], q?: string) => store.visible(f, q).map((t) => t.text);
    expect(texts("all", "BUY")).toEqual(["Buy Milk", "buy bread"]);
    expect(texts("active")).toEqual(["Buy Milk", "call mom"]);
    expect(texts("completed")).toEqual(["buy bread"]);
    expect(texts("completed", "milk")).toEqual([]);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const store = new TodoStore(memoryStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.add("a");
    off();
    store.add("b");
    expect(calls).toBe(1);
  });
});
