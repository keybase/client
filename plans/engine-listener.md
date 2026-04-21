# Engine Listener Migration

## Summary

Add a typed engine action subscription layer so feature components can react directly to ephemeral engine events without inventing one-field Zustand stores or `init/shared.tsx` forwarding shims.

This is for screen-local refreshes, prompts, and transient session reactions. It is not a replacement for durable shared caches or notification-backed global state.

## Current Primitive

- [x] Add `shared/engine/action-listener.tsx` with:
  - `subscribeToEngineAction(type, listener)`
  - `useEngineActionListener(type, listener)`
  - `notifyEngineActionListeners(action)`
- [x] Dispatch those listeners from `shared/constants/init/shared.tsx` after existing global/store fanout
- [x] Convert `people` off the temporary refresh bridge and onto direct engine subscription

## Migration Rules

Use the engine listener layer when all of these are true:

- The engine action is an ephemeral nudge or prompt for one feature
- The UI can safely miss the event while unmounted because it reloads on focus/mount or because the prompt only matters while visible
- The action does not need to mutate durable shared state for other screens

Keep store-owned engine handling when any of these are true:

- The action updates long-lived shared caches, badges, unread counts, or background state
- The app must retain the effect even while the screen is unmounted
- Several unrelated features need the same derived state
- The action updates badges, global session/config state, long-lived caches, subscription state, or background data needed while unmounted

## Candidate Audit Order

- [x] `people`
- [x] `tracker` transient identify/session events
  - `identify3ShowTracker` and related identify session updates now subscribe from the desktop tracker proxy instead of `init/shared.tsx`
  - The tracker store was removed; desktop popup state now lives in the proxy and profile screens reload from service-backed hooks instead of keeping a durable tracker cache warm
  - Follow-up cleanup keeps proxy-owned popup details immutable and fixes the TypeScript fallout from removing the store-backed tracker cache
- [x] `pinentry`
  - The desktop proxy now listens to `keybase.1.secretUi.getPassphrase` directly, owns the prompt state locally, and registers submit/cancel handlers for the remote window path
  - Removed the dedicated `pinentry` store and the `init/shared.tsx` forwarding shim
- [x] `archive`
  - The settings archive screen now owns chat/KBFS job state locally, reloads on focus, and subscribes directly to archive engine actions while mounted
  - Removed the dedicated `archive` store, the `init/shared.tsx` forwarding shim, and the store-only archive listener test
- [x] `unlock-folders`
  - The desktop unlock-folders proxy now subscribes to `rekeyUI.refresh` and `delegateRekeyUI` via the engine listener layer instead of `init/shared.tsx`
  - Kept the proxy-local Zustand state for window props/error flow; the migration removes global forwarding without changing the desktop popup behavior
- [x] Re-evaluate remaining store-owned domains
  - Each audit result must classify every reviewed engine action as either:
    - `keep store-owned`, with a reason tied to durable/shared ownership
    - `extract candidate`, naming the exact engine action plus the owning listener/component/proxy
  - Audit order for this pass:
    - [x] `teams`
    - [x] `fs`
    - [x] `chat`
    - [x] `users`
    - [x] `config`
    - [x] `notifications`
  - Follow-up migration candidates from this pass:
    - [ ] `teams` navigation nudges: `chat.1.chatUi.chatShowManageChannels`, `keybase.1.NotifyTeam.teamDeleted`, `keybase.1.NotifyTeam.teamExit`
      - Move to a teams route/root listener that owns the navigation side effect instead of the teams store
    - [ ] `teams` welcome message response: `chat.1.NotifyChat.ChatWelcomeMessageLoaded`
      - Move to `teams/team/settings-tab/index.tsx` so the settings screen owns the transient load response while mounted
    - [ ] `chat` maybe-mention resolution: `chat.1.chatUi.chatMaybeMentionUpdate`
      - Evaluate a feature-local listener/cache near `common-adapters/markdown/maybe-mention`

## Remaining Re-Evaluation Scope

These areas are now in scope for audit, but not for mechanical conversion. Re-evaluate them action-by-action and only migrate clearly ephemeral, screen-local flows.

- `teams`
  - Evaluate UI and navigation nudges first
  - Keep team metadata, role-map, tree membership, retention, badge, and gregor-backed state store-owned unless a listener-only flow is clearly isolated
  - Audit result:
    - `keep store-owned`: `keybase.1.NotifyTeam.teamMetadataUpdate`, `chat.1.NotifyChat.ChatSetTeamRetention`, `keybase.1.NotifyTeam.teamTreeMembershipsPartial`, `keybase.1.NotifyTeam.teamTreeMembershipsDone`, `keybase.1.NotifyTeam.teamRoleMapChanged`, `keybase.1.NotifyTeam.teamChangedByID`, `keybase.1.NotifyBadges.badgeState`, `keybase.1.gregorUI.pushState`
    - Reason: these update shared team metadata, retention policy, membership caches, role maps, badge-driven team lists, or gregor-backed state consumed across many screens
    - `extract candidate`: `chat.1.chatUi.chatShowManageChannels`, `keybase.1.NotifyTeam.teamDeleted`, `keybase.1.NotifyTeam.teamExit`
    - Owner: teams route/root listener that performs navigation without storing the event
    - `extract candidate`: `chat.1.NotifyChat.ChatWelcomeMessageLoaded`
    - Owner: `teams/team/settings-tab/index.tsx`, which already owns welcome-message loading UI
- `fs`
  - Evaluate active-view subscription reactions first
  - Keep sync status, favorites, and shared FS state store-owned unless the action is strictly view-scoped
  - Audit result:
    - `keep store-owned`: `keybase.1.NotifyBadges.badgeState`, `keybase.1.NotifyFS.FSOverallSyncStatusChanged`, `keybase.1.NotifyFS.FSSubscriptionNotifyPath`, `keybase.1.NotifyFS.FSSubscriptionNotify`
    - Reason: these drive central favorites, sync status, and subscription fanout keyed by store-owned FS subscription state and shared path caches
- `chat`
  - Audit screen-local prompts separately from inbox, badge, gregor, and conversation-cache handling
  - Do not migrate inbox refresh, global chat cache, or broadly shared chat state mechanically
  - Audit result:
    - `keep store-owned`: `chat.1.NotifyChat.ChatIdentifyUpdate`, `chat.1.NotifyChat.ChatInboxStale`, `keybase.1.NotifyBadges.badgeState`, `keybase.1.gregorUI.pushState`
    - Reason: these refresh shared chat caches, badge state, gregor-derived state, or shared user broken-state consumed outside a single mounted screen
    - `extract candidate`: `chat.1.chatUi.chatMaybeMentionUpdate`
    - Owner: a feature-local listener/cache near `common-adapters/markdown/maybe-mention`, because mention resolution is transient render data and can be recomputed on demand
- `users`
  - Default to keeping identify/block state store-owned
  - Only extract flows where the consumer is feature-local and the event does not maintain shared user state
  - Audit result:
    - `keep store-owned`: `keybase.1.NotifyUsers.identifyUpdate`, `keybase.1.NotifyTracking.notifyUserBlocked`
    - Reason: these maintain shared broken/block state used by usernames, chat banners, tracker surfaces, and other user-facing components; tracker-specific listeners can layer on top without removing the shared cache
- `config`
  - Default to keeping login/session/global config handling in the store
  - Only carve out feature-local prompts or one-shot reactions that do not own app-wide config/session state
  - Audit result:
    - `keep store-owned`: `keybase.1.NotifyAudit.rootAuditError`, `keybase.1.NotifyAudit.boxAuditError`, `keybase.1.NotifyBadges.badgeState`, `keybase.1.gregorUI.pushState`, `keybase.1.NotifyRuntimeStats.runtimeStatsUpdate`, `keybase.1.NotifyService.HTTPSrvInfoUpdate`, `keybase.1.NotifySession.loggedIn`, `keybase.1.NotifySession.loggedOut`
    - Reason: these own app-wide error, badge, gregor, runtime, HTTP server, and session/login state consumed across routing and global UI
- `notifications`
  - Default to keeping badge counts and widget/app badge derivation centralized
  - Only extract if a flow is truly feature-local and does not participate in global badge accounting
  - Audit result:
    - `keep store-owned`: `keybase.1.NotifyBadges.badgeState`
    - Reason: badge fanout, tab counts, mobile badge counts, desktop badge counts, and widget badge derivation must stay centralized to avoid divergence

## Rollout Notes

- Prefer `navigation` focus/blur for screen lifecycle like “mark viewed” or draft cleanup
- Prefer `useEngineActionListener` for mounted-screen reactions to engine pushes
- Do not move durable notification state into component listeners
- Delete temporary feature-local bridges such as increment-only refresh modules once direct subscriptions land
- Keep `shared/constants/init/shared.tsx` as the central dispatch point until an audited action is explicitly reclassified and migrated

## Validation

- For each re-evaluated domain, document whether reviewed actions stay store-owned or become extraction candidates
- Confirm the feature still reacts while mounted
- Confirm focus/mount reload still covers missed events while unmounted
- Confirm no global store or init forwarding remains for the migrated action
- Confirm extracted actions are not handled twice after migration
- Confirm store-owned actions preserve current durable/shared behavior
- Update or delete tests that previously only exercised store plumbing
