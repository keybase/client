# FS Store Cleanup

Reference skill: `skill/zustand-store-pruning/SKILL.md`

## Summary

Shrink `shared/stores/fs.tsx` by moving path-owned view data, path action state, edit state, and service-backed convenience caches out of Zustand where mounted screens can load directly from the service.

The end state is:

- mounted FS screens load path, TLF, and metadata through feature hooks instead of reading a warmed global cache
- path action menus, inline rename/new-folder rows, and screen-local errors live with the owning route or component
- subscription and engine plumbing only stays global where it must support true background state
- the remaining Zustand surface is limited to data that genuinely needs app-wide lifetime

Assumption for this plan: local service RPCs are cheap enough that we prefer reloading on mount/focus over preserving most frontend convenience caches.

## Guiding Rules

- Do not keep a store cache just to avoid a small number of local KBFS RPCs
- Prefer feature hooks such as `useFsPath(...)`, `useFsTlf(...)`, and `useFsChildren(...)` over raw store selectors
- Keep route-owned UI state out of the global store
- Prefer direct router calls and local `C.useRPC(...)` usage over FS-store wrapper actions when the result only affects the mounted screen
- Do not introduce module-level mutable state as a replacement for Zustand
  - no module-level caches
  - no module-level listener registries
  - no module-level in-flight request maps
  - no module-level `useSyncExternalStore(...)` stores backed by module variables
  - if a route needs shared loaded data, use a feature-local provider instead
- Keep behavior intact while changing ownership of state
- Slice-by-slice migrations must preserve current functionality; if a mounted FS view previously updated live while visible, move that refresh/subscription behavior into the new hook/provider/listener in the same slice instead of deferring it

## Chunk 1: Define Path / TLF Data Hooks

- [x] Introduce a small service-backed FS hook layer for mounted consumers
  - `useFsPathItem(path)`
  - `useFsFolderChildren(path, options?)`
  - `useFsTlf(path)`
  - `useFsPathMetadata(path)`
  - `useFsPathInfo(path)`
  - `useFsFileContext(path)`
- [x] Make these hooks own reload-on-mount/focus behavior instead of relying on a globally warmed `pathItems` / `tlfs` cache
- [x] Keep outputs narrow and purpose-built for FS consumers
  - current path item
  - children for the visible folder
  - current TLF metadata / sync config
  - file preview context
  - path info / soft error for the current path
- [x] Do not add a new hidden module-level cache; if a route needs shared data, use a feature-local provider

Current slice note:
- mounted callers still read through the existing FS store-backed data while ownership moves into the feature hook layer first; cache deletion remains for later chunks
- mounted browser rows now own inline rename/new-folder edit sessions through a feature-local provider
- mounted FS routes now use a feature-local `FsDataProvider` for `pathItems` / `tlfs`, and browser edit state reads that mounted cache instead of `shared/stores/fs.tsx`

### Target callers for Chunk 1

- [x] `fs/browser/*`
- [x] `fs/filepreview/*`
- [x] `fs/nav-header/*`
- [x] `fs/common/path-*`
- [x] `fs/common/item-icon.tsx`
- [x] `fs/common/upload-button.tsx`

### Store fallout after Chunk 1

- `pathItems` reads from mounted FS views
- `tlfs` reads from mounted FS views
- `pathInfos` reads from mounted FS views
- `fileContext` reads from mounted FS views
- `softErrors` reads from mounted FS views

## Chunk 2: Remove Path-Action and Inline-Edit UI State

- [x] Move `pathItemActionMenu` state into the path action menu flow
- [x] Move `edits` state into the owning folder / row UI
- [x] Replace store-owned rename/new-folder orchestration with local `C.useRPC(...)` calls or feature-local hooks
- [x] Keep error, waiting, and temporary filename state local to the mounted editor or menu

### Files likely to move together

- [x] `fs/common/path-item-action/*`
- [x] `fs/browser/rows/editing.tsx`
- [x] `fs/browser/rows/rows-container.tsx`
- [x] `fs/common/path-item-action/confirm.tsx`

### Store fallout after Chunk 2

- `pathItemActionMenu`
- `edits`
- `startRename`
- `newFolderRow`
- `setPathItemActionMenuDownload`
- any edit-only error bookkeeping currently tied to `edits`

Current slice note:
- mounted browser and destination-picker flows now require `FsBrowserEditProvider`; the legacy FS-store fallback for inline rename/new-folder state has been removed

## Chunk 3: Remove Route-Owned FS Screen State and Convenience Caches

- [x] Move `useFsPathInfo` / `useFsFileContext` loads to local hook state and delete those FS-store caches
- [x] Replace list and preview screens with route-owned loaders rather than shared FS cache reads
- [x] Move per-path sort / filter / local view preferences out of the global store unless they must survive unrelated entry points
- [x] Re-evaluate whether `pathUserSettings` should become route-local, persisted separately, or remain small global preference state
- [x] Move screen-local redbars / errors out of the store where they only serve the current route
- [x] Replace `loadAdditionalTlf`, `favoritesLoad`, `folderListLoad`, `loadPathMetadata`, and similar callers with feature hooks where possible

### Screens and flows to convert

- [x] `fs/index.tsx`
- [x] `fs/browser/index.tsx`
- [x] `fs/browser/root.tsx`
- [x] `fs/browser/rows/*`
- [x] `fs/top-bar/*`
- [x] `fs/nav-header/*`
- [x] `fs/common/hooks.tsx`
- [x] `fs/common/errs-container.tsx`

### Store fallout after Chunk 3

- `pathInfos`
- `fileContext`
- `pathUserSettings`
- `errors` if route-local
- more `pathItems` / `tlfs` cache usage

Current slice note:
- mounted browser and destination-picker flows now keep per-path sort settings in a browser-local provider instead of `shared/stores/fs.tsx`
- mounted FS route and destination-picker loaders now use a feature-local `FsDataProvider` for `pathItems` / `tlfs`; mounted hooks refresh that local state directly from SimpleFS RPCs instead of reading the shared cache
- FS route headers now wrap `fs/nav-header/*` mounted consumers in a local `FsDataProvider`, so title/action/header path metadata no longer falls back to the shared mounted-view cache
- mounted browser, file-preview, and destination-picker flows now use a feature-local `FsErrorProvider` for redbars; store-backed `errors` remain as fallback for non-route/global FS actions

## Chunk 4: Re-evaluate Subscription and Notification Ownership

- [ ] Stop treating `fs` as the default owner for mounted-screen refreshes
- [ ] Keep mounted path subscriptions near the owning hooks instead of centering all path refresh behavior in the store
- [ ] Re-evaluate store-owned handling for:
  - `keybase.1.NotifyFS.FSSubscriptionNotifyPath`
  - `keybase.1.NotifyFS.FSSubscriptionNotify`
  - `keybase.1.NotifyFS.FSOverallSyncStatusChanged`
  - `keybase.1.NotifyBadges.badgeState`
- [ ] Preserve only the parts that truly need background lifetime
  - file-tab badge
  - overall sync status banner state
  - download status
  - upload / journal status
  - daemon online / rpc status
  - settings / SFMI integration state

### Store fallout after Chunk 4

- `onPathChange`
- path-refresh parts of `onSubscriptionNotify`
- mounted-view portions of `onEngineIncomingImpl`
- some `subscribePath` / `subscribeNonPath` ownership if moved into feature hooks

## Chunk 5: Decide What Stays Global

- [ ] Review what remains in `shared/stores/fs.tsx`
- [ ] Delete dead selectors, helpers, and tests
- [ ] Keep only state that still clearly needs app-wide lifetime

### Likely candidates to keep global

- `downloads`
- `uploads`
- `kbfsDaemonStatus`
- `overallSyncStatus`
- `settings`
- `sfmi`
- `badge`
- possibly `criticalUpdate`

### Likely candidates to remove by the end

- `pathItems`
- `pathInfos`
- `fileContext`
- `tlfs`
- `tlfUpdates`
- `edits`
- `pathItemActionMenu`
- maybe `pathUserSettings`
- maybe `errors`
- most mounted-view refresh logic in `dispatch`

## Validation

- [ ] FS browser still loads folders and metadata correctly on entry
- [ ] File preview still loads `fileContext` and download/share flows correctly
- [ ] Rename and new-folder flows still work without global edit state
- [ ] Path action menu still handles save/share/download/open flows correctly
- [ ] Favorites and TLF views still refresh correctly after mutation
- [ ] Download and upload banners still work globally across routes
- [ ] Sync status, disk-space warnings, daemon status, and SFMI banners still work
- [ ] No new module-level mutable cache is introduced as a replacement for Zustand
