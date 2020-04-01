/* eslint-env jest */
import rpc from 'framed-msgpack-rpc'
import {TransportShared} from '../transport-shared'
import {SendArg} from '../index.platform'

describe('TransportShared', () => {
  // Extend TransportShared to fake out some methods.
  class FakeTransportShared extends TransportShared {
    connected: boolean
    lastMessage: SendArg | null

    constructor() {
      super(
        {},
        () => {},
        () => {},
        () => {}
      )
      this.connected = false
      this.lastMessage = null
    }

    // Override Transport.is_connected -- see transport.iced in
    // framed-msgpack-rpc.
    is_connected() {
      return this.connected
    }

    // Override Packetizer.send -- see packetizer.iced in
    // framed-msgpack-rpc.
    send(msg: SendArg) {
      this.lastMessage = msg
      return true
    }
  }

  const args = {
    arg1: 5,
    arg2: 'value',
  }

  const invokeArgUncompressed = {
    args: [args],
    ctype: rpc.dispatch.COMPRESSION_TYPE_NONE,
    method: 'myMethod',
    notify: false,
    program: 'myProgram',
  }
  const invokeArgCompressed = {
    args: [args],
    // compressed by default
    // ctype: rpc.dispatch.compression_type_gzip
    method: 'myMethod',
    notify: false,
    program: 'myProgram',
  }

  const expectedMessageUncompressed = [4, 1, 0, 'myProgram.myMethod', [args]]
  const expectedMessageCompressed = [
    4,
    1,
    1,
    'myProgram.myMethod',
    Buffer.from('1f8b08000000000000039bd8b424b128dd9015441a2d2d4bcc294d0500b0970c8c13000000', 'hex'),
  ]

  it('invoke uncompressed', () => {
    const t = new FakeTransportShared()

    t.connected = true
    // Since connected is true, this should call send.
    // @ts-ignore codemode issue
    t.invoke(invokeArgUncompressed, () => {})
    expect(t.lastMessage).toEqual(expectedMessageUncompressed)
  })

  it('invoke uncompressed queued', () => {
    const t = new FakeTransportShared()

    t.connected = false
    // Since connected is false, this should queue up the message.
    // @ts-ignore codemode issue
    t.invoke(invokeArgUncompressed, () => {})
    expect(t.lastMessage).toBe(null)

    t.connected = true
    // _flush_queue is defined in Transport in transport.iced in
    // framed-msgpack-rpc.
    //
    // Since connected is true, this should call send.
    //
    // @ts-ignore codemode issue
    t._flush_queue()
    expect(t.lastMessage).toEqual(expectedMessageUncompressed)
  })

  it('invoke compressed', () => {
    const t = new FakeTransportShared()

    t.connected = true
    // Since connected is true, this should call send.
    // @ts-ignore codemode issue
    t.invoke(invokeArgCompressed, () => {})
    expect(t.lastMessage).toEqual(expectedMessageCompressed)
  })

  it('invoke compressed queued', () => {
    const t = new FakeTransportShared()

    t.connected = false
    // Since connected is false, this should queue up the message.
    // @ts-ignore codemode issue
    t.invoke(invokeArgCompressed, () => {})
    expect(t.lastMessage).toBe(null)

    t.connected = true
    // _flush_queue is defined in Transport in transport.iced in
    // framed-msgpack-rpc.
    //
    // Since connected is true, this should call send.
    //
    // @ts-ignore codemode issue
    t._flush_queue()
    expect(t.lastMessage).toEqual(expectedMessageCompressed)
  })
})
