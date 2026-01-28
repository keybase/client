import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import {waitingKeySettingsGeneric} from '@/constants/strings'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import * as T from '@/constants/types'
import {navigateUp} from '@/constants/router2'
import {useLogoutState} from '@/stores/logout'

type Store = T.Immutable<{
  error: string
  hasPGPKeyOnServer?: boolean
  newPassword: string
  newPasswordConfirm: string
  newPasswordConfirmError: string
  newPasswordError: string
  randomPW?: boolean
  rememberPassword: boolean
}>

const initialStore: Store = {
  error: '',
  hasPGPKeyOnServer: undefined,
  newPassword: '',
  newPasswordConfirm: '',
  newPasswordConfirmError: '',
  newPasswordError: '',
  randomPW: undefined,
  rememberPassword: true,
}

export interface State extends Store {
  dispatch: {
    loadHasRandomPw: () => void
    loadPgpSettings: () => void
    loadRememberPassword: () => void
    notifyUsersPasswordChanged: (randomPW: boolean) => void
    resetState: 'default'
    setPassword: (password: string) => void
    setPasswordConfirm: (confirm: string) => void
    setRememberPassword: (remember: boolean) => void
    submitNewPassword: (thenLogOut?: boolean) => void
  }
}

export const usePWState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    loadHasRandomPw: () => {
      // Once loaded, do not issue this RPC again. This field can only go true ->
      // false (never the opposite way), and there are notifications set up when
      // this happens.
      const f = async () => {
        if (get().randomPW !== undefined) {
          return
        }
        try {
          const passphraseState = await T.RPCGen.userLoadPassphraseStateRpcPromise()
          const randomPW = passphraseState === T.RPCGen.PassphraseState.random
          set(s => {
            s.randomPW = randomPW
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn('Error loading hasRandomPW:', error.message)
          return
        }
      }
      ignorePromise(f())
    },
    loadPgpSettings: () => {
      const f = async () => {
        try {
          const {hasServerKeys} = await T.RPCGen.accountHasServerKeysRpcPromise()
          set(s => {
            s.hasPGPKeyOnServer = hasServerKeys
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          const msg = error.desc
          set(s => {
            s.error = msg
          })
        }
      }
      ignorePromise(f())
    },
    loadRememberPassword: () => {
      const f = async () => {
        const remember = await T.RPCGen.configGetRememberPassphraseRpcPromise()
        set(s => {
          s.rememberPassword = remember
        })
      }
      ignorePromise(f())
    },
    notifyUsersPasswordChanged: randomPW => {
      set(s => {
        s.randomPW = randomPW
      })
    },
    resetState: 'default',
    setPassword: password => {
      set(s => {
        s.error = ''
        s.newPassword = password
      })
    },
    setPasswordConfirm: confirm => {
      set(s => {
        s.error = ''
        s.newPasswordConfirm = confirm
      })
    },
    setRememberPassword: remember => {
      const f = async () => {
        await T.RPCGen.configSetRememberPassphraseRpcPromise({remember})
      }
      ignorePromise(f())
    },
    submitNewPassword: (thenLogout = false) => {
      const f = async () => {
        try {
          const {newPassword, newPasswordConfirm} = get()
          if (newPassword !== newPasswordConfirm) {
            set(s => {
              s.error = "Passwords don't match"
            })
            return
          }
          await T.RPCGen.accountPassphraseChangeRpcPromise(
            {
              force: true,
              oldPassphrase: '',
              passphrase: newPassword,
            },
            waitingKeySettingsGeneric
          )

          if (thenLogout) {
            useLogoutState.getState().dispatch.requestLogout()
          }
          navigateUp()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          const msg = error.desc
          set(s => {
            s.error = msg
          })
        }
      }
      ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
