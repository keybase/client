import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import * as EngineGen from '@/actions/engine-gen-gen'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {navigateAppend, navUpToScreen} from '@/constants/router2/util'
import {storeRegistry} from '@/constants/store-registry'

type Store = T.Immutable<{
  active: boolean
  afterSubmitResetPrompt: (action: T.RPCGen.ResetPromptResponse) => void
  endTime: number
  error: string
  hasWallet: boolean
  skipPassword: boolean
  username: string
}>

const initialStore: Store = {
  active: false,
  afterSubmitResetPrompt: (_action: T.RPCGen.ResetPromptResponse) => {
    console.log('Unset afterSubmitResetPrompt called')
  },
  endTime: 0,
  error: '',
  hasWallet: false,
  skipPassword: false,
  username: '',
}

export interface State extends Store {
  dispatch: {
    cancelReset: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: 'default'
    resetAccount: (password?: string) => void
    startAccountReset: (skipPassword: boolean, username: string) => void
    updateARState: (active: boolean, endTime: number) => void
  }
}

export const useAutoResetState = Z.createZustand<State>((set, get) => {
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
              return undefined
            case T.RPCGen.StatusCode.scnotfound:
              break
            default:
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
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyBadgesBadgeState: {
          const {badgeState} = action.payload.params
          const {resetState} = badgeState
          get().dispatch.updateARState(resetState.active, resetState.endTime)
          break
        }
        default:
      }
    },
    resetAccount: (password = '') => {
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
              s.hasWallet = hasWallet
              s.afterSubmitResetPrompt = (action: T.RPCGen.ResetPromptResponse) => {
                set(s => {
                  s.afterSubmitResetPrompt = initialStore.afterSubmitResetPrompt
                })
                response.result(action)
                if (action === T.RPCGen.ResetPromptResponse.confirmReset) {
                  set(s => {
                    s.error = ''
                  })
                  storeRegistry.getState('provision').dispatch.startProvision(get().username, true)
                } else {
                  navUpToScreen('login')
                }
              }
            })
            navigateAppend('resetConfirm', true)
          } else {
            logger.info('Starting account reset process')
            get().dispatch.startAccountReset(true, '')
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
                    {props: {pipelineStarted: !params.needVerify}, selected: 'resetWaiting'},
                    true
                  )
              },
            },
            params: {
              interactive: false,
              passphrase: password,
              usernameOrEmail: get().username,
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
    resetState: 'default',
    startAccountReset: (skipPassword, _username) => {
      const username = _username || storeRegistry.getState('recover-password').username
      set(s => {
        s.skipPassword = skipPassword
        s.error = ''
        s.username = username
      })
      navigateAppend('recoverPasswordPromptResetAccount', true)
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
