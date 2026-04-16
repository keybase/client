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
- service-driven convo reselect, stale selected-thread reload, inbox conversation hydration, and exploding-mode gregor sync now live in `convostate`

This means the remaining work is about removing the actual `chat -> convo` logic, not import barrels.

## Non-Goals

- Do not add a store coordinator module
- Do not keep a fake separation where `chat` still drives convo state through a registry/helper hop
- Do not silently change behavior during the split

## Remaining `chat -> convo` Logic Buckets

### 1. Engine Notification Fanout

Status:

- done for `onEngineIncomingImpl`; convo-targeted engine actions now dispatch from `convostate`
- done for the remaining non-badge residual fanout; `chat.tsx` no longer directly drives convo navigation, hydration, stale reloads, or exploding-mode sync

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

### 2. Badge / Unread Ownership

This is last because it is the riskiest ownership decision.

Current state:

- global badge totals live in `chat`
- per-convo badge/unread also get updated from `chat`

Possible end states:

- derive per-convo badge/unread from global inbox/badge data
- or move per-convo badge ownership fully to convo state

Do not decide this early. Resolve simpler buckets first.

## Recommended Order

1. Badge / unread ownership

## Acceptance Criteria

The split is done when:

- `chat.tsx` contains only global chat state and global chat actions
- `chat.tsx` does not iterate convo stores
- `chat.tsx` does not call `getConvoState(...)`
- convo-targeted routing is owned outside `chat.tsx`
- `chat.tsx` can be understood as a standalone global store file

## Notes For Follow-Up Work

- Prefer deleting logic over relocating it to another indirection layer
- For each bucket, identify call sites first, then decide the new owner
- Keep each bucket as a separate change so regressions are easier to review
