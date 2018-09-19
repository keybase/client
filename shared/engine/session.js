// @flow
import type {SessionID, EndHandlerType, MethodKey} from './types'
import type {CustomResponseIncomingCallMap, IncomingCallMapType} from '../constants/types/rpc-gen'
import type {invokeType} from './index.platform'
import {IncomingRequest, OutgoingRequest} from './request'
import {constantsStatusCode} from '../constants/types/rpc-gen'
import {rpcLog} from './index.platform'
import {RPCError} from '../util/errors'
import {measureStart, measureStop} from '../dev/user-timings'
import {getEngine} from './require'

// A session is a series of calls back and forth tied together with a single sessionID
class Session {
  // Our id
  _id: SessionID
  // Map of methods => callbacks
  _incomingCallMap: IncomingCallMapType | {}
  // Map of methods => callbacks
  _customResponseIncomingCallMap: CustomResponseIncomingCallMap | {}
  // Let the outside know we're waiting
  _waitingKey: string
  // Tell engine we're done
  _endHandler: ?EndHandlerType
  // Sequence IDs we've seen. Value is true if we've responded (often we get cancel after we've replied)
  _seqIDResponded: {[key: string]: boolean} = {}
  // If you want to know about being cancelled
  // eslint-disable-next-line no-use-before-define
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

  constructor(p: {
    sessionID: SessionID,
    incomingCallMap: ?IncomingCallMapType,
    customResponseIncomingCallMap: ?CustomResponseIncomingCallMap,
    waitingKey?: string,
    invoke: invokeType,
    endHandler: EndHandlerType,
    cancelHandler?: ?CancelHandlerType,
    dangling?: boolean,
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

  setId(sessionID: SessionID) {
    throw new Error("Can't set sessionID")
  }
  getId(): SessionID {
    return this._id
  }
  getDangling(): boolean {
    return this._dangling
  }

  // Make a waiting handler for the request. We add additional data before calling the parent waitingHandler
  // and do internal bookkeeping if the request is done
  _makeWaitingHandler(isOutgoing: boolean, method: MethodKey, seqid: ?number) {
    return (waiting: boolean) => {
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
      if (this._waitingKey) {
        getEngine().dispatchWaitingAction(this._waitingKey, waiting)
      }

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
      this._startCallback(new RPCError('Received RPC cancel for session', constantsStatusCode.sccanceled))
    }

    this.end()
  }

  end() {
    if (this._startMethod) {
      measureStop(`engine:${this._startMethod}:${this.getId()}`)
    }
    this._endHandler && this._endHandler(this)
  }

  // Start the session normally. Tells engine we're done at the end
  start(method: MethodKey, param: Object, callback: ?() => void) {
    this._startMethod = method
    this._startCallback = callback

    // When this request is done the session is done
    const wrappedCallback = (...args) => {
      // $FlowIssue
      this._startCallback && this._startCallback(...args)
      this._startCallback = null
      this.end()
    }

    // Add the sessionID
    const wrappedParam = {
      ...param,
      sessionID: this.getId(),
    }

    rpcLog({
      extra: {id: this.getId(), this: this},
      method,
      reason: '[+session]',
      type: 'engineInternal',
    })

    const outgoingRequest = new OutgoingRequest(
      method,
      wrappedParam,
      wrappedCallback,
      this._makeWaitingHandler(true, method),
      this._invoke
    )
    this._outgoingRequests.push(outgoingRequest)
    measureStart(`engine:${method}:${this.getId()}`)
    outgoingRequest.send()
  }

  // We have an incoming call tied to a sessionID, called only by engine
  incomingCall(method: MethodKey, param: Object, response: ?Object): boolean {
    measureStart(`engine:${method}:${this.getId()}`)
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

    let handler = this._incomingCallMap[method]

    if (!handler) {
      handler = this._customResponseIncomingCallMap[method]
    }

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
