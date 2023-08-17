import * as C from '../../../constants'
import InviteCode from '.'

export default () => {
  const error = C.useSignupState(s => s.inviteCodeError)
  const goBackAndClearErrors = C.useSignupState(s => s.dispatch.goBackAndClearErrors)
  const checkInviteCode = C.useSignupState(s => s.dispatch.checkInviteCode)
  const onBack = goBackAndClearErrors
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onRequestInvite = () => {
    navigateAppend('signupRequestInvite')
  }
  const onSubmit = checkInviteCode
  const props = {
    error,
    onBack,
    onRequestInvite,
    onSubmit,
  }
  return <InviteCode {...props} />
}
