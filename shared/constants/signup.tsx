import * as Platforms from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Z from '../util/zustand'
import HiddenString from '../util/hidden-string'
import logger from '../logger'
import type * as Container from '../util/container' // TODO remov >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
import type * as Types from './types/signup'
import {RPCError} from '../util/errors'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'
import {useConfigState, createOtherAccountWaitingKey} from './config'

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
  !useState.getState().inviteCodeError &&
  !useState.getState().nameError &&
  !useState.getState().usernameError &&
  !state.signup.signupError &&
  !useState.getState().usernameTaken

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
  password: new HiddenString(''),
  passwordError: new HiddenString(''),
})

type Store = {
  email: string
  emailError: string
  emailVisible: boolean
  inviteCode: string
  inviteCodeError: string
  justSignedUpEmail: string
  name: string
  nameError: string
  username: string
  usernameError: string
  usernameTaken: string
}

const initialStore: Store = {
  email: '',
  emailError: '',
  emailVisible: false,
  inviteCode: '',
  inviteCodeError: '',
  justSignedUpEmail: '',
  name: '',
  nameError: '',
  username: '',
  usernameError: '',
  usernameTaken: '',
}

export type State = Store & {
  dispatch: {
    checkInviteCode: (inviteCode: string) => void
    checkUsername: (username: string) => void
    clearJustSignedUpEmail: () => void
    goBackAndClearErrors: () => void
    requestAutoInvite: (username?: string) => void
    requestInvite: (email: string, name: string) => void
    resetState: () => void
    restartSignup: () => void
    setJustSignedUpEmail: (email: string) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const getReduxStore = Z.getReduxStore() // TODO remove >>>>>>>>>>>>>>>>>>>>>>>>>
  const dispatch: State['dispatch'] = {
    checkInviteCode: invitationCode => {
      set(s => {
        s.inviteCode = invitationCode
      })
      const f = async () => {
        try {
          await RPCTypes.signupCheckInvitationCodeRpcPromise({invitationCode}, waitingKey)
          set(s => {
            s.inviteCodeError = ''
          })
          if (noErrors(getReduxStore())) {
            reduxDispatch(RouteTreeGen.createNavigateUp())
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['signupEnterUsername']}))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            const msg = error.desc
            set(s => {
              s.inviteCodeError = msg
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    checkUsername: username => {
      set(s => {
        s.username = username
        s.usernameError = isValidUsername(username)
        s.usernameTaken = ''
      })
      const f = async () => {
        logger.info(`checking ${username}`)
        if (!noErrors(getReduxStore())) {
          return
        }
        try {
          await RPCTypes.signupCheckUsernameAvailableRpcPromise({username}, waitingKey)
          logger.info(`${username} success`)

          set(s => {
            s.usernameError = ''
            s.usernameTaken = ''
          })
          if (noErrors(getReduxStore())) {
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['signupEnterDevicename']}))
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn(`${username} error: ${error.message}`)
            const msg = error.code === RPCTypes.StatusCode.scinputerror ? usernameHint : error.desc
            // Don't set error if it's 'username taken', we show a banner in that case
            const usernameError = error.code === RPCTypes.StatusCode.scbadsignupusernametaken ? '' : msg
            const usernameTaken = error.code === RPCTypes.StatusCode.scbadsignupusernametaken ? username : ''
            set(s => {
              s.usernameError = usernameError
              s.usernameTaken = usernameTaken
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    clearJustSignedUpEmail: () => {
      set(s => {
        s.justSignedUpEmail = ''
      })
    },
    goBackAndClearErrors: () => {
      set(s => {
        // TODO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        // s.devicenameError = ''
        s.emailError = ''
        s.inviteCodeError = ''
        s.nameError = ''
        // s.passwordError = new HiddenString('')
        // s.signupError = undefined
        // s.usernameError = ''
        // s.usernameTaken = ''
      })
      reduxDispatch(RouteTreeGen.createNavigateUp())
    },
    requestAutoInvite: username => {
      set(s => {
        if (username) {
          s.username = username
        }
      })
      const f = async () => {
        // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
        if (useConfigState.getState().loggedIn) {
          await RPCTypes.loginLogoutRpcPromise(
            {force: false, keepSecrets: true},
            createOtherAccountWaitingKey
          )
        }
        try {
          const inviteCode = await RPCTypes.signupGetInvitationCodeRpcPromise(undefined, waitingKey)
          set(s => {
            s.inviteCode = inviteCode
          })
        } catch (_) {
          set(s => {
            s.inviteCode = ''
          })
        }
        get().dispatch.checkInviteCode(get().inviteCode)
        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['signupInviteCode']}))
      }
      Z.ignorePromise(f())
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
    },
    setJustSignedUpEmail: (email: string) => {
      set(s => {
        s.justSignedUpEmail = email
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
