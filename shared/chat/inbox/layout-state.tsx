import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import {isPhone} from '@/constants/platform'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {ignorePromise} from '@/constants/utils'
import {registerInboxRefresh} from './inbox-refresh'

type Store = T.Immutable<{
  hasLoaded: boolean
  layout?: T.RPCChat.UIInboxLayout
  retriedOnCurrentEmpty: boolean
}>

const initialStore: Store = {
  hasLoaded: false,
  layout: undefined,
  retriedOnCurrentEmpty: false,
}

type State = Store & {
  dispatch: {
    refresh: (reason: T.Chat.RefreshReason) => Promise<void>
    resetState: () => void
    setRetriedOnCurrentEmpty: (retried: boolean) => void
    updateLayout: (layout: string) => void
  }
}

const hasInboxRows = (layout: T.RPCChat.UIInboxLayout) =>
  (layout.smallTeams?.length ?? 0) > 0 ||
  (layout.bigTeams?.length ?? 0) > 0 ||
  layout.totalSmallTeams > 0

export const isEmptyInboxLayout = (layout: T.RPCChat.UIInboxLayout | undefined) =>
  !!layout && (layout.smallTeams || []).length === 0 && (layout.bigTeams || []).length === 0

// A fresh layout arrives on every incoming message, usually with most rows unchanged.
// Reuse the prior row objects that deep-equal their replacements so per-row selectors
// (getSmallLayoutRow / getBigLayoutChannelRow) keep identity and visible rows can bail.
const bigRowKey = (r: T.Immutable<T.RPCChat.UIInboxBigTeamRow>) =>
  r.state === T.RPCChat.UIInboxBigTeamRowTyp.channel ? `c:${r.channel.convID}` : `l:${r.label.id}`

const recycleLayoutRows = (
  old: T.Immutable<T.RPCChat.UIInboxLayout> | undefined,
  next: T.RPCChat.UIInboxLayout
): T.RPCChat.UIInboxLayout => {
  if (!old) {
    return next
  }
  const oldSmall = new Map(old.smallTeams?.map(r => [r.convID, r]) ?? [])
  const smallTeams = next.smallTeams?.map(r => {
    const o = oldSmall.get(r.convID)
    return o && isEqual(o, r) ? (o as T.RPCChat.UIInboxSmallTeamRow) : r
  })
  const oldBig = new Map(old.bigTeams?.map(r => [bigRowKey(r), r]) ?? [])
  const bigTeams = next.bigTeams?.map(r => {
    const o = oldBig.get(bigRowKey(r))
    return o && isEqual(o, r) ? (o as T.RPCChat.UIInboxBigTeamRow) : r
  })
  return {...next, bigTeams, smallTeams}
}

export const useInboxLayoutState = Z.createZustand<State>('chat-inbox-layout', (set, get) => {
  const requestInboxLayout = async (reason: T.Chat.RefreshReason) => {
    const {username} = useCurrentUserState.getState()
    const {loggedIn} = useConfigState.getState()
    if (!loggedIn || !username) {
      return
    }

    logger.info(`Inbox refresh due to ${reason}`)
    const reselectMode =
      get().hasLoaded || isPhone
        ? T.RPCChat.InboxLayoutReselectMode.default
        : T.RPCChat.InboxLayoutReselectMode.force
    await T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode})
  }

  const dispatch: State['dispatch'] = {
    refresh: async reason => requestInboxLayout(reason),
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
      }))
    },
    setRetriedOnCurrentEmpty: retried => {
      set(s => {
        s.retriedOnCurrentEmpty = retried
      })
    },
    updateLayout: str => {
      try {
        const _layout = JSON.parse(str) as unknown
        if (!_layout || typeof _layout !== 'object') {
          logger.warn(
            `Invalid inbox layout JSON: expected object, got ${_layout === null ? 'null' : typeof _layout}`
          )
          return
        }
        const layout = _layout as T.RPCChat.UIInboxLayout
        // Compare against committed state, not the draft: immer 11.1.9 sanitizes
        // constructor/prototype access on drafts (prototype-pollution fix),
        // making lodash isEqual throw a proxy-invariant TypeError.
        const prev = get().layout
        const changed = !isEqual(prev, layout)
        set(s => {
          if (changed) {
            s.layout = T.castDraft(recycleLayoutRows(prev, layout))
          }
          s.hasLoaded = !!layout
          if (hasInboxRows(layout)) {
            s.retriedOnCurrentEmpty = false
          }
        })
      } catch (e) {
        logger.warn('failed to JSON parse inbox layout', e)
      }
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

// Let constants/router trigger a refresh without importing this store (breaks
// the router -> layout-state -> config -> router require cycle).
registerInboxRefresh(reason => {
  ignorePromise(useInboxLayoutState.getState().dispatch.refresh(reason))
})

// Per-conversation index over the current layout so row hooks can do a cheap
// map lookup instead of scanning smallTeams/bigTeams. Built once per layout
// object and memoized on it (a new layout object replaces the prior on change),
// so selector bodies stay allocation-free after the first read.
export type SmallLayoutRow = T.Immutable<T.RPCChat.UIInboxSmallTeamRow>
export type BigLayoutChannelRow = T.Immutable<T.RPCChat.UIInboxBigTeamChannelRow>
type LayoutIndex = {
  bigChannels: Map<T.Chat.ConversationIDKey, BigLayoutChannelRow>
  small: Map<T.Chat.ConversationIDKey, SmallLayoutRow>
}
const layoutIndexCache = new WeakMap<object, LayoutIndex>()

const getLayoutIndex = (layout?: T.Immutable<T.RPCChat.UIInboxLayout>): LayoutIndex | undefined => {
  if (!layout) {
    return undefined
  }
  const existing = layoutIndexCache.get(layout)
  if (existing) {
    return existing
  }
  const small = new Map<T.Chat.ConversationIDKey, SmallLayoutRow>()
  layout.smallTeams?.forEach(row => {
    small.set(T.Chat.stringToConversationIDKey(row.convID), row)
  })
  const bigChannels = new Map<T.Chat.ConversationIDKey, BigLayoutChannelRow>()
  layout.bigTeams?.forEach(row => {
    if (row.state === T.RPCChat.UIInboxBigTeamRowTyp.channel) {
      bigChannels.set(T.Chat.stringToConversationIDKey(row.channel.convID), row.channel)
    }
  })
  const index: LayoutIndex = {bigChannels, small}
  layoutIndexCache.set(layout, index)
  return index
}

export const getSmallLayoutRow = (
  s: {layout?: T.Immutable<T.RPCChat.UIInboxLayout>},
  id: T.Chat.ConversationIDKey
) => getLayoutIndex(s.layout)?.small.get(id)

export const getBigLayoutChannelRow = (
  s: {layout?: T.Immutable<T.RPCChat.UIInboxLayout>},
  id: T.Chat.ConversationIDKey
) => getLayoutIndex(s.layout)?.bigChannels.get(id)

export const useInboxLayout = () =>
  useInboxLayoutState(
    Z.useShallow(s => ({
      hasLoaded: s.hasLoaded,
      layout: s.layout,
      refresh: s.dispatch.refresh,
    }))
  )

export const useInboxRetryState = () =>
  useInboxLayoutState(
    Z.useShallow(s => ({
      retriedOnCurrentEmpty: s.retriedOnCurrentEmpty,
      setRetriedOnCurrentEmpty: s.dispatch.setRetriedOnCurrentEmpty,
    }))
  )
