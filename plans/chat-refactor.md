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
- Do not preserve proxy dispatch APIs solely to avoid touching callers when state ownership changes; migrate callers to the new owner in the same workstream.
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
- [x] Audit per-message render-time computation and decide whether values that are only consumed by one caller should be stored in derived message state instead of recomputed during render.

Decision note:

- Cache per-row reaction order in convo-store derived metadata so reaction chips do not resort on every render.
- Keep separator orange-line timing/render decisions local for now because they still depend on live orange-line context and platform-specific presentation.

Audit outcome:

- If a field is message-local, deterministic, and the raw form has no semantic consumers, normalize it once when we build or merge the stored message instead of repeatedly massaging it during render.
- Do not add separate UI-derived duplicates to the stored message when the result depends on current user, convo meta, team permissions, platform, orange-line state, or other non-message context.
- Good row-derived metadata still belongs adjacent to the message, not inside the raw payload, when it depends on list position or neighboring messages. Today that includes render type, recycle type, separator linkage, username grouping, and reaction order.
- Current row-wrapper computations such as `showSendIndicator`, `showExplodingCountdown`, `hasUnfurlList`, `hasCoinFlip`, `textType`, `messageKey`, and popup eligibility should stay out of the stored message because they are not pure payload normalization.
- Popup-only work should stay local. Message popup item assembly, reaction tooltip user sorting, popup header formatting, git-push popup text generation, and journey-card action construction are transient and do not affect steady-state row mount cost.
- Presentation-dependent work should stay local. Timestamp formatting, orange-line time labels, image sizing, reply preview display text, and platform/team-role specific label decisions depend on UI context.
- The next normalization pass should focus on message fields that are effectively always consumed through one canonical display form, rather than widening the message shape with additional derived UI booleans.

Primary files:

- `shared/stores/convostate.tsx`
- `shared/chat/conversation/messages/separator.tsx`
- `shared/chat/conversation/messages/reactions-rows.tsx`

### 3. Row Subscription Consolidation

- [x] Move toward one main convo-store subscription per mounted row.
- [x] Push row data down as props instead of reopening store subscriptions in reply, reactions, emoji, send-indicator, exploding-meta, and similar children.
- [x] Audit attachment and unfurl helpers for repeated `messageMap.get(ordinal)` selectors.
- [x] Keep selectors narrow and stable when a child still needs to subscribe directly.

Decision note:

- Avoid override/fallback component modes when a parent can supply concrete row data.
- Prefer separate components for distinct behaviors, such as a real reaction chip versus an add-reaction button, rather than one component that mixes controlled, connected, and fallback paths.

Primary files:

- `shared/chat/conversation/messages/wrapper/wrapper.tsx`
- `shared/chat/conversation/messages/text/wrapper.tsx`
- `shared/chat/conversation/messages/text/reply.tsx`
- `shared/chat/conversation/messages/reactions-rows.tsx`
- `shared/chat/conversation/messages/emoji-row.tsx`
- `shared/chat/conversation/messages/wrapper/send-indicator.tsx`
- `shared/chat/conversation/messages/wrapper/exploding-meta.tsx`

### 4. Split Volatile UI State From Message Data

- [x] Inventory convo-store fields that are transient UI state rather than message graph state.
- [x] Move thread-search visibility and search request/results state out of `convostate` into route params plus screen-local UI state.
- [x] Move route-local or composer-local state out of the main convo message store.
- [x] Keep dispatch call sites readable and avoid direct component store mutation.
- [x] Minimize unrelated selector recalculation when typing/search/composer state changes.

Primary files:

- `shared/stores/convostate.tsx`
- `shared/chat/conversation/*`

### 5. List Data Stability And Recycling

- [x] Remove avoidable array cloning / reversing in the hottest list path.
- [x] Replace effect-driven recycle subtype reporting with data available before or during row render.
- [x] Re-check list item type stability after workstreams 1 and 3 land.
- [x] Keep scroll position and centered-message behavior unchanged.

Primary files:

- `shared/chat/conversation/list-area/index.native.tsx`
- `shared/chat/conversation/messages/text/wrapper.tsx`
- `shared/chat/conversation/recycle-type-context.tsx`

### 6. Measurement And Regression Guardrails

- [x] Add or improve lightweight profiling hooks where they help compare before/after behavior.
- [x] Define a manual verification checklist for initial thread mount, new incoming message, placeholder resolution, reactions, edits, and centered jumps.
- [x] Capture follow-up profiling notes after each landed workstream.

Primary files:

- `shared/chat/conversation/list-area/index.native.tsx`
- `shared/chat/conversation/list-area/index.desktop.tsx`
- `shared/perf/*`

Decision note:

- Keep `MessageList` and `Msg-{type}` as the main thread-level React Profiler comparators.
- Add a desktop `MessageWaypoint` profiler so chunked waypoint rendering shows up separately from full-list commits during scroll and centered-jump regressions.

Manual verification checklist:

1. Initial thread mount: open an already-active conversation and confirm the list lands at the bottom when there is no centered target, without a slow drift after messages finish loading.
2. Older-message pagination: scroll upward far enough to load history and confirm the visible message stays anchored instead of jumping when older rows are inserted above it.
3. New incoming message while pinned: with the list at the bottom, receive or send a new message and confirm the list stays pinned to the latest message on both desktop and native.
4. Placeholder resolution: send a message that first appears as a placeholder/pending row and confirm it resolves in place without row reuse glitches or scroll jumps.
5. Reactions and edits: add/remove a reaction and edit a message, then confirm only the affected row updates and desktop still scrolls to the editing message when edit mode opens.
6. Centered jumps: use thread search or another centered-message entry point and confirm the requested message is centered/highlighted without breaking later scroll anchoring.

Profiling notes:

- Workstream 5: compare native `MessageList` plus hot `Msg-{type}` buckets with `yarn maestro-test-perf-thread`, and compare desktop thread runs with `yarn desktop-perf-thread` while spot-checking edit-jump and centered-jump flows.
- Workstream 6: use the new desktop `MessageWaypoint` profiler to separate waypoint chunk commits from whole-list commits when evaluating scroll or search-jump changes.
- This machine does not have `node_modules`, so profiling and manual validation need to happen in another environment with the repo toolchain installed.

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
