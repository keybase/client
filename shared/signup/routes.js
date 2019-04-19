// @flow
import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import Username from './username/container'
import DeviceName from './device-name/container'

const children = {
  signupDeviceName: {component: DeviceName},
  signupInviteCode: {component: InviteCode},
  signupRequestInvite: {component: RequestInvite},
  signupRequestInviteSuccess: {component: RequestInviteSuccess},
  signupUsernameAndEmail: {component: Username},
}

export default children

export const newRoutes = {
  signupDeviceName: {getScreen: () => DeviceName},
  signupInviteCode: {getScreen: () => InviteCode},
  signupRequestInvite: {getScreen: () => RequestInvite},
  signupRequestInviteSuccess: {getScreen: () => RequestInviteSuccess},
  signupUsernameAndEmail: {getScreen: () => Username},
}
