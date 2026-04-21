# Chat Store Cleanup

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
- Keep behavior intact while changing ownership of state

## Chunk 1: Split Inbox Layout Ownership From The Global Chat Store

- [ ] Introduce a chat inbox hook layer for mounted inbox consumers
  - `useInboxLayout(...)`
  - `useInboxBadges(...)`
  - `useInboxRetryState(...)`
- [ ] Move `inboxHasLoaded`, `inboxLayout`, and `inboxRetriedOnCurrentEmpty` ownership out of the global chat store and into the inbox feature
- [ ] Keep `useInboxState(...)` as the primary integration point for inbox screens
- [ ] Update inbox refresh flows to use local hook state plus explicit reload calls

### Target callers for Chunk 1

- [ ] `chat/inbox/use-inbox-state.tsx`
- [ ] `chat/inbox/new-chat-button.tsx`
- [ ] `chat/inbox/search-row.tsx`
- [ ] `chat/inbox-and-conversation-shared.tsx`
- [ ] inbox badge/divider UI that only depends on mounted inbox state

### Store fallout after Chunk 1

- `inboxHasLoaded`
- `inboxLayout`
- `inboxRetriedOnCurrentEmpty`
- `updateInboxLayout`
- `inboxRefresh` ownership from the chat store, if the inbox feature can own it directly

## Chunk 2: Remove Maybe-Mention Cache From Global Chat State

- [ ] Move `maybeMentionMap` out of `shared/stores/chat.tsx`
- [ ] Replace it with a feature-local mention-resolution layer near `common-adapters/markdown/maybe-mention`
- [ ] Keep resolution request and display state close to the mounted markdown consumer
- [ ] If several mounted descendants need the same value, use a feature-local provider instead of a new global cache

### Files likely to move together

- [ ] `common-adapters/markdown/maybe-mention/*`
- [ ] `chat` engine-listener ownership for `chat.1.chatUi.chatMaybeMentionUpdate`
- [ ] any teams/profile integration that only uses maybe-mention display data

### Store fallout after Chunk 2

- `maybeMentionMap`
- `setMaybeMentionInfo`
- `chat.1.chatUi.chatMaybeMentionUpdate` handling in `stores/chat.tsx`

## Chunk 3: Remove Emoji Preference Convenience State

- [ ] Re-evaluate `userReacjis` ownership
- [ ] Move emoji picker and reaction-row preference state into a dedicated chat-emoji hook or provider if it does not need chat-wide store lifetime
- [ ] Keep the owning RPCs near the emoji picker / reaction UI
- [ ] Do not duplicate the same top-reaction or skin-tone cache in multiple places

### Target callers for Chunk 3

- [ ] `chat/emoji-picker/container.tsx`
- [ ] `chat/conversation/messages/emoji-row.tsx`
- [ ] `chat/conversation/messages/message-popup/reactionitem.tsx`

### Store fallout after Chunk 3

- `userReacjis`
- `updateUserReacjis`

## Chunk 4: Re-evaluate Static Config and Block Buttons

- [ ] Re-evaluate whether `staticConfig` needs to live in the chat store
- [ ] Prefer a dedicated lazy loader / hook for builtin command metadata if only suggestor surfaces need it
- [ ] Re-evaluate `blockButtonsMap` as conversation-local or feature-local UI state
- [ ] Keep gregor-driven block-button behavior intact while moving rendered state closer to the conversation UI if possible

### Target callers for Chunk 4

- [ ] `chat/conversation/input-area/suggestors/commands.tsx`
- [ ] `chat/blocking/invitation-to-block.tsx`

### Store fallout after Chunk 4

- `staticConfig`
- `loadStaticConfig`
- `blockButtonsMap`
- `dismissBlockButtons`
- `updatedGregor`
- `keybase.1.gregorUI.pushState` handling in `stores/chat.tsx`, if no other chat-store state still depends on it

## Chunk 5: Re-evaluate Badge Counts and Remaining Engine Plumbing

- [ ] Re-evaluate whether `smallTeamBadgeCount`, `bigTeamBadgeCount`, and `badgeStateVersion` belong in `stores/chat.tsx`
- [ ] Prefer deriving visible inbox badge behavior from inbox rows / notifications state where practical
- [ ] Keep only the minimal bridge needed for chat-specific badge UI if deriving everything elsewhere is too invasive for this pass
- [ ] Re-evaluate remaining store-owned engine handling:
  - `chat.1.NotifyChat.ChatInboxStale`
  - `chat.1.NotifyChat.ChatIdentifyUpdate`
  - `keybase.1.NotifyBadges.badgeState`

### Likely dependencies to update

- [ ] `chat/inbox/row/big-teams-divider.tsx`
- [ ] `chat/inbox/row/teams-divider-container.tsx`
- [ ] `chat/conversation/header-area/index.native.tsx`
- [ ] any inbox-visible badge affordances that still read the chat store

### Store fallout after Chunk 5

- `smallTeamBadgeCount`
- `bigTeamBadgeCount`
- `badgeStateVersion`
- `badgesUpdated`
- any remaining `onEngineIncomingImpl` cases no longer needed after earlier chunks

## Chunk 6: Decide What, If Anything, Stays In Zustand

- [ ] Review what remains in `shared/stores/chat.tsx`
- [ ] Delete dead selectors, helpers, and tests
- [ ] If only a tiny lazy-config surface remains, move it into feature hooks and remove the store entirely
- [ ] If something must remain, document exactly why it needs app-wide lifetime

### Likely candidates to remove by the end

- `inboxHasLoaded`
- `inboxLayout`
- `inboxRetriedOnCurrentEmpty`
- `maybeMentionMap`
- `userReacjis`
- `blockButtonsMap`
- maybe `staticConfig`
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
- [ ] No new module-level mutable cache is introduced as a replacement for Zustand
