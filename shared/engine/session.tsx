import {
  StatusCode,
  type CustomResponseIncomingCallMap,
  type IncomingCallMapType,
} from '@/constants/rpc/rpc-gen'
import {mustAnswerMethods} from '@/constants/rpc'
import {printRPC} from '@/local-debug'
import {rpcLog, type InvokeType} from './index.platform'
import {RPCError} from '@/util/errors'
import {getAccountGeneration, survivesAccountChange} from './account-generation'
import logger from '@/logger'
import {
  inputCanceledError,
  type SessionID,
  type ResponseType,
  type EndHandlerType,
  type MethodKey,
  type WaitingKey,
} from './types'

// A response the session handed to a handler. Settled once: by the handler, or by the session.
type HeldResponse = {
  method: MethodKey
  response: ResponseType
  settled: boolean
}

// A session is a series of calls back and forth tied together with a single sessionID
class Session {
  // Our id
  _id: SessionID
  // Map of methods => callbacks
  _incomingCallMap: IncomingCallMapType
  // Map of methods => callbacks
  _customResponseIncomingCallMap: CustomResponseIncomingCallMap
  // Let the outside know we're waiting
  _waitingKey: WaitingKey
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
  _dispatchWaiting: (key: WaitingKey, waiting: boolean, err?: RPCError) => void

  constructor(p: {
    sessionID: SessionID
    incomingCallMap?: IncomingCallMapType
    customResponseIncomingCallMap?: CustomResponseIncomingCallMap
    waitingKey?: WaitingKey
    invoke: InvokeType
    dispatchWaiting: (key: WaitingKey, waiting: boolean, err?: RPCError) => void
    endHandler: EndHandlerType
    dangling?: boolean
    globalFallthrough?: ReadonlyArray<string>
  }) {
    this._id = p.sessionID
    this._incomingCallMap = p.incomingCallMap || {}
    this._customResponseIncomingCallMap = p.customResponseIncomingCallMap || {}
    this._waitingKey = p.waitingKey || ''
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

  // Make a waiting handler for the request. We add additional data before calling the parent waitingHandler
  // and do internal bookkeeping if the request is done
  _makeWaitingHandler(method: MethodKey, seqid?: number) {
    return (waiting: boolean, err?: RPCError) => {
      if (printRPC) {
        rpcLog({
          extra: {
            id: this.getId(),
            seqid,
            this: this,
            waiting,
          },
          method,
          reason: `[${waiting ? '+' : '-'}waiting]`,
          type: 'engineInternal',
        })
      }
      if (this._waitingKey) {
        this._dispatchWaiting(this._waitingKey, waiting, err)
      }
    }
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
      if (held.response.seqid === seqid && this._settle(held)) {
        // Like an answer, the service is working on the RPC again
        this._makeWaitingHandler(held.method, seqid)(true)
      }
    }
  }

  _cancel(heldPrompts: 'refuse' | 'forget') {
    const promptWasPending = this._held.size > 0
    if (this._refusing) {
      // Already cancelled; only a lost link ends the refusal early, since the reply can't come now
      if (heldPrompts === 'forget') {
        this.end()
      }
      return
    }
    for (const held of [...this._held]) {
      this._settle(held, heldPrompts === 'refuse' ? () => held.response.error?.(inputCanceledError) : undefined)
    }
    if (this._startCallback) {
      // No server response is coming, so release the waiting count ourselves — but only when the
      // server owes us one; while a prompt is pending on the GUI the count was already released.
      if (this._waitingKey && !promptWasPending) {
        this._makeWaitingHandler(this._startMethod || 'unknown')(false)
      }
      const callback = this._startCallback
      this._startCallback = undefined
      callback(new RPCError('Received RPC cancel for session', StatusCode.sccanceled))
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
    write?.()
    return true
  }

  end() {
    if (this._ended) {
      return
    }
    this._ended = true
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

    const updateWaiting = this._makeWaitingHandler(method)
    updateWaiting(true)
    this._invokeOutstanding = true
    this._invoke(method, [wrappedParam], (err: unknown, data: unknown) => {
      this._invokeOutstanding = false
      if (this._refusing) {
        // The cancel already answered the caller and left the session not waiting
        this.end()
        return
      }
      if (this._belongsToPreviousAccount()) {
        updateWaiting(false)
        wrappedCallback(new RPCError('The account changed during this call', StatusCode.sccanceled))
        return
      }
      updateWaiting(false, err as RPCError | undefined)
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
        [key: string]: undefined | ((param: object, request: ResponseType) => void)
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

    const updateWaiting = this._makeWaitingHandler(method, response?.seqid)
    updateWaiting(false) // got a call from the server so we're no longer waiting
    const answer = (write: () => void) => {
      if (!this._settle(held, write)) {
        if (__DEV__) {
          logger.warn(`Session: ${method} was answered after it was already settled`)
        }
        return
      }
      updateWaiting(true) // after we respond to the server we're waiting on it again
    }
    const request: ResponseType = {
      error: (...args: Array<unknown>) => answer(() => held.response.error?.(...args)),
      result: (...args: Array<unknown>) => answer(() => held.response.result?.(...args)),
      get settled() {
        return held.settled
      },
    }
    try {
      custom(param, request)
    } catch (e) {
      logger.error(`Session: handler for ${method} threw`, e)
      // Refused like any answer, so the session is waiting on the service again
      if (!held.settled) {
        request.error?.(inputCanceledError)
      }
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
