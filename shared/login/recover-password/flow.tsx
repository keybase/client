import * as T from '@/constants/types'
import {navigateAppend, navigateUp, navUpToScreen} from '@/constants/router'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import logger from '@/logger'
import {startAccountReset} from '@/login/reset/account-reset'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {loggedInPastRecovery, showLoggedInScreens} from '@/router-v2/account-switch'
import {callNamed, clearOwner, setNamedScoped} from '@/stores/flow-handles'
import {cancelProvision} from '@/provision/flow'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {isQuietCancel, RPCError} from '@/util/errors'

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
  submitPgpWarning: 'submitPgpWarning',
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
export const submitRecoverPasswordPgpWarning = () => callNamed(owner, slots.submitPgpWarning)
export const submitRecoverPasswordReset = (action: T.RPCGen.ResetPromptResponse) =>
  callNamed(owner, slots.submitResetPassword, action)

let lastRun = 0
const loggedInError = 'You are already logged in as a different user; try logout first'

export const startRecoverPassword = ({
  abortProvisioning,
  onResetEmailSent,
  replaceRoute,
  username,
}: StartRecoverPasswordParams) => {
  // Its prompts are only in the logged-out screens, and Go refuses a logged-in run anyway. A held
  // run's login (a session read after its paper key) is not a logged-in start.
  if (loggedInPastRecovery(useConfigState.getState())) {
    navigateAppend({name: 'recoverPasswordErrorModal', params: {error: loggedInError}})
    return
  }
  clearOwner(owner)
  const run = ++lastRun
  const f = async () => {
    if (abortProvisioning) {
      cancelProvision()
    }
    const configDispatch = useConfigState.getState().dispatch
    configDispatch.holdForRecoverPassword(run, true)
    let active = true
    let hadError = false
    // Go asks these only once the paper key has logged it in
    let askedAfterPaperKey = false as boolean
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
    // An answered screen stays up until Go's next prompt replaces it, and a back press meanwhile
    // finds no prompt to cancel. It declines that next prompt instead, which ends the run.
    let declineNextPrompt = false
    const cancelNextPrompt = () =>
      setHandle(slots.cancel, () => {
        clearSlots(slots.cancel)
        declineNextPrompt = true
      })
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
            // The listener runs handlers a tick late, so the run may have ended since Go asked.
            if (!isActive()) return
            askedAfterPaperKey = true
            // true continues to set-password; false makes Go cancel and log back out.
            const clear = () => clearSlots(slots.cancel, slots.submitPgpWarning)
            setHandle(
              slots.cancel,
              wrapErrors(() => {
                clear()
                response.result(false)
              })
            )
            setHandle(
              slots.submitPgpWarning,
              wrapErrors(() => {
                clear()
                response.result(true)
                cancelNextPrompt()
              })
            )
            navigateAppend({name: 'recoverPasswordPgpWarning', params: {}}, true)
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
              askedAfterPaperKey = true
              if (declineNextPrompt) {
                declineNextPrompt = false
                response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                return
              }
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
                  cancelNextPrompt()
                })
              )
              navigateAppend(
                {name: 'recoverPasswordSetPassword', params: {error: params.pinentry.retryLabel || undefined}},
                true
              )
            }
          },
        },
        // Not an enabled call; sent after a reset-password confirm, whose screen already moved on
        globalFallthrough: ['keybase.1.loginUi.displayResetMessage'],
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
      hadError = true
      if (!(error instanceof RPCError)) {
        logger.warn('recover password failed unexpectedly', error)
      } else {
        logger.warn('RPC returned error: ' + error.message)
        if (!isQuietCancel(error)) {
          navigateAppend(
            {
              name: showLoggedInScreens(useConfigState.getState()) ? 'recoverPasswordErrorModal' : 'recoverPasswordError',
              params: {error: error.message},
            },
            true
          )
        }
      }
    } finally {
      clearSlots(
        slots.cancel,
        slots.submitDeviceSelect,
        slots.submitNoDevice,
        slots.submitPaperKey,
        slots.submitPassword,
        slots.submitPgpWarning,
        slots.submitResetPassword
      )
      active = false
    }
    // Go's login notification and its reply to the run take separate paths, so the reply can come
    // first. The prompt screen stays until the session is read: logged in, the logged-in screens
    // replace it; otherwise the recovery screens go, rather than leave a prompt nothing answers.
    // Other successes (a device to recover with, a reset email) end on a screen meant to stay.
    if (!hadError && askedAfterPaperKey) {
      await useDaemonState.getState().dispatch.readSessionFromDaemon('password recovered')
      const config = useConfigState.getState()
      if (config.recoverPasswordHold === run && !config.loggedIn) {
        navUpToScreen('login')
      }
    } else if (hadError && askedAfterPaperKey) {
      // Go logs out after a failed run, but if that fails it is still logged in with the paper key;
      // read which so the screens match it
      await useDaemonState.getState().dispatch.readSessionFromDaemon('password recovery failed')
    }
    configDispatch.holdForRecoverPassword(run, false)
    logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
  }
  ignorePromise(f())
}
