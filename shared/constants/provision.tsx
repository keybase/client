/* eslint-disable sort-keys */
// TODO remove ^
import * as DeviceTypes from './types/devices'
import * as WaitingConstants from './waiting'
import * as ConfigConstants from './config'
import * as RPCTypes from './types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Z from '../util/zustand'
import {isMobile} from './platform'
import type * as Types from './types/provision'
import type {CommonResponseHandler /*, RPCError*/} from '../engine/types'
import isEqual from 'lodash/isEqual'

export const waitingKey = 'provision:waiting'
export const forgotUsernameWaitingKey = 'provision:forgotUsername'

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
// const errorCausedByUsCanceling = (e?: RPCError) =>
//   (e ? e.desc : undefined) === 'Input canceled' || (e ? e.desc : undefined) === 'kex canceled by caller'
const cancelOnCallback = (_: any, response: CommonResponseHandler) => {
  console.log('aaa cancelOnCallback ', _)
  response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
}

export const makeDevice = (): Types.Device => ({
  deviceNumberOfType: 0,
  id: DeviceTypes.stringToDeviceID(''),
  name: '',
  type: 'mobile',
})

export const makeState = (): Types.State => ({
  forgotUsernameResult: '',
})

export const rpcDeviceToDevice = (d: RPCTypes.Device) => {
  const type = d.type
  switch (type) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return {
        deviceNumberOfType: d.deviceNumberOfType,
        id: DeviceTypes.stringToDeviceID(d.deviceID),
        name: d.name,
        type: type,
      }
    default:
      throw new Error('Invalid device type detected: ' + type)
  }
}

export const cleanDeviceName = (name: string) =>
  // map 'smart apostrophes' to ASCII (typewriter apostrophe)
  name.replace(/[\u2018\u2019\u0060\u00B4]/g, "'")

// Copied from go/libkb/checkers.go
export const goodDeviceRE = /^[a-zA-Z0-9][ _'a-zA-Z0-9+‘’—–-]*$/
// eslint-disable-next-line
export const badDeviceRE = /  |[ '_-]$|['_-][ ]?['_-]/
export const normalizeDeviceRE = /[^a-zA-Z0-9]/

export const deviceNameInstructions =
  'Your device name must have 3-64 characters and not end with punctuation.'

export const badDeviceChars = /[^a-zA-Z0-9-_' ]/g

type Step =
  | {type: 'username'}
  | {type: 'passphrase'}
  | {type: 'deviceName'}
  | {type: 'chooseDevice'; devices: Array<Types.Device>}
type ExtractType<T> = T extends {type: infer U} ? U : never
type StepTypes = ExtractType<Step>
// type Step = {type: 'username' | 'password'

type Store = {
  codePageOtherDevice: Types.Device
  devices: Array<Types.Device>
  gpgImportError?: string
  error: string
  // phase: 'stopped' | 'started'
  username: string
  // username: string
  // we allow you to backtrack so we stash set values, if you submit anything in the past we'll clear future values
  // and auto submit previous values
  // inputValues: Array<InputValues>
  autoSubmit: Array<Step>
  provisionStep: number
  callbackMap: Map<StepTypes, () => void>
  passphrase: string
  existingDevices: Array<string>
  deviceName: string
  // Code from the daemon
  codePageIncomingTextCode: string
  // Code from other device
  // codePageOutgoingTextCode: string
}
const initialStore: Store = {
  codePageOtherDevice: makeDevice(),
  devices: [],
  // shared by all errors, we only ever want one error
  error: '',
  gpgImportError: undefined,
  // phase: 'stopped',
  username: '',
  // inputValues: [],
  autoSubmit: [],
  provisionStep: 0,
  callbackMap: new Map(),
  passphrase: '',
  existingDevices: [],
  deviceName: '',
  // Code from the daemon
  codePageIncomingTextCode: '',
  // Code from other device
  // codePageOutgoingTextCode: '',
}

type State = Store & {
  dispatch: {
    startProvision: (name?: string, fromReset?: boolean) => void
    // addNewDevice: (otherDeviceType: 'desktop' | 'mobile') => void
    resetState: () => void
    // maybe remove
    // showDeviceListPage: (devices: Array<Types.Device>) => void
    submitDeviceSelect: (name: string) => void

    // new stuff
    continueProvisioning: (from: StepTypes) => void
    restartProvisioning: () => void
    cancel: () => void
    setUsername: (username: string) => void
    setPassphrase: (passphrase: string) => void
    setDeviceName: (name: string) => void
    submitTextCode: (code: string) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const _cancel = () => {
    console.log('Provision: cancel called while not overloaded')
  }

  // TODO
  // maybe keep a cancel around which is called so we can restart

  // add a new value to submit and clear things behind
  const _updateAutoSubmit = (step: Store['autoSubmit'][0]) => {
    set(s => {
      const idx = s.autoSubmit.findIndex(a => a.type === step.type)
      if (idx !== -1) {
        s.autoSubmit.splice(idx)
      }
      s.autoSubmit.push(step)
    })
  }

  const _setUsername = (username: string, restart: boolean = true) => {
    set(s => {
      s.username = username
      s.autoSubmit = [{type: 'username'}]
      s.error = ''
    })
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  }
  const _setPassphrase = (passphrase: string, restart: boolean = true) => {
    set(s => {
      s.passphrase = passphrase
      s.error = ''
    })
    _updateAutoSubmit({type: 'passphrase'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  }

  const _setDeviceName = (name: string, restart: boolean = true) => {
    set(s => {
      s.deviceName = name
      s.error = ''
    })
    _updateAutoSubmit({type: 'deviceName'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  }

  const _submitDeviceSelect = (name: string, restart: boolean = true) => {
    const devices = get().devices
    const selectedDevice = devices.find(d => d.name === name)
    if (!selectedDevice) {
      throw new Error('Selected a non existant device?')
    }
    set(s => {
      s.codePageOtherDevice = selectedDevice
      s.error = ''
    })
    _updateAutoSubmit({type: 'chooseDevice', devices})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  }

  const _submitTextCode = (_code: string) => {
    console.log('Provision, unwatched submitTextCode called')
    get().dispatch.restartProvisioning()
  }

  const dispatch: State['dispatch'] = {
    startProvision: (name = '', fromReset = false) => {
      ConfigConstants.useConfigState.getState().dispatch.loginError()
      ConfigConstants.useConfigState.getState().dispatch.resetRevokedSelf()

      set(s => {
        s.username = name
      })
      const f = async () => {
        // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
        if (ConfigConstants.useConfigState.getState().loggedIn) {
          await RPCTypes.loginLogoutRpcPromise(
            {force: false, keepSecrets: true},
            ConfigConstants.loginAsOtherUserWaitingKey
          )
        }
        reduxDispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {fromReset}, selected: 'username'}],
          })
        )
      }
      Z.ignorePromise(f())
    },
    cancel: _cancel,
    resetState: () => {
      WaitingConstants.useWaitingState.getState().dispatch.clear(waitingKey)
      // if (get().phase !== 'stopped') {
      get().dispatch.cancel()
      // }
      set(s => ({
        ...s,
        ...initialStore,
        cancel: _cancel,
      }))
    },
    // showDeviceListPage: devices => {
    //   set(s => {
    //     s.devices = devices
    //     s.error = ''
    //   })
    //   reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['selectOtherDevice'], replace: true}))
    // },
    setUsername: _setUsername,
    setPassphrase: _setPassphrase,
    setDeviceName: _setDeviceName,
    continueProvisioning: _from => {
      // const autoIndex = get().autoSubmit.findIndex(a => a.type === from)
      //       if (autoIndex === ) { }
      // const cb = get().callbackMap.get(from)
      // if (cb) {
      //   console.log('Provision continue from', from)
      //   cb()
      // } else {
      //   console.log('Provision restart from', from)
      //   // adjust back the autosubmit
      //   set(s => {
      //     s.autoSubmit = s.autoSubmit.slice(0, autoIndex + 1)
      //   })
      //   // restart and auto submit
      //   get().dispatch.restartProvisioning()
      // }
    },
    restartProvisioning: () => {
      get().dispatch.cancel()

      const {username} = get()
      if (!username) {
        return
      }

      let cancelled = false
      // TODO pull out more helpers to manage cancel etc
      //
      // set(s => {
      //   // s.phase = 'started'
      //   s.dispatch.cancel = () => {
      //     cancelled = true
      //   }
      // })
      console.log('Provision: startProvisioning starting with auto submit', get().autoSubmit)
      const f = async () => {
        const isCanceled = (response: CommonResponseHandler) => {
          if (cancelled) {
            cancelOnCallback(undefined, response)
            return true
          }
          return false
        }

        // freeze the autosubmit for this call so changes don't affect us
        const {autoSubmit} = get()
        let submitStep = 0
        try {
          await RPCTypes.loginLoginRpcListener(
            {
              customResponseIncomingCallMap: {
                'keybase.1.gpgUi.selectKey': cancelOnCallback,
                'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
                'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
                  if (isCanceled(response)) return
                  const {phrase, previousErr} = params
                  // errored before
                  if (!previousErr) {
                    ++submitStep
                  }
                  set(s => {
                    s.error = previousErr
                    s.codePageIncomingTextCode = phrase
                    s.dispatch.cancel = () => {
                      cancelled = true
                      cancelOnCallback(undefined, response)
                      set(s => {
                        s.dispatch.cancel = _cancel
                      })
                    }
                    s.dispatch.submitTextCode = (code: string) => {
                      set(s => {
                        s.error = ''
                        s.dispatch.submitTextCode = _submitTextCode
                        s.dispatch.cancel = _cancel
                      })
                      const good = code.replace(/\W+/g, ' ').trim()
                      response.result({phrase: good, secret: null as any})
                    }
                  })
                  // no autosubmit
                  reduxDispatch(
                    RouteTreeGen.createNavigateAppend({
                      path: ['codePage'],
                      // replace: true,
                    })
                  )
                },
                'keybase.1.provisionUi.PromptNewDeviceName': (params, response) => {
                  if (isCanceled(response)) return
                  const {errorMessage, existingDevices} = params
                  // errored before
                  if (!errorMessage) {
                    ++submitStep
                  }
                  set(s => {
                    s.error = errorMessage
                    s.existingDevices = existingDevices ?? []
                    s.dispatch.cancel = () => {
                      cancelled = true
                      cancelOnCallback(undefined, response)
                      set(s => {
                        s.dispatch.cancel = _cancel
                      })
                    }
                    s.dispatch.setDeviceName = (name: string) => {
                      _setDeviceName(name, false)
                      set(s => {
                        s.dispatch.setDeviceName = _setDeviceName
                        s.dispatch.cancel = _cancel
                      })
                      response.result(name)
                    }
                  })

                  const auto = autoSubmit[submitStep]
                  if (auto?.type === 'deviceName') {
                    console.log('Provision: auto submit device name')
                    get().dispatch.setDeviceName(get().deviceName)
                  } else {
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({
                        path: ['setPublicName'],
                        // replace: true,
                      })
                    )
                  }
                },
                'keybase.1.provisionUi.chooseDevice': (params, response) => {
                  if (isCanceled(response)) return
                  const {devices: _devices} = params
                  const devices = _devices?.map(d => rpcDeviceToDevice(d)) ?? []
                  ++submitStep
                  set(s => {
                    s.error = ''
                    s.devices = devices
                    s.dispatch.cancel = () => {
                      cancelled = true
                      cancelOnCallback(undefined, response)
                      set(s => {
                        s.dispatch.cancel = _cancel
                      })
                    }
                    s.dispatch.submitDeviceSelect = (device: string) => {
                      _submitDeviceSelect(device, false)
                      const id = get().codePageOtherDevice.id
                      set(s => {
                        s.dispatch.submitDeviceSelect = _submitDeviceSelect
                        s.dispatch.cancel = _cancel
                      })
                      response.result(id)
                    }
                  })

                  const auto = autoSubmit[submitStep]
                  if (auto?.type === 'chooseDevice' && isEqual(auto.devices, devices)) {
                    console.log('Provision: auto submit passphrase')
                    get().dispatch.submitDeviceSelect(get().codePageOtherDevice.name)
                  } else {
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({path: ['selectOtherDevice'] /*replace: true*/})
                    )
                  }

                  /*this.chooseDeviceHandler(params, response),*/
                },
                'keybase.1.provisionUi.chooseGPGMethod': (_params, response) => {
                  if (isCanceled(response)) return
                  /*this.chooseGPGMethodHandler(params, response),*/
                },
                'keybase.1.provisionUi.switchToGPGSignOK': (_params, response) => {
                  if (isCanceled(response)) return
                  /*this.switchToGPGSignOKHandler(params, response),*/
                },
                'keybase.1.secretUi.getPassphrase': (params, response) => {
                  if (isCanceled(response)) return
                  const {pinentry} = params
                  const {retryLabel, type} = pinentry
                  // errored before
                  if (!retryLabel) {
                    ++submitStep
                  }

                  // Service asking us again due to an error?
                  set(s => {
                    s.dispatch.cancel = () => {
                      cancelled = true
                      cancelOnCallback(undefined, response)
                      set(s => {
                        s.dispatch.cancel = _cancel
                      })
                    }
                    s.error =
                      retryLabel === ConfigConstants.invalidPasswordErrorString
                        ? 'Incorrect password.'
                        : retryLabel
                    s.dispatch.setPassphrase = (passphrase: string) => {
                      _setPassphrase(passphrase, false)
                      set(s => {
                        s.dispatch.setPassphrase = _setPassphrase
                        s.dispatch.cancel = _cancel
                      })
                      response.result({passphrase, storeSecret: false})
                    }
                  })

                  const auto = autoSubmit[submitStep]
                  if (auto?.type === 'passphrase') {
                    console.log('Provision: auto submit passphrase')
                    get().dispatch.setPassphrase(get().passphrase)
                  } else {
                    switch (type) {
                      case RPCTypes.PassphraseType.passPhrase:
                        reduxDispatch(
                          RouteTreeGen.createNavigateAppend({path: ['password'] /*replace: true*/})
                        )
                        break
                      case RPCTypes.PassphraseType.paperKey:
                        reduxDispatch(
                          RouteTreeGen.createNavigateAppend({path: ['paperkey'] /*replace: true*/})
                        )
                        break
                      default:
                        throw new Error('Got confused about password entry. Please send a log to us!')
                    }
                  }
                },
              },
              incomingCallMap: {
                'keybase.1.loginUi.displayPrimaryPaperKey': () => {},
                'keybase.1.provisionUi.DisplaySecretExchanged': () => {
                  WaitingConstants.useWaitingState.getState().dispatch.increment(waitingKey)
                },
                'keybase.1.provisionUi.ProvisioneeSuccess': () => {},
                'keybase.1.provisionUi.ProvisionerSuccess': () => {},
              },
              params: {
                clientType: RPCTypes.ClientType.guiMain,
                deviceName: '',
                deviceType: isMobile ? 'mobile' : 'desktop',
                doUserSwitch: true,
                paperKey: '',
                username,
              },
              waitingKey,
            },
            Z.dummyListenerApi
          )
          // success
          // TODO other stuff
          get().dispatch.resetState()
        } catch {}
      }
      Z.ignorePromise(f())
    },
    submitDeviceSelect: _submitDeviceSelect,
    submitTextCode: _submitTextCode,
  }

  // TODO internal
  // [ProvisionGen.switchToGPGSignOnly]: (draftState, action) => {
  //   draftState.gpgImportError = action.payload.importError
  // },
  // [ProvisionGen.submitGPGSignOK]: draftState => {
  //   draftState.gpgImportError = undefined
  // },

  return {
    ...initialStore,
    dispatch,
  }
})
