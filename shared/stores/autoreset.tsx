import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {navigateAppend, navUpToScreen} from '@/constants/router'

type Store = T.Immutable<{
  active: boolean
  endTime: number
  error: string
}>

const initialStore: Store = {
  active: false,
  endTime: 0,
  error: '',
}

export type State = Store & {
  dispatch: {
    cancelReset: () => void
    defer: {
      onStartProvision: (username: string, fromReset: boolean) => void
    }
    dynamic: {
      submitResetPrompt?: (action: T.RPCGen.ResetPromptResponse) => void
    }
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
    resetAccount: (username: string, password?: string) => void
    startAccountReset: (skipPassword: boolean, username: string) => void
    updateARState: (active: boolean, endTime: number) => void
  }
}

export const useAutoResetState = Z.createZustand<State>('autoreset', (set, get) => {
  const dispatch: State['dispatch'] = {
    cancelReset: () => {
      set(s => {
        s.error = ''
      })
      const f = async () => {
        logger.info('Cancelled autoreset from logged-in user')
        try {
          await T.RPCGen.accountCancelResetRpcPromise(undefined, S.waitingKeyAutoresetCancel)
          set(s => {
            s.active = false
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.error('Error in CancelAutoreset', error)
          switch (error.code) {
            case T.RPCGen.StatusCode.scnosession:
              // We got logged out because we were revoked (which might have been
              // because the reset was completed and this device wasn't notified).
              return undefined
            case T.RPCGen.StatusCode.scnotfound:
              // "User not in autoreset queue."
              // do nothing, fall out of the catch block to cancel reset modal.
              break
            default:
              // Any other error - display a red bar in the modal.
              {
                const desc = error.desc
                set(s => {
                  s.error = desc
                })
              }
              return
          }
        }
      }
      ignorePromise(f())
    },
    defer: {
      onStartProvision: (_username: string, _fromReset: boolean) => {
        throw new Error('onStartProvision not properly initialized')
      },
    },
    dynamic: {
      submitResetPrompt: undefined,
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'keybase.1.NotifyBadges.badgeState': {
          const {badgeState} = action.payload.params
          const {resetState} = badgeState
          get().dispatch.updateARState(resetState.active, resetState.endTime)
          break
        }
        default:
      }
    },
    resetAccount: (username, password = '') => {
      set(s => {
        s.error = ''
      })
      const f = async () => {
        const promptReset = (
          params: T.RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
          response: {
            result: (reset: T.RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
          }
        ) => {
          if (params.prompt.t === T.RPCGen.ResetPromptType.complete) {
            const {hasWallet} = params.prompt.complete
            logger.info('Showing final reset screen')
            set(s => {
              s.dispatch.dynamic.submitResetPrompt = (action: T.RPCGen.ResetPromptResponse) => {
                set(s => {
                  s.dispatch.dynamic.submitResetPrompt = undefined
                })
                response.result(action)
                if (action === T.RPCGen.ResetPromptResponse.confirmReset) {
                  set(s => {
                    s.error = ''
                  })
                  get().dispatch.defer.onStartProvision(username, true)
                } else {
                  navUpToScreen('login')
                }
              }
            })
            navigateAppend({name: 'resetConfirm', params: {hasWallet}}, true)
          } else {
            logger.info('Starting account reset process')
            get().dispatch.startAccountReset(true, username)
          }
        }
        try {
          await T.RPCGen.accountEnterResetPipelineRpcListener({
            customResponseIncomingCallMap: {'keybase.1.loginUi.promptResetAccount': promptReset},
            incomingCallMap: {
              'keybase.1.loginUi.displayResetProgress': params => {
                if (!params.needVerify) {
                  set(s => {
                    s.endTime = params.endTime * 1000
                  })
                }
                navigateAppend(
                  {name: 'resetWaiting', params: {pipelineStarted: !params.needVerify, username}},
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
          set(s => {
            s.error = ''
          })
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => {
        Object.assign(s, initialStore)
        s.dispatch.dynamic.submitResetPrompt = undefined
      })
    },
    startAccountReset: (skipPassword, username) => {
      set(s => {
        s.error = ''
      })
      navigateAppend({name: 'recoverPasswordPromptResetAccount', params: {skipPassword, username}}, true)
    },
    updateARState: (active, endTime) => {
      set(s => {
        s.active = active
        s.endTime = endTime
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
