/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {
  getMessageRowType,
  getMessageShowUsername as getMessageHeader,
  getPreviousOrdinal,
} from './row-metadata'

const showUsernameFor = (p: Parameters<typeof getMessageHeader>[0]) => getMessageHeader(p).showUsername

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
    showUsernameFor({
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
    showUsernameFor({
      message: messageMap.get(secondOrdinal)!,
      messageMap,
      messageOrdinals,
      ordinal: secondOrdinal,
      you: 'alice',
    })
  ).toBe('bob')

  expect(
    showUsernameFor({
      message: messageMap.get(secondOrdinal)!,
      messageMap,
      messageOrdinals: [secondOrdinal],
      ordinal: secondOrdinal,
      you: 'alice',
    })
  ).toBe('bob')
})

test('a header hides but keeps its space once a real previous message groups the row', () => {
  const olderOrdinal = T.Chat.numberToOrdinal(701)
  const ordinal = T.Chat.numberToOrdinal(702)
  const message = makeTextMessage({
    author: 'bob',
    id: T.Chat.numberToMessageID(702),
    ordinal,
    outboxID: T.Chat.stringToOutboxID('current'),
    timestamp: 101,
  })
  const messageMap = new Map<T.Chat.Ordinal, T.Chat.Message>([[ordinal, message]])
  const shownCache = new Map<T.Chat.Ordinal, string>()

  // oldest row of the loaded window: nothing above it yet, so it leads a group
  expect(
    getMessageHeader({message, messageMap, messageOrdinals: [ordinal], ordinal, shownCache, you: 'alice'})
  ).toEqual({reserveHeader: false, showUsername: 'bob'})
  expect(shownCache.get(ordinal)).toBe('bob')

  // an unboxing placeholder above is not an answer, so the header stays
  messageMap.set(
    olderOrdinal,
    Message.makeMessagePlaceholder({
      conversationIDKey: convID,
      id: T.Chat.numberToMessageID(701),
      ordinal: olderOrdinal,
    })
  )
  expect(
    getMessageHeader({
      message,
      messageMap,
      messageOrdinals: [olderOrdinal, ordinal],
      ordinal,
      shownCache,
      you: 'alice',
    })
  ).toEqual({reserveHeader: false, showUsername: 'bob'})

  // it resolves to a same-author message close in time: the row groups, so the header stops showing
  // but keeps its space so the row height doesn't change under the load
  messageMap.set(
    olderOrdinal,
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(701),
      ordinal: olderOrdinal,
      outboxID: T.Chat.stringToOutboxID('older'),
      timestamp: 100,
    })
  )
  expect(
    getMessageHeader({
      message,
      messageMap,
      messageOrdinals: [olderOrdinal, ordinal],
      ordinal,
      shownCache,
      you: 'alice',
    })
  ).toEqual({reserveHeader: true, showUsername: ''})
})

test('a header forced by an unresolved previous is not remembered', () => {
  const olderOrdinal = T.Chat.numberToOrdinal(801)
  const ordinal = T.Chat.numberToOrdinal(802)
  const message = makeTextMessage({
    author: 'bob',
    id: T.Chat.numberToMessageID(802),
    ordinal,
    outboxID: T.Chat.stringToOutboxID('current'),
    timestamp: 101,
  })
  const messageOrdinals = [olderOrdinal, ordinal]
  const messageMap = new Map<T.Chat.Ordinal, T.Chat.Message>([
    [
      olderOrdinal,
      Message.makeMessagePlaceholder({
        conversationIDKey: convID,
        id: T.Chat.numberToMessageID(801),
        ordinal: olderOrdinal,
      }),
    ],
    [ordinal, message],
  ])
  const shownCache = new Map<T.Chat.Ordinal, string>()

  expect(
    getMessageHeader({message, messageMap, messageOrdinals, ordinal, shownCache, you: 'alice'})
  ).toEqual({reserveHeader: false, showUsername: 'bob'})
  expect(shownCache.has(ordinal)).toBe(false)

  // the placeholder unboxes into a same-author message: no header, and no space held for one — the
  // neighbor's own height was about to change anyway, so there is nothing to keep stable
  messageMap.set(
    olderOrdinal,
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(801),
      ordinal: olderOrdinal,
      outboxID: T.Chat.stringToOutboxID('older'),
      timestamp: 100,
    })
  )
  expect(
    getMessageHeader({message, messageMap, messageOrdinals, ordinal, shownCache, you: 'alice'})
  ).toEqual({reserveHeader: false, showUsername: ''})
})

test('a header shown for an ordinal outside the loaded window is not remembered', () => {
  // list churn can ask about an ordinal the window no longer holds. That looks the same as "oldest
  // row, nothing above it" from the previous ordinal alone, but it is not a real gap, so nothing
  // about it should be recorded and reserved later.
  const staleOrdinal = T.Chat.numberToOrdinal(901)
  const liveOrdinal = T.Chat.numberToOrdinal(902)
  const message = makeTextMessage({
    author: 'bob',
    id: T.Chat.numberToMessageID(901),
    ordinal: staleOrdinal,
    outboxID: T.Chat.stringToOutboxID('stale'),
    timestamp: 101,
  })
  const messageMap = new Map<T.Chat.Ordinal, T.Chat.Message>([[staleOrdinal, message]])
  const shownCache = new Map<T.Chat.Ordinal, string>()

  expect(
    getMessageHeader({
      message,
      messageMap,
      messageOrdinals: [liveOrdinal],
      ordinal: staleOrdinal,
      shownCache,
      you: 'alice',
    })
  ).toEqual({reserveHeader: false, showUsername: 'bob'})
  expect(shownCache.has(staleOrdinal)).toBe(false)
})

test('without a cache nothing is recorded and no space is ever reserved', () => {
  const olderOrdinal = T.Chat.numberToOrdinal(1001)
  const ordinal = T.Chat.numberToOrdinal(1002)
  const message = makeTextMessage({
    author: 'bob',
    id: T.Chat.numberToMessageID(1002),
    ordinal,
    outboxID: T.Chat.stringToOutboxID('current'),
    timestamp: 101,
  })
  const messageMap = new Map<T.Chat.Ordinal, T.Chat.Message>([[ordinal, message]])

  expect(
    getMessageHeader({message, messageMap, messageOrdinals: [ordinal], ordinal, you: 'alice'})
  ).toEqual({reserveHeader: false, showUsername: 'bob'})

  messageMap.set(
    olderOrdinal,
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(1001),
      ordinal: olderOrdinal,
      outboxID: T.Chat.stringToOutboxID('older'),
      timestamp: 100,
    })
  )
  expect(
    getMessageHeader({
      message,
      messageMap,
      messageOrdinals: [olderOrdinal, ordinal],
      ordinal,
      you: 'alice',
    })
  ).toEqual({reserveHeader: false, showUsername: ''})
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
    showUsernameFor({
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
    showUsernameFor({
      message: messageMap.get(currentOrdinal)!,
      messageMap,
      messageOrdinals: [firstOrdinal, insertedOrdinal, currentOrdinal],
      ordinal: currentOrdinal,
      you: 'alice',
    })
  ).toBe('')

  messageMap.delete(insertedOrdinal)

  expect(
    showUsernameFor({
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
