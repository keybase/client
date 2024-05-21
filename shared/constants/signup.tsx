import * as C from '.'
import * as Platforms from './platform'
import * as EngineGen from '../actions/engine-gen-gen'
import * as T from './types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import trim from 'lodash/trim'
import {RPCError} from '@/util/errors'
import {isValidEmail, isValidName, isValidUsername} from '@/util/simple-validators'

export const maxUsernameLength = 16
export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

export const defaultDevicename =
  (Platforms.isAndroid ? 'Android Device' : undefined) ||
  (Platforms.isIOS ? 'iOS Device' : undefined) ||
  (Platforms.isDarwin ? 'Mac Device' : undefined) ||
  (Platforms.isWindows ? 'Windows Device' : undefined) ||
  (Platforms.isLinux ? 'Linux Device' : undefined) ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')

type Store = T.Immutable<{
  devicename: string
  devicenameError: string
  email: string
  emailError: string
  emailVisible: boolean
  inviteCode: string
  justSignedUpEmail: string
  name: string
  nameError: string
  signupError?: RPCError
  username: string
  usernameError: string
  usernameTaken: string
}>

const initialStore: Store = {
  devicename: defaultDevicename,
  devicenameError: '',
  email: '',
  emailError: '',
  emailVisible: false,
  inviteCode: '',
  justSignedUpEmail: '',
  name: '',
  nameError: '',
  signupError: undefined,
  username: '',
  usernameError: '',
  usernameTaken: '',
}

export interface State extends Store {
  dispatch: {
    checkDeviceName: (devicename: string) => void
    checkInviteCode: () => void
    checkUsername: (username: string) => void
    clearJustSignedUpEmail: () => void
    goBackAndClearErrors: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    requestAutoInvite: (username?: string) => void
    requestInvite: (email: string, name: string) => void
    resetState: () => void
    restartSignup: () => void
    setJustSignedUpEmail: (email: string) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const noErrors = () => {
    const {devicenameError, emailError} = get()
    const {nameError, usernameError, signupError, usernameTaken} = get()
    return !(devicenameError || emailError || nameError || usernameError || signupError || usernameTaken)
  }

  const reallySignupOnNoErrors = () => {
    const f = async () => {
      if (!noErrors()) {
        logger.warn('Still has errors, bailing on really signing up')
        return
      }

      const {username, inviteCode, devicename} = get()
      if (!username || !inviteCode || !devicename) {
        logger.warn('Missing data during signup phase', username, inviteCode, devicename)
        throw new Error('Missing data for signup')
      }

      try {
        C.usePushState.getState().dispatch.showPermissionsPrompt({justSignedUp: true})

        await T.RPCGen.signupSignupRpcListener({
          customResponseIncomingCallMap: {
            // Do not add a gpg key for now
            'keybase.1.gpgUi.wantToAddGPGKey': (_, response) => {
              response.result(false)
            },
          },
          incomingCallMap: {
            // We dont show the paperkey anymore
            'keybase.1.loginUi.displayPrimaryPaperKey': () => {},
          },
          params: {
            botToken: '',
            deviceName: devicename,
            deviceType: Platforms.isMobile ? T.RPCGen.DeviceType.mobile : T.RPCGen.DeviceType.desktop,
            email: '',
            genPGPBatch: false,
            genPaper: false,
            inviteCode,
            passphrase: '',
            randomPw: true,
            skipGPG: true,
            skipMail: true,
            storeSecret: true,
            username,
            verifyEmail: true,
          },
          waitingKey,
        })
        set(s => {
          s.signupError = undefined
        })
        if (noErrors()) {
          get().dispatch.restartSignup()
        } else {
          C.useRouterState.getState().dispatch.navigateAppend('signupError')
        }
        // If the email was set to be visible during signup, we need to set that with a separate RPC.
        if (noErrors() && get().emailVisible) {
          C.useSettingsEmailState.getState().dispatch.editEmail({email: get().email, makeSearchable: true})
        }
      } catch (_error) {
        if (_error instanceof RPCError) {
          const error = _error
          set(s => {
            s.signupError = error
          })
          C.useRouterState.getState().dispatch.navigateAppend('signupError')
          C.usePushState.getState().dispatch.showPermissionsPrompt({justSignedUp: false})
        }
      }
    }
    C.ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    checkDeviceName: _devicename => {
      const devicename = trim(_devicename)
      set(s => {
        s.devicename = devicename
        s.devicenameError = devicename.length === 0 ? 'Device name must not be empty.' : ''
      })
      const f = async () => {
        if (!noErrors()) {
          return
        }
        try {
          await T.RPCGen.deviceCheckDeviceNameFormatRpcPromise({name: devicename}, waitingKey)
          reallySignupOnNoErrors()
        } catch (error) {
          if (error instanceof RPCError) {
            const msg = error.desc
            set(s => {
              s.devicenameError = msg
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    checkInviteCode: () => {
      const invitationCode = get().inviteCode
      const f = async () => {
        try {
          await T.RPCGen.signupCheckInvitationCodeRpcPromise({invitationCode}, waitingKey)
          set(s => {
            s.signupError = undefined
          })
          if (noErrors()) {
            C.useRouterState.getState().dispatch.navigateUp()
            C.useRouterState.getState().dispatch.navigateAppend('signupEnterUsername')
          }
        } catch (error) {
          if (error instanceof RPCError) {
            const e = error
            set(s => {
              s.signupError = e
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    checkUsername: username => {
      set(s => {
        s.username = username
        s.usernameError = isValidUsername(username)
        s.usernameTaken = ''
      })
      const f = async () => {
        logger.info(`checking ${username}`)
        if (!noErrors()) {
          return
        }
        try {
          await T.RPCGen.signupCheckUsernameAvailableRpcPromise({username}, waitingKey)
          logger.info(`${username} success`)

          set(s => {
            s.usernameError = ''
            s.usernameTaken = ''
          })
          if (noErrors()) {
            C.useRouterState.getState().dispatch.navigateAppend('signupEnterDevicename')
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn(`${username} error: ${error.message}`)
            const msg = error.code === T.RPCGen.StatusCode.scinputerror ? usernameHint : error.desc
            // Don't set error if it's 'username taken', we show a banner in that case
            const usernameError = error.code === T.RPCGen.StatusCode.scbadsignupusernametaken ? '' : msg
            const usernameTaken = error.code === T.RPCGen.StatusCode.scbadsignupusernametaken ? username : ''
            set(s => {
              s.usernameError = usernameError
              s.usernameTaken = usernameTaken
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    clearJustSignedUpEmail: () => {
      set(s => {
        s.justSignedUpEmail = ''
      })
    },
    goBackAndClearErrors: () => {
      set(s => {
        s.devicenameError = ''
        s.emailError = ''
        s.nameError = ''
        s.signupError = undefined
        s.usernameError = ''
        s.usernameTaken = ''
      })
      C.useRouterState.getState().dispatch.navigateUp()
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
          get().dispatch.clearJustSignedUpEmail()
          break
        default:
      }
    },
    requestAutoInvite: username => {
      set(s => {
        if (username) {
          s.username = username
        }
      })
      const f = async () => {
        // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
        if (C.useConfigState.getState().loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise(
            {force: false, keepSecrets: true},
            C.Config.createOtherAccountWaitingKey
          )
        }
        try {
          const inviteCode = await T.RPCGen.signupGetInvitationCodeRpcPromise(undefined, waitingKey)
          set(s => {
            s.inviteCode = inviteCode
          })
          get().dispatch.checkInviteCode()
        } catch {
          set(s => {
            s.inviteCode = ''
          })
          C.useRouterState.getState().dispatch.navigateAppend('signupError')
        }
      }
      C.ignorePromise(f())
    },
    // shouldn't ever be used
    requestInvite: (email, name) => {
      set(s => {
        s.email = email
        s.emailError = isValidEmail(email)
        s.name = name
        s.nameError = isValidName(name)
      })
      const f = async () => {
        if (!noErrors()) {
          return
        }
        try {
          await T.RPCGen.signupInviteRequestRpcPromise(
            {email, fullname: name, notes: 'Requested through GUI app'},
            waitingKey
          )
          // C.useRouterState.getState().dispatch.navigateAppend('signupRequestInviteSuccess')
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
      C.ignorePromise(f())
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
