// @flow
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import ResetUser from '.'
import {compose, connect, type TypedState, type Dispatch} from '../../../../util/container'
import * as ChatGen from '../../../../actions/chat-gen'
import * as TrackerGen from '../../../../actions/profile-gen'

const mapStateToProps = (state: TypedState, {messageKey}): * => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state) || ''
  const username = '' // TODO state.chat.inboxResetParticipants.get(selectedConversationIDKey, I.Set()).first() || ''
  const allowChatWithoutThem =
    state.chat.inbox.getIn([selectedConversationIDKey, 'participants'], I.List()).size > 2
  return {_conversationIDKey: selectedConversationIDKey, allowChatWithoutThem, username}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _chatWithoutThem: (username: string, conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createResetChatWithoutThem({conversationIDKey, username})),
  _letThemIn: (username: string, conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createResetLetThemIn({conversationIDKey, username})),
  _viewProfile: (username: string) => dispatch(TrackerGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  allowChatWithoutThem: stateProps.allowChatWithoutThem,
  chatWithoutThem: () => dispatchProps._chatWithoutThem(stateProps.username, stateProps._conversationIDKey),
  letThemIn: () => dispatchProps._letThemIn(stateProps.username, stateProps._conversationIDKey),
  username: stateProps.username,
  viewProfile: () => dispatchProps._viewProfile(stateProps.username),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(ResetUser)
