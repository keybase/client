import * as C from '../../../constants'
import RequestInviteSuccess from '.'

export default () => {
  const restartSignup = C.useSignupState(s => s.dispatch.restartSignup)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    restartSignup()
    navigateUp()
  }
  const props = {onBack}
  return <RequestInviteSuccess {...props} />
}
