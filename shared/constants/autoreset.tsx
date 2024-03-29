import * as C from '.'
import * as Z from '@/util/zustand'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'

export const enterPipelineWaitingKey = 'autoreset:EnterPipelineWaitingKey'
export const actuallyResetWaitingKey = 'autoreset:ActuallyResetWaitingKey' // TODO not really set
export const cancelResetWaitingKey = 'autoreset:cancelWaitingKey'

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

interface State extends Store {
  dispatch: {
    cancelReset: () => void
    resetState: 'default'
    resetAccount: (password?: string) => void
    startAccountReset: (skipPassword: boolean, username: string) => void
    updateARState: (active: boolean, endTime: number) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    cancelReset: () => {
      set(s => {
        s.error = ''
      })
      const f = async () => {
        logger.info('Cancelled autoreset from logged-in user')
        try {
          await T.RPCGen.accountCancelResetRpcPromise(undefined, cancelResetWaitingKey)
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
              // becase the reset was completed and this device wasn't notified).
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
      C.ignorePromise(f())
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
                  C.useProvisionState.getState().dispatch.startProvision(get().username, true)
                } else {
                  C.useRouterState.getState().dispatch.navUpToScreen('login')
                }
              }
            })
            C.useRouterState.getState().dispatch.navigateAppend('resetConfirm', true)
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
                C.useRouterState
                  .getState()
                  .dispatch.navigateAppend(
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
            waitingKey: enterPipelineWaitingKey,
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
      C.ignorePromise(f())
    },
    resetState: 'default',
    startAccountReset: (skipPassword, _username) => {
      const username = _username || C.useRecoverState.getState().username
      set(s => {
        s.skipPassword = skipPassword
        s.error = ''
        s.username = username
      })
      C.useRouterState.getState().dispatch.navigateAppend('recoverPasswordPromptResetAccount', true)
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
