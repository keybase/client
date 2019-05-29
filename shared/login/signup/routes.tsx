import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import UsernameEmail from './username-email/container'
import DeviceName from './device-name/container'
import SignupError from './error/container'

const children = {
  signupDeviceName: {component: DeviceName},
  signupError: {component: SignupError},
  signupInviteCode: {component: InviteCode},
  signupRequestInvite: {component: RequestInvite},
  signupRequestInviteSuccess: {component: RequestInviteSuccess},
  signupUsernameAndEmail: {component: UsernameEmail},
}

export default children

export const newRoutes = {
  signupDeviceName: {getScreen: () => DeviceName},
  signupError: {getScreen: () => SignupError},
  signupInviteCode: {getScreen: () => InviteCode},
  signupRequestInvite: {getScreen: () => RequestInvite},
  signupRequestInviteSuccess: {getScreen: () => RequestInviteSuccess},
  signupUsernameAndEmail: {getScreen: () => UsernameEmail},
}
