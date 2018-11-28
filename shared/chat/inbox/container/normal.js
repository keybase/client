// @flow
// Rows for our normal inbox view. A set of small items on top ordered by time, a set of teams/channels ordered by alpha
// If you have teams and a bunch of small chats we truncate and put a divider in between
import * as Types from '../../../constants/types/chat2'
import * as I from 'immutable'
import shallowEqual from 'shallowequal'
import * as Constants from '../../../constants/chat2'
import {memoize1, memoize2} from '../../../util/memoize'
import type {RowItem} from '../index.types'

const smallTeamsCollapsedMaxShown = 5

// Could make this faster by bookkeeping if this structure changed instead of if any item changed
const splitMetas = memoize1((metaMap: Types.MetaMap) => {
  const bigMetas: Array<Types.ConversationMeta> = []
  const smallMetas: Array<Types.ConversationMeta> = []
  metaMap.forEach((meta: Types.ConversationMeta, id) => {
    if (Constants.isValidConversationIDKey(id)) {
      if (meta.teamType === 'big') {
        bigMetas.push(meta)
      } else {
        smallMetas.push(meta)
      }
    }
  })
  return {bigMetas, smallMetas}
})

const smallMetasEqual = (la, lb) => {
  if (typeof la === 'boolean') return la === lb
  return (
    la.length === lb.length &&
    la.every((a, idx) => {
      const b = lb[idx]
      return a.conversationIDKey === b.conversationIDKey && a.inboxVersion === b.inboxVersion
    })
  )
}
const sortByTimestamp = (a: Types.ConversationMeta, b: Types.ConversationMeta) => b.timestamp - a.timestamp
const getSmallRows = memoize2((smallMetas, showAllSmallRows) => {
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
}, smallMetasEqual)

const sortByTeamChannel = (a, b) =>
  a.teamname === b.teamname
    ? a.channelname.localeCompare(b.channelname)
    : a.teamname.localeCompare(b.teamname)
const getBigRows = memoize1(bigMetas => {
  let lastTeam: ?string
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
}, shallowEqual)

// Get smallIDs and big RowItems. Figure out the divider if it exists and truncate the small list.
// Convert the smallIDs to the Small RowItems
const getRowsAndMetadata = memoize2((metaMap: Types.MetaMap, smallTeamsExpanded: boolean) => {
  const {bigMetas, smallMetas} = splitMetas(metaMap)
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
})

export default getRowsAndMetadata
