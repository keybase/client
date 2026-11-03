import type {E2EEnv} from '../accounts/env'
import {ensurePeer, type Peer} from './peer-service'
import type {PeerRpc} from './peer-rpc'
import {channelOwnerFrom, peerChannelOwner, peerSender, senderFrom} from './peer-actors'

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
