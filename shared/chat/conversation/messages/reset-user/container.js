// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as TrackerGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import ResetUser from '.'
import {compose, connect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const username = meta.resetParticipants.first() || ''
  const nonResetUsers = meta.participants.toSet().subtract(meta.resetParticipants)
  const allowChatWithoutThem = nonResetUsers.size > 1
  return {_conversationIDKey: conversationIDKey, allowChatWithoutThem, username}
}

const mapDispatchToProps = (dispatch) => ({
  _chatWithoutThem: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createResetChatWithoutThem({conversationIDKey})),
  _letThemIn: (username: string, conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createResetLetThemIn({conversationIDKey, username})),
  _viewProfile: (username: string) => dispatch(TrackerGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  allowChatWithoutThem: stateProps.allowChatWithoutThem,
  chatWithoutThem: () => dispatchProps._chatWithoutThem(stateProps._conversationIDKey),
  letThemIn: () => dispatchProps._letThemIn(stateProps.username, stateProps._conversationIDKey),
  username: stateProps.username,
  viewProfile: () => dispatchProps._viewProfile(stateProps.username),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(ResetUser)
