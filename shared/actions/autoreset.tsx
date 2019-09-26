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
const resetAccount = async (state: Container.TypedState, action: AutoresetGen.ResetAccountPayload) => {
  let rpcPayload: {usernameOrEmail: string; passphrase: string; interactive: boolean}
  if (action.payload.password) {
    rpcPayload = {
      interactive: false,
      passphrase: action.payload.password.stringValue(),
      usernameOrEmail: state.autoreset.username,
    }
  } else {
    rpcPayload = {
      interactive: false,
      passphrase: '',
      usernameOrEmail: action.payload.phoneNumberOrEmail || state.autoreset.username,
    }
  }
  try {
    await RPCGen.accountEnterResetPipelineRpcPromise(rpcPayload, Constants.autoresetEnterPipelineWaitingKey)
    return AutoresetGen.createSubmittedReset({checkEmail: !action.payload.password})
  } catch (error) {
    return AutoresetGen.createResetError({error: error})
  }
}
const submittedReset = (_: Container.TypedState, action: AutoresetGen.SubmittedResetPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {pipelineStarted: !action.payload.checkEmail}, selected: 'resetWaiting'}],
    replace: true,
  })
function* autoresetSaga() {
  yield* Saga.chainAction2(AutoresetGen.resetAccount, resetAccount)
  yield* Saga.chainAction2(AutoresetGen.startAccountReset, startAccountReset)
  yield* Saga.chainAction2(AutoresetGen.submittedReset, submittedReset)
}

export default autoresetSaga
