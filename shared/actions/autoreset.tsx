import * as AutoresetGen from './autoreset-gen'
import * as Constants from '../constants/autoreset'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as ProvisionGen from './provision-gen'
import * as RPCGen from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from './recover-password-gen'
import * as RouteTreeGen from './route-tree-gen'
import {RPCError} from '../util/errors'
import logger from '../logger'

const receivedBadgeState = (
  state: Container.TypedState,
  action: NotificationsGen.ReceivedBadgeStatePayload
) => {
  const newResetState = action.payload.badgeState.resetState
  if (state.autoreset.active !== newResetState.active || state.autoreset.endTime !== newResetState.endTime) {
    logger.info('Received new autoreset state from gregor')
    return AutoresetGen.createUpdateAutoresetState(action.payload.badgeState.resetState)
  }
  return null
}

// TODO(Y2K-743): make this work in the logged-out case
const cancelReset = async () => {
  logger.info('Cancelled autoreset from logged-in user')
  try {
    await RPCGen.accountCancelResetRpcPromise(undefined, Constants.cancelResetWaitingKey)
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error('Error in CancelAutoreset', error)
    switch (error.code ?? 0) {
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
        return AutoresetGen.createResetError({error})
    }
  }
  return AutoresetGen.createResetCancelled()
}

const startAccountReset = (state: Container.TypedState, action: AutoresetGen.StartAccountResetPayload) => [
  AutoresetGen.createSetUsername({username: action.payload.username || state.recoverPassword.username}),
  RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPromptResetAccount'], replace: true}),
]

const finishedReset = (state: Container.TypedState) =>
  ProvisionGen.createStartProvision({fromReset: true, initUsername: state.autoreset.username})

const displayProgress = (_: unknown, action: AutoresetGen.DisplayProgressPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {pipelineStarted: !action.payload.needVerify}, selected: 'resetWaiting'}],
    replace: true,
  })

const resetAccount = async (
  state: Container.TypedState,
  action: AutoresetGen.ResetAccountPayload,
  listenerApi: Container.ListenerApi
) => {
  const promptReset = async (
    params: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
    response: {
      result: (reset: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
    }
  ) => {
    if (params.prompt.t === RPCGen.ResetPromptType.complete) {
      logger.info('Showing final reset screen')
      listenerApi.dispatch(
        AutoresetGen.createShowFinalResetScreen({hasWallet: params.prompt.complete.hasWallet})
      )
      const [action] = await listenerApi.take<RecoverPasswordGen.SubmitResetPromptPayload>(
        action => action.type === RecoverPasswordGen.submitResetPrompt
      )

      response.result(action.payload.action)
      if (action.payload.action === RPCGen.ResetPromptResponse.confirmReset) {
        listenerApi.dispatch(AutoresetGen.createFinishedReset())
      } else {
        listenerApi.dispatch(RouteTreeGen.createNavUpToScreen({name: 'login'}))
      }
    } else {
      logger.info('Starting account reset process')
      listenerApi.dispatch(AutoresetGen.createStartAccountReset({skipPassword: true}))
    }
  }

  try {
    await RPCGen.accountEnterResetPipelineRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.loginUi.promptResetAccount': promptReset,
        },
        incomingCallMap: {
          'keybase.1.loginUi.displayResetProgress': params =>
            AutoresetGen.createDisplayProgress({
              endTime: params.endTime * 1000,
              needVerify: params.needVerify,
            }),
        },
        params: {
          interactive: false,
          passphrase: action.payload.password ? action.payload.password.stringValue() : '',
          usernameOrEmail: state.autoreset.username,
        },
        waitingKey: Constants.enterPipelineWaitingKey,
      },
      listenerApi
    )
    listenerApi.dispatch(AutoresetGen.createSubmittedReset({checkEmail: !action.payload.password}))
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn('Error resetting account:', error)
    listenerApi.dispatch(AutoresetGen.createResetError({error}))
  }
}
const showFinalResetScreen = () => RouteTreeGen.createNavigateAppend({path: ['resetConfirm'], replace: true})

const initAutoReset = () => {
  Container.listenAction(AutoresetGen.cancelReset, cancelReset)
  Container.listenAction(AutoresetGen.displayProgress, displayProgress)
  Container.listenAction(AutoresetGen.finishedReset, finishedReset)
  Container.listenAction(AutoresetGen.showFinalResetScreen, showFinalResetScreen)
  Container.listenAction(AutoresetGen.startAccountReset, startAccountReset)
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  Container.listenAction(AutoresetGen.resetAccount, resetAccount)
}

export default initAutoReset
