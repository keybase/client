# Vite Migration — Spike Plan (whole desktop app + Storybook)

## Purpose

Evaluate a **Vite** port of the desktop bundler as a head-to-head alternative to the
**Rspack** port already landed on `nojima/HOTPOT-rspack` (commit `0f9519a1c3`). Scope is the
*entire* desktop toolchain — dev (hot), prod bundles, electron packaging, **and** Storybook —
not just Storybook. This doc folds in everything the Rspack port taught us so the two can be
compared on equal footing.

Companion doc: `plans/rspack-migration.md`. Read it first — the "current surface" and
constraints there are the shared baseline.

**Base branch: `master`.** The spike is cut from `master`, *not* from `nojima/HOTPOT-rspack`,
so the two migrations stay independent and comparable. That means the 6 touchpoint files are in
their **webpack** state (the Rspack edits are not present); the Rspack learnings below are
transferred *knowledge*, not a diff to build on. The dep removals in Step 1 target master's
webpack-era `package.json`.

## TL;DR up front

Vite is **not a port** of our webpack config the way Rspack was — it's a **partial rewrite of
the dev harness + a main-process change**. The webpack config model does not survive. The two
hard parts that Rspack did *not* have:

1. **Electron dev origin.** Vite's dev server serves an **unbundled ESM module graph over
   `http://localhost:PORT`**. The renderer must be loaded **from that http origin** in dev —
   it can **not** be loaded from `file://` (as webpack/rspack do, fetching only the bundle
   from the dev server). This forces a main-process change: `loadURL('http://localhost:…')`
   in dev for the main window **and every remote window**. (Contrast: the Rspack port kept
   `file://` and only hit a cross-origin 403 on the bundle fetch — see
   `project_rspack_migration` memory.)
2. **`module.hot` → `import.meta.hot`.** Vite HMR is ESM-native; there is no webpack-style
   `module.hot`. Our app calls `module.hot?.accept(...)` in real code and would need rewriting.

Everything else (react-compiler, aliases, define, css, assets, Storybook) has a clean Vite
path. Storybook is actually *easier* on Vite than Rspack (`@storybook/react-vite@10.4.6` is an
exact-version match; **no** rspack builder exists for Storybook 10).

## Why consider Vite at all (given Rspack already works)

- **Vite 8 is Rolldown-based** (Rust Rollup) + esbuild — so the "Rust bundler speed" argument
  that motivated Rspack **also applies to Vite 8**. Vite is no longer the "slow esbuild-dev /
  Rollup-prod" story from older versions.
- First-party, enormous ecosystem; `@vitejs/plugin-react@6` **lists
  `babel-plugin-react-compiler` as a peer dep** — react-compiler is a supported, documented
  path (via `@rolldown/plugin-babel`), not a hack.
- Storybook's default/first-class builder is Vite; exact version match to our SB 10.4.6.
- Kills the same `@pmmmwh` + wds internal-path coupling bug class Rspack killed
  (`project_wds6_react_refresh_sockjs`) — Vite fast-refresh is built into `@vitejs/plugin-react`.

## Why this is still a bigger job than Rspack

Rspack preserved the **webpack config object model** — it was a mechanical port (imports +
plugin-name swaps + a few type fixes). Vite discards that model:

- Multi-target `electron-main | electron-preload | web` in one `webpack([...])` call →
  Vite needs **separate builds** (a web build for the renderer, node builds for main/preload),
  orchestrated by `vite-plugin-electron` or hand-rolled `build()` calls.
- Multi-entry renderer (`main`, `remote`) + the 6 HTML shells → Vite **multi-page** via
  `build.rollupOptions.input`, and the HTML-generation model is different (Vite wants real
  `index.html` files as graph roots, not a `templateContent` callback).
- Dev is a running ESM server, not "emit bundle to disk + electron loads file://".

## Current surface — 6 touchpoints (learned from the Rspack port)

The Rspack plan said "3 touchpoints"; the real count is **6**. All 6 must be handled for Vite:

1. `shared/desktop/webpack.config.mts` (~445 lines) → `vite.config.ts` (rewrite, not port).
2. `shared/desktop/yarn-helper/electron.mts` — dev orchestrator. `webpack()` compilers +
   `RspackDevServer`/`WebpackDevServer` → Vite `createServer()` (renderer) + `build({watch})`
   or `vite-plugin-electron` (main/preload).
3. `shared/desktop/yarn-helper/build.mts` — prod CLI. webpack/rspack CLI → `vite build`.
4. `shared/desktop/package.desktop.mts` — programmatic packaging build. `webpack(cfg, cb)` /
   `rspack(...)` → Vite JS API `import {build} from 'vite'`.
5. `shared/.storybook/main.ts` — `@storybook/react-webpack5` + `webpackFinal` →
   `@storybook/react-vite` + `viteFinal`.
6. **Main-process renderer loading** — `desktop/app/html-root.desktop.tsx` (`htmlURL()` builds
   `file://…/dist/<name>.html`), consumed by `desktop/app/main-window.desktop.tsx:343`
   (`loadURL`), `desktop/app/menu-bar.desktop.tsx:139`, and
   `desktop/app/ipc-handlers.desktop.tsx:567` (`remoteURL` for remote windows). **This is the
   Vite-specific touchpoint Rspack didn't need** — see Risk #1.

## Key constraints

### React Compiler stays babel (same as Rspack)
`babel-plugin-react-compiler` is babel-only (no SWC/native port). On Vite, use
`@vitejs/plugin-react@6` with its `babel: { plugins: [['babel-plugin-react-compiler', …]] }`
option — plugin-react runs babel via `@rolldown/plugin-babel`. Keep our `module-resolver` +
`react-native-web` babel plugins in that same babel pass. esbuild handles dep pre-bundling
only; app code goes through babel. **Net: same transform guarantees as today, no SWC shortcut.**

### Electron dev must load from http origin, not file:// (THE big one)
webpack/rspack: electron `loadURL('file://…/main.dev.html')`, the HTML's `<script>` fetches the
bundle from `http://localhost:4000`. Vite dev: the app *is* the ESM graph served by Vite; the
document itself must be `http://localhost:PORT/desktop/…/main.html`. So in **dev only**:
- `html-root.desktop.tsx` must return an `http://localhost:PORT/...` URL when `__DEV__`.
- Main window, menubar, and all remote windows (`remoteURL`) route through this.
- CSP (`makeCsp`) must allow the vite origin as `default-src`/`script-src`/`connect-src`
  (incl. the HMR websocket) — a broader change than the rspack CSP (which only needed the
  bundle host).
- Prod is unchanged (`file://…/dist`), so the branch is `__DEV__ ? http : file`.

### `module.hot` → `import.meta.hot`
Real usages to rewrite (found via the Rspack port):
`desktop/renderer/main2.desktop.tsx` (`module.hot.accept([...])` x3),
`desktop/remote/component-loader.desktop.tsx`, `router-v2/router.tsx`,
`app/index.native.tsx` (native/Metro — leave as-is; only desktop moves to Vite). Vite uses
`import.meta.hot?.accept(...)`. `@types/webpack-env`'s `module.hot` types do not apply on the
desktop side after this; keep `@types/webpack-env` only for the **native/Metro** side
(Metro still exposes `module.hot`).

### Aliases / null-module / ignored-modules / RN-web
`resolve.alias` in Vite supports `react-native$ → react-native-web` (exact `$`), string
targets, and our `desktop/stubs/*`. But webpack's two special forms need Vite equivalents:
- `alias[name] = false` (map to empty module — used for `react-native-reanimated` and via
  ignored-modules) → Vite has no `false` alias; use a small resolver plugin that returns
  `null-module.js` (or `\0empty`) for those ids. The `ignored-modules` + `native-only-modules`
  lists port directly into that plugin.
- Longest-first insertion ordering (subpath before parent) still matters — replicate.

### DefinePlugin → Vite `define`
`makeDefineValues` (`__DEV__`, `isMobile`, `isElectron`, `__VERSION__`, …) → Vite `define`
(raw text substitution, same semantics). Simpler than webpack; the `.storybook/main.ts` tsgo
"Excessive stack depth" DefinePlugin workaround (memory `webpack_tsgo_defineplugin`) is
webpack-typed and **disappears** on Vite.

### CSS / assets / null-loaded natives
- `style-loader` + `css-loader` → Vite built-in CSS (drop both loaders).
- `asset/resource` (images, ttf, emoji) → Vite asset handling (`import x from './a.png'`
  yields a URL; `assetsInclude` for `.ttf`). Mental-model change but well-trodden.
- `null-loader` for `*.native.*` / mock images → same resolver plugin returns empty module.

### IgnorePlugin equivalents
`moment/locale`, bare `lodash`, and `react` in the node layer → Vite `resolve.alias` to an
empty module or `rollupOptions.external` (node builds). Port the 3 IgnorePlugins case-by-case.

## Scope — steps

### Step 1 — deps
- Add (exact, per update-dependencies skill): `vite` 8.1.3, `@vitejs/plugin-react` 6.0.3,
  `@rolldown/plugin-babel` (peer of plugin-react, pin exact), `vite-plugin-electron` 1.1.0,
  `vite-plugin-electron-renderer` 1.0.0.
- Storybook: `@storybook/react-webpack5` → `@storybook/react-vite` 10.4.6.
- Remove after cutover: `webpack`, `webpack-cli`, `webpack-dev-server`, `webpack-merge`,
  `html-webpack-plugin`, `terser-webpack-plugin`, `@pmmmwh/react-refresh-webpack-plugin`,
  `style-loader`, `css-loader`, `null-loader`, `@storybook/react-webpack5`. **This is the run
  that finally deletes `webpack` from `node_modules`** (it's currently storybook-only —
  confirmed via `yarn why webpack`).
- Keep: `@babel/*`, `babel-plugin-react-compiler`, `babel-plugin-module-resolver`,
  `babel-plugin-react-native-web`, `babel-preset-expo`. Keep `@types/webpack-env` for
  native/Metro only.
- Check `@types/node` peer (vite 8 wants `>=22.12`); bump if needed.

### Step 2 — `vite.config.ts` (renderer / web)
Multi-page web build: `build.rollupOptions.input = { main: 'desktop/renderer/main.html',
remote: 'desktop/remote/remote.html', … }` with real HTML entry files (replaces the
`HtmlWebpackPlugin` `templateContent` callback + `renderHtmlTemplate`). `@vitejs/plugin-react`
with babel(react-compiler + module-resolver + rn-web). `define`, `resolve.alias` + the
empty-module resolver plugin, `assetsInclude`, CSP-aware `server` config.

### Step 3 — electron-main / preload (node targets)
Use `vite-plugin-electron` to build `desktop/app/node.desktop.tsx` (main) and
`desktop/renderer/preload.desktop.tsx` (preload) as node/electron-preload targets, or two
explicit `build({ build: { lib | ssr }, target: 'node' })` calls. Output filenames must still
be `node.bundle.js` / `preload.bundle.js` (electron packaging + `html-root.desktop.tsx`
`preloadPath` depend on them).

### Step 4 — dev orchestrator (`electron.mts`)
`createServer()` (Vite renderer dev server, ESM/HMR) + watch-mode node builds for main/preload
(restart electron on main/preload rebuild — reuse the existing restart loop). Launch electron
pointing at the Vite http URL. Replaces the `RspackDevServer`/`webpack().watch()` wiring; the
main/renderer-ready → launch/restart state machine mostly carries over.

### Step 5 — prod build (`build.mts` + `package.desktop.mts`)
- `build.mts`: webpack/rspack CLI → `vite build` (loads `vite.config.ts` natively).
- `package.desktop.mts`: `webpack(cfg, cb)` → `import {build} from 'vite'` (JS API), one call
  per target (web + main + preload). Verify Rollup output chunk names/paths match what electron
  packaging copies (`copySyncFolder('./dist', …)` globs `.js/.ttf/.png/.html/.map`).

### Step 6 — main-process loadURL (Vite-specific)
`html-root.desktop.tsx`: `__DEV__ ? 'http://localhost:PORT/…' : 'file://…/dist/…'`. Thread
through `main-window`, `menu-bar`, `ipc-handlers` `remoteURL`. Update `makeCsp` for the dev
http origin + HMR ws. Rewrite `module.hot` → `import.meta.hot` in the 3 desktop files.

### Step 7 — Storybook
`@storybook/react-vite` framework; port `webpackFinal` → `viteFinal` (same mutation shape:
aliases, define, babel/rn-web, null-load natives, ttf assets). Drop the tsgo DefinePlugin
widened-array cast. 74 `*.stories.tsx` must still render; keep `storybook:screenshot`.

## Risks to validate (ranked — highest first)

1. **Electron dev http-origin architecture** — the renderer + all remote windows loading from
   `http://localhost:PORT` in dev, CSP, preload wiring, and cookie/session/`file://`-relative
   assumptions in app code. Highest risk, no Rspack analog. Spike this FIRST — if it doesn't
   come together, stop.
2. **electron-main / preload node builds via Vite** — `vite-plugin-electron` is a small
   community plugin; our main process is large (menubar, remote windows, native bridge). Verify
   the node graph builds and `node.bundle.js` runs under electron.
3. **RN-web + `react-native$` + null-module graph under Rollup/esbuild resolution** — different
   resolver than enhanced-resolve; the `false`/empty-module + longest-first alias behavior must
   be reproduced exactly or resolution breaks in non-obvious ways.
4. **`module.hot` → `import.meta.hot` rewrite** — behavior parity for hot-accept of
   `app/main` + `common-adapters/index`; get fast-refresh working end-to-end.
5. **Prod bundle / electron packaging parity** — Rollup chunk naming, `splitChunks`-equivalent
   (Rollup `manualChunks`), source maps, tree-shaking; diff against current dist + run
   `prod-bundles` checks.
6. **Multi-page HTML entries** — the 6 shells (`main`, `remote`, `menubar`, `pinentry`,
   `tracker`, `unlock-folders`) as Vite inputs, with the CSP `<meta>` + `#root`/`#modal-root`
   markup preserved.

## Effort

**~3–5 focused days** for desktop dev + prod + Storybook (vs ~1–2 days for the Rspack port).
Higher because it's a dev-harness + main-process rewrite, not a config port. Storybook is the
*cheap* part here (exact-match Vite framework). Main risk is Risk #1 (dev origin) — de-risk it
in the first few hours before committing to the rest.

## Rspack (done) vs Vite (this plan) — comparison

| Dimension | Rspack (landed) | Vite 8 (this plan) |
|---|---|---|
| Nature of change | Config **port** (webpack model preserved) | Dev-harness + main-process **rewrite** |
| Underlying engine | Rust (rspack core) | Rust (Rolldown) + esbuild |
| react-compiler | babel-loader kept, verbatim | `@vitejs/plugin-react` babel path (supported peer) |
| Electron dev model | `file://` + dev server serves bundle | **http origin** serves ESM graph (main-proc change) |
| `module.hot` | unchanged (webpack HMR API) | **rewrite** to `import.meta.hot` |
| Multi-target electron-main/preload/web | one `rspack([...])` multi-config | separate builds / `vite-plugin-electron` |
| HTML entries | `HtmlWebpackPlugin` templateContent kept | real `*.html` graph roots (rewrite) |
| Storybook 10 builder | **none exists** (stuck on webpack5) | `@storybook/react-vite@10.4.6` (exact) |
| Kills `@pmmmwh`/wds coupling | yes | yes |
| Deletes `webpack` from node_modules | no (storybook keeps it) | **yes** (storybook moves to vite too) |
| Known gotchas hit/anticipated | file:// 403 (fixed via `allowedHosts:'all'`); persistent-cache flat array; `NonNullable<RuleSetRule['use']>`; html-plugin cast | dev http-origin; `import.meta.hot`; `false`-alias plugin; Rollup manualChunks parity |
| Effort | ~1–2 days | ~3–5 days |

## Recommendation framing (neutral)

- If the goal is **"modernize with least churn/risk, keep the webpack mental model"** → Rspack
  (already done) wins; webpack survives only under Storybook.
- If the goal is **"webpack 100% gone, all-in on the mainstream Vite ecosystem, Storybook on a
  first-class builder"** → Vite, accepting the dev-origin rewrite as the price. Vite 8's
  Rolldown engine means you don't sacrifice build speed to get there.
- **De-risk gate:** build a throwaway spike of Risk #1 (electron loading the renderer from a
  Vite http dev server, one window, HMR working) before committing to the full migration. That
  single spike decides Vite's viability faster than any amount of config work.

## Validation (per repo rules)

After changes, from `shared/`: `yarn lint` then `yarn tsc`. Then drive the desktop app (user
runs hot + prod) — bundler swaps are not verifiable by typecheck alone. Reuse the Rspack-port
verification playbook: headless `desktop:build:dev`/`:prod` to confirm the graph builds, then
user-driven hot + prod + remote-window checks. Watch specifically for the dev http-origin and
`import.meta.hot` behaviors (Risks #1, #4).

## Rollback

Do the spike on its own branch, off `master` (not off `nojima/HOTPOT-rspack`, so the two are
independent and comparable). Migration touches the 6 touchpoints + main-process loadURL +
package.json. If it stalls, revert and `yarn` — back to webpack (or cherry-pick the Rspack
branch instead).
