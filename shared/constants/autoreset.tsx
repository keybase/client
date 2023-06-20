import * as Container from '../util/container'
import * as RPCGen from '../constants/types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ProvisionGen from '../actions/provision-gen'
import logger from '../logger'
import {RPCError} from '../util/errors'

export const enterPipelineWaitingKey = 'autoreset:EnterPipelineWaitingKey'
export const actuallyResetWaitingKey = 'autoreset:ActuallyResetWaitingKey' // TODO not really set
export const cancelResetWaitingKey = 'autoreset:cancelWaitingKey'

type State = {
  active: boolean
  afterSubmitResetPrompt: (action: RPCGen.ResetPromptResponse) => void
  endTime: number
  error: string
  hasWallet: boolean
  skipPassword: boolean
  username: string
}

const initialState: State = {
  active: false,
  afterSubmitResetPrompt: (_action: RPCGen.ResetPromptResponse) => {
    console.log('Unset afterSubmitResetPrompt called')
  },
  endTime: 0,
  error: '',
  hasWallet: false,
  skipPassword: false,
  username: '',
}

type ZState = State & {
  dispatch: {
    cancelReset: () => void
    reset: () => void
    resetAccount: (password?: string) => void
    startAccountReset: (skipPassword: boolean, username: string) => void
    updateARState: (active: boolean, endTime: number) => void
  }
}

export const useState = Container.createZustand(
  Container.immerZustand<ZState>((set, get) => {
    const reduxDispatch = Container.getReduxDispatch()
    const dispatch = {
      cancelReset: () => {
        const f = async () => {
          logger.info('Cancelled autoreset from logged-in user')
          try {
            await RPCGen.accountCancelResetRpcPromise(undefined, cancelResetWaitingKey)
            set(s => {
              s.active = false
            })
          } catch (error) {
            if (!(error instanceof RPCError)) {
              return
            }
            logger.error('Error in CancelAutoreset', error)
            switch (error.code) {
              case RPCGen.StatusCode.scnosession:
                // We got logged out because we were revoked (which might have been
                // becase the reset was completed and this device wasn't notified).
                return undefined
              case RPCGen.StatusCode.scnotfound:
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
        Container.ignorePromise(f())
      },
      reset: () => {
        set(() => initialState)
      },
      resetAccount: (password: string = '') => {
        set(s => {
          s.error = ''
        })
        const f = async () => {
          const promptReset = (
            params: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
            response: {
              result: (reset: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
            }
          ) => {
            if (params.prompt.t === RPCGen.ResetPromptType.complete) {
              const {hasWallet} = params.prompt.complete
              logger.info('Showing final reset screen')
              set(s => {
                s.hasWallet = hasWallet
                s.afterSubmitResetPrompt = (action: RPCGen.ResetPromptResponse) => {
                  set(s => {
                    s.afterSubmitResetPrompt = initialState.afterSubmitResetPrompt
                  })
                  response.result(action)
                  if (action === RPCGen.ResetPromptResponse.confirmReset) {
                    set(s => {
                      s.error = ''
                    })
                    reduxDispatch(
                      ProvisionGen.createStartProvision({fromReset: true, initUsername: get().username})
                    )
                  } else {
                    reduxDispatch(RouteTreeGen.createNavUpToScreen({name: 'login'}))
                  }
                }
              })
              reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['resetConfirm'], replace: true}))
            } else {
              logger.info('Starting account reset process')
              get().dispatch.startAccountReset(true, '')
            }
          }
          try {
            await RPCGen.accountEnterResetPipelineRpcListener(
              {
                customResponseIncomingCallMap: {'keybase.1.loginUi.promptResetAccount': promptReset},
                incomingCallMap: {
                  'keybase.1.loginUi.displayResetProgress': params => {
                    if (!params.needVerify) {
                      set(s => {
                        s.endTime = params.endTime * 1000
                      })
                    }
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({
                        path: [{props: {pipelineStarted: !params.needVerify}, selected: 'resetWaiting'}],
                        replace: true,
                      })
                    )
                  },
                },
                params: {
                  interactive: false,
                  passphrase: password,
                  usernameOrEmail: get().username,
                },
                waitingKey: enterPipelineWaitingKey,
              },
              Container.dummyListenerApi
            )
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
        Container.ignorePromise(f())
      },
      startAccountReset: (skipPassword: boolean, username: string) => {
        set(s => {
          s.skipPassword = skipPassword
          s.error = ''
          s.username = username
        })
        reduxDispatch(
          RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPromptResetAccount'], replace: true})
        )
      },
      updateARState: (active: boolean, endTime: number) => {
        set(s => {
          s.active = active
          s.endTime = endTime
        })
      },
    }
    return {
      ...initialState,
      dispatch,
    }
  })
)
