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

export type RowIdentity = {
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

// The one derivation. Both entry points below come through here, so the list and the row can only
// ever be told the same thing about a row.
export const getRowIdentity = (
  store: ConversationThreadStore,
  snapshot: ConversationThreadState,
  ordinal: T.Chat.Ordinal
): RowIdentity => {
  const you = useCurrentUserState.getState().username
  let cache = caches.get(store)
  // The sticky record describes one window; a clear or a conversation change replaces that window,
  // and a different signed-in user changes every answer in it.
  if (cache?.generation !== snapshot.generation || cache.you !== you) {
    cache = makeCache(snapshot.generation, you)
    caches.set(store, cache)
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

// For a row rendering itself.
export const useRowIdentity = (ordinal: T.Chat.Ordinal): RowIdentity => {
  const store = useConversationThreadStore()
  return useConversationThreadSelector(useShallow(s => getRowIdentity(store, s, ordinal)))
}

// For getItemType, which the list calls outside React and which only wants the pool.
export const useRowPoolKey = () => {
  const store = useConversationThreadStore()
  return React.useCallback(
    (ordinal: T.Chat.Ordinal) => getRowIdentity(store, store.getState(), ordinal).poolKey,
    [store]
  )
}
