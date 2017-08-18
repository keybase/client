// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {loadInbox, newChat, untrustedInboxVisible, setInboxFilter} from '../../actions/chat/creators'
import {compose, lifecycle} from 'recompose'
import throttle from 'lodash/throttle'

import type {TypedState} from '../../constants/reducer'

const getInbox = (state: TypedState) => state.chat.get('inbox')
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getAlwaysShow = (state: TypedState) => state.chat.get('alwaysShow')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter')

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const passesFilter = (i: Constants.InboxState, filter: string): boolean => {
  if (!filter) {
    return true
  }

  const names = i.get('participants').toArray()
  // No need to worry about Unicode issues with toLowerCase(), since
  // names can only be ASCII.
  return names.some(n => n.toLowerCase().indexOf(filter.toLowerCase()) >= 0)
}

const filteredInbox = createImmutableEqualSelector(
  [getInbox, getSupersededByState, getAlwaysShow, getFilter],
  (inbox, supersededByState, alwaysShow, filter) => {
    const ids = []
    // Building a list using forEach for performance reason, only call i.conversationIDKey once
    inbox.forEach(i => {
      const id = i.conversationIDKey
      if ((!i.isEmpty || alwaysShow.has(id)) && !supersededByState.get(id) && passesFilter(i, filter)) {
        ids.push(id)
      }
    })
    return I.List(ids)
  }
)
const getRows = createImmutableEqualSelector([filteredInbox, getPending], (inbox, pending) => {
  return I.List(pending.keys()).concat(inbox)
})

const mapStateToProps = (state: TypedState, {isActiveRoute}) => ({
  filter: getFilter(state),
  isActiveRoute,
  isLoading: state.chat.get('inboxUntrustedState') === 'loading',
  rows: getRows(state),
  showNewConversation: state.chat.inSearch && state.chat.inboxSearch.isEmpty(),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadInbox: () => dispatch(loadInbox()),
  onNewChat: () => dispatch(newChat([])),
  onSetFilter: (filter: string) => dispatch(setInboxFilter(filter)),
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(untrustedInboxVisible(converationIDKey, rowsVisible)),
})

// Inbox is being loaded a ton by the navigator for some reason. we need a module-level helper
// to not call loadInbox multiple times
const throttleHelper = throttle(cb => cb(), 60 * 1000)

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      throttleHelper(() => {
        this.props.loadInbox()
      })
    },
  })
)(Inbox)
