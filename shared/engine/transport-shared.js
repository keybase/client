// @flow
import EngineError from './errors'
import rpc from 'framed-msgpack-rpc'

const {
  transport: {RobustTransport},
  client: {Client: RpcClient},
} = rpc

class TransportShared extends RobustTransport {
// $FlowIssue
  constructor (opts, connectCallback, incomingRPCCallback, writeCallback) {
    const hooks = connectCallback ? {
      connected: () => {
        // $FlowIssue complains that this might be null
        this.needsConnect = false
        connectCallback()
      },
    } : null

    super({hooks, ...opts})

    if (writeCallback) {
      this.writeCallback = writeCallback
    }
    if (incomingRPCCallback) {
      this.set_generic_handler(incomingRPCCallback)
    }
  }

  unwrap_incoming_error (err: any) { // eslint-disable-line camelcase
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

function sharedCreateClient (nativeTransport: any) {
  const rpcClient = new RpcClient(nativeTransport, 'keybase.1')

  if (rpcClient.transport.needsConnect) {
    rpcClient.transport.connect(err => {
      if (err != null) {
        console.log('Error in connecting to transport rpc:', err)
      }
    })
  }

  return rpcClient
}

export {
  TransportShared,
  sharedCreateClient,
}
