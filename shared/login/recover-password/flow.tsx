import * as T from '@/constants/types'
import {
  clearModals,
  getVisibleScreen,
  navigateAppend,
  navigateAppendOnceRootHas,
  navigateUp,
} from '@/constants/router'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import {openDialog, type Dialog, type DialogEvent, type Prompt} from '@/engine/dialog'
import logger from '@/logger'
import {startAccountReset} from '@/login/reset/account-reset'
import {useConfigState} from '@/stores/config'
import {cancelProvision} from '@/provision/flow'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {RPCError} from '@/util/errors'

type StartRecoverPasswordParams = {
  abortProvisioning?: boolean
  onResetEmailSent?: () => void
  replaceRoute?: boolean
  username: string
}

const chooseDevice = 'keybase.1.loginUi.chooseDeviceToRecoverWith'
const promptPgp = 'keybase.1.loginUi.promptPassphraseRecovery'
const promptReset = 'keybase.1.loginUi.promptResetAccount'
const getPassphrase = 'keybase.1.secretUi.getPassphrase'
const explainDevice = 'keybase.1.loginUi.explainDeviceRecovery'

type RecoverPrompt = typeof chooseDevice | typeof promptPgp | typeof promptReset | typeof getPassphrase
type RecoverDialog = Dialog<void, RecoverPrompt, typeof explainDevice>
type Run = {dialog: RecoverDialog; onResetEmailSent?: () => void; username: string}

// The run the screens answer. Kept outside the stores: the run logs the user in, and the logout
// before that must not stop its screens from answering it. A restart disposes it first.
let current: Run | undefined

const pgpWarningName = 'recoverPasswordPgpWarning'
// How long a modal may wait for the logged-in root before navigateAppendOnceRootHas drops it.
const loggedInRootTimeoutMs = 5000
const pgpMountTimers = new Map<number, ReturnType<typeof setTimeout>>()

const restart = (run: Run) =>
  startRecoverPassword({onResetEmailSent: run.onResetEmailSent, replaceRoute: true, username: run.username})

// The prompt's own back: what each screen's cancel does
export const cancelRecoverPassword = (promptId: number) => {
  const run = current
  if (!run) return
  if (run.dialog.prompt(promptId, chooseDevice)?.cancel()) {
    navigateUp()
    return
  }
  const passphrase = run.dialog.prompt(promptId, getPassphrase)
  if (passphrase?.cancel()) {
    if (passphrase.params.pinentry.type === T.RPCGen.PassphraseType.paperKey) {
      restart(run)
    }
    return
  }
  if (run.dialog.prompt(promptId, promptReset)?.answer(T.RPCGen.ResetPromptResponse.nothing)) {
    navigateUp()
  }
}

export const isRecoverPasswordPromptOpen = (promptId: number) =>
  !!current?.dialog.openPrompts().some(p => p.id === promptId)

// Refuses the prompt and navigates nowhere: its screen is already going away
export const refuseRecoverPasswordPrompt = (promptId: number) => {
  current?.dialog
    .openPrompts()
    .find(p => p.id === promptId)
    ?.cancel()
}

export const submitRecoverPasswordDeviceSelect = (promptId: number, deviceID?: T.Devices.DeviceID) => {
  if (deviceID) {
    current?.dialog.prompt(promptId, chooseDevice)?.answer(deviceID)
  } else {
    cancelRecoverPassword(promptId)
  }
}
export const submitRecoverPasswordNoDevice = (promptId: number) => {
  current?.dialog.prompt(promptId, chooseDevice)?.answer('' as T.Devices.DeviceID)
}
export const submitRecoverPasswordPaperKey = (promptId: number, passphrase: string) => {
  current?.dialog.prompt(promptId, getPassphrase)?.answer({passphrase, storeSecret: false})
}
export const submitRecoverPasswordPassword = (promptId: number, passphrase: string) => {
  current?.dialog.prompt(promptId, getPassphrase)?.answer({passphrase, storeSecret: true})
}
export const submitRecoverPasswordReset = (promptId: number, action: T.RPCGen.ResetPromptResponse) => {
  const run = current
  if (run?.dialog.prompt(promptId, promptReset)?.answer(action)) {
    run.onResetEmailSent?.()
    navigateUp()
  }
}

export const isRecoverPasswordPgpPending = (id: number) => !!current?.dialog.prompt(id, promptPgp)

// The warning screen reports its mount: from then on the user has it and the push timeout is moot.
export const markRecoverPasswordPgpShown = (id: number) => {
  clearTimeout(pgpMountTimers.get(id))
  pgpMountTimers.delete(id)
}

// true continues to set-password; false makes Go cancel and log back out.
export const answerRecoverPasswordPgp = (id: number, proceed: boolean) => {
  current?.dialog.prompt(id, promptPgp)?.answer(proceed)
}

// A warning under another modal stays: removing a covered modal crashes iOS.
const takeWarningOffTop = () => {
  if (getVisibleScreen(true)?.name === pgpWarningName) {
    navigateUp()
  }
}

const showPgpWarning = (prompt: Prompt<typeof promptPgp>) => {
  const {id} = prompt
  // The push below gives up silently after its timeout; decline rather than leave Go waiting.
  // The warning mounting clears this, so it only fires for a warning that never appeared.
  pgpMountTimers.set(
    id,
    setTimeout(() => {
      pgpMountTimers.delete(id)
      prompt.answer(false)
    }, loggedInRootTimeoutMs)
  )
  void prompt.closed.then(() => markRecoverPasswordPgpShown(id))
  // The paper key has just logged the user in, so the logged-in root this modal lives on may not be
  // mounted yet.
  navigateAppendOnceRootHas('loggedIn', {name: pgpWarningName, params: {id}}, loggedInRootTimeoutMs)
}

export const startRecoverPassword = ({
  abortProvisioning,
  onResetEmailSent,
  replaceRoute,
  username,
}: StartRecoverPasswordParams) => {
  const previous = current
  if (previous) {
    // Answered rather than refused, as the warning's own decline would be
    if (previous.dialog.openPrompt(promptPgp)?.answer(false)) {
      takeWarningOffTop()
    }
    previous.dialog.dispose()
  }
  if (abortProvisioning) {
    cancelProvision()
  }
  const dialog: RecoverDialog = openDialog(
    'keybase.1.login.recoverPassphrase',
    {username},
    {
      // Not an enabled call; sent after a reset-password confirm, whose screen already moved on
      globalFallthrough: ['keybase.1.loginUi.displayResetMessage'],
      notices: [explainDevice],
      prompts: [chooseDevice, promptPgp, promptReset, getPassphrase],
      waitingKey: waitingKeyRecoverPassword,
    }
  )
  const run: Run = {dialog, onResetEmailSent, username}
  current = run
  let pgp: Prompt<typeof promptPgp> | undefined

  const showEvent = (e: DialogEvent<RecoverPrompt, typeof explainDevice>) => {
    // A dispose between the dequeue and here closed it
    if (e.kind === 'prompt' && !e.open) {
      return
    }
    if (e.kind === 'notice') {
      navigateAppend(
        {
          name: 'recoverPasswordExplainDevice',
          params: {deviceName: e.params.name, deviceType: e.params.kind, username},
        },
        true
      )
      return
    }
    switch (e.method) {
      case chooseDevice: {
        const devices = (e.params.devices || []).map(d => rpcDeviceToDevice(d))
        navigateAppend(
          {name: 'recoverPasswordDeviceSelector', params: {devices, promptId: e.id}},
          !!replaceRoute
        )
        break
      }
      case promptPgp:
        pgp = e
        showPgpWarning(e)
        break
      case promptReset:
        if (e.params.prompt.t === T.RPCGen.ResetPromptType.enterResetPw) {
          navigateAppend({name: 'recoverPasswordPromptResetPassword', params: {promptId: e.id, username}})
        } else {
          startAccountReset(true, username)
          e.answer(T.RPCGen.ResetPromptResponse.nothing)
        }
        break
      case getPassphrase: {
        const error = e.params.pinentry.retryLabel || undefined
        if (e.params.pinentry.type === T.RPCGen.PassphraseType.paperKey) {
          navigateAppend({name: 'recoverPasswordPaperKey', params: {error, promptId: e.id}}, true)
        } else if (error) {
          navigateAppend({name: 'recoverPasswordSetPassword', params: {error, promptId: e.id}}, true)
        } else {
          // Asked after the paper key logged the user in, so the logged-in root this modal lives on
          // may not be mounted yet. A screen that never appears can't be answered: refuse it.
          const prompt = e
          navigateAppendOnceRootHas(
            'loggedIn',
            {name: 'recoverPasswordSetPassword', params: {error: undefined, promptId: e.id}},
            loggedInRootTimeoutMs,
            () => prompt.cancel()
          )
        }
        break
      }
    }
  }

  const showPrompts = async () => {
    for await (const e of dialog.events) {
      try {
        showEvent(e)
      } catch (error) {
        // Leaving the loop disposes the run, whose catch then stays quiet
        logger.error(`recover password: showing ${e.method} failed`, error)
        throw error
      }
    }
  }

  const f = async () => {
    let hadError = false
    try {
      await Promise.all([showPrompts(), dialog.done])
      logger.info('Recovered account')
    } catch (error) {
      // A restart disposed this run and took over the screens, maybe after its RPC had already failed
      if (dialog.disposed) {
        return
      }
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
      if (current === run) {
        current = undefined
      }
      // The session settled a warning still unanswered when the run ended; nothing is left to answer
      if (pgp && (await pgp.closed) === 'ended' && !dialog.disposed) {
        takeWarningOffTop()
      }
    }
    logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
    if (!hadError && !dialog.disposed) {
      clearModals()
    }
  }
  ignorePromise(f())
}
