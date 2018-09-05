// @flow
/* eslint-env jest */
import {TransportShared} from '../transport-shared'

describe('TransportShared', () => {
  class FakeTransportShared extends TransportShared {
    connected: boolean
    messages: any[]

    constructor() {
      super({}, () => {}, () => {}, () => {})
      this.connected = false
      this.messages = []
    }

    is_connected = () => {
      return this.connected
    }

    send = (msg: any) => {
      this.messages.push(msg)
    }
  }

  it('invoke', () => {
    const t = new FakeTransportShared()
    const msg = {program: 'foo', method: 'bar', args: {}}

    t.connected = true
    t.invoke(msg, () => {})
    expect(t.messages).toEqual([[0, 1, 'foo.bar', [msg.args]]])
  })

  it('invoke queued', () => {
    const t = new FakeTransportShared()
    const msg = {program: 'foo', method: 'bar', args: {}}

    t.connected = false
    t.invoke(msg, () => {})
    expect(t.messages).toEqual([])

    t.connected = true

    // $FlowIssue Flow doesn't see inherited methods.
    t._flush_queue()
    expect(t.messages).toEqual([[0, 1, 'foo.bar', [msg.args]]])
  })
})
