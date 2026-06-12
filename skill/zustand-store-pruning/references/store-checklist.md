# Store Checklist

Use this file as the running checklist for the stacked cleanup series.

Status:

- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[~]` intentionally skipped for now

Ordered by expected payoff (survey 2026-06-12):

- [x] `inbox-rows`
  Notes: relocated to `chat/inbox/rows-state.tsx` (feature ownership, alongside layout-state/search-state). Stays a module store: engine pushes (badge counts, inbox layout) must apply while chat UI is unmounted, so it cannot be provider-mounted without losing badge durability.
- [x] `modal-header`
  Notes: split. Device badges moved to `stores/notifications.tsx` (set in its badgeState engine handler before the version guard); fs folder filter moved to `fs/common/folder-view-filter-state.tsx`. Remaining store is only the modal action-button/title bridge — kept as a singleton because headerRight/headerTitle render outside the screen tree, so React context can't span them. `bot*` fields ARE used (chat/routes.tsx) — earlier "unused" claim was wrong.
- [x] `settings-contacts`
  Notes: `alreadyOnKeybase` removed; joined contacts now travel via route params to `settingsContactsJoined`. Everything else verified keep: `permissionStatus` is refreshed globally on app-foreground (`constants/init/index.tsx` mobileAppState subscription), `importPromptDismissed` must outlive team-building screens, import results are written by the engine-triggered cache sync. The original move-component suggestions for these did not survive scrutiny.
- [x] `settings-email`
  Notes: `editEmail` removed; delete/set-primary/set-visibility/verify RPCs now `C.useRPC` at call sites (confirm-delete, email-phone-row, people/todo). Store keeps the notification-fed `emails` map plus `sentVerificationEmail` (cache touch for the 30-min resend cooldown shared by people todo + account row).
- [x] `settings-phone`
  Notes: verified already lean — notification handler + `setNumbers` bootstrap only; mutations were already component-level `C.useRPC`. No change needed.
- [x] `team-building`
  Notes: external pokes removed; `getTBStore` deleted. Nav-watcher in init/shared.tsx replaced by a `blur` listener inside the screen (CancelOnBlur, replacing CancelOnRemove + skip flag — blur fires on cover and removal, matching the old visible-screen check). teams/routes error now travels as `initialError` route param. `fromTeamBuilder` flag in teams/actions was dead (never passed true) and is gone. Store is now only reachable via TBProvider/useTBContext. Note: keyed stores still persist in a module map across mounts — that persistence is load-bearing (late RPC errors shown on reopened screens).
- [~] `notifications`
  Notes: keep. `keyState` extraction was wrong — `widgetBadge` (derived from keyState) feeds the desktop tray via menubar/remote-proxy, so it is cross-feature. Gained `deviceBadges` from the modal-header split.
- [ ] `provision`
  Notes: large effort. Multi-step wizard with live RPC response handlers stored in `dispatch.dynamic.*`. Candidate: flow-local provider for wizard UI state (`username`, `passphrase`, `deviceName`, `error`, `autoSubmit`) + `flow-handles.tsx` pattern for live responders. Must preserve autoSubmit replay, cancel semantics, and `startProvisionTrigger` rewind behavior. Do last.
- [ ] `push`
  Notes: keep — token/permissions/pendingPushNotification are native-event-driven and must survive unmount. Possible minor: `showPushPrompt`/`justSignedUp` modal state.
- [~] `logout`
  Notes: true global coordination point; only cleanup is unused `resetState()`.
- [~] `shell`
  Notes: keep — native/electron-event-driven (focus, app state, network, window state, OS prefs). `fsCriticalUpdate` is engine-fed and read by tab-bar badge; keep.
- [x] `fs-platform`
  Notes: not a Zustand store — platform utility functions. Relocated to `util/fs-platform.tsx`.
- [~] `config`, `current-user`, `daemon`, `router`, `waiting`, `darkmode`, `users`, `followers`, `flow-handles`
  Notes: genuinely global / infrastructure; skip.
- [x] `chat`
  Notes: moved inbox search state/RPC orchestration into `shared/chat/inbox/search-state.tsx`; moved location preview coordinate state out; pending create-conversation error flow now in route params; derived inbox rows/floating-button state into `shared/chat/inbox/use-inbox-state.tsx`; inbox presentation state + `ui.inboxSmallRows` persistence into the inbox hook; removed dead trusted-inbox state; payment status caching moved into `convostate`.

## Notes

- Track logical stores here, not `shared/stores/tests/*`.
- `store-registry.tsx` is infrastructure, not a target store.
- This cleanup series moves linearly through the checklist by default. Take the first unchecked store unless a later note explicitly says otherwise.
