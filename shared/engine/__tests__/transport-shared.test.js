// @flow
/* eslint-env jest */
import {TransportShared} from '../transport-shared'

describe('TransportShared', () => {
  type MessageType = [number, number, string, Object]

  // Extend TransportShared to fake out some methods.
  class FakeTransportShared extends TransportShared {
    connected: boolean
    lastMessage: ?MessageType

    constructor() {
      super(
        {},
        () => {
          console.log('connectCallback')
        },
        () => {
          console.log('disconnectCallback')
        },
        () => {
          console.log('incomingRPCCallback')
        }
      )
      this.connected = false
      this.lastMessage = null
    }

    // Override Transport.is_connected -- see transport.iced in
    // framed-msgpack-rpc.
    is_connected = () => {
      return this.connected
    }

    // Override Packetizer.send -- see packetizer.iced in
    // framed-msgpack-rpc.
    send = (msg: MessageType) => {
      this.lastMessage = msg
    }
  }

  const args = {
    arg1: 5,
    arg2: 'value',
  }
  const invokeArg = {program: 'myProgram', method: 'myMethod', args: [args], notify: false}

  const expectedMessage = [0, 1, 'myProgram.myMethod', [args]]

  it('invoke', () => {
    const t = new FakeTransportShared()

    t.connected = true
    t.invoke(invokeArg, () => {})
    expect(t.lastMessage).toEqual(expectedMessage)
  })

  it('invoke queued', () => {
    const t = new FakeTransportShared()

    t.connected = false
    t.invoke(invokeArg, () => {})
    expect(t.lastMessage).toBe(null)

    t.connected = true

    // $FlowIssue Flow doesn't see inherited methods.
    t._flush_queue()
    expect(t.lastMessage).toEqual(expectedMessage)
  })
})
