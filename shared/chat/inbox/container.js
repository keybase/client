// @flow
import * as Constants from '../../constants/chat'
import * as Inbox from '.'
import * as ChatGen from '../../actions/chat-gen'
import * as I from 'immutable'
import {
  pausableConnect,
  compose,
  lifecycle,
  withState,
  withHandlers,
  createSelector,
  createImmutableEqualSelector,
  type TypedState,
} from '../../util/container'
import {scoreFilter, passesStringFilter} from './filtering'

const smallTeamsCollapsedMaxShown = 5
const getAlwaysShow = (state: TypedState) => state.chat.get('inboxAlwaysShow')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter').toLowerCase()
const getInbox = (state: TypedState) => state.chat.get('inbox')
const getInboxBigChannels = (state: TypedState) => state.chat.get('inboxBigChannels')
const getInboxBigChannelsToTeam = (state: TypedState) => state.chat.get('inboxBigChannelsToTeam')
const getIsEmpty = (state: TypedState) => state.chat.get('inboxIsEmpty')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getSmallTimestamps = (state: TypedState) => state.chat.getIn(['inboxSmallTimestamps'], I.Map())
const getSupersededBy = (state: TypedState) => state.chat.get('inboxSupersededBy')
const _rowsForSelect = (rows: Array<any>) => rows.filter(r => ['small', 'big'].includes(r.type))
const _smallTeamsPassThrough = (_, smallTeamsExpanded) => smallTeamsExpanded

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
            ? scoreFilter(lcFilter, i.teamname || '', i.get('participants').toArray(), lcYou, i.get('time'))
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
    isLoading: state.chat.get('inboxGlobalUntrustedState') === 'loading',
    user: Constants.getYou(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter, routeState, setRouteState}) => ({
  loadInbox: () => dispatch(ChatGen.createLoadInbox()),
  _onSelectNext: (rows, direction) => dispatch(ChatGen.createSelectNext({rows, direction})),
  onHotkey: cmd => {
    if (cmd.endsWith('+n')) {
      dispatch(ChatGen.createNewChat())
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(ChatGen.createNewChat()),
  onSelect: (conversationIDKey: ?Constants.ConversationIDKey) => {
    dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
  onSetFilter: (filter: string) => dispatch(ChatGen.createSetInboxFilter({filter})),
  onUntrustedInboxVisible: conversationIDKeys =>
    dispatch(ChatGen.createUnboxConversations({conversationIDKeys, reason: 'untrusted inbox visible'})),
  toggleSmallTeamsExpanded: () => setRouteState({smallTeamsExpanded: !routeState.get('smallTeamsExpanded')}),
})

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    filter: stateProps.filter,
    isActiveRoute: stateProps.isActiveRoute,
    isLoading: stateProps.isLoading,
    loadInbox: dispatchProps.loadInbox,
    user: stateProps.user,
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
    filterFocusCount: ownProps.filterFocusCount,
  }
}

// We want to load inbox once per user so log out works
let _lastUser: ?string

export default compose(
  withState('filterFocusCount', 'setFilterFocusCount', 0),
  withHandlers({
    focusFilter: props => () => props.setFilterFocusCount(props.filterFocusCount + 1),
  }),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      if (_lastUser !== this.props.user) {
        _lastUser = this.props.user
        this.props.loadInbox()
      }
    },
  })
)(Inbox.default)
