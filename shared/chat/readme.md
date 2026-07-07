How chat works:

## Data ownership

Chat data is split across several focused stores instead of one global redux tree. Roughly:

- **Inbox metadata** (`chat/inbox/metadata.tsx`, `useInboxMetadataState`) is the single owner of conversation `meta` (trustedState, snippet, participants pointer, draft, timestamp, etc.) and `participants`. All meta writes go through `metasReceived`, which version-gates each incoming meta against the currently stored one (`Meta.updateMeta`) so a stale/out-of-order update can't clobber newer data. Callers that already merged from the current meta (e.g. `updateInboxConversationMeta`, error metas, incremental inbox sync) pass `{force: true}` to bypass gating. Converters live in `constants/chat/meta.tsx` (`baseMetaFromUIItem` is the shared base used by the various `*ToConversationMeta` functions).
- **Per-conversation thread store** (`chat/conversation/thread-context.tsx`) is a vanilla zustand store created fresh per mounted `ConversationThreadProvider` and destroyed when the provider unmounts. It holds `messageMap`/`messageOrdinals`/`messageIDToOrdinal`/`messageTypeMap`/`pendingOutboxToOrdinal`, live `typing` (a `Set<string>`), exploding mode, and payment/request/flip/unfurl maps. It reads conversation meta from the inbox metadata store rather than owning its own copy (`useThreadMeta`, `getMeta`). The module is split: `thread-engine.tsx` holds engine-notification handlers (`applyMessagesUpdatedToThread`, `applyIncomingMutationToThread`, etc.) and `thread-load.tsx` holds thread-load logic (RPC calls, exploding-mode-from-gregor, pagination sizing).
- **Inbox rows are computed, not cached.** `chat/inbox/rows-state.tsx` exposes `useInboxRowSmall`/`useInboxRowBig`, which `useMemo` a display row from: inbox metadata (meta + participants), `chat/inbox/layout-state.tsx` (a memoized index built from the service's `UIInboxLayout`, used as a fallback for rows whose meta isn't trusted yet), `chat/inbox/badge-state.tsx` (badge/unread counts, fully replaced from each `BadgeState` RPC payload), and `chat/inbox/typing-state.tsx` (per-conversation typing username sets, merged in from `ChatTypingUpdate`). Merge precedence is one rule: meta wins whenever it's `trusted` or `error`; otherwise the layout row fills the gaps (snippet, draft, time, mute, name-split participants).
- **Message conversion** lives in `constants/chat/message.tsx` (`uiMessageToMessage` converts a single RPC `UIMessage` to the internal `Message` type; `parseUIMessagesJSON` does the same for a JSON-stringified array, used for bulk thread-load ingestion).
- **Orange line** (the "new messages" divider) is a small standalone store, `chat/conversation/orange-line-context.tsx` (`useExplicitOrangeLineState`), keyed by conversationIDKey -> `{ordinal, version}`.

## How data flows in

Engine notifications land in `shared/constants/init/shared.tsx`'s `_onEngineIncoming`, which calls `handleConvoEngineIncoming` (`chat/inbox/engine.tsx`) directly for chat-relevant action types. That function is the inbox-side router: it turns RPC notifications (`ChatConvUpdate`, `NewChatActivity`, `ChatTypingUpdate`, `ChatParticipantsInfo`, `ChatThreadsStale`, etc.) into calls against the metadata store (`metasReceived`, `metaReceivedError`, `updateInboxConversationMeta`), the typing store (`updateInboxTyping`), or an unbox request (`unboxRows`/`forceUnboxRowsForService`). Thread-specific engine events (message updates/mutations, reactions, attachments) are instead handled by `thread-engine.tsx`'s listeners, wired up per-conversation inside `thread-context.tsx` (`useThreadEngineListeners`) so they only run while that conversation's provider is mounted. Thread loads (initial, scrollback, centered, jump-to-recent) go through `loadMoreMessages` -> `loadConversationThreadMessages` in `thread-load.tsx`, which issues the RPC and calls back into the thread store's `applyThreadLoad`.

## Lifecycle

The thread store and its sibling `ShownUsernameCacheContext` are created in `ConversationThreadProviderInner` and torn down by unmounting; the screen mounts a fresh provider (via a React `key` on the conversationIDKey) when you switch conversations, so there's no manual "clear old thread" step — the old store and its listeners just go away. `ConversationThreadProvider` special-cases the case where the requested id matches the currently-provided one, reusing the existing store/actions instead of remounting (e.g. nested same-thread wrappers). On logout, `Z.resetAllStores()` (`util/zustand.tsx`) resets every store created via `Z.createZustand` — inbox metadata, badge, typing, layout, orange-line, etc. — back to its initial state; it's invoked from `stores/config.tsx` when `loggedIn` flips to false.

## Intentional dualities

A few pieces of state are deliberately duplicated rather than unified, because they represent different things:

- **Typing**: the thread store's `typing` is a live `Set<string>` of who's typing right now in the open conversation; the inbox's `typingSnippet` (computed in `rows-state.tsx`) is a display string ("X is typing...") for inbox rows, sourced from the separate `typing-state.tsx` map so an unopened conversation's row can still show it.
- **Draft**: the composer's unsent text (`unsentText` in `chat/conversation/input-area/input-state.tsx`) is local, per-conversation UI state scoped to the input's own React context/reducer, cleared by unmount. `meta.draft` (in the inbox metadata store) is the last draft synced to the service, used to render the draft snippet on inbox rows for conversations you aren't currently looking at. They're independent by design — the input doesn't read from or write to `meta.draft` on every keystroke.

## Inbox

Conversations are of 2 basic types. - Small: adhoc conversations or teams with only the #general channel - Big: teams with multiple channels

We get a list of untrusted conversations from the server. Untrusted (unboxed) means we don't have any snippets and can't verify the participants / channel name. If we've previously loaded them the daemon can give us a trusted payload with the untrusted payload.
We request untrusted conversations to be unboxed (converted to trusted). This is driven by the inbox scrolling rows into view, via a queue (`queueMetaToRequest`) that unboxes in small batches rather than all at once.
The primary ID of a conversation is a ConversationIDKey. Data structures are mostly maps driven off of this key, split by store as described above (meta/participants, thread messages, badges, layout, typing).

The inbox operates in 2 modes: 'normal' and 'filtered'.
Filtered is driven by a filter string. Each item calculates a score and is sorted by this score (exact match > prefix match > substring match). We show small items, then big items. No dividers or hierarchy of channel/team.
The normal mode is split into 2 sections.

1. The small rows sorted by timestamp
1. The big teams alpha sorted (first by team, then by channel)

If you have a mix of small/big teams we can show a divider between them and truncate the small list.

Row display data is derived at render time from inbox metadata plus the layout/badge/typing stores (see above), not read out of a single cached map.

Edge cases:

- Rekey: If you don't have the keys to unbox the conversation we tell you who can help you out (sometimes yourself)
- Reset users: If you have reset users in an implied team conversation (no actual team in the teams tab) we present the reset users for you to deal with.

## Thread

A conversation thread is a list of messages. The thread itself is just a list of ids and each row is individually connected.
Messages have several IDs associated with them and they're used in different circumstances.

MessageID: is the true id of a sent message. This is used as input to rpcs (like editing/deleting)
OutboxID: is used when sending a message (while in the grey state)
Ordinal: is used to order / lookup messages. Ordinals are currently fractional additions to the last visible message id.
If i sent a message after the already sent {MessageID: 123} the oridinal would be 123.001
The ordinal is only used to ensure this client is seeing messages in order from their perspective. If you reload the thread those ordinals can be resolved into their real sent ids (aka 123.001 -> 124)
We keep the original ordinal if we can so the ordering of the thread from our perspective is static, even if the 'real' order is different. This means if you reload 123.001 -> 124 but during the session it will remain 123.001

## Pending

When we build a search for users we want to preview the conversation. We have a special conversationIDKey for this Constants.pendingConversationIDKey. This always exists in the inbox metadata store. The users go into the participants property. Usually the convesationIDKey inside the meta is the same as the key in the metadata store but in this special instance the key of the preview conversation goes in there depending on the participants
