/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {setImmediate} from 'node:timers'
import {useConversationMetadataReload, useRequestIncompleteConversationMeta} from '@/chat/conversation/data-hooks'
import {_onEngineIncoming} from '@/constants/init/shared'
import {startNewAccountGeneration} from '@/engine/account-generation'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush, tick} from '@/test/flush'
import {
  forceUnboxRowsForService,
  getInboxConversationMeta,
  getInboxConversationParticipants,
  metasReceived,
  requestIncompleteConversationMeta,
  unboxRows,
} from './metadata'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const requestInboxUnbox = 'chat.1.local.requestInboxUnbox'

let fake: FakeEngine
const unboxRequests = () =>
  paramsOf(fake, requestInboxUnbox).map((p: {convIDs: Array<Uint8Array>; force: boolean}) => ({
    convIDs: p.convIDs.map(T.Chat.conversationIDToKey),
    force: p.force,
  }))

// what the service sends the GUI for a requested conv, as the app routes it
const serviceAnswers = async (method: string, params: object) => {
  await fake.push(method, params)
  await tick()
}

const unboxed = (): T.RPCChat.InboxUIItem =>
  ({
    botAliases: {},
    botCommands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
    channel: '',
    commands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
    convID: T.Chat.conversationIDKeyToString(convID),
    draft: '',
    finalizeInfo: null,
    headline: '',
    headlineDecorated: '',
    isEmpty: false,
    localVersion: 1,
    maxMsgID: 10,
    maxVisibleMsgID: 10,
    memberStatus: T.RPCChat.ConversationMemberStatus.active,
    membersType: T.RPCChat.ConversationMembersType.impteamnative,
    name: 'testuser,testuser-mac',
    participants: [
      {assertion: 'testuser', inConvName: true},
      {assertion: 'testuser-mac', inConvName: true},
    ],
    readMsgID: 0,
    snippet: '',
    snippetDecorated: '',
    snippetDecoration: T.RPCChat.SnippetDecoration.none,
    status: T.RPCChat.ConversationStatus.unfiled,
    teamType: T.RPCChat.TeamType.simple,
    time: 1,
    tlfID: 'tlf-id',
    version: 1,
    visibility: T.RPCGen.TLFVisibility.private,
  }) as unknown as T.RPCChat.InboxUIItem

const failure = (typ: T.RPCChat.ConversationErrorType, message: string) => ({
  convID: T.Chat.keyToConversationID(convID),
  error: {
    message,
    remoteConv: {convID: T.Chat.conversationIDKeyToString(convID)},
    typ,
    unverifiedTLFName: '',
  },
})

beforeEach(() => {
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  fake.answer(requestInboxUnbox, () => {})
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({uid: 'uid', username: 'testuser'})
  useDaemonState.setState({handshakeState: 'done'})
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  resetAllStores()
})

test('a conv the service fails to unbox is answered by the failure, and nothing asks again', async () => {
  jest.useFakeTimers({doNotFake: ['setImmediate']})
  requestIncompleteConversationMeta(convID)
  await tick()
  expect(unboxRequests()).toEqual([{convIDs: [convID], force: false}])

  await serviceAnswers(
    'chat.1.chatUi.chatInboxFailed',
    failure(T.RPCChat.ConversationErrorType.transient, 'conversation not found')
  )
  await jest.advanceTimersByTimeAsync(120000)

  expect(getInboxConversationMeta(convID)).toBeUndefined()
  expect(unboxRequests()).toHaveLength(1)
})

test('a permanent failure shows the error, and the header leaves recovery to the error screen', async () => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, trustedState: 'untrusted'}])
  requestIncompleteConversationMeta(convID)
  await tick()

  await serviceAnswers('chat.1.chatUi.chatInboxFailed', failure(T.RPCChat.ConversationErrorType.permanent, 'boom'))
  expect(getInboxConversationMeta(convID)?.trustedState).toBe('error')

  requestIncompleteConversationMeta(convID)
  await tick()
  expect(unboxRequests()).toHaveLength(1)
})

test('the unboxed conversation answers the request with meta and participants', async () => {
  requestIncompleteConversationMeta(convID)
  await tick()

  await serviceAnswers('chat.1.chatUi.chatInboxConversation', {convs: JSON.stringify([unboxed()])})
  expect(getInboxConversationMeta(convID)?.trustedState).toBe('trusted')
  expect(getInboxConversationParticipants(convID)?.name).toEqual(['testuser', 'testuser-mac'])

  requestIncompleteConversationMeta(convID)
  await tick()
  expect(unboxRequests()).toHaveLength(1)
})

// what startHandshake does when the link comes back
const reconnect = () =>
  useDaemonState.setState(s => {
    s.handshakeGeneration += 1
    s.handshakeState = 'loading'
  })

const untrusted = () =>
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, trustedState: 'untrusted'}], undefined, {
    force: true,
  })

test('three screens asking for a conv with no answer yet send one call', async () => {
  unboxRows([convID])
  unboxRows([convID])
  unboxRows([convID])
  await tick()

  expect(unboxRequests()).toEqual([{convIDs: [convID], force: false}])
})

test('a forced request goes while the conv is waiting on its answer', async () => {
  unboxRows([convID])
  await tick()
  forceUnboxRowsForService([convID])
  await tick()

  expect(unboxRequests()).toEqual([
    {convIDs: [convID], force: false},
    {convIDs: [convID], force: true},
  ])
})

test('the conversation answering a request lets the next one go', async () => {
  untrusted()
  unboxRows([convID])
  await tick()
  await serviceAnswers('chat.1.chatUi.chatInboxConversation', {convs: JSON.stringify([unboxed()])})
  untrusted()

  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

test('a failure answering a request holds the next ordinary one until something about the conv changes', async () => {
  unboxRows([convID])
  await tick()
  await serviceAnswers('chat.1.chatUi.chatInboxFailed', failure(T.RPCChat.ConversationErrorType.transient, 'x'))

  // asking again would get the same answer
  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(1)

  unboxRows([convID], {changed: true})
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

test('a failure answering a request lets a forced one go', async () => {
  unboxRows([convID])
  await tick()
  await serviceAnswers('chat.1.chatUi.chatInboxFailed', failure(T.RPCChat.ConversationErrorType.transient, 'x'))

  forceUnboxRowsForService([convID])
  await tick()
  expect(unboxRequests()).toEqual([
    {convIDs: [convID], force: false},
    {convIDs: [convID], force: true},
  ])
})

test('a failure answering a request holds the next one only until a reconnect', async () => {
  unboxRows([convID])
  await tick()
  await serviceAnswers('chat.1.chatUi.chatInboxFailed', failure(T.RPCChat.ConversationErrorType.transient, 'x'))
  reconnect()

  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

// The service answering every request at once, as it does for a conv it can't find: removed, left,
// deleted, or one it fails to unbox the same way each time.
const serviceFailsEveryRequest = (typ: T.RPCChat.ConversationErrorType) =>
  fake.answer(requestInboxUnbox, () => {
    setImmediate(() => {
      void fake.push('chat.1.chatUi.chatInboxFailed', failure(typ, 'conversation not found'))
    })
  })

test.each([
  ['transient', T.RPCChat.ConversationErrorType.transient],
  ['permanent', T.RPCChat.ConversationErrorType.permanent],
])('an open conversation the service answers with a %s failure is asked for once', async (_, typ) => {
  serviceFailsEveryRequest(typ)
  renderHook(() => useConversationMetadataReload(convID))
  await flush(40)

  expect(unboxRequests()).toEqual([{convIDs: [convID], force: false}])
})

test('an open conversation that failed is asked for again when a notification says it changed', async () => {
  serviceFailsEveryRequest(T.RPCChat.ConversationErrorType.transient)
  renderHook(() => useConversationMetadataReload(convID))
  await flush(10)

  await fake.push('chat.1.NotifyChat.ChatSetConvSettings', {convID: T.Chat.keyToConversationID(convID), uid: ''})
  await flush(10)
  expect(unboxRequests()).toHaveLength(2)
})

test('the header and the conversation asking for a trusted adhoc conv missing participants send one call', async () => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, trustedState: 'trusted'}])
  renderHook(() => {
    useRequestIncompleteConversationMeta(convID)
    useConversationMetadataReload(convID)
  })
  await flush()

  expect(unboxRequests()).toEqual([{convIDs: [convID], force: true}])
})

test('a logout lets the next request go', async () => {
  unboxRows([convID])
  await tick()
  startNewAccountGeneration()

  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

test("another account's answer neither fills the store nor ends the signed-in account's request", async () => {
  untrusted()
  unboxRows([convID])
  await tick()

  await serviceAnswers('chat.1.chatUi.chatInboxConversation', {convs: JSON.stringify([unboxed()]), uid: 'uid-2'})
  await serviceAnswers('chat.1.chatUi.chatInboxFailed', {
    ...failure(T.RPCChat.ConversationErrorType.permanent, 'x'),
    uid: 'uid-2',
  })
  expect(getInboxConversationMeta(convID)?.trustedState).toBe('untrusted')
  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(1)

  await serviceAnswers('chat.1.chatUi.chatInboxConversation', {convs: JSON.stringify([unboxed()]), uid: 'uid'})
  expect(getInboxConversationMeta(convID)?.trustedState).toBe('trusted')
})

test('a request the service refuses lets the next one go', async () => {
  fake.answer(requestInboxUnbox, () => fakeError(1, 'aborted'))
  unboxRows([convID])
  await tick()
  await tick()

  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

test('a store reset lets the next request go', async () => {
  unboxRows([convID])
  await tick()
  resetAllStores()
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})

  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

test('a reconnect lets the next request go', async () => {
  unboxRows([convID])
  await tick()
  reconnect()

  unboxRows([convID])
  await tick()
  expect(unboxRequests()).toHaveLength(2)
})

test('a trusted adhoc conv with no participants is asked for with force', async () => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, trustedState: 'trusted'}])
  requestIncompleteConversationMeta(convID)
  await tick()

  expect(unboxRequests()).toEqual([{convIDs: [convID], force: true}])
})

test('the header asks once the session is ready, and again after a reconnect', async () => {
  useConfigState.setState({userSwitching: true})
  renderHook(() => useRequestIncompleteConversationMeta(convID))
  await flush()
  expect(unboxRequests()).toHaveLength(0)

  act(() => useConfigState.setState({userSwitching: false}))
  await flush()
  expect(unboxRequests()).toHaveLength(1)

  // the answer to that request was lost with the link
  act(() => reconnect())
  await flush()
  act(() => useDaemonState.setState({handshakeState: 'done'}))
  await flush()
  expect(unboxRequests()).toHaveLength(2)
})
