# Chat Store Cleanup

Reference skill: `skill/zustand-store-pruning/SKILL.md`

## Summary

Shrink `shared/stores/chat.tsx` by moving service-backed convenience state and feature-local UI caches out of Zustand, while leaving `shared/stores/convostate.tsx` and `shared/stores/inbox-rows.tsx` alone for now.

The end state is:

- inbox screens load and derive inbox state through chat-owned hooks instead of a small global convenience store
- maybe-mention resolution, emoji preference UI, and block-button UI state live with the owning feature where possible
- the remaining Zustand surface is limited to state that truly needs app-wide lifetime

Assumption for this plan: local service RPCs are cheap enough that we prefer reloading on mount/focus over preserving small frontend caches.

## Guiding Rules

- This plan is for `shared/stores/chat.tsx`, not a `convostate` rewrite
- Do not preserve a Zustand cache just to avoid a small number of local chat RPCs
- Prefer feature hooks and local state over a chat-wide convenience cache
- Prefer mounted-screen reloads and typed engine listeners over background cache maintenance where the UI can safely miss events while unmounted
- Do not introduce module-level mutable state as a replacement for Zustand
  - no module-level caches
  - no module-level listener registries
  - no module-level in-flight request maps
  - no module-level `useSyncExternalStore(...)` stores backed by module variables
  - if several mounted descendants need shared state on one route, use a feature-local provider instead
- Keep behavior intact while changing ownership of state
- Slice-by-slice migrations must preserve current functionality; if mounted UI previously updated live while visible, move that update path into the new hook/provider/listener in the same slice instead of deferring it

## Chunk 1: Split Inbox Layout Ownership From The Global Chat Store

- [x] Introduce a chat inbox hook layer for mounted inbox consumers
  - `useInboxLayout(...)`
  - `useInboxBadges(...)`
  - `useInboxRetryState(...)`
- [x] Move `inboxHasLoaded`, `inboxLayout`, and `inboxRetriedOnCurrentEmpty` ownership out of the global chat store and into the inbox feature
- [x] Keep `useInboxState(...)` as the primary integration point for inbox screens
- [x] Update inbox refresh flows to use local hook state plus explicit reload calls

### Target callers for Chunk 1

- [x] `chat/inbox/use-inbox-state.tsx`
- [x] `chat/inbox/new-chat-button.tsx`
- [x] `chat/inbox/search-row.tsx`
- [x] `chat/inbox-and-conversation-shared.tsx`
- [x] inbox badge/divider UI that only depends on mounted inbox state

### Store fallout after Chunk 1

- [x] `inboxHasLoaded`
- [x] `inboxLayout`
- [x] `inboxRetriedOnCurrentEmpty`
- [x] `updateInboxLayout`
- [x] `inboxRefresh` ownership from the chat store, if the inbox feature can own it directly

## Chunk 2: Remove Maybe-Mention Cache From Global Chat State

- [x] Move `maybeMentionMap` out of `shared/stores/chat.tsx`
- [x] Replace it with a feature-local mention-resolution layer near `common-adapters/markdown/maybe-mention`
- [x] Keep resolution request and display state close to the mounted markdown consumer
- [x] If several mounted descendants need the same value, use a feature-local provider instead of a new global cache

### Files likely to move together

- [x] `common-adapters/markdown/maybe-mention/*`
- [x] `chat` engine-listener ownership for `chat.1.chatUi.chatMaybeMentionUpdate`
- [x] any teams/profile integration that only uses maybe-mention display data

### Store fallout after Chunk 2

- [x] `maybeMentionMap`
- [x] `setMaybeMentionInfo`
- [x] `chat.1.chatUi.chatMaybeMentionUpdate` handling in `stores/chat.tsx`

## Chunk 3: Remove Emoji Preference Convenience State

- [x] Re-evaluate `userReacjis` ownership
- [x] Move emoji picker and reaction-row preference state into a dedicated chat-emoji hook or provider if it does not need chat-wide store lifetime
- [x] Keep the owning RPCs near the emoji picker / reaction UI
- [x] Do not duplicate the same top-reaction or skin-tone cache in multiple places

### Target callers for Chunk 3

- [x] `chat/emoji-picker/container.tsx`
- [x] `chat/conversation/messages/emoji-row.tsx`
- [x] `chat/conversation/messages/message-popup/reactionitem.tsx`

### Store fallout after Chunk 3

- [x] `userReacjis`
- [x] `updateUserReacjis`

## Chunk 4: Re-evaluate Static Config and Block Buttons

- [x] Re-evaluate whether `staticConfig` needs to live in the chat store
- [x] Prefer a dedicated lazy loader / hook for builtin command metadata if only suggestor surfaces need it
- [x] Re-evaluate `blockButtonsMap` as conversation-local or feature-local UI state
- [x] Keep gregor-driven block-button behavior intact while moving rendered state closer to the conversation UI if possible

### Target callers for Chunk 4

- [x] `chat/conversation/input-area/suggestors/commands.tsx`
- [x] `chat/blocking/invitation-to-block.tsx`

### Store fallout after Chunk 4

- [x] `staticConfig`
- [x] `loadStaticConfig`
- [x] `blockButtonsMap`
- [x] `dismissBlockButtons`
- [x] `updatedGregor`
- [x] `keybase.1.gregorUI.pushState` handling in `stores/chat.tsx`, if no other chat-store state still depends on it

## Chunk 5: Re-evaluate Badge Counts and Remaining Engine Plumbing

- [x] Re-evaluate whether `smallTeamBadgeCount`, `bigTeamBadgeCount`, and `badgeStateVersion` belong in `stores/chat.tsx`
- [x] Prefer deriving visible inbox badge behavior from inbox rows / notifications state where practical
- [x] Keep only the minimal bridge needed for chat-specific badge UI if deriving everything elsewhere is too invasive for this pass
- [x] Re-evaluate remaining store-owned engine handling:
  - [x] `chat.1.NotifyChat.ChatInboxStale`
  - [x] `chat.1.NotifyChat.ChatIdentifyUpdate`
  - [x] `keybase.1.NotifyBadges.badgeState`

### Likely dependencies to update

- [x] `chat/inbox/row/big-teams-divider.tsx`
- [x] `chat/inbox/row/teams-divider-container.tsx`
- [x] `chat/conversation/header-area/index.native.tsx`
- [x] any inbox-visible badge affordances that still read the chat store

### Store fallout after Chunk 5

- [x] `smallTeamBadgeCount`
- [x] `bigTeamBadgeCount`
- [x] `badgeStateVersion`
- [x] `badgesUpdated`
- [x] any remaining `onEngineIncomingImpl` cases no longer needed after earlier chunks

## Chunk 6: Decide What, If Anything, Stays In Zustand

- [x] Review what remains in `shared/stores/chat.tsx`
- [x] Delete dead selectors, helpers, and tests
- [x] If only a tiny lazy-config surface remains, move it into feature hooks and remove the store entirely
- [x] If something must remain, document exactly why it needs app-wide lifetime

`shared/stores/chat.tsx` is now a barrel module only. The expunge delete-history static config remains in the existing config store because engine handling needs synchronous app-wide access while UI screens may be unmounted.

### Likely candidates to remove by the end

- `inboxHasLoaded`
- `inboxLayout`
- `inboxRetriedOnCurrentEmpty`
- `maybeMentionMap`
- `userReacjis`
- `blockButtonsMap`
- `staticConfig`
- maybe badge-count convenience state

### Explicitly out of scope for this plan

- `shared/stores/convostate.tsx`
- `shared/stores/inbox-rows.tsx`
- deep conversation message/state ownership beyond the callers that currently read `stores/chat.tsx`

## Validation

- [ ] Inbox still loads, retries, and renders empty-state behavior correctly
- [ ] Big-team and small-team badge UI still renders correctly
- [ ] Maybe-mention rendering and resolution still works
- [ ] Emoji picker, reaction row, and skin-tone selection still work
- [ ] Slash-command suggestor still loads builtin commands correctly
- [ ] Block-buttons UI still appears and dismisses correctly
- [x] No new module-level mutable cache is introduced as a replacement for Zustand
