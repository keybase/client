// Handles sending requests to the daemon
import Session, {type CancelHandlerType} from './session'
import engineListener from './listener'
import logger from '../logger'
import throttle from 'lodash/throttle'
import type {CustomResponseIncomingCallMapType, IncomingCallMapType, BatchParams} from '.'
import type {SessionID, SessionIDKey, WaitingHandlerType, MethodKey} from './types'
import {initEngine, initEngineListener} from './require'
import {isMobile} from '../constants/platform'
import {printOutstandingRPCs, isTesting} from '../local-debug'
import {resetClient, createClient, rpcLog, type createClientType} from './index.platform'
import {type RPCError, convertToError} from '../util/errors'
import type * as EngineGen from '../actions/engine-gen-gen'

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
  _onConnectedCB: (c: boolean) => void
  // Bookkeep old sessions
  _deadSessionsMap: {[K in SessionIDKey]: true} = {}
  // Tracking outstanding sessions
  _sessionsMap: {[K in SessionIDKey]: Session} = {}
  // Helper we delegate actual calls to
  _rpcClient: createClientType
  // Set which actions we don't auto respond with so listeners can themselves
  _customResponseAction: {[K in MethodKey]: true} = {
    'keybase.1.rekeyUI.delegateRekeyUI': true,
    'keybase.1.secretUi.getPassphrase': true,
    ...(isMobile ? {'chat.1.chatUi.chatWatchPosition': true} : {'keybase.1.logsend.prepareLogsend': true}),
  }
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // We call onDisconnect handlers only if we've actually disconnected (ie connected once)
  _hasConnected: boolean = isMobile // mobile is always connected
  // App tells us when the listeners are done loading so we can start emitting events
  _listenersAreReady: boolean = false

  _emitWaiting: (changes: BatchParams) => void

  _queuedChanges: Array<{error: RPCError; increment: boolean; key: WaitingKey}> = []
  dispatchWaitingAction = (key: WaitingKey, waiting: boolean, error: RPCError) => {
    this._queuedChanges.push({error, increment: waiting, key})
    this._throttledDispatchWaitingAction()
  }

  _throttledDispatchWaitingAction = throttle(() => {
    const changes = this._queuedChanges
    this._queuedChanges = []
    this._emitWaiting(changes)
  }, 500)

  constructor(emitWaiting: (changes: BatchParams) => void, onConnected: (c: boolean) => void) {
    this._onConnectedCB = onConnected
    const f = async () => {
      this._engineConstantsIncomingCall = (
        await import('../constants')
      ).useEngineState.getState().dispatch.onEngineIncoming
    }
    f()
      .then(() => {})
      .catch(() => {})

    this._emitWaiting = emitWaiting
    this._rpcClient = createClient(
      payload => this._rpcIncoming(payload),
      () => this._onConnected(),
      () => this._onDisconnect()
    )
    this._setupDebugging()
  }

  _setupDebugging() {
    if (!__DEV__) {
      return
    }

    if (typeof window !== 'undefined') {
      logger.info('DEV MODE ENGINE AVAILABLE AS window.DEBUGengine')
      // @ts-ignore
      window.DEBUGengine = this
    }

    // Print out any alive sessions periodically
    if (printOutstandingRPCs) {
      setInterval(() => {
        if (Object.keys(this._sessionsMap).filter(k => !this._sessionsMap[k]?.getDangling()).length) {
          logger.localLog('outstandingSessionDebugger: ', this._sessionsMap)
        }
      }, 10 * 1000)
    }
  }

  _onDisconnect() {
    // tell renderer we're disconnected
    this._onConnectedCB(false)
  }

  // We want to dispatch the connect action but only after listeners boot up
  listenersAreReady = () => {
    this._listenersAreReady = true
    if (this._hasConnected) {
      this._onConnectedCB(true)
    }
  }

  // Called when we reconnect to the server. This only happens in node in the electron side.
  // We proxy the stuff over the mainWindowDispatch
  _onConnected() {
    this._hasConnected = true
    this._onConnectedCB(true)
  }

  // Create and return the next unique session id
  _generateSessionID() {
    this._nextSessionID++
    return this._nextSessionID
  }

  // Got a cancelled sequence id
  _handleCancel(seqid: number) {
    const cancelledSessionID = Object.keys(this._sessionsMap).find(
      key => this._sessionsMap[key]?.hasSeqID(seqid)
    )
    if (cancelledSessionID) {
      const s = this._sessionsMap[cancelledSessionID]
      rpcLog({
        extra: {cancelledSessionID},
        method: s?._startMethod || 'unknown',
        reason: '[cancel]',
        type: 'engineInternal',
      })
      s?.cancel()
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
  _rpcIncoming(payload: {method: MethodKey; param: Array<Object>; response?: any}) {
    const {method, param: incomingParam, response} = payload
    const param: any = incomingParam?.length ? incomingParam[0] || {} : {}
    const {seqid, cancelled} = response || {cancelled: false, seqid: 0}
    const {sessionID} = param

    if (cancelled) {
      this._handleCancel(seqid)
    } else {
      const session = this._sessionsMap[String(sessionID)]
      if (session?.incomingCall(method, param, response)) {
        // Part of a session?
      } else {
        // Dispatch as an action
        const extra = {}
        if (this._customResponseAction[method]) {
          // @ts-ignore
          extra.response = response
        } else {
          // Not a custom response so we auto handle it
          // @ts-ignore
          response && response.result()
        }
        const type = method
          .replace(/'/g, '')
          .split('.')
          .map((p, idx) => (idx ? capitalize(p) : p))
          .join('')

        const act = {payload: {params: param, ...extra}, type: `engine-gen:${type}`}
        this._engineConstantsIncomingCall(act as any)
      }
    }
  }
  _engineConstantsIncomingCall = (_a: EngineGen.Actions): void => {
    throw Error('needs override')
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
    incomingCallMap?: IncomingCallMapType
    customResponseIncomingCallMap?: CustomResponseIncomingCallMapType
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
        const callback =
          (method: string) =>
          (...args: any) => {
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
    if (isMobile) {
      return
    }
    resetClient(this._rpcClient)
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
    __: (arg0: {param: Object; response: Object | undefined; state: any}) => any
  ) {}
  createSession(
    _: IncomingCallMapType | undefined,
    __: WaitingHandlerType | undefined,
    ___: CancelHandlerType | undefined,
    ____: boolean = false
  ) {
    return new Session({
      endHandler: () => {},
      incomingCallMap: undefined,
      invoke: () => {},
      sessionID: 0,
    })
  }
  _channelMapRpcHelper(_: Array<string>, __: string, ___: any) {
    return null
  }
  _rpcOutgoing(
    _: string,
    __:
      | {
          incomingCallMap?: any
          waitingHandler?: WaitingHandlerType
        }
      | undefined,
    ___: (...args: Array<any>) => void
  ) {}
}

// don't overwrite this on HMR
let engine: Engine
if (__DEV__) {
  engine = global.DEBUGEngine
}

const makeEngine = (emitWaiting: (b: BatchParams) => void, onConnected: (c: boolean) => void) => {
  if (__DEV__ && engine) {
    logger.warn('makeEngine called multiple times')
  }

  if (!engine) {
    engine = isTesting ? (new FakeEngine() as unknown as Engine) : new Engine(emitWaiting, onConnected)
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
