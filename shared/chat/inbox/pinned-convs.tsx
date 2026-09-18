import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'
import {bodyToJSON} from '@/constants/rpc-utils'
import {useInboxLayoutState} from './layout-state'

export const pinnedConvsGregorKey = 'chatPinnedConvs'
// The whole list is stored in one gregor item, so keep it bounded.
export const maxPinnedConvs = 25

type GregorItems = T.RPCGen.Gregor1.State['items']

export const getPinnedConvIDs = (items: GregorItems): ReadonlyArray<T.Chat.ConversationIDKey> => {
  const found = items?.find(i => i.item?.category === pinnedConvsGregorKey)
  const parsed = bodyToJSON(found?.item?.body)
  return Array.isArray(parsed)
    ? parsed.filter((id): id is T.Chat.ConversationIDKey => typeof id === 'string' && id.length > 0)
    : []
}

export const pruneToLayout = (
  list: ReadonlyArray<string>,
  smallTeams: ReadonlyArray<T.RPCChat.UIInboxSmallTeamRow> | null | undefined
) => {
  if (!smallTeams) return [...list]
  const present = new Set(smallTeams.map(r => r.convID as string))
  return list.filter(id => present.has(id))
}

export const pinToTop = (list: ReadonlyArray<string>, id: string) => [id, ...list.filter(i => i !== id)]

export const unpin = (list: ReadonlyArray<string>, id: string) => list.filter(i => i !== id)

// Returns undefined when pinning a new conversation would exceed maxPinnedConvs. The menu
// disables pinning at the limit, but it reads the layout, which can lag a quick write.
export const nextPinnedList = (list: ReadonlyArray<string>, id: string, pinned: boolean) => {
  if (!pinned) return unpin(list, id)
  if (!list.includes(id) && list.length >= maxPinnedConvs) return undefined
  return pinToTop(list, id)
}

// Chained onto so two quick pin/unpin clicks run one after another, each reading the list the
// previous write produced, instead of both racing off the same stale snapshot.
let pinChain: Promise<void> = Promise.resolve()

const doSetConversationPinned = async (id: T.Chat.ConversationIDKey, pinned: boolean) => {
  let items: GregorItems
  try {
    // Read from the service instead of the gregorPushState store: the service applies its
    // local outbox before answering, so a write from the previous link in this chain is
    // visible here right away, where the push-based store copy lags behind by the debounce.
    items = (await T.RPCGen.gregorGetStateRpcPromise()).items
  } catch (error) {
    logger.warn(`setConversationPinned: fetching pinned convs failed: ${String(error)}`)
    return
  }
  const current = getPinnedConvIDs(items)
  const smallTeams = useInboxLayoutState.getState().layout?.smallTeams
  const pruned = pruneToLayout(current, smallTeams)
  const next = nextPinnedList(pruned, id, pinned)
  if (!next) {
    logger.warn(`setConversationPinned: already at ${maxPinnedConvs} pinned convs`)
    return
  }
  try {
    await T.RPCGen.gregorUpdateCategoryRpcPromise({
      body: JSON.stringify(next),
      category: pinnedConvsGregorKey,
      dtime: {offset: 0, time: 0},
    })
  } catch (error) {
    logger.warn(`setConversationPinned: saving pinned convs failed: ${String(error)}`)
    return
  }
  try {
    // the gregor handler also rebuilds, but this one doesn't wait on the push round trip
    await T.RPCChat.localRequestInboxLayoutRpcPromise({
      reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
    })
  } catch (error) {
    logger.warn(`setConversationPinned: layout refresh failed: ${String(error)}`)
  }
}

export const setConversationPinned = (id: T.Chat.ConversationIDKey, pinned: boolean) => {
  pinChain = pinChain.then(async () => doSetConversationPinned(id, pinned))
  C.ignorePromise(pinChain)
}
