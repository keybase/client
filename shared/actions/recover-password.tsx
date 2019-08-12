import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/provision'

const chooseDevice = (params, response) => {
  return Saga.callUntyped(function*() {
    const devices = (params.devices || []).map(d => Constants.rpcDeviceToDevice(d))

    yield Saga.put(
      RecoverPasswordGen.createShowDeviceListPage({
        devices: devices,
      })
    )
    yield Saga.put(RouteTreeGen.createNavigateUp())
    yield Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: ['recoverPasswordDeviceSelector'],
      })
    )
    const action:
      | RecoverPasswordGen.SubmitDeviceSelectPayload
      | RecoverPasswordGen.AbortDeviceSelectPayload = yield Saga.take([
      RecoverPasswordGen.submitDeviceSelect,
      RecoverPasswordGen.abortDeviceSelect,
    ])
    if (action.payload && action.payload.id) {
      response.result(action.payload.id)
    } else {
      response.error()
    }
  })
}

const explainDevice = params => {
  return Saga.callUntyped(function*() {
    yield Saga.put(
      RecoverPasswordGen.createShowExplainDevice({
        name: params.name,
        type: params.kind,
      })
    )
    yield Saga.put(RouteTreeGen.createNavigateUp())
    yield Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: ['recoverPasswordExplainDevice'],
      })
    )
  })
}

function* startRecoverPassword(_, action: RecoverPasswordGen.StartRecoverPasswordPayload) {
  try {
    yield RPCTypes.loginRecoverPassphraseRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.provisionUi.chooseDevice': chooseDevice,
      },
      incomingCallMap: {
        'keybase.1.loginUi.explainDeviceRecovery': explainDevice,
      },
      params: {
        username: action.payload.username,
      },
    })
  } catch (e) {
    console.log(action, e)
  }
}

function* recoverPasswordSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainGenerator<RecoverPasswordGen.StartRecoverPasswordPayload>(
    RecoverPasswordGen.startRecoverPassword,
    startRecoverPassword
  )
}

export default recoverPasswordSaga
