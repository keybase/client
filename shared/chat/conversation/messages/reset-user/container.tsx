import * as C from '../../../../constants'
import ResetUser from '.'

export default () => {
  const meta = C.useChatContext(s => s.meta)
  const participantInfo = C.useChatContext(s => s.participants)
  const resetChatWithoutThem = C.useChatContext(s => s.dispatch.resetChatWithoutThem)
  const resetLetThemIn = C.useChatContext(s => s.dispatch.resetLetThemIn)
  const _participants = participantInfo.all
  const _resetParticipants = meta.resetParticipants
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const _viewProfile = showUserProfile
  const username = (_resetParticipants && [..._resetParticipants][0]) || ''
  const nonResetUsers = new Set(_participants)
  _resetParticipants.forEach(r => nonResetUsers.delete(r))
  const allowChatWithoutThem = nonResetUsers.size > 1
  const props = {
    allowChatWithoutThem,
    chatWithoutThem: resetChatWithoutThem,
    letThemIn: () => resetLetThemIn(username),
    username,
    viewProfile: () => _viewProfile(username),
  }

  return <ResetUser {...props} />
}
