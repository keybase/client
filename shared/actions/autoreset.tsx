import * as AutoresetGen from './autoreset-gen'
import * as Constants from '../constants/autoreset'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as RecoverPasswordGen from './recover-password-gen'
import * as RPCGen from '../constants/types/rpc-gen'
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
    await RPCGen.accountCancelResetRpcPromise(undefined, Constants.waitingKeyCancelReset)
  } catch (error) {
    return AutoresetGen.createResetError({error})
  }
  return AutoresetGen.createResetCancelled()
}

const updateAutoresetState = (_: Container.TypedState, action: AutoresetGen.UpdateAutoresetStatePayload) =>
  action.payload.active ? [RouteTreeGen.createNavigateAppend({path: ['resetModal']})] : null

const startAccountReset = (state: Container.TypedState, action: AutoresetGen.StartAccountResetPayload) => {
  return [
    AutoresetGen.createSetUsername({username: action.payload.username || state.recoverPassword.username}),
    RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPromptReset'], replace: true}),
  ]
}

function promptReset(
  params: RPCGen.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
  response: {
    result: (reset: boolean) => void
  }
) {
  return Saga.callUntyped(function*() {
    if (params.prompt.t === RPCGen.ResetPromptType.complete) {
      yield Saga.put(AutoresetGen.createShowFinalResetScreen({hasWallet: params.prompt.complete.hasWallet}))
      const action: RecoverPasswordGen.SubmitResetPromptPayload = yield Saga.take(
        RecoverPasswordGen.submitResetPrompt
      )
      response.result(action.payload.action)
      yield Saga.put(RouteTreeGen.createNavigateAppend({path: ['login'], replace: true}))
    } else {
      yield Saga.put(AutoresetGen.createStartAccountReset({skipPassword: true}))
    }
  })
}

const displayProgressEngine = (
  params: RPCGen.MessageTypes['keybase.1.loginUi.displayResetProgress']['inParam']
) =>
  Saga.put(
    AutoresetGen.createDisplayProgress({
      endTime: params.endTime,
    })
  )

const displayProgress = () => RouteTreeGen.createNavigateAppend({path: ['resetWaiting'], replace: true})

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
      waitingKey: Constants.waitingKeyEnterPipeline,
    })
    yield Saga.put(AutoresetGen.createSubmittedReset({checkEmail: !action.payload.password}))
  } catch (error) {
    yield Saga.put(AutoresetGen.createResetError({error: error}))
  }
}

const submittedReset = (_: Container.TypedState, action: AutoresetGen.SubmittedResetPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {pipelineStarted: !action.payload.checkEmail}, selected: 'resetWaiting'}],
    replace: true,
  })

const showFinalResetScreen = (_: Container.TypedState, action: AutoresetGen.ShowFinalResetScreenPayload) =>
  RouteTreeGen.createNavigateAppend({path: ['resetConfirm'], replace: true})

function* autoresetSaga() {
  yield* Saga.chainAction2(AutoresetGen.cancelReset, cancelReset, 'cancelReset')
  yield* Saga.chainAction2(AutoresetGen.displayProgress, displayProgress, 'displayProgress')
  yield* Saga.chainAction2(AutoresetGen.showFinalResetScreen, showFinalResetScreen)
  yield* Saga.chainAction2(AutoresetGen.startAccountReset, startAccountReset)
  yield* Saga.chainAction2(AutoresetGen.submittedReset, submittedReset)
  yield* Saga.chainAction2(AutoresetGen.updateAutoresetState, updateAutoresetState, 'updateAutoresetState')
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState, 'receivedBadgeState')
  yield* Saga.chainGenerator(AutoresetGen.resetAccount, resetAccount)
}

export default autoresetSaga
