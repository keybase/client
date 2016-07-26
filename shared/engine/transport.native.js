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
    this.rawWriteLength = null
  }

  connect (cb) { cb() }
  is_connected () { return true } // eslint-disable-line camelcase
  reset () { }
  close () { }
  get_generation () { return 1 } // eslint-disable-line camelcase

  // We get called 2 times per transport. once with the lenth and once with the payload
  _raw_write (bufStr, enc) { // eslint-disable-line camelcase
    if (this.rawWriteLength === null) {
      this.rawWriteLength = Buffer.from(bufStr, enc)
    } else {
      const buffer = Buffer.concat([this.rawWriteLength, Buffer.from(bufStr, enc)])
      this.rawWriteLength = null
      this.writeCallback(buffer.toString('base64'))
    }
  }
}

export default MobileTransport
