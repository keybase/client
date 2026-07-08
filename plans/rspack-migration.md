# Rspack Migration — Spike Plan

## Why (motivation)

Two problems with staying on webpack:

1. **react-refresh coupling tax.** Desktop hot mode relies on `@pmmmwh/react-refresh-webpack-plugin`, which reaches into `webpack-dev-server` *internal* client paths (`webpack-dev-server/client/clients/SockJSClient`). Every wds/plugin major re-breaks this. It already blocked us from `webpack-dev-server@6` (v6 deleted SockJS; plugin hard-`require`s it → `ModuleNotFoundError`). We are pinned at wds `5.x` because of this. See memory `project_wds6_react_refresh_sockjs`.
2. **Build speed.** webpack's JS-based graph + transforms are slow relative to Rust bundlers; HMR on a large React app is multi-second.

**Rspack** (Rust, webpack-API-compatible) fixes both while preserving the webpack config model — so this is a *port*, not a rewrite. `@rspack/plugin-react-refresh` is first-party with no internal-path coupling, permanently killing the bug class above.

## Why Rspack over alternatives

- **Vite** — different mental model (Rollup/esbuild, ESM-native dev) and a different plugin ecosystem; our nonstandard multi-entry `electron-main` + remote-window setup would be a from-scratch rewrite.
- **Turbopack** — effectively Next.js-only; not a viable standalone bundler for an Electron + RN-web app.
- **esbuild / Parcel** — too low-level / too opinionated; we'd hand-build the HMR + multi-target harness.
- **Stay on webpack** — zero churn but keeps paying the coupling tax and the slow builds.

Rspack is the only option that modernizes *while preserving the webpack config model*.

## Current webpack surface (3 touchpoints)

1. `shared/desktop/webpack.config.mts` (~443 lines) — main config.
   - Loaders: `babel-loader`, `css-loader`, `style-loader`, `null-loader`.
   - Plugins: `HtmlWebpackPlugin`, `ReactRefreshWebpackPlugin`, `TerserPlugin`, `webpack.DefinePlugin` (x2), `webpack.IgnorePlugin` (x3).
   - Targets: `electron-main`, `electron-preload`, `web`.
   - Uses `webpack-merge`.
2. `shared/desktop/yarn-helper/electron.mts` — programmatic `new WebpackDevServer(devServer, rendererCompiler)`.
3. `shared/.storybook/main.ts` — `@storybook/react-webpack5` builder + `webpackFinal`.

## The key constraint (sets expectations)

`babel-plugin-react-compiler` runs through `babel-loader` (webpack.config.mts:107; `babel.config.js`). **React Compiler is babel-only** — no SWC port. So we must **keep `babel-loader`** for the transform pass and cannot switch to Rspack's `builtin:swc-loader`. Consequence: we forfeit Rspack's biggest (SWC transform) speed win, but still get the Rust dependency-graph + HMR gains (the multi-second → sub-500ms HMR class). When React Compiler ships an SWC/native port, the rest unlocks with no further migration.

## Scope — spike (desktop dev + prod)

Target: desktop dev (hot) and prod bundles building on Rspack, keeping babel-loader. Storybook is a separate follow-up.

### Step 1 — deps
- Add `@rspack/core`, `@rspack/dev-server`, `@rspack/plugin-react-refresh` (exact versions, per update-dependencies skill).
- Remove (after cutover): `@pmmmwh/react-refresh-webpack-plugin`, `webpack`, `webpack-cli`, `webpack-dev-server`, `terser-webpack-plugin` (Rspack has native minifier), `html-webpack-plugin` (optional — Rspack supports it or use `rspack.HtmlRspackPlugin`).
- Keep: `babel-loader`, `css-loader`, `style-loader`, `null-loader`, `webpack-merge` (works with Rspack config objects), `babel-preset-expo`, all babel plugins.

### Step 2 — `webpack.config.mts` → Rspack
- `import webpack from 'webpack'` → `import {rspack} from '@rspack/core'` (and its `Configuration` type).
- `new webpack.DefinePlugin(...)` → `new rspack.DefinePlugin(...)`.
- `new webpack.IgnorePlugin(...)` → `new rspack.IgnorePlugin(...)`.
- `HtmlWebpackPlugin` → keep, or `rspack.HtmlRspackPlugin`.
- `TerserPlugin` → drop; use Rspack's built-in `SwcJsMinimizerRspackPlugin` (minify only — does NOT run react-compiler, that stays in babel-loader).
- Keep `babel-loader` rule verbatim (react-compiler + react-native-web + module-resolver chain).
- Verify `target: electron-main | electron-preload | web` all supported (they are).
- The `.storybook/main.ts` tsgo DefinePlugin workaround is webpack-specific — re-check whether it's still needed once on `rspack.DefinePlugin` (may be able to drop the widened-array cast).

### Step 3 — dev server (`electron.mts`)
- `import WebpackDevServer from 'webpack-dev-server'` → `import {RspackDevServer} from '@rspack/dev-server'`.
- `new WebpackDevServer(...)` → `new RspackDevServer(...)` (near drop-in API).
- react-refresh: replace `ReactRefreshWebpackPlugin` in config with `@rspack/plugin-react-refresh`. **This deletes the @pmmmwh + wds internal-path coupling entirely** — no patch, no SockJS, no wds version cap.

### Step 4 — Storybook (deferrable)
- Swap `@storybook/react-webpack5` → Rspack builder (`storybook-react-rspack` / `@storybook/react-rspack`, confirm current package name).
- Port `webpackFinal` → `rspackFinal` (same config-mutation shape).

## Risks to validate during the spike

1. **Prod bundle parity** — output filenames/hashing consumed by electron packaging, tree-shaking result, source maps. Diff bundle output + run `prod-bundles` checks.
2. **Remote-window multi-entry `electron-main` graph** — confirm all entries build and remote windows load.
3. **babel chain identical under Rspack** — react-compiler + react-native-web transforms must run exactly as today (keep babel-loader, don't let Rspack shortcut it).
4. **`webpack-merge` interop** — confirm it merges Rspack `Configuration` objects cleanly (it operates on plain objects, should be fine).
5. **Hot mode end-to-end** — the whole point: verify HMR/fast-refresh works via `@rspack/plugin-react-refresh` with no socket errors.

## Effort

~1-2 focused days for desktop dev + prod on Rspack (keeping babel-loader). Storybook a separate follow-up. Low-medium churn (port, not rewrite), low-medium risk (config model preserved; main risk is prod-bundle/electron-packaging parity).

## Validation (per repo rules)

After changes, from `shared/`: `yarn lint` then `yarn tsc`. Then drive the desktop app (user runs hot + prod) to confirm bundles load and HMR works — bundler swaps are not verifiable by typecheck alone.

## Rollback

Migration is isolated to the 3 touchpoint files + package.json. If the spike stalls, revert those files and `yarn` — back to webpack. Do the spike on its own branch.
