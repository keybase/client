import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import ResetUser from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  let username = ''
  for (var u of meta.resetParticipants) {
    username = u || ''
    break
  }

  const nonResetUsers = new Set(meta.participants)
  for (var r of meta.resetParticipants) {
    if (nonResetUsers.has(r)) {
      nonResetUsers.delete(r)
    }
  }
  const allowChatWithoutThem = nonResetUsers.size > 1
  return {_conversationIDKey: conversationIDKey, allowChatWithoutThem, username}
}

const mapDispatchToProps = dispatch => ({
  _chatWithoutThem: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createResetChatWithoutThem({conversationIDKey})),
  _letThemIn: (username: string, conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createResetLetThemIn({conversationIDKey, username})),
  _viewProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  allowChatWithoutThem: stateProps.allowChatWithoutThem,
  chatWithoutThem: () => dispatchProps._chatWithoutThem(stateProps._conversationIDKey),
  letThemIn: () => dispatchProps._letThemIn(stateProps.username, stateProps._conversationIDKey),
  username: stateProps.username,
  viewProfile: () => dispatchProps._viewProfile(stateProps.username),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ResetUser)
