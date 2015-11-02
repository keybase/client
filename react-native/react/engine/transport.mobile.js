'use strict'

import BaseTransport from './rpc'

class MobileTransport extends BaseTransport {
  constructor (incomingRPCCallback, rpcWriteCallback) {
    super(
      {},
      rpcWriteCallback,
      incomingRPCCallback
    )
    this.needsConnect = false
    this.needsBase64 = true
  }

  connect (cb) { cb() }
  is_connected () { return true }
  reset () { }
  close () { }
  get_generation () { return 1 }

  _raw_write_bufs (len, buf) {
    const buffer = Buffer.concat([new Buffer(len), new Buffer(buf)])
    const data = buffer.toString('base64')
    this.writeCallback(data)
  }
}

export default MobileTransport
