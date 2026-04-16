# Chat / Convo Split Plan

## Goal

Make `shared/stores/chat.tsx` a true global chat store and remove its knowledge of per-conversation store internals.

Target boundary:

- `chat.tsx` owns global chat state only
- `convostate.tsx` owns per-conversation state only
- `chat.tsx` does not touch convo stores directly or indirectly
- no `convostate` re-export from `chat.tsx`
- route/provider helpers do not live in `chat.tsx`

## Current State

These cleanup steps are already done:

- `blockButtons` dismissal moved to chat-global ownership
- `RefreshReason` moved to `shared/stores/chat-shared.tsx`
- `convostate` is no longer re-exported from `shared/stores/chat.tsx`
- convo hooks/helpers are imported from `@/stores/convostate` directly
- `makeChatScreen` moved out of `chat.tsx` into `shared/chat/make-chat-screen.tsx`
- aggregate reader helpers moved out of `chat.tsx`; callers now scan convo state directly
- `chat.resetState` now resets only chat-global state; convo registry teardown is composed by global store reset
- `inboxSyncedClear` convo clearing is no longer hidden inside `chat.inboxRefresh`
- route subscriptions now call convo-owned selection handling directly; `chat.tsx` no longer owns route selection
- `metasReceived` now applies convo meta updates from `convostate`
- first-layout inbox hydration moved out of `chat.updateInboxLayout`
- `ensureWidgetMetas`, meta queueing, and `unboxRows` now live in `convostate`
- conversation creation and team-building handoff now live in `convostate`
- convo-targeted engine notifications now route through `convostate.handleConvoEngineIncoming`; `chat.onEngineIncomingImpl` keeps only global branches
- init-time engine routing now sends convo-targeted notifications directly to `convostate`; `chat.tsx` is no longer the top-level engine entrypoint for convo-targeted branches
- service-driven convo reselect, stale selected-thread reload, inbox conversation hydration, and exploding-mode gregor sync now live in `convostate`
- badge / unread application and inbox-sync clear fanout now live in `convostate`; `chat.tsx` keeps only aggregate badge totals/versioning
- init-time badge routing now sends per-convo badge/unread fanout directly to `convostate`; `chat.dispatch.badgesUpdated` keeps only global badge counters
- inbox sync/layout routing now enters through init-time convo-owned handlers; `chat.tsx` keeps only global inbox layout state and refresh triggers
- exploding-mode gregor fanout now routes outside `chat.tsx`; `chat.tsx` no longer imports `convostate`

Current branch result:

- `chat.tsx` no longer reaches into convo stores directly with `getConvoState(...)`
- `chat.tsx` no longer iterates convo registries directly
- `chat.tsx` no longer imports `convostate`
- convo-targeted routing now lives outside `chat.tsx`

The split goal is now met on this branch.

## Non-Goals

- Do not add a store coordinator module
- Do not keep a fake separation where `chat` still drives convo state through a registry/helper hop
- Do not silently change behavior during the split

## Remaining `chat -> convo` Logic Buckets

### 1. Engine Notification Fanout

Status:

- done for the engine-entrypoint portion; convo-targeted branches now route from `shared/constants/init/shared.tsx` straight into `convostate.handleConvoEngineIncoming`
- `chat.onEngineIncomingImpl` now keeps only the remaining global / inbox-layout related chat branches

Most of `onEngineIncomingImpl` is a dispatcher into specific convo stores.

Keep in `chat` only:

- inbox layout
- global badge totals
- maybe mentions
- block buttons
- user reacjis
- global refresh triggers

Move out of `chat`:

- incoming messages
- typing
- reactions
- messages updated
- stale thread reload handling
- participant info
- coin flip status
- retention updates
- per-convo command/giphy UI notifications

Desired end state:

- convo-targeted notifications are handled by convo-owned entrypoints
- `chat.tsx` only handles truly global notifications
- `chat.tsx` no longer calls `handleConvoEngineIncoming(...)`

### 2. Badge / Unread Ownership

Status:

- done for the ownership boundary; `convostate.syncBadgeState` owns per-convo badge/unread application, while init-time badge routing calls it directly
- `chat.dispatch.badgesUpdated` now keeps only the aggregate badge counters/versioning

This was last because it was the riskiest ownership decision.

Resolved state:

- global badge totals live in `chat`
- per-convo badge/unread get updated from `convostate`

Chosen end state:

- per-convo badge ownership remains in convo state
- badge-state payload fanout is convo-owned instead of chat-owned

### 3. Inbox Sync / Layout Orchestration

Status:

- done for the inbox/layout ownership boundary; init-time routing now sends inbox sync/layout convo work into `convostate`
- `chat.tsx` keeps only inbox layout state parsing/storage and global refresh triggers

Desired end state:

- inbox sync and layout events enter through a convo-owned entrypoint when they need convo work
- `chat.tsx` only keeps global inbox layout state and global refresh triggers

### 4. Remaining Acceptance Gap

Status:

- none; the acceptance criteria below are now satisfied on this branch

Reason:

- `chat.tsx` no longer imports or dispatches convo-owned helpers
- remaining follow-up work, if any, is ordinary cleanup rather than split-boundary work

## Recommended Order

1. Done: move convo-targeted engine entrypoint ownership fully out of `chat.tsx`
2. Done: move badge-state fanout ownership fully out of `chat.tsx`
3. Done: move inbox sync/layout convo orchestration behind convo-owned entrypoints
4. Done: remove the last remaining `chat.tsx -> convostate` helper coupling

Result:

1. Split complete

## Acceptance Criteria

The split is done when:

- `chat.tsx` contains only global chat state and global chat actions
- `chat.tsx` does not iterate convo stores
- `chat.tsx` does not call `getConvoState(...)`
- `chat.tsx` does not dispatch convo-owned work by calling `convostate` orchestration helpers
- convo-targeted routing is owned outside `chat.tsx`
- `chat.tsx` can be understood as a standalone global store file

## Notes For Follow-Up Work

- Prefer deleting logic over relocating it to another indirection layer
- For each bucket, identify call sites first, then decide the new owner
- Keep each bucket as a separate change so regressions are easier to review
