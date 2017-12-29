// @flow
import * as Constants from '../../constants/chat'
import * as More from '../../constants/types/more'
import * as Types from '../../constants/types/chat2'
import * as Inbox from '.'
import * as Chat2Gen from '../../actions/chat2-gen'
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
  type TypedState,
  type Dispatch,
} from '../../util/container'

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

const smallTeamsCollapsedMaxShown = 5
const getMessageMap = (state: TypedState) => state.chat2.messageMap
const getMessageOrdinals = (state: TypedState) => state.chat2.messageOrdinals
const getMetaMap = (state: TypedState) => state.chat2.metaMap
const getLastMessage = (messageOrdinals, messageMap, conversationIDKey) => {
  const ordinal = messageOrdinals.get(conversationIDKey, I.List()).last()
  return ordinal ? messageMap.getIn([conversationIDKey, ordinal]) : null
}

const getSmallIDs = createSelector(
  [getMetaMap, getMessageOrdinals, getMessageMap],
  (metaMap, messageOrdinals, messageMap) => {
    // Get small/adhoc teams
    const smallMap = metaMap.filter(meta => meta.teamType !== 'big')
    const recentMessages = smallMap.map((_, conversationIDKey) =>
      getLastMessage(messageOrdinals, messageMap, conversationIDKey)
    )
    // Sort timestamps of the last messages
    return recentMessages
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp)
      .keySeq()
      .toArray()
  }
)

// Alphabetical teams / channels
const getBigRowItems = createSelector(
  [getMetaMap, getMessageOrdinals, getMessageMap],
  (metaMap, messageOrdinals, messageMap) => {
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
  }
)

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

const score = (lcFilter: string, lcYou: string, names: Array<string>): number => {
  // special case, looking for yourself
  if (lcYou === lcFilter) {
    return names.length === 1 && names[0] === lcYou ? 1 : 0
  }

  const namesMinusYou = names.filter(n => n !== lcYou)
  return (
    namesMinusYou.reduce((total, p) => {
      if (p === lcFilter) {
        return total + 1 // exact match
      } else {
        const idx = p.indexOf(lcFilter)
        if (idx === 0) {
          return total + 0.8 // prefix match
        } else if (idx !== -1) {
          return total + 0.5 // sub match
        } else {
          return total
        }
      }
    }, 0) / namesMinusYou.length
  )
}

// Ignore headers, score based on matches of participants, ignore total non matches
const getFilteredRowsAndMetadata = createSelector(
  [
    getMetaMap,
    getMessageOrdinals,
    getMessageMap,
    state => state.chat2.inboxFilter,
    state => state.config.username || '',
  ],
  (metaMap, messageOrdinals, messageMap, filter, username) => {
    const lcFilter = filter.toLowerCase()
    const lcYou = username.toLowerCase()
    const smallRows = metaMap
      .filter(meta => meta.teamType !== 'big')
      .map(meta => {
        return {
          conversationIDKey: meta.conversationIDKey,
          score: score(
            lcFilter,
            lcYou,
            [...(meta.teamname || '').split(','), ...meta.participants.toArray()].filter(Boolean)
          ),
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({conversationIDKey}) => ({conversationIDKey, type: 'small'}))
      .valueSeq()
      .toArray()

    const bigRows = metaMap
      .filter(meta => meta.teamType === 'big')
      .map(meta => {
        return {
          channelname: meta.channelname,
          conversationIDKey: meta.conversationIDKey,
          score: score(lcFilter, '', [meta.teamname, meta.channelname].filter(Boolean)),
          teamname: meta.teamname,
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({conversationIDKey, channelname, teamname}) => ({
        channelname,
        conversationIDKey,
        teamname,
        type: 'big',
      }))
      .valueSeq()
      .toArray()

    return {
      rows: [...smallRows, ...bigRows],
      showBuildATeam: false,
      showSmallTeamsExpandDivider: false,
      smallIDsHidden: [],
      smallTeamsExpanded: true,
    }
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, routeState}: OwnProps) => {
  const filter = state.chat2.inboxFilter
  const smallTeamsExpanded = routeState.get('smallTeamsExpanded')
  const rowMetadata = filter
    ? getFilteredRowsAndMetadata(state)
    : getRowsAndMetadata(state, smallTeamsExpanded)
  const inboxGlobalUntrustedState = state.chat.get('inboxGlobalUntrustedState')
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)

  return {
    ...rowMetadata,
    _selectedConversationIDKey,
    filter,
    isActiveRoute,
    isLoading: inboxGlobalUntrustedState === 'loading' || state.chat.get('inboxSyncingState') === 'syncing',
    neverLoaded: inboxGlobalUntrustedState === 'unloaded',
    showNewConversation:
      state.chat.get('inSearch') ||
      (_selectedConversationIDKey && Constants.isPendingConversationIDKey(_selectedConversationIDKey)),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter, routeState, setRouteState}: OwnProps) => ({
  _onSelectNext: (
    rows: Array<Inbox.RowItem>,
    selectedConversationIDKey: ?Types.ConversationIDKey,
    direction: -1 | 1
  ) => {
    const goodRows: Array<Inbox.RowItemSmall | Inbox.RowItemBig> = rows.reduce((arr, row) => {
      if (row.type === 'small' || row.type === 'big') {
        arr.push(row)
      }
      return arr
    }, [])
    const idx = goodRows.findIndex(row => row.conversationIDKey === selectedConversationIDKey)
    if (goodRows.length) {
      const {conversationIDKey} = goodRows[(idx + direction + goodRows.length) % goodRows.length]
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true}))
    }
  },
  getTeams: () => dispatch(TeamsGen.createGetTeams()),
  onHotkey: (cmd: string) => {
    if (cmd.endsWith('+n')) {
      dispatch(ChatGen.createNewChat())
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(ChatGen.createNewChat()),
  onSelect: (conversationIDKey: ?Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true})),
  onSetFilter: (filter: string) => dispatch(Chat2Gen.createSetInboxFilter({filter})),
  onUntrustedInboxVisible: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
    dispatch(
      Chat2Gen.createMetaNeedsUpdating({
        conversationIDKeys,
        reason: 'untrusted inbox visible',
      })
    ),
  refreshInbox: (force: boolean) => dispatch(Chat2Gen.createInboxRefresh()),
  toggleSmallTeamsExpanded: () =>
    setRouteState({
      smallTeamsExpanded: !routeState.get('smallTeamsExpanded'),
    }),
})

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (
  stateProps: More.ReturnType<typeof mapStateToProps>,
  dispatchProps: More.ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => ({
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  getTeams: dispatchProps.getTeams,
  inSearch: stateProps.inSearch,
  isActiveRoute: stateProps.isActiveRoute,
  isLoading: stateProps.isLoading,
  neverLoaded: stateProps.neverLoaded,
  onHotkey: dispatchProps.onHotkey,
  onNewChat: dispatchProps.onNewChat,
  onSelect: dispatchProps.onSelect,
  onSelectDown: () => dispatchProps._onSelectNext(stateProps.rows, stateProps._selectedConversationIDKey, 1),
  onSelectUp: () => dispatchProps._onSelectNext(stateProps.rows, stateProps._selectedConversationIDKey, -1),
  onSetFilter: dispatchProps.onSetFilter,
  onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
  refreshInbox: dispatchProps.refreshInbox,
  rows: stateProps.rows,
  showBuildATeam: stateProps.showBuildATeam,
  showNewConversation: stateProps.showNewConversation,
  showSmallTeamsExpandDivider: stateProps.showSmallTeamsExpandDivider,
  smallIDsHidden: stateProps.smallIDsHidden,
  smallTeamsExpanded: stateProps.smallTeamsExpanded,
  toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
})

export default compose(
  withState('filterFocusCount', 'setFilterFocusCount', 0),
  withHandlers({
    focusFilter: props => () => props.setFilterFocusCount(props.filterFocusCount + 1),
  }),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      if (this.props.neverLoaded) {
        this.props.refreshInbox()
        // Get team counts for team headers in the inbox
        this.props.getTeams()
      }
    },
  })
)(Inbox.default)

export const _testing = {
  score,
}
