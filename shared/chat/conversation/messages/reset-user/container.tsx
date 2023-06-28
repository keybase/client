import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ProfileConstants from '../../../../constants/profile'
import type * as Types from '../../../../constants/types/chat2'
import ResetUser from '.'
import * as Container from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default (ownProps: OwnProps) => {
  const {conversationIDKey} = ownProps
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const _participants = participantInfo.all
  const _resetParticipants = meta.resetParticipants
  const _conversationIDKey = conversationIDKey

  const dispatch = Container.useDispatch()
  const _chatWithoutThem = (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createResetChatWithoutThem({conversationIDKey}))
  }
  const _letThemIn = (username: string, conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createResetLetThemIn({conversationIDKey, username}))
  }
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const _viewProfile = showUserProfile
  const username = (_resetParticipants && [..._resetParticipants][0]) || ''
  const nonResetUsers = new Set(_participants)
  _resetParticipants.forEach(r => nonResetUsers.delete(r))
  const allowChatWithoutThem = nonResetUsers.size > 1
  const props = {
    allowChatWithoutThem,
    chatWithoutThem: () => _chatWithoutThem(_conversationIDKey),
    letThemIn: () => _letThemIn(username, _conversationIDKey),
    username,
    viewProfile: () => _viewProfile(username),
  }

  return <ResetUser {...props} />
}
