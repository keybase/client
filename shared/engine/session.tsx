import {
  StatusCode,
  type CustomResponseIncomingCallMap,
  type IncomingCallMapType,
} from '@/constants/rpc/rpc-gen'
import {printRPC} from '@/local-debug'
import {rpcLog, type InvokeType} from './index.platform'
import {RPCError} from '@/util/errors'
import {getEngine} from './require'
import type {SessionID, ResponseType, EndHandlerType, MethodKey, WaitingKey} from './types'

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
  // Sequence IDs awaiting a response; removed once we've responded (often we get cancel after we've replied)
  _seqIDsAwaitingResponse = new Set<number>()
  // If you want to know about being cancelled
  _cancelHandler: CancelHandlerType | undefined
  // If true this session exists forever
  _dangling: boolean
  // Name of the start method, just to help debug
  _startMethod: MethodKey | undefined
  // Start callback so we can cancel our own callback
  _startCallback: ((err?: RPCError, ...args: Array<unknown>) => void) | undefined

  // Allow us to make calls
  _invoke: InvokeType

  constructor(p: {
    sessionID: SessionID
    incomingCallMap?: IncomingCallMapType
    customResponseIncomingCallMap?: CustomResponseIncomingCallMap
    waitingKey?: WaitingKey
    invoke: InvokeType
    endHandler: EndHandlerType
    cancelHandler?: CancelHandlerType
    dangling?: boolean
  }) {
    this._id = p.sessionID
    this._incomingCallMap = p.incomingCallMap || {}
    this._customResponseIncomingCallMap = p.customResponseIncomingCallMap || {}
    this._waitingKey = p.waitingKey || ''
    this._invoke = p.invoke
    this._endHandler = p.endHandler
    this._cancelHandler = p.cancelHandler
    this._dangling = p.dangling || false
  }

  getId(): SessionID {
    return this._id
  }
  getDangling(): boolean {
    return this._dangling
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
        getEngine().dispatchWaitingAction(this._waitingKey, waiting, err)
      }
    }
  }

  cancel() {
    if (this._cancelHandler) {
      this._cancelHandler(this)
    } else if (this._startCallback) {
      // No server response is coming, so release the waiting count ourselves — but only when the
      // server owes us one; while a prompt is pending on the GUI the count was already released.
      if (this._waitingKey && this._seqIDsAwaitingResponse.size === 0) {
        this._makeWaitingHandler(this._startMethod || 'unknown')(false)
      }
      const callback = this._startCallback
      this._startCallback = undefined
      callback(new RPCError('Received RPC cancel for session', StatusCode.sccanceled))
    }

    this.end()
  }

  end() {
    this._endHandler?.(this)
  }

  // Start the session normally. Tells engine we're done at the end
  start(method: MethodKey, param: object | undefined, callback: (() => void) | undefined) {
    this._startMethod = method
    this._startCallback = callback

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
    this._invoke(method, [wrappedParam], (err: unknown, data: unknown) => {
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

    let handler = (this._incomingCallMap as {[key: string]: unknown})[method] as
      | undefined
      | ((param: object | undefined, request: ResponseType) => void)

    if (!handler) {
      const c = this._customResponseIncomingCallMap as {[key: string]: typeof handler}
      handler = c[method]
    }

    if (!handler) {
      return false
    }

    if (response?.seqid !== undefined) {
      this._seqIDsAwaitingResponse.add(response.seqid)
    }

    const updateWaiting = this._makeWaitingHandler(method, response?.seqid)
    updateWaiting(false) // got a call from the server so we're no longer waiting
    // Responded; only unresponded seqids should cancel the session
    const onResponded = () => {
      if (response?.seqid !== undefined) {
        this._seqIDsAwaitingResponse.delete(response.seqid)
      }
      updateWaiting(true) // after we respond to the server we're waiting on it again
    }
    const request: ResponseType = {
      error: (...args: Array<unknown>) => {
        response?.error?.(...args)
        onResponded()
      },
      result: (...args: Array<unknown>) => {
        response?.result?.(...args)
        onResponded()
      },
    }
    handler(param, request)
    return true
  }

  // Tell engine if we can handle the cancelled call
  hasSeqID(seqID: number) {
    // The server can cancel callback seqids after we have already responded.
    // Only unresponded callback seqids should cancel the parent session.
    return this._seqIDsAwaitingResponse.has(seqID)
  }
}

export type CancelHandlerType = (session: Session) => void
export default Session
