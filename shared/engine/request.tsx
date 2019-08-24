// Incoming and outgoing requests that are in a session
import {MethodKey, ResponseType} from './types'
import {invokeType} from './index.platform'
import {RPCError} from '../util/errors'

type SimpleWaiting = (waiting: boolean, err: RPCError | null) => void

// Base class. Handles method and parameters. Waiting callback
class Request {
  // RPC call name
  method: MethodKey
  // RPC parameters
  param: Object
  // Let others know our waiting state
  _waitingHandler: SimpleWaiting
  // If we're waiting for a response
  _waiting: boolean = false

  constructor(method: MethodKey, param: Object, waitingHandler: SimpleWaiting) {
    this.method = method
    this.param = param
    this._waitingHandler = waitingHandler
  }

  updateWaiting(waiting: boolean, err?: RPCError | null) {
    this._waiting = waiting
    this._waitingHandler(waiting, err || null)
  }
}

class IncomingRequest extends Request {
  // Callback in the incomingCallMap
  _handler: (param: Object | null, request: ResponseType) => void
  _response: ResponseType | null

  constructor(
    method: MethodKey,
    param: Object,
    response: ResponseType | null,
    waitingHandler: SimpleWaiting,
    handler: any
  ) {
    super(method, param, waitingHandler)

    this._handler = handler
    this._response = response
  }

  _cleanup() {
    this.updateWaiting(true, null) // We just responded to the server so now we're waiting
  }

  result(...args: Array<any>) {
    this._response && this._response.result(...args)
    this._cleanup()
  }

  error(...args: Array<any>) {
    this._response && this._response.error(...args)
    this._cleanup()
  }

  handle() {
    this.updateWaiting(false, null) // we just got a response from the server so we're no longer waiting

    // Note we pass ourself to the handler and not the raw response. This allows us to clean up
    return this._handler(this.param, this)
  }
}

class OutgoingRequest extends Request {
  // Callback when we've gotten a response
  _callback: (err: any, data: any) => void
  // How we make calls
  _invoke: invokeType

  constructor(
    method: MethodKey,
    param: Object,
    callback: () => void,
    waitingHandler: SimpleWaiting,
    invoke: invokeType
  ) {
    super(method, param, waitingHandler)
    this._invoke = invoke
    this._callback = callback
  }

  send() {
    this.updateWaiting(true)
    this._invoke(this.method, [this.param], (err, data) => this._sendCallback(err, data))
  }

  _sendCallback(err: any, data: any) {
    this.updateWaiting(false, err)
    this._callback && this._callback(err, data)
  }
}

export {IncomingRequest, OutgoingRequest}
