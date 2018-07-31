// @noflow
/* eslint-env jest */

import Session from '../session'

class FakeEngine {
  constructor() {
    console.error('Engine disabled!')
  }
  reset() {}
  cancelRPC() {}
  cancelSession() {}
  rpc() {}
  setFailOnError() {}
  listenOnConnect() {}
  listenOnDisconnect() {}
  hasEverConnected() {}
  setIncomingActionCreator() {}
  createSession() {
    return new Session({
      endHandler: () => {},
      incomingCallMap: null,
      invoke: () => {},
      sessionID: 0,
    })
  }
  _channelMapRpcHelper() {}
  _rpcOutgoing() {}
}

const engine = new FakeEngine()
const mock = () => engine

const getEngine = mock
const makeEngine = mock

export default mock
export {getEngine, makeEngine}
