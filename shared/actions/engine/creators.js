// @flow
import * as Constants from '../../constants/engine'

function waitingForRpc(rpcName: string, waiting: boolean): Constants.WaitingForRpc {
  return {
    type: 'engine:waitingForRpc',
    payload: {rpcName, waiting},
  }
}

export {waitingForRpc}
