// Handles sending requests to the daemon
import logger from '../logger'
import Session, {type CancelHandlerType} from './session'
import {initEngine, initEngineListener} from './require'
import {type RPCError, convertToError} from '../util/errors'
import {isMobile} from '../constants/platform'
import {printOutstandingRPCs, isTesting} from '../local-debug'
import {resetClient, createClient, rpcLog, type createClientType} from './index.platform'
import {createBatchChangeWaiting} from '../actions/waiting-gen'
import engineListener from './listener'
import throttle from 'lodash/throttle'
import type {CustomResponseIncomingCallMapType, IncomingCallMapType} from '.'
import type {SessionID, SessionIDKey, WaitingHandlerType, MethodKey} from './types'
import type {TypedDispatch} from '../util/container'

// delay incoming to stop react from queueing too many setState calls and stopping rendering
// only while debugging for now
const DEFER_INCOMING_DURING_DEBUG = __DEV__ && false
if (DEFER_INCOMING_DURING_DEBUG) {
  console.log(new Array(1000).fill('DEFER_INCOMING_DURING_DEBUG is On!!!!!!!!!!!!!!!!!!!!!').join('\n'))
}

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
  // Set which actions we don't auto respond with so listeners can themselves
  _customResponseAction: {[K in MethodKey]: true} = {}
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // We call onDisconnect handlers only if we've actually disconnected (ie connected once)
  _hasConnected: boolean = isMobile // mobile is always connected
  // App tells us when the listeners are done loading so we can start emitting events
  _listenersAreReady: boolean = false

  _dispatch: TypedDispatch

  _queuedChanges: Array<{error: RPCError; increment: boolean; key: WaitingKey}> = []
  dispatchWaitingAction = (key: WaitingKey, waiting: boolean, error: RPCError) => {
    this._queuedChanges.push({error, increment: waiting, key})
    this._throttledDispatchWaitingAction()
  }

  _throttledDispatchWaitingAction = throttle(() => {
    const changes = this._queuedChanges
    this._queuedChanges = []
    this._dispatch(createBatchChangeWaiting({changes}))
  }, 500)

  constructor(dispatch: TypedDispatch) {
    // setup some static vars
    if (DEFER_INCOMING_DURING_DEBUG) {
      this._dispatch = a => setTimeout(() => dispatch(a), 1)
    } else {
      this._dispatch = dispatch
    }
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
          logger.localLog('outstandingSessionDebugger: ', this._sessionsMap)
        }
      }, 10 * 1000)
    }
  }

  _setupIgnoredHandlers() {
    // Any messages we want to ignore go here
  }

  _onDisconnect() {
    this._dispatch({payload: undefined, type: 'engine-gen:disconnected'})
  }

  // We want to dispatch the connect action but only after listeners boot up
  listenersAreReady = () => {
    this._listenersAreReady = true
    if (this._hasConnected) {
      // dispatch the action version
      this._dispatch({payload: undefined, type: 'engine-gen:connected'})
    }
    this._dispatch({payload: {phase: 'initialStartupAsEarlyAsPossible'}, type: 'config:loadOnStart'})
  }

  // Called when we reconnect to the server
  _onConnected() {
    this._hasConnected = true

    // listeners already booted so they can get this
    if (this._listenersAreReady) {
      // dispatch the action version
      this._dispatch({payload: undefined, type: 'engine-gen:connected'})
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
        this._dispatch({payload: {params: param, ...extra}, type: `engine-gen:${type}`})
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
    session.start(p.method, p.params, p.callback)
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
      dispatch: this._dispatch,
      endHandler: (session: Session) => this._sessionEnded(session),
      incomingCallMap,
      invoke: (method, param, cb) => {
        const callback =
          method =>
          (...args) => {
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
    // TODO change how this global thing works. not nice w/ hot reload
    // if (this._customResponseAction[method]) {
    //     throw new Error('Dupe custom response handler registered: ' + method)
    // }

    this._customResponseAction[method] = true
  }
}

// Dummy engine for snapshotting
export class FakeEngine {
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
      dispatch: () => {},
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

const makeEngine = (dispatch: TypedDispatch) => {
  if (__DEV__ && engine) {
    logger.warn('makeEngine called multiple times')
  }

  if (!engine) {
    engine = isTesting ? (new FakeEngine() as unknown as Engine) : new Engine(dispatch)
    if (__DEV__) {
      global.DEBUGEngine = engine
    }
    initEngine(engine as any)
    initEngineListener(engineListener)
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
