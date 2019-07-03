import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import SignupError from './error/container'

const children = {
  signupError: {component: SignupError},
  signupInviteCode: {component: InviteCode},
  signupRequestInvite: {component: RequestInvite},
  signupRequestInviteSuccess: {component: RequestInviteSuccess},
}

export default children

export const newRoutes = {
  signupError: {getScreen: () => SignupError},
  signupInviteCode: {getScreen: () => InviteCode},
  signupRequestInvite: {getScreen: () => RequestInvite},
  signupRequestInviteSuccess: {getScreen: () => RequestInviteSuccess},
}
