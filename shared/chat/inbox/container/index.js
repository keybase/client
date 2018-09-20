// @flow
import {debounce} from 'lodash-es'
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Inbox from '..'
import {
  connect,
  compose,
  lifecycle,
  setDisplayName,
  withStateHandlers,
  isMobile,
} from '../../../util/container'
import type {TypedState} from '../../../util/container'
import type {RowItemSmall, RowItemBig, RowItemDivider} from '../index.types'
import normalRowData from './normal'
import filteredRowData from './filtered'

const mapStateToProps = (state: TypedState, {routeState}) => ({
  _username: state.config.username,
  _metaMap: state.chat2.metaMap,
  _selectedConversationIDKey: Constants.getSelectedConversation(state),
  _smallTeamsExpanded: routeState.get('smallTeamsExpanded'),
  filter: state.chat2.inboxFilter,
  isLoading: Constants.anyChatWaitingKeys(state),
  neverLoaded: !state.chat2.inboxHasLoaded,
})

const mapDispatchToProps = (dispatch, {routeState, setRouteState, navigateAppend}) => ({
  _onSelect: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxFilterChanged'})),
  _onSelectNext: (rows, selectedConversationIDKey, direction) => {
    const goodRows: Array<RowItemSmall | RowItemBig> = rows.reduce((arr, row) => {
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
  onNewChat: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'searchingForUsers'})),
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
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {allowShowFloatingButton, rows, smallTeamsExpanded} = stateProps.filter
    ? filteredRowData(stateProps._metaMap, stateProps.filter, stateProps._username)
    : normalRowData(stateProps._metaMap, stateProps._smallTeamsExpanded)
  return {
    allowShowFloatingButton,
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
    onSelectDown: () => dispatchProps._onSelectNext(rows, stateProps._selectedConversationIDKey, 1),
    onSelectUp: () => dispatchProps._onSelectNext(rows, stateProps._selectedConversationIDKey, -1),
    onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
    refreshInbox: dispatchProps.refreshInbox,
    rows,
    smallTeamsExpanded,
    toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Inbox'),
  withStateHandlers(
    {filterFocusCount: 0},
    {focusFilter: ({filterFocusCount}) => () => ({filterFocusCount: filterFocusCount + 1})}
  ),
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
