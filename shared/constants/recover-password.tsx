import * as ProvisionConstants from './provision'
import * as ARConstants from './autoreset'
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
    cancel: () => void
    resetState: () => void
    submitDeviceSelect: (name: string) => void
    submitPaperKey: (key: string) => void
    submitPassword: (pw: string) => void
    submitResetPassword: (action: RPCTypes.ResetPromptResponse) => void
    startRecoverPassword: (p: {username: string; abortProvisioning?: boolean; replaceRoute?: boolean}) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const _cancel = () => {}
  const _submitDeviceSelect = () => {
    console.log('RecoverPassword: submit with no call')
  }
  const _submitResetPassword = () => {
    console.log('RecoverPassword: submit reset with no call')
  }
  const _submitPaperKey = () => {
    console.log('RecoverPassword: submit paperkey with no call')
  }

  const _submitPassword = () => {
    console.log('RecoverPassword: submit password with no call')
  }
  const dispatchOverrides = {
    cancel: _cancel,
    submitDeviceSelect: _submitDeviceSelect,
    submitPaperKey: _submitPaperKey,
    submitPassword: _submitPassword,
    submitResetPassword: _submitResetPassword,
  }

  const dispatch: State['dispatch'] = {
    ...dispatchOverrides,
    resetState: () => {
      // we do not cancel as we'll get logouts etc and don't want to lose our state
      set(s => ({
        ...s,
        ...initialStore,
        // ...dispatchOverrides,
      }))
    },
    startRecoverPassword: p => {
      set(s => {
        s.paperKeyError = ''
        s.username = p.username
      })

      const f = async () => {
        if (p.abortProvisioning) {
          ProvisionConstants.useState.getState().dispatch.cancel()
        }
        let hadError = false
        try {
          await RPCTypes.loginRecoverPassphraseRpcListener(
            {
              customResponseIncomingCallMap: {
                'keybase.1.loginUi.promptPassphraseRecovery': () => {},
                'keybase.1.loginUi.chooseDeviceToRecoverWith': (params, response) => {
                  const replaceRoute = !!p.replaceRoute
                  const devices = (params.devices || []).map(d => ProvisionConstants.rpcDeviceToDevice(d))
                  set(s => {
                    s.devices = devices
                    s.dispatch.cancel = () => {
                      set(s => {
                        s.dispatch.cancel = _cancel
                      })
                      response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      reduxDispatch(RouteTreeGen.createNavigateUp())
                    }
                    s.dispatch.submitDeviceSelect = (name: string) => {
                      set(s => {
                        s.dispatch.submitDeviceSelect = _submitDeviceSelect
                      })
                      const d = get().devices.find(d => d.name === name)
                      if (d) {
                        set(s => {
                          s.dispatch.cancel = _cancel
                        })
                        response.result(d.id)
                      } else {
                        get().dispatch.cancel()
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
                // This same RPC is called at the beginning and end of the 7-day wait by the service.
                'keybase.1.loginUi.promptResetAccount': (params, response) => {
                  if (params.prompt.t == RPCTypes.ResetPromptType.enterResetPw) {
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({
                        path: ['recoverPasswordPromptResetPassword'],
                      })
                    )
                    set(s => {
                      s.dispatch.submitResetPassword = action => {
                        set(s => {
                          s.dispatch.submitResetPassword = _submitResetPassword
                          s.dispatch.cancel = _cancel
                        })
                        response.result(action)
                        set(s => {
                          s.resetEmailSent = true
                        })
                        reduxDispatch(RouteTreeGen.createNavigateUp())
                      }
                      s.dispatch.cancel = () => {
                        set(s => {
                          s.dispatch.cancel = _cancel
                        })
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
                    set(s => {
                      s.paperKeyError = ''
                      if (params.pinentry.retryLabel) {
                        s.paperKeyError = params.pinentry.retryLabel
                      }
                      s.dispatch.cancel = () => {
                        set(s => {
                          s.dispatch.cancel = _cancel
                        })
                        response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                        get().dispatch.startRecoverPassword({
                          replaceRoute: true,
                          username: get().username,
                        })
                      }
                      s.dispatch.submitPaperKey = passphrase => {
                        set(s => {
                          s.dispatch.submitPaperKey = _submitPaperKey
                          s.dispatch.cancel = _cancel
                        })
                        response.result({passphrase, storeSecret: false})
                      }
                    })
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPaperKey'], replace: true})
                    )
                  } else {
                    set(s => {
                      s.passwordError = ''
                      if (params.pinentry.retryLabel) {
                        s.passwordError = params.pinentry.retryLabel
                      }
                      s.dispatch.cancel = () => {
                        set(s => {
                          s.dispatch.cancel = _cancel
                        })
                        response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                      }
                    })

                    if (!params.pinentry.retryLabel) {
                      set(s => {
                        s.dispatch.submitPassword = (passphrase: string) => {
                          set(s => {
                            s.dispatch.submitPassword = _submitPassword
                            s.dispatch.cancel = _cancel
                          })
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
        }
        logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
        if (!hadError) {
          reduxDispatch(RouteTreeGen.createClearModals())
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
