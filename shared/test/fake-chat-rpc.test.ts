/// <reference types="jest" />
import * as T from '@/constants/types'
import {getChatRpc} from '@/chat/conversation/chat-rpc'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from './fake-chat-rpc'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let fake: FakeChatRpc

beforeEach(() => {
  useConfigState.setState({loggedIn: true, userSwitching: false})
  fake = installFakeChatRpc()
})

afterEach(() => {
  restoreChatRpc()
  resetAllStores()
})

test('installing makes it the adapter callers reach, restoring puts the service one back', () => {
  expect(getChatRpc()).toBe(fake)
  restoreChatRpc()
  expect(getChatRpc()).not.toBe(fake)
})

test('records every call in order, per method and across methods', async () => {
  await fake.joinConversation(conversationIDKey)
  await fake.markRead({conversationIDKey, forceUnread: true})
  await fake.joinConversation(conversationIDKey)
  expect(fake.calls('joinConversation')).toEqual([[conversationIDKey], [conversationIDKey]])
  expect(fake.params('markRead')).toEqual([{conversationIDKey, forceUnread: true}])
  expect(fake.log.map(c => c.method)).toEqual(['joinConversation', 'markRead', 'joinConversation'])
  fake.clearLog()
  expect(fake.log).toEqual([])
})

test('the call is recorded before its script runs', async () => {
  fake.on('joinConversation', () => {
    expect(fake.calls('joinConversation')).toHaveLength(1)
  })
  await fake.joinConversation(conversationIDKey)
})

test('unscripted, void methods resolve and data methods reject', async () => {
  await expect(fake.retryPost(T.Chat.stringToOutboxID('0a'))).resolves.toBeUndefined()
  await expect(fake.loadThread({conversationIDKey})).resolves.toEqual({offline: false})
  await expect(
    fake.downloadAttachment({conversationIDKey, downloadToCache: false, messageID: T.Chat.numberToMessageID(1)})
  ).rejects.toThrow('FakeChatRpc.downloadAttachment has no scripted result')
})

test('the conversation screens\' lookups reject unscripted; their updates resolve', async () => {
  const messageID = T.Chat.numberToMessageID(1)
  const lookups: Array<[string, () => Promise<unknown>]> = [
    ['previewConversation', async () => fake.previewConversation(conversationIDKey)],
    ['searchForwardDestinations', async () => fake.searchForwardDestinations('')],
    ['getUnfurlPreviews', async () => fake.getUnfurlPreviews(conversationIDKey, '')],
    [
      'loadGallery',
      async () =>
        fake.loadGallery({conversationIDKey, num: 1, onHit: () => {}, viewType: T.RPCChat.GalleryItemTyp.media}),
    ],
    ['getUnreadline', async () => fake.getUnreadline(conversationIDKey, messageID)],
    ['searchBotDestinations', async () => fake.searchBotDestinations('')],
    ['getBotTeamRole', async () => fake.getBotTeamRole(conversationIDKey, 'testbot')],
    ['getBotSettings', async () => fake.getBotSettings(conversationIDKey, 'testbot')],
    ['listPublicBotCommands', async () => fake.listPublicBotCommands('testbot')],
  ]
  for (const [method, call] of lookups) {
    await expect(call()).rejects.toThrow(`FakeChatRpc.${method} has no scripted result`)
  }
  await expect(fake.refreshParticipants(conversationIDKey)).resolves.toBeUndefined()
  await expect(fake.setTyping(conversationIDKey, true)).resolves.toBeUndefined()
  await expect(fake.removeBotMember({conversationIDKey, username: 'testbot'})).resolves.toBeUndefined()
})

test('once answers the next call ahead of on, then on takes over', async () => {
  fake.on('makeUploadTempFile', p => `/on/${p.filename}`)
  fake.once('makeUploadTempFile', () => '/once')
  const p = {data: new Uint8Array(), filename: 'a.png', outboxID: new Uint8Array()}
  await expect(fake.makeUploadTempFile(p)).resolves.toBe('/once')
  await expect(fake.makeUploadTempFile(p)).resolves.toBe('/on/a.png')
  await expect(fake.makeUploadTempFile(p)).resolves.toBe('/on/a.png')
})

test('fail and failOnce reject, and a throwing script rejects rather than throwing', async () => {
  fake.failOnce('pinMessage', new Error('once'))
  fake.fail('joinConversation', new Error('always'))
  const pin = fake.pinMessage(conversationIDKey, T.Chat.numberToMessageID(1))
  await expect(pin).rejects.toThrow('once')
  await expect(fake.pinMessage(conversationIDKey, T.Chat.numberToMessageID(1))).resolves.toBeUndefined()
  await expect(fake.joinConversation(conversationIDKey)).rejects.toThrow('always')
  await expect(fake.joinConversation(conversationIDKey)).rejects.toThrow('always')
})

test('a loadThread script streams through the caller callbacks', async () => {
  fake.on('loadThread', p => {
    p.onCachedThread?.('cached')
    p.onFullThread?.('full')
    return {offline: true}
  })
  const seen: Array<string> = []
  await expect(
    fake.loadThread({conversationIDKey, onCachedThread: t => seen.push(t), onFullThread: t => seen.push(t)})
  ).resolves.toEqual({offline: true})
  expect(seen).toEqual(['cached', 'full'])
})

test('loadThread keeps the contract: no request while the chat session is not ready', async () => {
  const script = jest.fn(() => ({offline: false}))
  fake.on('loadThread', script)
  useConfigState.setState({loggedIn: false})
  await expect(fake.loadThread({conversationIDKey})).resolves.toBeUndefined()
  expect(script).not.toHaveBeenCalled()
  expect(fake.calls('loadThread')).toEqual([])
})
