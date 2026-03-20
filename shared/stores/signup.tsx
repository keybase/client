import * as Platforms from '@/constants/platform'
import {ignorePromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {isValidUsername} from '@/util/simple-validators'
import {navigateAppend, navigateUp} from '@/constants/router'
import {useConfigState} from '@/stores/config'

type Store = T.Immutable<{
  devicename: string
  devicenameError: string
  email: string
  inviteCode: string
  justSignedUpEmail: string
  signupError?: RPCError
  username: string
  usernameError: string
  usernameTaken: string
}>

const initialStore: Store = {
  devicename: S.defaultDevicename,
  devicenameError: '',
  email: '',
  inviteCode: '',
  justSignedUpEmail: '',
  signupError: undefined,
  username: '',
  usernameError: '',
  usernameTaken: '',
}

export interface State extends Store {
  dispatch: {
    defer: {
      onEditEmail?: (p: {email: string; makeSearchable: boolean}) => void
      onShowPermissionsPrompt?: (p: {justSignedUp?: boolean}) => void
    }
    checkDeviceName: (devicename: string) => void
    checkUsername: (username: string) => void
    clearJustSignedUpEmail: () => void
    goBackAndClearErrors: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    requestAutoInvite: (username?: string) => void
    resetState: () => void
    setJustSignedUpEmail: (email: string) => void
  }
}

export const useSignupState = Z.createZustand<State>('signup', (set, get) => {
  const noErrors = () => {
    const {devicenameError, usernameError, signupError, usernameTaken} = get()
    return !(devicenameError || usernameError || signupError || usernameTaken)
  }

  const reallySignupOnNoErrors = () => {
    const f = async () => {
      if (!noErrors()) {
        logger.warn('Still has errors, bailing on really signing up')
        return
      }

      const {username, inviteCode, devicename} = get()
      if (!username || !devicename) {
        logger.warn('Missing data during signup phase', username, devicename)
        throw new Error('Missing data for signup')
      }

      try {
        get().dispatch.defer.onShowPermissionsPrompt?.({justSignedUp: true})

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
          waitingKey: S.waitingKeySignup,
        })
        set(s => {
          s.signupError = undefined
        })
        const ok = noErrors()
        if (ok) {
          get().dispatch.resetState?.()
        } else {
          navigateAppend('signupError')
        }
      } catch (_error) {
        if (_error instanceof RPCError) {
          const error = _error
          set(s => {
            s.signupError = error
          })
          navigateAppend('signupError')
          get().dispatch.defer.onShowPermissionsPrompt?.({justSignedUp: false})
        }
      }
    }
    ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    checkDeviceName: _devicename => {
      const devicename = _devicename.trim()
      set(s => {
        s.devicename = devicename
        s.devicenameError = devicename.length === 0 ? 'Device name must not be empty.' : ''
      })
      const f = async () => {
        if (!noErrors()) {
          return
        }
        try {
          await T.RPCGen.deviceCheckDeviceNameFormatRpcPromise({name: devicename}, S.waitingKeySignup)
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
      ignorePromise(f())
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
          await T.RPCGen.signupCheckUsernameAvailableRpcPromise({username}, S.waitingKeySignup)
          logger.info(`${username} success`)

          set(s => {
            s.usernameError = ''
            s.usernameTaken = ''
          })
          if (noErrors()) {
            navigateAppend('signupEnterDevicename')
          }
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn(`${username} error: ${error.message}`)
            const msg = error.code === T.RPCGen.StatusCode.scinputerror ? S.usernameHint : error.desc
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
      ignorePromise(f())
    },
    clearJustSignedUpEmail: () => {
      set(s => {
        s.justSignedUpEmail = ''
      })
    },
    defer: {
      onEditEmail: () => {
        throw new Error('onEditEmail not implemented')
      },
      onShowPermissionsPrompt: () => {
        throw new Error('onShowPermissionsPrompt not implemented')
      },
    },
    goBackAndClearErrors: () => {
      set(s => {
        s.devicenameError = ''
        s.signupError = undefined
        s.usernameError = ''
        s.usernameTaken = ''
      })
      navigateUp()
    },
    onEngineIncomingImpl: action => {
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
        if (useConfigState.getState().loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true})
        }
        try {
          const inviteCode = await T.RPCGen.signupGetInvitationCodeRpcPromise(undefined, S.waitingKeySignup)
          set(s => {
            s.inviteCode = inviteCode
          })
        } catch {
          set(s => {
            s.inviteCode = ''
          })
        }
        navigateUp()
        navigateAppend('signupEnterUsername')
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        justSignedUpEmail: '',
      }))
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
