import * as T from '@/constants/types'
import isEqual from 'lodash/isEqual'
import {invalidPasswordErrorString} from '@/constants/config'
import {type Device, type ProvisionRouteError} from '@/constants/provision'
import {clearModals, navigateAppend} from '@/constants/router'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {waitingKeyProvision} from '@/constants/strings'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import {type CommonResponseHandler} from '@/engine/types'
import {callNamed, setNamedScoped} from '@/stores/flow-handles'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {RPCError} from '@/util/errors'

const owner = 'provision'

const slots = {
  cancel: 'cancel',
  submitDeviceName: 'submitDeviceName',
  submitDeviceSelect: 'submitDeviceSelect',
  submitPassphrase: 'submitPassphrase',
  submitTextCode: 'submitTextCode',
} as const
type Slot = (typeof slots)[keyof typeof slots]
type ScopedHandle = ReturnType<typeof setNamedScoped>

// The steps the user has already answered, replayed in order when the login RPC restarts.
type Step =
  | {type: 'username'}
  | {type: 'passphrase'}
  | {type: 'deviceName'}
  | {type: 'chooseDevice'; devices: Array<Device>}
  | {type: 'promptSecret'}

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

// Token-scoped handle registrations for one flow run. Disposing only clears handles this run set,
// so a newer run's replacement handlers survive an older run's teardown.
const makeHandles = () => {
  let active = true
  const handles = new Map<Slot, ScopedHandle>()
  return {
    dispose: () => {
      active = false
      for (const handle of handles.values()) {
        handle.dispose()
      }
    },
    set: (slot: Slot, fn: (...args: Array<any>) => void) => {
      handles.set(
        slot,
        setNamedScoped(owner, slot, (...args: Array<any>) => {
          if (active) {
            fn(...args)
          }
        })
      )
    },
  }
}

export const cancelProvision = () => callNamed(owner, slots.cancel)
export const submitProvisionDeviceName = (name: string) => callNamed(owner, slots.submitDeviceName, name)
export const submitProvisionDeviceSelect = (name: string) => callNamed(owner, slots.submitDeviceSelect, name)
export const submitProvisionPassphrase = (passphrase: string) =>
  callNamed(owner, slots.submitPassphrase, passphrase)
export const submitProvisionTextCode = (code: string) => callNamed(owner, slots.submitTextCode, code)

export const startProvision = (name = '', fromReset = false) => {
  cancelProvision()
  useConfigState.getState().dispatch.setLoginError()
  useConfigState.getState().dispatch.resetRevokedSelf()
  const f = async () => {
    // If we're logged in, we're coming from the user switcher; log out first to prevent the service
    // from getting out of sync with the GUI about our logged-in-ness
    if (useConfigState.getState().loggedIn) {
      await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true}, 'config:loginAsOther')
    }
  }
  ignorePromise(f())
  navigateAppend({name: 'username', params: {fromReset, username: name}})
}

// A changed username always restarts provisioning from scratch
export const submitProvisionUsername = (username: string) => {
  cancelProvision()
  runProvision(username)
}

// Runs the login RPC and services its prompts. The RPC has no notion of going back to an earlier
// step, so when the user does, we record the changed answer, cancel the in-flight RPC, and run it
// again, auto-submitting the recorded answers up to the changed step.
const runProvision = (initialUsername: string) => {
  const username = initialUsername
  const answers = {
    deviceName: '',
    passphrase: '',
    selectedDevice: makeDevice(),
  }
  let knownDevices: Array<Device> = []
  const autoSubmit: Array<Step> = [{type: 'username'}]
  let pendingResponse: CommonResponseHandler | undefined
  let restartRequested = false
  let userCancelled = false
  const handles = makeHandles()

  const cancelPendingResponse = () => {
    const response = pendingResponse
    pendingResponse = undefined
    if (response) {
      cancelOnCallback(undefined, response)
    }
  }

  // add a new value to submit and clear things behind
  const updateAutoSubmit = (step: Step) => {
    const idx = autoSubmit.findIndex(a => a.type === step.type)
    if (idx !== -1) {
      autoSubmit.splice(idx)
    }
    autoSubmit.push(step)
  }

  const requestRestart = () => {
    restartRequested = true
    cancelPendingResponse()
  }
  const wasRestartRequested = () => restartRequested

  // Idle handlers run when the user submits a step the RPC isn't currently waiting on: they went
  // back to an earlier screen. Record the new answer and restart.
  const setIdleHandlers = () => {
    handles.set(
      slots.submitDeviceName,
      wrapErrors((name: string) => {
        answers.deviceName = name
        updateAutoSubmit({type: 'deviceName'})
        requestRestart()
      })
    )
    handles.set(
      slots.submitDeviceSelect,
      wrapErrors((name: string) => {
        const selectedDevice = knownDevices.find(d => d.name === name)
        if (!selectedDevice) {
          throw new Error('Selected a non existant device?')
        }
        answers.selectedDevice = selectedDevice
        updateAutoSubmit({devices: knownDevices, type: 'chooseDevice'})
        requestRestart()
      })
    )
    handles.set(
      slots.submitPassphrase,
      wrapErrors((passphrase: string) => {
        answers.passphrase = passphrase
        updateAutoSubmit({type: 'passphrase'})
        requestRestart()
      })
    )
    handles.set(
      slots.submitTextCode,
      wrapErrors(() => {
        console.log('Provision: unwatched submitTextCode called')
        requestRestart()
      })
    )
  }

  const isCanceled = (response: CommonResponseHandler) => {
    if (userCancelled) {
      cancelOnCallback(undefined, response)
      return true
    }
    return false
  }

  const setPendingResponse = (response: CommonResponseHandler) => {
    pendingResponse = response
  }

  const runAttempt = async () => {
    // freeze the autosubmit for this attempt so changes don't affect us
    const frozenAutoSubmit = [...autoSubmit]
    console.log('Provision: starting attempt with auto submit', frozenAutoSubmit)
    let submitStep = 0
    const shouldAutoSubmit = (hadError: boolean, step: Step) => {
      if (!hadError) {
        ++submitStep
      }
      return isEqual(frozenAutoSubmit[submitStep], step)
    }

    await T.RPCGen.loginLoginRpcListener({
      customResponseIncomingCallMap: {
        'keybase.1.gpgUi.selectKey': cancelOnCallback,
        'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
        'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
          if (isCanceled(response)) return
          const {phrase, previousErr} = params
          setPendingResponse(response)
          handles.set(
            slots.submitTextCode,
            wrapErrors((code: string) => {
              pendingResponse = undefined
              setIdleHandlers()
              const good = code.replace(/\W+/g, ' ').trim()
              response.result({phrase: good, secret: null as unknown as Uint8Array})
            })
          )
          // we ignore the return as we never autosubmit, but we want things to increment
          shouldAutoSubmit(!!previousErr, {type: 'promptSecret'})
          navigateAppend(
            {
              name: 'codePage',
              params: {
                deviceName: answers.deviceName,
                error: previousErr || undefined,
                otherDevice: answers.selectedDevice,
                textCode: phrase,
              },
            },
            !!previousErr
          )
        },
        'keybase.1.provisionUi.PromptNewDeviceName': (params, response) => {
          if (isCanceled(response)) return
          const {errorMessage} = params
          setPendingResponse(response)
          handles.set(
            slots.submitDeviceName,
            wrapErrors((name: string) => {
              pendingResponse = undefined
              answers.deviceName = name
              updateAutoSubmit({type: 'deviceName'})
              setIdleHandlers()
              response.result(name)
            })
          )
          if (shouldAutoSubmit(!!errorMessage, {type: 'deviceName'})) {
            console.log('Provision: auto submit device name')
            submitProvisionDeviceName(answers.deviceName)
          } else {
            navigateAppend(
              {
                name: 'setPublicName',
                params: {devices: knownDevices, error: errorMessage || undefined},
              },
              !!errorMessage
            )
          }
        },
        'keybase.1.provisionUi.chooseDevice': (params, response) => {
          if (isCanceled(response)) return
          const devices = params.devices?.map(d => rpcDeviceToDevice(d)) ?? []
          knownDevices = devices
          setPendingResponse(response)
          handles.set(
            slots.submitDeviceSelect,
            wrapErrors((name: string) => {
              const selectedDevice = devices.find(d => d.name === name)
              if (!selectedDevice) {
                throw new Error('Selected a non existant device?')
              }
              pendingResponse = undefined
              answers.selectedDevice = selectedDevice
              updateAutoSubmit({devices, type: 'chooseDevice'})
              setIdleHandlers()
              response.result(selectedDevice.id)
            })
          )
          if (shouldAutoSubmit(false, {devices, type: 'chooseDevice'})) {
            console.log('Provision: auto submit device select')
            submitProvisionDeviceSelect(answers.selectedDevice.name)
          } else {
            navigateAppend({name: 'selectOtherDevice', params: {devices, username}})
          }
        },
        'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
        'keybase.1.provisionUi.switchToGPGSignOK': cancelOnCallback,
        'keybase.1.secretUi.getPassphrase': (params, response) => {
          if (isCanceled(response)) return
          const {pinentry} = params
          const {retryLabel, type} = pinentry
          setPendingResponse(response)
          // Service asking us again due to an error?
          const error = retryLabel === invalidPasswordErrorString ? 'Incorrect password.' : retryLabel
          handles.set(
            slots.submitPassphrase,
            wrapErrors((passphrase: string) => {
              pendingResponse = undefined
              answers.passphrase = passphrase
              updateAutoSubmit({type: 'passphrase'})
              setIdleHandlers()
              response.result({passphrase, storeSecret: false})
            })
          )
          if (shouldAutoSubmit(!!retryLabel, {type: 'passphrase'})) {
            console.log('Provision: auto submit passphrase')
            submitProvisionPassphrase(answers.passphrase)
          } else {
            switch (type) {
              case T.RPCGen.PassphraseType.passPhrase:
                navigateAppend(
                  {name: 'password', params: {error: error || undefined, username}},
                  !!retryLabel
                )
                break
              case T.RPCGen.PassphraseType.paperKey:
                navigateAppend(
                  {
                    name: 'paperkey',
                    params: {deviceName: answers.selectedDevice.name, error: error || undefined},
                  },
                  !!retryLabel
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
  }

  const f = async () => {
    // Cancel kills this run: any prompt arriving afterwards is auto-rejected so the RPC ends. The
    // pending response (if any) is rejected now, which is also what stops a run a newer one replaces.
    handles.set(
      slots.cancel,
      wrapErrors(() => {
        userCancelled = true
        useWaitingState.getState().dispatch.clear(waitingKeyProvision)
        cancelPendingResponse()
      })
    )
    setIdleHandlers()
    try {
      for (;;) {
        restartRequested = false
        try {
          await runAttempt()
          break
        } catch (_finalError) {
          if (wasRestartRequested()) {
            continue
          }
          if (!(_finalError instanceof RPCError)) {
            console.log('Provision non rpc error at end?', _finalError)
            break
          }
          const finalError = _finalError
          // If it's a non-existent username or invalid, allow the opportunity to correct it right
          // there on the page.
          switch (finalError.code) {
            case T.RPCGen.StatusCode.scnotfound:
            case T.RPCGen.StatusCode.scbadusername:
              navigateAppend({name: 'username', params: {inlineErrorCode: finalError.code, username}}, true)
              break
            default:
              if (!errorCausedByUsCanceling(finalError)) {
                clearModals()
                navigateAppend(
                  {
                    name: 'error',
                    params: {
                      error: {
                        code: finalError.code,
                        desc: finalError.desc,
                        details: finalError.details,
                        fields: finalError.fields as ReadonlyArray<{key?: string; value?: string}> | undefined,
                        message: finalError.message,
                      } satisfies ProvisionRouteError,
                      username,
                    },
                  },
                  true
                )
              }
              break
          }
          break
        }
      }
    } finally {
      handles.dispose()
    }
  }
  ignorePromise(f())
}

export const startAddNewDevice = (otherDeviceType: 'desktop' | 'mobile') => {
  cancelProvision()
  const otherDevice = {...makeDevice(), type: otherDeviceType}
  let pendingResponse: CommonResponseHandler | undefined
  let userCancelled = false
  const handles = makeHandles()
  const wasCancelled = () => userCancelled

  const f = async () => {
    // Cancel kills this run: any prompt arriving afterwards is auto-rejected so the RPC ends. The
    // pending response (if any) is rejected now, which is also what stops a run a newer one replaces.
    handles.set(
      slots.cancel,
      wrapErrors(() => {
        userCancelled = true
        useWaitingState.getState().dispatch.clear(waitingKeyProvision)
        const pending = pendingResponse
        pendingResponse = undefined
        if (pending) {
          cancelOnCallback(undefined, pending)
        }
      })
    )
    try {
      await T.RPCGen.deviceDeviceAddRpcListener({
        customResponseIncomingCallMap: {
          'keybase.1.provisionUi.DisplayAndPromptSecret': (params, response) => {
            if (userCancelled) {
              cancelOnCallback(undefined, response)
              return
            }
            const {phrase, previousErr} = params
            pendingResponse = response
            handles.set(
              slots.submitTextCode,
              wrapErrors((code: string) => {
                pendingResponse = undefined
                const good = code.replace(/\W+/g, ' ').trim()
                response.result({phrase: good, secret: null as unknown as Uint8Array})
              })
            )
            navigateAppend(
              {
                name: 'codePage',
                params: {error: previousErr || undefined, otherDevice, textCode: phrase},
              },
              !!previousErr
            )
          },
          'keybase.1.provisionUi.chooseDeviceType': (_params, response) => {
            switch (otherDeviceType) {
              case 'mobile':
                response.result(T.RPCGen.DeviceType.mobile)
                break
              case 'desktop':
                response.result(T.RPCGen.DeviceType.desktop)
                break
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
      handles.dispose()
    }
    // A cancelled (or superseded) run must not clear modals: by now the user has either navigated
    // away or a newer run owns the screens, and this would close the newer run's UI.
    if (!wasCancelled()) {
      clearModals()
    }
  }
  ignorePromise(f())
}
