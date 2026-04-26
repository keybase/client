import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import {waitingKeyProvision} from '@/constants/strings'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import {isMobile} from '@/constants/platform'
import {type CommonResponseHandler} from '@/engine/types'
import isEqual from 'lodash/isEqual'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {invalidPasswordErrorString} from '@/constants/config'
import {clearModals, navigateAppend} from '@/constants/router'
import {useWaitingState} from '@/stores/waiting'

export type Device = {
  deviceNumberOfType: number
  id: T.Devices.DeviceID
  name: string
  type: T.Devices.DeviceType
}
export type ProvisionRouteError = {
  code: number
  desc: string
  details: string
  fields?: ReadonlyArray<{key?: string; value?: string}>
  message: string
}

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
const errorCausedByUsCanceling = (e?: RPCError) => {
  const desc = e?.desc
  return desc === 'Input canceled' || desc === 'kex canceled by caller'
}
const cancelOnCallback = (_: unknown, response: CommonResponseHandler) => {
  response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
}

const makeDevice = (): Device => ({
  deviceNumberOfType: 0,
  id: T.Devices.stringToDeviceID(''),
  name: '',
  type: 'mobile',
})

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
type Store = T.Immutable<{
  autoSubmit: Array<Step>
  codePageIncomingTextCode: string
  codePageOtherDevice: Device
  deviceName: string
  devices: Array<Device>
  error: string
  inlineError?: RPCError | undefined
  passphrase: string
  startProvisionTrigger: number
  username: string
}>
const initialStore: Store = {
  autoSubmit: [],
  codePageIncomingTextCode: '',
  codePageOtherDevice: makeDevice(),
  deviceName: '',
  devices: [],
  error: '',
  passphrase: '',
  startProvisionTrigger: 0,
  username: '',
}

export type State = Store & {
  dispatch: {
    dynamic: {
      cancel?: (ignoreWarning?: boolean) => void
      setDeviceName?: (name: string) => void
      setPassphrase?: (passphrase: string) => void
      setUsername?: (username: string) => void
      submitDeviceSelect?: (name: string) => void
      submitTextCode?: (code: string) => void
    }
    addNewDevice: (otherDeviceType: 'desktop' | 'mobile') => void
    resetState: () => void
    restartProvisioning: () => void
    startProvision: (name?: string, fromReset?: boolean) => void
  }
}

export const useProvisionState = Z.createZustand<State>('provision', (set, get) => {
  const _cancel = wrapErrors((ignoreWarning?: boolean) => {
    useWaitingState.getState().dispatch.clear(waitingKeyProvision)
    if (!ignoreWarning) {
      console.log('Provision: cancel called while not overloaded')
    }
  })

  // add a new value to submit and clear things behind
  const _updateAutoSubmit = wrapErrors((step: Store['autoSubmit'][0]) => {
    set(s => {
      const idx = s.autoSubmit.findIndex(a => a.type === step.type)
      if (idx !== -1) {
        s.autoSubmit.splice(idx)
      }
      s.autoSubmit.push(T.castDraft(step))
    })
  })

  const _setPassphrase = wrapErrors((passphrase: string, restart: boolean = true) => {
    set(s => {
      s.passphrase = passphrase
    })
    _updateAutoSubmit({type: 'passphrase'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  })

  const _setDeviceName = wrapErrors((name: string, restart: boolean = true) => {
    set(s => {
      s.deviceName = name
    })
    _updateAutoSubmit({type: 'deviceName'})
    if (restart) {
      get().dispatch.restartProvisioning()
    }
  })

  const _submitDeviceSelect = wrapErrors((name: string, restart: boolean = true) => {
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

  const _submitTextCode = wrapErrors((_code: string) => {
    console.log('Provision, unwatched submitTextCode called')
    get().dispatch.restartProvisioning()
  })

  const resetErrorAndCancel = () => {
    set(s => {
      s.error = ''
      s.dispatch.dynamic.cancel = _cancel
    })
  }

  const makeCancelHelpers = () => {
    let cancelled = false
    const isCanceled = (response: CommonResponseHandler) => {
      if (cancelled) {
        cancelOnCallback(undefined, response)
        return true
      }
      return false
    }
    const setupCancel = (response: CommonResponseHandler) => {
      set(s => {
        s.dispatch.dynamic.cancel = wrapErrors(() => {
          set(s => {
            s.dispatch.dynamic.cancel = _cancel
          })
          cancelled = true
          cancelOnCallback(undefined, response)
        })
      })
    }
    return {isCanceled, setupCancel}
  }

  const dispatch: State['dispatch'] = {
    addNewDevice: otherDeviceType => {
      get().dispatch.dynamic.cancel?.()
      set(s => {
        s.codePageOtherDevice.type = otherDeviceType
      })
      const {isCanceled, setupCancel} = makeCancelHelpers()
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
                  s.dispatch.dynamic.submitTextCode = wrapErrors((code: string) => {
                    set(s => {
                      s.dispatch.dynamic.submitTextCode = _submitTextCode
                    })
                    resetErrorAndCancel()
                    const good = code.replace(/\W+/g, ' ').trim()
                    response.result({phrase: good, secret: null as unknown as Uint8Array})
                  })
                })
                navigateAppend({name: 'codePage', params: {}})
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
                useWaitingState.getState().dispatch.increment(waitingKeyProvision)
              },
              'keybase.1.provisionUi.ProvisioneeSuccess': () => {},
              'keybase.1.provisionUi.ProvisionerSuccess': () => {},
            },
            params: undefined,
            waitingKey: waitingKeyProvision,
          })
        } catch {
        } finally {
          set(s => {
            s.dispatch.dynamic.cancel = _cancel
            s.dispatch.dynamic.submitTextCode = _submitTextCode
          })
        }
        clearModals()
      }
      ignorePromise(f())
    },
    dynamic: {
      cancel: _cancel,
      setDeviceName: _setDeviceName,
      setPassphrase: _setPassphrase,
      setUsername: wrapErrors((username: string, restart: boolean = true) => {
        set(s => {
          s.username = username
          s.autoSubmit = [{type: 'username'}]
        })
        if (restart) {
          get().dispatch.restartProvisioning()
        }
      }),
      submitDeviceSelect: _submitDeviceSelect,
      submitTextCode: _submitTextCode,
    },
    resetState: () => {
      get().dispatch.dynamic.cancel?.(true)
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        inlineError: s.inlineError,
      }))
    },
    restartProvisioning: () => {
      get().dispatch.dynamic.cancel?.()

      const {username} = get()
      if (!username) {
        return
      }

      // freeze the autosubmit for this call so changes don't affect us
      const {autoSubmit} = get()
      console.log('Provision: startProvisioning starting with auto submit', autoSubmit)
      const f = async () => {
        const {isCanceled, setupCancel} = makeCancelHelpers()

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
                  s.dispatch.dynamic.submitTextCode = wrapErrors((code: string) => {
                    set(s => {
                      s.dispatch.dynamic.submitTextCode = _submitTextCode
                    })
                    resetErrorAndCancel()
                    const good = code.replace(/\W+/g, ' ').trim()
                    response.result({phrase: good, secret: null as unknown as Uint8Array})
                  })
                })

                // we ignore the return as we never autosubmit, but we want things to increment
                shouldAutoSubmit(!!previousErr, {type: 'promptSecret'})
                navigateAppend({name: 'codePage', params: {}})
              },
              'keybase.1.provisionUi.PromptNewDeviceName': (params, response) => {
                if (isCanceled(response)) return
                const {errorMessage} = params
                setupCancel(response)
                set(s => {
                  s.error = errorMessage
                  s.dispatch.dynamic.setDeviceName = wrapErrors((name: string) => {
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
                  navigateAppend({name: 'setPublicName', params: {}})
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
                  s.dispatch.dynamic.submitDeviceSelect = wrapErrors((device: string) => {
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
                  navigateAppend({name: 'selectOtherDevice', params: {}})
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
                  s.error = retryLabel === invalidPasswordErrorString ? 'Incorrect password.' : retryLabel
                  s.dispatch.dynamic.setPassphrase = wrapErrors((passphrase: string) => {
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
                      navigateAppend({name: 'password', params: {}})
                      break
                    case T.RPCGen.PassphraseType.paperKey:
                      navigateAppend({name: 'paperkey', params: {}})
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
                useWaitingState.getState().dispatch.increment(waitingKeyProvision)
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
            waitingKey: waitingKeyProvision,
          })
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
                const fields = finalError.fields as
                  | ReadonlyArray<{key?: string; value?: string}>
                  | undefined
                clearModals()
                navigateAppend(
                  {
                    name: 'error',
                    params: {
                      error: {
                        code: finalError.code,
                        desc: finalError.desc,
                        details: finalError.details,
                        message: finalError.message,
                        ...(fields === undefined ? {} : {fields}),
                      } satisfies ProvisionRouteError,
                    },
                  },
                  true
                )
              }
              break
          }
        } finally {
          get().dispatch.resetState()
        }
      }
      ignorePromise(f())
    },
    startProvision: (name = '', fromReset = false) => {
      get().dispatch.dynamic.cancel?.(true)
      set(s => {
        s.startProvisionTrigger++
        s.username = name
      })
      navigateAppend({name: 'username', params: {fromReset}})
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
