// @flow
import {RouteDefNode} from '../../route-tree'
import InviteCode from './invite-code'
import RequestInvite from './request-invite'
import RequestInviteSuccess from './request-invite-success'
import UsernameEmailForm from './username-email-form'
import PassphraseSignup from './passphrase'
import DeviceName from './device-name'
import Success from './success'
import SignupError from './error'

const signupError = new RouteDefNode({
  component: SignupError,
  children: {},
})

const routeTree = new RouteDefNode({
  component: InviteCode,
  children: {
    signupError,
    requestInvite: {
      component: RequestInvite,
      children: {
        signupError,
        requestInviteSuccess: {
          component: RequestInviteSuccess,
        },
      },
    },
    usernameAndEmail: {
      component: UsernameEmailForm,
      children: {
        signupError,
        passphraseSignup: {
          component: PassphraseSignup,
          children: {
            signupError,
            deviceName: {
              component: DeviceName,
              children: {
                signupError,
                success: {
                  component: Success,
                  children: {
                    signupError,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
})

export default routeTree
