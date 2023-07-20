import * as ProvisionConstants from './provision'
import * as ARConstants from './autoreset'
import * as RouterConstants from './router2'
import * as RPCTypes from './types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {useConfigState} from './config'
import * as Z from '../util/zustand'
import logger from '../logger'
import {RPCError} from '../util/errors'
import {type Device} from './provision'

export const waitingKey = 'recover-password:waiting'

type Store = {
  devices: Array<Device>
  error: string
  paperKeyError: string
  passwordError: string
  explainedDevice?: {
    name: string
    type: RPCTypes.DeviceType
  }
  resetEmailSent?: boolean
  username: string
}

const initialStore: Store = {
  devices: [],
  error: '',
  explainedDevice: undefined,
  paperKeyError: '',
  passwordError: '',
  resetEmailSent: false,
  username: '',
}

export type State = Store & {
  dispatch: {
    dynamic: {
      cancel?: () => void
      submitDeviceSelect?: (name: string) => void
      submitPaperKey?: (key: string) => void
      submitPassword?: (pw: string) => void
      submitResetPassword?: (action: RPCTypes.ResetPromptResponse) => void
    }
    resetState: () => void
    startRecoverPassword: (p: {username: string; abortProvisioning?: boolean; replaceRoute?: boolean}) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
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
          ProvisionConstants.useState.getState().dispatch.dynamic.cancel?.()
        }
        let hadError = false
        try {
          await RPCTypes.loginRecoverPassphraseRpcListener(
            {
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
                    const cancel = () => {
                      clear()
                      response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      reduxDispatch(RouteTreeGen.createNavigateUp())
                    }
                    s.devices = devices
                    s.dispatch.dynamic.cancel = cancel
                    s.dispatch.dynamic.submitDeviceSelect = (name: string) => {
                      clear()
                      const d = get().devices.find(d => d.name === name)
                      if (d) {
                        response.result(d.id)
                      } else {
                        cancel()
                      }
                    }
                  })
                  reduxDispatch(
                    RouteTreeGen.createNavigateAppend({
                      path: ['recoverPasswordDeviceSelector'],
                      replace: !!replaceRoute,
                    })
                  )
                },
                'keybase.1.loginUi.promptPassphraseRecovery': () => {},
                // This same RPC is called at the beginning and end of the 7-day wait by the service.
                'keybase.1.loginUi.promptResetAccount': (params, response) => {
                  if (params.prompt.t == RPCTypes.ResetPromptType.enterResetPw) {
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({
                        path: ['recoverPasswordPromptResetPassword'],
                      })
                    )
                    const clear = () => {
                      set(s => {
                        s.dispatch.dynamic.submitResetPassword = undefined
                        s.dispatch.dynamic.cancel = undefined
                      })
                    }
                    set(s => {
                      s.dispatch.dynamic.submitResetPassword = action => {
                        clear()
                        response.result(action)
                        set(s => {
                          s.resetEmailSent = true
                        })
                        reduxDispatch(RouteTreeGen.createNavigateUp())
                      }
                      s.dispatch.dynamic.cancel = () => {
                        clear()
                        response.result(RPCTypes.ResetPromptResponse.nothing)
                        reduxDispatch(RouteTreeGen.createNavigateUp())
                      }
                    })
                  } else {
                    const {startAccountReset} = ARConstants.useState.getState().dispatch
                    startAccountReset(true, '')
                    response.result(RPCTypes.ResetPromptResponse.nothing)
                  }
                },
                'keybase.1.secretUi.getPassphrase': (params, response) => {
                  if (params.pinentry.type === RPCTypes.PassphraseType.paperKey) {
                    const clear = () => {
                      set(s => {
                        s.dispatch.dynamic.submitPaperKey = undefined
                        s.dispatch.dynamic.cancel = undefined
                      })
                    }
                    set(s => {
                      s.paperKeyError = params.pinentry.retryLabel
                      s.dispatch.dynamic.cancel = () => {
                        clear()
                        response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                        get().dispatch.startRecoverPassword({
                          replaceRoute: true,
                          username: get().username,
                        })
                      }
                      s.dispatch.dynamic.submitPaperKey = passphrase => {
                        clear()
                        response.result({passphrase, storeSecret: false})
                      }
                    })
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPaperKey'], replace: true})
                    )
                  } else {
                    const clear = () => {
                      set(s => {
                        s.dispatch.dynamic.submitPassword = undefined
                        s.dispatch.dynamic.cancel = undefined
                      })
                    }
                    set(s => {
                      s.passwordError = params.pinentry.retryLabel
                      s.dispatch.dynamic.cancel = () => {
                        clear()
                        response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      }
                    })
                    if (!params.pinentry.retryLabel) {
                      set(s => {
                        s.dispatch.dynamic.submitPassword = (passphrase: string) => {
                          clear()
                          response.result({passphrase, storeSecret: true})
                        }
                      })
                      // TODO maybe wait for loggedIn, for now the service promises to send this after login.
                      reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['recoverPasswordSetPassword']}))
                    }
                  }
                },
              },
              incomingCallMap: {
                'keybase.1.loginUi.explainDeviceRecovery': params => {
                  set(s => {
                    s.explainedDevice = {name: params.name, type: params.kind}
                  })
                  reduxDispatch(
                    RouteTreeGen.createNavigateAppend({
                      path: ['recoverPasswordExplainDevice'],
                      replace: true,
                    })
                  )
                },
              },
              params: {username: p.username},
              waitingKey,
            },
            Z.dummyListenerApi
          )
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
              (error.code === RPCTypes.StatusCode.sccanceled ||
                error.code === RPCTypes.StatusCode.scinputcanceled)
            )
          ) {
            const msg = error.message
            set(s => {
              s.error = msg
            })
            reduxDispatch(
              RouteTreeGen.createNavigateAppend({
                path: [
                  useConfigState.getState().loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError',
                ],
                replace: true,
              })
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
          RouterConstants.useState.getState().dispatch.clearModals()
        }
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
