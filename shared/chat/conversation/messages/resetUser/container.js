// @flow
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat'
// import * as Types from '../../../../constants/types/chat'
import ResetUser from '.'
// import createCachedSelector from 're-reselect'
import {compose, connect} from '../../../../util/container'
// import {connect} from 'react-redux'
// import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
// import {isMobile} from '../../../../constants/platform'
import * as TrackerGen from '../../../../actions/profile-gen'
// import {createGetProfile} from '../../../../actions/tracker-gen'
// import {chatTab} from '../../../../constants/tabs'

// import type {TypedState} from '../../../../constants/reducer'
// import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps): * => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const username = state.chat.inboxResetParticipants.get(selectedConversationIDKey, I.Set()).first()
  return {username, _conversationIDKey: selectedConversationIDKey}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _viewProfile: (username: string) => dispatch(TrackerGen.createGetProfile({username})),
  _letThemIn: (username: string, conversationIDKey: Types.ConversationIDKey) => {},
  _chatWithoutThem: (username: string, conversationIDKey: Types.ConversationIDKey) => {},
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  chatWithoutThem: () => dispatchProps._chatWithoutThem(stateProps.username),
  letThemIn: () => dispatchProps._letThemIn(stateProps.username, stateProps._conversationIDKey),
  viewProfile: () => dispatchProps._viewProfile(stateProps.username, stateProps._conversationIDKey),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(ResetUser)
