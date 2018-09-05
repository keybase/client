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

    send = (msg: any) => {
      this._messages.push(msg)
    }
  }
  it('invoke', () => {
    const t = new FakeTransportShared()
    const msg = {foo: 'bar'}
    t.invoke(msg, () => {})
    expect(t._messages).toBe([msg])
  })
})
