// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import Inbox from './index'
import {connect} from 'react-redux'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {loadInbox, newChat, untrustedInboxVisible} from '../../actions/chat/creators'

import type {TypedState} from '../../constants/reducer'

const getInbox = (state: TypedState) => state.chat.get('inbox')
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getAlwaysShow = (state: TypedState) => state.chat.get('alwaysShow')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter')

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const passesFilter = (i: Constants.InboxState, filter: I.List<string>): boolean => {
  if (filter.isEmpty()) {
    return true
  }

  return filter.isSubset(i.get('participants'))
}

const filteredInbox = createImmutableEqualSelector(
  [getInbox, getSupersededByState, getAlwaysShow, getFilter],
  (inbox, supersededByState, alwaysShow, filter) => {
    return inbox
      .filter(
        i =>
          (!i.isEmpty || alwaysShow.has(i.conversationIDKey)) &&
          !supersededByState.get(i.conversationIDKey) &&
          passesFilter(i, filter)
      )
      .map(i => i.conversationIDKey)
  }
)
const getRows = createImmutableEqualSelector([filteredInbox, getPending], (inbox, pending) => {
  return I.List(pending.keys()).concat(inbox)
})

const mapStateToProps = (state: TypedState) => ({
  isLoading: state.chat.get('inboxUntrustedState') === 'loading',
  showNewConversation: state.chat.inSearch && state.chat.inboxSearch.isEmpty(),
  rows: getRows(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadInbox: () => dispatch(loadInbox()),
  onNewChat: () => dispatch(newChat([])),
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(untrustedInboxVisible(converationIDKey, rowsVisible)),
})

export default connect(mapStateToProps, mapDispatchToProps)(Inbox)
