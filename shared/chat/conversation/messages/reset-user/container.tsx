import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import ResetUser from '.'

export default () => {
  const meta = Constants.useContext(s => s.meta)
  const participantInfo = Constants.useContext(s => s.participants)
  const resetChatWithoutThem = Constants.useContext(s => s.dispatch.resetChatWithoutThem)
  const resetLetThemIn = Constants.useContext(s => s.dispatch.resetLetThemIn)
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
