/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {updateInboxTyping, useInboxTypingState} from './typing-state'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

afterEach(() => {
  resetAllStores()
})

test('updateInboxTyping stores typers per conversation and replaces prior sets', () => {
  updateInboxTyping([
    {
      convID: T.Chat.keyToConversationID(convA),
      typers: [{deviceID: 'd', uid: 'u', username: 'carol'}],
    },
    {
      convID: T.Chat.keyToConversationID(convB),
      typers: [
        {deviceID: 'd', uid: 'u', username: 'bob'},
        {deviceID: 'd', uid: 'u', username: 'dave'},
      ],
    },
  ] as ReadonlyArray<T.RPCChat.ConvTypingUpdate>)

  expect([...(useInboxTypingState.getState().typing.get(convA) ?? [])]).toEqual(['carol'])
  expect((useInboxTypingState.getState().typing.get(convB) ?? new Set()).size).toBe(2)

  // an update for convA with no typers replaces its set; convB is left untouched
  updateInboxTyping([{convID: T.Chat.keyToConversationID(convA), typers: []}] as ReadonlyArray<
    T.RPCChat.ConvTypingUpdate
  >)
  expect((useInboxTypingState.getState().typing.get(convA) ?? new Set()).size).toBe(0)
  expect((useInboxTypingState.getState().typing.get(convB) ?? new Set()).size).toBe(2)
})
