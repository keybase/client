// @flow
import {List} from 'immutable'
import Conversation from './index'
import {connect} from 'react-redux'
import {loadMoreMessages} from '../../actions/chat'

import type {TypedState} from '../../constants/reducer'

export default connect(
  (state: TypedState) => {
    const selectedConversation = state.chat.selectedConversation

    if (selectedConversation) {
      const conversationState = state.chat.conversationStates.get(selectedConversation)
      if (conversationState) {
        return {
          messages: conversationState.messages,
          moreToLoad: conversationState.moreToLoad,
        }
      }
    }

    return {
      messages: List(),
      moreToLoad: false,
    }
  },
  (dispatch: Dispatch) => ({
    loadMoreMessages: () => dispatch(loadMoreMessages()),
  }),
)(Conversation)
