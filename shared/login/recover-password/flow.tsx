import * as T from '@/constants/types'
import {
  clearModals,
  getVisibleScreen,
  navigateAppend,
  navigateAppendOnceRootHas,
  navigateUp,
  replaceTopOrPush,
} from '@/constants/router'
import {isLoggedIn} from '@/constants/nav-tree'
import {waitingKeyRecoverPassword} from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import {openDialog, type Dialog, type DialogEvent, type Prompt} from '@/engine/dialog'
import logger from '@/logger'
import {startAccountReset} from '@/login/reset/account-reset'
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
// ended settles once the run is over
type Run = {dialog: RecoverDialog; ended?: Promise<void>; onResetEmailSent?: () => void; username: string}

// The run the screens answer. Kept outside the stores: the run logs the user in, and the logout
// before that must not stop its screens from answering it. A restart disposes it first.
let current: Run | undefined
// Who started the latest run, kept after it ends so a back that starts over still tells that caller
let caller: Pick<StartRecoverPasswordParams, 'onResetEmailSent' | 'username'> | undefined

const pgpWarningName = 'recoverPasswordPgpWarning'
// How long a modal may wait for the logged-in root before navigateAppendOnceRootHas drops it.
const loggedInRootTimeoutMs = 5000
const pgpMountTimers = new Map<number, ReturnType<typeof setTimeout>>()

// A screen's back that starts the flow over, in place of the screen
export const restartRecoverPassword = (username: string) =>
  startRecoverPassword({
    onResetEmailSent: caller?.username === username ? caller.onResetEmailSent : undefined,
    replaceRoute: true,
    username,
  })

// The back of the device selector, which goes back a screen, and of the paper key, which starts over
export const cancelRecoverPassword = (promptId: number) => {
  const run = current
  if (!run) return
  if (run.dialog.prompt(promptId, chooseDevice)?.cancel()) {
    navigateUp()
  } else if (run.dialog.prompt(promptId, getPassphrase)?.cancel()) {
    restartRecoverPassword(run.username)
  }
}

export const isRecoverPasswordPromptOpen = (promptId: number) =>
  !!current?.dialog.openPrompts().some(p => p.id === promptId)

// Settles when the run the open prompt belongs to is over; undefined once the prompt is closed
export const recoverPasswordRunEnded = (promptId: number): Promise<void> | undefined =>
  isRecoverPasswordPromptOpen(promptId) ? current?.ended : undefined

// Prompts of this run that a screen answered. Their screens stay while the service works on the answer.
const answeredByScreen = new Set<number>()
const noteAnswer = (promptId: number, answered: boolean | undefined) => {
  if (answered) {
    answeredByScreen.add(promptId)
  }
}

// The prompt settled without its screen's answer (before the screen appeared, or by a restart or the
// run ending), so the screen has nothing left to do
export const isRecoverPasswordPromptGone = (promptId: number) =>
  !isRecoverPasswordPromptOpen(promptId) && !answeredByScreen.has(promptId)

// Declines the prompt and navigates nowhere: its screen is already going away. The PGP warning is
// answered false, which makes Go cancel and log back out; any other prompt is refused.
export const declineRecoverPasswordPrompt = (promptId: number) => {
  const run = current
  if (!run || run.dialog.prompt(promptId, promptPgp)?.answer(false)) return
  run.dialog
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
  noteAnswer(promptId, current?.dialog.prompt(promptId, getPassphrase)?.answer({passphrase, storeSecret: true}))
}
export const submitRecoverPasswordReset = (promptId: number, action: T.RPCGen.ResetPromptResponse) => {
  const run = current
  if (run?.dialog.prompt(promptId, promptReset)?.answer(action)) {
    run.onResetEmailSent?.()
    navigateUp()
  }
}

// The warning screen reports its mount: from then on the user has it and the push timeout is moot.
export const markRecoverPasswordPgpShown = (id: number) => {
  clearTimeout(pgpMountTimers.get(id))
  pgpMountTimers.delete(id)
}

// Goes on to set the new password, giving up the PGP keys stored with the old one
export const continueRecoverPasswordPgp = (promptId: number) => {
  noteAnswer(promptId, current?.dialog.prompt(promptId, promptPgp)?.answer(true))
}

// A warning under another modal stays: removing a covered modal crashes iOS.
const takeWarningOffTop = () => {
  if (getVisibleScreen(true)?.name === pgpWarningName) {
    navigateUp()
  }
}

const showPgpWarning = (prompt: Prompt<typeof promptPgp>) => {
  const {id} = prompt
  // A warning pushed but never mounted can't be answered; decline rather than leave Go waiting.
  // The warning mounting clears this.
  pgpMountTimers.set(
    id,
    setTimeout(() => {
      pgpMountTimers.delete(id)
      prompt.answer(false)
    }, loggedInRootTimeoutMs)
  )
  void prompt.closed.then(() => markRecoverPasswordPgpShown(id))
  // The paper key has just logged the user in, so the logged-in root this modal lives on may not be
  // mounted yet. A warning that can't be pushed is declined.
  navigateAppendOnceRootHas('loggedIn', {name: pgpWarningName, params: {promptId: id}}, loggedInRootTimeoutMs, () =>
    prompt.answer(false)
  )
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
  answeredByScreen.clear()
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
  caller = {onResetEmailSent, username}
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
        // Over the root that is mounted, which can still be the logged-out one just after the paper
        // key logged the user in
        replaceTopOrPush(root =>
          isLoggedIn(root)
            ? {name: 'recoverPasswordErrorModal', params: {error: error.message}}
            : {name: 'recoverPasswordError', params: {error: error.message}}
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
  run.ended = f()
  ignorePromise(run.ended)
}
