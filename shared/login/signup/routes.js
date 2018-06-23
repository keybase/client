// @flow
import {makeRouteDefNode} from '../../route-tree'
import InviteCode from './invite-code/container'
import RequestInvite from './request-invite/container'
import RequestInviteSuccess from './request-invite-success/container'
import UsernameEmailForm from './username-email-form/container'
import PassphraseSignup from './passphrase/container'
import DeviceName from './device-name'
import Success from './success/container'
import SignupError from './error/container'

// TODO dont make this all nested
const signupError = makeRouteDefNode({
  component: SignupError,
  children: {},
})

const routeTree = makeRouteDefNode({
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
