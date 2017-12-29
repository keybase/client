// @flow
import * as More from '../../../constants/types/more'
import * as Types from '../../../constants/types/chat2'
import * as Inbox from '..'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as I from 'immutable'
import {pausableConnect, compose, lifecycle, withState, withHandlers} from '../../../util/container'
import type {TypedState, Dispatch} from '../../../util/container'
import type {Props} from '..'
import normalRowData from './normal'
import filteredRowData from './filtered'

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
  const filter = state.chat2.inboxFilter
  const smallTeamsExpanded = routeState.get('smallTeamsExpanded')
  const rowMetadata = filter ? filteredRowData(state) : normalRowData(state, smallTeamsExpanded)
  const inboxGlobalUntrustedState = state.chat.get('inboxGlobalUntrustedState')
  const _selectedConversationIDKey = state.chat2.selectedConversation

  return {
    ...rowMetadata,
    _selectedConversationIDKey,
    filter,
    isActiveRoute,
    isLoading: inboxGlobalUntrustedState === 'loading' || state.chat.get('inboxSyncingState') === 'syncing',
    neverLoaded: inboxGlobalUntrustedState === 'unloaded',
    showNewConversation: state.chat2.isSearching,
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
      dispatch(Chat2Gen.createSetSearching({searching: true}))
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(Chat2Gen.createSetSearching({searching: true})),
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
): Props => ({
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  getTeams: dispatchProps.getTeams,
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
