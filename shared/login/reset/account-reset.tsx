import {navigateAppend, navUpToScreen} from '@/constants/router'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {openDialog, type Dialog} from '@/engine/dialog'
import logger from '@/logger'
import {startProvision} from '@/provision/flow'
import {RPCError} from '@/util/errors'

type EnterResetPipelineParams = {
  onError?: (error: string) => void
  password?: string
  username: string
}

const promptResetAccount = 'keybase.1.loginUi.promptResetAccount'
const displayResetProgress = 'keybase.1.loginUi.displayResetProgress'

type ResetDialog = Dialog<void, typeof promptResetAccount, typeof displayResetProgress>
type ResetRun = {dialog: ResetDialog; username: string}

// Kept outside the stores: the pipeline runs across the logout it can lead to, and the confirm
// screen's answer must still reach it
const runs = new Set<ResetRun>()

export const startAccountReset = (skipPassword: boolean, username: string) => {
  navigateAppend({name: 'recoverPasswordPromptResetAccount', params: {skipPassword, username}}, true)
}

export const enterResetPipeline = ({onError, password = '', username}: EnterResetPipelineParams) => {
  onError?.('')
  const dialog: ResetDialog = openDialog(
    'keybase.1.account.enterResetPipeline',
    {interactive: false, passphrase: password, usernameOrEmail: username},
    {
      // Not an enabled call; the screens that follow come from promptResetAccount and displayResetProgress
      globalFallthrough: ['keybase.1.loginUi.displayResetMessage'],
      notices: [displayResetProgress],
      prompts: [promptResetAccount],
      waitingKey: S.waitingKeyAutoresetEnterPipeline,
    }
  )
  const run: ResetRun = {dialog, username}
  runs.add(run)

  const showPrompts = async () => {
    for await (const e of dialog.events) {
      // A dispose between the dequeue and here closed it
      if (e.kind === 'prompt' && !e.open) {
        continue
      }
      if (e.kind === 'notice') {
        const {endTime, needVerify} = e.params
        navigateAppend(
          {
            name: 'resetWaiting',
            params: {endTime: needVerify ? undefined : endTime * 1000, pipelineStarted: !needVerify, username},
          },
          true
        )
      } else if (e.params.prompt.t === T.RPCGen.ResetPromptType.complete) {
        const {hasWallet} = e.params.prompt.complete
        logger.info('Showing final reset screen')
        navigateAppend({name: 'resetConfirm', params: {hasWallet, promptId: e.id}}, true)
      } else {
        logger.info('Starting account reset process')
        e.answer(T.RPCGen.ResetPromptResponse.nothing)
        startAccountReset(true, username)
      }
    }
  }

  const f = async () => {
    try {
      await Promise.all([showPrompts(), dialog.done])
    } catch (error) {
      // A cancel, ours (an account switch cancels the session) or the service's, is not the user's error
      if (
        dialog.disposed ||
        !(error instanceof RPCError) ||
        error.code === T.RPCGen.StatusCode.sccanceled ||
        error.code === T.RPCGen.StatusCode.scinputcanceled
      ) {
        return
      }
      logger.warn('Error resetting account:', error)
      onError?.(error.desc)
    } finally {
      runs.delete(run)
    }
  }
  ignorePromise(f())
}

// Answers the confirm screen's prompt; nothing happens once the pipeline has moved past it
export const submitResetPrompt = (promptId: number, action: T.RPCGen.ResetPromptResponse) => {
  for (const {dialog, username} of runs) {
    if (dialog.prompt(promptId, promptResetAccount)?.answer(action)) {
      if (action === T.RPCGen.ResetPromptResponse.confirmReset) {
        startProvision(username, true)
      } else {
        navUpToScreen('login')
      }
      return
    }
  }
}
