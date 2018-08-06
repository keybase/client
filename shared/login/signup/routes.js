// @flow
import {makeRouteDefNode} from '../../route-tree'
import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import UsernameEmail from './username-email/container'
import PassphraseSignup from './passphrase/container'
import DeviceName from './device-name/container'
import SignupError from './error/container'

const addTags = component => ({children: key => makeRouteDefNode(children[key]), component})

const children = {
  deviceName: addTags(DeviceName),
  inviteCode: addTags(InviteCode),
  passphraseSignup: addTags(PassphraseSignup),
  requestInvite: addTags(RequestInvite),
  requestInviteSuccess: addTags(RequestInviteSuccess),
  signupError: addTags(SignupError),
  usernameAndEmail: addTags(UsernameEmail),
}

const signupRoutes = makeRouteDefNode({
  children,
  component: children.requestInvite.component,
})

export default signupRoutes
