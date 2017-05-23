// @flow
// Handles sending requests to the daemon
import Session from './session'
import type {CancelHandlerType} from './session'
import type {createClientType} from './index.platform'
import type {incomingCallMapType, logUiLogRpcParam} from '../constants/types/flow-types'
import {ConstantsStatusCode} from '../constants/types/flow-types'
import {isMobile} from '../constants/platform'
import {localLog} from '../util/forward-logs'
import {log} from '../native/log/logui'
import {resetClient, createClient, rpcLog} from './index.platform'
import {printOutstandingRPCs, isTesting} from '../local-debug'
import {convertToError} from '../util/errors'
import * as Saga from '../util/saga'
import {delay} from 'redux-saga'
import {call, race} from 'redux-saga/effects'

import type {ChannelMap} from '../constants/types/saga'

class EngineChannel {
  _map: ChannelMap<*>
  _sessionID: SessionID
  _configKeys: Array<string>

  constructor(map: ChannelMap<*>, sessionID: SessionID, configKeys: Array<string>) {
    this._map = map
    this._sessionID = sessionID
    this._configKeys = configKeys
  }

  get map(): ChannelMap<*> {
    return this._map
  }

  close() {
    Saga.closeChannelMap(this._map)
    getEngine().cancelSession(this._sessionID)
  }

  *take(key: string): Generator<any, any, any> {
    return yield Saga.takeFromChannelMap(this._map, key)
  }

  *race(options: ?{timeout?: number, removeNs: boolean, racers?: Object}): Generator<any, any, any> {
    const timeout = options && options.timeout
    const removeNs = (options && options.removeNs) || false
    const otherRacers = (options && options.racers) || {}
    const initMap = {
      ...(timeout
        ? {
            timeout: call(delay, timeout),
          }
        : {}),
      ...otherRacers,
    }

    const raceMap = this._configKeys.reduce((map, key) => {
      const parts = key.split('.')
      const name = removeNs ? parts[parts.length - 1] : key
      map[name] = Saga.takeFromChannelMap(this._map, key)
      return map
    }, initMap)

    const result = yield race(raceMap)

    if (result.timeout) {
      this.close()
    }

    return result
  }
}

class Engine {
  // Bookkeep old sessions
  _deadSessionsMap: {[key: SessionIDKey]: true} = {}
  // Tracking outstanding sessions
  _sessionsMap: {[key: SessionIDKey]: Session} = {}
  // Helper we delegate actual calls to
  _rpcClient: createClientType
  // All incoming call handlers
  _incomingHandler: {[key: MethodKey]: (param: Object, response: ?Object) => void} = {}
  // Keyed methods that care when we disconnect. Is null while we're handing _onDisconnect
  _onDisconnectHandlers: ?{[key: string]: () => void} = {}
  // Keyed methods that care when we reconnect. Is null while we're handing _onConnect
  _onConnectHandlers: ?{[key: string]: () => void} = {}
  // Set to true to throw on errors. Used in testing
  _failOnError: boolean = false
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // We call onDisconnect handlers only if we've actually disconnected (ie connected once)
  _hasConnected: boolean = false

  constructor() {
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
      console.log('DEV MODE ENGINE AVAILABLE AS window.DEBUGengine')
      window.DEBUGengine = this
    }

    // Print out any alive sessions periodically
    if (printOutstandingRPCs) {
      setInterval(() => {
        if (Object.keys(this._sessionsMap).filter(k => !this._sessionsMap[k].dangling).length) {
          localLog('outstandingSessionDebugger: ', this._sessionsMap)
        }
      }, 10 * 1000)
    }
  }

  // Default handlers for incoming messages
  _setupCoreHandlers() {
    this.setIncomingHandler('keybase.1.logUi.log', (param, response) => {
      const logParam: logUiLogRpcParam = param
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
    Object.keys(handlers).forEach(k => handlers[k]())
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
    Object.keys(handlers).forEach(k => handlers[k]())
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
      rpcLog('engineInternal', 'received cancel for session', {cancelledSessionID})
      this._sessionsMap[cancelledSessionID].cancel()
    } else {
      rpcLog('engineInternal', "received cancel but couldn't find session", {cancelledSessionID})
    }
  }

  // Got an incoming request with no handler
  _handleUnhandled(sessionID: number, method: MethodKey, seqid: number, param: Object, response: ?Object) {
    const isDead = !!this._deadSessionsMap[String(sessionID)]

    const prefix = isDead ? 'Dead session' : 'Unknown'

    if (__DEV__) {
      localLog(
        `${prefix} incoming rpc: ${sessionID} ${method} ${seqid} ${JSON.stringify(param)}${response ? ': Sending back error' : ''}`
      )
    }
    console.warn(`${prefix} incoming rpc: ${sessionID} ${method}`)

    if (__DEV__ && this._failOnError) {
      throw new Error(
        `${prefix} incoming rpc: ${sessionID} ${method} ${JSON.stringify(param)}${response ? '. has response' : ''}`
      )
    }

    response &&
      response.error &&
      response.error({
        code: ConstantsStatusCode.scgeneric,
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
      } else if (this._incomingHandler[method]) {
        // General incoming
        const handler = this._incomingHandler[method]
        rpcLog('engineInternal', 'handling incoming')
        handler(param, response)
      } else {
        // Unhandled
        this._handleUnhandled(sessionID, method, seqid, param, response)
      }
    }
  }

  // An outgoing call. ONLY called by the flow-type rpc helpers
  _channelMapRpcHelper(configKeys: Array<string>, method: string, params: any): EngineChannel {
    const channelConfig = Saga.singleFixedChannelConfig(configKeys)
    const channelMap = Saga.createChannelMap(channelConfig)
    const incomingCallMap = Object.keys(channelMap).reduce((acc, k) => {
      acc[k] = (params, response) => {
        Saga.putOnChannelMap(channelMap, k, {params, response})
      }
      return acc
    }, {})
    const callback = (error, params) => {
      channelMap['finished'] && Saga.putOnChannelMap(channelMap, 'finished', {error, params})
      Saga.closeChannelMap(channelMap)
    }
    const sid = this._rpcOutgoing(method, params, callback, incomingCallMap)
    return new EngineChannel(channelMap, sid, configKeys)
  }

  // An outgoing call. ONLY called by the flow-type rpc helpers
  _rpcOutgoing(
    method: string,
    params: ?{
      param?: ?Object,
      incomingCallMap?: incomingCallMapType,
      callback?: ?(...args: Array<any>) => void,
      waitingHandler?: WaitingHandlerType,
    },
    callbackOverride?: ?(...args: Array<any>) => void,
    incomingCallMapOverride?: incomingCallMapType
  ) {
    if (!params) {
      params = {}
    }

    let {param, incomingCallMap, callback, waitingHandler} = params

    // Ensure a non-null param
    if (!param) {
      param = {}
    }

    // Allow overrides from helpers
    if (callbackOverride) {
      if (callback) {
        throw new Error(
          'RPC callback overridden over real callback! You likely passed a callback to a RpcPromise'
        )
      }
      callback = callbackOverride
    }
    if (incomingCallMapOverride) {
      if (incomingCallMap) {
        throw new Error(
          'RPC incomingCallMap overriden over real incomingCallMap! You likely passed an incoming callmap to a RpcChannelMap'
        )
      }
      incomingCallMap = incomingCallMapOverride
    }

    // Make a new session and start the request
    const session = this.createSession(incomingCallMap, waitingHandler)
    session.start(method, param, callback)
    return session.id
  }

  // Make a new session. If the session hangs around forever set dangling to true
  createSession(
    incomingCallMap: ?incomingCallMapType,
    waitingHandler: ?WaitingHandlerType,
    cancelHandler: ?CancelHandlerType,
    dangling?: boolean = false
  ): Session {
    const sessionID = this._generateSessionID()
    rpcLog('engineInternal', 'session start', {sessionID})

    const session = new Session(
      sessionID,
      incomingCallMap,
      waitingHandler,
      (method, param, cb) =>
        this._rpcClient.invoke(method, param, (...args) => {
          // If first argument is set, convert it to an Error type
          if (args.length > 0 && !!args[0]) {
            args[0] = convertToError(args[0])
          }
          cb(...args)
        }),
      (session: Session) => this._sessionEnded(session),
      cancelHandler,
      dangling
    )

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
    rpcLog('engineInternal', 'session end', {sessionID: session.id})
    delete this._sessionsMap[String(session.id)]
    this._deadSessionsMap[String(session.id)] = true
  }

  // Cancel an rpc
  cancelRPC(response: ?ResponseType, error: any) {
    if (response) {
      if (response.error) {
        const cancelError = {
          code: ConstantsStatusCode.scgeneric,
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
  setIncomingHandler(method: MethodKey, handler: (param: Object, response: ?Object) => void) {
    if (this._incomingHandler[method]) {
      rpcLog('engineInternal', "duplicate incoming handler!!! this isn't allowed", {method})
      return
    }
    rpcLog('engineInternal', 'registering incoming handler:', {method})
    this._incomingHandler[method] = handler
  }

  // Test want to fail on any error
  setFailOnError() {
    this._failOnError = true
  }

  // Register a named callback when we disconnect from the server. Call if we're already disconnected
  listenOnDisconnect(key: string, f: () => void) {
    if (!this._onDisconnectHandlers) {
      throw new Error('Calling listenOnDisconnect while in the middle of _onDisconnect')
    }

    if (!f) {
      throw new Error('Null callback sent to listenOnDisconnect')
    }

    // If we've actually connected and are now disconnected lets call this immediately
    if (this._hasConnected && this._rpcClient.transport.needsConnect) {
      f()
    }

    // Regardless if we were connected or not, we'll add this to the callback fns
    // that should be called when we disconnect.
    this._onDisconnectHandlers[key] = f
  }

  // Register a named callback when we reconnect to the server. Call if we're already connected
  listenOnConnect(key: string, f: () => void) {
    if (!this._onConnectHandlers) {
      throw new Error('Calling listenOnConnect while in the middle of _onConnected')
    }

    if (!f) {
      throw new Error('Null callback sent to listenOnConnect')
    }

    // The transport is already connected, so let's call this function right away
    if (!this._rpcClient.transport.needsConnect) {
      f()
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
    console.log('Engine disabled!')
    this._sessionsMap = {}
  }
  reset() {}
  cancelRPC() {}
  cancelSession(sessionID: SessionID) {}
  rpc() {}
  setFailOnError() {}
  listenOnConnect() {}
  listenOnDisconnect() {}
  setIncomingHandler() {}
  createSession() {
    return new Session(0, {}, null, () => {}, () => {})
  }
  _channelMapRpcHelper(configKeys: Array<string>, method: string, params: any): EngineChannel {
    return new EngineChannel({}, 0, [])
  }
  _rpcOutgoing(
    method: string,
    params: {
      param?: ?Object,
      incomingCallMap?: incomingCallMapType,
      callback?: ?(...args: Array<any>) => void,
      waitingHandler?: WaitingHandlerType,
    },
    callbackOverride?: ?(...args: Array<any>) => void,
    incomingCallMapOverride?: incomingCallMapType
  ) {}
}

export type EndHandlerType = (session: Object) => void
export type MethodKey = string
export type SessionID = number
export type SessionIDKey = string // used in our maps, really converted to a string key
export type WaitingHandlerType = (waiting: boolean, method: string, sessionID: SessionID) => void
export type ResponseType = {
  result(...args: Array<any>): void,
  error(...args: Array<any>): void,
}

let engine
const makeEngine = () => {
  if (__DEV__ && engine) {
    console.warn('makeEngine called multiple times')
  }

  if (!engine) {
    engine = process.env.KEYBASE_NO_ENGINE || isTesting ? new FakeEngine() : new Engine()
  }
  return engine
}

const getEngine = () => {
  if (__DEV__ && !engine) {
    throw new Error('Engine needs to be initialized first')
  }

  // This is just a sanity check so we don't break old code. Should never happen in practice
  if (!engine) {
    makeEngine()
  }
  return engine
}

export default getEngine
export {getEngine, makeEngine, Engine, EngineChannel}
