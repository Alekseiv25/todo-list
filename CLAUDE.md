# CLAUDE.md — todo-list

A single-page to-do list: add, edit, complete, delete, search and filter tasks, light/dark theme.
Runs entirely in the browser; data lives in `localStorage`. No backend, no network calls.

## Hard rules
- Keep `src/ts/todo.ts` free of DOM access — it is the unit-tested core. UI code goes in `src/ts/app.ts`.
- Set user text with `textContent` / element properties, never `innerHTML` (XSS).
- The `localStorage` key `TODO-LIST` and its item shape `{id, text, checked, date}` are a compatibility
  contract with lists saved by earlier versions. Change them only with a migration in `TodoStore.load`.
- `dist/` is committed on purpose (static hosting). Regenerate it with `npm run build`, never by hand.
  GitHub Pages does not serve this copy: `.github/workflows/pages.yml` rebuilds `dist/` from source on
  every push to `main` and deploys that (repo setting: Settings → Pages → Source: GitHub Actions).

## Commands
| What | Command |
|---|---|
| Dev server (opens browser, port 1234) | `npm start` |
| Unit tests | `npm test` |
| Type-check | `npm run typecheck` |
| Rebuild `dist/` | `npm run build` |
| Quick gate (type-check + tests) | `./dc check quick` |
| Full gate (quick + production build to `.dc/build`) | `./dc check full` |
| Background dev server on `${PORT:-1234}` / stop it | `./dc up` / `./dc down` |

`./dc` reads an optional `.env` (only `PORT` is used) and keeps its state in `.dc/` (git-ignored).

## Layout
| Path | Holds |
|---|---|
| `index.html` | Page shell; inline script applies the saved theme before first paint |
| `src/ts/todo.ts` | `TodoStore`: list state, persistence, filtering, counts |
| `src/ts/todo.test.ts` | Vitest unit tests for `TodoStore` |
| `src/ts/app.ts` | DOM rendering, event wiring, theme toggle |
| `src/ts/main.ts` | Entry point |
| `src/styles/main.scss` | Styles; theme colours are CSS variables switched by `html[data-theme]` |
| `dist/` | Built site (generated) |
| `.github/workflows/pages.yml` | GitHub Pages deploy: quick gate, build, publish `dist/` |

## Landmines
- npm 12 blocks dependency install scripts by default; Parcel and Vitest work without them here. If a
  native module complains, run `npm install-scripts ls` and approve it.
- There are no browser (end-to-end) tests; UI behaviour is checked by hand or with Playwright.

## Standards (read at their installed path; do not copy into this repo)
- Context architecture: `/usr/lib/jaahd/docs/policies/context-architecture.md`
- Agent instrumentation: `/usr/lib/jaahd/docs/policies/agentic-instrumentation.md`
- Onboarding pattern: `/usr/lib/jaahd/docs/patterns/jaah-onboarding.md`
