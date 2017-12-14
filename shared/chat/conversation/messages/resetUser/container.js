// @flow
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import ResetUser from '.'
import {compose, connect, type TypedState, type Dispatch} from '../../../../util/container'
// import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
// import {isMobile} from '../../../../constants/platform'
import * as TrackerGen from '../../../../actions/profile-gen'
// import {createGetProfile} from '../../../../actions/tracker-gen'
// import {chatTab} from '../../../../constants/tabs'

// import type {TypedState} from '../../../../constants/reducer'
// import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}): * => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state) || ''
  const username = state.chat.inboxResetParticipants.get(selectedConversationIDKey, I.Set()).first() || ''
  const allowChatWithoutThem =
    state.chat.inbox.getIn([selectedConversationIDKey, 'participants'], I.List()).size > 2
  return {_conversationIDKey: selectedConversationIDKey, allowChatWithoutThem, username}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _chatWithoutThem: (username: string, conversationIDKey: Types.ConversationIDKey) => {},
  _letThemIn: (username: string, conversationIDKey: Types.ConversationIDKey) => {},
  _viewProfile: (username: string) => dispatch(TrackerGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  allowChatWithoutThem: stateProps.allowChatWithoutThem,
  chatWithoutThem: () => dispatchProps._chatWithoutThem(stateProps.username),
  letThemIn: () => dispatchProps._letThemIn(stateProps.username, stateProps._conversationIDKey),
  username: stateProps.username,
  viewProfile: () => dispatchProps._viewProfile(stateProps.username, stateProps._conversationIDKey),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(ResetUser)
