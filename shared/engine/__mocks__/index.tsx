/* eslint-env jest */

import Session from '../session'
console.error('loaded mock index')

class FakeEngine {
  constructor() {
    console.error('Engine disabled!')
  }
  reset() {}
  dispatchWaitingAction() {}
  rpc() {}
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
