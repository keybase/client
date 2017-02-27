// @flow
import ConversationList from './index'
// import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {loadInbox, newChat} from '../../actions/chat'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import * as I from 'immutable'

import type {TypedState} from '../../constants/reducer'

const getInbox = (state: TypedState) => state.chat.get('inbox')
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getAlwaysShow = (state: TypedState) => state.chat.get('alwaysShow')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')

const createImuutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const filteredInbox = createImuutableEqualSelector(
  [getInbox, getSupersededByState, getAlwaysShow],
  (inbox, supersededByState, alwaysShow) => {
    return inbox.filter(i => (!i.isEmpty || alwaysShow.has(i.conversationIDKey)) &&
        !supersededByState.get(i.conversationIDKey)).map(i => i.conversationIDKey)
  }
)
const getRows = createImuutableEqualSelector(
  [filteredInbox, getPending],
  (inbox, pending) => pending.toList().concat(inbox)
)

export default connect(
  (state: TypedState) => ({
    rows: getRows(state),
  }),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
    onNewChat: () => dispatch(newChat([])),
  })
)(ConversationList)

// TEMP
const ConversationListContainer = () => null

export {
  ConversationListContainer,
}
