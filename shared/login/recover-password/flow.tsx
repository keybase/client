import * as T from '@/constants/types'
import {
  clearModals,
  getModalStack,
  navigateAppend,
  navigateAppendOnceRootHas,
  navigateUp,
  removeTopRootRoutes,
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

type PgpPrompt = {
  respond: (proceed: boolean) => void
  // Stops a warning that is still waiting for the logged-in root from being shown.
  cancelShow: () => void
}
// One startRecoverPassword. Only the latest run, `currentRun`, is current; a restart supersedes the one
// before it.
type Run = {
  // The PGP prompts of this run Go is still waiting on, by the id their warning screen carries.
  prompts: Map<number, PgpPrompt>
}

// Every prompt of an older run was settled when it was superseded, and every prompt of an ended run when it
// ended, so the current run holds every prompt still pending. A screen whose prompt is gone finds no entry,
// so it can never answer another prompt.
let currentRun: Run | undefined
let lastPgpPromptID = 0

const isPgpWarningFor = (ids: ReadonlySet<number>) => (route: RootRoute) =>
  route.name === 'recoverPasswordPgpWarning' &&
  !!route.params &&
  'pgpPromptID' in route.params &&
  ids.has(route.params.pgpPromptID as number)

// Takes a prompt out of the run, so nothing can answer it any more. Returns it if it was still pending.
const takePgp = (run: Run, id: number) => {
  const prompt = run.prompts.get(id)
  if (!prompt) return undefined
  run.prompts.delete(id)
  prompt.cancelShow()
  return prompt
}

// The one way a PGP prompt is answered: settles it once. Returns whether it was still pending.
const settlePgp = (run: Run, id: number, proceed: boolean) => {
  const prompt = takePgp(run, id)
  prompt?.respond(proceed)
  return !!prompt
}

// Declines every pending prompt of the run, and returns their ids, whose warnings may be on screen.
const declineAllPgp = (run: Run) => {
  const ids = new Set(run.prompts.keys())
  ids.forEach(id => settlePgp(run, id, false))
  return ids
}

// Takes every pending prompt of the run without answering Go, and returns their ids.
const abandonAllPgp = (run: Run) => {
  const ids = new Set(run.prompts.keys())
  ids.forEach(id => takePgp(run, id))
  return ids
}

// Takes these prompts' warnings away where they are on top. A warning under another modal stays (removing it
// would abort the app on iOS) and closes itself once it is uncovered: see isRecoverPasswordPgpPending.
const removePgpWarnings = (ids: ReadonlySet<number>) => {
  if (ids.size) {
    removeTopRootRoutes(isPgpWarningFor(ids))
  }
}

// Whether Go is still waiting on this prompt. A warning whose prompt is no longer pending has nothing to ask.
export const isRecoverPasswordPgpPending = (id: number) => !!currentRun?.prompts.has(id)

// Answers a prompt from its warning screen, then takes away that prompt's warning and nothing else.
// `screenRemoving` is for a warning the user is already taking away, which must not be navigated again.
export const answerRecoverPasswordPgp = (id: number, proceed: boolean, screenRemoving?: 'screenRemoving') => {
  if (!currentRun || !settlePgp(currentRun, id, proceed)) return
  if (!screenRemoving) {
    removePgpWarnings(new Set([id]))
  }
}

// The flow's own modals an error takes the place of when one of them is on top.
const errorReplaces = new Set(['recoverPasswordSetPassword', 'recoverPasswordErrorModal'])

export const startRecoverPassword = ({
  abortProvisioning,
  onResetEmailSent,
  replaceRoute,
  username,
}: StartRecoverPasswordParams) => {
  // A restart abandons the old run, which would leave Go waiting on its prompts.
  if (currentRun) {
    removePgpWarnings(declineAllPgp(currentRun))
  }
  const run: Run = {prompts: new Map()}
  currentRun = run
  clearOwner(owner)
  const f = async () => {
    if (abortProvisioning) {
      cancelProvision()
    }
    let active = true
    // Anything thrown that is not an RPCError ends the run with no screen of its own.
    let failure: RPCError | 'unexpected' | undefined
    let unexpectedError: unknown
    // A logout from elsewhere unmounts the warnings without a beforeRemove, so their prompts are declined
    // here. Not on a screen's unmount: a covered modal can lose its effects while it is still on the stack.
    // Not on an account switch starting, whose store reset also drops loggedIn: declining makes Go log out,
    // which could race the switched-to account's login. The switch cancels the run, whose end drops them.
    const unsubscribeConfig = useConfigState.subscribe((s, prev) => {
      if (prev.loggedIn && !s.loggedIn && !s.userSwitching) {
        removePgpWarnings(declineAllPgp(run))
      }
    })
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
            const respond = wrapErrors((proceed: boolean) => response.result(proceed))
            if (currentRun !== run) {
              respond(false)
              return
            }
            const id = ++lastPgpPromptID
            const prompt: PgpPrompt = {cancelShow: () => {}, respond}
            run.prompts.set(id, prompt)
            // Go asks right after the paper key logs in, which can be before the app has mounted the
            // logged-in root that this modal lives on. A push before that would land nowhere. The wait has
            // no deadline of its own: the run ending, a restart or a logout settles the prompt and stops it.
            prompt.cancelShow = navigateAppendOnceRootHas(
              'loggedIn',
              {name: 'recoverPasswordPgpWarning', params: {pgpPromptID: id}},
              'untilCancelled'
            )
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
      if (error instanceof RPCError) {
        failure = error
      } else {
        failure = 'unexpected'
        unexpectedError = error
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
      unsubscribeConfig()
    }
    // A superseded run's prompts were settled by the restart, and the screens now belong to the newer run.
    if (currentRun !== run) return
    // Go stopped waiting with the run. Under an account switch Go is not answered at all: a decline makes it
    // log out, which could race the switched-to account's login.
    const unanswered = useConfigState.getState().userSwitching ? abandonAllPgp(run) : declineAllPgp(run)
    if (failure === 'unexpected') {
      logger.warn('recover password failed unexpectedly', unexpectedError)
      removePgpWarnings(unanswered)
      return
    }
    logger.info(`finished ${failure ? 'with error' : 'without error'}`)
    if (!failure) {
      clearModals()
      return
    }
    logger.warn('RPC returned error: ' + failure.message)
    if (failure.code === T.RPCGen.StatusCode.sccanceled || failure.code === T.RPCGen.StatusCode.scinputcanceled) {
      removePgpWarnings(unanswered)
      return
    }
    if (!useConfigState.getState().loggedIn) {
      removePgpWarnings(unanswered)
      navigateAppend({name: 'recoverPasswordError', params: {error: failure.message}}, true)
      return
    }
    // Logged in, the flow's screens are modals: the error takes the place of the flow's own modal on top,
    // and goes over anything else rather than replacing it. Read before anything is removed, and removed
    // together with the unanswered warnings above it in one step. Anything under another modal stays.
    const isUnansweredWarning = isPgpWarningFor(unanswered)
    const top = getModalStack()
      .filter(r => !isUnansweredWarning(r))
      .at(-1)
    const replaced = top && errorReplaces.has(top.name) ? top.key : undefined
    removeTopRootRoutes(r => isUnansweredWarning(r) || (replaced !== undefined && r.key === replaced))
    navigateAppend({name: 'recoverPasswordErrorModal', params: {error: failure.message}})
  }
  ignorePromise(f())
}
