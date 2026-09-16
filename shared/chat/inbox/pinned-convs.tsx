import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import logger from '@/logger'
import {bodyToJSON} from '@/constants/rpc-utils'
import {useConfigState} from '@/stores/config'
import {useInboxLayoutState} from './layout-state'

export const pinnedConvsGregorKey = 'chatPinnedConvs'

type GregorItems = ReadonlyArray<{readonly item?: T.RPCGen.Gregor1.Item | null}> | null | undefined

export const getPinnedConvIDs = (items: GregorItems): ReadonlyArray<T.Chat.ConversationIDKey> => {
  const found = items?.find(i => i.item?.category === pinnedConvsGregorKey)
  const parsed = bodyToJSON(found?.item?.body)
  return Array.isArray(parsed)
    ? parsed.filter((id): id is T.Chat.ConversationIDKey => typeof id === 'string' && id.length > 0)
    : []
}

export const usePinnedConvIDs = () => {
  const gregorPushState = useConfigState(s => s.gregorPushState)
  return React.useMemo(() => getPinnedConvIDs(gregorPushState), [gregorPushState])
}

export const pruneToLayout = (
  list: ReadonlyArray<string>,
  smallTeams: ReadonlyArray<T.RPCChat.UIInboxSmallTeamRow> | null | undefined
) => {
  if (!smallTeams) return [...list]
  const pinned = new Set(smallTeams.filter(r => r.isPinned).map(r => r.convID as string))
  return list.filter(id => pinned.has(id))
}

export const pinToTop = (list: ReadonlyArray<string>, id: string) => [id, ...list.filter(i => i !== id)]

export const unpin = (list: ReadonlyArray<string>, id: string) => list.filter(i => i !== id)

export const setConversationPinned = (id: T.Chat.ConversationIDKey, pinned: boolean) => {
  const f = async () => {
    const current = getPinnedConvIDs(useConfigState.getState().gregorPushState)
    const smallTeams = useInboxLayoutState.getState().layout?.smallTeams
    const pruned = pruneToLayout(current, smallTeams)
    const next = pinned ? pinToTop(pruned, id) : unpin(pruned, id)
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
  C.ignorePromise(f())
}
