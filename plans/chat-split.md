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

This means the remaining work is about removing the actual `chat -> convo` logic, not import barrels.

## Non-Goals

- Do not add a store coordinator module
- Do not keep a fake separation where `chat` still drives convo state through a registry/helper hop
- Do not silently change behavior during the split

## Remaining `chat -> convo` Logic Buckets

### 1. Global Reset / Clear Fanout

These are global chat actions that currently clear per-convo state:

- `clearMetas`
- `inboxRefresh(... 'inboxSyncedClear')` message clearing
- `resetState -> clearChatStores()`

Desired end state:

- `chat.resetState` resets only chat-global state
- convo reset/clear is invoked separately from the owning layer
- full chat teardown is composed by the caller, not hidden inside `chat.tsx`

### 2. Route-Selection Side Effects

These are router-driven actions currently fired by `chat.onRouteChanged`:

- `selectedConversation`
- `tabSelected`

Desired end state:

- route subscriptions call convo-owned selection helpers directly
- `chat.tsx` does not decide active convo state

### 3. Convo Hydration / Bootstrap

These are chat-global flows that currently materialize or mutate convo state:

- `metasReceived`
- `updateInboxLayout` first-load hydration
- `ensureWidgetMetas`
- `queueMetaToRequest`
- `queueMetaHandle`
- `unboxRows`

Desired end state:

- `chat` owns inbox/global source data
- convo hydration and trusted/untrusted materialization move to convo ownership
- `chat` no longer pushes metadata into convo stores

### 4. Create Conversation Flow

`createConversation` currently:

- performs the RPC
- seeds participants/meta
- navigates pending/new convo state
- populates pending error convo state

Desired end state:

- conversation-creation flow lives with the feature or pending-convo ownership
- `chat.tsx` does not navigate threads or write pending convo state

### 5. Engine Notification Fanout

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

### 6. Badge / Unread Ownership

This is last because it is the riskiest ownership decision.

Current state:

- global badge totals live in `chat`
- per-convo badge/unread also get updated from `chat`

Possible end states:

- derive per-convo badge/unread from global inbox/badge data
- or move per-convo badge ownership fully to convo state

Do not decide this early. Resolve simpler buckets first.

## Recommended Order

1. Global reset / clear fanout
2. Route-selection side effects
3. Convo hydration / bootstrap
4. Create conversation flow
5. Engine notification fanout
6. Badge / unread ownership

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
