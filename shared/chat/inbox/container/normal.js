// @flow
// Rows for our normal inbox view. A set of small items on top ordered by time, a set of teams/channels ordered by alpha
// If you have teams and a bunch of small chats we truncate and put a divider in between
import * as Types from '../../../constants/types/chat2'
import * as I from 'immutable'
import shallowEqual from 'shallowequal'
import * as Constants from '../../../constants/chat2'
import memoize from 'memoize-one'

const smallTeamsCollapsedMaxShown = 5

// Could make this faster by bookkeeping if this structure changed instead of if any item changed
const splitMetas = memoize(metaMap => {
  const bigMetas = []
  const smallMetas = []
  metaMap.forEach((meta, id) => {
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

const sortByTimestsamp = (a, b) => b.timestamp - a.timestamp
const getSmallRows = memoize((smallMetas, showAllSmallRows) => {
  let metas
  if (showAllSmallRows) {
    metas = smallMetas.sort(sortByTimestsamp)
  } else {
    metas = I.Seq(smallMetas)
      .partialSort(smallTeamsCollapsedMaxShown, sortByTimestsamp)
      .toArray()
  }
  return metas.map(m => ({conversationIDKey: m.conversationIDKey, type: 'small'}))
}, shallowEqual)

const sortByTeamChannel = (a, b) =>
  a.teamname === b.teamname
    ? a.channelname.localeCompare(b.channelname)
    : a.teamname.localeCompare(b.teamname)
const getBigRows = memoize(bigMetas => {
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
const getRowsAndMetadata = memoize((metaMap: Types.MetaMap, smallTeamsExpanded: boolean) => {
  const {bigMetas, smallMetas} = splitMetas(metaMap)
  const showAllSmallRows = smallTeamsExpanded || !bigMetas.length
  const smallRows = getSmallRows(smallMetas, showAllSmallRows)
  const bigRows = getBigRows(bigMetas)
  const smallTeamsBelowTheFold = smallMetas.length > smallRows.length
  const divider = bigRows.length !== 0 ? [{showButton: smallTeamsBelowTheFold, type: 'divider'}] : []
  const allowShowFloatingButton = smallRows.length > smallTeamsCollapsedMaxShown && !!bigMetas.length
  // why is this getting called so much

  return {
    allowShowFloatingButton,
    rows: [...smallRows, ...divider, ...bigRows],
    smallTeamsExpanded: showAllSmallRows, // only collapse if we're actually showing a divider,
  }
})

export default getRowsAndMetadata
