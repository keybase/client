import type {E2EEnv} from '../accounts/env'
import {ensurePeer, type Peer} from './peer-service'
import type {PeerRpc} from './peer-rpc'
import {CORPUS} from '../fixtures/corpus/corpus'
import {channelOwnerFrom, peerChannelOwner, peerSender, senderFrom, sendWithRetry, type IncomingSender} from './peer-actors'

jest.mock('./peer-service', () => ({ensurePeer: jest.fn()}))

const convIDKey = '0000aa11ff'

const fakePeer = (opts: {callFails?: string} = {}) => {
  const chatApi = jest.fn(async (_msg: object): Promise<unknown> => Promise.resolve({}))
  const calls: Array<{method: string; arg: object}> = []
  const close = jest.fn()
  const rpc: PeerRpc = {
    call: async <T,>(method: string, arg: object) => {
      calls.push({arg, method})
      if (opts.callFails) throw new Error(opts.callFails)
      return Promise.resolve(undefined as T)
    },
    close,
  }
  const peer: Peer = {
    chatApi,
    cli: async () => Promise.resolve(''),
    home: '/tmp/testhome',
    role: 'second',
    rpc: async () => Promise.resolve(rpc),
    user: 'testuser-mac',
  }
  return {calls, chatApi, close, peer}
}

test('send posts to the conversation by id through chat api', async () => {
  const {chatApi, peer} = fakePeer()
  await senderFrom(peer).send(convIDKey, 'hello')
  expect(chatApi).toHaveBeenCalledWith({
    method: 'send',
    params: {options: {conversation_id: convIDKey, message: {body: 'hello'}}},
  })
})

test('leave leaves the conversation by id through chat api', async () => {
  const {chatApi, peer} = fakePeer()
  await senderFrom(peer).leave(convIDKey)
  expect(chatApi).toHaveBeenCalledWith({method: 'leave', params: {options: {conversation_id: convIDKey}}})
})

test('attach sends a corpus file, titled, to the conversation by id through chat api', async () => {
  const {chatApi, peer} = fakePeer()
  const file = CORPUS[0]!.file
  await senderFrom(peer).attach(convIDKey, file, 'e2e-title')
  expect(chatApi).toHaveBeenCalledWith({
    method: 'attach',
    params: {options: {conversation_id: convIDKey, filename: file, title: 'e2e-title'}},
  })
})

test('attach refuses a file that is not in the corpus, before any call', async () => {
  const {chatApi, peer} = fakePeer()
  await expect(senderFrom(peer).attach(convIDKey, '/tmp/testhome/notes.txt', 'e2e-title')).rejects.toThrow('not a corpus file')
  expect(chatApi).not.toHaveBeenCalled()
})

test('typing calls updateTyping with the conversation id bytes and closes the connection', async () => {
  const {calls, close, peer} = fakePeer()
  await senderFrom(peer).typing(convIDKey, true)
  expect(calls).toEqual([
    {arg: {conversationID: Buffer.from(convIDKey, 'hex'), typing: true}, method: 'chat.1.local.updateTyping'},
  ])
  expect(close).toHaveBeenCalledTimes(1)
})

test('an rpc failure names the peer and still closes the connection', async () => {
  const {close, peer} = fakePeer({callFails: 'chat.1.local.updateTyping failed: boom'})
  await expect(senderFrom(peer).typing(convIDKey, false)).rejects.toThrow(
    'peer second at /tmp/testhome: chat.1.local.updateTyping failed: boom'
  )
  expect(close).toHaveBeenCalledTimes(1)
})

test('a malformed conversation id key is refused before any call', async () => {
  const {calls, peer} = fakePeer()
  await expect(channelOwnerFrom(peer).setMinWriterRole('not-hex', 'admin')).rejects.toThrow('not a conversation ID key')
  expect(calls).toEqual([])
})

test('owner actions: remove through chat api, min writer role through setConvMinWriterRoleLocal', async () => {
  const {calls, chatApi, peer} = fakePeer()
  const owner = channelOwnerFrom(peer)
  await owner.removeFromChannel(convIDKey, 'testuser-mac')
  expect(chatApi).toHaveBeenCalledWith({
    method: 'removefromchannel',
    params: {options: {conversation_id: convIDKey, usernames: ['testuser-mac']}},
  })
  await owner.setMinWriterRole(convIDKey, 'admin')
  await owner.setMinWriterRole(convIDKey, 'none')
  expect(calls).toEqual([
    {arg: {convID: Buffer.from(convIDKey, 'hex'), role: 3}, method: 'chat.1.local.setConvMinWriterRoleLocal'},
    {arg: {convID: Buffer.from(convIDKey, 'hex'), role: 0}, method: 'chat.1.local.setConvMinWriterRoleLocal'},
  ])
})

describe('which peer plays which part', () => {
  const env = {smokeUser: 'testuser'} as E2EEnv
  const ensure = jest.mocked(ensurePeer)
  beforeEach(() => ensure.mockReset())

  test('peerSender sends as the second peer', async () => {
    const {chatApi, peer} = fakePeer()
    ensure.mockResolvedValue(peer)
    await (await peerSender(env)).send(convIDKey, 'hi')
    expect(ensure.mock.calls).toEqual([['second', env]])
    expect(chatApi).toHaveBeenCalledTimes(1)
  })

  test('peerChannelOwner acts as the owner peer', async () => {
    const {chatApi, peer} = fakePeer()
    ensure.mockResolvedValue({...peer, role: 'owner'})
    await (await peerChannelOwner(env)).removeFromChannel(convIDKey, 'testuser-mac')
    expect(ensure.mock.calls).toEqual([['owner', env]])
    expect(chatApi).toHaveBeenCalledTimes(1)
  })
})

describe('sendWithRetry', () => {
  const sender = (answers: Array<Error | undefined>) => {
    const sends: Array<[string, string]> = []
    const s: IncomingSender = {
      attach: jest.fn(),
      leave: jest.fn(),
      send: async (convID, text) => {
        sends.push([convID, text])
        const a = answers.shift()
        if (a) throw a
        return Promise.resolve()
      },
      typing: jest.fn(),
    }
    return {s, sends}
  }
  const notYet = () => new Error('chat api send: no conversations matched')

  test('a send that finds no conversation yet is tried again until one goes out', async () => {
    const {s, sends} = sender([notYet(), notYet(), undefined])
    await sendWithRetry(s, convIDKey, 'hi', {intervalMs: 1, timeoutMs: 5_000})
    expect(sends).toEqual([
      [convIDKey, 'hi'],
      [convIDKey, 'hi'],
      [convIDKey, 'hi'],
    ])
  })

  test('any other failure is thrown at once', async () => {
    const {s, sends} = sender([new Error('peer second at /tmp/testhome: boom'), undefined])
    await expect(sendWithRetry(s, convIDKey, 'hi', {intervalMs: 1, timeoutMs: 5_000})).rejects.toThrow('boom')
    expect(sends).toHaveLength(1)
  })

  test('it stops at the deadline and throws the last answer', async () => {
    const {s, sends} = sender(Array.from({length: 1000}, notYet))
    const started = Date.now()
    await expect(sendWithRetry(s, convIDKey, 'hi', {intervalMs: 20, timeoutMs: 200})).rejects.toThrow('no conversations matched')
    const took = Date.now() - started
    expect(took).toBeGreaterThanOrEqual(200)
    expect(took).toBeLessThan(1_000)
    expect(sends.length).toBeGreaterThan(1)
    expect(sends.length).toBeLessThan(20)
  })
})
