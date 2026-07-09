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

const makeAttachmentMessage = (override?: Partial<T.Chat.MessageAttachment>) =>
  Message.makeMessageAttachment({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(201),
    ordinal: T.Chat.numberToOrdinal(201),
    outboxID: T.Chat.stringToOutboxID('attachment-outbox'),
    timestamp: 100,
    title: 'attachment title',
    ...override,
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

test('row type only uses suffixes that are stable for the message lifetime', () => {
  // pending flips to confirmed after every send; reactions toggle. Both would leave stale
  // recycling-pool labels behind, so they must NOT affect the row type.
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

  expect(getMessageRowType(pending)).toBe('text')
  expect(getMessageRowType(failed)).toBe('text:failed')
  expect(getMessageRowType(reply)).toBe('text:reply')
  expect(getMessageRowType(reaction)).toBe('text')
})

test('showUsername recomputes from the current neighboring ordinal after inserts and deletes', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(501)
  const insertedOrdinal = T.Chat.numberToOrdinal(502)
  const currentOrdinal = T.Chat.numberToOrdinal(503)
  const messageMap = new Map<T.Chat.Ordinal, T.Chat.Message>([
    [
      firstOrdinal,
      makeTextMessage({
        author: 'alice',
        id: T.Chat.numberToMessageID(501),
        ordinal: firstOrdinal,
      }),
    ],
    [
      currentOrdinal,
      makeTextMessage({
        author: 'bob',
        id: T.Chat.numberToMessageID(503),
        ordinal: currentOrdinal,
      }),
    ],
  ])

  expect(
    getMessageShowUsername({
      message: messageMap.get(currentOrdinal)!,
      messageMap,
      messageOrdinals: [firstOrdinal, currentOrdinal],
      ordinal: currentOrdinal,
      you: 'alice',
    })
  ).toBe('bob')

  messageMap.set(
    insertedOrdinal,
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(502),
      ordinal: insertedOrdinal,
    })
  )

  expect(
    getMessageShowUsername({
      message: messageMap.get(currentOrdinal)!,
      messageMap,
      messageOrdinals: [firstOrdinal, insertedOrdinal, currentOrdinal],
      ordinal: currentOrdinal,
      you: 'alice',
    })
  ).toBe('')

  messageMap.delete(insertedOrdinal)

  expect(
    getMessageShowUsername({
      message: messageMap.get(currentOrdinal)!,
      messageMap,
      messageOrdinals: [firstOrdinal, currentOrdinal],
      ordinal: currentOrdinal,
      you: 'alice',
    })
  ).toBe('bob')
})

test('row type combines stable suffixes and is unchanged by send confirmation', () => {
  const reply = makeTextMessage({
    id: T.Chat.numberToMessageID(600),
    ordinal: T.Chat.numberToOrdinal(600),
  })
  const pendingReplyWithReaction = makeTextMessage({
    id: T.Chat.numberToMessageID(601),
    ordinal: T.Chat.numberToOrdinal(601),
    reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
    replyTo: reply,
    submitState: 'pending',
  })
  const failedReply = makeTextMessage({
    errorReason: 'send failed',
    id: T.Chat.numberToMessageID(603),
    ordinal: T.Chat.numberToOrdinal(603),
    replyTo: reply,
    submitState: 'failed',
  })
  const failedAttachment = makeAttachmentMessage({
    errorReason: 'upload failed',
    id: T.Chat.numberToMessageID(602),
    ordinal: T.Chat.numberToOrdinal(602),
    submitState: 'failed',
  })

  expect(getMessageRowType(pendingReplyWithReaction)).toBe('text:reply')
  expect(getMessageRowType(failedReply)).toBe('text:failed:reply')
  expect(getMessageRowType(failedAttachment)).toBe('attachment:failed')

  // confirmation (pending → sent) must not change the type: the recycling pool label was recorded
  // at allocation and is never updated in place
  const confirmed = makeTextMessage({
    id: T.Chat.numberToMessageID(601),
    ordinal: T.Chat.numberToOrdinal(601),
    reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
    replyTo: reply,
    submitState: undefined,
  })

  expect(getMessageRowType(confirmed)).toBe('text:reply')
})
