// @flow
import type {SessionID, WaitingHandlerType, EndHandlerType, MethodKey} from './index'
import type {incomingCallMapType} from '../constants/types/flow-types'
import type {invokeType} from './index.platform'
import {IncomingRequest, OutgoingRequest} from './request'
import {ConstantsStatusCode} from '../constants/types/flow-types'
import {rpcLog} from './index.platform'
import {RPCError} from '../util/errors'

// A session is a series of calls back and forth tied together with a single sessionID
class Session {
  // Our id
  _id: SessionID
  // Map of methods => callbacks
  _incomingCallMap: incomingCallMapType
  // Let the outside know we're waiting
  _waitingHandler: ?WaitingHandlerType
  // Tell engine we're done
  _endHandler: ?EndHandlerType
  // Sequence IDs we've seen. Value is true if we've responded (often we get cancel after we've replied)
  _seqIDResponded: {[key: string]: boolean} = {}
  // If you want to know about being cancelled
  _cancelHandler: ?CancelHandlerType
  // If true this session exists forever
  _dangling: boolean
  // Name of the start method, just to help debug
  _startMethod: ?MethodKey
  // Start callback so we can cancel our own callback
  _startCallback: ?(err: RPCError, ...args: Array<any>) => void

  // Allow us to make calls
  _invoke: invokeType

  // Outstanding requests
  _outgoingRequests: Array<Object> = []
  _incomingRequests: Array<Object> = []

  constructor(
    sessionID: SessionID,
    incomingCallMap: ?incomingCallMapType,
    waitingHandler: ?WaitingHandlerType,
    invoke: invokeType,
    endHandler: EndHandlerType,
    cancelHandler?: ?CancelHandlerType,
    dangling?: boolean = false
  ) {
    this._id = sessionID
    this._incomingCallMap = incomingCallMap || {}
    this._waitingHandler = waitingHandler
    this._invoke = invoke
    this._endHandler = endHandler
    this._cancelHandler = cancelHandler
    this._dangling = dangling
  }

  set id(sessionID: SessionID) {
    throw new Error("Can't set sessionID")
  }
  get id(): SessionID {
    return this._id
  }
  get dangling(): boolean {
    return this._dangling
  }

  // Make a waiting handler for the request. We add additional data before calling the parent waitingHandler
  // and do internal bookkeeping if the request is done
  _makeWaitingHandler(isOutgoing: boolean, method: MethodKey, seqid: ?number) {
    return (waiting: boolean) => {
      rpcLog('engineInternal', 'waiting state change', {id: this.id, waiting, method, this: this, seqid})
      // Call the outer handler with all the params it needs
      this._waitingHandler && this._waitingHandler(waiting, method, this._id)

      // Request is finished, do cleanup
      if (!waiting) {
        const requests = isOutgoing ? this._outgoingRequests : this._incomingRequests
        const idx = requests.findIndex(r => r.method === method)
        if (idx !== -1) {
          // Mark us as responded
          if (seqid) {
            this._seqIDResponded[String(seqid)] = true
          }
          // Remove from our list
          requests.splice(idx, 1)
        }
      }
    }
  }

  cancel() {
    if (this._cancelHandler) {
      this._cancelHandler(this)
    } else if (this._startCallback) {
      this._startCallback(new RPCError('Received RPC cancel for session', ConstantsStatusCode.sccanceled))
    }

    this.end()
  }

  end() {
    this._endHandler && this._endHandler(this)
  }

  // Start the session normally. Tells engine we're done at the end
  start(method: MethodKey, param: ?Object, callback: ?() => void) {
    this._startMethod = method
    this._startCallback = callback

    // When this request is done the session is done
    const wrappedCallback = (...args) => {
      this._startCallback && this._startCallback(...args)
      this._startCallback = null
      this.end()
    }

    // Add the sessionID
    const wrappedParam = {
      ...param,
      sessionID: this.id,
    }

    rpcLog('engineInternal', 'session start call', {id: this.id, method, this: this})
    const outgoingRequest = new OutgoingRequest(
      method,
      wrappedParam,
      wrappedCallback,
      this._makeWaitingHandler(true, method),
      this._invoke
    )
    this._outgoingRequests.push(outgoingRequest)
    outgoingRequest.send()
  }

  // We have an incoming call tied to a sessionID, called only by engine
  incomingCall(method: MethodKey, param: Object, response: ?Object): boolean {
    rpcLog('engineInternal', 'session incoming call', {id: this.id, method, this: this, response})
    const handler = this._incomingCallMap[method]

    if (!handler) {
      return false
    }

    if (response && response.seqid) {
      this._seqIDResponded[String(response.seqid)] = false
    }

    const waitingHandler = this._makeWaitingHandler(false, method, response && response.seqid)
    const incomingRequest = new IncomingRequest(method, param, response, waitingHandler, handler)
    this._incomingRequests.push(incomingRequest)
    incomingRequest.handle()

    return true
  }

  // Tell engine if we can handle the cancelled call
  hasSeqID(seqID: number) {
    if (__DEV__) {
      if (this._seqIDResponded.hasOwnProperty(String(seqID))) {
        console.log('Cancelling seqid found, current session state', this)
      }
    }
    return this._seqIDResponded.hasOwnProperty(String(seqID))
  }
}

export type CancelHandlerType = (session: Session) => void
export default Session
