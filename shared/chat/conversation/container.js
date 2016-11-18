// @flow
import Conversation from './index'
import HiddenString from '../../util/hidden-string'
import {List} from 'immutable'
import {connect} from 'react-redux'
import {loadMoreMessages, postMessage} from '../../actions/chat'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {}

export default connect(
  (state: TypedState) => {
    const selectedConversation = state.chat.get('selectedConversation')

    if (selectedConversation) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        const inbox = state.chat.get('inbox')
        const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversation)

        return {
          participants: selected && selected.participants || List(),
          messages: conversationState.messages,
          moreToLoad: conversationState.moreToLoad,
          isLoading: conversationState.isLoading,
          selectedConversation,
        }
      }
    }

    return {
      participants: List(),
      messages: List(),
      moreToLoad: false,
      isLoading: false,
      selectedConversation,
    }
  },
  (dispatch: Dispatch) => ({
    loadMoreMessages: () => dispatch(loadMoreMessages()),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, new HiddenString(text))),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
  }),
)(Conversation)
