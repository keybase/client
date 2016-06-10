import BaseTransport from './rpc'
import {Buffer} from 'buffer'

class MobileTransport extends BaseTransport {
  constructor (incomingRPCCallback, rpcWriteCallback) {
    super(
      {},
      rpcWriteCallback,
      incomingRPCCallback
    )
    this.needsConnect = false
    this.needsBase64 = true
    this.writeCallback = rpcWriteCallback
  }

  connect (cb) { cb() }
  is_connected () { return true } // eslint-disable-line camelcase
  reset () { }
  close () { }
  get_generation () { return 1 } // eslint-disable-line camelcase

  _raw_write_bufs (len, buf) { // eslint-disable-line camelcase
    const buffer = Buffer.concat([new Buffer(len), new Buffer(buf)])
    const data = buffer.toString('base64')
    this.writeCallback(data)
  }
}

export default MobileTransport
