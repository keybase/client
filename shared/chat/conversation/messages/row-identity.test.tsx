/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import type * as React from 'react'
import {getRowIdentity, useRowIdentity, useRowPoolKey} from './row-identity'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {
  ConversationThreadProvider,
  type ConversationThreadState,
  type ConversationThreadStore,
  useConversationThreadActions,
} from '../thread-context'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const ord = (n: number) => T.Chat.numberToOrdinal(n)

const textAt = (n: number, author: string, timestamp: number) =>
  Message.makeMessageText({
    author,
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(n),
    ordinal: ord(n),
    text: new HiddenString(`m${n}`),
    timestamp,
  })

const placeholderAt = (n: number) =>
  Message.makeMessagePlaceholder({
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(n),
    ordinal: ord(n),
  })

// Immer hands the store a fresh state object on every change, and the derivation is memoized per
// state object, so a test that mutates one in place would read its own stale answer back. Each of
// these is a new commit.
const snapshotOf = (
  messages: ReadonlyArray<T.Chat.Message>,
  over: {generation?: number; messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>} = {}
) =>
  ({
    generation: over.generation ?? 0,
    messageMap: new Map(messages.map(m => [m.ordinal, m])),
    messageOrdinals: over.messageOrdinals ?? messages.map(m => m.ordinal),
    messageTypeMap: new Map<T.Chat.Ordinal, T.Chat.RenderMessageType>(),
  }) as unknown as ConversationThreadState

// The cache is per conversation, keyed on the store that owns the window; any stable object stands
// in for one here.
const stubStore = () => ({}) as unknown as ConversationThreadStore

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('a header hides but keeps its space once a real previous message groups the row', () => {
  const store = stubStore()
  const message = textAt(702, 'bob', 101)

  // The oldest row of the loaded window: nothing above it yet, so it leads a group.
  expect(getRowIdentity(store, snapshotOf([message]), ord(702), 'alice')).toEqual({
    poolKey: 'text:hdr',
    reserveHeader: false,
    showUsername: 'bob',
  })

  // An unboxing placeholder above is not an answer, so the header stays.
  expect(
    getRowIdentity(store, snapshotOf([placeholderAt(701), message]), ord(702), 'alice')
  ).toEqual({poolKey: 'text:hdr', reserveHeader: false, showUsername: 'bob'})

  // It resolves to a same-author message close in time: the row groups, so the header stops showing
  // but keeps its space - and its pool - so the row height does not change under the load.
  expect(
    getRowIdentity(store, snapshotOf([textAt(701, 'bob', 100), message]), ord(702), 'alice')
  ).toEqual({poolKey: 'text:hdr', reserveHeader: true, showUsername: ''})
})

test('a header forced by an unresolved previous is not remembered', () => {
  const store = stubStore()
  const message = textAt(802, 'bob', 101)

  expect(
    getRowIdentity(store, snapshotOf([placeholderAt(801), message]), ord(802), 'alice')
  ).toEqual({poolKey: 'text:hdr', reserveHeader: false, showUsername: 'bob'})

  // The placeholder unboxes into a same-author message: no header, and no space held for one - the
  // neighbour's own height was about to change anyway, so there is nothing to keep stable.
  expect(
    getRowIdentity(store, snapshotOf([textAt(801, 'bob', 100), message]), ord(802), 'alice')
  ).toEqual({poolKey: 'text', reserveHeader: false, showUsername: ''})
})

test('a header shown for an ordinal outside the loaded window is not remembered', () => {
  // List churn can ask about an ordinal the window no longer holds. That looks the same as "oldest
  // row, nothing above it" from the previous ordinal alone, but it is not a real gap.
  const store = stubStore()
  const stale = textAt(901, 'bob', 101)
  const live = textAt(902, 'bob', 100)

  expect(
    getRowIdentity(store, snapshotOf([stale, live], {messageOrdinals: [ord(902)]}), ord(901), 'alice')
  ).toEqual({poolKey: 'text:hdr', reserveHeader: false, showUsername: 'bob'})

  // Nothing was recorded, so once it is back in the window and grouped it reserves no space.
  expect(
    getRowIdentity(store, snapshotOf([textAt(900, 'bob', 100), stale]), ord(901), 'alice')
  ).toEqual({poolKey: 'text', reserveHeader: false, showUsername: ''})
})

test('dropping the window forgets the headers it painted', () => {
  // messagesClear bumps the generation, and the sticky record describes the window that is gone.
  const store = stubStore()
  const message = textAt(702, 'bob', 101)
  getRowIdentity(store, snapshotOf([message]), ord(702), 'alice')

  expect(
    getRowIdentity(store, snapshotOf([textAt(701, 'bob', 100), message], {generation: 1}), ord(702), 'alice')
  ).toEqual({poolKey: 'text', reserveHeader: false, showUsername: ''})
})

test('a row whose message the window no longer holds pools by its type map', () => {
  const store = stubStore()
  const snapshot = snapshotOf([], {messageOrdinals: [ord(500)]})
  snapshot.messageTypeMap.set(ord(500), 'attachment')

  expect(getRowIdentity(store, snapshot, ord(500), 'alice')).toEqual({
    poolKey: 'attachment',
    reserveHeader: false,
    showUsername: '',
  })
})

// The failure mode that was unreachable while the sticky map was a mutable Map handed to two
// callers: getItemType read it through the live store, the row read it through its own selector's
// snapshot, and whichever ran first decided what the other saw. A row typed headerless while it
// renders a header lands in the headerless recycling pool and poisons that pool's height average.
test('a row the list typed before it mounted paints into the pool it was given', () => {
  // getItemType is asked about rows that have not rendered - that is the whole point of it - so the
  // answer it gets has to be the one the row will agree with when it finally mounts. `act` flushes
  // renders, so a single hook holding both callers can never show this: the row has always already
  // computed by the time the pool is asked. The row consumer mounts on the second render instead.
  const seen: {
    actions?: ReturnType<typeof useConversationThreadActions>
    identity?: ReturnType<typeof useRowIdentity>
    poolKeyFor?: (o: T.Chat.Ordinal) => string
  } = {}
  // These exist to be mounted at different times and hand their hook's answer back out; writing to
  // an enclosing scope is the whole job, and it is not something the compiler will compile.
  const Actions = () => {
    'use no memo'
    seen.actions = useConversationThreadActions()
    return null
  }
  const Pool = () => {
    'use no memo'
    seen.poolKeyFor = useRowPoolKey()
    return null
  }
  const Row = () => {
    'use no memo'
    seen.identity = useRowIdentity(ord(702))
    return null
  }
  const tree = (withRow: boolean) => (
    <ConversationThreadProvider id={convID}>
      <Actions />
      <Pool />
      {withRow ? <Row /> : null}
    </ConversationThreadProvider>
  )

  const {rerender} = render(tree(false))
  act(() => {
    seen.actions?.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(702, 'bob', 101)],
      moreToLoad: true,
      scrollDirection: 'none',
    })
  })
  // Typed with nothing rendering it.
  const typed = seen.poolKeyFor?.(ord(702))
  expect(typed).toBe('text:hdr')

  // A scroll-back load groups it under a same-author previous, still with nothing rendering it, so
  // the sticky record is written by the list's question rather than the row's.
  act(() => {
    seen.actions?.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(701, 'bob', 100)],
      moreToLoad: true,
      scrollDirection: 'back',
    })
  })
  expect(seen.poolKeyFor?.(ord(702))).toBe('text:hdr')

  // Now it mounts: it must reserve the header height the list already pooled it for, rather than
  // deciding for itself that a grouped row is headerless.
  rerender(tree(true))
  expect(seen.identity).toEqual({poolKey: 'text:hdr', reserveHeader: true, showUsername: ''})
})

test('the row and the list are told the same thing, whichever asks first', () => {
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
  )
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      identity: useRowIdentity(ord(702)),
      poolKeyFor: useRowPoolKey(),
    }),
    {wrapper}
  )

  // The oldest row of the window paints a header, and the list asks first.
  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(702, 'bob', 101)],
      moreToLoad: true,
      scrollDirection: 'none',
    })
  })
  expect(result.current.poolKeyFor(ord(702))).toBe('text:hdr')
  expect(result.current.identity).toEqual({
    poolKey: 'text:hdr',
    reserveHeader: false,
    showUsername: 'bob',
  })

  // A scroll-back load hands it a same-author previous: the header goes, the space stays, and both
  // callers still say so.
  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(701, 'bob', 100)],
      moreToLoad: true,
      scrollDirection: 'back',
    })
  })
  expect(result.current.identity).toEqual({
    poolKey: 'text:hdr',
    reserveHeader: true,
    showUsername: '',
  })
  expect(result.current.poolKeyFor(ord(702))).toBe('text:hdr')
})

test('signing in as someone else reaches only the rows that answer differently for them', () => {
  const store = stubStore()
  // An invite this row announces. getUsernameToShow suppresses the header when the invitee is the
  // signed-in user, so this is the one answer in the whole derivation that `you` reaches.
  const invite = {
    adder: '',
    author: '[Keybase]',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(901),
    inviteType: 'none',
    invitee: 'bob',
    inviter: '',
    ordinal: ord(901),
    role: 'none',
    team: '',
    timestamp: 100,
    type: 'systemInviteAccepted',
  } as unknown as T.Chat.Message
  // ...and a plain row that groups under a same-author previous, so it is holding reserved header
  // space that has nothing to do with who is signed in.
  const grouped = textAt(903, 'carol', 201)
  const messages = [invite, textAt(902, 'carol', 200), grouped]

  // As alice: the invite is addressed to someone else, so it paints bob's header and records it.
  expect(getRowIdentity(store, snapshotOf(messages), ord(901), 'alice').showUsername).toBe('bob')
  // And the grouped row leads its group first, so it records a header of its own...
  expect(getRowIdentity(store, snapshotOf([grouped]), ord(903), 'alice')).toEqual({
    poolKey: 'text:hdr',
    reserveHeader: false,
    showUsername: 'carol',
  })
  // ...which it then keeps the space for once its same-author previous arrives.
  expect(getRowIdentity(store, snapshotOf(messages), ord(903), 'alice')).toEqual({
    poolKey: 'text:hdr',
    reserveHeader: true,
    showUsername: '',
  })

  // Now ask the same derivation as bob.
  // The invite is now addressed to the signed-in user: no header, and no held-open gap for one,
  // because this is a real change in what the row is rather than a load about to fill it back in.
  expect(getRowIdentity(store, snapshotOf(messages), ord(901), 'bob')).toEqual({
    poolKey: 'systemInviteAccepted',
    reserveHeader: false,
    showUsername: '',
  })
  // The grouped row answers the same for anyone, so it keeps the space it reserved. Dropping the
  // record wholesale would have collapsed this row by a header's height for no reason.
  expect(getRowIdentity(store, snapshotOf(messages), ord(903), 'bob')).toEqual({
    poolKey: 'text:hdr',
    reserveHeader: true,
    showUsername: '',
  })
})
