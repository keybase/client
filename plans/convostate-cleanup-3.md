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

- [x] Add a mounted conversation thread provider under `shared/chat/conversation`
  - [x] Add the initial `ConversationThreadProvider` boundary around the normal mounted thread subtree
  - [x] Own active thread data with React context plus reducer/local state, not Zustand
  - [x] Key provider state by `conversationIDKey` so switching threads resets mounted UI correctly
  - [x] Expose initial core thread selectors for loaded state, ordinals, pagination, and message render type without preserving the old `ConvoState` API shape
  - [x] Preserve React Compiler guidance: avoid unnecessary `useMemo`/`useCallback` and do not read/write refs during render
- [x] Add a chat-specific non-Zustand thread cache
  - [x] Add explicit `get`, `put`, `delete`, and `clear` helpers for a non-reactive thread snapshot cache
  - [x] Store last-loaded core thread snapshots by `conversationIDKey`
  - [x] Include message maps/ordinals and pagination flags needed for fast remount
  - [x] Keep cache reads/writes explicit through `get`, `put`, `delete`, and `clear` helpers
  - [x] Register cache clearing with debug/external reset plumbing currently handled by `convo-registry`
  - [x] Do not add subscriptions, in-flight request registries, or hidden mutable feature state to the cache
- [x] Route thread entry through the provider
  - [x] Seed normal thread entry from the cache if present, while avoiding cache seeding for centered/highlight loads
  - [x] Always refresh/reload from the chat service on entry or focus
  - [x] Replace stale cache entries after service results arrive
  - [x] Ignore stale async responses for conversations that are no longer mounted

## Chunk 1: Move Core Thread Loading And Pagination

- [x] Move these fields from `ConvoStore` into the mounted provider/cache:
  - [x] `loaded`
  - [x] `messageMap`
  - [x] `messageOrdinals`
  - [x] `messageIDToOrdinal`
  - [x] `messageTypeMap`
  - [x] `pendingOutboxToOrdinal`
  - [x] `moreToLoadBack`
  - [x] `moreToLoadForward`
  - [x] `validatedOrdinalRange`
  - Mounted provider state now owns the active thread snapshot and mirrors into `convostate` only
    for temporary compatibility callers that have not moved yet.
- [x] Move thread-loading actions into provider-owned actions:
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
- [x] Preserve current loading semantics
  - [x] initial load still requests `numMessagesOnInitialLoad`
  - [x] pagination still uses forward/back pagination tokens
  - [x] centered loads still clear stale visible messages before loading around the pivot
  - [x] `validatedOrdinalRange` still prevents stale message validation bugs
  - [x] thread load status continues to report through `thread-load-status-context`
  - [x] user-initiated loads still mark the thread read when appropriate
- [x] Update all list/message consumers to read from the new thread provider
  - [x] desktop list area
  - [x] native list area
  - [x] message wrapper
  - [x] separator and row metadata callers for mounted rows
  - [x] message popups
  - [x] search/center/jump flows
- [x] Delete the moved fields from `ConvoStore` only after all consumers are off `useChatContext`
  - `shared/stores/convostate.tsx` has been deleted after all production and test consumers moved
    to the mounted provider, inbox metadata, inbox rows, explicit RPC helpers, or the thread cache.

## Chunk 2: Move Message Mutations And Active Engine Updates

- [x] Move thread message mutation helpers into the provider/runtime:
  - [x] message add/merge/indexing
  - [x] incoming message handling
  - [x] edit/delete mutation handling
  - [x] `messagesWereDeleted`
  - [x] `messagesExploded`
  - [x] `onMessagesUpdated`
  - [x] `onMessageErrored`
  - [x] `updateReactions`
  - [x] local reaction toggling for outbox reaction echoes
  - Extracted core message add/merge/indexing into `shared/chat/conversation/thread-message-state.tsx`.
    `convostate` still calls it as the compatibility backend until active engine mutation routing moves.
  - Extracted deletion, explosion, failed-outbox, server reaction update, and local reaction echo
    mutations into `shared/chat/conversation/thread-message-state.tsx`. `convostate` still calls
    these helpers as the compatibility backend until mounted active-thread listeners own routing.
  - Routed `NewChatActivity.messagesUpdated` through the mounted `ConversationThreadProvider`
    listener; global routing now invalidates the non-reactive thread cache without creating a
    background `convostate`.
  - Routed direct `NewChatActivity` expunge, ephemeral purge, and reaction-update row mutations
    through the mounted provider listener. Global routing still preserves global side effects such
    as `userReacjis`, but no longer creates background `convostate` instances for these events.
  - Routed `NewChatActivity.incomingMessage` through the mounted provider listener for the active
    visible thread. Global routing now preserves desktop notifications, inbox item return data, and
    thread cache invalidation without calling `getConvoState` for message-state updates.
  - Provider state now applies edit/delete incoming mutations, failed outbox updates, expunge,
    ephemeral purge, reaction updates, and messagesUpdated locally before mirroring to the temporary
    compatibility store.
- [x] Replace global per-conversation engine routing for active-thread-only updates with mounted typed listeners
  - [x] incoming messages update mounted provider when the conversation is visible
  - [x] stale-thread notifications trigger provider reload/focus refresh
  - [x] message updates, deletions, explosions, and reactions update mounted provider state
  - [x] unmounted conversations do not create or keep warm per-conversation stores for active-thread-only message events
    - `messagesUpdated`, expunge, ephemeral purge, and reaction updates no longer create background
      conversation stores; the mounted provider applies matching updates when visible.
    - Failed outbox message-state updates now route through mounted provider listeners; global
      routing preserves identify side effects and invalidates the thread cache without creating a
      background conversation store.
- [x] Keep inbox/global behavior outside the thread provider
  - [x] inbox layout and row summaries still refresh through inbox-owned stores
  - [x] app badge and chat tab badge remain server-owned/global
  - [x] no background message-mutation path should require `getConvoState(id)` just to keep a thread cache warm
- [x] Update tests so thread mutation coverage lives with the new provider/runtime instead of `shared/stores/tests/convostate.test.ts`
  - Added focused coverage for extracted mutation helpers in
    `shared/chat/conversation/thread-message-state.test.tsx`.
  - Added mounted-provider coverage for `messagesUpdated` and reaction-update typed listener
    routing, plus global routing guards that ensure these events preserve global side effects
    without creating background conversation stores.
  - Added mounted-provider coverage for visible incoming messages and a global routing guard that
    `incomingMessage` no longer creates a background store for message-state updates.
  - Deleted obsolete `shared/stores/tests/convostate.test.ts` after the remaining coverage moved to
    provider/runtime and `chat/inbox/engine` tests.

## Chunk 3: Move Metadata, Participants, Typing, Unread, And Badges

- [x] Move route-visible `meta` and `participants` out of `convostate`
  - [x] Seed from inbox layout/meta when available
  - [x] Refresh from thread/inbox service responses on entry
  - [x] Keep conversation header, info panel, input, message author data, retention notices, reset banners, and team hooks reading from the mounted provider or inbox-owned data
  - The conversation route and split/tablet header now create `ConversationThreadProvider`
    boundaries directly. Info panel, bot popups, emoji pickers, delete-history, selectable search
    rows, pinned rows, special top/bottom messages, system rows, team hooks, user/command
    suggestors, and team/channel retention/participant surfaces no longer read route-visible
    metadata or participants through `useChatContext` / `useConvoState`.
  - Provider/cache snapshots and channel participant caches clone message/meta/participant
    `Map`, `Set`, array, and object fields through Immer-produced values so moving data out of
    Zustand preserves the old immutable object model.
  - Added `chat/inbox/metadata` as the inbox/global metadata owner. It stores Immer-produced copies
    of conversation meta and participant info, feeds mounted thread initial state together with the
    non-reactive thread cache, and backs menubar/archive/incoming-share metadata reads without
    creating compatibility thread stores.
- [x] Move inbox-row-specific state to inbox owners
  - [x] `badge`
  - [x] `unread`
  - [x] snippet/snippet decoration updates
  - [x] row participants display fallback
  - [x] typing snippet
  - Inbox rows now sync snippets, draft flags, mute state, reset/rekey display flags, team/channel names,
    and participant fallbacks directly from inbox layout/meta/participant notifications. Search
    selectable rows read these display fields from `inbox-rows` instead of `convostate.meta`.
- [x] Route typing updates without creating conversation stores
  - [x] mounted current thread provider receives visible typing state
  - [x] inbox row state receives typing snippets for list display
  - [x] unmounted non-visible threads do not maintain full typing sets in per-thread Zustand
  - Badge/unread sync and chat typing notifications now update `inbox-rows` directly instead of
    creating per-conversation stores; native back badges and desktop menubar widget badges now read
    from server-owned badge state rather than `convostate`.
  - Active thread typing updates now route through `ConversationThreadProvider`, and the composer
    typing indicator reads that mounted provider state instead of `convostate.typing`.
  - Removed the dead `convostate` `badge`, `unread`, and full-thread `typing` fields/actions after
    inbox rows and the mounted thread provider took over those responsibilities.
- [x] Replace helper functions that currently update `convostate` metadata
  - [x] `metasReceived`
  - [x] `hydrateInboxLayout`
  - [x] `hydrateInboxConversations`
  - [x] `clearConversationsForInboxSync`
  - [x] `queueMetaToRequest` callers that only inspect conversation metadata
  - Inbox row display state now has direct sync helpers called from `metasReceived`,
    `hydrateInboxLayout`, inbox participant hydration, and `ChatParticipantsInfo`, so row summaries
    do not depend on creating/updating per-conversation stores.
  - Metadata/unbox/badge/inbox-sync helpers now live in `chat/inbox/metadata`. Visible
    inbox/search/widget callers use the new module directly, and trusted/requesting state is tracked
    on inbox-owned rows.
- [x] Remove `isMetaGood`, `isCaughtUp`, and `getConvID` from the store API after replacement helpers exist
  - The entire `convostate` API was removed after all callers moved to explicit provider/cache,
    inbox metadata, or service-RPC helpers.

## Chunk 4: Move Message Decorator Maps

- [x] Move notification-fed message decorators into the thread runtime/cache unless a better feature owner exists:
  - [x] `accountsInfoMap`
  - [x] `paymentStatusMap`
  - [x] `unfurlPrompt`
  - [x] `flipStatusMap`
- [x] Preserve behavior for mounted rows
  - [x] request/payment popups still show from `ChatRequestInfo` and `ChatPaymentInfo`
  - [x] wallet payment status still updates visible payment rows
  - [x] unfurl prompts still render and resolve/remove correctly
  - [x] coin-flip status still updates visible coin-flip rows and participant popups
- [x] Decide decorator fallback behavior explicitly
  - [x] when unmounted, rely on reload-on-entry for durable message decorations where possible
  - [x] cache only the small decorator maps needed to avoid visible flicker after remount
  - [x] do not keep a global engine-fed decorator cache unless a concrete missed-update bug requires it
- [x] Move or rewrite related tests from `convostate.test.ts` into colocated message/payment/unfurl/coinflip runtime tests
  - Mounted `thread-context` tests now cover visible request/payment decorators, unfurl prompts, and
    coin-flip status. `convostate` routing tests now assert those global notifications no longer
    create background conversation stores.

## Chunk 5: Move Attachment Transfer And Media Helpers

- [x] Move active attachment helpers out of `convostate`
  - [x] `attachmentPasted`
  - [x] `attachmentPreviewSelect`
  - [x] `attachmentUploadCanceled`
  - [x] `attachmentsUpload`
  - [x] `attachFromDragAndDrop`
  - [x] `attachmentDownload`
  - [x] `messageAttachmentNativeSave`
  - [x] `messageAttachmentNativeShare`
  - [x] `loadNextAttachment`
  - [x] `galleryMessagesLoaded`
- [x] Preserve transfer state behavior in the mounted thread runtime
  - [x] upload start/progress updates pending attachment rows
  - [x] download progress and complete update visible rows and gallery as today
  - [x] failed downloads still set the visible transfer error
  - [x] gallery-loaded messages still inject into the active thread/cache when needed
  - Extracted attachment transfer row mutations into `thread-message-state` and routed upload/download
    transfer notifications through mounted `ConversationThreadProvider` listeners. Global transfer
    routing now invalidates the thread cache without creating background conversation stores.
  - Info-panel gallery loads now inject gallery-only messages through a mounted thread provider action
    instead of `convostate.dispatch.galleryMessagesLoaded`.
  - Attachment paste/upload/cancel/preview/download/save/share/gallery and fullscreen next/previous
    actions now live in `attachment-actions` and mounted thread helpers; the `convostate` dispatch
    surface was removed.
- [x] Keep platform behavior intact
  - [x] desktop paste creates temp upload and navigates to title entry
  - [x] Darwin drag/drop temp-copy behavior stays guarded by platform checks
  - [x] native save/share and iOS PDF handoff keep current flows
  - [x] send-to-chat attachment flow still posts with the selected conversation metadata

## Chunk 6: Move Send, Draft, Exploding, And Input-Adjacent Actions

- [x] Move send orchestration into the mounted input/thread runtime
  - [x] `sendMessage`
  - [x] `giphySend`
  - [x] `sendAudioRecording`
  - [x] `messageRetry`
  - [x] `updateDraft`
- [x] Preserve send semantics
  - [x] edit mode posts edit RPC and restores text on canceled stellar flows
  - [x] reply mode sends the correct reply target message ID
  - [x] Giphy selection still tracks with `localTrackGiphySelectRpcPromise`
  - [x] audio recording still creates the preview and posts as a file attachment
  - [x] failed outbox retry still clears the visible error state before retrying
  - [x] unsent draft updates remain throttled and service-backed
  - Text, edit, reply, Giphy, audio, failed-outbox retry, and draft update paths now live in
    `send-actions`, input state, or mounted thread actions. The retry and edit submit-state paths no
    longer mirror back into the compatibility store.
- [x] Move `explodingMode` and `setExplodingMode`
  - [x] mounted input owns selected exploding duration
  - [x] Gregor category load/update still initializes and persists the per-conversation duration
  - [x] retention policy clamping still matches current input behavior
  - [x] sending text/files/audio still includes `ephemeralLifetime` when selected
  - `ConversationThreadProvider` owns the selected exploding duration, initializes it from Gregor
    state, persists changes through the same Gregor category rules, and mirrors to the temporary
    compatibility store only while older tests/helpers remain.

## Chunk 7: Move One-Off UI And Settings RPC Wrappers

- [x] Move navigation and UI wrappers to route/feature helpers:
  - [x] `showInfoPanel`
  - [x] `toggleThreadSearch`
  - [x] `openFolder`
  - [x] `prepareToNavigateToThread`
  - [x] `dismissBottomBanner`
  - `openFolder` is now a local header action that derives the KBFS path from the selected row
    metadata/participants and calls `navToPath` directly; the `convostate` dispatch wrapper was removed.
  - Thread-search toggling is now a storeless `thread-context` helper/hook used by mounted thread
    surfaces and the native header; the `convostate` dispatch wrapper was removed.
  - Pending-error thread preparation is route-owned; the router no longer creates a compatibility
    thread store just to mark the pending error thread loaded.
  - Info-panel showing/hiding is now a storeless `thread-context` helper/hook used by headers,
    attachment surfaces, and system-message links; the `convostate` dispatch wrapper was removed.
  - Invite bottom-banner dismissal is now mounted component state keyed by conversation instead of
    `convostate.dismissedInviteBanners`; the `dismissBottomBanner` wrapper was removed.
- [x] Move settings/action RPC wrappers to owning screens:
  - [x] `markTeamAsRead`
  - [x] `setConvRetentionPolicy`
  - [x] `setMinWriterRole`
  - [x] `updateNotificationSettings`
  - [x] `pinMessage`
  - [x] `ignorePinnedMessage`
  - [x] `dismissJourneycard`
  - `markTeamAsRead` now runs directly from the info-panel menu with the same TLF mark-read RPC;
    the `convostate` dispatch wrapper was removed.
  - `setMinWriterRole` now runs directly from the min-writer-role settings component with the same
    local RPC; the `convostate` dispatch wrapper was removed.
  - `updateNotificationSettings` now runs directly from the notification settings component with the
    same app-notification settings RPC; the `convostate` dispatch wrapper was removed.
  - Conversation retention policy updates now run directly from the retention settings screen with
    the same local retention RPC; the `convostate` wrapper was removed.
  - Pin, unpin, and ignore pinned-message actions now run directly from the pinned-message and
    message-popup components; the `convostate` dispatch wrappers were removed.
  - Journeycard dismissal now runs from a mounted thread helper that performs the dismiss RPC and
    deletes the visible row through provider state; the `convostate` wrapper was removed.
- [x] Move blocking/reset/bot wrappers if no global owner remains:
  - [x] `blockConversation`
  - [x] `hideConversation`
  - [x] `joinConversation`
  - [x] `mute`
  - [x] `addBotMember`
  - [x] `editBotSettings`
  - [x] `removeBotMember`
  - [x] `resetChatWithoutThem`
  - [x] `resetLetThemIn`
  - [x] `messageDeleteHistory`
  - Bot add/edit/remove, reset-user recovery actions, and delete-history confirmation now perform
    their RPCs or navigation directly from the owning chat screens; those `convostate` wrappers were
    removed.
  - Conversation blocking/reporting now runs directly from the blocking modal with the same status
    RPC and inbox navigation behavior; the `convostate` wrapper was removed.
  - Hide, mute, and join now use explicit storeless conversation status helpers shared by mounted
    chat surfaces and inbox swipe actions; those `convostate` wrappers were removed.
- [x] Prefer colocated `C.useRPC` calls when the result only affects the mounted screen
- [x] Keep any shared helper file-local unless multiple unrelated features need it

## Chunk 8: Replace Provider, Registry, And Global Access

- [x] Replace `ChatProvider`/`ProviderScreen` Zustand context with the new conversation provider stack
- [x] Replace `useChatContext(...)` and `useConvoState(...)` consumers
- [x] Replace `getConvoState(id)` call sites with one of:
  - [x] mounted thread provider action
  - [x] inbox/global store action
  - [x] direct service RPC from the owning feature
  - [x] pure helper using explicit arguments
  - [x] thread cache read/write helper when cache seeding is the real intent
- [x] Remove `useChatNavigateAppend` by passing explicit `conversationIDKey` from route/provider owners
  - Production `ChatProvider`, `ProviderScreen`, `useChatContext`, `useConvoState`, and
    `useChatNavigateAppend` consumers are gone. `makeChatScreen` now renders chat screens directly,
    while route/modal/popup surfaces that need thread state install `ConversationThreadProvider`
    with an explicit `conversationIDKey`.
  - `getConvoState(...)` and the remaining compatibility helpers were removed. Mounted code uses
    provider hooks, inbox/global helpers, explicit route props, service-backed channel loaders, or
    thread cache helpers.
  - Desktop menubar, archive, incoming-share, route preview, inbox search, visible inbox unbox, and
    init-time engine routing no longer create or subscribe to compatibility thread stores for
    metadata. Those surfaces read from `chat/inbox/metadata`, inbox rows, or the thread cache.
- [x] Delete `shared/stores/convo-registry.tsx` after the thread cache owns debug/reset clearing
- [x] Delete `createConvoStoreForTesting`, `hasConvoState`, and store-specific test helper usage
- [x] Delete `shared/stores/convostate.tsx` when no imports remain

## Chunk 9: Engine Routing Cleanup

- [x] Split current `routeConvoEngineIncoming(...)` responsibilities
  - [x] inbox/global events go to inbox layout, inbox rows, config/notifications, or users stores
  - [x] active-thread events go to typed mounted listeners
  - [x] service-owned state is reloaded on focus/stale notifications instead of mirrored in background thread stores
- [x] Remove engine cases that only exist to warm `convostate`
  - The production engine switch now lives in `chat/inbox/engine`. It updates inbox metadata/rows,
    invalidates the thread cache, preserves desktop notifications and user identify side effects,
    and leaves active-thread mutations to mounted `ConversationThreadProvider` listeners.
  - Global Gregor exploding-mode fanout to compatibility stores was removed; mounted providers
    initialize from current Gregor state and listen for Gregor pushes directly.
- [x] Preserve global handling for events that must survive unmounted UI
  - [x] inbox sync/layout
  - [x] unread/badge state
  - [x] user identity/participant info needed outside a visible thread
  - [x] push/deep-link routing
- [x] Confirm no engine path creates a conversation store for an unmounted conversation

## Validation

Manual app validation still requires a runnable Keybase client. This machine has no `node_modules`, so the
implementation pass was validated with code inspection, dependency scans, and `git diff --check` only.

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
