// @flow
import {makeRouteDefNode} from '../../route-tree'
import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import UsernameEmailForm from './username-email-form/container'
import PassphraseSignup from './passphrase/container'
import DeviceName from './device-name/container'
import SignupError from './error/container'

const signupChildren = {
  deviceName: {children: key => makeRouteDefNode(signupChildren[key]), component: DeviceName},
  inviteCode: {children: key => makeRouteDefNode(signupChildren[key]), component: InviteCode},
  passphraseSignup: {children: key => makeRouteDefNode(signupChildren[key]), component: PassphraseSignup},
  requestInvite: {children: key => makeRouteDefNode(signupChildren[key]), component: RequestInvite},
  requestInviteSuccess: {
    children: key => makeRouteDefNode(signupChildren[key]),
    component: RequestInviteSuccess,
  },
  signupError: {children: key => makeRouteDefNode(signupChildren[key]), component: SignupError},
  usernameAndEmail: {children: key => makeRouteDefNode(signupChildren[key]), component: UsernameEmailForm},
}

// Nothing at the root
const NullComponent = () => null

const signupRoutes = makeRouteDefNode({
  children: signupChildren,
  component: NullComponent,
})

export default signupRoutes
