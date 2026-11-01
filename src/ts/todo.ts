/** One to-do item. The field names match what the old app saved, so existing lists load unchanged. */
export interface Todo {
  id: string;
  text: string;
  checked: boolean;
  /** Creation date, already formatted for display. */
  date: string;
}

export type Filter = "all" | "active" | "completed";

export interface Counts {
  all: number;
  active: number;
  completed: number;
}

/** The slice of the Web Storage API the store needs; tests pass an in-memory stand-in. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export const STORAGE_KEY = "TODO-LIST";

const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2);

const isTodo = (value: unknown): value is Todo => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.text === "string";
};

/** Holds the list, persists every change, and notifies subscribers. No DOM access. */
export class TodoStore {
  private items: Todo[];
  private listeners = new Set<() => void>();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.items = this.load();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  all(): Todo[] {
    return this.items.map((t) => ({ ...t }));
  }

  /** Items matching the filter and a case-insensitive text search. */
  visible(filter: Filter, query = ""): Todo[] {
    const q = query.trim().toLocaleLowerCase();
    return this.all().filter(
      (t) =>
        (filter === "all" || (filter === "completed") === t.checked) &&
        (!q || t.text.toLocaleLowerCase().includes(q)),
    );
  }

  counts(): Counts {
    const completed = this.items.filter((t) => t.checked).length;
    return { all: this.items.length, active: this.items.length - completed, completed };
  }

  /** Adds an item; blank text is ignored. Returns the new item, or null. */
  add(text: string): Todo | null {
    const clean = text.trim();
    if (!clean) return null;
    const todo: Todo = { id: uid(), text: clean, checked: false, date: this.now().toLocaleDateString() };
    this.items.push(todo);
    this.commit();
    return { ...todo };
  }

  toggle(id: string): void {
    const todo = this.items.find((t) => t.id === id);
    if (!todo) return;
    todo.checked = !todo.checked;
    this.commit();
  }

  /** Changes an item's text; blank text is rejected (returns false) and the old text kept. */
  edit(id: string, text: string): boolean {
    const clean = text.trim();
    const todo = this.items.find((t) => t.id === id);
    if (!todo || !clean) return false;
    if (todo.text !== clean) {
      todo.text = clean;
      this.commit();
    }
    return true;
  }

  remove(id: string): void {
    const before = this.items.length;
    this.items = this.items.filter((t) => t.id !== id);
    if (this.items.length !== before) this.commit();
  }

  removeLast(): void {
    if (this.items.length) {
      this.items.pop();
      this.commit();
    }
  }

  clear(): void {
    if (this.items.length) {
      this.items = [];
      this.commit();
    }
  }

  private load(): Todo[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed)
        ? parsed.filter(isTodo).map((t) => ({ id: t.id, text: t.text, checked: !!t.checked, date: String(t.date ?? "") }))
        : [];
    } catch {
      return [];
    }
  }

  private commit(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
    this.listeners.forEach((l) => l());
  }
}
