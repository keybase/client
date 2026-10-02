// Handles sending requests to the daemon
import Session, {type CancelHandlerType} from './session'
import {makeListen} from './listener'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import {inputCanceledError, type SessionID, type MethodKey, type WaitingKey} from './types'
import {installCallPort, type CallPort} from './call-port'
import {printOutstandingRPCs, printRPC} from '@/local-debug'
import {
  createClient,
  rpcLog,
  type CreateClientType,
  type IncomingRPCCallbackType,
  type ConnectDisconnectCB,
  type PayloadType,
} from './index.platform'
import {type RPCError, convertToError} from '@/util/errors'
import {mustAnswerMethods} from '@/constants/rpc'
import type * as EngineGen from '@/constants/rpc'
import {StatusCode} from '@/constants/rpc/rpc-gen'
import {getIncomingAnswerer, type IncomingAnswerer} from './incoming-answerers'
import type {ErrorType, ResponseType as RPCResponseType} from './rpc-transport'
import type {IncomingCallMapType, CustomResponseIncomingCallMapType} from '@/constants/rpc/rpc-all-gen'

export type BatchParams = Array<{key: WaitingKey; increment: boolean; error?: RPCError}>
export type MakeClient = (
  incoming: IncomingRPCCallbackType,
  connect: ConnectDisconnectCB,
  disconnect: ConnectDisconnectCB
) => CreateClientType

class Engine implements CallPort {
  _onConnectedCB: (c: boolean) => void
  // Tracking outstanding sessions
  _sessionsMap = new Map<SessionID, Session>()
  // Prompts held by global answerers, by seqid: each entry drops its prompt unanswered
  _globalHeld = new Map<number, () => void>()
  // Helper we delegate actual calls to
  _rpcClient: CreateClientType
  _backgroundSessionMethods: Partial<Record<MethodKey, true>> = {
    'keybase.1.SimpleFS.simpleFSUserEditHistory': true,
    'keybase.1.config.waitForClient': true,
  }
  // We generate sessionIDs monotonically
  _nextSessionID: number = 123
  // App tells us when the listeners are done loading so we can start emitting events
  _listenersAreReady: boolean = false

  _emitWaiting: (changes: BatchParams) => void
  _onEngineIncoming?: (action: EngineGen.Actions) => void
  // Told when a listener gets an incoming method it neither handles nor declared as left to global
  // handling. The fake engine fails the test; unset, a dev build logs it.
  onUndeclaredIncoming?: (message: string) => void

  _queuedChanges: Array<{error?: RPCError; increment: boolean; key: WaitingKey}> = []
  dispatchWaitingAction = (key: WaitingKey, waiting: boolean, error?: RPCError) => {
    this._queuedChanges.push({error, increment: waiting, key})
    this._throttledDispatchWaitingAction()
    // Screens mount right after a prompt arrives and gate interaction/overlays on the waiting
    // state, so a "no longer waiting" change must land immediately — a throttled flush leaves
    // freshly pushed screens stuck seeing waiting=true for up to the throttle window.
    if (!waiting) {
      this._throttledDispatchWaitingAction.flush()
    }
  }

  _throttledDispatchWaitingAction = throttle(() => {
    const changes = this._queuedChanges
    this._queuedChanges = []
    if (changes.length) {
      this._emitWaiting(changes)
    }
  }, 500)

  constructor(
    emitWaiting: (changes: BatchParams) => void,
    onConnected: (c: boolean) => void,
    onEngineIncoming?: (action: EngineGen.Actions) => void,
    makeClient: MakeClient = createClient
  ) {
    this._onConnectedCB = onConnected
    this._onEngineIncoming = onEngineIncoming
    this._emitWaiting = emitWaiting
    this._rpcClient = makeClient(
      payload => this._rpcIncoming(payload),
      () => this._onConnected(),
      () => this._onDisconnect()
    )
  }

  rebindCallbacks(
    emitWaiting: (changes: BatchParams) => void,
    onConnected: (c: boolean) => void,
    onEngineIncoming?: (action: EngineGen.Actions) => void
  ) {
    this._emitWaiting = emitWaiting
    this._onConnectedCB = onConnected
    this._onEngineIncoming = onEngineIncoming
  }

  _setupDebugging() {
    if (!__DEV__) {
      return
    }

    global.DEBUGEngine = this

    // Print out any alive sessions periodically
    if (printOutstandingRPCs) {
      setInterval(() => {
        if ([...this._sessionsMap.values()].some(session => !session.getDangling())) {
          logger.localLog('outstandingSessionDebugger: ', this._sessionsMap)
        }
      }, 10 * 1000)
    }
  }

  _sessionSummary() {
    return [...this._sessionsMap.values()]
      .filter(session => !session.getDangling())
      .map(session => ({
        id: session.getId(),
        method: session._startMethod || 'unknown',
      }))
  }

  _onDisconnect() {
    logger.warn('Engine disconnected', {
      listenersAreReady: this._listenersAreReady,
      sessions: this._sessionSummary(),
    })
    this._cancelOutstandingSessions('lostLink')
    this._forgetGlobalHeld()
    // Like a link-up, a link-down is announced only once the app's listeners are ready
    if (this._listenersAreReady) {
      this._onConnectedCB(false)
    }
  }

  // Cancel the sessions so their promises reject and flows can react, instead of hanging forever on
  // answers that will never come (e.g. a provision prompt screen left up across a service restart).
  // When the transport died the service has forgotten every in-flight RPC, so held prompts are
  // dropped without an answer; otherwise the link is alive and they are refused. Dangling sessions
  // are never cancelled, but a lost link still drops what they hold.
  _cancelOutstandingSessions(why: 'lostLink' | 'client') {
    for (const session of [...this._sessionsMap.values()]) {
      if (session.getDangling()) {
        if (why === 'lostLink') {
          session.forgetHeldForLostLink()
        }
      } else {
        if (why === 'lostLink') {
          session.cancelForLostLink()
        } else {
          session.cancel()
        }
      }
    }
  }

  // The app is told the link is up once its listeners are ready, and once per link-up after that. A
  // repeat call is a store re-init (mobile fast refresh, desktop HMR) whose fresh stores have heard
  // nothing, so a link that is up is announced to them again.
  listenersAreReady = () => {
    this._listenersAreReady = true
    logger.info('Engine listenersAreReady', {
      linkUp: this._rpcClient.transport.isLinkUp,
      sessions: this._sessionSummary(),
    })
    if (this._rpcClient.transport.isLinkUp) {
      this._onConnectedCB(true)
    }
  }

  _onConnected() {
    logger.info('Engine connected', {
      listenersAreReady: this._listenersAreReady,
      sessions: this._sessionSummary(),
    })
    if (this._listenersAreReady) {
      this._onConnectedCB(true)
    }
  }

  // Create and return the next unique session id
  _generateSessionID() {
    this._nextSessionID++
    return this._nextSessionID
  }

  // Got a cancelled sequence id
  _handleCancel(seqid: number) {
    let cancelled: Session | undefined
    for (const s of this._sessionsMap.values()) {
      if (s.hasSeqID(seqid)) {
        cancelled = s
        break
      }
    }
    if (cancelled) {
      if (printRPC) {
        rpcLog({
          extra: {cancelledSessionID: cancelled.getId()},
          method: cancelled._startMethod || 'unknown',
          reason: '[cancel]',
          type: 'engineInternal',
        })
      }
      cancelled.cancelByService(seqid)
    } else if (this._globalHeld.has(seqid)) {
      // A global answerer's prompt: the service no longer reads its answer
      this._globalHeld.get(seqid)!()
    } else if (printRPC) {
      rpcLog({
        extra: {seqid},
        method: 'unknown',
        reason: '[cancel?]',
        type: 'engineInternal',
      })
    }
  }

  // An incoming rpc call
  _rpcIncoming(payload: PayloadType) {
    const {method, param: incomingParam, response} = payload
    const param = incomingParam[0] || {}
    const {seqid, cancelled} = response || {cancelled: false, seqid: 0}
    const {sessionID} = param

    if (cancelled) {
      this._handleCancel(seqid)
    } else {
      const session = typeof sessionID === 'number' ? this._sessionsMap.get(sessionID) : undefined
      if (session?.incomingCall(method, param, response)) {
        // Part of a session?
      } else {
        if (session?.isUndeclaredFallthrough(method)) {
          this._reportUndeclaredIncoming(`${session._startMethod ?? 'unknown'} got undeclared incoming ${method}`)
        }
        this._answerGlobalIncoming(method, param, response)
        const act = {
          payload: {params: param},
          type: method as EngineGen.ActionKey,
        } as EngineGen.EngineActions
        if (this._onEngineIncoming) {
          this._onEngineIncoming(act)
        }
      }
    }
  }

  _reportUndeclaredIncoming(message: string) {
    if (this.onUndeclaredIncoming) {
      this.onUndeclaredIncoming(message)
    } else if (__DEV__) {
      logger.error(message)
    }
  }

  // Exactly one answer for a call outside any session: its registered answerer's, else an ack, except
  // a must-answer call is refused since an empty result would read as a real answer.
  _answerGlobalIncoming(method: string, param: object, response: PayloadType['response']) {
    const answerer = getIncomingAnswerer(method)
    if (answerer) {
      const held = response ? this._holdGlobal(method, response, answerer) : undefined
      try {
        answerer.answer(param, held)
      } catch (e) {
        logger.error(`Engine: answerer for ${method} threw`, e)
        if (held && !held.settled) {
          held.error(inputCanceledError)
        }
      }
    } else if (mustAnswerMethods.has(method)) {
      if (__DEV__) {
        logger.error(`Engine: no answerer registered for ${method}`)
      }
      response?.error?.({code: StatusCode.scinputcanceled, desc: `No handler for ${method}`})
    } else {
      response?.result?.()
    }
  }

  // The response a global answerer holds, settled once: by the answerer, or by the engine when the
  // service cancels the call or the link goes, which writes nothing and tells the answerer.
  _holdGlobal(method: string, response: RPCResponseType, answerer: IncomingAnswerer) {
    const {seqid} = response
    let settled = false
    const settle = () => {
      if (settled) {
        return false
      }
      settled = true
      this._globalHeld.delete(seqid)
      return true
    }
    const answer = (write: () => void) => {
      if (settle()) {
        write()
      } else if (__DEV__) {
        logger.warn(`Engine: ${method} was answered after it was already settled`)
      }
    }
    const held = {
      error: (e?: ErrorType) => answer(() => response.error?.(e)),
      result: (r?: unknown) => answer(() => response.result?.(r)),
      seqid,
      get settled() {
        return settled
      },
    }
    this._globalHeld.set(seqid, () => {
      if (settle()) {
        answerer.onCancelled?.(held)
      }
    })
    return held
  }

  _forgetGlobalHeld() {
    for (const forget of [...this._globalHeld.values()]) {
      forget()
    }
  }

  // An outgoing call, made by the generated rpc helpers and by the listener
  call(p: {
    method: string
    params: object | undefined
    callback: (...args: Array<any>) => void
    incomingCallMap?: IncomingCallMapType
    customResponseIncomingCallMap?: CustomResponseIncomingCallMapType
    waitingKey?: WaitingKey
    globalFallthrough?: ReadonlyArray<string>
  }) {
    const {customResponseIncomingCallMap, globalFallthrough, incomingCallMap, waitingKey} = p
    const {method, params, callback} = p
    // Make a new session and start the request
    const session = this.createSession({
      customResponseIncomingCallMap,
      dangling: !!this._backgroundSessionMethods[method as MethodKey],
      globalFallthrough,
      incomingCallMap,
      waitingKey,
    })
    session.start(method, params, callback)
    return session.getId()
  }

  listen = makeListen(this)

  // Make a new session. If the session hangs around forever set dangling to true
  createSession(p: {
    incomingCallMap?: IncomingCallMapType
    customResponseIncomingCallMap?: CustomResponseIncomingCallMapType
    cancelHandler?: CancelHandlerType
    dangling?: boolean
    waitingKey?: WaitingKey
    globalFallthrough?: ReadonlyArray<string>
  }): Session {
    const {customResponseIncomingCallMap, incomingCallMap, cancelHandler, dangling = false} = p
    const {globalFallthrough, waitingKey} = p
    const sessionID = this._generateSessionID()

    const session = new Session({
      cancelHandler,
      customResponseIncomingCallMap,
      dangling,
      dispatchWaiting: this.dispatchWaitingAction,
      endHandler: session => this._sessionEnded(session),
      globalFallthrough,
      incomingCallMap,
      invoke: (method, param, cb) => {
        this._rpcClient.invoke(method, param, (...args: Array<unknown>) => {
          // If first argument is set, convert it to an Error type
          if (args.length > 0 && !!args[0]) {
            args[0] = convertToError(args[0], method)
          }
          cb(args[0], args[1])
        })
      },
      sessionID,
      waitingKey,
    })

    this._sessionsMap.set(sessionID, session)
    return session
  }

  // Cleanup a session that ended
  _sessionEnded(session: {getId: () => number; _startMethod?: string}) {
    if (printRPC) {
      rpcLog({
        extra: {
          sessionID: session.getId(),
        },
        method: session._startMethod || 'unknown',
        reason: '[-session]',
        type: 'engineInternal',
      })
    }
    this._sessionsMap.delete(session.getId())
  }

  // Client-side cancel of one outstanding session: rejects its start callback
  // (sccanceled) and ends it. The service is not told; its side dies on its own.
  cancelSession(sessionID: number) {
    this._sessionsMap.get(sessionID)?.cancel()
  }

  cancelOutstandingSessions() {
    this._cancelOutstandingSessions('client')
  }

  // Reset the engine
  reset() {
    if (isMobile) {
      return
    }
    logger.warn('Engine reset requested', {
      linkUp: this._rpcClient.transport.isLinkUp,
      listenersAreReady: this._listenersAreReady,
      sessions: this._sessionSummary(),
    })
    // The transport restarts the link; its drop settles what was in flight and calls _onDisconnect
    this._rpcClient.transport.reset()
  }
}

// don't overwrite this on HMR
let engine: Engine | undefined
if (__DEV__) {
  engine = global.DEBUGEngine as Engine
}

const makeEngine = (
  emitWaiting: (b: BatchParams) => void,
  onConnected: (c: boolean) => void,
  onEngineIncoming?: (action: EngineGen.Actions) => void
) => {
  if (__DEV__ && engine) {
    logger.warn('makeEngine called multiple times')
  }

  // An HMR'd engine built by older code may predate the call port
  const reused = engine as Partial<Engine> | undefined
  if (!engine || typeof reused?.call !== 'function' || typeof reused.listen !== 'function') {
    engine = new Engine(emitWaiting, onConnected, onEngineIncoming)
    engine._setupDebugging()
    if (reused) {
      // The old engine stops hearing the service, and the link restarts: the service's calls and
      // replies in flight carry the old engine's seqids, and the new engine needs a link-up of its own
      reused._rpcClient?.transport.close()
      engine._rpcClient.transport.restartLink()
    }
  } else {
    engine.rebindCallbacks(emitWaiting, onConnected, onEngineIncoming)
    // pick up listener.tsx edits on HMR
    engine.listen = makeListen(engine)
  }
  installCallPort(engine)
  return engine
}

const getEngine = (): Engine => {
  if (!engine) {
    throw new Error('Engine needs to be initialized first')
  }
  return engine
}

export default getEngine
export {getEngine, makeEngine, Engine}
export type {IncomingCallMapType, CustomResponseIncomingCallMapType}
