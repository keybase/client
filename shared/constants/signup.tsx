import * as Platforms from '../constants/platform'
import * as SettingsConstants from '../constants/settings'
import * as PushConstants from '../constants/push'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Z from '../util/zustand'
import logger from '../logger'
import trim from 'lodash/trim'
import {RPCError} from '../util/errors'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'
import {useConfigState, createOtherAccountWaitingKey} from './config'

export const maxUsernameLength = 16
export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

export const defaultDevicename =
  (Platforms.isAndroid && 'Android Device') ||
  (Platforms.isIOS && 'iOS Device') ||
  (Platforms.isDarwin && 'Mac Device') ||
  (Platforms.isWindows && 'Windows Device') ||
  (Platforms.isLinux && 'Linux Device') ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')

type Store = {
  devicename: string
  devicenameError: string
  email: string
  emailError: string
  emailVisible: boolean
  inviteCode: string
  inviteCodeError: string
  justSignedUpEmail: string
  name: string
  nameError: string
  signupError?: RPCError
  username: string
  usernameError: string
  usernameTaken: string
}

const initialStore: Store = {
  devicename: defaultDevicename,
  devicenameError: '',
  email: '',
  emailError: '',
  emailVisible: false,
  inviteCode: '',
  inviteCodeError: '',
  justSignedUpEmail: '',
  name: '',
  nameError: '',
  signupError: undefined,
  username: '',
  usernameError: '',
  usernameTaken: '',
}

export type State = Store & {
  dispatch: {
    checkDeviceName: (devicename: string) => void
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
  const noErrors = () =>
    !get().devicenameError &&
    !get().emailError &&
    !get().inviteCodeError &&
    !get().nameError &&
    !get().usernameError &&
    !get().signupError &&
    !get().usernameTaken

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
        PushConstants.useState.getState().dispatch.showPermissionsPrompt({justSignedUp: true})

        await RPCTypes.signupSignupRpcListener(
          {
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
              deviceType: Platforms.isMobile ? RPCTypes.DeviceType.mobile : RPCTypes.DeviceType.desktop,
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
          },
          Z.dummyListenerApi
        )
        set(s => {
          s.signupError = undefined
        })
        if (noErrors()) {
          get().dispatch.restartSignup()
        } else {
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['signupError']}))
        }
        // If the email was set to be visible during signup, we need to set that with a separate RPC.
        if (noErrors() && get().emailVisible) {
          SettingsConstants.useEmailState
            .getState()
            .dispatch.editEmail({email: get().email, makeSearchable: true})
        }
      } catch (_error) {
        if (_error instanceof RPCError) {
          const error = _error
          set(s => {
            s.signupError = error
          })
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['signupError']}))
          PushConstants.useState.getState().dispatch.showPermissionsPrompt({justSignedUp: false})
        }
      }
    }
    Z.ignorePromise(f())
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
          await RPCTypes.deviceCheckDeviceNameFormatRpcPromise({name: devicename}, waitingKey)
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
      Z.ignorePromise(f())
    },
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
          if (noErrors()) {
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
        if (!noErrors()) {
          return
        }
        try {
          await RPCTypes.signupCheckUsernameAvailableRpcPromise({username}, waitingKey)
          logger.info(`${username} success`)

          set(s => {
            s.usernameError = ''
            s.usernameTaken = ''
          })
          if (noErrors()) {
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
        s.devicenameError = ''
        s.emailError = ''
        s.inviteCodeError = ''
        s.nameError = ''
        s.signupError = undefined
        s.usernameError = ''
        s.usernameTaken = ''
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
        if (!noErrors()) {
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
