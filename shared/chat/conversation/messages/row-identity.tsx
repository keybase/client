import * as React from 'react'
import type * as T from '@/constants/types'
import {getMessageRowType, getMessageShowUsername} from './row-metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {useShallow} from '@/util/zustand'
import {
  type ConversationThreadState,
  type ConversationThreadStore,
  useConversationThreadSelector,
  useConversationThreadStore,
} from '../thread-context'

type RowIdentity = {
  // The recycling pool this row joins. A message that leads its author group renders an avatar +
  // username header (~40px taller) than a grouped follow-on of the same render type. Without
  // splitting the pool, recycleItems reuses one container across both heights, so a recycled view
  // paints at the wrong height for a frame before re-measure - visible as rows overlapping during
  // scroll. A row that reserves header space after a scroll-back load is as tall as a headered one,
  // so it belongs in the same pool as one that paints it.
  poolKey: string
  // A header was already painted here, so the row keeps the SPACE and loses the CONTENT rather than
  // shrinking ~40px mid-load and jumping the thread.
  reserveHeader: boolean
  showUsername: string
}

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []
const nullIdentity: RowIdentity = {poolKey: 'null', reserveHeader: false, showUsername: ''}

type RowIdentityCache = {
  // One answer per (snapshot, ordinal). Two callers ask about the same row - the list, deciding
  // which recycling pool to put it in, and the row itself, deciding whether to draw a header - and
  // they must not be able to disagree. Whichever asks first computes; the other reads what it got.
  bySnapshot: WeakMap<ConversationThreadState, Map<T.Chat.Ordinal, RowIdentity>>
  generation: number
  // Which rows have painted an author header, and the name they painted. Sticky on purpose: it
  // outlives snapshots, and that is what lets a row keep its header's height once a scroll-back load
  // hands it a same-author previous. Reset with the window it describes.
  shown: Map<T.Chat.Ordinal, string>
  you: string
}

// Per conversation, because the sticky record is: it lives and dies with the window it describes,
// and one conversation's headers say nothing about another's.
const caches = new WeakMap<ConversationThreadStore, RowIdentityCache>()

const makeCache = (generation: number, you: string): RowIdentityCache => ({
  bySnapshot: new WeakMap(),
  generation,
  shown: new Map(),
  you,
})

const computeRowIdentity = (
  cache: RowIdentityCache,
  snapshot: ConversationThreadState,
  ordinal: T.Chat.Ordinal
): RowIdentity => {
  if (!ordinal) {
    return nullIdentity
  }
  const {messageMap, messageOrdinals, messageTypeMap} = snapshot
  const message = messageMap.get(ordinal)
  if (!message) {
    // A row whose message the window no longer holds: it renders nothing, so it draws no header and
    // reserves no space, and the type map is all that is left to pool it by.
    return {poolKey: messageTypeMap.get(ordinal) ?? 'text', reserveHeader: false, showUsername: ''}
  }
  const base = getMessageRowType(message, messageTypeMap.get(ordinal))
  const {provisional, showUsername} = getMessageShowUsername({
    message,
    messageMap,
    messageOrdinals: messageOrdinals ?? noOrdinals,
    ordinal,
    you: cache.you,
  })
  if (showUsername) {
    // Only non-provisional decisions are recorded: a row that shows a header because its neighbour
    // has not unboxed yet is about to lose it, and reserving space for it would leave a permanent
    // blank gap where an avatar never belonged.
    if (!provisional) {
      cache.shown.set(ordinal, showUsername)
    }
    return {poolKey: `${base}:hdr`, reserveHeader: false, showUsername}
  }
  const reserveHeader = cache.shown.has(ordinal)
  return {poolKey: reserveHeader ? `${base}:hdr` : base, reserveHeader, showUsername: ''}
}

// What one row would show as its author header under a given signed-in user, or '' for none. Only
// used to ask which rows a change of that user can actually reach.
const showUsernameFor = (snapshot: ConversationThreadState, ordinal: T.Chat.Ordinal, you: string) => {
  const message = snapshot.messageMap.get(ordinal)
  if (!message) {
    return ''
  }
  return getMessageShowUsername({
    message,
    messageMap: snapshot.messageMap,
    messageOrdinals: snapshot.messageOrdinals ?? noOrdinals,
    ordinal,
    you,
  }).showUsername
}

// The one derivation. Both entry points below come through here, so the list and the row can only
// ever be told the same thing about a row.
export const getRowIdentity = (
  store: ConversationThreadStore,
  snapshot: ConversationThreadState,
  ordinal: T.Chat.Ordinal,
  you: string
): RowIdentity => {
  let cache = caches.get(store)
  // The sticky record describes one window: a clear or a conversation change replaces that window,
  // and every ordinal in the record was numbered against the old one.
  if (cache?.generation !== snapshot.generation) {
    cache = makeCache(snapshot.generation, you)
    caches.set(store, cache)
  } else if (cache.you !== you) {
    const was = cache.you
    cache.you = you
    // Every memoized answer was computed with the old name, so the memo goes.
    cache.bySnapshot = new WeakMap()
    // The sticky record does not. `you` reaches almost nothing - one row type suppresses its header
    // when the invitee is you - and dropping the whole record would collapse every reserved header
    // in the thread at once over a change that cannot reach any of them. Which rows it does reach is
    // asked of the derivation rather than spelled out here, so a second `you`-dependent answer
    // cannot quietly go stale in this loop. Unlike the load that this record exists to smooth over,
    // a different signed-in user is a real change in what the row is, so the ones it does reach give
    // up their reserved height rather than keeping a gap that nothing will ever fill again.
    for (const ordinal of [...cache.shown.keys()]) {
      if (showUsernameFor(snapshot, ordinal, was) !== showUsernameFor(snapshot, ordinal, you)) {
        cache.shown.delete(ordinal)
      }
    }
  }
  let byOrdinal = cache.bySnapshot.get(snapshot)
  if (!byOrdinal) {
    byOrdinal = new Map()
    cache.bySnapshot.set(snapshot, byOrdinal)
  }
  const memoized = byOrdinal.get(ordinal)
  if (memoized) {
    return memoized
  }
  const identity = computeRowIdentity(cache, snapshot, ordinal)
  byOrdinal.set(ordinal, identity)
  return identity
}

// `you` is passed in rather than read off the store inside the derivation, and every entry point
// below subscribes to it. Reading it imperatively would have left the row, the separator and the
// recycling pool free to disagree again the moment it changed: the wrapper re-renders through its
// own subscription while the separator's thread selector does not re-run and getItemType keeps the
// same callback, which is exactly the three-way disagreement this module exists to make impossible.

// For a row rendering itself.
export const useRowIdentity = (ordinal: T.Chat.Ordinal): RowIdentity => {
  const store = useConversationThreadStore()
  const you = useCurrentUserState(s => s.username)
  return useConversationThreadSelector(useShallow(s => getRowIdentity(store, s, ordinal, you)))
}

// For getItemType, which the list calls outside React and which only wants the pool. `you` is in the
// callback identity so the list re-reads its pools when it changes.
export const useRowPoolKey = () => {
  const store = useConversationThreadStore()
  const you = useCurrentUserState(s => s.username)
  return React.useCallback(
    (ordinal: T.Chat.Ordinal) => getRowIdentity(store, store.getState(), ordinal, you).poolKey,
    [store, you]
  )
}
