# FS Store Cleanup 2

References:

- Previous plan: `plans/fs-cleanup.md`
- Store-pruning rules: `skill/zustand-store-pruning/SKILL.md`

## Summary

Continue shrinking `shared/stores/fs.tsx` after `plans/fs-cleanup.md`.

The first cleanup removed the large mounted-view caches and moved path/TLF/file-preview data into route-owned hooks and providers. This follow-up should remove the remaining service-backed convenience caches and screen-owned RPC wrappers unless they clearly need app-wide lifetime.

The default assumption from the pruning skill still applies: local KBFS and Go service RPCs are cheap enough that mounted UI should reload on mount, focus, or notification instead of keeping global frontend caches just to reduce service calls.

## Goals

- Keep only genuinely global, background-owned FS state in `shared/stores/fs.tsx`.
- Move mounted-screen state, one-shot RPC results, route redbars, and UI command wrappers into the owning component, route provider, or feature hook.
- Prefer direct service reads over frontend mirrors when the service is already the source of truth.
- Prefer typed engine listeners in mounted FS hooks when UI can safely miss an event while unmounted and reload on entry.
- Preserve behavior. Do not silently drop platform branches, guards, notifications, waiting keys, or runtime side effects.
- Do not replace Zustand with module-level mutable caches, in-flight maps, hidden listener registries, or `useSyncExternalStore` backed by module variables.

## Current Store Surface

Remaining state to classify before each implementation slice:

- `criticalUpdate`
- `downloads`
- `kbfsDaemonStatus`
- `overallSyncStatus`
- `settings`
- `sfmi`
- `uploads`

Remaining dispatch surface to classify before deleting or moving call sites:

- daemon and lifecycle actions: `checkKbfsDaemonRpcStatus`, `getOnlineStatus`, `afterKbfsDaemonRpcStatusChanged`, `onChangedFocus`, `userIn`, `userOut`, `resetState`
- engine/background actions: `onEngineIncomingImpl`, `journalUpdate`, `loadDownloadStatus`, `setCriticalUpdate`
- settings/SFMI actions: `loadSettings`, `driverEnable`, `driverDisable`, `refreshDriverStatusDesktop`

Initial ownership targets:

- Keep global for now: daemon connection status, active upload/download status, overall sync status, desktop SFMI driver status, critical-update state.
- Move or delete unless proven global: `settings` fields that only serve UI and any one-screen command wrappers reintroduced later.
- Re-check every ambiguous item against the pruning skill instead of preserving it to avoid a service call.

## Chunk 1: Audit Remaining Consumers

- [x] Map every `useFSState(...)` and `useFSState.getState()` caller under `shared/fs`, `shared/settings`, `shared/constants/init`, and tests.
- [x] Build a keep/move/delete table for each remaining field and dispatch action.
- [x] Separate true background state from mounted FS route state.
- [x] Identify store actions that are only thin wrappers around one RPC for one visible screen.
- [x] Identify any state kept only so several mounted descendants can avoid a reload; move that shape to a feature provider or direct hook instead.

Implementation notes:

- Search with `rg "useFSState|dispatch\\." shared/fs shared/settings shared/constants shared/stores`.
- Do not start deleting in this chunk unless the consumer map proves the field or action is already dead.
- Update this plan with the ownership table before marking the chunk complete.

Chunk 1 audit results:

Consumer map:

- `shared/fs` reads the global daemon, upload/download, SFMI, soft-error, and redbar surfaces. Mounted data already goes through `FsDataProvider`; remaining screen-owned pieces are mostly `softErrors`, `errors`, `downloads.info`, and one-shot transfer commands.
- `shared/settings/files` reads and writes FS settings through the global store. The settings UI state is screen-owned, but the disk-space threshold still feeds background overall-sync notifications.
- `shared/settings/advanced` only calls the one-shot `setDebugLevel` RPC wrapper.
- `shared/constants/init/*` owns daemon/bootstrap forwarding, FS route enter/leave `userIn`/`userOut`, critical-update clearing, and the remaining FS engine bridge for overall sync and non-path subscription notifications.
- `shared/stores/tests/fs.test.ts` only covers `makeEditID`, `resetState`, and global `softErrors` mutation.
- Outside the initial search scope, desktop menubar plumbing still matters for ownership: `shared/menubar/remote-proxy.desktop.tsx` renders daemon/sync/SFMI/upload state, owns its TLF update load, and `shared/desktop/renderer/remote-event-handler.desktop.tsx` triggers `setCriticalUpdate`.

Field ownership table:

| Field | Current consumers | Ownership |
| --- | --- | --- |
| `badge` | FS mobile header and desktop tab bar upload icon. | `move-mounted`; `useFilesTabUploadIcon()` now loads on mount/focus and listens while mounted. |
| `criticalUpdate` | init route transition clearing; desktop remote event setter. | `keep-global`; cross-window/route lifecycle flag. |
| `downloads.regularDownloads` / `downloads.state` | FS footer, rows, item icons, mobile download watcher, download-status subscription. | `keep-global`; active transfer status must survive route changes. |
| `downloads.info` | `useFsDownloadInfo`, footer downloads, mobile completion watcher, start-download prefill. | `move-route`; load per download in the owning hook/component while preserving MIME/save/share completion behavior. |
| `errors` | `Errs` via `FsErrorProvider` fallback; store redbar actions. | `move-route`; keep temporary global fallback only for background FS actions until all redbar producers have mounted ownership. |
| `kbfsDaemonStatus` | FS root/browser/top-bar/status icons/hooks, menubar, init lifecycle. | `keep-global`; daemon connectivity is app-wide background state. |
| `overallSyncStatus` | main FS banner, menubar, `FSOverallSyncStatusChanged` handler. | `keep-global`; app-wide sync and disk-space warning state. |
| `settings.spaceAvailableNotificationThreshold` | settings UI and `syncStatusChanged` disk-space comparison. | `split`; keep latest threshold for background sync warnings, move mounted settings loading/submission out of the store. |
| `settings.sfmiBannerDismissed` | SFMI banner and open-in-system-file-manager icon. | `split`; tied to SFMI platform UI, likely keep with SFMI unless moved to an SFMI-specific owner. |
| `settings.syncOnCellular` / `settings.isLoading` | moved to `shared/settings/files/hooks.tsx`; no global consumers remain. | `move-component`; removed from global `Settings`. |
| `sfmi` | SFMI banner/popup/settings/open icon, init focus retry, menubar. | `keep-global`; platform integration state must survive unmounted FS routes. |
| `softErrors` | `useFsSoftError`, `errorToActionOrThrow` handlers, FS tests. | `move-route`; path/TLF soft errors are route-owned display state. Preserve no-access/nonexistent behavior through `FsErrorProvider` or equivalent mounted owner. |
| `tlfUpdates` | desktop menubar remote props. | `move-menubar`; it is now loaded locally by `shared/menubar/remote-proxy.desktop.tsx`. |
| `uploads` | upload footer, rows, path status icons, menubar, files-tab icon derivation, journal/upload subscriptions. | `keep-global`; active upload/journal state is app-wide transfer status. |

Dispatch ownership table:

| Dispatch action | Current consumers | Ownership |
| --- | --- | --- |
| `checkKbfsDaemonRpcStatus` | init/shared, store retries, error handling. | `keep-global`; daemon lifecycle. |
| `getOnlineStatus` | `useFsOnlineStatus`. | `keep-global`; updates global daemon online status even though mounted hooks trigger it. |
| `afterKbfsDaemonRpcStatusChanged` | desktop/native init and store status changes. | `keep-global`; platform FS setup and SFMI refresh. |
| `onChangedFocus` | desktop init focus subscription. | `keep-global`; desktop driver retry lifecycle. |
| `userIn` / `userOut` | init route transition for FS screens. | `keep-global`; SimpleFS client lifecycle side effects. |
| `resetState` | tests and global reset path. | `keep-global`. |
| `onEngineIncomingImpl` | init/shared for `FSOverallSyncStatusChanged` and non-path `FSSubscriptionNotify`. | `keep-global-narrow`; keep only durable background topics. Mounted refreshes should use typed listeners. |
| `journalUpdate` | store journal polling, dev upload-banner toggle. | `keep-global-internal`; updates global upload status. Public exposure can be narrowed later. |
| `loadDownloadStatus` | store subscription handler and `useFsDownloadStatus`. | `keep-global`; active download status is shared across routes. |
| `userFileEditsLoad` | desktop remote event; menubar rendered `tlfUpdates`. | `move-menubar`; removed from the FS store and remote action bridge. |
| `setCriticalUpdate` | desktop remote event and route transition clearing. | `keep-global`. |
| `driverEnable` / `driverDisable` / `refreshDriverStatusDesktop` | SFMI banner, popup, settings, init. | `keep-global`; platform integration state owner. |
| `loadSettings` | store settings subscription and threshold refresh after settings-hook updates. | `keep-global-internal`; background threshold/SFMI refresh only. |
| `setSpaceAvailableNotificationThreshold` | moved to settings files hook. | `move-component`; removed from store dispatch. |
| `setDebugLevel` | advanced settings only. | `move-component`; one-shot RPC wrapper. |
| `download` | file preview default view, path action menu/confirm. | `move-feature-hook`; one-shot command with local start callback. Preserve initial download info for mobile intents. |
| `cancelDownload` / `dismissDownload` | footer download, path action menu, mobile watcher. | `move-feature-hook`; service commands can live beside download UI while global status remains. |
| `upload` | browser drag/drop and upload button. | `move-feature-hook`; active upload status remains global via service notifications. |
| `dismissUpload` | browser row upload error. | `move-feature-hook`; one-shot service command. |
| `loadDownloadInfo` | `useFsDownloadInfo`. | `move-component`; service-backed per-download info should be local to the watcher/footer hook. |
| `redbar` / `dismissRedbar` | `FsErrorProvider` fallback and store `errors`. | `move-route`; keep fallback only while background actions still need a global error sink. |
| `setPathSoftError` / `setTlfSoftError` | `FsDataProvider.loadPathMetadata`, error handlers, tests. | `move-route`; use provider-owned soft-error handlers with `errorToActionOrThrowWithHandlers`. |

## Chunk 2: Move Settings and TLF Update Convenience State

- [x] Move mounted settings screen loads away from global `settings` where the values only render or submit that screen.
- [x] Keep only settings values needed by background FS logic, such as disk-space threshold comparisons, if they still require global lifetime.
- [x] Replace `loadSettings` call sites that only refresh mounted settings UI with local RPC loading.
- [x] Move `setSpaceAvailableNotificationThreshold` into the settings feature if its result only updates settings UI plus service state.
- [x] Re-evaluate `tlfUpdates` and `userFileEditsLoad`; keep global only if the edits are rendered or notified outside a mounted FS-owned surface.

Behavior to preserve:

- Settings subscription notifications must still refresh any UI that is mounted and interested.
- Overall sync status must still compare disk space against the latest threshold.
- User edit history must still load wherever the UI currently expects it.

Current slice note:

- `shared/fs/common/use-files-tab-upload-icon.tsx` now owns mounted files-tab badge loading for the mobile header and desktop tab bar.
- `shared/settings/files/hooks.tsx` now owns the mounted Files settings RPC load and listens for settings subscription notifications while mounted.
- The Files settings threshold and sync-on-cellular controls submit directly through SimpleFS RPCs instead of selecting global `settings` values.
- After threshold/sync updates, the settings hook still refreshes the global FS settings owner so background disk-space warning comparisons keep the latest threshold.
- The public store dispatch wrapper `setSpaceAvailableNotificationThreshold` and the settings-only `RefreshSettings` component were removed.
- The settings-only `setDebugLevel` wrapper was removed; advanced settings now calls the SimpleFS debug-level RPC directly.
- `tlfUpdates` now lives in `shared/menubar/remote-proxy.desktop.tsx`, which loads user edit history directly when the menu window is shown and KBFS is connected.
- Store `settings` is now narrowed to the background/SFMI fields still needed globally: `loaded`, `sfmiBannerDismissed`, and `spaceAvailableNotificationThreshold`.

## Chunk 3: Move Soft Errors and Redbars to Route Ownership

- [x] Move path/TLF soft-error display and mutation out of global FS state when it only serves mounted FS routes.
- [x] Keep `errorToActionOrThrow` behavior, but route path-owned soft errors through `FsErrorProvider` or an equivalent mounted owner.
- [x] Remove store-backed `errors`, `redbar`, and `dismissRedbar` if all visible redbars have mounted ownership.
- [x] Preserve fallback/global error handling only for real background FS actions that can fail while no FS route is mounted.
- [x] Update `shared/stores/tests/fs.test.ts` if it only tests behavior that moved to a feature provider.

Behavior to preserve:

- No-access and nonexistent-path errors still render in the same FS route contexts.
- Deleted-user and other redbar-worthy errors still surface to the user.
- Unmounted routes do not need stale path errors retained just to avoid a reload.

Current slice note:

- `FsErrorProvider` now owns path/TLF `softErrors` alongside route redbars.
- `FsDataProvider.loadPathMetadata` clears path/TLF soft errors through the mounted error provider instead of mutating `useFSState`.
- `shared/stores/fs.tsx` no longer exposes `softErrors`, `setPathSoftError`, or `setTlfSoftError`; the global `errorToActionOrThrow` fallback preserves daemon-timeout and redbar handling but intentionally does not keep route soft errors alive.
- Standalone FS data owners in nav headers, bare preview, KBFS path popups, and the archive modal now mount an `FsErrorProvider` so their soft-error UI remains local to that surface.
- Store-backed `errors`, `redbar`, and `dismissRedbar` are now removed. Mounted FS redbars stay owned by `FsErrorProvider`; no-provider fallback errors now go through `config.globalError`, which is the visible app-wide error owner for background FS failures.

## Chunk 4: Move Transfer Command Wrappers Out of the Store

- [x] Move one-shot upload and download start commands into feature hooks or components when the result only affects the initiating UI.
- [x] Keep global transfer status state for active uploads/downloads if banners, rows, mobile completion handling, or tabs need it across routes.
- [x] Re-evaluate `downloads.info`; load per-download info from the owning footer/mobile watcher hook instead of maintaining a broad global info cache if feasible.
- [x] Move `cancelDownload`, `dismissDownload`, and `dismissUpload` out of the store unless they need to coordinate with global transfer state beyond calling the service.
- [x] Preserve mobile download-intent handling and platform-specific completion behavior.

Behavior to preserve:

- Regular download footer state still updates across route changes.
- Mobile save/share/download completion still receives MIME type and dismisses finished downloads correctly.
- Upload banners and row upload icons still reflect journal and upload-status notifications.

Current slice note:

- Upload start now lives in `useFsUpload()` and is called directly by the browser drag/drop flow and upload button.
- Upload dismissal now lives in `useFsDismissUpload()` and is called directly by upload-error rows.
- Download cancel/dismiss now live in `useFsCancelDownload()` and `useFsDismissDownload()` and are called directly by the footer, path action menu, and mobile completion watcher.
- `shared/stores/fs.tsx` no longer exposes `upload`, `dismissUpload`, `cancelDownload`, or `dismissDownload`; global upload/download status remains store-owned through service subscriptions.
- Download start now lives in `useFsDownload()`, with the action menu, confirm menu, and preview default-download button calling it directly.
- `downloads.info` was removed from `shared/stores/fs.tsx` and `T.FS.Downloads`; per-download metadata now lives in `FsDataProvider` while mounted.
- `useFsDownloadInfo()` loads per-download metadata through the route provider, and `useFsDownloadIntent()` combines provider-owned info with global active download status for row text and item badges.
- Mobile save/share/regular-download completion still routes through `useFsWatchDownloadForMobile`; started download intents are recorded in the mounted provider so MIME lookup and platform completion keep their existing coordination.
- The store still owns `downloads.regularDownloads`, `downloads.state`, and `loadDownloadStatus` because active download status is shared across footers, rows, mobile completion handling, and route changes.

## Chunk 5: Narrow Engine and Init Plumbing

- [x] Keep store-owned `onEngineIncomingImpl` only for durable background state.
- [x] Move mounted-screen notification reactions to typed engine listeners in the owning hook or component.
- [x] Remove `FSSubscriptionNotify` handling from the store for topics that only refresh mounted UI.
- [x] Keep non-path subscriptions for upload/download status, journal status, daemon/online status, and other app-wide surfaces that must update while FS is unmounted.
- [x] Delete dead init forwarding, type-only imports, callback plumbing, and tests after consumers move.

Behavior to preserve:

- Daemon reconnect still refreshes background-owned FS state.
- App badges and upload notification badges still update.
- Desktop and native init hooks still run platform-specific FS setup.

Current slice note:

- `_onEngineIncoming` now forwards `FSSubscriptionNotify` into the FS store only for background-owned topics: journal status, online status, download status, upload status, and settings.
- `filesTabBadge` now stays on the mounted typed-listener path; `useFilesTabUploadIcon()` subscribes and reloads the current badge while an icon surface is mounted.
- Mounted-only topics such as favorites stay on the typed listener path; `useFsTlfs()` continues to listen and reload while mounted.
- `shared/stores/fs.tsx` no longer keeps no-op `favorites` or `overallSyncStatus` subscription cases in `onSubscriptionNotify`.
- `FSOverallSyncStatusChanged` remains store-owned because disk-space and sync banner state are app-wide background state.
- The remaining FS engine forwarding in `shared/constants/init/shared.tsx` now uses the existing direct `useFSState` import; the dead FS dynamic require/type-only import was removed.

## Chunk 6: Collapse the Store Boundary

- [x] Remove dead store fields, dispatch actions, helpers, imports, tests, and selectors after each migrated slice.
- [x] Prefer file-local helpers for one-off migrated logic; only extract shared hooks when multiple consumers need them.
- [x] Keep selectors consolidated with `C.useShallow(...)` when components still read adjacent remaining store values.
- [x] Document the final global FS store contract in this plan before closing it out.
- [x] Delete `shared/stores/fs.tsx` only if no meaningful background store remains.

Expected final boundary:

- Global store state should be limited to active transfer status, daemon status, app-wide sync/banner state, critical-update state, and platform integration state that must survive unmounted FS routes.
- Mounted FS data, screen commands, redbars, settings UI state, and service-backed convenience mirrors should live outside the global store.

Final global FS store contract:

- `criticalUpdate`: cross-route desktop critical update flag cleared on FS tab exit.
- `downloads.regularDownloads` / `downloads.state`: active download status shared by footer rows, path item badges, mobile completion handling, and route changes.
- `kbfsDaemonStatus`: app-wide KBFS daemon RPC and online status.
- `overallSyncStatus`: app-wide sync progress and disk-space warning/banner state, derived from background sync status notifications and the latest background threshold setting.
- `settings.loaded`, `settings.sfmiBannerDismissed`, and `settings.spaceAvailableNotificationThreshold`: background settings subset needed by SFMI and disk-space notifications.
- `sfmi`: desktop system file manager integration driver status and mount directories.
- `uploads`: active upload/journal status shared by rows, footer, path status icons, menubar, and notification badges.

`shared/stores/fs.tsx` remains because those fields are still durable background or cross-route state. It no longer owns mounted path data, soft errors, redbars, settings UI form state, download metadata mirrors, menubar TLF update history, or one-shot upload/download command wrappers.

## Validation

This machine does not have `node_modules` for this repo. Do not run `yarn`, `npm`, `yarn lint`, `yarn tsc`, or other node-based toolchain commands here.

Validate each implementation slice by inspection:

- [x] Search for removed fields and actions with `rg`.
- [x] Confirm no component still selects removed state or dispatches removed actions.
- [x] Confirm route providers wrap all mounted consumers that need shared loaded data.
- [x] Confirm route params and navigation payloads line up when global state is replaced by explicit navigation context.
- [x] Confirm engine notifications still land in either a global background owner or a mounted typed listener.
- [x] Confirm no new module-level mutable cache or hidden singleton store was introduced.

Manual runtime scenarios for a runnable environment:

- [ ] FS browser loads folders, TLF metadata, banners, sort/filter state, and rows on entry/focus.
- [ ] File preview loads file context and supports share/download/save-media flows.
- [ ] Rename, new-folder, delete, move/copy, reset, and conflict actions still work.
- [ ] Upload and download banners continue across route changes.
- [ ] Mobile download-intent completion still works.
- [ ] SFMI banner, kext permission flow, daemon reconnect, disk-space warnings, and files-tab badge still update.
- [ ] Soft errors and redbars appear in the owning route without stale global state.
