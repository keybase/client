// @flow
import * as Constants from '../../constants/engine'

const waitingForRpcTransformer = (action: Constants.WaitingForRpc) => ({
  payload: {
    rpcName: action.payload.rpcName,
    waiting: action.payload.waiting,
  },
  type: action.type,
})

function waitingForRpc(rpcName: string, waiting: boolean): Constants.WaitingForRpc {
  return {
    logTransformer: waitingForRpcTransformer,
    type: 'engine:waitingForRpc',
    payload: {rpcName, waiting},
  }
}

export {waitingForRpc}
