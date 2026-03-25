import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import {waitingKeyProvision, waitingKeyProvisionForgotUsername} from '@/constants/strings'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import {isMobile} from '@/constants/platform'
import {type CommonResponseHandler} from '@/engine/types'
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

export type SessionPrompt =
  | {error: string; phrase: string; type: 'promptSecret'}
  | {error: string; existingDevices: Array<string>; type: 'deviceName'}
  | {devices: Array<Device>; type: 'chooseDevice'}
  | {error: string; type: 'passphrase'}
  | {error: string; type: 'paperKey'}

export type Session =
  | {kind: 'idle'}
  | {
      kind: 'addingDevice' | 'provisioning'
      prompt?: SessionPrompt
      requestID: number
    }

type ActivePrompt =
  | {requestID: number; submit: (code: string) => void; type: 'promptSecret'}
  | {requestID: number; submit: (name: string) => void; type: 'deviceName'}
  | {devices: Array<Device>; requestID: number; submit: (name: string) => void; type: 'chooseDevice'}
  | {requestID: number; submit: (passphrase: string) => void; type: 'passphrase' | 'paperKey'}

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

type Store = T.Immutable<{
  codePageOtherDevice: Device
  deviceName: string
  devices: Array<Device>
  finalError?: RPCError
  forgotUsernameResult: string
  inlineError?: RPCError
  passphrase: string
  session: Session
  startProvisionTrigger: number
  username: string
}>

const idleSession = (): Session => ({kind: 'idle'})

const initialStore: Store = {
  codePageOtherDevice: makeDevice(),
  deviceName: '',
  devices: [],
  finalError: undefined,
  forgotUsernameResult: '',
  inlineError: undefined,
  passphrase: '',
  session: idleSession(),
  startProvisionTrigger: 0,
  username: '',
}

export type State = Store & {
  dispatch: {
    addNewDevice: (otherDeviceType: 'desktop' | 'mobile') => void
    cancel: (ignoreWarning?: boolean) => void
    forgotUsername: (phone?: string, email?: string) => void
    resetState: () => void
    restartProvisioning: () => void
    startProvision: (name?: string, fromReset?: boolean) => void
    submitDeviceName: (name: string) => void
    submitDeviceSelect: (name: string) => void
    submitPassphrase: (passphrase: string) => void
    submitTextCode: (code: string) => void
    submitUsername: (username: string) => void
  }
}

export const useProvisionState = Z.createZustand<State>('provision', (set, get) => {
  const clearWaiting = (ignoreWarning?: boolean) => {
    useWaitingState.getState().dispatch.clear(waitingKeyProvision)
    if (!ignoreWarning) {
      console.log('Provision: cancel called while not overloaded')
    }
  }

  const _cancel = wrapErrors((ignoreWarning?: boolean) => {
    clearWaiting(ignoreWarning)
  })

  let requestID = 0
  let activePrompt: ActivePrompt | undefined
  let activeCancel: (ignoreWarning?: boolean) => void = _cancel

  const setSession = (nextSession: Session) => {
    set(s => {
      s.session = T.castDraft(nextSession)
    })
  }

  const updateSessionPrompt = (activeRequestID: number, prompt?: SessionPrompt) => {
    set(s => {
      if (s.session.kind !== 'idle' && s.session.requestID === activeRequestID) {
        s.session.prompt = prompt ? T.castDraft(prompt) : undefined
      }
    })
  }

  const isActiveRequest = (activeRequestID: number) => {
    const session = get().session
    return session.kind !== 'idle' && session.requestID === activeRequestID
  }

  const invalidateSession = () => {
    requestID += 1
    activePrompt = undefined
    activeCancel = _cancel
    setSession(idleSession())
  }

  const finishPrompt = (activeRequestID: number) => {
    if (activePrompt?.requestID === activeRequestID) {
      activePrompt = undefined
      activeCancel = _cancel
      updateSessionPrompt(activeRequestID, undefined)
    }
  }

  const finishSession = (activeRequestID: number) => {
    if (!isActiveRequest(activeRequestID)) return
    finishPrompt(activeRequestID)
    setSession(idleSession())
  }

  const cancelActiveSession = wrapErrors((ignoreWarning?: boolean) => {
    const cancel = activeCancel
    invalidateSession()
    cancel(ignoreWarning)
  })

  const isCanceled = (activeRequestID: number, response: CommonResponseHandler) => {
    if (!isActiveRequest(activeRequestID)) {
      cancelOnCallback(undefined, response)
      return true
    }
    return false
  }

  const setPrompt = (activeRequestID: number, response: CommonResponseHandler, prompt: SessionPrompt) => {
    if (isCanceled(activeRequestID, response)) {
      return false
    }
    activeCancel = wrapErrors((ignoreWarning?: boolean) => {
      clearWaiting(ignoreWarning)
      finishPrompt(activeRequestID)
      updateSessionPrompt(activeRequestID, undefined)
      cancelOnCallback(undefined, response)
    })
    updateSessionPrompt(activeRequestID, prompt)
    return true
  }

  const beginSession = (kind: Exclude<Session['kind'], 'idle'>) => {
    requestID += 1
    activePrompt = undefined
    activeCancel = _cancel
    const activeRequestID = requestID
    setSession({kind, requestID: activeRequestID})
    return activeRequestID
  }

  const normalizePromptSecret = (code: string) => code.replace(/\W+/g, ' ').trim()

  const dispatch: State['dispatch'] = {
    addNewDevice: otherDeviceType => {
      cancelActiveSession()
      set(s => {
        s.codePageOtherDevice.type = otherDeviceType
        s.finalError = undefined
        s.inlineError = undefined
      })
      const activeRequestID = beginSession('addingDevice')
      const f = async () => {
        try {
          await T.RPCGen.deviceDeviceAddRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
                const prompt: SessionPrompt = {
                  error: params.previousErr,
                  phrase: params.phrase,
                  type: 'promptSecret',
                }
                if (!setPrompt(activeRequestID, response, prompt)) return
                activePrompt = {
                  requestID: activeRequestID,
                  submit: (code: string) => {
                    finishPrompt(activeRequestID)
                    response.result({
                      phrase: normalizePromptSecret(code),
                      secret: null as unknown as Uint8Array,
                    })
                  },
                  type: 'promptSecret',
                }
                navigateAppend('codePage')
              },
              'keybase.1.provisionUi.chooseDeviceType': (_params, response) => {
                if (isCanceled(activeRequestID, response)) return
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
          finishSession(activeRequestID)
        }
        clearModals()
      }
      ignorePromise(f())
    },
    cancel: cancelActiveSession,
    forgotUsername: (phone, email) => {
      const f = async () => {
        if (email) {
          try {
            await T.RPCGen.accountRecoverUsernameWithEmailRpcPromise(
              {email},
              waitingKeyProvisionForgotUsername
            )
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
            await T.RPCGen.accountRecoverUsernameWithPhoneRpcPromise(
              {phone},
              waitingKeyProvisionForgotUsername
            )
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
      ignorePromise(f())
    },
    resetState: () => {
      dispatch.cancel(true)
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        finalError: s.finalError,
        inlineError: s.inlineError,
      }))
    },
    restartProvisioning: () => {
      cancelActiveSession()

      const {username} = get()
      if (!username) {
        return
      }

      console.log('Provision: startProvisioning starting for', username)
      const activeRequestID = beginSession('provisioning')
      const f = async () => {
        try {
          await T.RPCGen.loginLoginRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.gpgUi.selectKey': cancelOnCallback,
              'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
              'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
                const prompt: SessionPrompt = {
                  error: params.previousErr,
                  phrase: params.phrase,
                  type: 'promptSecret',
                }
                if (!setPrompt(activeRequestID, response, prompt)) return
                activePrompt = {
                  requestID: activeRequestID,
                  submit: (code: string) => {
                    finishPrompt(activeRequestID)
                    response.result({
                      phrase: normalizePromptSecret(code),
                      secret: null as unknown as Uint8Array,
                    })
                  },
                  type: 'promptSecret',
                }
                navigateAppend('codePage')
              },
              'keybase.1.provisionUi.PromptNewDeviceName': (params, response) => {
                const prompt: SessionPrompt = {
                  error: params.errorMessage,
                  existingDevices: [...(params.existingDevices ?? [])],
                  type: 'deviceName',
                }
                if (!setPrompt(activeRequestID, response, prompt)) return
                activePrompt = {
                  requestID: activeRequestID,
                  submit: (name: string) => {
                    finishPrompt(activeRequestID)
                    response.result(name)
                  },
                  type: 'deviceName',
                }

                const {deviceName} = get()
                if (deviceName && !params.errorMessage) {
                  console.log('Provision: auto submit device name')
                  dispatch.submitDeviceName(deviceName)
                } else {
                  navigateAppend('setPublicName')
                }
              },
              'keybase.1.provisionUi.chooseDevice': (params, response) => {
                const devices = params.devices?.map(d => rpcDeviceToDevice(d)) ?? []
                if (
                  !setPrompt(activeRequestID, response, {
                    devices,
                    type: 'chooseDevice',
                  })
                ) {
                  return
                }
                set(s => {
                  s.devices = T.castDraft(devices)
                })
                activePrompt = {
                  devices,
                  requestID: activeRequestID,
                  submit: (name: string) => {
                    const selectedDevice = devices.find(d => d.name === name)
                    if (!selectedDevice) {
                      throw new Error('Selected a non existant device?')
                    }
                    set(s => {
                      s.codePageOtherDevice = selectedDevice
                    })
                    finishPrompt(activeRequestID)
                    response.result(selectedDevice.id)
                  },
                  type: 'chooseDevice',
                }

                const selectedDeviceName = get().codePageOtherDevice.name
                if (selectedDeviceName && devices.some(d => d.name === selectedDeviceName)) {
                  console.log('Provision: auto submit device selection')
                  dispatch.submitDeviceSelect(selectedDeviceName)
                } else {
                  navigateAppend('selectOtherDevice')
                }
              },
              'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
              'keybase.1.provisionUi.switchToGPGSignOK': cancelOnCallback,
              'keybase.1.secretUi.getPassphrase': (params, response) => {
                const {pinentry} = params
                const error =
                  pinentry.retryLabel === invalidPasswordErrorString ? 'Incorrect password.' : pinentry.retryLabel

                switch (pinentry.type) {
                  case T.RPCGen.PassphraseType.passPhrase: {
                    if (!setPrompt(activeRequestID, response, {error, type: 'passphrase'})) return
                    activePrompt = {
                      requestID: activeRequestID,
                      submit: (passphrase: string) => {
                        finishPrompt(activeRequestID)
                        response.result({passphrase, storeSecret: false})
                      },
                      type: 'passphrase',
                    }
                    const {passphrase} = get()
                    if (passphrase && !error) {
                      console.log('Provision: auto submit passphrase')
                      dispatch.submitPassphrase(passphrase)
                    } else {
                      navigateAppend('password')
                    }
                    break
                  }
                  case T.RPCGen.PassphraseType.paperKey: {
                    if (!setPrompt(activeRequestID, response, {error, type: 'paperKey'})) return
                    activePrompt = {
                      requestID: activeRequestID,
                      submit: (passphrase: string) => {
                        finishPrompt(activeRequestID)
                        response.result({passphrase, storeSecret: false})
                      },
                      type: 'paperKey',
                    }
                    const {passphrase} = get()
                    if (passphrase && !error) {
                      console.log('Provision: auto submit paper key')
                      dispatch.submitPassphrase(passphrase)
                    } else {
                      navigateAppend('paperkey')
                    }
                    break
                  }
                  default:
                    throw new Error('Got confused about password entry. Please send a log to us!')
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
                clearModals()
                navigateAppend('error', true)
              }
              break
          }
        } finally {
          dispatch.resetState()
        }
      }
      ignorePromise(f())
    },
    startProvision: (name = '', fromReset = false) => {
      dispatch.cancel(true)
      set(s => {
        s.finalError = undefined
        s.inlineError = undefined
        s.username = name
        s.startProvisionTrigger++
      })
      navigateAppend({name: 'username', params: {fromReset}})
    },
    submitDeviceName: wrapErrors((name: string) => {
      set(s => {
        s.deviceName = name
      })
      if (activePrompt?.type === 'deviceName') {
        activePrompt.submit(name)
        return
      }
      console.log('Provision: unwatched submitDeviceName called')
    }),
    submitDeviceSelect: wrapErrors((name: string) => {
      if (activePrompt?.type === 'chooseDevice') {
        activePrompt.submit(name)
        return
      }
      console.log('Provision: unwatched submitDeviceSelect called')
    }),
    submitPassphrase: wrapErrors((passphrase: string) => {
      set(s => {
        s.passphrase = passphrase
      })
      if (activePrompt?.type === 'passphrase' || activePrompt?.type === 'paperKey') {
        activePrompt.submit(passphrase)
        return
      }
      console.log('Provision: unwatched submitPassphrase called')
    }),
    submitTextCode: wrapErrors((code: string) => {
      if (activePrompt?.type === 'promptSecret') {
        activePrompt.submit(code)
        return
      }
      console.log('Provision: unwatched submitTextCode called')
    }),
    submitUsername: wrapErrors((username: string) => {
      set(s => {
        s.finalError = undefined
        s.inlineError = undefined
        s.username = username
      })
      dispatch.restartProvisioning()
    }),
  }

  return {
    ...initialStore,
    dispatch,
  }
})
