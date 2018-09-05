// @flow
/* eslint-env jest */
import {TransportShared} from '../transport-shared'

describe('TransportShared', () => {
  type MessageType = [number, number, string, Object]

  class FakeTransportShared extends TransportShared {
    connected: boolean
    lastMessage: ?MessageType

    constructor() {
      super({}, () => {}, () => {}, () => {})
      this.connected = false
      this.lastMessage = null
    }

    is_connected = () => {
      return this.connected
    }

    send = (msg: MessageType) => {
      this.lastMessage = msg
    }
  }

  it('invoke', () => {
    const t = new FakeTransportShared()
    const msg = {program: 'foo', method: 'bar', args: [{}], notify: false}

    t.connected = true
    t.invoke(msg, () => {})
    expect(t.lastMessage).toEqual([0, 1, 'foo.bar', msg.args])
  })

  it('invoke queued', () => {
    const t = new FakeTransportShared()
    const msg = {program: 'foo', method: 'bar', args: [{}], notify: false}

    t.connected = false
    t.invoke(msg, () => {})
    expect(t.messages).toBe(null)

    t.connected = true

    // $FlowIssue Flow doesn't see inherited methods.
    t._flush_queue()
    expect(t.lastMessage).toEqual([0, 1, 'foo.bar', msg.args])
  })
})
