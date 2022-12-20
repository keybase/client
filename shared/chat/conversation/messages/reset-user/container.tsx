import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ProfileGen from '../../../../actions/profile-gen'
import type * as Types from '../../../../constants/types/chat2'
import ResetUser from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default connect(
  (state, {conversationIDKey}: OwnProps) => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const _participants = participantInfo.all
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
    const {_resetParticipants, _participants, _conversationIDKey} = stateProps
    const {_chatWithoutThem, _letThemIn, _viewProfile} = dispatchProps
    const username = (_resetParticipants && [..._resetParticipants][0]) || ''
    const nonResetUsers = new Set(_participants)
    _resetParticipants.forEach(r => nonResetUsers.delete(r))
    const allowChatWithoutThem = nonResetUsers.size > 1
    return {
      allowChatWithoutThem,
      chatWithoutThem: () => _chatWithoutThem(_conversationIDKey),
      letThemIn: () => _letThemIn(username, _conversationIDKey),
      username,
      viewProfile: () => _viewProfile(username),
    }
  }
)(ResetUser)
