import * as T from '@/constants/types'
import {clearModals, getVisibleScreen, navigateAppend, navigateUp, removeRootRoutes} from '@/constants/router'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import logger from '@/logger'
import {startAccountReset} from '@/login/reset/account-reset'
import {useConfigState} from '@/stores/config'
import {callNamed, clearOwner, setNamedScoped} from '@/stores/flow-handles'
import {cancelProvision} from '@/provision/flow'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {RPCError} from '@/util/errors'
import type {RootRoute} from '@/constants/navigator'

type StartRecoverPasswordParams = {
  abortProvisioning?: boolean
  onResetEmailSent?: () => void
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

// Each PGP prompt Go is still waiting on, by the id its warning screen carries. A screen whose prompt is gone
// finds no entry, so it can never answer another prompt.
const pendingPgpPrompts = new Map<number, (proceed: boolean) => void>()
let lastPgpPromptID = 0

const isPgpWarningFor = (id: number) => (route: RootRoute) =>
  route.name === 'recoverPasswordPgpWarning' && !!route.params && 'pgpPromptID' in route.params && route.params.pgpPromptID === id

// The one way a PGP prompt is answered. Settles once, then takes away that prompt's warning and nothing else.
// `screenRemoving` is for a warning the user is already taking away, which must not be navigated again.
export const answerRecoverPasswordPgp = (id: number, proceed: boolean, screenRemoving?: 'screenRemoving') => {
  const respond = pendingPgpPrompts.get(id)
  if (!respond) return
  pendingPgpPrompts.delete(id)
  respond(proceed)
  if (!screenRemoving) {
    removeRootRoutes(isPgpWarningFor(id))
  }
}

export const startRecoverPassword = ({
  abortProvisioning,
  onResetEmailSent,
  replaceRoute,
  username,
}: StartRecoverPasswordParams) => {
  // A restart abandons the old run, which would leave Go waiting on its prompts.
  for (const id of [...pendingPgpPrompts.keys()]) {
    answerRecoverPasswordPgp(id, false)
  }
  clearOwner(owner)
  const f = async () => {
    if (abortProvisioning) {
      cancelProvision()
    }
    let active = true
    let failure: RPCError | undefined
    const pgpPromptIDs: Array<number> = []
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
          'keybase.1.loginUi.promptPassphraseRecovery': (_params, response) => {
            // Declining makes Go cancel silently (sccanceled) and log back out.
            const id = ++lastPgpPromptID
            pendingPgpPrompts.set(id, wrapErrors((proceed: boolean) => response.result(proceed)))
            pgpPromptIDs.push(id)
            navigateAppend({name: 'recoverPasswordPgpWarning', params: {pgpPromptID: id}})
          },
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
                  startRecoverPassword({onResetEmailSent, replaceRoute: true, username})
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
                  params: {error: params.pinentry.retryLabel || undefined},
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
      failure = error
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
      // Go stopped waiting with the run. Done before the error screen below, so that screen never has a
      // live warning under or over it.
      for (const id of pgpPromptIDs) {
        answerRecoverPasswordPgp(id, false)
      }
    }
    if (failure) {
      logger.warn('RPC returned error: ' + failure.message)
      if (!(failure.code === T.RPCGen.StatusCode.sccanceled || failure.code === T.RPCGen.StatusCode.scinputcanceled)) {
        const loggedIn = useConfigState.getState().loggedIn
        // Logged in, the flow's screens are modals: the error takes the place of one of them, and goes over
        // anything else rather than replacing it.
        const top = getVisibleScreen(true)?.name
        navigateAppend(
          {
            name: loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError',
            params: {error: failure.message},
          },
          !loggedIn || top === 'recoverPasswordSetPassword' || top === 'recoverPasswordErrorModal'
        )
      }
    }
    logger.info(`finished ${failure ? 'with error' : 'without error'}`)
    if (!failure) {
      clearModals()
    }
  }
  ignorePromise(f())
}
