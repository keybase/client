// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {isDarwin} from '../../../../constants/platform'
import {connect, compose, setDisplayName, withProps} from '../../../../util/container'
import type {TypedState} from '../../../../util/container'
import type {RowItem, RowItemSmall, RowItemBig} from '../../index.types'
import ChatFilterRow from '.'

type OwnProps = {
  onNewChat: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
  rows: Array<RowItem>,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const filter = state.chat2.inboxFilter
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)
  return {
    _selectedConversationIDKey,
    filter,
    isLoading: Constants.anyChatWaitingKeys(state),
  }
}

const mapDispatchToProps = (dispatch, {focusFilter}) => ({
  _onHotkey: (cmd: string) => {
    if (cmd.endsWith('+n')) {
      dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'searchingForUsers'}))
    } else {
      focusFilter()
    }
  },
  _onSelectNext: (
    rows: Array<RowItem>,
    selectedConversationIDKey: ?Types.ConversationIDKey,
    direction: -1 | 1
  ) => {
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
  onSetFilter: (filter: string) => dispatch(Chat2Gen.createSetInboxFilter({filter})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
  isLoading: stateProps.isLoading,
  onNewChat: ownProps.onNewChat,
  onSelectDown: () => dispatchProps._onSelectNext(ownProps.rows, stateProps._selectedConversationIDKey, 1),
  onSelectUp: () => dispatchProps._onSelectNext(ownProps.rows, stateProps._selectedConversationIDKey, -1),
  onSetFilter: dispatchProps.onSetFilter,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ChatFilterRow'),
  withProps(props => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd),
  }))
)(ChatFilterRow)
