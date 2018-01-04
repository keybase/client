// @flow
// Rows for our normal inbox view. A set of small items on top ordered by time, a set of teams/channels ordered by alpha
// If you have teams and a bunch of small chats we truncate and put a divider in between
import {createSelector, type TypedState} from '../../../util/container'

const getMetaMap = (state: TypedState) => state.chat2.metaMap
const smallTeamsCollapsedMaxShown = 5

const getSmallIDs = createSelector([getMetaMap], metaMap => {
  // Get small/adhoc teams
  const smallMap = metaMap.filter(meta => meta.teamType !== 'big')
  // Sort by timestamp
  return smallMap
    .sort((a, b) => b.timestamp - a.timestamp)
    .keySeq()
    .toArray()
})

// Alphabetical teams / channels
const getBigRowItems = createSelector([getMetaMap], metaMap => {
  let lastTeam: ?string
  return (
    metaMap
      // only big teams
      .filter(meta => meta.teamType === 'big')
      // alpha by team/channel
      .sort(
        (a, b) =>
          a.teamname === b.teamname
            ? a.channelname.localeCompare(b.channelname)
            : a.teamname.localeCompare(b.teamname)
      )
      .reduce((arr, meta) => {
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
  )
})

// Get smallIDs and big RowItems. Figure out the divider if it exists and truncate the small list.
// Convert the smallIDs to the Small RowItems
const getRowsAndMetadata = createSelector(
  [getSmallIDs, getBigRowItems, (_, smallTeamsExpanded) => smallTeamsExpanded],
  (smallIDs, bigRows, smallTeamsExpanded) => {
    const smallTeamsBelowTheFold = Math.max(0, smallIDs.length - smallTeamsCollapsedMaxShown)
    const showSmallTeamsExpandDivider = !!(bigRows.length && smallTeamsBelowTheFold)
    const truncateSmallTeams = showSmallTeamsExpandDivider && !smallTeamsExpanded
    const smallRows = (truncateSmallTeams ? smallIDs.slice(0, smallTeamsCollapsedMaxShown) : smallIDs).map(
      conversationIDKey => ({conversationIDKey, type: 'small'})
    )
    const smallIDsHidden = truncateSmallTeams ? smallIDs.slice(smallTeamsCollapsedMaxShown) : []
    const divider = showSmallTeamsExpandDivider ? [{type: 'divider'}] : []

    return {
      rows: [...smallRows, ...divider, ...bigRows],
      showBuildATeam: bigRows.length === 0,
      showSmallTeamsExpandDivider,
      smallIDsHidden,
      smallTeamsExpanded: smallTeamsExpanded && showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider,
    }
  }
)
export default getRowsAndMetadata
