# Convostate Cleanup 3: Remove The Store As Thread Owner

Reference skill: `skill/zustand-store-pruning/SKILL.md`

## Summary

Continue the cleanup from `plans/convostate-cleanup.md` with a more aggressive target:
`shared/stores/convostate.tsx` should stop being the long-lived owner for per-thread UI and thread data.

The new default is that nothing stays in `convostate` unless it absolutely needs a global reactive
Zustand lifetime. Entering a thread reloads from the chat service anyway, so the mounted conversation
route should own the current thread. Chat is allowed a small module-level cache as a special case, but
that cache must be explicit, non-reactive, resettable, and used only to seed visible thread state.

The intended end state is:

- `convostate` is deleted, or reduced to temporary compatibility exports during migration
- the mounted conversation route owns active thread messages, metadata, pagination, decorators, and actions
- inbox/global stores own inbox row summaries, unread/badge display, and background chat list state
- typed engine listeners update mounted chat UI directly when visible
- unmounted threads rely on service reload plus optional chat cache seeding, not warm Zustand stores

## Guiding Rules

- Default to moving state out of `convostate`; keep something there only with a concrete global-lifetime reason
- Do not silently drop behavior; preserve every send, edit, delete, reaction, search, attachment, bot, payment, unfurl, and navigation flow
- Prefer reloading thread data on entry/focus/stale notifications over maintaining per-conversation frontend mirrors
- A chat module-level cache is allowed, but it must not become a hidden reactive store or listener registry
- Keep the service as source of truth; cache entries are performance hints, not durable truth
- Use mounted typed engine listeners for active-thread UI updates that can be missed while unmounted
- Move one-off RPC wrappers into the feature that initiates them unless several unrelated owners genuinely share the action
- Delete compatibility wrappers in the same chunk after all callers move
- Before deleting any field/action, prove all consumers moved and remove related tests/imports/dead helpers

## New Thread Runtime Shape

- [ ] Add a mounted conversation thread provider under `shared/chat/conversation`
  - [x] Add the initial `ConversationThreadProvider` boundary around the normal mounted thread subtree
  - [ ] Own active thread data with React context plus reducer/local state, not Zustand
  - [x] Key provider state by `conversationIDKey` so switching threads resets mounted UI correctly
  - [x] Expose initial core thread selectors for loaded state, ordinals, pagination, and message render type without preserving the old `ConvoState` API shape
  - [ ] Preserve React Compiler guidance: avoid unnecessary `useMemo`/`useCallback` and do not read/write refs during render
- [ ] Add a chat-specific non-Zustand thread cache
  - [x] Add explicit `get`, `put`, `delete`, and `clear` helpers for a non-reactive thread snapshot cache
  - [x] Store last-loaded core thread snapshots by `conversationIDKey`
  - [ ] Include message maps/ordinals, lightweight metadata, participants, pagination flags, and decorator maps only if needed for fast remount
  - [x] Keep cache reads/writes explicit through `get`, `put`, `delete`, and `clear` helpers
  - [x] Register cache clearing with debug/external reset plumbing currently handled by `convo-registry`
  - [x] Do not add subscriptions, in-flight request registries, or hidden mutable feature state to the cache
- [ ] Route thread entry through the provider
  - [x] Seed normal thread entry from the cache if present, while avoiding cache seeding for centered/highlight loads
  - [x] Always refresh/reload from the chat service on entry or focus
  - [x] Replace stale cache entries after service results arrive
  - [x] Ignore stale async responses for conversations that are no longer mounted

## Chunk 1: Move Core Thread Loading And Pagination

- [ ] Move these fields from `ConvoStore` into the mounted provider/cache:
  - [ ] `loaded`
  - [ ] `messageMap`
  - [ ] `messageOrdinals`
  - [ ] `messageIDToOrdinal`
  - [ ] `messageTypeMap`
  - [ ] `pendingOutboxToOrdinal`
  - [ ] `moreToLoadBack`
  - [ ] `moreToLoadForward`
  - [ ] `validatedOrdinalRange`
- [ ] Move thread-loading actions into provider-owned actions:
  - [x] `selectedConversation`
  - [x] `tabSelected`
  - [x] `loadMoreMessages`
  - [x] `loadOlderMessagesDueToScroll`
  - [x] `loadNewerMessagesDueToScroll`
  - [x] `loadMessagesCentered`
  - [x] `jumpToRecent`
  - [x] `messagesClear`
  - Mounted provider path now owns `selectedConversation`, `loadMoreMessages`, `messagesClear`,
    centered loads, and scroll pagination wrappers through `thread-context`; `convostate` remains as
    the compatibility state backend until message mutations move.
  - Removed mounted-path use of the obsolete `convostate` dispatch wrappers for centered loads,
    scroll pagination, jump-to-recent, `loadMoreMessages`, and active centered clear. These still
    write the temporary compatibility state until core message state fully moves into the mounted
    provider.
- [ ] Preserve current loading semantics
  - [x] initial load still requests `numMessagesOnInitialLoad`
  - [x] pagination still uses forward/back pagination tokens
  - [x] centered loads still clear stale visible messages before loading around the pivot
  - [x] `validatedOrdinalRange` still prevents stale message validation bugs
  - [x] thread load status continues to report through `thread-load-status-context`
  - [x] user-initiated loads still mark the thread read when appropriate
- [ ] Update all list/message consumers to read from the new thread provider
  - [x] desktop list area
  - [x] native list area
  - [x] message wrapper
  - [x] separator and row metadata callers for mounted rows
  - [x] message popups
  - [x] search/center/jump flows
- [ ] Delete the moved fields from `ConvoStore` only after all consumers are off `useChatContext`

## Chunk 2: Move Message Mutations And Active Engine Updates

- [ ] Move thread message mutation helpers into the provider/runtime:
  - [x] message add/merge/indexing
  - [ ] incoming message handling
  - [ ] edit/delete mutation handling
  - [ ] `messagesWereDeleted`
  - [ ] `messagesExploded`
  - [ ] `onMessagesUpdated`
  - [ ] `onMessageErrored`
  - [ ] `updateReactions`
  - [ ] local reaction toggling for outbox reaction echoes
  - Extracted core message add/merge/indexing into `shared/chat/conversation/thread-message-state.tsx`.
    `convostate` still calls it as the compatibility backend until active engine mutation routing moves.
- [ ] Replace global per-conversation engine routing for active-thread-only updates with mounted typed listeners
  - [ ] incoming messages update mounted provider when the conversation is visible
  - [ ] stale-thread notifications trigger provider reload/focus refresh
  - [ ] message updates, deletions, explosions, and reactions update mounted provider state
  - [ ] unmounted conversations do not create or keep warm per-conversation stores
- [ ] Keep inbox/global behavior outside the thread provider
  - [ ] inbox layout and row summaries still refresh through inbox-owned stores
  - [ ] app badge and chat tab badge remain server-owned/global
  - [ ] no background path should require `getConvoState(id)` just to keep a thread cache warm
- [ ] Update tests so thread mutation coverage lives with the new provider/runtime instead of `shared/stores/tests/convostate.test.ts`

## Chunk 3: Move Metadata, Participants, Typing, Unread, And Badges

- [ ] Move route-visible `meta` and `participants` out of `convostate`
  - [ ] Seed from inbox layout/meta when available
  - [ ] Refresh from thread/inbox service responses on entry
  - [ ] Keep conversation header, info panel, input, message author data, retention notices, reset banners, and team hooks reading from the mounted provider or inbox-owned data
- [ ] Move inbox-row-specific state to inbox owners
  - [ ] `badge`
  - [ ] `unread`
  - [ ] snippet/snippet decoration updates
  - [ ] row participants display fallback
  - [ ] typing snippet
- [ ] Route typing updates without creating conversation stores
  - [ ] mounted current thread provider receives visible typing state
  - [ ] inbox row state receives typing snippets for list display
  - [ ] unmounted non-visible threads do not maintain full typing sets in per-thread Zustand
- [ ] Replace helper functions that currently update `convostate` metadata
  - [ ] `metasReceived`
  - [ ] `hydrateInboxLayout`
  - [ ] `hydrateInboxConversations`
  - [ ] `clearConversationsForInboxSync`
  - [ ] `queueMetaToRequest` callers that only inspect conversation metadata
- [ ] Remove `isMetaGood`, `isCaughtUp`, and `getConvID` from the store API after replacement helpers exist

## Chunk 4: Move Message Decorator Maps

- [ ] Move notification-fed message decorators into the thread runtime/cache unless a better feature owner exists:
  - [ ] `accountsInfoMap`
  - [ ] `paymentStatusMap`
  - [ ] `unfurlPrompt`
  - [ ] `flipStatusMap`
- [ ] Preserve behavior for mounted rows
  - [ ] request/payment popups still show from `ChatRequestInfo` and `ChatPaymentInfo`
  - [ ] wallet payment status still updates visible payment rows
  - [ ] unfurl prompts still render and resolve/remove correctly
  - [ ] coin-flip status still updates visible coin-flip rows and participant popups
- [ ] Decide decorator fallback behavior explicitly
  - [ ] when unmounted, rely on reload-on-entry for durable message decorations where possible
  - [ ] cache only the small decorator maps needed to avoid visible flicker after remount
  - [ ] do not keep a global engine-fed decorator cache unless a concrete missed-update bug requires it
- [ ] Move or rewrite related tests from `convostate.test.ts` into colocated message/payment/unfurl/coinflip runtime tests

## Chunk 5: Move Attachment Transfer And Media Helpers

- [ ] Move active attachment helpers out of `convostate`
  - [ ] `attachmentPasted`
  - [ ] `attachmentPreviewSelect`
  - [ ] `attachmentUploadCanceled`
  - [ ] `attachmentsUpload`
  - [ ] `attachFromDragAndDrop`
  - [ ] `attachmentDownload`
  - [ ] `messageAttachmentNativeSave`
  - [ ] `messageAttachmentNativeShare`
  - [ ] `loadNextAttachment`
  - [ ] `galleryMessagesLoaded`
- [ ] Preserve transfer state behavior in the mounted thread runtime
  - [ ] upload start/progress updates pending attachment rows
  - [ ] download progress and complete update visible rows and gallery as today
  - [ ] failed downloads still set the visible transfer error
  - [ ] gallery-loaded messages still inject into the active thread/cache when needed
- [ ] Keep platform behavior intact
  - [ ] desktop paste creates temp upload and navigates to title entry
  - [ ] Darwin drag/drop temp-copy behavior stays guarded by platform checks
  - [ ] native save/share and iOS PDF handoff keep current flows
  - [ ] send-to-chat attachment flow still posts with the selected conversation metadata

## Chunk 6: Move Send, Draft, Exploding, And Input-Adjacent Actions

- [ ] Move send orchestration into the mounted input/thread runtime
  - [ ] `sendMessage`
  - [ ] `giphySend`
  - [ ] `sendAudioRecording`
  - [ ] `messageRetry`
  - [ ] `updateDraft`
- [ ] Preserve send semantics
  - [ ] edit mode posts edit RPC and restores text on canceled stellar flows
  - [ ] reply mode sends the correct reply target message ID
  - [ ] Giphy selection still tracks with `localTrackGiphySelectRpcPromise`
  - [ ] audio recording still creates the preview and posts as a file attachment
  - [ ] failed outbox retry still clears the visible error state before retrying
  - [ ] unsent draft updates remain throttled and service-backed
- [ ] Move `explodingMode` and `setExplodingMode`
  - [ ] mounted input owns selected exploding duration
  - [ ] Gregor category load/update still initializes and persists the per-conversation duration
  - [ ] retention policy clamping still matches current input behavior
  - [ ] sending text/files/audio still includes `ephemeralLifetime` when selected

## Chunk 7: Move One-Off UI And Settings RPC Wrappers

- [ ] Move navigation and UI wrappers to route/feature helpers:
  - [ ] `showInfoPanel`
  - [ ] `toggleThreadSearch`
  - [ ] `openFolder`
  - [ ] `prepareToNavigateToThread`
  - [ ] `dismissBottomBanner`
- [ ] Move settings/action RPC wrappers to owning screens:
  - [ ] `markTeamAsRead`
  - [ ] `setConvRetentionPolicy`
  - [ ] `setMinWriterRole`
  - [ ] `updateNotificationSettings`
  - [ ] `pinMessage`
  - [ ] `ignorePinnedMessage`
  - [ ] `dismissJourneycard`
- [ ] Move blocking/reset/bot wrappers if no global owner remains:
  - [ ] `blockConversation`
  - [ ] `hideConversation`
  - [ ] `joinConversation`
  - [ ] `mute`
  - [ ] `addBotMember`
  - [ ] `editBotSettings`
  - [ ] `removeBotMember`
  - [ ] `resetChatWithoutThem`
  - [ ] `resetLetThemIn`
  - [ ] `messageDeleteHistory`
- [ ] Prefer colocated `C.useRPC` calls when the result only affects the mounted screen
- [ ] Keep any shared helper file-local unless multiple unrelated features need it

## Chunk 8: Replace Provider, Registry, And Global Access

- [ ] Replace `ChatProvider`/`ProviderScreen` Zustand context with the new conversation provider stack
- [ ] Replace `useChatContext(...)` and `useConvoState(...)` consumers
- [ ] Replace `getConvoState(id)` call sites with one of:
  - [ ] mounted thread provider action
  - [ ] inbox/global store action
  - [ ] direct service RPC from the owning feature
  - [ ] pure helper using explicit arguments
  - [ ] thread cache read/write helper when cache seeding is the real intent
- [ ] Remove `useChatNavigateAppend` by passing explicit `conversationIDKey` from route/provider owners
- [ ] Delete `shared/stores/convo-registry.tsx` after the thread cache owns debug/reset clearing
- [ ] Delete `createConvoStoreForTesting`, `hasConvoState`, and store-specific test helpers
- [ ] Delete `shared/stores/convostate.tsx` when no imports remain

## Chunk 9: Engine Routing Cleanup

- [ ] Split current `routeConvoEngineIncoming(...)` responsibilities
  - [ ] inbox/global events go to inbox layout, inbox rows, config/notifications, or users stores
  - [ ] active-thread events go to typed mounted listeners
  - [ ] service-owned state is reloaded on focus/stale notifications instead of mirrored in background thread stores
- [ ] Remove engine cases that only exist to warm `convostate`
- [ ] Preserve global handling for events that must survive unmounted UI
  - [ ] inbox sync/layout
  - [ ] unread/badge state
  - [ ] user identity/participant info needed outside a visible thread
  - [ ] push/deep-link routing
- [ ] Confirm no engine path creates a conversation store for an unmounted conversation

## Validation

- [ ] Open a thread cold and confirm service reload populates messages, metadata, participants, unread line, and input state
- [ ] Switch rapidly between two threads and confirm no message, metadata, input, or cache state leaks
- [ ] Reopen a recently viewed thread and confirm cache seeding prevents visible regressions while service reload refreshes it
- [ ] Paginate backward and forward, centered-load from search/deep link/reply jump, and jump back to recent
- [ ] Send, edit, delete, retry, react, reply, and reply privately
- [ ] Use Giphy, command suggestions/status, audio recording, and exploding messages
- [ ] Paste, drag/drop, upload, download, save, share, preview, and browse attachment gallery media
- [ ] Resolve/remove unfurl prompts, payment/request popups, wallet payment status, and coin-flip status updates
- [ ] Pin/unpin, ignore pinned message, dismiss journey cards, update retention, update min writer role, mute/hide/join/block/reset flows
- [ ] Confirm inbox rows still show unread/badge/snippet/typing/participants updates without per-conversation stores
- [ ] Confirm stale-thread and inbox sync notifications refresh the right visible/global owners
- [ ] Confirm debug/reset clears thread cache and mounted state can reload cleanly

## Local Validation Constraint

This machine currently has no `node_modules` for the Keybase client repo. Do not run `yarn`, `npm`,
`yarn lint`, `yarn tsc`, or other node-based toolchain commands unless dependencies are installed later.
Until then, validation is code review plus non-node inspection only.
