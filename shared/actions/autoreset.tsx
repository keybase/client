import * as AutoresetGen from './autoreset-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as RPCGen from '../constants/types/rpc-gen'
import * as Constants from '../constants/autoreset'

const startAccountReset = (state: Container.TypedState, action: AutoresetGen.StartAccountResetPayload) => {
  return [
    AutoresetGen.createSetUsername({username: action.payload.username || state.recoverPassword.username}),
    RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPromptReset'], replace: true}),
  ]
}

function* resetAccount(state: Container.TypedState, action: AutoresetGen.ResetAccountPayload) {
  try {
    yield RPCGen.accountEnterResetPipelineRpcSaga({
      incomingCallMap: {},
      params: {
        interactive: false,
        passphrase: action.payload.password ? action.payload.password.stringValue() : '',
        usernameOrEmail: state.autoreset.username,
      },
      waitingKey: Constants.autoresetEnterPipelineWaitingKey,
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
function* autoresetSaga() {
  yield* Saga.chainGenerator(AutoresetGen.resetAccount, resetAccount)
  yield* Saga.chainAction2(AutoresetGen.startAccountReset, startAccountReset)
  yield* Saga.chainAction2(AutoresetGen.submittedReset, submittedReset)
}

export default autoresetSaga
