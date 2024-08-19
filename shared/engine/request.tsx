// Incoming and outgoing requests that are in a session
import type {MethodKey, ResponseType} from './types'
import type {InvokeType} from './index.platform'
import type {RPCError} from '@/util/errors'

type SimpleWaiting = (waiting: boolean, err?: RPCError) => void

// Base class. Handles method and parameters. Waiting callback
class Request {
  // RPC call name
  method: MethodKey
  // RPC parameters
  param: object
  // Let others know our waiting state
  _waitingHandler: SimpleWaiting
  // If we're waiting for a response
  _waiting: boolean = false

  constructor(method: MethodKey, param: object, waitingHandler: SimpleWaiting) {
    this.method = method
    this.param = param
    this._waitingHandler = waitingHandler
  }

  updateWaiting(waiting: boolean, err?: RPCError) {
    this._waiting = waiting
    this._waitingHandler(waiting, err)
  }
}

class IncomingRequest extends Request {
  // Callback in the incomingCallMap
  _handler: (param: object | undefined, request: ResponseType) => void
  _response: ResponseType | undefined

  constructor(
    method: MethodKey,
    param: object,
    response: ResponseType | undefined,
    waitingHandler: SimpleWaiting,
    handler: (param: object | undefined, request: ResponseType) => void
  ) {
    super(method, param, waitingHandler)

    this._handler = handler
    this._response = response
  }

  _cleanup() {
    this.updateWaiting(true) // We just responded to the server so now we're waiting
  }

  result(...args: Array<any>) {
    this._response?.result(...args)
    this._cleanup()
  }

  error(...args: Array<any>) {
    this._response?.error(...args)
    this._cleanup()
  }

  handle() {
    this.updateWaiting(false) // we just got a response from the server so we're no longer waiting

    // Note we pass ourself to the handler and not the raw response. This allows us to clean up
    return this._handler(this.param, this)
  }
}

class OutgoingRequest extends Request {
  // Callback when we've gotten a response
  _callback: (err: RPCError | undefined, data: unknown) => void
  // How we make calls
  _invoke: InvokeType

  constructor(
    method: MethodKey,
    param: object,
    callback: (err: RPCError | undefined, data: unknown) => void,
    waitingHandler: SimpleWaiting,
    invoke: InvokeType
  ) {
    super(method, param, waitingHandler)
    this._invoke = invoke
    this._callback = callback
  }

  send() {
    this.updateWaiting(true)
    this._invoke(this.method, [this.param], (err: unknown, data: unknown) => {
      this._sendCallback(err as RPCError | undefined, data)
    })
  }

  _sendCallback(err: RPCError | undefined, data: unknown) {
    this.updateWaiting(false, err)
    this._callback(err, data)
  }
}

export {IncomingRequest, OutgoingRequest}
