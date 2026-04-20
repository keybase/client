import {navigateAppend, navUpToScreen} from '@/constants/router'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {consumeKeyed, registerKeyedScoped} from '@/stores/flow-handles'
import {useProvisionState} from '@/stores/provision'
import {RPCError} from '@/util/errors'

type EnterResetPipelineParams = {
  onError?: (error: string) => void
  password?: string
  username: string
}

const resetOwner = 'reset'
const resetPromptSlot = 'submitResetPrompt'

const registerResetPrompt = (handle: (action: T.RPCGen.ResetPromptResponse) => void) =>
  registerKeyedScoped(resetOwner, resetPromptSlot, handle)

export const startAccountReset = (skipPassword: boolean, username: string) => {
  navigateAppend({name: 'recoverPasswordPromptResetAccount', params: {skipPassword, username}}, true)
}

export const enterResetPipeline = ({onError, password = '', username}: EnterResetPipelineParams) => {
  onError?.('')
  const f = async () => {
    const pendingDisposers = new Set<() => void>()
    const promptReset = (
      params: T.RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
      response: {
        result: (reset: T.RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
      }
    ) => {
      if (params.prompt.t === T.RPCGen.ResetPromptType.complete) {
        const {hasWallet} = params.prompt.complete
        logger.info('Showing final reset screen')
        let disposeRegistration = () => {}
        const registration = registerResetPrompt((action: T.RPCGen.ResetPromptResponse) => {
          pendingDisposers.delete(disposeRegistration)
          response.result(action)
          if (action === T.RPCGen.ResetPromptResponse.confirmReset) {
            useProvisionState.getState().dispatch.startProvision(username, true)
          } else {
            navUpToScreen('login')
          }
        })
        disposeRegistration = registration.dispose
        pendingDisposers.add(disposeRegistration)
        navigateAppend({name: 'resetConfirm', params: {hasWallet, resetKey: registration.key}}, true)
      } else {
        logger.info('Starting account reset process')
        response.result(T.RPCGen.ResetPromptResponse.nothing)
        startAccountReset(true, username)
      }
    }

    try {
      await T.RPCGen.accountEnterResetPipelineRpcListener({
        customResponseIncomingCallMap: {'keybase.1.loginUi.promptResetAccount': promptReset},
        incomingCallMap: {
          'keybase.1.loginUi.displayResetProgress': params => {
            const endTime = params.needVerify ? undefined : params.endTime * 1000
            navigateAppend(
              {name: 'resetWaiting', params: {endTime, pipelineStarted: !params.needVerify, username}},
              true
            )
          },
        },
        params: {
          interactive: false,
          passphrase: password,
          usernameOrEmail: username,
        },
        waitingKey: S.waitingKeyAutoresetEnterPipeline,
      })
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      logger.warn('Error resetting account:', error)
      onError?.(error.desc)
    } finally {
      pendingDisposers.forEach(dispose => dispose())
      pendingDisposers.clear()
    }
  }
  ignorePromise(f())
}

export const submitResetPrompt = (resetKey: string, action: T.RPCGen.ResetPromptResponse) => {
  consumeKeyed(resetKey, action)
}
