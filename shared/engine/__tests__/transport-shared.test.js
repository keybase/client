// @flow
/* eslint-env jest */
import {TransportShared} from '../transport-shared'

describe('TransportShared', () => {
  class FakeTransportShared extends TransportShared {
    _messages: any[]

    constructor() {
      super({}, () => {}, () => {}, () => {})
      this._messages = []
    }

    is_connected = () => {
      return true
    }

    send = (msg: any) => {
      this._messages.push(msg)
    }
  }
  it('invoke', () => {
    const t = new FakeTransportShared()
    const msg = {program: 'foo', method: 'bar', args: {}, notify: null}
    t.invoke(msg, () => {})
    expect(t._messages).toEqual([[0, 1, 'foo.bar', [msg.args]]])
  })
})
