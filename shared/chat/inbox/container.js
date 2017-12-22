// @flow
import * as Constants from '../../constants/chat'
import * as More from '../../constants/types/more'
import * as Types from '../../constants/types/chat'
import * as Inbox from '.'
import * as ChatGen from '../../actions/chat-gen'
import * as TeamsGen from '../../actions/teams-gen'
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
  type Dispatch,
} from '../../util/container'
import {scoreFilter, passesStringFilter} from './filtering'

const smallTeamsCollapsedMaxShown = 5
const getAlwaysShow = (state: TypedState) => state.chat.get('inboxAlwaysShow')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter').toLowerCase()
const getInbox = (state: TypedState) => state.chat.get('inbox')
const getInboxBigChannels = (state: TypedState) => state.chat.get('inboxBigChannels')
const getInboxBigChannelsToTeam = (state: TypedState) => state.chat.get('inboxBigChannelsToTeam')
const getIsEmpty = (state: TypedState) => state.chat.get('inboxIsEmpty')
const getSmallTimestamps = (state: TypedState) => state.chat.getIn(['inboxSmallTimestamps'], I.Map())
const getSupersededBy = (state: TypedState) => state.chat.get('inboxSupersededBy')
const _rowsForSelect = (rows: Array<Inbox.RowItem>): Array<Inbox.RowItemSmall | Inbox.RowItemBig> =>
  // $FlowIssue doesn't underestand filter refinement sadly
  rows.filter(r => r.type === 'small' || r.type === 'big')
const _smallTeamsPassThrough = (_, smallTeamsExpanded) => smallTeamsExpanded

// This chain of reselects is to optimize not having to redo any work
// If the timestamps are the same, we didn't change the list
// If the timestamps did change, and after sorting its still the same, we didn't change the list
// Else, truncate it if we are showing the 'show more' button and then convert to RowItem

// IDs by timestamp
const getSortedSmallRowsIDs = createSelector([getSmallTimestamps], (smallTimestamps): I.Seq.Indexed<
  Types.ConversationIDKey
> => {
  return smallTimestamps.sort((a, b) => b - a).keySeq()
})

// IDs filtering out empty conversations (unless we always show them) or superseded ones
const getVisibleSmallIDs = createImmutableEqualSelector(
  [getSortedSmallRowsIDs, getAlwaysShow, getSupersededBy, getIsEmpty],
  (sortedSmallRows, alwaysShow, supersededBy, isEmpty): Array<Types.ConversationIDKey> => {
    return sortedSmallRows.toArray().filter(conversationIDKey => {
      return (
        !supersededBy.get(conversationIDKey) &&
        (!isEmpty.get(conversationIDKey) || alwaysShow.get(conversationIDKey))
      )
    })
  }
)

// Build a map of [team: {channel: id}]
const getTeamToChannel = createSelector(
  [getInboxBigChannels, getInboxBigChannelsToTeam],
  (
    inboxBigChannels,
    inboxBigChannelsToTeam
  ): {[teamname: string]: {[channelname: string]: Types.ConversationIDKey}} => {
    const teamToChannels: {[teamname: string]: {[channelname: string]: Types.ConversationIDKey}} = {}
    inboxBigChannelsToTeam.forEach((teamname, id) => {
      if (!teamToChannels[teamname]) {
        teamToChannels[teamname] = {}
      }
      const channelname = inboxBigChannels.get(id)
      if (channelname) {
        teamToChannels[teamname][channelname] = id
      }
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

type OwnProps = {
  isActiveRoute: boolean,
  filterFocusCount: number,
  routeState: I.RecordOf<{
    smallTeamsExpanded: boolean,
  }>,
  focusFilter: () => void,
  setRouteState: ({
    smallTeamsExpanded?: boolean,
  }) => void,
}

const mapStateToProps = (state: TypedState, {isActiveRoute, routeState}: OwnProps) => {
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

  const inboxGlobalUntrustedState = state.chat.get('inboxGlobalUntrustedState')
  const selectedConversationIDKey = Constants.getSelectedConversation(state)

  return {
    ...rowMetadata,
    filter,
    isActiveRoute,
    isLoading: inboxGlobalUntrustedState === 'loading' || state.chat.get('inboxSyncingState') === 'syncing',
    neverLoaded: inboxGlobalUntrustedState === 'unloaded',
    _user: Constants.getYou(state),
    showNewConversation: state.chat.get('inSearch') ||
      (selectedConversationIDKey &&
        // $FlowIssue this is a string
        Constants.isPendingConversationIDKey(selectedConversationIDKey)),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter, routeState, setRouteState}: OwnProps) => ({
  getTeams: () => dispatch(TeamsGen.createGetTeams()),
  loadInbox: () => dispatch(ChatGen.createLoadInbox()),
  _onSelectNext: (rows: Array<Inbox.RowItemSmall | Inbox.RowItemBig>, direction: -1 | 1) =>
    dispatch(
      ChatGen.createSelectNext({rows: rows.map(r => ({conversationIDKey: r.conversationIDKey})), direction})
    ),
  onHotkey: (cmd: string) => {
    if (cmd.endsWith('+n')) {
      dispatch(ChatGen.createNewChat())
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(ChatGen.createNewChat()),
  onSelect: (conversationIDKey: ?Types.ConversationIDKey) => {
    dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
  onSetFilter: (filter: string) => dispatch(ChatGen.createSetInboxFilter({filter})),
  onUntrustedInboxVisible: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
    dispatch(ChatGen.createUnboxConversations({conversationIDKeys, reason: 'untrusted inbox visible'})),
  toggleSmallTeamsExpanded: () => setRouteState({smallTeamsExpanded: !routeState.get('smallTeamsExpanded')}),
})

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (
  stateProps: More.ReturnType<typeof mapStateToProps>,
  dispatchProps: More.ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
  return {
    filter: stateProps.filter,
    getTeams: dispatchProps.getTeams,
    isActiveRoute: stateProps.isActiveRoute,
    isLoading: stateProps.isLoading,
    loadInbox: dispatchProps.loadInbox,
    neverLoaded: stateProps.neverLoaded,
    _user: stateProps._user,
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
    showNewConversation: stateProps.showNewConversation,
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
      if (this.props.neverLoaded) {
        this.props.loadInbox()
        // Get team counts for team headers in the inbox
        this.props.getTeams()
      }
    },
  })
)(Inbox.default)
