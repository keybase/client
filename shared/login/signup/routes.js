// @flow
import {makeRouteDefNode} from '../../route-tree'
import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import UsernameEmailForm from './username-email-form/container'
import PassphraseSignup from './passphrase/container'
import DeviceName from './device-name/container'
import SignupError from './error/container'

const children = {
  deviceName: {children: key => makeRouteDefNode(children[key]), component: DeviceName},
  inviteCode: {children: key => makeRouteDefNode(children[key]), component: InviteCode},
  passphraseSignup: {children: key => makeRouteDefNode(children[key]), component: PassphraseSignup},
  requestInvite: {children: key => makeRouteDefNode(children[key]), component: RequestInvite},
  requestInviteSuccess: {children: key => makeRouteDefNode(children[key]), component: RequestInviteSuccess},
  signupError: {children: key => makeRouteDefNode(children[key]), component: SignupError},
  usernameAndEmail: {children: key => makeRouteDefNode(children[key]), component: UsernameEmailForm},
}

const signupRoutes = makeRouteDefNode({
  children,
  component: children.requestInvite.component,
})

export default signupRoutes
