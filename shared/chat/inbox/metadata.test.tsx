/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {forceUnboxRowsForService, getInboxConversationMeta, metasReceived} from './metadata'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('forceUnboxRowsForService reruns once for requests made while an unbox is in flight', async () => {
  const resolvers = new Array<() => void>()
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockImplementation(
    async () =>
      new Promise(resolve => {
        resolvers.push(() => {
          resolve(undefined)
        })
      })
  )

  forceUnboxRowsForService([convID])
  forceUnboxRowsForService([convID])
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(1)

  resolvers[0]?.()
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(2)

  resolvers[1]?.()
  await flushPromises()
})

const makeMeta = (over: Partial<T.Chat.ConversationMeta>): T.Chat.ConversationMeta => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey: convID,
  ...over,
})

test('metasReceived version-gates: newer inbox version wins, older is ignored', () => {
  metasReceived([makeMeta({inboxVersion: 2, snippet: 'v2', trustedState: 'trusted'})])
  metasReceived([makeMeta({inboxVersion: 1, snippet: 'v1', trustedState: 'trusted'})])
  expect(getInboxConversationMeta(convID)?.snippet).toBe('v2')
  expect(getInboxConversationMeta(convID)?.inboxVersion).toBe(2)
})

test('metasReceived gates same-version updates (change swallowed without force)', () => {
  metasReceived([makeMeta({inboxVersion: 2, snippet: 'orig', trustedState: 'trusted'})])
  metasReceived([makeMeta({inboxVersion: 2, snippet: 'changed', trustedState: 'trusted'})])
  expect(getInboxConversationMeta(convID)?.snippet).toBe('orig')
})

test('metasReceived force overwrites regardless of version', () => {
  metasReceived([makeMeta({inboxVersion: 2, snippet: 'orig', trustedState: 'trusted'})])
  metasReceived([makeMeta({inboxVersion: 1, snippet: 'forced'})], undefined, {force: true})
  expect(getInboxConversationMeta(convID)?.snippet).toBe('forced')
  expect(getInboxConversationMeta(convID)?.inboxVersion).toBe(1)
})
