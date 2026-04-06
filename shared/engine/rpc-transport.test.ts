/// <reference types="jest" />

import {
  RPCTransport,
  encodeFrame,
  errors,
  type IncomingRPCCallbackType,
  type RPCMessage,
} from './rpc-transport'

class TestTransport extends RPCTransport {
  private _connected = true
  sent = new Array<RPCMessage>()

  constructor(p?: {connected?: boolean; incomingRPCCallback?: IncomingRPCCallbackType}) {
    super({incomingRPCCallback: p?.incomingRPCCallback})
    this._connected = p?.connected ?? true
  }

  protected isConnected() {
    return this._connected
  }

  protected writeMessage(message: RPCMessage) {
    this.sent.push(message)
  }

  setConnected(connected: boolean) {
    this._connected = connected
  }

  flushConnected() {
    this.setConnected(true)
    this.onConnected()
  }

  dropConnection() {
    this.setConnected(false)
    this.onDisconnected()
  }
}

test('packetizeData handles split frames and dispatches responses', () => {
  const transport = new TestTransport()
  const cb = jest.fn()
  transport.invoke('keybase.1.test.hello', [{}], cb)

  const response = encodeFrame([1, 1, null, {ok: true}])
  transport.packetizeData(response.slice(0, 2))
  expect(cb).not.toHaveBeenCalled()

  transport.packetizeData(response.slice(2))
  expect(cb).toHaveBeenCalledWith(null, {ok: true})
})

test('invoke queues while disconnected and flushes on connect', () => {
  const transport = new TestTransport({connected: false})
  const cb = jest.fn()

  transport.invoke('keybase.1.test.hello', [{a: 1}], cb)
  expect(transport.sent).toEqual([])

  transport.flushConnected()
  expect(transport.sent).toEqual([[0, 1, 'keybase.1.test.hello', [{a: 1}]]])

  transport.dispatchDecodedMessage([1, 1, null, {done: true}])
  expect(cb).toHaveBeenCalledWith(null, {done: true})
})

test('disconnect fails outstanding invocations with EOF', () => {
  const transport = new TestTransport()
  const cb = jest.fn()

  transport.invoke('keybase.1.test.hello', [{}], cb)
  transport.dropConnection()

  expect(cb).toHaveBeenCalledWith(
    expect.objectContaining({code: errors.EOF, desc: errors.msg[errors.EOF]}),
    {}
  )
})

test('incoming invoke exposes response handlers', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      payload = incoming
    },
  })

  transport.dispatchDecodedMessage([0, 7, 'keybase.1.test.hello', [{sessionID: 9}]])

  expect(payload?.method).toBe('keybase.1.test.hello')
  expect(payload?.param).toEqual([{sessionID: 9}])

  payload?.response?.result?.({ok: true})
  expect(transport.sent).toEqual([[1, 7, null, {ok: true}]])
})

test('incoming invoke without handler returns unknown method error', () => {
  const transport = new TestTransport()

  transport.dispatchDecodedMessage([0, 11, 'keybase.1.test.missing', [{}]])

  expect(transport.sent).toEqual([
    [1, 11, {code: errors.UNKNOWN_METHOD, desc: errors.msg[errors.UNKNOWN_METHOD], name: 'UNKNOWN_METHOD'}, null],
  ])
})

test('cancel packets surface a cancelled response payload', () => {
  const incoming = jest.fn()
  const transport = new TestTransport({incomingRPCCallback: incoming})

  transport.dispatchDecodedMessage([3, 44])

  expect(incoming).toHaveBeenCalledWith(
    expect.objectContaining({
      method: '',
      param: [],
      response: expect.objectContaining({cancelled: true, seqid: 44}),
    })
  )
})
