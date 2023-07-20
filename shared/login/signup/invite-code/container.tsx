import * as RouterConstants from '../../../constants/router2'
import * as Constants from '../../../constants/signup'
import InviteCode from '.'

export default () => {
  const error = Constants.useState(s => s.inviteCodeError)
  const goBackAndClearErrors = Constants.useState(s => s.dispatch.goBackAndClearErrors)
  const checkInviteCode = Constants.useState(s => s.dispatch.checkInviteCode)
  const onBack = goBackAndClearErrors
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
