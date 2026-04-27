# Convostate Store Cleanup

Reference skill: `skill/zustand-store-pruning/SKILL.md`

## Summary

Thin `shared/stores/convostate.tsx` without changing chat behavior. This store is already conversation-instance scoped, so the goal is not to remove all conversation state. The goal is to keep durable per-thread data and notification-driven message state in `convostate`, while moving mounted-screen UI state, route-owned state, and cheap service-backed convenience caches closer to their owning features.

The end state is:

- `convostate` remains the per-conversation owner for thread metadata, participants, message data, unread/badge state, typing state, and engine-fed message mutations
- input composer state lives with the mounted conversation input experience instead of in a parallel `ConvoUIState` registry
- attachment gallery, channel suggestion, and bot setting UI data reload through feature hooks/providers instead of long-lived conversation store maps
- jump/highlight/search/orange-line state is owned by route/list UI where practical
- existing public behavior is preserved through compatibility wrappers until each consumer is migrated

Assumption for this plan: local chat service RPCs are cheap enough that feature screens can reload on mount/focus instead of keeping small frontend caches warm in Zustand.

Recommended cleanup order: move `attachmentViewMap` first, then `mutualTeams` and bot-role/settings convenience caches, then the input UI store, and only then route/list state. Defer payment/request/unfurl/coin-flip maps because they are notification-fed message decorations that mounted rows can miss if moved too early.

## Guiding Rules

- Keep all functionality; no feature should disappear as a side effect of pruning
- Do not introduce module-level mutable caches, listener registries, or in-flight request maps as replacements for Zustand
- Keep engine-fed durable state in `convostate` when mounted UI must not miss updates
- Move screen-only state to component state, route params, or a feature-local provider
- Prefer typed engine listeners in mounted feature hooks when a visible screen can reload on entry and only needs live updates while mounted
- Keep exported hooks/actions temporarily when that reduces migration risk, but make them wrappers around the new owner and delete them once callers are moved
- Before deleting a field/action, prove all consumers have moved and remove related tests/imports/dead helpers in the same slice

## Keep In Convostate

- Conversation identity and durable metadata: `id`, `meta`, `participants`, `loaded`, `moreToLoadBack`, `moreToLoadForward`
- Message thread state: `messageMap`, `messageOrdinals`, `messageIDToOrdinal`, `pendingOutboxToOrdinal`, `messageTypeMap`, `validatedOrdinalRange`
- Engine-fed durable UI state that must survive unmounted screens: `badge`, `unread`, `typing`, `explodingMode`, pending/sent message transfer state
- Notification-fed message enrichments that are tied to rendered messages and can arrive while unmounted: `accountsInfoMap`, `paymentStatusMap`, `unfurlPrompt`, `flipStatusMap`
- Core dispatch actions that mutate the thread, send/delete/edit messages, handle engine notifications, update meta/participants, or coordinate unread/badge state

## Move Out Of Convostate

- Feature-local caches: `attachmentViewMap`, `mutualTeams`, `botSettings`, `botTeamRoleMap`
- Input composer state: `ConvoUIState`, `convoUIStores`, `useChatUIContext`, `useConvoUIState`, `getConvoUIState`, `editing`, `replyTo`, `unsentText`, `giphyWindow`, `giphyResult`, and `commandStatus`
- Route/list UI state where practical: `messageCenterOrdinal`, `pendingJumpMessageID`, `markedAsUnread`, `threadLoadStatus`
- Derived row presentation state if it can be computed in the list/message layer without regressing list recycling or separator behavior: `rowRecycleTypeMap`, `separatorMap`, `showUsernameMap`
- Imperative wrapper actions whose only purpose is to let a component call an RPC that affects only that mounted feature

## Chunk 1: Add Regression Coverage Before Moving State

- [ ] Preserve the current core `convostate` tests for message merge, deletion, reaction, payment, coin-flip, meta, badge, and derived row behavior
- [ ] Add or confirm coverage for input UI behavior before moving it:
  - [ ] injecting text into the composer from same-thread UI
  - [ ] incoming share / send-to-chat prefill behavior
  - [ ] edit-last-message selection and clearing
  - [ ] reply selection and clearing after send
  - [ ] giphy result/window behavior
  - [ ] command status and command markdown display behavior
- [ ] Add or confirm coverage for non-input feature state:
  - [ ] attachment gallery load, clear, load-more, and error states
  - [ ] attachment download progress reflected in both rows and gallery when visible
  - [ ] mutual-team channel suggestions refresh on trigger
  - [ ] bot settings and bot role refresh flows
- [ ] Add or confirm coverage for route/list behavior:
  - [ ] centered message jump from search/deep link/reply jump
  - [ ] jump-to-recent clears search/highlight state
  - [ ] mark-unread orange line behavior
  - [ ] row separator, author-name, and recycle-type behavior after inserts/deletes/edits

## Chunk 2: Move Attachment Gallery State To The Attachments Feature

- [x] Create gallery state in `shared/chat/conversation/info-panel/attachments.tsx` or a colocated hook/provider
- [x] Move `attachmentViewMap`, `loadAttachmentView`, and `clearAttachmentView` ownership to that feature
- [x] Keep existing gallery behavior:
  - [x] load status starts as `loading`
  - [x] hits are deduped by message ID
  - [x] gallery messages are sorted newest-first
  - [x] loaded gallery messages are still injected into the thread cache when needed
  - [x] `last` and `error` status are preserved
- [x] Preserve attachment row behavior in `convostate`:
  - [x] upload/download progress on message rows remains engine-driven
  - [x] download complete still updates the backing message
  - [x] native save/share/PDF flows are unchanged
- [x] Route attachment-info-panel open/close behavior through the feature owner rather than clearing gallery state from `convostate.showInfoPanel`

Implementation note: `convostate` now keeps only `galleryMessagesLoaded(...)` for durable message-cache injection; the gallery map and gallery RPC lifecycle live in the attachments feature.

## Chunk 3: Move Suggestion And Bot Convenience Caches To Feature Hooks

- [x] Move `mutualTeams` and `channelSuggestionsTriggered` into channel suggestor ownership
- [x] First verify whether `channelSuggestionsTriggered` is dead or just indirectly invoked; remove it only if no trigger path exists
- [x] Reload mutual teams on suggestor activation for impteam conversations using `localGetMutualTeamsLocalRpcPromise`
- [x] Keep current loading behavior through the existing team-name lookup hook
- [x] Move `botTeamRoleMap` and `refreshBotRoleInConv` into the bot install modal first, since the role map is modal-owned state
- [x] Move bot install/info-panel `refreshBotSettings` flows into feature-local bot settings loaders
- [x] Move remaining `botSettings` command restriction lookup only after preserving `chatBotCommandsUpdateStatus` for command suggestions
- [x] Preserve bot actions that modify durable server state:
  - [x] `addBotMember`
  - [x] `editBotSettings`
  - [x] `removeBotMember`
- [x] Preserve `chatBotCommandsUpdateStatus` handling until the new command suggestor owner can receive the update directly while mounted
- [x] Delete the remaining store maps after all command-suggestor consumers move

### Target callers for Chunk 3

- `chat/conversation/input-area/suggestors/channels.tsx`
- `chat/conversation/input-area/suggestors/commands.tsx`
- `chat/conversation/bot/install.tsx`
- `chat/conversation/info-panel/bot.tsx`

Implementation note: channel suggestions now load mutual teams on suggestor mount. Bot install and info-panel add-to-channel flows now load bot role/settings locally. Command suggestions now subscribe directly to `chatBotCommandsUpdateStatus` while the input is mounted, keeping bot restriction settings in the suggestor layer instead of `convostate`.

Lint note: when local feature state needs to reset for a new conversation ID, do not call `setState` synchronously inside `useEffect`. Derive the blank/reset state from the current conversation key during render, remount the owning provider with `key`, or update from the external subscription callback so `react-hooks/set-state-in-effect` stays clean.

## Chunk 4: Move Composer UI State To The Conversation Input Feature

- [x] Introduce a conversation input provider or hook colocated with `shared/chat/conversation/input-area`
- [x] Move `editing`, `replyTo`, `unsentText`, `giphyWindow`, `giphyResult`, and `commandStatus` into that input owner
- [x] Preserve existing sentinels and draft semantics:
  - [x] `unsentText === undefined` means no local input override, so a server draft can still be adopted once
  - [x] `unsentText === ''` means intentionally cleared
  - [x] `editing === 0` and `replyTo === 0` continue to mean inactive until all consumers deliberately migrate to a different representation
- [x] Keep behavior for command markdown/status events:
  - [x] command status belongs to the input/suggestor surface
  - [x] command markdown moves with the composer/command UI because it is cleared on send and rendered beside the input
  - [x] mounted input code should subscribe to relevant typed engine events or receive them through a narrow compatibility bridge during migration
- [x] Preserve non-command `commandStatus` setters from location, audio, and native permission-denial flows
- [x] Replace `useChatUIContext(...)` consumers under the conversation tree with the new hook/provider
- [x] Replace direct `getConvoUIState(...).dispatch.injectIntoInput(...)` callers with explicit entry-context handling:
  - [x] `shared/incoming-share/index.tsx`
  - [x] `shared/chat/send-to-chat/index.tsx`
  - [x] message-reply-private prefill inside `convostate`
  - [x] native init permission-denial command-status handling
- [x] Keep `sendMessage` behavior intact:
  - [x] edit mode posts edit RPC and clears editing state
  - [x] reply mode sends `replyTo` message ID and clears reply state
  - [x] giphy send still tracks selection and sends target URL
- [x] Preserve debug/external reset behavior currently provided by clearing `convoUIStores` with `convo-registry`
- [x] Delete `ConvoUIState`, `initialConvoUIStore`, `createConvoUISlice`, `convoUIStores`, and UI-store test helpers only after all consumers are migrated

### Target callers for Chunk 4

- `chat/conversation/input-area/normal/*`
- `chat/conversation/reply-preview.tsx`
- `chat/conversation/command-status.tsx`
- `chat/conversation/giphy/hooks.tsx`
- `chat/conversation/messages/wrapper/*`
- `chat/conversation/messages/message-popup/*`
- `chat/audio/audio-recorder.native.tsx`
- `chat/conversation/input-area/location-popup.native.tsx`
- `constants/init/index.native.tsx`
- `incoming-share/index.tsx`
- `chat/send-to-chat/index.tsx`

Implementation note: conversation input UI state now lives in `shared/chat/conversation/input-area/input-state.tsx` and is provided from the normal conversation wrapper so list rows, message popups, and input descendants share one owner. Command markdown/status and Giphy engine actions are bridged into the input owner.

Implementation note: the old `ConvoUIState` compatibility surface has been removed. Composer edit-state regression coverage now lives with `shared/chat/conversation/input-area/input-state.tsx`, and `convostate` no longer handles command markdown/status or Giphy UI engine events.

## Chunk 5: Move Route And List UI State Where Practical

- [x] Move pending message-jump entry context out of `pendingJumpMessageID` and into route params or the navigation call path
- [ ] Move centered/highlight state out of `messageCenterOrdinal` into the list route/provider if list consumers can still react to search, reply-jump, deep-link, and jump-to-recent events
- [ ] Preserve current behaviors:
  - [x] `navigateToThread(..., highlightMessageID)` still deep-links and flashes the target message
  - [ ] `loadMessagesCentered` still clears stale messages, loads around the pivot, and highlights according to mode
  - [ ] `toggleThreadSearch(false)` clears or de-emphasizes highlight exactly as today
  - [ ] sending while search/highlight is active still closes search and jumps to recent
- [x] Move mark-unread orange-line UI out of `markedAsUnread` if the normal conversation screen can own it without missing service updates
- [x] Keep `setMarkAsUnread` server RPC behavior in `convostate` until all call sites use a feature-level action with equivalent fallback loading
- [ ] Move `threadLoadStatus` to route/list state if `loadMoreMessages` can report status through the feature owner without stale statuses bleeding across conversations
- [ ] Re-evaluate `rowRecycleTypeMap`, `separatorMap`, and `showUsernameMap`:
  - [ ] keep them in `convostate` if list virtualization requires precomputed stable row metadata
  - [ ] otherwise compute them in the list/message layer from `messageOrdinals`, `messageMap`, current username, and adjacent messages
- [ ] If row metadata moves, preserve the current refresh semantics for adjacent messages after inserts, deletes, explosions, edits, and reaction updates
- [x] Add missing tests before moving route/list state:
  - [x] highlight message entry context is consumed exactly once by `selectedConversation`
  - [x] `setMarkAsUnread(false)` remains a no-op
  - [x] `threadLoadStatus` resets to `none` on selected conversation
  - [x] native row recycle types are stable for pending, failed, reply, and reaction rows

Implementation note: highlighted message navigation now travels through `navigateToThread` route params or is loaded immediately when already viewing the same thread. The route highlight param is cleared after selection, and `convostate` no longer stores `pendingJumpMessageID`.

Implementation note: message-level mark-unread now updates the mounted conversation's orange-line owner through `OrangeLineContext`, while `convostate.setMarkAsUnread(...)` keeps the server `forceUnread` RPC and fallback message lookup behavior. The old `markedAsUnread` store field has been removed.

### Target callers for Chunk 5

- `chat/conversation/list-area/index.desktop.tsx`
- `chat/conversation/list-area/index.native.tsx`
- `chat/conversation/messages/wrapper/wrapper.tsx`
- `chat/conversation/messages/separator.tsx`
- `chat/conversation/normal/container.tsx`
- `chat/conversation/load-status.tsx`
- `chat/conversation/input-area/normal/index.tsx`
- router helpers that call `prepareToNavigateToThread`

## Chunk 6: Collapse The Store Surface

- [ ] Remove moved fields from `ConvoStore` and `initialConvoStore`
- [ ] Remove moved actions from `ConvoState['dispatch']`
- [ ] Remove dead helpers, imports, registry entries, and test helpers
- [ ] Keep `getConvoState`, `useConvoState`, `ChatProvider`, `ProviderScreen`, and `useChatContext` for durable thread state
- [ ] Keep `convo-registry` focused on real conversation stores only
- [ ] Update tests so `shared/stores/tests/convostate.test.ts` covers only remaining conversation-store behavior
- [ ] Add colocated feature tests for any state moved out of the store

## Validation

- [ ] Open a thread and confirm messages load, paginate backward/forward, and mark read
- [ ] Send, edit, delete, retry, react, reply, and reply privately
- [ ] Use giphy, bot command suggestors, command status, and command markdown
- [ ] Paste, drag/drop, upload, download, save, share, and preview attachments
- [ ] Open the attachments info panel and load additional gallery items
- [ ] Use channel suggestions in impteam conversations
- [ ] Add/edit/remove bots and verify bot command restrictions
- [ ] Deep-link/search/reply-jump to a message and jump back to recent
- [ ] Mark a thread unread and confirm the orange line and badge behavior
- [ ] Receive typing, badge, stale-thread, reaction, payment, unfurl, attachment-progress, and message-update notifications
- [ ] Switch conversations rapidly without leaking input state between threads
- [ ] No new module-level mutable cache is introduced as a replacement for Zustand

## Local Validation Constraint

This machine currently has no `node_modules` for the Keybase client repo. Do not run `yarn`, `npm`, `yarn lint`, `yarn tsc`, or other node-based toolchain commands unless dependencies are installed later. Until then, validation is code review plus non-node inspection only.
