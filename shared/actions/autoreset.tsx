import * as AutoresetGen from './autoreset-gen'
import * as Constants from '../constants/autoreset'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as ProvisionGen from './provision-gen'
import * as RPCGen from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from './recover-password-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import logger from '../logger'

const receivedBadgeState = async (
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

function promptReset(
  params: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
  response: {
    result: (reset: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
  }
) {
  return Saga.callUntyped(function*() {
    if (params.prompt.t === RPCGen.ResetPromptType.complete) {
      logger.info('Showing final reset screen')
      yield Saga.put(AutoresetGen.createShowFinalResetScreen({hasWallet: params.prompt.complete.hasWallet}))
      const action: RecoverPasswordGen.SubmitResetPromptPayload = yield Saga.take(
        RecoverPasswordGen.submitResetPrompt
      )
      response.result(action.payload.action)
      if (action.payload.action === RPCGen.ResetPromptResponse.confirmReset) {
        yield Saga.put(AutoresetGen.createFinishedReset())
      } else {
        yield Saga.put(RouteTreeGen.createNavUpToScreen({routeName: 'login'}))
      }
    } else {
      logger.info('Starting account reset process')
      yield Saga.put(AutoresetGen.createStartAccountReset({skipPassword: true}))
    }
  })
}

const displayProgressEngine = (
  params: RPCGen.MessageTypes['keybase.1.loginUi.displayResetProgress']['inParam']
) =>
  Saga.put(
    AutoresetGen.createDisplayProgress({
      endTime: params.endTime * 1000,
      needVerify: params.needVerify,
    })
  )

const displayProgress = (action: AutoresetGen.DisplayProgressPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {pipelineStarted: !action.payload.needVerify}, selected: 'resetWaiting'}],
    replace: true,
  })

function* resetAccount(state: Container.TypedState, action: AutoresetGen.ResetAccountPayload) {
  try {
    yield RPCGen.accountEnterResetPipelineRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.loginUi.promptResetAccount': promptReset,
      },
      incomingCallMap: {
        'keybase.1.loginUi.displayResetProgress': displayProgressEngine,
      },
      params: {
        interactive: false,
        passphrase: action.payload.password ? action.payload.password.stringValue() : '',
        usernameOrEmail: state.autoreset.username,
      },
      waitingKey: Constants.enterPipelineWaitingKey,
    })
    yield Saga.put(AutoresetGen.createSubmittedReset({checkEmail: !action.payload.password}))
  } catch (error) {
    logger.warn('Error resetting account:', error)
    yield Saga.put(AutoresetGen.createResetError({error: error}))
  }
}
const showFinalResetScreen = (__: AutoresetGen.ShowFinalResetScreenPayload) =>
  RouteTreeGen.createNavigateAppend({path: ['resetConfirm'], replace: true})

function* autoresetSaga() {
  yield* Saga.chainAction2(AutoresetGen.cancelReset, cancelReset)
  yield* Saga.chainAction(AutoresetGen.displayProgress, displayProgress)
  yield* Saga.chainAction2(AutoresetGen.finishedReset, finishedReset)
  yield* Saga.chainAction(AutoresetGen.showFinalResetScreen, showFinalResetScreen)
  yield* Saga.chainAction2(AutoresetGen.startAccountReset, startAccountReset)
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield* Saga.chainGenerator(AutoresetGen.resetAccount, resetAccount)
}

export default autoresetSaga
