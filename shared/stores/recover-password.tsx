import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {type Device} from '@/stores/provision'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {clearModals, navigateAppend, navigateUp} from '@/constants/router2'
import {useConfigState} from '@/stores/config'

type Store = T.Immutable<{
  devices: Array<Device>
  error: string
  paperKeyError: string
  passwordError: string
  explainedDevice?: {
    name: string
    type: T.RPCGen.DeviceType
  }
  resetEmailSent?: boolean
  username: string
}>

const initialStore: Store = {
  devices: [],
  error: '',
  explainedDevice: undefined,
  paperKeyError: '',
  passwordError: '',
  resetEmailSent: false,
  username: '',
}

export interface State extends Store {
  dispatch: {
    defer: {
      onProvisionCancel?: (ignoreWarning?: boolean) => void
      onStartAccountReset?: (skipPassword: boolean, username: string) => void
    }
    dynamic: {
      cancel?: () => void
      submitDeviceSelect?: (name: string) => void
      submitPaperKey?: (key: string) => void
      submitPassword?: (pw: string) => void
      submitResetPassword?: (action: T.RPCGen.ResetPromptResponse) => void
    }
    resetState: () => void
    startRecoverPassword: (p: {username: string; abortProvisioning?: boolean; replaceRoute?: boolean}) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    defer: {
      onProvisionCancel: () => {
        throw new Error('onProvisionCancel not implemented')
      },
      onStartAccountReset: () => {
        throw new Error('onStartAccountReset not implemented')
      },
    },
    dynamic: {
      cancel: undefined,
      submitDeviceSelect: undefined,
      submitPaperKey: undefined,
      submitPassword: undefined,
      submitResetPassword: undefined,
    },
    resetState: () => {
      // we do not cancel as we'll get logouts etc and don't want to lose our state
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: {
          ...s.dispatch,
          dynamic: {},
        },
      }))
    },
    startRecoverPassword: p => {
      set(s => {
        s.paperKeyError = ''
        s.username = p.username
      })

      const f = async () => {
        if (p.abortProvisioning) {
          get().dispatch.defer.onProvisionCancel?.()
        }
        let hadError = false
        try {
          await T.RPCGen.loginRecoverPassphraseRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.loginUi.chooseDeviceToRecoverWith': (params, response) => {
                const replaceRoute = !!p.replaceRoute
                const devices = (params.devices || []).map(d => rpcDeviceToDevice(d))
                set(s => {
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.cancel = undefined
                      s.dispatch.dynamic.submitDeviceSelect = undefined
                    })
                  }
                  const cancel = wrapErrors(() => {
                    clear()
                    response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                    navigateUp()
                  })
                  s.devices = devices
                  s.dispatch.dynamic.cancel = cancel
                  s.dispatch.dynamic.submitDeviceSelect = wrapErrors((name: string) => {
                    clear()
                    const d = get().devices.find(d => d.name === name)
                    if (d) {
                      response.result(d.id)
                    } else {
                      cancel()
                    }
                  })
                })
                navigateAppend('recoverPasswordDeviceSelector', !!replaceRoute)
              },
              'keybase.1.loginUi.promptPassphraseRecovery': () => {},
              // This same RPC is called at the beginning and end of the 7-day wait by the service.
              'keybase.1.loginUi.promptResetAccount': (params, response) => {
                if (params.prompt.t === T.RPCGen.ResetPromptType.enterResetPw) {
                  navigateAppend('recoverPasswordPromptResetPassword')
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.submitResetPassword = undefined
                      s.dispatch.dynamic.cancel = undefined
                    })
                  }
                  set(s => {
                    s.dispatch.dynamic.submitResetPassword = wrapErrors(
                      (action: T.RPCGen.ResetPromptResponse) => {
                        clear()
                        response.result(action)
                        set(s => {
                          s.resetEmailSent = true
                        })
                        navigateUp()
                      }
                    )
                    s.dispatch.dynamic.cancel = wrapErrors(() => {
                      clear()
                      response.result(T.RPCGen.ResetPromptResponse.nothing)
                      navigateUp()
                    })
                  })
                } else {
                  get().dispatch.defer.onStartAccountReset?.(true, '')
                  response.result(T.RPCGen.ResetPromptResponse.nothing)
                }
              },
              'keybase.1.secretUi.getPassphrase': (params, response) => {
                if (params.pinentry.type === T.RPCGen.PassphraseType.paperKey) {
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.submitPaperKey = undefined
                      s.dispatch.dynamic.cancel = undefined
                    })
                  }
                  set(s => {
                    s.paperKeyError = params.pinentry.retryLabel
                    s.dispatch.dynamic.cancel = wrapErrors(() => {
                      clear()
                      response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      get().dispatch.startRecoverPassword({
                        replaceRoute: true,
                        username: get().username,
                      })
                    })
                    s.dispatch.dynamic.submitPaperKey = wrapErrors((passphrase: string) => {
                      clear()
                      response.result({passphrase, storeSecret: false})
                    })
                  })
                  navigateAppend('recoverPasswordPaperKey', true)
                } else {
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.submitPassword = undefined
                      s.dispatch.dynamic.cancel = undefined
                    })
                  }
                  set(s => {
                    s.passwordError = params.pinentry.retryLabel
                    s.dispatch.dynamic.cancel = wrapErrors(() => {
                      clear()
                      response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                    })
                  })
                  if (!params.pinentry.retryLabel) {
                    set(s => {
                      s.dispatch.dynamic.submitPassword = wrapErrors((passphrase: string) => {
                        clear()
                        response.result({passphrase, storeSecret: true})
                      })
                    })
                    // TODO maybe wait for loggedIn, for now the service promises to send this after login.
                    navigateAppend('recoverPasswordSetPassword')
                  }
                }
              },
            },
            incomingCallMap: {
              'keybase.1.loginUi.explainDeviceRecovery': params => {
                set(s => {
                  s.explainedDevice = {name: params.name, type: params.kind}
                })
                navigateAppend('recoverPasswordExplainDevice', true)
              },
            },
            params: {username: p.username},
            waitingKey: waitingKeyRecoverPassword,
          })
          console.log('Recovered account')
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          hadError = true
          logger.warn('RPC returned error: ' + error.message)
          if (
            !(
              error instanceof RPCError &&
              (error.code === T.RPCGen.StatusCode.sccanceled ||
                error.code === T.RPCGen.StatusCode.scinputcanceled)
            )
          ) {
            const msg = error.message
            set(s => {
              s.error = msg
            })
            navigateAppend(
              useConfigState.getState().loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError',
              true
            )
          }
        } finally {
          set(s => {
            s.dispatch.dynamic.submitPassword = undefined
            s.dispatch.dynamic.cancel = undefined
            s.dispatch.dynamic.submitPaperKey = undefined
            s.dispatch.dynamic.submitResetPassword = undefined
            s.dispatch.dynamic.submitDeviceSelect = undefined
          })
        }
        logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
        if (!hadError) {
          clearModals()
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
