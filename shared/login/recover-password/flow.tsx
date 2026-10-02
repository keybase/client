import * as T from '@/constants/types'
import {
  clearModals,
  getVisibleScreen,
  navigateAppend,
  navigateAppendOnceRootHas,
  navigateUp,
} from '@/constants/router'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import logger from '@/logger'
import {startAccountReset} from '@/login/reset/account-reset'
import {useConfigState} from '@/stores/config'
import {callNamed, clearOwner, setNamedScoped} from '@/stores/flow-handles'
import {cancelProvision} from '@/provision/flow'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {RPCError} from '@/util/errors'

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

// Go asks the PGP question at most once per run and waits for the answer, so at most one is pending.
// Each warning screen carries its prompt's id and answers only that prompt.
type PgpPrompt = {
  answer: (proceed: boolean) => void
  id: number
  timer: ReturnType<typeof setTimeout>
}
let pendingPgp: PgpPrompt | undefined
let lastPgpId = 0
const pgpWarningName = 'recoverPasswordPgpWarning'
// How long the warning may wait for the logged-in root before navigateAppendOnceRootHas drops it.
const pgpWarningMountTimeoutMs = 5000

export const isRecoverPasswordPgpPending = (id: number) => pendingPgp?.id === id

// undefined settles without answering: the run's RPC is over and nothing on Go's side is listening.
const settlePgp = (id: number, proceed: boolean | undefined) => {
  const prompt = pendingPgp
  if (prompt?.id !== id) return
  pendingPgp = undefined
  clearTimeout(prompt.timer)
  if (proceed !== undefined) {
    prompt.answer(proceed)
  }
}

// The warning screen reports its mount: from then on the user has it and the push timeout is moot.
export const markRecoverPasswordPgpShown = (id: number) => {
  if (pendingPgp?.id === id) {
    clearTimeout(pendingPgp.timer)
  }
}

export const answerRecoverPasswordPgp = (id: number, proceed: boolean) => settlePgp(id, proceed)

// Settles the pending prompt and takes its warning away if it is on top. A warning under another modal
// stays: removing a covered modal crashes iOS.
const endPgp = (proceed: false | undefined, id: number | undefined) => {
  if (id === undefined || !isRecoverPasswordPgpPending(id)) return
  settlePgp(id, proceed)
  if (getVisibleScreen(true)?.name === pgpWarningName) {
    navigateUp()
  }
}

export const startRecoverPassword = ({
  abortProvisioning,
  onResetEmailSent,
  replaceRoute,
  username,
}: StartRecoverPasswordParams) => {
  // The previous run's RPC is still live and waiting on its answer.
  endPgp(false, pendingPgp?.id)
  clearOwner(owner)
  let runPgpId: number | undefined
  const f = async () => {
    if (abortProvisioning) {
      cancelProvision()
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
          'keybase.1.loginUi.promptPassphraseRecovery': (_params, response) => {
            // The listener runs handlers a tick late, so the run may have ended since Go asked.
            if (!isActive()) return
            // true continues to set-password; false makes Go cancel and log back out.
            endPgp(false, pendingPgp?.id)
            const id = ++lastPgpId
            runPgpId = id
            pendingPgp = {
              answer: wrapErrors((proceed: boolean) => response.result(proceed)),
              id,
              // The push below gives up silently after its timeout; decline rather than leave Go waiting.
              // The warning mounting clears this, so it only fires for a warning that never appeared.
              timer: setTimeout(() => settlePgp(id, false), pgpWarningMountTimeoutMs),
            }
            // The paper key has just logged the user in, so the logged-in root this modal lives on may not
            // be mounted yet.
            navigateAppendOnceRootHas('loggedIn', {name: pgpWarningName, params: {id}}, pgpWarningMountTimeoutMs)
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
      if (!(error instanceof RPCError)) {
        logger.warn('recover password failed unexpectedly', error)
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
      // Go stopped waiting with the run, so a prompt still pending is settled without an answer: one sent
      // now would leave the RPC counted as waiting on a server that has nothing more to send.
      // A run that never got a prompt has no id: defaulting would settle another run's prompt.
      if (runPgpId !== undefined) {
        endPgp(undefined, runPgpId)
      }
    }
    logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
    if (!hadError) {
      clearModals()
    }
  }
  ignorePromise(f())
}
