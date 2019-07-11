// Handles sending requests to the daemon
import logger from '../logger'
import Session, {CancelHandlerType} from './session'
import {initEngine, initEngineSaga} from './require'
import {RPCError, convertToError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {localLog} from '../util/forward-logs'
import {printOutstandingRPCs, isTesting} from '../local-debug'
import {resetClient, createClient, rpcLog, createClientType} from './index.platform'
import {createBatchChangeWaiting} from '../actions/waiting-gen'
import engineSaga from './saga'
import {throttle} from 'lodash-es'
import {CustomResponseIncomingCallMapType, IncomingCallMapType} from '.'
import {SessionID, SessionIDKey, WaitingHandlerType, MethodKey} from './types'
import {TypedState, Dispatch} from '../util/container'

type WaitingKey = string | Array<string>

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

class Engine {
  // Bookkeep old sessions
  _deadSessionsMap: {[K in SessionIDKey]: true} = {}
  // Tracking outstanding sessions
  _sessionsMap: {[K in SessionIDKey]: Session} = {}
  // Helper we delegate actual calls to
  _rpcClient: createClientType
  // Set which actions we don't auto respond with so sagas can themselves
  _customResponseAction: {[K in MethodKey]: true} = {}
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // We call onDisconnect handlers only if we've actually disconnected (ie connected once)
  _hasConnected: boolean = isMobile // mobile is always connected
  // App tells us when the sagas are done loading so we can start emitting events
  _sagasAreReady: boolean = false
  // So we can dispatch actions
  static _dispatch: Dispatch
  // Temporary helper for incoming call maps
  static _getState: () => TypedState

  _queuedChanges: Array<{error: RPCError; increment: boolean; key: WaitingKey}> = []
  dispatchWaitingAction = (key: WaitingKey, waiting: boolean, error: RPCError) => {
    this._queuedChanges.push({error, increment: waiting, key})
    this._throttledDispatchWaitingAction()
  }

  _throttledDispatchWaitingAction = throttle(() => {
    const changes = this._queuedChanges
    this._queuedChanges = []
    Engine._dispatch(createBatchChangeWaiting({changes}))
  }, 500)

  // TODO deprecate
  deprecatedGetDispatch = () => {
    return Engine._dispatch
  }
  // TODO deprecate
  deprecatedGetGetState = () => {
    return Engine._getState
  }

  constructor(dispatch: Dispatch, getState: () => TypedState) {
    // setup some static vars
    Engine._dispatch = dispatch
    Engine._getState = getState
    this._rpcClient = createClient(
      payload => this._rpcIncoming(payload),
      () => this._onConnected(),
      () => this._onDisconnect()
    )
    this._setupIgnoredHandlers()
    this._setupDebugging()
  }

  _setupDebugging() {
    if (!__DEV__) {
      return
    }

    if (typeof window !== 'undefined') {
      logger.info('DEV MODE ENGINE AVAILABLE AS window.DEBUGengine')
      // @ts-ignore codemode issue
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

  _setupIgnoredHandlers() {
    // Any messages we want to ignore go here
  }

  _onDisconnect() {
    Engine._dispatch({payload: undefined, type: 'engine-gen:disconnected'})
  }

  // We want to dispatch the connect action but only after sagas boot up
  sagasAreReady = () => {
    this._sagasAreReady = true
    if (this._hasConnected) {
      // dispatch the action version
      Engine._dispatch({payload: undefined, type: 'engine-gen:connected'})
    }
  }

  // Called when we reconnect to the server
  _onConnected() {
    this._hasConnected = true

    // Sagas already booted so they can get this
    if (this._sagasAreReady) {
      // dispatch the action version
      Engine._dispatch({payload: undefined, type: 'engine-gen:connected'})
    }
  }

  // Create and return the next unique session id
  _generateSessionID() {
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

  // An incoming rpc call
  _rpcIncoming(payload: {method: MethodKey; param: Array<Object>; response: Object | null}) {
    const {method, param: incomingParam, response} = payload
    const param = incomingParam && incomingParam.length ? incomingParam[0] || {} : {}
    // @ts-ignore codemode issue
    const {seqid, cancelled} = response || {cancelled: false, seqid: 0}
    // @ts-ignore codemode issue
    const {sessionID} = param

    if (cancelled) {
      this._handleCancel(seqid)
    } else {
      const session = this._sessionsMap[String(sessionID)]
      if (session && session.incomingCall(method, param, response)) {
        // Part of a session?
      } else {
        // Dispatch as an action
        const extra = {}
        if (this._customResponseAction[method]) {
          // @ts-ignore codemode issue
          extra.response = response
        } else {
          // Not a custom response so we auto handle it
          // @ts-ignore codemode issue
          response && response.result()
        }
        const type = method
          .replace(/'/g, '')
          .split('.')
          .map((p, idx) => (idx ? capitalize(p) : p))
          .join('')
        // @ts-ignore can't really type this easily
        Engine._dispatch({payload: {params: param, ...extra}, type: `engine-gen:${type}`})
      }
    }
  }

  // An outgoing call. ONLY called by the flow-type rpc helpers
  _rpcOutgoing(p: {
    method: string
    params: Object
    callback: (...args: Array<any>) => void
    incomingCallMap?: any
    customResponseIncomingCallMap?: any
    waitingKey?: WaitingKey
  }) {
    // Make a new session and start the request
    const session = this.createSession({
      customResponseIncomingCallMap: p.customResponseIncomingCallMap,
      incomingCallMap: p.incomingCallMap,
      waitingKey: p.waitingKey,
    })
    // Don't make outgoing calls immediately since components can do this when they mount
    setImmediate(() => {
      session.start(p.method, p.params, p.callback)
    })
    return session.getId()
  }

  // Make a new session. If the session hangs around forever set dangling to true
  createSession(p: {
    incomingCallMap?: IncomingCallMapType | null
    customResponseIncomingCallMap?: CustomResponseIncomingCallMapType | null
    cancelHandler?: CancelHandlerType
    dangling?: boolean
    waitingKey?: WaitingKey
  }): Session {
    const {customResponseIncomingCallMap, incomingCallMap, cancelHandler, dangling = false, waitingKey} = p
    const sessionID = this._generateSessionID()

    const session = new Session({
      cancelHandler,
      customResponseIncomingCallMap,
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
        this._rpcClient.invoke(method, param || [{}], callback(method))
      },
      sessionID,
      waitingKey,
    })

    this._sessionsMap[String(sessionID)] = session
    return session
  }

  // Cancel a session maybe deprecate, not used
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

  // Reset the engine
  reset() {
    // TODO not working on mobile yet
    if (isMobile) {
      return
    }
    resetClient(this._rpcClient)
  }

  registerCustomResponse = (method: string) => {
    if (this._customResponseAction[method]) {
      throw new Error('Dupe custom response handler registered: ' + method)
    }

    this._customResponseAction[method] = true
  }

  // Register a named callback when we fail to connect. Call if we're already disconnected
  hasEverConnected() {
    // If we've actually failed to connect already let's call this immediately
    return this._hasConnected
  }
}

// Dummy engine for snapshotting
class FakeEngine {
  _deadSessionsMap: {[K in SessionIDKey]: Session} = {} // just to bookkeep
  _sessionsMap: {[K in SessionIDKey]: Session} = {}
  constructor() {
    logger.info('Engine disabled!')
    this._sessionsMap = {}
  }
  reset() {}
  cancelSession(_: SessionID) {}
  rpc() {}
  setFailOnError() {}
  hasEverConnected() {}
  setIncomingActionCreator(
    _: MethodKey,
    __: (arg0: {param: Object; response: Object | null; state: any}) => any | null
  ) {}
  createSession(
    _: IncomingCallMapType | null,
    __: WaitingHandlerType | null,
    ___: CancelHandlerType | null,
    ____: boolean = false
  ) {
    return new Session({
      endHandler: () => {},
      incomingCallMap: null,
      invoke: () => {},
      sessionID: 0,
    })
  }
  _channelMapRpcHelper(_: Array<string>, __: string, ___: any) {
    return null
  }
  _rpcOutgoing(
    _: string,
    __: {
      incomingCallMap?: any
      waitingHandler?: WaitingHandlerType
    } | null,
    ___: (...args: Array<any>) => void
  ) {}
}

// don't overwrite this on HMR
let engine: Engine
if (__DEV__) {
  engine = global.DEBUGEngine
}

const makeEngine = (dispatch: Dispatch, getState: () => TypedState) => {
  if (__DEV__ && engine) {
    logger.warn('makeEngine called multiple times')
  }

  if (!engine) {
    engine =
      process.env.KEYBASE_NO_ENGINE || isTesting
        ? ((new FakeEngine() as unknown) as Engine)
        : new Engine(dispatch, getState)
    if (__DEV__) {
      global.DEBUGEngine = engine
    }
    initEngine(engine as any)
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
