/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {forceUnboxRowsForService} from './metadata'

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

test('forceUnboxRowsForService deduplicates requests while an unbox is in flight', async () => {
  const resolvers = new Array<() => void>()
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockImplementation(
    () =>
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

  forceUnboxRowsForService([convID])
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(2)

  resolvers[1]?.()
  await flushPromises()
})
