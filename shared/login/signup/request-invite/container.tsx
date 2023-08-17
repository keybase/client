import * as C from '../../../constants'
import RequestInvite from '.'

export default () => {
  const emailError = C.useSignupState(s => s.emailError)
  const nameError = C.useSignupState(s => s.nameError)
  const goBackAndClearErrors = C.useSignupState(s => s.dispatch.goBackAndClearErrors)
  const requestInvite = C.useSignupState(s => s.dispatch.requestInvite)
  const onBack = goBackAndClearErrors
  const onSubmit = requestInvite
  const props = {emailError, nameError, onBack, onSubmit}
  return <RequestInvite {...props} />
}
