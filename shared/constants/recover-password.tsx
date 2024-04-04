import * as C from '.'
import * as ProvisionConstants from './provision'
import * as T from './types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {type Device} from './provision'

export const waitingKey = 'recover-password:waiting'

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

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
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
          C.useProvisionState.getState().dispatch.dynamic.cancel?.()
        }
        let hadError = false
        try {
          await T.RPCGen.loginRecoverPassphraseRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.loginUi.chooseDeviceToRecoverWith': (params, response) => {
                const replaceRoute = !!p.replaceRoute
                const devices = (params.devices || []).map(d => ProvisionConstants.rpcDeviceToDevice(d))
                set(s => {
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.cancel = undefined
                      s.dispatch.dynamic.submitDeviceSelect = undefined
                    })
                  }
                  const cancel = C.wrapErrors(() => {
                    clear()
                    response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                    C.useRouterState.getState().dispatch.navigateUp()
                  })
                  s.devices = devices
                  s.dispatch.dynamic.cancel = cancel
                  s.dispatch.dynamic.submitDeviceSelect = C.wrapErrors((name: string) => {
                    clear()
                    const d = get().devices.find(d => d.name === name)
                    if (d) {
                      response.result(d.id)
                    } else {
                      cancel()
                    }
                  })
                })
                C.useRouterState
                  .getState()
                  .dispatch.navigateAppend('recoverPasswordDeviceSelector', !!replaceRoute)
              },
              'keybase.1.loginUi.promptPassphraseRecovery': () => {},
              // This same RPC is called at the beginning and end of the 7-day wait by the service.
              'keybase.1.loginUi.promptResetAccount': (params, response) => {
                if (params.prompt.t === T.RPCGen.ResetPromptType.enterResetPw) {
                  C.useRouterState.getState().dispatch.navigateAppend('recoverPasswordPromptResetPassword')
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.submitResetPassword = undefined
                      s.dispatch.dynamic.cancel = undefined
                    })
                  }
                  set(s => {
                    s.dispatch.dynamic.submitResetPassword = C.wrapErrors(
                      (action: T.RPCGen.ResetPromptResponse) => {
                        clear()
                        response.result(action)
                        set(s => {
                          s.resetEmailSent = true
                        })
                        C.useRouterState.getState().dispatch.navigateUp()
                      }
                    )
                    s.dispatch.dynamic.cancel = C.wrapErrors(() => {
                      clear()
                      response.result(T.RPCGen.ResetPromptResponse.nothing)
                      C.useRouterState.getState().dispatch.navigateUp()
                    })
                  })
                } else {
                  const {startAccountReset} = C.useAutoResetState.getState().dispatch
                  startAccountReset(true, '')
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
                    s.dispatch.dynamic.cancel = C.wrapErrors(() => {
                      clear()
                      response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      get().dispatch.startRecoverPassword({
                        replaceRoute: true,
                        username: get().username,
                      })
                    })
                    s.dispatch.dynamic.submitPaperKey = C.wrapErrors((passphrase: string) => {
                      clear()
                      response.result({passphrase, storeSecret: false})
                    })
                  })
                  C.useRouterState.getState().dispatch.navigateAppend('recoverPasswordPaperKey', true)
                } else {
                  const clear = () => {
                    set(s => {
                      s.dispatch.dynamic.submitPassword = undefined
                      s.dispatch.dynamic.cancel = undefined
                    })
                  }
                  set(s => {
                    s.passwordError = params.pinentry.retryLabel
                    s.dispatch.dynamic.cancel = C.wrapErrors(() => {
                      clear()
                      response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                    })
                  })
                  if (!params.pinentry.retryLabel) {
                    set(s => {
                      s.dispatch.dynamic.submitPassword = C.wrapErrors((passphrase: string) => {
                        clear()
                        response.result({passphrase, storeSecret: true})
                      })
                    })
                    // TODO maybe wait for loggedIn, for now the service promises to send this after login.
                    C.useRouterState.getState().dispatch.navigateAppend('recoverPasswordSetPassword')
                  }
                }
              },
            },
            incomingCallMap: {
              'keybase.1.loginUi.explainDeviceRecovery': params => {
                set(s => {
                  s.explainedDevice = {name: params.name, type: params.kind}
                })
                C.useRouterState.getState().dispatch.navigateAppend('recoverPasswordExplainDevice', true)
              },
            },
            params: {username: p.username},
            waitingKey,
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
            C.useRouterState
              .getState()
              .dispatch.navigateAppend(
                C.useConfigState.getState().loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError',
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
          C.useRouterState.getState().dispatch.clearModals()
        }
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
