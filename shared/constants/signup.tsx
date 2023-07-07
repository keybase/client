import type * as Types from './types/signup'
import {RPCError} from '../util/errors'
import * as RPCTypes from '../constants/types/rpc-gen'
import {isValidEmail, isValidName /*isValidUsername*/} from '../util/simple-validators'
import * as Z from '../util/zustand'
import type * as Container from '../util/container' // TODO remov >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Platforms from '../constants/platform'
import HiddenString from '../util/hidden-string'

export const maxUsernameLength = 16
export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

// Helpers ///////////////////////////////////////////////////////////
// returns true if there are no errors, we check all errors at every transition just to be extra careful
// TODO remove expot >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
export const noErrors = (state: Container.TypedState) =>
  !state.signup.devicenameError &&
  !useState.getState().emailError &&
  !state.signup.inviteCodeError &&
  !useState.getState().nameError &&
  !state.signup.usernameError &&
  !state.signup.signupError &&
  !state.signup.usernameTaken

export const defaultDevicename =
  (Platforms.isAndroid && 'Android Device') ||
  (Platforms.isIOS && 'iOS Device') ||
  (Platforms.isDarwin && 'Mac Device') ||
  (Platforms.isWindows && 'Windows Device') ||
  (Platforms.isLinux && 'Linux Device') ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')

export const makeState = (): Types.State => ({
  devicename: defaultDevicename,
  devicenameError: '',
  inviteCode: '',
  inviteCodeError: '',
  justSignedUpEmail: '',
  password: new HiddenString(''),
  passwordError: new HiddenString(''),
  username: '',
  usernameError: '',
  usernameTaken: '',
})

type Store = {
  email: string
  emailError: string
  emailVisible: boolean
  name: string
  nameError: string
}

const initialStore: Store = {
  email: '',
  emailError: '',
  emailVisible: false,
  name: '',
  nameError: '',
}

export type State = Store & {
  dispatch: {
    goBackAndClearErrors: () => void
    resetState: () => void
    restartSignup: () => void
    requestInvite: (email: string, name: string) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const getReduxStore = Z.getReduxStore() // TODO remove >>>>>>>>>>>>>>>>>>>>>>>>>
  const dispatch: State['dispatch'] = {
    goBackAndClearErrors: () => {
      set(s => {
        // TODO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        // s.devicenameError = ''
        s.emailError = ''
        // s.inviteCodeError = ''
        s.nameError = ''
        // s.passwordError = new HiddenString('')
        // s.signupError = undefined
        // s.usernameError = ''
        // s.usernameTaken = ''
      })
      reduxDispatch(RouteTreeGen.createNavigateUp())
    },
    requestInvite: (email, name) => {
      set(s => {
        s.email = email
        s.emailError = isValidEmail(email)
        s.name = name
        s.nameError = isValidName(name)
      })
      const f = async () => {
        if (!noErrors(getReduxStore())) {
          return
        }
        try {
          await RPCTypes.signupInviteRequestRpcPromise(
            {email, fullname: name, notes: 'Requested through GUI app'},
            waitingKey
          )
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['signupRequestInviteSuccess']}))
        } catch (error) {
          if (error instanceof RPCError) {
            const emailError = `Sorry can't get an invite: ${error.desc}`
            set(s => {
              s.emailError = emailError
              s.nameError = ''
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        justSignedUpEmail: s.email,
      }))
    },
    restartSignup: () => {
      get().dispatch.resetState()
      // TODO
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
