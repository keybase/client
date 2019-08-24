/* eslint-env jest */
import Session from '../session'
import engineSaga from '../saga'

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

const initEngine = () => {}
const initEngineSaga = () => {}
const getEngineSaga = () => engineSaga

export {initEngine, getEngine, makeEngine, initEngineSaga, getEngineSaga}
