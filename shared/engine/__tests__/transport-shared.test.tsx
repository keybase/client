/* eslint-env jest */
import {TransportShared} from '../transport-shared'
import {SendArg} from '../index.platform'

describe('TransportShared', () => {
  // Extend TransportShared to fake out some methods.
  class FakeTransportShared extends TransportShared {
    connected: boolean
    lastMessage: SendArg | null

    constructor() {
      super({}, () => {}, () => {}, () => {})
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
  const invokeArg = {args: [args], method: 'myMethod', notify: false, program: 'myProgram'}

  const expectedMessage = [0, 1, 'myProgram.myMethod', [args]]

  it('invoke', () => {
    const t = new FakeTransportShared()

    t.connected = true
    // Since connected is true, this should call send.
    // @ts-ignore codemode issue
    t.invoke(invokeArg, () => {})
    expect(t.lastMessage).toEqual(expectedMessage)
  })

  it('invoke queued', () => {
    const t = new FakeTransportShared()

    t.connected = false
    // Since connected is false, this should queue up the message.
    // @ts-ignore codemode issue
    t.invoke(invokeArg, () => {})
    expect(t.lastMessage).toBe(null)

    t.connected = true
    // _flush_queue is defined in Transport in transport.iced in
    // framed-msgpack-rpc.
    //
    // Since connected is true, this should call send.
    //
    // @ts-ignore codemode issue
    t._flush_queue()
    expect(t.lastMessage).toEqual(expectedMessage)
  })
})
