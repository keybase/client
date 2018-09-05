// @flow
// Incoming and outgoing requests that are in a session
import type {MethodKey, ResponseType} from './types'
import type {invokeType} from './index.platform'

type SimpleWaiting = (waiting: boolean) => void

// Base class. Handles method and parameters. Waiting callback
class Request {
  // RPC call name
  method: MethodKey
  // Let others know our waiting state
  _waitingHandler: (waiting: boolean) => void
  // If we're waiting for a response
  _waiting: boolean = false

  constructor(method: MethodKey, waitingHandler: SimpleWaiting) {
    this.method = method
    this._waitingHandler = waitingHandler
  }

  updateWaiting(waiting: boolean): void {
    this._waiting = waiting
    this._waitingHandler(waiting)
  }
}

class IncomingRequest extends Request {
  // RPC parameters
  param: Object
  // Callback in the incomingCallMap
  _handler: (param: ?Object, request: ResponseType) => void
  _response: ?ResponseType

  constructor(
    method: MethodKey,
    param: ?Object,
    response: ?ResponseType,
    waitingHandler: SimpleWaiting,
    handler: Function
  ) {
    super(method, waitingHandler)
    this.param = param || {}
    this._handler = handler
    this._response = response
  }

  _cleanup() {
    this.updateWaiting(true) // We just responded to the server so now we're waiting
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
    this.updateWaiting(false) // we just got a response from the server so we're no longer waiting

    // Note we pass ourself to the handler and not the raw response. This allows us to clean up
    this._handler(this.param, this)
  }
}

class OutgoingRequest extends Request {
  // RPC parameters
  param: [Object]
  // Callback when we've gotten a response
  _callback: (err: any, data: any) => void
  // How we make calls
  _invoke: ?invokeType

  constructor(
    method: MethodKey,
    param: [Object],
    callback: () => void,
    waitingHandler: SimpleWaiting,
    invoke: invokeType
  ) {
    super(method, waitingHandler)
    this.param = param
    this._invoke = invoke
    this._callback = callback
  }

  send(): void {
    this.updateWaiting(true)
    if (this._invoke) {
      this._invoke(this.method, this.param, (err, data) => this._sendCallback(err, data))
    }
  }

  _sendCallback(err: any, data: any): void {
    this.updateWaiting(false)
    this._callback && this._callback(err, data)
  }
}

export {IncomingRequest, OutgoingRequest}
