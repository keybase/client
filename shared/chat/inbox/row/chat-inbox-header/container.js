// @flow
import * as Constants from '../../../../constants/chat2'
import * as Inbox from '../..'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {connect, compose, setDisplayName, withProps} from '../../../../util/container'
import type {TypedState, Dispatch} from '../../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  onNewChat: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
  rows: Array<Inbox.RowItem>,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const filter = state.chat2.inboxFilter
  const isLoading = !state.chat2.loadingMap.isEmpty()
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)
  return {
    _selectedConversationIDKey,
    filter,
    isLoading,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter}) => ({
  _onHotkey: (cmd: string) => {
    if (cmd.endsWith('+n')) {
      dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'searchingForUsers'}))
    } else {
      focusFilter()
    }
  },
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
  onSetFilter: (filter: string) => dispatch(Chat2Gen.createSetInboxFilter({filter})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  isLoading: stateProps.isLoading,
  onNewChat: ownProps.onNewChat,
  onSelectDown: () => dispatchProps._onSelectNext(ownProps.rows, stateProps._selectedConversationIDKey, 1),
  onSelectUp: () => dispatchProps._onSelectNext(ownProps.rows, stateProps._selectedConversationIDKey, -1),
  onSetFilter: dispatchProps.onSetFilter,
  showNewChat: !(ownProps.rows.length || stateProps.filter),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ChatInboxHeaderContainer'),
  withProps(props => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd),
  }))
)(ChatInboxHeader)
