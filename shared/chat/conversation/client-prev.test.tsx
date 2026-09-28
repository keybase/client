/// <reference types="jest" />
import * as T from '@/constants/types'
import {makeMessageText} from '@/constants/chat/message'
import type {ConversationThreadState} from './thread-context'
import {getClientPrevFromSnapshot, getClientPrevFromThread} from './client-prev'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const rows = (...pairs: ReadonlyArray<[ordinal: number, id: number]>) => {
  const messages = pairs.map(([ordinal, id]) =>
    makeMessageText({
      conversationIDKey,
      id: T.Chat.numberToMessageID(id),
      ordinal: T.Chat.numberToOrdinal(ordinal),
    })
  )
  const messageMap = new Map(messages.map(m => [m.ordinal, m] as const))
  const messageOrdinals = messages.map(m => m.ordinal)
  const snapshot = {messageMap, messageOrdinals} as unknown as ConversationThreadState
  return {messageMap, messageOrdinals, snapshot}
}

test('the two thread derivations agree on ordinary rows', () => {
  for (const r of [rows(), rows([1, 10]), rows([1, 10], [2, 11]), rows([1, 10], [1.001, 0])]) {
    expect(getClientPrevFromSnapshot(r.snapshot)).toBe(getClientPrevFromThread(r.messageMap, r.messageOrdinals))
  }
})

// why they stay two functions
test('they part only when an ordinal of 0 carries an id', () => {
  const r = rows([1, 10], [0, 7])
  expect(getClientPrevFromSnapshot(r.snapshot)).toBe(0)
  expect(getClientPrevFromThread(r.messageMap, r.messageOrdinals)).toBe(10)
})
