// @flow
import Email from './email/container'
import InviteCode from './invite-code/container'
import Phone from './phone-number/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import Username from './username/container'
import DeviceName from './device-name/container'

const children = {
  signupDeviceName: {component: DeviceName},
  signupEmail: {component: Email},
  signupInviteCode: {component: InviteCode},
  signupPhone: {component: Phone},
  signupRequestInvite: {component: RequestInvite},
  signupRequestInviteSuccess: {component: RequestInviteSuccess},
  signupUsernameAndEmail: {component: Username},
}

export default children

export const newRoutes = {
  signupDeviceName: {getScreen: () => DeviceName},
  signupEmail: {getScreen: () => Email},
  signupInviteCode: {getScreen: () => InviteCode},
  signupPhone: {getScreen: () => Phone},
  signupRequestInvite: {getScreen: () => RequestInvite},
  signupRequestInviteSuccess: {getScreen: () => RequestInviteSuccess},
  signupUsernameAndEmail: {getScreen: () => Username, upgraded: true},
}
