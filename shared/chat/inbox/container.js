// @flow
import * as Constants from '../../constants/chat'
import * as Creators from '../../actions/chat/creators'
import * as I from 'immutable'
import * as Inbox from '.'
import createImmutableEqualSelector from '../../util/create-immutable-equal-selector'
import pausableConnect from '../../util/pausable-connect'
import throttle from 'lodash/throttle'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import {createSelector} from 'reselect'
import {scoreFilter, passesStringFilter} from './filtering'
import {type TypedState} from '../../constants/reducer'

const smallTeamsCollapsedMaxShown = 5
const getAlwaysShow = (state: TypedState) => state.entities.get('inboxAlwaysShow')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter').toLowerCase()
const getInbox = (state: TypedState) => state.entities.get('inbox')
const getInboxBigChannels = (state: TypedState) => state.entities.get('inboxBigChannels')
const getInboxBigChannelsToTeam = (state: TypedState) => state.entities.get('inboxBigChannelsToTeam')
const getIsEmpty = (state: TypedState) => state.entities.get('inboxIsEmpty')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getSmallTimestamps = (state: TypedState) => state.entities.getIn(['inboxSmallTimestamps'], I.Map())
const getSupersededBy = (state: TypedState) => state.entities.get('inboxSupersededBy')
const _rowsForSelect = (rows: Array<any>) => rows.filter(r => ['small', 'big'].includes(r.type))
const _smallTeamsPassThrough = (_, smallTeamsExpanded) => smallTeamsExpanded
const _throttleHelper = throttle(cb => cb(), 60 * 1000)

// This chain of reselects is to optimize not having to redo any work
// If the timestamps are the same, we didn't change the list
// If the timestamps did change, and after sorting its still the same, we didn't change the list
// Else, truncate it if we are showing the 'show more' button and then convert to RowItem

// IDs by timestamp
const getSortedSmallRowsIDs = createSelector([getSmallTimestamps], (smallTimestamps): I.Seq.Indexed<
  Constants.ConversationIDKey
> => {
  return smallTimestamps.sort((a, b) => b - a).keySeq()
})

// IDs filtering out empty conversations (unless we always show them) or superseded ones
const getVisibleSmallIDs = createImmutableEqualSelector(
  [getSortedSmallRowsIDs, getPending, getAlwaysShow, getSupersededBy, getIsEmpty],
  (sortedSmallRows, pending, alwaysShow, supersededBy, isEmpty): Array<Constants.ConversationIDKey> => {
    const pendingRows = pending.keySeq().toArray()
    const smallRows = sortedSmallRows.toArray().filter(conversationIDKey => {
      return (
        !supersededBy.get(conversationIDKey) &&
        (!isEmpty.get(conversationIDKey) || alwaysShow.get(conversationIDKey))
      )
    })
    return pendingRows.concat(smallRows)
  }
)

// Build a map of [team: {channel: id}]
const getTeamToChannel = createSelector(
  [getInboxBigChannels, getInboxBigChannelsToTeam],
  (
    inboxBigChannels,
    inboxBigChannelsToTeam
  ): {[teamname: string]: {[channelname: string]: Constants.ConversationIDKey}} => {
    const teamToChannels = {}
    inboxBigChannelsToTeam.forEach((teamname, id) => {
      if (!teamToChannels[teamname]) {
        teamToChannels[teamname] = {}
      }
      teamToChannels[teamname][inboxBigChannels.get(id)] = id
    })
    return teamToChannels
  }
)

// Build a list of team header + channels
const getBigRowItems = createSelector([getTeamToChannel], (teamToChannels): Array<
  Inbox.RowItemBigHeader | Inbox.RowItemBig
> => {
  const rows = []
  Object.keys(teamToChannels).sort().forEach(teamname => {
    rows.push({
      teamname,
      type: 'bigHeader',
    })

    const channels = teamToChannels[teamname]
    Object.keys(channels).sort().forEach(channelname => {
      rows.push({
        channelname,
        conversationIDKey: channels[channelname],
        teamname,
        type: 'big',
      })
    })
  })

  return rows
})

// Get smallIDs and big RowItems. Figure out the divider if it exists and truncate the small list.
// Convert the smallIDs to the Small RowItems
const getRowsAndMetadata = createSelector(
  [getVisibleSmallIDs, _smallTeamsPassThrough, getBigRowItems],
  (smallIDs, smallTeamsExpanded, bigRows) => {
    const smallTeamsRowsToHideCount = Math.max(0, smallIDs.length - smallTeamsCollapsedMaxShown)
    const showSmallTeamsExpandDivider = !!(bigRows.length && smallTeamsRowsToHideCount)
    const truncate = showSmallTeamsExpandDivider && !smallTeamsExpanded
    const smallIDsToShow = truncate ? smallIDs.slice(0, smallTeamsCollapsedMaxShown) : smallIDs
    const smallToShow = smallIDsToShow.map(conversationIDKey => ({conversationIDKey, type: 'small'}))
    const smallIDsHidden = truncate ? smallIDs.slice(smallTeamsCollapsedMaxShown) : []

    const divider = showSmallTeamsExpandDivider ? [{type: 'divider'}] : []
    const rows = smallToShow.concat(divider, bigRows)

    return {
      rows,
      showBuildATeam: bigRows.length === 0,
      showSmallTeamsExpandDivider,
      smallIDsHidden,
      smallTeamsExpanded: smallTeamsExpanded && showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider,
    }
  }
)

// Filtered view logic
// Filtered: Small RowItems if the participants match the filter
const getFilteredSmallRowItems = createSelector(
  [getSmallTimestamps, getFilter, getInbox, Constants.getYou],
  (smallTimestamps, lcFilter, inbox, you): Array<Inbox.RowItemSmall> => {
    const lcYou = you.toLowerCase()
    return smallTimestamps
      .keySeq()
      .toArray()
      .map(conversationIDKey => {
        const i = inbox.get(conversationIDKey)
        return {
          conversationIDKey,
          filterScore: i
            ? scoreFilter(lcFilter, i.teamname || '', i.get('participants').toArray(), lcYou)
            : 0,
        }
      })
      .filter(obj => obj.filterScore > 0)
      .sort((a, b) => b.filterScore - a.filterScore)
      .map(({conversationIDKey}) => ({conversationIDKey, type: 'small'}))
  }
)

// Filtered: Big RowItems if the channel name matches, or all the channels if the teamname matches
const getFilteredBigRows = createSelector([getTeamToChannel, getFilter], (teamToChannels, lcFilter): Array<
  Inbox.RowItemBig
> => {
  const rows = []
  Object.keys(teamToChannels).sort().forEach(teamname => {
    const teamPassed = passesStringFilter(lcFilter, teamname.toLowerCase())
    const channels = teamToChannels[teamname]
    Object.keys(channels).sort().forEach(channelname => {
      const channelPassed = teamPassed || passesStringFilter(lcFilter, channelname.toLowerCase())
      if (channelPassed) {
        rows.push({
          channelname,
          conversationIDKey: channels[channelname],
          teamname,
          type: 'big',
        })
      }
    })
  })

  return rows
})

// Merge small and big filtered RowItems
const getFilteredRows = createSelector(
  [getFilteredSmallRowItems, getFilteredBigRows],
  (smallRows, bigRows): Array<Inbox.RowItem> => {
    return smallRows.concat(bigRows)
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, routeState}) => {
  const filter = getFilter(state)
  const smallTeamsExpanded = routeState.get('smallTeamsExpanded')

  let rowMetadata
  if (filter) {
    rowMetadata = {
      rows: getFilteredRows(state),
      showBuildATeam: false,
      showSmallTeamsExpandDivider: false,
      smallIDsHidden: null,
      smallTeamsExpanded: true,
    }
  } else {
    rowMetadata = getRowsAndMetadata(state, smallTeamsExpanded)
  }

  return {
    ...rowMetadata,
    filter,
    isActiveRoute,
    isLoading: state.chat.get('inboxUntrustedState') === 'loading',
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter, routeState, setRouteState}) => ({
  _onSelectNext: (rows, direction) => dispatch(Creators.selectNext(rows, direction)),
  loadInbox: () => dispatch(Creators.loadInbox()),
  onHotkey: cmd => {
    if (cmd.endsWith('+n')) {
      dispatch(Creators.newChat())
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(Creators.newChat()),
  onSelect: (conversationIDKey: ?Constants.ConversationIDKey) => {
    dispatch(Creators.selectConversation(conversationIDKey, true))
  },
  onSetFilter: (filter: string) => dispatch(Creators.setInboxFilter(filter)),
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(Creators.untrustedInboxVisible(converationIDKey, rowsVisible)),
  toggleSmallTeamsExpanded: () => setRouteState({smallTeamsExpanded: !routeState.get('smallTeamsExpanded')}),
})

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    filter: stateProps.filter,
    isActiveRoute: stateProps.isActiveRoute,
    isLoading: stateProps.isLoading,
    loadInbox: dispatchProps.loadInbox,
    onHotkey: dispatchProps.onHotkey,
    onNewChat: dispatchProps.onNewChat,
    onSelect: dispatchProps.onSelect,
    onSelectDown: () => dispatchProps._onSelectNext(_rowsForSelect(stateProps.rows), 1),
    onSelectUp: () => dispatchProps._onSelectNext(_rowsForSelect(stateProps.rows), -1),
    onSetFilter: dispatchProps.onSetFilter,
    onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
    rows: stateProps.rows,
    showBuildATeam: stateProps.showBuildATeam,
    showSmallTeamsExpandDivider: stateProps.showSmallTeamsExpandDivider,
    smallIDsHidden: stateProps.smallIDsHidden,
    smallTeamsExpanded: stateProps.smallTeamsExpanded,
    toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
  }
}

export default compose(
  withState('filterFocusCount', 'setFilterFocusCount', 0),
  withHandlers({
    focusFilter: props => () => props.setFilterFocusCount(props.filterFocusCount + 1),
  }),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      _throttleHelper(() => {
        this.props.loadInbox()
      })
    },
  })
)(Inbox.default)
