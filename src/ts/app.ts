import { TodoStore, type Filter, type Todo } from "./todo";

const THEME_KEY = "TODO-LIST-THEME";
type Theme = "light" | "dark";

/** Small element helper: tag, attributes/properties, children. Text is always set as text, never HTML. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const { dataset, ...rest } = props;
  const el = Object.assign(document.createElement(tag), rest);
  if (dataset) Object.assign(el.dataset, dataset);
  el.append(...children);
  return el;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function initTheme(button: HTMLButtonElement): void {
  const saved = safeGet(THEME_KEY);
  let theme: Theme =
    saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  const apply = () => {
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === "dark" ? "☀️" : "🌙";
    button.title = button.ariaLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  };
  button.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not persisted; the toggle still works for this visit.
    }
    apply();
  });
  apply();
}

export function mountApp(root: HTMLElement, store: TodoStore): void {
  let filter: Filter = "all";
  let query = "";
  let editingId: string | null = null;

  const themeBtn = h("button", { type: "button", className: "icon-btn theme-toggle" });
  const newInput = h("input", {
    type: "text",
    className: "field",
    placeholder: "What needs to be done?",
    ariaLabel: "New to-do",
    maxLength: 500,
  });
  const addForm = h(
    "form",
    { className: "add-form" },
    newInput,
    h("button", { type: "submit", className: "btn btn-primary" }, "Add"),
  );
  const searchInput = h("input", {
    type: "search",
    className: "field",
    placeholder: "Search…",
    ariaLabel: "Search to-dos",
  });
  const filterBtns = (["all", "active", "completed"] as const).map((f) =>
    h("button", { type: "button", className: "chip", dataset: { filter: f } }, f[0].toUpperCase() + f.slice(1)),
  );
  const counters = h("p", { className: "counters", ariaLive: "polite" });
  const list = h("ul", { className: "todo-list" });
  const empty = h("p", { className: "empty" });
  const deleteLastBtn = h("button", { type: "button", className: "btn btn-ghost" }, "Delete last");
  const deleteAllBtn = h("button", { type: "button", className: "btn btn-danger" }, "Delete all");

  root.replaceChildren(
    h("header", { className: "app-header" }, h("h1", {}, "To-do list"), themeBtn),
    addForm,
    h(
      "div",
      { className: "toolbar" },
      searchInput,
      h("div", { className: "chips", role: "group", ariaLabel: "Filter" }, ...filterBtns),
    ),
    list,
    empty,
    h(
      "footer",
      { className: "app-footer" },
      counters,
      h("div", { className: "footer-actions" }, deleteLastBtn, deleteAllBtn),
    ),
  );
  initTheme(themeBtn);

  const renderItem = (todo: Todo): HTMLLIElement => {
    const checkbox = h("input", {
      type: "checkbox",
      className: "check",
      checked: todo.checked,
      ariaLabel: `Mark "${todo.text}" as ${todo.checked ? "not done" : "done"}`,
      dataset: { action: "toggle" },
    });
    const body =
      editingId === todo.id
        ? h("input", {
            type: "text",
            className: "field edit-input",
            value: todo.text,
            ariaLabel: "Edit to-do",
            maxLength: 500,
          })
        : h("span", { className: "text", title: "Double-click to edit" }, todo.text);
    return h(
      "li",
      { className: `todo${todo.checked ? " done" : ""}`, dataset: { id: todo.id } },
      checkbox,
      h("div", { className: "body" }, body, h("time", { className: "date" }, todo.date)),
      h("button", { type: "button", className: "icon-btn", title: "Edit", ariaLabel: "Edit", dataset: { action: "edit" } }, "✎"),
      h("button", { type: "button", className: "icon-btn", title: "Delete", ariaLabel: "Delete", dataset: { action: "delete" } }, "✕"),
    );
  };

  const render = () => {
    const items = store.visible(filter, query);
    list.replaceChildren(...items.map(renderItem));
    const c = store.counts();
    counters.textContent = `All: ${c.all} · Active: ${c.active} · Completed: ${c.completed}`;
    empty.textContent = c.all === 0 ? "Nothing to do yet — add your first task above." : items.length ? "" : "No tasks match.";
    empty.hidden = !empty.textContent;
    filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
    deleteLastBtn.disabled = deleteAllBtn.disabled = c.all === 0;
    const editor = list.querySelector<HTMLInputElement>(".edit-input");
    if (editor) {
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    }
  };

  const startEdit = (id: string) => {
    editingId = id;
    render();
  };
  const finishEdit = (save: boolean) => {
    const editor = list.querySelector<HTMLInputElement>(".edit-input");
    const id = editingId;
    if (!id) return;
    editingId = null;
    if (save && editor) store.edit(id, editor.value); // a blank edit keeps the old text
    render();
  };

  store.subscribe(render);

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (store.add(newInput.value)) newInput.value = "";
    newInput.focus();
  });
  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    render();
  });
  filterBtns.forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter as Filter;
      render();
    }),
  );
  deleteLastBtn.addEventListener("click", () => store.removeLast());
  deleteAllBtn.addEventListener("click", () => {
    if (confirm("Delete all to-dos?")) store.clear();
  });

  list.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const id = target.closest<HTMLElement>(".todo")?.dataset.id;
    const action = target.dataset.action;
    if (!id || !action) return;
    // Focus moved from an open editor to a control in the list: save the edit, then act.
    if (editingId && !(action === "edit" && id === editingId)) finishEdit(true);
    if (action === "toggle") store.toggle(id);
    if (action === "delete") store.remove(id);
    if (action === "edit") startEdit(id);
  });
  list.addEventListener("dblclick", (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>(".todo")?.dataset.id;
    if (id && (e.target as HTMLElement).classList.contains("text")) startEdit(id);
  });
  list.addEventListener("keydown", (e) => {
    if (!(e.target as HTMLElement).classList.contains("edit-input") || e.isComposing) return;
    if (e.key === "Enter") finishEdit(true);
    if (e.key === "Escape") finishEdit(false);
  });
  list.addEventListener("focusout", (e) => {
    // Leave clicks on other list controls to the click handler; re-rendering here would swallow them.
    if (e.relatedTarget instanceof Node && list.contains(e.relatedTarget)) return;
    if ((e.target as HTMLElement).classList.contains("edit-input")) finishEdit(true);
  });

  render();
}
