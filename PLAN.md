# Chat Message Perf Cleanup Plan

## Goal

Reduce chat conversation mount cost, cut per-row Zustand subscription fan-out, and remove render thrash in the message list without changing behavior.

## Constraints

- Preserve existing chat behavior and platform-specific handling.
- Prefer small, reviewable patches with one clear ownership boundary each.
- This machine does not have `node_modules` for this repo, so this plan assumes pure code work unless validation happens elsewhere.

## Working Rules

- Use one clean context per workstream below.
- Do not mix store-shape changes and row rendering changes in the same patch unless one directly unblocks the other.
- Keep desktop and native paths aligned unless there is a platform-specific reason not to.
- Treat each workstream as independently landable where possible.
- When a checklist item is implemented, update this plan in the same change and mark that item done.

## Workstreams

### 1. Row Renderer Boundary

- [x] Introduce a single row entry point that takes `ordinal` and resolves render type inside the row.
- [x] Remove list-level render dispatch from `messageTypeMap` where possible.
- [x] Delete the native `extraData` / `forceListRedraw` placeholder escape hatch if the new row boundary makes it unnecessary.
- [x] Keep placeholder-to-real-message transitions stable on both native and desktop.

Primary files:

- `shared/chat/conversation/list-area/index.native.tsx`
- `shared/chat/conversation/list-area/index.desktop.tsx`
- `shared/chat/conversation/messages/wrapper/index.tsx`
- `shared/chat/conversation/messages/placeholder/wrapper.tsx`

### 2. Incremental Derived Message Metadata

- [x] Stop rebuilding whole-thread derived maps on every `messagesAdd`.
- [x] Update separator, username-grouping, and reaction-order metadata only for changed ordinals and any affected neighbors.
- [x] Avoid rebuilding and resorting `messageOrdinals` unless thread membership actually changed.
- [x] Re-evaluate whether some derived metadata should live in store state at all.

Primary files:

- `shared/stores/convostate.tsx`
- `shared/chat/conversation/messages/separator.tsx`
- `shared/chat/conversation/messages/reactions-rows.tsx`

### 3. Row Subscription Consolidation

- [ ] Move toward one main convo-store subscription per mounted row.
- [x] Push row data down as props instead of reopening store subscriptions in reply, reactions, emoji, send-indicator, exploding-meta, and similar children.
- [x] Audit attachment and unfurl helpers for repeated `messageMap.get(ordinal)` selectors.
- [ ] Keep selectors narrow and stable when a child still needs to subscribe directly.

Primary files:

- `shared/chat/conversation/messages/wrapper/wrapper.tsx`
- `shared/chat/conversation/messages/text/wrapper.tsx`
- `shared/chat/conversation/messages/text/reply.tsx`
- `shared/chat/conversation/messages/reactions-rows.tsx`
- `shared/chat/conversation/messages/emoji-row.tsx`
- `shared/chat/conversation/messages/wrapper/send-indicator.tsx`
- `shared/chat/conversation/messages/wrapper/exploding-meta.tsx`

### 4. Split Volatile UI State From Message Data

- [ ] Inventory convo-store fields that are transient UI state rather than message graph state.
- [ ] Move route-local or composer-local state out of the main convo message store.
- [ ] Keep dispatch call sites readable and avoid direct component store mutation.
- [ ] Minimize unrelated selector recalculation when typing/search/composer state changes.

Primary files:

- `shared/stores/convostate.tsx`
- `shared/chat/conversation/*`

### 5. List Data Stability And Recycling

- [ ] Remove avoidable array cloning / reversing in the hottest list path.
- [x] Replace effect-driven recycle subtype reporting with data available before or during row render.
- [ ] Re-check list item type stability after workstreams 1 and 3 land.
- [ ] Keep scroll position and centered-message behavior unchanged.

Primary files:

- `shared/chat/conversation/list-area/index.native.tsx`
- `shared/chat/conversation/messages/text/wrapper.tsx`
- `shared/chat/conversation/recycle-type-context.tsx`

### 6. Measurement And Regression Guardrails

- [ ] Add or improve lightweight profiling hooks where they help compare before/after behavior.
- [ ] Define a manual verification checklist for initial thread mount, new incoming message, placeholder resolution, reactions, edits, and centered jumps.
- [ ] Capture follow-up profiling notes after each landed workstream.

Primary files:

- `shared/chat/conversation/list-area/index.native.tsx`
- `shared/chat/conversation/list-area/index.desktop.tsx`
- `shared/perf/*`

## Recommended Order

1. Workstream 1: Row Renderer Boundary
2. Workstream 2: Incremental Derived Message Metadata
3. Workstream 3: Row Subscription Consolidation
4. Workstream 4: Split Volatile UI State From Message Data
5. Workstream 5: List Data Stability And Recycling
6. Workstream 6: Measurement And Regression Guardrails

## Clean Context Prompts

Use these as narrow follow-up task starts:

1. "Implement Workstream 1 from `PLAN.md`: introduce a row-level renderer boundary and remove the native placeholder redraw hack."
2. "Implement Workstream 2 from `PLAN.md`: make convo-store derived message metadata incremental instead of full-thread recompute."
3. "Implement Workstream 3 from `PLAN.md`: consolidate message row subscriptions so row children mostly receive props instead of subscribing directly."
4. "Implement Workstream 4 from `PLAN.md`: split volatile convo UI state from message graph state."
5. "Implement Workstream 5 from `PLAN.md`: stabilize list data and recycling after the earlier refactors."
6. "Implement Workstream 6 from `PLAN.md`: add measurement hooks and a regression checklist for the chat message perf cleanup."
