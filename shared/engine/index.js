// @flow
// Handles sending requests to the daemon
import logger from '../logger'
import * as Constants from '../constants/engine'
import Session from './session'
import {initEngine, initEngineSaga} from './require'
import {constantsStatusCode} from '../constants/types/rpc-gen'
import {convertToError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {localLog} from '../util/forward-logs'
import {log} from '../native/log/logui'
import {printOutstandingRPCs, isTesting} from '../local-debug'
import {resetClient, createClient, rpcLog} from './index.platform'
import {createChangeWaiting} from '../actions/waiting-gen'
import engineSaga from './saga'
import {isArray} from 'lodash-es'

import type {CancelHandlerType} from './session'
import type {createClientType} from './index.platform'
import type {IncomingCallMapType, LogUiLogRpcParam} from '../constants/types/rpc-gen'
import type {SessionID, SessionIDKey, WaitingHandlerType, ResponseType, MethodKey} from './types'
import type {TypedState, Dispatch} from '../util/container'

// Not the real type here to reduce merge time. This file has a .js.flow for importers
type TypedActions = {type: string, error: boolean, payload: any}

type IncomingActionCreator = (
  param: Object,
  response: ?Object,
  dispatch: Dispatch,
  getState: () => TypedState
) => void | null | TypedActions | Array<TypedActions>

class Engine {
  // Bookkeep old sessions
  _deadSessionsMap: {[key: SessionIDKey]: true} = {}
  // Tracking outstanding sessions
  _sessionsMap: {[key: SessionIDKey]: Session} = {}
  // Helper we delegate actual calls to
  _rpcClient: createClientType
  // All incoming call handlers
  _incomingActionCreators: {
    [key: MethodKey]: IncomingActionCreator,
  } = {}
  // Keyed methods that care when we disconnect. Is null while we're handing _onDisconnect
  _onDisconnectHandlers: ?{[key: string]: () => ?TypedActions} = {}
  // Keyed methods that care when we reconnect. Is null while we're handing _onConnect
  _onConnectHandlers: ?{[key: string]: () => ?TypedActions} = {}
  // Set to true to throw on errors. Used in testing
  _failOnError: boolean = false
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // We call onDisconnect handlers only if we've actually disconnected (ie connected once)
  _hasConnected: boolean = false
  // So we can dispatch actions
  static _dispatch: Dispatch
  // Temporary helper for incoming call maps
  static _getState: () => TypedState

  dispatchWaitingAction = (key: string, waiting: boolean) => {
    Engine._dispatch(createChangeWaiting({key, increment: waiting}))
  }

  constructor(dispatch: Dispatch, getState: () => TypedState) {
    // setup some static vars
    Engine._dispatch = dispatch
    Engine._getState = getState
    this._setupClient()
    this._setupCoreHandlers()
    this._setupIgnoredHandlers()
    this._setupDebugging()
  }

  _setupClient() {
    this._rpcClient = createClient(
      payload => this._rpcIncoming(payload),
      () => this._onConnected(),
      () => this._onDisconnect()
    )
  }

  _setupDebugging() {
    if (!__DEV__) {
      return
    }

    if (typeof window !== 'undefined') {
      logger.info('DEV MODE ENGINE AVAILABLE AS window.DEBUGengine')
      window.DEBUGengine = this
    }

    // Print out any alive sessions periodically
    if (printOutstandingRPCs) {
      setInterval(() => {
        if (Object.keys(this._sessionsMap).filter(k => !this._sessionsMap[k].getDangling()).length) {
          localLog('outstandingSessionDebugger: ', this._sessionsMap)
        }
      }, 10 * 1000)
    }
  }

  // Default handlers for incoming messages
  _setupCoreHandlers() {
    this.setIncomingActionCreators('keybase.1.logUi.log', (param, response) => {
      const logParam: LogUiLogRpcParam = param
      log(logParam)
      response && response.result && response.result()
    })
  }

  _setupIgnoredHandlers() {
    // Any messages we want to ignore go here
  }

  _onDisconnect() {
    if (!this._onDisconnectHandlers) {
      return
    }

    const handlers = this._onDisconnectHandlers
    // Don't allow mutation while we're handling the handlers
    this._onDisconnectHandlers = null
    Object.keys(handlers).forEach(k => {
      const action = handlers[k]()
      if (action) {
        Engine._dispatch(action)
      }
    })
    this._onDisconnectHandlers = handlers
  }

  // Called when we reconnect to the server
  _onConnected() {
    this._hasConnected = true
    if (!this._onConnectHandlers) {
      return
    }

    const handlers = this._onConnectHandlers
    // Don't allow mutation while we're handling the handlers
    this._onConnectHandlers = null
    Object.keys(handlers).forEach(k => {
      const action = handlers[k]()
      if (action) {
        Engine._dispatch(action)
      }
    })
    this._onConnectHandlers = handlers
  }

  // Create and return the next unique session id
  _generateSessionID(): number {
    this._nextSessionID++
    return this._nextSessionID
  }

  // Got a cancelled sequence id
  _handleCancel(seqid: number) {
    const cancelledSessionID = Object.keys(this._sessionsMap).find(key =>
      this._sessionsMap[key].hasSeqID(seqid)
    )
    if (cancelledSessionID) {
      const s = this._sessionsMap[cancelledSessionID]
      rpcLog({
        extra: {cancelledSessionID},
        method: s._startMethod || 'unknown',
        reason: '[cancel]',
        type: 'engineInternal',
      })
      s.cancel()
    } else {
      rpcLog({
        extra: {cancelledSessionID},
        method: 'unknown',
        reason: '[cancel?]',
        type: 'engineInternal',
      })
    }
  }

  // Got an incoming request with no handler
  _handleUnhandled(sessionID: number, method: MethodKey, seqid: number, param: Object, response: ?Object) {
    const isDead = !!this._deadSessionsMap[String(sessionID)]

    const prefix = isDead ? 'Dead session' : 'Unknown'

    if (__DEV__) {
      localLog(
        `${prefix} incoming rpc: ${sessionID} ${method} ${seqid} ${JSON.stringify(param)}${
          response ? ': Sending back error' : ''
        }`
      )
    }
    logger.warn(`${prefix} incoming rpc: ${sessionID} ${method}`)

    if (__DEV__ && this._failOnError) {
      throw new Error(
        `${prefix} incoming rpc: ${sessionID} ${method} ${JSON.stringify(param)}${
          response ? '. has response' : ''
        }`
      )
    }

    response &&
      response.error &&
      response.error({
        code: constantsStatusCode.scgeneric,
        desc: `${prefix} incoming RPC ${sessionID} ${method}`,
      })
  }

  // An incoming rpc call
  _rpcIncoming(payload: {method: MethodKey, param: Array<Object>, response: ?Object}) {
    const {method, param: incomingParam, response} = payload
    const param = incomingParam && incomingParam.length ? incomingParam[0] : {}
    const {seqid, cancelled} = response || {seqid: 0, cancelled: false}
    const {sessionID} = param

    if (cancelled) {
      this._handleCancel(seqid)
    } else {
      const session = this._sessionsMap[String(sessionID)]
      if (session && session.incomingCall(method, param, response)) {
        // Part of a session?
      } else if (this._incomingActionCreators[method]) {
        // General incoming
        const creator = this._incomingActionCreators[method]
        rpcLog({reason: '[incoming]', type: 'engineInternal', method})
        // TODO remove dispatch and getState, these callbacks should just dispatch actions
        const rawActions = creator(param, response, Engine._dispatch, Engine._getState)
        const arrayActions = isArray(rawActions) ? rawActions : [rawActions]
        const actions = arrayActions.filter(Boolean)
        actions.forEach(a => Engine._dispatch(a))
      } else {
        // Unhandled
        this._handleUnhandled(sessionID, method, seqid, param, response)
      }
    }
  }

  // An outgoing call. ONLY called by the flow-type rpc helpers
  _channelMapRpcHelper(configKeys: Array<string>, method: string, paramsIn: any): any {
    const params = paramsIn || {}
    const channelConfig = Constants.singleFixedChannelConfig(configKeys)
    const channelMap = Constants.createChannelMap(channelConfig)
    const empty = {}
    const incomingCallMap = Object.keys(channelMap).reduce((acc, k) => {
      acc[k] = (params, response) => {
        Constants.putOnChannelMap(channelMap, k, {params, response})
      }
      return acc
    }, empty)
    const callback = (error, params) => {
      channelMap['finished'] && Constants.putOnChannelMap(channelMap, 'finished', {error, params})
      Constants.closeChannelMap(channelMap)
    }

    const sid = this._rpcOutgoing({method, params, incomingCallMap, callback})
    return new Constants.EngineChannel(channelMap, sid, configKeys)
  }

  // An outgoing call. ONLY called by the flow-type rpc helpers
  _rpcOutgoing(p: {
    method: string,
    params: ?Object,
    callback: (...args: Array<any>) => void,
    incomingCallMap?: any, // IncomingCallMapType, actually a mix of all the incomingcallmap types, which we don't handle yet TODO we could mix them all
    waitingKey?: string,
  }) {
    const {method, params = {}, callback, incomingCallMap, waitingKey} = p
    // Make a new session and start the request
    const session = this.createSession({incomingCallMap, waitingKey})
    // Don't make outgoing calls immediately since components can do this when they mount
    setImmediate(() => {
      session.start(method, params, callback)
    })
    return session.getId()
  }

  // Make a new session. If the session hangs around forever set dangling to true
  createSession(p: {
    incomingCallMap?: IncomingCallMapType,
    cancelHandler?: CancelHandlerType,
    dangling?: boolean,
    waitingKey?: string,
  }): Session {
    const {incomingCallMap, cancelHandler, dangling = false, waitingKey} = p
    const sessionID = this._generateSessionID()

    const session = new Session({
      cancelHandler,
      dangling,
      endHandler: (session: Session) => this._sessionEnded(session),
      incomingCallMap,
      invoke: (method, param, cb) => {
        const callback = method => (...args) => {
          // If first argument is set, convert it to an Error type
          if (args.length > 0 && !!args[0]) {
            args[0] = convertToError(args[0], method)
          }
          cb(...args)
        }
        this._rpcClient.invoke(method, param, callback(method))
      },
      sessionID,
      waitingKey,
    })

    this._sessionsMap[String(sessionID)] = session
    return session
  }

  // Cancel a session
  cancelSession(sessionID: SessionID) {
    const session = this._sessionsMap[String(sessionID)]
    if (session) {
      session.cancel()
    }
  }

  // Cleanup a session that ended
  _sessionEnded(session: Session) {
    rpcLog({
      extra: {
        sessionID: session.getId(),
      },
      method: session._startMethod || 'unknown',
      reason: '[-session]',
      type: 'engineInternal',
    })
    delete this._sessionsMap[String(session.getId())]
    this._deadSessionsMap[String(session.getId())] = true
  }

  // Cancel an rpc
  cancelRPC(response: ?ResponseType, error: any) {
    if (response) {
      if (response.error) {
        const cancelError = {
          code: constantsStatusCode.scgeneric,
          desc: 'Canceling RPC',
        }

        response.error(error || cancelError)
      }
    } else {
      localLog('Invalid response sent to cancelRPC')
    }
  }

  // Reset the engine
  reset() {
    // TODO not working on mobile yet
    if (isMobile) {
      return
    }
    resetClient(this._rpcClient)
  }

  // Setup a handler for a rpc w/o a session (id = 0)
  setIncomingActionCreators(method: MethodKey, actionCreator: IncomingActionCreator) {
    if (this._incomingActionCreators[method]) {
      rpcLog({
        method,
        reason: "duplicate incoming action creator!!! this isn't allowed",
        type: 'engineInternal',
      })
      return
    }
    rpcLog({
      method,
      reason: '[register]',
      type: 'engineInternal',
    })
    this._incomingActionCreators[method] = actionCreator
  }

  // Test want to fail on any error
  setFailOnError() {
    this._failOnError = true
  }

  // Register a named callback when we disconnect from the server. Call if we're already disconnected. Callback should produce an action
  actionOnDisconnect(key: string, f: () => void) {
    if (!this._onDisconnectHandlers) {
      throw new Error('Calling listenOnDisconnect while in the middle of _onDisconnect')
    }

    if (!f) {
      throw new Error('Null callback sent to listenOnDisconnect')
    }

    // If we've actually connected and are now disconnected let's call this immediately
    if (this._hasConnected && this._rpcClient.transport.needsConnect) {
      const action = f()
      if (action) {
        Engine._dispatch(action)
      }
    }

    // Regardless if we were connected or not, we'll add this to the callback fns
    // that should be called when we disconnect.
    this._onDisconnectHandlers[key] = f
  }

  // Register a named callback when we fail to connect. Call if we're already disconnected
  hasEverConnected() {
    // If we've actually failed to connect already let's call this immediately
    return this._hasConnected
  }

  // Register a named callback when we reconnect to the server. Call if we're already connected
  actionOnConnect(key: string, f: () => void) {
    if (!this._onConnectHandlers) {
      throw new Error('Calling listenOnConnect while in the middle of _onConnected')
    }

    if (!f) {
      throw new Error('Null callback sent to listenOnConnect')
    }

    // The transport is already connected, so let's call this function right away
    if (!this._rpcClient.transport.needsConnect) {
      const action = f()
      if (action) {
        Engine._dispatch(action)
      }
    }

    // Regardless if we were connected or not, we'll add this to the callback fns
    // that should be called when we connect.
    this._onConnectHandlers[key] = f
  }
}

// Dummy engine for snapshotting
class FakeEngine {
  _deadSessionsMap: {[key: SessionIDKey]: Session} // just to bookkeep
  _sessionsMap: {[key: SessionIDKey]: Session}
  constructor() {
    logger.info('Engine disabled!')
    this._sessionsMap = {}
  }
  reset() {}
  cancelRPC() {}
  cancelSession(sessionID: SessionID) {}
  rpc() {}
  setFailOnError() {}
  actionOnConnect(key: string, f: () => void) {}
  actionOnDisconnect(key: string, f: () => void) {}
  hasEverConnected() {}
  setIncomingActionCreator(
    method: MethodKey,
    actionCreator: (param: Object, response: ?Object, dispatch: Dispatch) => ?any
  ) {}
  createSession(
    incomingCallMap: ?IncomingCallMapType,
    waitingHandler: ?WaitingHandlerType,
    cancelHandler: ?CancelHandlerType,
    dangling?: boolean = false
  ) {
    return new Session({
      endHandler: () => {},
      incomingCallMap: null,
      invoke: () => {},
      sessionID: 0,
    })
  }
  _channelMapRpcHelper(configKeys: Array<string>, method: string, params: any): any {
    return null
  }
  _rpcOutgoing(
    method: string,
    params: ?{
      incomingCallMap?: any, // IncomingCallMapType, actually a mix of all the incomingcallmap types, which we don't handle yet TODO we could mix them all
      waitingHandler?: WaitingHandlerType,
    },
    callback: (...args: Array<any>) => void
  ) {}
}

let engine
const makeEngine = (dispatch: Dispatch, getState: () => TypedState) => {
  if (__DEV__ && engine) {
    logger.warn('makeEngine called multiple times')
  }

  if (!engine) {
    engine = process.env.KEYBASE_NO_ENGINE || isTesting ? new FakeEngine() : new Engine(dispatch, getState)
    initEngine((engine: any))
    initEngineSaga(engineSaga)
  }
  return engine
}

const getEngine = (): Engine | FakeEngine => {
  if (__DEV__ && !engine) {
    throw new Error('Engine needs to be initialized first')
  }
  return engine
}

export default getEngine
export {getEngine, makeEngine, Engine}
