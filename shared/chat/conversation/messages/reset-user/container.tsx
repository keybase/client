import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import ResetUser from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default connect(
  (state, {conversationIDKey}: OwnProps) => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const _participants = meta.participants
    const _resetParticipants = meta.resetParticipants
    return {_conversationIDKey: conversationIDKey, _participants, _resetParticipants}
  },
  dispatch => ({
    _chatWithoutThem: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createResetChatWithoutThem({conversationIDKey})),
    _letThemIn: (username: string, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createResetLetThemIn({conversationIDKey, username})),
    _viewProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const username = (stateProps._resetParticipants && stateProps._resetParticipants[0]) || ''
    const nonResetUsers = new Set(stateProps._participants)
    stateProps._resetParticipants.forEach(r => {
      nonResetUsers.delete(r)
    })
    const allowChatWithoutThem = nonResetUsers.size > 1
    return {
      allowChatWithoutThem,
      chatWithoutThem: () => dispatchProps._chatWithoutThem(stateProps._conversationIDKey),
      letThemIn: () => dispatchProps._letThemIn(username, stateProps._conversationIDKey),
      username,
      viewProfile: () => dispatchProps._viewProfile(username),
    }
  }
)(ResetUser)
