import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {clearModals, navigateAppend, navigateUp} from '@/constants/router'
import {useConfigState} from '@/stores/config'

type Store = T.Immutable<{
  resetEmailSent?: boolean
}>

const initialStore: Store = {
  resetEmailSent: false,
}

export type State = Store & {
  dispatch: {
    defer: {
      onProvisionCancel?: (ignoreWarning?: boolean) => void
      onStartAccountReset?: (skipPassword: boolean, username: string) => void
    }
    dynamic: {
      cancel?: () => void
      submitDeviceSelect?: (deviceID?: T.Devices.DeviceID) => void
      submitPaperKey?: (key: string) => void
      submitPassword?: (pw: string) => void
      submitResetPassword?: (action: T.RPCGen.ResetPromptResponse) => void
    }
    resetState: () => void
    startRecoverPassword: (p: {username: string; abortProvisioning?: boolean; replaceRoute?: boolean}) => void
  }
}

export const useState = Z.createZustand<State>('recover-password', (set, get) => {
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
                  s.dispatch.dynamic.cancel = cancel
                  s.dispatch.dynamic.submitDeviceSelect = wrapErrors((deviceID?: T.Devices.DeviceID) => {
                    clear()
                    if (deviceID) {
                      response.result(deviceID)
                    } else {
                      cancel()
                    }
                  })
                })
                navigateAppend({name: 'recoverPasswordDeviceSelector', params: {devices}}, replaceRoute)
              },
              'keybase.1.loginUi.promptPassphraseRecovery': () => {},
              // This same RPC is called at the beginning and end of the 7-day wait by the service.
              'keybase.1.loginUi.promptResetAccount': (params, response) => {
                if (params.prompt.t === T.RPCGen.ResetPromptType.enterResetPw) {
                  navigateAppend({name: 'recoverPasswordPromptResetPassword', params: {username: p.username}})
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
                  get().dispatch.defer.onStartAccountReset?.(true, p.username)
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
                    s.dispatch.dynamic.cancel = wrapErrors(() => {
                      clear()
                      response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      get().dispatch.startRecoverPassword({
                        replaceRoute: true,
                        username: p.username,
                      })
                    })
                    s.dispatch.dynamic.submitPaperKey = wrapErrors((passphrase: string) => {
                      clear()
                      response.result({passphrase, storeSecret: false})
                    })
                  })
                  navigateAppend(
                    {
                      name: 'recoverPasswordPaperKey',
                      params: {error: params.pinentry.retryLabel || undefined},
                    },
                    true
                  )
                } else {
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.submitPassword = undefined
                      s.dispatch.dynamic.cancel = undefined
                    })
                  }
                  set(s => {
                    s.dispatch.dynamic.cancel = wrapErrors(() => {
                      clear()
                      response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                    })
                    s.dispatch.dynamic.submitPassword = wrapErrors((passphrase: string) => {
                      clear()
                      response.result({passphrase, storeSecret: true})
                    })
                  })
                  if (!params.pinentry.retryLabel) {
                    // TODO maybe wait for loggedIn, for now the service promises to send this after login.
                    navigateAppend({name: 'recoverPasswordSetPassword', params: {error: undefined}})
                  } else {
                    navigateAppend(
                      {
                        name: 'recoverPasswordSetPassword',
                        params: {error: params.pinentry.retryLabel},
                      },
                      true
                    )
                  }
                }
              },
            },
            incomingCallMap: {
              'keybase.1.loginUi.explainDeviceRecovery': params => {
                navigateAppend(
                  {
                    name: 'recoverPasswordExplainDevice',
                    params: {deviceName: params.name, deviceType: params.kind, username: p.username},
                  },
                  true
                )
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
            navigateAppend(
              {
                name: useConfigState.getState().loggedIn
                  ? 'recoverPasswordErrorModal'
                  : 'recoverPasswordError',
                params: {error: msg},
              },
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
