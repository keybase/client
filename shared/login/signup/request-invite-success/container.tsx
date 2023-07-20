import * as RouterConstants from '../../../constants/router2'
import RequestInviteSuccess from '.'
import * as Constants from '../../../constants/signup'

export default () => {
  const restartSignup = Constants.useState(s => s.dispatch.restartSignup)
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    restartSignup()
    navigateUp()
  }
  const props = {onBack}
  return <RequestInviteSuccess {...props} />
}
