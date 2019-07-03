// Rows for our normal inbox view. A set of small items on top ordered by time, a set of teams/channels ordered by alpha
// If you have teams and a bunch of small chats we truncate and put a divider in between
import * as Types from '../../../constants/types/chat2'
import * as I from 'immutable'
import shallowEqual from 'shallowequal'
import * as Constants from '../../../constants/chat2'
import {memoize} from '../../../util/memoize'
import {RowItem} from '../index.types'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

const smallTeamsCollapsedMaxShown = 5

// Could make this faster by bookkeeping if this structure changed instead of if any item changed
const splitMetas = memoize((metaMap: Types.MetaMap, selectedConversation) => {
  const bigMetas: Array<Types.ConversationMeta> = []
  const smallMetas: Array<Types.ConversationMeta> = []
  metaMap.forEach((meta: Types.ConversationMeta, id) => {
    if (Constants.isValidConversationIDKey(id)) {
      if (meta.teamType === 'big') {
        bigMetas.push(meta)
      } else {
        if (
          meta.status !== RPCChatTypes.ConversationStatus.ignored ||
          meta.conversationIDKey === selectedConversation
        ) {
          smallMetas.push(meta)
        }
      }
    }
  })
  return {bigMetas, smallMetas}
})

const sortByTimestamp = (a: Types.ConversationMeta, b: Types.ConversationMeta) => b.timestamp - a.timestamp
const getSmallRows = memoize(
  (smallMetas, showAllSmallRows) => {
    let metas
    if (showAllSmallRows) {
      metas = smallMetas.sort(sortByTimestamp)
    } else {
      metas = I.Seq(smallMetas)
        .sort(sortByTimestamp)
        .take(smallTeamsCollapsedMaxShown)
        .toArray()
    }
    return metas.map(m => ({conversationIDKey: m.conversationIDKey, type: 'small'}))
  },
  (
    [newMetas, newShowSmallRows, newSelectedConversation],
    [oldMetas, oldShowSmallRows, oldSelectedConversation]
  ) =>
    newSelectedConversation === oldSelectedConversation &&
    newShowSmallRows === oldShowSmallRows &&
    newMetas.length === oldMetas.length &&
    newMetas.every((a, idx) => {
      const b = oldMetas[idx]
      return a.conversationIDKey === b.conversationIDKey && a.inboxVersion === b.inboxVersion
    })
)

const sortByTeamChannel = (a, b) =>
  a.teamname === b.teamname
    ? a.channelname.localeCompare(b.channelname, undefined, {sensitivity: 'base'})
    : a.teamname.localeCompare(b.teamname) // team names are normalized to lowercase
const getBigRows = memoize(
  bigMetas => {
    let lastTeam: string | null
    return bigMetas.sort(sortByTeamChannel).reduce((arr, meta) => {
      // headers for new teams
      if (meta.teamname !== lastTeam) {
        lastTeam = meta.teamname
        arr.push({teamname: lastTeam, type: 'bigHeader'})
      }
      // channels
      arr.push({
        channelname: meta.channelname,
        conversationIDKey: meta.conversationIDKey,
        teamname: lastTeam,
        type: 'big',
      })

      return arr
    }, [])
  },
  ([newMetas], [oldMetas]) => shallowEqual(newMetas, oldMetas)
)

// Get smallIDs and big RowItems. Figure out the divider if it exists and truncate the small list.
// Convert the smallIDs to the Small RowItems
const getRowsAndMetadata = memoize(
  (metaMap: Types.MetaMap, smallTeamsExpanded: boolean, selectedConversation: Types.ConversationIDKey) => {
    const {bigMetas, smallMetas} = splitMetas(metaMap, selectedConversation)
    const showAllSmallRows = smallTeamsExpanded || !bigMetas.length
    const smallRows = getSmallRows(smallMetas, showAllSmallRows)
    const bigRows = getBigRows(bigMetas)
    const smallTeamsBelowTheFold = smallMetas.length > smallRows.length
    const divider = bigRows.length !== 0 ? [{showButton: smallTeamsBelowTheFold, type: 'divider'}] : []
    const allowShowFloatingButton = smallRows.length > smallTeamsCollapsedMaxShown && !!bigMetas.length
    const rows: Array<RowItem> = [...smallRows, ...divider, ...bigRows]

    return {
      allowShowFloatingButton,
      rows,
      smallTeamsExpanded: showAllSmallRows, // only collapse if we're actually showing a divider,
    }
  }
)

export default getRowsAndMetadata
