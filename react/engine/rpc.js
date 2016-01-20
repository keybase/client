import EngineError from './errors'
import rpc from 'framed-msgpack-rpc'

const {
  transport: {RobustTransport}
} = rpc

class BaseTransport extends RobustTransport {
  constructor (opts, writeCallback, incomingRPCCallback) {
    super(opts)

    if (writeCallback) {
      this.writeCallback = writeCallback
    }
    if (incomingRPCCallback) {
      this.set_generic_handler(incomingRPCCallback)
    }
  }

  unwrap_incoming_error (err) {
    if (!err) {
      return null
    }

    if (typeof (err) === 'object') {
      return new EngineError(err)
    } else {
      return new Error(JSON.stringify(err))
    }
  }
}

export default BaseTransport
