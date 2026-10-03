import {
  StatusCode,
  type CustomResponseIncomingCallMap,
  type IncomingCallMapType,
} from '@/constants/rpc/rpc-gen'
import {mustAnswerMethods} from '@/constants/rpc'
import {printRPC} from '@/local-debug'
import {rpcLog, type InvokeType} from './index.platform'
import {convertToError, RPCError} from '@/util/errors'
import {makeDisconnectError} from './rpc-transport'
import {makeWaitingTracker, type WaitingTracker} from './waiting-tracker'
import {getAccountGeneration, survivesAccountChange} from './account-generation'
import logger from '@/logger'
import {
  inputCanceledError,
  type SessionID,
  type ResponseType,
  type EndHandlerType,
  type MethodKey,
  type WaitingChange,
  type WaitingKey,
} from './types'

// A response the session handed to a handler. Settled once: by the handler, or by the session.
type HeldResponse = {
  method: MethodKey
  response: ResponseType
  // What the handler got, which carries its onCancelledByService
  request?: ResponseType
  settled: boolean
  // Its handler runs later, and says when it has
  deferred?: boolean
  // Set once its handler has run and left it unanswered: the GUI owes the service until it settles
  release?: () => void
}

// A custom handler the listener runs later says so, and calls what this returns once it has run
export type DeferRun = () => () => void

// A session is a series of calls back and forth tied together with a single sessionID
class Session {
  // Our id
  _id: SessionID
  // Map of methods => callbacks
  _incomingCallMap: IncomingCallMapType
  // Map of methods => callbacks
  _customResponseIncomingCallMap: CustomResponseIncomingCallMap
  // Let the outside know we're waiting
  _waitingKey: WaitingKey | undefined
  // What the RPC shows on its waiting key; made at start
  _tracker: WaitingTracker | undefined
  // Tell engine we're done
  _endHandler: EndHandlerType | undefined
  // Responses handed to handlers and not yet settled (often we get cancel after we've replied)
  _held = new Set<HeldResponse>()
  _ended = false
  // The start RPC was sent and its reply has not come back
  _invokeOutstanding = false
  // Cancelled by the client while its RPC was outstanding: the caller has its rejection, and every
  // call the service still makes on this session is refused here until the reply or a lost link
  _refusing = false
  // If true this session exists forever
  _dangling: boolean
  // Name of the start method, just to help debug
  _startMethod: MethodKey | undefined
  // Prefixes of incoming methods a listener leaves to global handling; undefined for a plain call
  _globalFallthrough: ReadonlyArray<string> | undefined
  // Start callback so we can cancel our own callback
  _startCallback: ((err?: RPCError, ...args: Array<unknown>) => void) | undefined
  // The account generation the session started in; undefined until start
  _accountGeneration: number | undefined

  // Allow us to make calls
  _invoke: InvokeType
  _dispatchWaiting: (change: WaitingChange) => void

  constructor(p: {
    sessionID: SessionID
    incomingCallMap?: IncomingCallMapType
    customResponseIncomingCallMap?: CustomResponseIncomingCallMap
    waitingKey?: WaitingKey
    invoke: InvokeType
    dispatchWaiting: (change: WaitingChange) => void
    endHandler: EndHandlerType
    dangling?: boolean
    globalFallthrough?: ReadonlyArray<string>
  }) {
    this._id = p.sessionID
    this._incomingCallMap = p.incomingCallMap || {}
    this._customResponseIncomingCallMap = p.customResponseIncomingCallMap || {}
    this._waitingKey = p.waitingKey
    this._invoke = p.invoke
    this._dispatchWaiting = p.dispatchWaiting
    this._endHandler = p.endHandler
    this._dangling = p.dangling || false
    this._globalFallthrough = p.globalFallthrough
  }

  getId(): SessionID {
    return this._id
  }
  getDangling(): boolean {
    return this._dangling
  }
  isRefusing(): boolean {
    return this._refusing
  }

  // Started for an account that has since logged out, so nothing it receives may reach its handlers.
  _belongsToPreviousAccount() {
    return (
      this._accountGeneration !== undefined &&
      this._accountGeneration !== getAccountGeneration() &&
      !survivesAccountChange(this._startMethod ?? '')
    )
  }

  _logWaiting(waiting: boolean) {
    if (printRPC) {
      rpcLog({
        extra: {id: this.getId(), this: this, waiting},
        method: this._startMethod || 'unknown',
        reason: `[${waiting ? '+' : '-'}waiting]`,
        type: 'engineInternal',
      })
    }
  }

  // Server work the flow knows goes on while it holds a prompt; settling the RPC ends it too
  holdServerWork(): () => void {
    return this._tracker?.holdServerWork() ?? (() => {})
  }

  // Client-side cancel. The link is alive, so held prompts are refused and the service stops waiting.
  cancel() {
    this._cancel('refuse')
  }

  // The link died or is being replaced: a held prompt's answer must not reach the next connection.
  cancelForLostLink() {
    this._cancel('forget')
  }

  // The link died under a dangling session, which lives on: only its held prompts go unanswered
  forgetHeldForLostLink() {
    for (const held of [...this._held]) {
      this._settle(held)
    }
  }

  // The service cancelled one of its calls to us: it no longer reads an answer for that seqid. Only that
  // call ends; its RPC goes on and may make more calls (Go cancels a prompt's context, e.g. login's
  // DisplayAndPromptSecret once the other device finished, then calls ProvisioneeSuccess).
  cancelByService(seqid: number) {
    for (const held of [...this._held]) {
      // Like an answer, settling it has the service working on the RPC again
      if (held.response.seqid === seqid && this._settle(held)) {
        try {
          held.request?.onCancelledByService?.()
        } catch (e) {
          logger.error(`Session: the service-cancel handler for ${held.method} threw`, e)
        }
      }
    }
  }

  _cancel(heldPrompts: 'refuse' | 'forget') {
    if (this._refusing) {
      // Already cancelled; only a lost link ends the refusal early, since the reply can't come now
      if (heldPrompts === 'forget') {
        this.end()
      }
      return
    }
    // A lost link ends the call as the transport's failed reply would, whichever comes first, so the
    // caller and the key agree. A client cancel is the user's own and records nothing.
    const lostLink =
      heldPrompts === 'forget' ? (convertToError(makeDisconnectError(), this._startMethod) as RPCError) : undefined
    // Before the held prompts, whose releases would otherwise show it waiting on the service again
    this._tracker?.settle(lostLink)
    for (const held of [...this._held]) {
      this._settle(held, heldPrompts === 'refuse' ? () => held.response.error?.(inputCanceledError) : undefined)
    }
    if (this._startCallback) {
      const callback = this._startCallback
      this._startCallback = undefined
      callback(lostLink ?? new RPCError('Received RPC cancel for session', StatusCode.sccanceled))
    }

    // The service may still call us on this session before it replies, and a late prompt that
    // left the session would reach a global answerer (e.g. pinentry) instead
    if (heldPrompts === 'refuse' && this._invokeOutstanding) {
      this._refusing = true
    } else {
      this.end()
    }
  }

  // Settles a held response once, writing `write` if given; false if it was already settled
  _settle(held: HeldResponse, write?: () => void) {
    if (held.settled) {
      return false
    }
    held.settled = true
    this._held.delete(held)
    held.release?.()
    write?.()
    return true
  }

  end() {
    if (this._ended) {
      return
    }
    this._ended = true
    // Every path that ends a started session settles its RPC first
    if (this._tracker?.settle() && __DEV__) {
      logger.warn(`Session: ${this._startMethod ?? 'unknown'} ended without settling its waiting`)
    }
    // However the session ended, the service no longer reads answers to its calls on it
    for (const held of [...this._held]) {
      this._settle(held)
    }
    this._endHandler?.(this)
  }

  // Start the session normally. Tells engine we're done at the end
  start(method: MethodKey, param: object | undefined, callback: (() => void) | undefined) {
    this._startMethod = method
    this._startCallback = callback
    this._accountGeneration = getAccountGeneration()

    // When this request is done the session is done
    const wrappedCallback = (err: RPCError | undefined, ...args: Array<unknown>) => {
      this._startCallback?.(err, ...args)
      this._startCallback = undefined
      this.end()
    }

    const wrappedParam = {
      ...(param ?? {}),
      sessionID: this.getId(),
    }

    if (printRPC) {
      rpcLog({
        extra: {id: this.getId(), this: this},
        method,
        reason: '[+session]',
        type: 'engineInternal',
      })
    }

    const tracker = makeWaitingTracker(this._waitingKey, this._dispatchWaiting, w => this._logWaiting(w))
    this._tracker = tracker
    this._invokeOutstanding = true
    this._invoke(method, [wrappedParam], (err: unknown, data: unknown) => {
      this._invokeOutstanding = false
      if (this._refusing) {
        // The cancel already answered the caller and left the session not waiting
        this.end()
        return
      }
      if (this._belongsToPreviousAccount()) {
        tracker.settle()
        wrappedCallback(new RPCError('The account changed during this call', StatusCode.sccanceled))
        return
      }
      // Only the service's errors belong on the key, not a local failure like a queue overflow
      tracker.settle(err instanceof RPCError ? err : undefined)
      wrappedCallback(err as RPCError | undefined, data)
    })
  }

  // We have an incoming call tied to a sessionID, called only by engine
  incomingCall(method: MethodKey, param: object, response?: ResponseType): boolean {
    if (printRPC) {
      rpcLog({
        extra: {
          id: this.getId(),
          response,
          this: this,
        },
        method,
        reason: '[-calling:session]',
        type: 'engineInternal',
      })
    }

    const plain = (this._incomingCallMap as {[key: string]: undefined | ((param: object) => void)})[method]
    const custom = (
      this._customResponseIncomingCallMap as {
        [key: string]: undefined | ((param: object, request: ResponseType, deferRun: DeferRun) => void)
      }
    )[method]

    if (this._refusing) {
      if (custom || mustAnswerMethods.has(method)) {
        response?.error?.(inputCanceledError)
      } else {
        response?.result?.()
      }
      return true
    }

    if (!plain && !custom) {
      return false
    }

    if (this._belongsToPreviousAccount()) {
      response?.error?.({code: StatusCode.sccanceled, desc: 'The account changed during this call'})
      return true
    }

    if (!custom) {
      // The generated types keep these out of the plain map; an empty ack would read as a real answer
      if (mustAnswerMethods.has(method)) {
        logger.error(`Session: ${method} needs an answer but is in the incomingCallMap`)
        response?.error?.({code: StatusCode.scinputcanceled, desc: `No handler for ${method}`})
        return true
      }
      // Nothing to answer, so ack it here: the service is not parked on the GUI
      response?.result?.()
      try {
        plain?.(param)
      } catch (e) {
        logger.error(`Session: handler for ${method} threw`, e)
      }
      return true
    }

    // A custom call delivered as a notification has nothing to answer
    const held: HeldResponse = {method, response: response ?? {}, settled: false}
    this._held.add(held)

    const answer = (write: () => void) => {
      if (!this._settle(held, write) && __DEV__) {
        logger.warn(`Session: ${method} was answered after it was already settled`)
      }
    }
    const request: ResponseType = {
      error: (...args: Array<unknown>) => answer(() => held.response.error?.(...args)),
      result: (...args: Array<unknown>) => answer(() => held.response.result?.(...args)),
      get settled() {
        return held.settled
      },
    }
    held.request = request
    // An answer while its handler runs never shows the GUI owing, so an auto-answered prompt does not
    // blink the waiting key off
    const ran = () => {
      if (!held.settled) {
        held.release = this._tracker?.holdPrompt()
      }
    }
    const deferRun: DeferRun = () => {
      held.deferred = true
      return ran
    }
    try {
      custom(param, request, deferRun)
    } catch (e) {
      logger.error(`Session: handler for ${method} threw`, e)
      // Refused like any answer, so the session is waiting on the service again
      if (!held.settled) {
        request.error?.(inputCanceledError)
      }
    }
    if (!held.deferred) {
      ran()
    }
    return true
  }

  // An incoming method this session has no handler for and did not declare as left to global handling
  isUndeclaredFallthrough(method: MethodKey) {
    const declared = this._globalFallthrough
    return !!declared && !declared.some(prefix => method.startsWith(prefix))
  }

  // Tell engine if we can handle the cancelled call
  hasSeqID(seqID: number) {
    // The server can cancel callback seqids after we have already responded.
    // Only unresponded callback seqids should cancel the parent session.
    return [...this._held].some(held => held.response.seqid === seqID)
  }
}

export default Session
