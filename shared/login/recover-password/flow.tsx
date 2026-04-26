import * as T from '@/constants/types'
import {clearModals, navigateAppend, navigateUp} from '@/constants/router'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import logger from '@/logger'
import {startAccountReset} from '@/login/reset/account-reset'
import {useConfigState} from '@/stores/config'
import {callNamed, clearOwner, setNamedScoped} from '@/stores/flow-handles'
import {useProvisionState} from '@/stores/provision'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {RPCError} from '@/util/errors'

type StartRecoverPasswordParams = {
  abortProvisioning?: boolean
  onResetEmailSent?: (() => void) | undefined
  replaceRoute?: boolean
  username: string
}

const owner = 'recoverPassword'

const slots = {
  cancel: 'cancel',
  submitDeviceSelect: 'submitDeviceSelect',
  submitNoDevice: 'submitNoDevice',
  submitPaperKey: 'submitPaperKey',
  submitPassword: 'submitPassword',
  submitResetPassword: 'submitResetPassword',
} as const
type Slot = (typeof slots)[keyof typeof slots]
type ScopedHandle = ReturnType<typeof setNamedScoped>

export const cancelRecoverPassword = () => callNamed(owner, slots.cancel)
export const submitRecoverPasswordDeviceSelect = (deviceID?: T.Devices.DeviceID) =>
  callNamed(owner, slots.submitDeviceSelect, deviceID)
export const submitRecoverPasswordNoDevice = () => callNamed(owner, slots.submitNoDevice)
export const submitRecoverPasswordPaperKey = (paperKey: string) =>
  callNamed(owner, slots.submitPaperKey, paperKey)
export const submitRecoverPasswordPassword = (password: string) =>
  callNamed(owner, slots.submitPassword, password)
export const submitRecoverPasswordReset = (action: T.RPCGen.ResetPromptResponse) =>
  callNamed(owner, slots.submitResetPassword, action)

export const startRecoverPassword = ({
  abortProvisioning,
  onResetEmailSent,
  replaceRoute,
  username,
}: StartRecoverPasswordParams) => {
  clearOwner(owner)
  const f = async () => {
    if (abortProvisioning) {
      useProvisionState.getState().dispatch.dynamic.cancel?.()
    }
    let active = true
    let hadError = false
    const handles = new Map<Slot, ScopedHandle>()
    const isActive = () => active
    const clearSlots = (...slotNames: ReadonlyArray<Slot>) => {
      slotNames.forEach(slot => {
        const handle = handles.get(slot)
        if (handle) {
          handle.dispose()
          handles.delete(slot)
        }
      })
    }
    const setHandle = (slot: Slot, handle?: (...args: Array<any>) => void) => {
      if (!handle) {
        clearSlots(slot)
        return
      }
      const scoped = setNamedScoped(owner, slot, (...args: Array<any>) => {
        if (isActive()) {
          handle(...args)
        }
      })
      handles.set(slot, scoped)
    }
    try {
      await T.RPCGen.loginRecoverPassphraseRpcListener({
        customResponseIncomingCallMap: {
          'keybase.1.loginUi.chooseDeviceToRecoverWith': (params, response) => {
            const devices = (params.devices || []).map(d => rpcDeviceToDevice(d))
            const clear = () => clearSlots(slots.cancel, slots.submitDeviceSelect, slots.submitNoDevice)
            const cancel = wrapErrors(() => {
              clear()
              response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
              navigateUp()
            })
            setHandle(slots.cancel, cancel)
            setHandle(
              slots.submitDeviceSelect,
              wrapErrors((deviceID?: T.Devices.DeviceID) => {
                clear()
                if (deviceID) {
                  response.result(deviceID)
                } else {
                  cancel()
                }
              })
            )
            setHandle(
              slots.submitNoDevice,
              wrapErrors(() => {
                clear()
                response.result('' as T.Devices.DeviceID)
              })
            )
            navigateAppend({name: 'recoverPasswordDeviceSelector', params: {devices}}, !!replaceRoute)
          },
          'keybase.1.loginUi.promptPassphraseRecovery': () => {},
          'keybase.1.loginUi.promptResetAccount': (params, response) => {
            if (params.prompt.t === T.RPCGen.ResetPromptType.enterResetPw) {
              navigateAppend({name: 'recoverPasswordPromptResetPassword', params: {username}})
              const clear = () => clearSlots(slots.cancel, slots.submitResetPassword)
              setHandle(
                slots.submitResetPassword,
                wrapErrors((action: T.RPCGen.ResetPromptResponse) => {
                  clear()
                  response.result(action)
                  onResetEmailSent?.()
                  navigateUp()
                })
              )
              setHandle(
                slots.cancel,
                wrapErrors(() => {
                  clear()
                  response.result(T.RPCGen.ResetPromptResponse.nothing)
                  navigateUp()
                })
              )
            } else {
              startAccountReset(true, username)
              response.result(T.RPCGen.ResetPromptResponse.nothing)
            }
          },
          'keybase.1.secretUi.getPassphrase': (params, response) => {
            if (params.pinentry.type === T.RPCGen.PassphraseType.paperKey) {
              const clear = () => clearSlots(slots.cancel, slots.submitPaperKey)
              setHandle(
                slots.cancel,
                wrapErrors(() => {
                  clear()
                  response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                  startRecoverPassword({
                    replaceRoute: true,
                    username,
                    ...(onResetEmailSent === undefined ? {} : {onResetEmailSent}),
                  })
                })
              )
              setHandle(
                slots.submitPaperKey,
                wrapErrors((passphrase: string) => {
                  clear()
                  response.result({passphrase, storeSecret: false})
                })
              )
              navigateAppend(
                {
                  name: 'recoverPasswordPaperKey',
                  params: params.pinentry.retryLabel ? {error: params.pinentry.retryLabel} : {},
                },
                true
              )
            } else {
              const clear = () => clearSlots(slots.cancel, slots.submitPassword)
              setHandle(
                slots.cancel,
                wrapErrors(() => {
                  clear()
                  response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                })
              )
              setHandle(
                slots.submitPassword,
                wrapErrors((passphrase: string) => {
                  clear()
                  response.result({passphrase, storeSecret: true})
                })
              )
              if (!params.pinentry.retryLabel) {
                navigateAppend({name: 'recoverPasswordSetPassword', params: {}})
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
                params: {deviceName: params.name, deviceType: params.kind, username},
              },
              true
            )
          },
        },
        params: {username},
        waitingKey: waitingKeyRecoverPassword,
      })
      console.log('Recovered account')
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      hadError = true
      logger.warn('RPC returned error: ' + error.message)
      if (!(error.code === T.RPCGen.StatusCode.sccanceled || error.code === T.RPCGen.StatusCode.scinputcanceled)) {
        navigateAppend(
          {
            name: useConfigState.getState().loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError',
            params: {error: error.message},
          },
          true
        )
      }
    } finally {
      clearSlots(
        slots.cancel,
        slots.submitDeviceSelect,
        slots.submitNoDevice,
        slots.submitPaperKey,
        slots.submitPassword,
        slots.submitResetPassword
      )
      active = false
    }
    logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
    if (!hadError) {
      clearModals()
    }
  }
  ignorePromise(f())
}
