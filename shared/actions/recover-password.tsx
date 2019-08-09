import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/provision'

const chooseDevice = (params, response) => {

  const devices = (params.devices || []).map(d => Constants.rpcDeviceToDevice(d))
  console.log(devices)

  return Saga.put(RecoverPasswordGen.createShowDeviceListPage({
    devices: devices,
  }))
}

function* startRecoverPassword(_, action: RecoverPasswordGen.StartRecoverPasswordPayload) {
  try {
    yield Saga.put(RouteTreeGen.createNavigateAppend({
      path: ['recoverPasswordDeviceSelector'],
    }))

    yield RPCTypes.loginRecoverPassphraseRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.provisionUi.chooseDevice': chooseDevice,
      },
      incomingCallMap: {},
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
    RecoverPasswordGen.startRecoverPassword, startRecoverPassword,
  )
}

export default recoverPasswordSaga