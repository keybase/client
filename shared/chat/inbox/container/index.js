// @flow
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Inbox from '..'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {debounce} from 'lodash-es'
import {connect, compose, lifecycle, withStateHandlers, withProps, isMobile} from '../../../util/container'
import type {TypedState, Dispatch} from '../../../util/container'
import normalRowData from './normal'
import filteredRowData from './filtered'

const mapStateToProps = (state: TypedState, {routeState}) => {
  const filter = state.chat2.inboxFilter
  const smallTeamsExpanded = routeState.get('smallTeamsExpanded')
  const rowMetadata = filter ? filteredRowData(state) : normalRowData(state, smallTeamsExpanded)
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)

  return {
    ...rowMetadata,
    _selectedConversationIDKey,
    filter,
    isLoading: !state.chat2.loadingMap.isEmpty(),
    neverLoaded: state.chat2.metaMap.isEmpty(),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeState, setRouteState, navigateAppend}) => ({
  _onHotkey: (cmd: string, focusFilter: () => void) => {
    if (cmd.endsWith('+n')) {
      dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'searchingForUsers'}))
    } else {
      focusFilter()
    }
  },
  _onSelect: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxFilterChanged'})),
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
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxFilterArrow'}))
    }
  },
  onNewChat: () => {
    dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'searchingForUsers'}))
  },
  onSetFilter: (filter: string) => dispatch(Chat2Gen.createSetInboxFilter({filter})),
  onUntrustedInboxVisible: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
    dispatch(
      Chat2Gen.createMetaNeedsUpdating({
        conversationIDKeys,
        reason: 'untrusted inbox visible',
      })
    ),
  refreshInbox: (force: boolean) => dispatch(Chat2Gen.createInboxRefresh({reason: 'componentNeverLoaded'})),
  toggleSmallTeamsExpanded: () =>
    setRouteState({
      smallTeamsExpanded: !routeState.get('smallTeamsExpanded'),
    }),
})

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  isLoading: stateProps.isLoading,
  neverLoaded: stateProps.neverLoaded,
  onNewChat: dispatchProps.onNewChat,
  onSelect: (conversationIDKey: Types.ConversationIDKey) => dispatchProps._onSelect(conversationIDKey),
  onSelectDebounced: debounce(
    (conversationIDKey: Types.ConversationIDKey) => dispatchProps._onSelect(conversationIDKey),
    400,
    {maxWait: 600}
  ),
  onSelectDown: () => dispatchProps._onSelectNext(stateProps.rows, stateProps._selectedConversationIDKey, 1),
  onSelectUp: () => dispatchProps._onSelectNext(stateProps.rows, stateProps._selectedConversationIDKey, -1),
  onSetFilter: dispatchProps.onSetFilter,
  onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
  refreshInbox: dispatchProps.refreshInbox,
  rows: stateProps.rows,
  showBuildATeam: stateProps.showBuildATeam,
  showNewChat: !stateProps.rows.length,
  showSmallTeamsExpandDivider: stateProps.showSmallTeamsExpandDivider,
  smallIDsHidden: stateProps.smallIDsHidden,
  smallTeamsExpanded: stateProps.smallTeamsExpanded,
  toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {filterFocusCount: 0},
    {focusFilter: ({filterFocusCount}) => () => ({filterFocusCount: filterFocusCount + 1})}
  ),
  withProps(props => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd, props.focusFilter),
  })),
  lifecycle({
    componentDidMount() {
      if (this.props.neverLoaded && !this.props.isLoading) {
        this.props.refreshInbox()
      }
    },
    componentDidUpdate(prevProps) {
      const loadedForTheFirstTime = prevProps.rows.length === 0 && this.props.rows.length > 0
      // See if the first 6 are small, this implies it's expanded
      const smallRowsPlusOne = prevProps.rows.slice(0, 6).filter(r => r.type === 'small')
      const expandedForTheFirstTime = smallRowsPlusOne.length === 5 && this.props.rows.length > 5
      if (loadedForTheFirstTime || expandedForTheFirstTime) {
        const toUnbox = this.props.rows.slice(0, 20).reduce((arr, row) => {
          if (row.type === 'small' || row.type === 'big') {
            arr.push(row.conversationIDKey)
          }
          return arr
        }, [])
        if (toUnbox.length) {
          this.props.onUntrustedInboxVisible(toUnbox)
        }
      }

      // keep first item selected if filter changes
      if (!isMobile) {
        if (this.props.filter && prevProps.filter !== this.props.filter && this.props.rows.length > 0) {
          const row = this.props.rows[0]
          if (row.conversationIDKey) {
            this.props.onSelectDebounced(row.conversationIDKey)
          }
        }
      }
    },
  })
)(Inbox.default)
