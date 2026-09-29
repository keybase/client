/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {
  hideConversation,
  joinConversation,
  muteConversation,
  muteConversationPromise,
} from './status-actions'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

let rpc: FakeChatRpc
let navigateToInbox: jest.SpyInstance
let setChatRootParams: jest.SpyInstance

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  rpc = installFakeChatRpc()
  navigateToInbox = jest.spyOn(Router, 'navigateToInbox').mockImplementation(() => {})
  setChatRootParams = jest.spyOn(Router, 'setChatRootParams').mockImplementation(() => true)
})

afterEach(() => {
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('joinConversation', () => {
  test('joining a conversation refreshes its participants', async () => {

    joinConversation(conversationIDKey)
    await flushPromises()

    expect(rpc.calls('joinConversation')).toEqual([[conversationIDKey]])
    expect(rpc.calls('refreshParticipants')).toEqual([[conversationIDKey]])
  })

  test('a failed join never claims the participants are fresh', async () => {
    rpc.fail('joinConversation', new Error('cannot join'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})

    joinConversation(conversationIDKey)
    await flushPromises()

    expect(rpc.calls('refreshParticipants')).toEqual([])
    // the failure is not handled here; it lands in ignorePromise's catch-all
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})

describe('conversation status', () => {
  const expectStatus = (status: T.RPCChat.ConversationStatus) =>
    expect(rpc.calls('setConversationStatus')).toContainEqual([conversationIDKey, status])

  test('hiding ignores the conversation and leaves it for the inbox', async () => {
    hideConversation(conversationIDKey, true)
    await flushPromises()

    expectStatus(T.RPCChat.ConversationStatus.ignored)
    expect(navigateToInbox).toHaveBeenCalledTimes(1)
    // not a phone: the desktop root also forgets the info panel for this conversation
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey, infoPanel: undefined})
  })

  test('unhiding refiles the conversation without navigating', async () => {
    hideConversation(conversationIDKey, false)
    await flushPromises()

    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(navigateToInbox).not.toHaveBeenCalled()
    expect(setChatRootParams).not.toHaveBeenCalled()
  })

  test('muting and unmuting set muted and unfiled', async () => {
    muteConversation(conversationIDKey, true)
    await flushPromises()
    expectStatus(T.RPCChat.ConversationStatus.muted)

    muteConversation(conversationIDKey, false)
    await flushPromises()
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(rpc.calls('setConversationStatus')).toHaveLength(2)
  })

  test('the promise form of mute resolves once the status is set', async () => {
    await muteConversationPromise(conversationIDKey, true)
    expectStatus(T.RPCChat.ConversationStatus.muted)

    await muteConversationPromise(conversationIDKey, false)
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
  })

  test('the promise form of mute rejects with the service error', async () => {
    rpc.fail('setConversationStatus', new Error('nope'))
    await expect(muteConversationPromise(conversationIDKey, true)).rejects.toThrow('nope')
  })

  test('a failed fire-and-forget status change is swallowed by ignorePromise', async () => {
    rpc.fail('setConversationStatus', new Error('nope'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    muteConversation(conversationIDKey, true)
    await flushPromises()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
  })
})
