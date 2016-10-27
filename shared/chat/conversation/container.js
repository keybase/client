// @flow
import {List} from 'immutable'
import Conversation from './index'
import {connect} from 'react-redux'
import {loadMoreMessages, postMessage} from '../../actions/chat'

import type {TypedState} from '../../constants/reducer'

export default connect(
  (state: TypedState) => {
    const selectedConversation = state.chat.get('selectedConversation')

    if (selectedConversation) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversation)
      if (conversationState) {
        return {
          messages: conversationState.messages,
          moreToLoad: conversationState.moreToLoad,
          isLoading: conversationState.isLoading,
          selectedConversation,
        }
      }
    }

    return {
      messages: List(),
      moreToLoad: false,
      isLoading: false,
      selectedConversation,
    }
  },
  (dispatch: Dispatch) => ({
    loadMoreMessages: () => dispatch(loadMoreMessages()),
    onPostMessage: (selectedConversation, text) => dispatch(postMessage(selectedConversation, text)),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onPostMessage: text => dispatchProps.onPostMessage(stateProps.selectedConversation, text),
  }),
)(Conversation)
