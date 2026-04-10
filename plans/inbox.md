# Inbox Search Refactor

## Summary

The current inbox search setup uses `shared/chat/inbox/search-state.tsx` as a temporary bridge because desktop search input is rendered in `shared/chat/inbox-and-conversation-header.tsx`, while inbox search results and inbox list rendering live in the inbox tree. The refactor should happen in two parts:

1. Move desktop search out of the navigator header and into the inbox pane so desktop search can be owned by ordinary React state in one tree.
2. Follow with a broader cleanup that unifies native and desktop inbox search ownership and reduces remaining platform divergence where practical.
3. Clean up mobile inbox startup so push/saved-thread launches do not need the old deferred inbox mount workaround.

## Progress

- [x] Part 1 completed.
- [x] Part 2 completed: desktop and native inbox screens now consume the same route-owned inbox-search controller contract, and inbox-search state is no longer owned by `shared/stores/chat.tsx`.
- [ ] Part 3 planned: remove the mobile inbox deferred mount path and gate expensive inbox startup work on focus instead.

## Part 1: Move Desktop Search Out Of The Header

Goal:

- Remove the cross-tree desktop search split.
- Delete the temporary inbox-search Zustand store/provider after desktop no longer needs it.
- Keep user-visible native behavior unchanged.

Implementation changes:

- Remove `<SearchRow headerContext="chat-header" />` from `shared/chat/inbox-and-conversation-header.tsx`.
- Render the desktop search row at the top of the inbox pane, in the same tree that decides between desktop inbox list and desktop inbox search results.
- Make `shared/chat/inbox-and-conversation.tsx` own desktop search state and search lifecycle:
  - `isSearching`
  - `query`
  - `searchInfo`
  - selected result movement
  - select / cancel / submit handlers
  - active search RPC cancellation and restart
- Convert desktop `SearchRow` to a prop-driven component for search state and actions instead of reading `useInboxSearchState` directly.
- Convert desktop `InboxSearch` to receive search state and handlers from the local owner instead of reading the inbox-search Zustand store.
- Remove `InboxSearchProvider` usage from `shared/chat/inbox-and-conversation.tsx` and `shared/chat/inbox/defer-loading.tsx`.
- Delete `shared/chat/inbox/search-state.tsx` and its test once all consumers are moved off it.

Behavior requirements:

- Desktop still supports `Cmd+K`, Escape, Arrow Up/Down, and Enter.
- Desktop still swaps between inbox list and inbox search results the same way it does now.
- Selecting a conversation result closes search.
- Selecting a text hit opens thread search with the query.
- Desktop cancels active search RPCs on new query, unmount, and background.

Part 1 boundaries:

- Native keeps search inside the inbox tree as it does today.
- Do not bundle broader inbox row/list cleanup into this step.
- Do not change `convostate`.

## Part 2: Broader Inbox Cleanup / Native + Desktop Unification

Goal:

- Unify inbox search ownership across native and desktop.
- Share one inbox-search controller shape and one search-results rendering path where possible.
- Reduce the remaining “desktop owner vs native owner” split without forcing identical list implementations.

Implementation changes:

- Introduce one inbox-search controller hook in the inbox feature layer, owned by the route tree rather than Zustand.
- Use the same controller contract on both platforms:
  - `isSearching`
  - `query`
  - `searchInfo`
  - `startSearch`
  - `cancelSearch`
  - `setQuery`
  - `moveSelectedIndex`
  - `selectResult`
- Make both `shared/chat/inbox/index.desktop.tsx` and `shared/chat/inbox/index.native.tsx` consume that controller contract.
- Keep platform-specific list behavior where it is genuinely platform-specific:
  - desktop drag divider / DOM-specific list behavior
  - native mobile list layout behavior
- Keep one inbox-search results component interface so native and desktop no longer depend on different ownership models.
- Keep search lifecycle management in the shared inbox-search hook:
  - cancel previous search when query changes
  - cancel on unmount
  - cancel on background while mounted

Part 2 boundaries:

- Do not force desktop and native into one identical inbox screen file.
- Do not refactor inbox virtualization, drag resizing, or unread shortcut behavior unless required to support the shared search controller.
- Additional pruning of non-search inbox state in `shared/stores/chat.tsx` is a follow-up, not required for this plan.

## Part 3: Remove Mobile Inbox Deferred Startup Workaround

Goal:

- Stop relying on `shared/chat/inbox/defer-loading.tsx` to hide inbox mount work during phone startup from push or saved thread state.
- Keep the startup perf win by preventing expensive inbox refresh work until the inbox is actually focused.
- Remove the old gesture-handler timing workaround rather than preserving it by default.

Implementation changes:

- Route phone `chatRoot` directly to the normal inbox screen instead of `shared/chat/inbox/defer-loading.tsx`.
- Move the “do inbox work only when the inbox is actually visible” policy into inbox state ownership, primarily `shared/chat/inbox/use-inbox-state.tsx`.
- On mobile, avoid mount-time `inboxRefresh('componentNeverLoaded')` when `chatRoot` is mounted behind `chatConversation`.
- Keep the existing focus-driven refresh path as the trigger for first inbox load on phone.
- Delete `shared/chat/inbox/defer-loading.tsx` if no longer needed.

Behavior requirements:

- Cold start from a push or saved last thread should still open directly to the conversation.
- That startup path should not eagerly trigger inbox refresh work just because `chatRoot` exists under the pushed conversation.
- Opening the inbox afterward should still load inbox data normally.
- Normal non-push startup into chat inbox should still load inbox data without requiring extra navigation steps.

Part 3 boundaries:

- Do not change the push deep-link or saved-state startup routing shape unless that becomes necessary after the inbox-side cleanup.
- Do not keep the old 100ms gesture workaround unless it is proven still necessary after the simpler focus-gated approach.
- Do not bundle unrelated inbox row, search, or conversation-screen refactors into this step.

## Interfaces / Types

- `SearchRow` should become prop-driven and stop depending on a dedicated inbox-search store.
- `InboxSearch` should be fed by the local inbox owner / shared controller hook, not Zustand.
- `T.Chat.InboxSearchInfo` should remain the backing results/status shape unless a later cleanup proves a smaller local type is clearly better.
- No daemon RPC interfaces change.

## Test Plan

Part 1:

- Desktop search opens from the inbox pane, not the navigator header.
- `Cmd+K` focuses the desktop inbox search input.
- Typing updates results and selection behavior still works.
- Escape closes search.
- Enter selects the highlighted result.
- Active inbox search RPC is canceled on query replacement, background, and unmount.
- There are no remaining imports/usages of `useInboxSearchState` or `InboxSearchProvider`.

Part 2:

- Desktop and native both use the same inbox-search controller contract.
- Native user-visible behavior stays the same.
- Desktop and native both cancel active search RPCs on unmount/background.
- Selecting text hits vs conversation hits behaves the same on both platforms.
- No inbox-search state remains in `shared/stores/chat.tsx`.

Part 3:

- Push/saved-thread startup on phone does not eagerly refresh inbox data before the inbox is focused.
- Opening inbox after such a startup still loads inbox rows correctly.
- Normal direct navigation to chat inbox still triggers initial inbox load.
- `shared/chat/inbox/defer-loading.tsx` is removed if nothing still depends on it.

## Assumptions

- Part 1 is intentionally desktop-first and can leave native slightly different until Part 2.
- The main value of Part 1 is eliminating the cross-tree desktop search problem so local React ownership becomes possible.
- “Unify native and desktop inbox work” means shared search ownership and interface, not necessarily identical screen files or identical list internals.
- Part 3 assumes the deferred inbox wrapper is no longer the right place to solve startup cost; focus-gating inbox refresh work is the preferred simpler model.
