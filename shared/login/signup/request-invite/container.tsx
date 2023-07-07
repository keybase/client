import * as Constants from '../../../constants/signup'
import RequestInvite from '.'

export default () => {
  const emailError = Constants.useState(s => s.emailError)
  const nameError = Constants.useState(s => s.nameError)
  const goBackAndClearErrors = Constants.useState(s => s.dispatch.goBackAndClearErrors)
  const requestInvite = Constants.useState(s => s.dispatch.requestInvite)
  const onBack = goBackAndClearErrors
  const onSubmit = requestInvite
  const props = {emailError, nameError, onBack, onSubmit}
  return <RequestInvite {...props} />
}
