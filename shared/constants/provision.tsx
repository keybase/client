import * as C from '.'
import * as T from './types'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import {isMobile} from './platform'
import {type CommonResponseHandler} from '../engine/types'
import isEqual from 'lodash/isEqual'

export type Device = {
  deviceNumberOfType: number
  id: T.Devices.DeviceID
  name: string
  type: T.Devices.DeviceType
}

export const waitingKey = 'provision:waiting'
export const forgotUsernameWaitingKey = 'provision:forgotUsername'

const decodeForgotUsernameError = (error: RPCError) => {
  switch (error.code) {
    case T.RPCGen.StatusCode.scnotfound:
      return "We couldn't find an account with that email address. Try again?"
    case T.RPCGen.StatusCode.scinputerror:
      return "That doesn't look like a valid email address. Try again?"
    default:
      return error.desc
  }
}

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
const errorCausedByUsCanceling = (e?: RPCError) =>
  (e ? e.desc : undefined) === 'Input canceled' || (e ? e.desc : undefined) === 'kex canceled by caller'
const cancelOnCallback = (_: unknown, response: CommonResponseHandler) => {
  response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
}

const makeDevice = (): Device => ({
  deviceNumberOfType: 0,
  id: T.Devices.stringToDeviceID(''),
  name: '',
  type: 'mobile',
})

export const rpcDeviceToDevice = (d: T.RPCGen.Device) => {
  const type = d.type
  switch (type) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return {
        deviceNumberOfType: d.deviceNumberOfType,
        id: T.Devices.stringToDeviceID(d.deviceID),
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
  | {type: 'chooseDevice'; devices: Array<Device>}
  | {type: 'promptSecret'}
type ExtractType<T> = T extends {type: infer U} ? U : never
type StepTypes = ExtractType<Step>

type Store = T.Immutable<{
  autoSubmit: Array<Step>
  callbackMap: Map<StepTypes, () => void>
  codePageIncomingTextCode: string
  codePageOtherDevice: Device
  deviceName: string
  devices: Array<Device>
  error: string
  existingDevices: Array<string>
  finalError?: RPCError
  forgotUsernameResult: string
  gpgImportError?: string
  inlineError?: RPCError
  passphrase: string
  provisionStep: number
  username: string
}>
const initialStore: Store = {
  autoSubmit: [],
  callbackMap: new Map(),
  codePageIncomingTextCode: '',
  codePageOtherDevice: makeDevice(),
  deviceName: '',
  devices: [],
  error: '',
  existingDevices: [],
  finalError: undefined,
  forgotUsernameResult: '',
  gpgImportError: undefined,
  inlineError: undefined,
  passphrase: '',
  provisionStep: 0,
  username: '',
}

interface State extends Store {
  dispatch: {
    dynamic: {
      cancel?: (dueToReset?: boolean) => void
      setDeviceName?: (name: string) => void
      setPassphrase?: (passphrase: string) => void
      setUsername?: (username: string) => void
      submitDeviceSelect?: (name: string) => void
      submitTextCode?: (code: string) => void
    }
    addNewDevice: (otherDeviceType: 'desktop' | 'mobile') => void
    forgotUsername: (phone?: string, email?: string) => void
    resetState: () => void
    restartProvisioning: () => void
    startProvision: (name?: string, fromReset?: boolean) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const _cancel = C.wrapErrors((dueToReset?: boolean) => {
    C.useWaitingState.getState().dispatch.clear(waitingKey)
    if (!dueToReset) {
      console.log('Provision: cancel called while not overloaded')
    }
  })

  // add a new value to submit and clear things behind
  const _updateAutoSubmit = C.wrapErrors((step: Store['autoSubmit'][0]) => {
    set(s => {
      const idx = s.autoSubmit.findIndex(a => a.type === step.type)
      if (idx !== -1) {
        s.autoSubmit.splice(idx)
      }
      s.autoSubmit.push(T.castDraft(step))
    })
  })

  const _setUsername = C.wrapErrors((username: string, restart: boolean = true) => {
    set(s => {
      s.username = username
      s.autoSubmit = [{type: 'username'}]
    })
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  })
  const _setPassphrase = C.wrapErrors((passphrase: string, restart: boolean = true) => {
    set(s => {
      s.passphrase = passphrase
    })
    _updateAutoSubmit({type: 'passphrase'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  })

  const _setDeviceName = C.wrapErrors((name: string, restart: boolean = true) => {
    set(s => {
      s.deviceName = name
    })
    _updateAutoSubmit({type: 'deviceName'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  })

  const _submitDeviceSelect = C.wrapErrors((name: string, restart: boolean = true) => {
    const devices = get().devices
    const selectedDevice = devices.find(d => d.name === name)
    if (!selectedDevice) {
      throw new Error('Selected a non existant device?')
    }
    set(s => {
      s.codePageOtherDevice = selectedDevice
    })
    _updateAutoSubmit({devices, type: 'chooseDevice'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  })

  const _submitTextCode = C.wrapErrors((_code: string) => {
    console.log('Provision, unwatched submitTextCode called')
    get().dispatch.restartProvisioning()
  })

  const resetErrorAndCancel = () => {
    set(s => {
      s.error = ''
      s.dispatch.dynamic.cancel = _cancel
    })
  }

  const dispatch: State['dispatch'] = {
    addNewDevice: otherDeviceType => {
      get().dispatch.dynamic.cancel?.()
      set(s => {
        s.codePageOtherDevice.type = otherDeviceType
      })
      let cancelled = false
      const setupCancel = (response: CommonResponseHandler) => {
        set(s => {
          s.dispatch.dynamic.cancel = C.wrapErrors(() => {
            set(s => {
              s.dispatch.dynamic.cancel = _cancel
            })
            cancelled = true
            cancelOnCallback(undefined, response)
          })
        })
      }
      const isCanceled = (response: CommonResponseHandler) => {
        if (cancelled) {
          cancelOnCallback(undefined, response)
          return true
        }
        return false
      }
      const f = async () => {
        try {
          await T.RPCGen.deviceDeviceAddRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
                if (isCanceled(response)) return
                const {phrase, previousErr} = params
                setupCancel(response)
                set(s => {
                  s.error = previousErr
                  s.codePageIncomingTextCode = phrase
                  s.dispatch.dynamic.submitTextCode = C.wrapErrors((code: string) => {
                    set(s => {
                      s.dispatch.dynamic.submitTextCode = _submitTextCode
                    })
                    resetErrorAndCancel()
                    const good = code.replace(/\W+/g, ' ').trim()
                    response.result({phrase: good, secret: null as any})
                  })
                })
                C.useRouterState.getState().dispatch.navigateAppend('codePage')
              },
              'keybase.1.provisionUi.chooseDeviceType': (_params, response) => {
                const {type} = get().codePageOtherDevice
                switch (type) {
                  case 'mobile':
                    response.result(T.RPCGen.DeviceType.mobile)
                    break
                  case 'desktop':
                    response.result(T.RPCGen.DeviceType.desktop)
                    break
                  default:
                    response.error()
                    throw new Error('Tried to add a device but of unknown type' + type)
                }
              },
            },
            incomingCallMap: {
              'keybase.1.provisionUi.DisplaySecretExchanged': () => {
                C.useWaitingState.getState().dispatch.increment(waitingKey)
              },
              'keybase.1.provisionUi.ProvisioneeSuccess': () => {},
              'keybase.1.provisionUi.ProvisionerSuccess': () => {},
            },
            params: undefined,
            waitingKey,
          })
        } catch {
        } finally {
          set(s => {
            s.dispatch.dynamic.cancel = _cancel
            s.dispatch.dynamic.setDeviceName = _setDeviceName
            s.dispatch.dynamic.setPassphrase = _setPassphrase
            s.dispatch.dynamic.setUsername = _setUsername
            s.dispatch.dynamic.submitDeviceSelect = _submitDeviceSelect
            s.dispatch.dynamic.submitTextCode = _submitTextCode
          })
        }
        C.useRouterState.getState().dispatch.clearModals()
      }
      C.ignorePromise(f())
    },
    dynamic: {
      cancel: _cancel,
      setDeviceName: _setDeviceName,
      setPassphrase: _setPassphrase,
      setUsername: _setUsername,
      submitDeviceSelect: _submitDeviceSelect,
      submitTextCode: _submitTextCode,
    },
    forgotUsername: (phone, email) => {
      const f = async () => {
        if (email) {
          try {
            await T.RPCGen.accountRecoverUsernameWithEmailRpcPromise({email}, forgotUsernameWaitingKey)
            set(s => {
              s.forgotUsernameResult = 'success'
            })
          } catch (error) {
            if (error instanceof RPCError) {
              const err = decodeForgotUsernameError(error)
              set(s => {
                s.forgotUsernameResult = err
              })
            }
          }
        }
        if (phone) {
          try {
            await T.RPCGen.accountRecoverUsernameWithPhoneRpcPromise({phone}, forgotUsernameWaitingKey)
            set(s => {
              s.forgotUsernameResult = 'success'
            })
          } catch (error) {
            if (error instanceof RPCError) {
              const err = decodeForgotUsernameError(error)
              set(s => {
                s.forgotUsernameResult = err
              })
              return
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    resetState: () => {
      get().dispatch.dynamic.cancel?.(true)
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        finalError: s.finalError,
        inlineError: s.inlineError,
      }))
    },
    restartProvisioning: () => {
      get().dispatch.dynamic.cancel?.()

      const {username} = get()
      if (!username) {
        return
      }

      let cancelled = false
      // freeze the autosubmit for this call so changes don't affect us
      const {autoSubmit} = get()
      console.log('Provision: startProvisioning starting with auto submit', autoSubmit)
      const f = async () => {
        const isCanceled = (response: CommonResponseHandler) => {
          if (cancelled) {
            cancelOnCallback(undefined, response)
            return true
          }
          return false
        }

        // Make cancel set the flag and cancel the current rpc
        const setupCancel = (response: CommonResponseHandler) => {
          set(s => {
            s.dispatch.dynamic.cancel = C.wrapErrors(() => {
              set(s => {
                s.dispatch.dynamic.cancel = _cancel
              })
              cancelled = true
              cancelOnCallback(undefined, response)
            })
          })
        }

        let submitStep = 0
        const shouldAutoSubmit = (hadError: boolean, step: Step) => {
          if (!hadError) {
            ++submitStep
          }
          const auto = autoSubmit[submitStep]
          return isEqual(auto, step)
        }

        try {
          await T.RPCGen.loginLoginRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.gpgUi.selectKey': cancelOnCallback,
              'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
              'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
                if (isCanceled(response)) return
                const {phrase, previousErr} = params
                setupCancel(response)
                set(s => {
                  s.error = previousErr
                  s.codePageIncomingTextCode = phrase
                  s.dispatch.dynamic.submitTextCode = C.wrapErrors((code: string) => {
                    set(s => {
                      s.dispatch.dynamic.submitTextCode = _submitTextCode
                    })
                    resetErrorAndCancel()
                    const good = code.replace(/\W+/g, ' ').trim()
                    response.result({phrase: good, secret: null as any})
                  })
                })

                // we ignore the return as we never autosubmit, but we want things to increment
                shouldAutoSubmit(!!previousErr, {type: 'promptSecret'})
                C.useRouterState.getState().dispatch.navigateAppend('codePage')
              },
              'keybase.1.provisionUi.PromptNewDeviceName': (params, response) => {
                if (isCanceled(response)) return
                const {errorMessage, existingDevices} = params
                setupCancel(response)
                set(s => {
                  s.error = errorMessage
                  s.existingDevices = T.castDraft(existingDevices ?? [])
                  s.dispatch.dynamic.setDeviceName = C.wrapErrors((name: string) => {
                    set(s => {
                      s.dispatch.dynamic.setDeviceName = _setDeviceName
                    })
                    _setDeviceName(name, false)
                    resetErrorAndCancel()
                    response.result(name)
                  })
                })

                if (shouldAutoSubmit(!!errorMessage, {type: 'deviceName'})) {
                  console.log('Provision: auto submit device name')
                  get().dispatch.dynamic.setDeviceName?.(get().deviceName)
                } else {
                  C.useRouterState.getState().dispatch.navigateAppend('setPublicName')
                }
              },
              'keybase.1.provisionUi.chooseDevice': (params, response) => {
                if (isCanceled(response)) return
                const {devices: _devices} = params
                const devices = _devices?.map(d => rpcDeviceToDevice(d)) ?? []
                setupCancel(response)
                set(s => {
                  s.error = ''
                  s.devices = devices
                  s.dispatch.dynamic.submitDeviceSelect = C.wrapErrors((device: string) => {
                    set(s => {
                      s.dispatch.dynamic.submitDeviceSelect = _submitDeviceSelect
                    })
                    _submitDeviceSelect(device, false)
                    const id = get().codePageOtherDevice.id
                    resetErrorAndCancel()
                    response.result(id)
                  })
                })

                if (shouldAutoSubmit(false, {devices, type: 'chooseDevice'})) {
                  console.log('Provision: auto submit passphrase')
                  get().dispatch.dynamic.submitDeviceSelect?.(get().codePageOtherDevice.name)
                } else {
                  C.useRouterState.getState().dispatch.navigateAppend('selectOtherDevice')
                }
              },
              'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
              'keybase.1.provisionUi.switchToGPGSignOK': cancelOnCallback,
              'keybase.1.secretUi.getPassphrase': (params, response) => {
                if (isCanceled(response)) return
                const {pinentry} = params
                const {retryLabel, type} = pinentry

                setupCancel(response)
                // Service asking us again due to an error?
                set(s => {
                  s.error =
                    retryLabel === C.Config.invalidPasswordErrorString ? 'Incorrect password.' : retryLabel
                  s.dispatch.dynamic.setPassphrase = C.wrapErrors((passphrase: string) => {
                    set(s => {
                      s.dispatch.dynamic.setPassphrase = _setPassphrase
                    })
                    _setPassphrase(passphrase, false)
                    resetErrorAndCancel()
                    response.result({passphrase, storeSecret: false})
                  })
                })

                if (shouldAutoSubmit(!!retryLabel, {type: 'passphrase'})) {
                  console.log('Provision: auto submit passphrase')
                  get().dispatch.dynamic.setPassphrase?.(get().passphrase)
                } else {
                  switch (type) {
                    case T.RPCGen.PassphraseType.passPhrase:
                      C.useRouterState.getState().dispatch.navigateAppend('password')
                      break
                    case T.RPCGen.PassphraseType.paperKey:
                      C.useRouterState.getState().dispatch.navigateAppend('paperkey')
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
                C.useWaitingState.getState().dispatch.increment(waitingKey)
              },
              'keybase.1.provisionUi.ProvisioneeSuccess': () => {},
              'keybase.1.provisionUi.ProvisionerSuccess': () => {},
            },
            params: {
              clientType: T.RPCGen.ClientType.guiMain,
              deviceName: '',
              deviceType: isMobile ? 'mobile' : 'desktop',
              doUserSwitch: true,
              paperKey: '',
              username,
            },
            waitingKey,
          })
          get().dispatch.resetState()
        } catch (_finalError) {
          if (!(_finalError instanceof RPCError)) {
            console.log('Provision non rpc error at end?', _finalError)
            return
          }
          const finalError = _finalError
          // If it's a non-existent username or invalid, allow the opportunity to
          // correct it right there on the page.
          switch (finalError.code) {
            case T.RPCGen.StatusCode.scnotfound:
            case T.RPCGen.StatusCode.scbadusername:
              set(s => {
                s.inlineError = finalError
              })
              break
            default:
              if (!errorCausedByUsCanceling(finalError)) {
                set(s => {
                  s.finalError = finalError
                })
                C.useRouterState.getState().dispatch.clearModals()
                C.useRouterState.getState().dispatch.navigateAppend('error', true)
              }
              break
          }
        } finally {
          get().dispatch.resetState()
        }
      }
      C.ignorePromise(f())
    },
    startProvision: (name = '', fromReset = false) => {
      get().dispatch.dynamic.cancel?.()
      C.useConfigState.getState().dispatch.loginError()
      C.useConfigState.getState().dispatch.resetRevokedSelf()

      set(s => {
        s.username = name
      })
      const f = async () => {
        // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
        if (C.useConfigState.getState().loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise(
            {force: false, keepSecrets: true},
            C.Config.loginAsOtherUserWaitingKey
          )
        }
        C.useRouterState.getState().dispatch.navigateAppend({props: {fromReset}, selected: 'username'})
      }
      C.ignorePromise(f())
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
