import * as Z from '../util/zustand'
import * as RouteTreeGen from '../actions/route-tree-gen'
import logger from '../logger'
import {RPCError} from '../util/errors'
import * as RPCTypes from './types/rpc-gen'
import {useLogoutState} from './config'

const settingsWaitingKey = 'settings:generic'
type Store = {
  error: string
  hasPGPKeyOnServer?: boolean
  newPassword: string
  newPasswordConfirm: string
  newPasswordConfirmError: string
  newPasswordError: string
  randomPW?: boolean
  rememberPassword: boolean
}

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

export type State = Store & {
  dispatch: {
    loadHasRandomPw: () => void
    loadRememberPassword: () => void
    notifyUsersPasswordChanged: (randomPW: boolean) => void
    setRememberPassword: (remember: boolean) => void
    setNewPassword: (thenLogOut?: boolean) => void

    resetState: 'default'
  }
}

// const passwordActions: Container.ActionHandler<Actions, Types.State> = {
//   [SettingsGen.onChangeRememberPassword]: (draftState, action) => {
//     draftState.password.rememberPassword = action.payload.remember
//   },
//   [SettingsGen.onChangeNewPassword]: (draftState, action) => {
//     const {password} = draftState
//     password.error = undefined
//     password.newPassword = action.payload.password
//   },
//   [SettingsGen.onChangeNewPasswordConfirm]: (draftState, action) => {
//     const {password} = draftState
//     password.error = undefined
//     password.newPasswordConfirm = action.payload.password
//   },
//   [SettingsGen.onUpdatedPGPSettings]: (draftState, action) => {
//     draftState.password.hasPGPKeyOnServer = action.payload.hasKeys
//   },
// }
export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
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
          const passphraseState = await RPCTypes.userLoadPassphraseStateRpcPromise()
          const randomPW = passphraseState === RPCTypes.PassphraseState.random
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
      Z.ignorePromise(f())
    },
    loadRememberPassword: () => {
      const f = async () => {
        const remember = await RPCTypes.configGetRememberPassphraseRpcPromise()
        set(s => {
          s.rememberPassword = remember
        })
      }
      Z.ignorePromise(f())
    },
    notifyUsersPasswordChanged: randomPW => {
      set(s => {
        s.randomPW = randomPW
      })
    },
    resetState: 'default',
    setNewPassword: (thenLogout = false) => {
      const f = async () => {
        try {
          const {newPassword, newPasswordConfirm} = get()
          if (newPassword !== newPasswordConfirm) {
            set(s => {
              s.error = "Passwords don't match"
            })
            return
          }
          await RPCTypes.accountPassphraseChangeRpcPromise(
            {
              force: true,
              oldPassphrase: '',
              passphrase: newPassword,
            },
            settingsWaitingKey
          )

          if (thenLogout) {
            useLogoutState.getState().dispatch.requestLogout()
          }
          reduxDispatch(RouteTreeGen.createNavigateUp())
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
      Z.ignorePromise(f())
    },
    setRememberPassword: remember => {
      const f = async () => {
        await RPCTypes.configSetRememberPassphraseRpcPromise({remember})
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
