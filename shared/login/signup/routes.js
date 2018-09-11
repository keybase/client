// @flow
import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import UsernameEmail from './username-email/container'
import PassphraseSignup from './passphrase/container'
import DeviceName from './device-name/container'
import SignupError from './error/container'

const children = {
  deviceName: {component: DeviceName},
  inviteCode: {component: InviteCode},
  passphraseSignup: {component: PassphraseSignup},
  requestInvite: {component: RequestInvite},
  requestInviteSuccess: {component: RequestInviteSuccess},
  signupError: {component: SignupError},
  usernameAndEmail: {component: UsernameEmail},
}

export default children
