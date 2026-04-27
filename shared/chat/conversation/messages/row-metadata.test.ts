/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {
  getMessageRowType,
  getMessageShowUsername,
  getPreviousOrdinal,
} from './row-metadata'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const outboxID = T.Chat.stringToOutboxID('outbox-1')

const makeReaction = (username: string, timestamp: number): T.Chat.ReactionDesc => ({
  decorated: ':+1:',
  users: [{timestamp, username}],
})

const makeTextMessage = (override?: Omit<Partial<T.Chat.MessageText>, 'text'> & {text?: string}) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(101),
    ordinal: T.Chat.numberToOrdinal(101),
    outboxID,
    timestamp: 100,
    ...override,
    text: new HiddenString(override?.text ?? 'hello'),
  })

test('showUsername is derived from the previous ordinal and current message data', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(301)
  const secondOrdinal = T.Chat.numberToOrdinal(302)
  const messageOrdinals = [firstOrdinal, secondOrdinal]
  const messageMap = new Map<T.Chat.Ordinal, T.Chat.Message>([
    [
      firstOrdinal,
      makeTextMessage({
        author: 'bob',
        id: T.Chat.numberToMessageID(301),
        ordinal: firstOrdinal,
        outboxID: T.Chat.stringToOutboxID('first'),
        timestamp: 100,
      }),
    ],
    [
      secondOrdinal,
      makeTextMessage({
        author: 'bob',
        id: T.Chat.numberToMessageID(302),
        ordinal: secondOrdinal,
        outboxID: T.Chat.stringToOutboxID('second'),
        timestamp: 101,
      }),
    ],
  ])

  expect(getPreviousOrdinal(messageOrdinals, secondOrdinal)).toBe(firstOrdinal)
  expect(
    getMessageShowUsername({
      message: messageMap.get(secondOrdinal)!,
      messageMap,
      messageOrdinals,
      ordinal: secondOrdinal,
      you: 'alice',
    })
  ).toBe('')

  messageMap.set(
    firstOrdinal,
    makeTextMessage({
      author: 'alice',
      id: T.Chat.numberToMessageID(301),
      ordinal: firstOrdinal,
      outboxID: T.Chat.stringToOutboxID('first'),
      timestamp: 100,
    })
  )

  expect(
    getMessageShowUsername({
      message: messageMap.get(secondOrdinal)!,
      messageMap,
      messageOrdinals,
      ordinal: secondOrdinal,
      you: 'alice',
    })
  ).toBe('bob')

  expect(
    getMessageShowUsername({
      message: messageMap.get(secondOrdinal)!,
      messageMap,
      messageOrdinals: [secondOrdinal],
      ordinal: secondOrdinal,
      you: 'alice',
    })
  ).toBe('bob')
})

test('row type preserves native recycle distinctions', () => {
  const pending = makeTextMessage({
    id: T.Chat.numberToMessageID(401),
    ordinal: T.Chat.numberToOrdinal(401),
    outboxID: T.Chat.stringToOutboxID('pending-outbox'),
    submitState: 'pending',
  })
  const failed = makeTextMessage({
    errorReason: 'failed',
    id: T.Chat.numberToMessageID(402),
    ordinal: T.Chat.numberToOrdinal(402),
    outboxID: T.Chat.stringToOutboxID('failed-outbox'),
    submitState: 'failed',
  })
  const reply = makeTextMessage({
    id: T.Chat.numberToMessageID(403),
    ordinal: T.Chat.numberToOrdinal(403),
    outboxID: T.Chat.stringToOutboxID('reply-outbox'),
    replyTo: makeTextMessage({
      id: T.Chat.numberToMessageID(399),
      ordinal: T.Chat.numberToOrdinal(399),
    }),
  })
  const reaction = makeTextMessage({
    id: T.Chat.numberToMessageID(404),
    ordinal: T.Chat.numberToOrdinal(404),
    outboxID: T.Chat.stringToOutboxID('reaction-outbox'),
    reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
  })

  expect(getMessageRowType(pending)).toBe('text:pending')
  expect(getMessageRowType(failed)).toBe('text:pending')
  expect(getMessageRowType(reply)).toBe('text:reply')
  expect(getMessageRowType(reaction)).toBe('text:reactions')
})
