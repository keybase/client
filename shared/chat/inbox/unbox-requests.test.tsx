/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {routeChatNotification} from '@/chat/notification-router'
import {useRequestIncompleteConversationMeta} from '@/chat/conversation/data-hooks'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
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
  fake = installFakeEngine({onEngineIncoming: action => routeChatNotification(action as never)})
  fake.answer(requestInboxUnbox, () => {})
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})
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

// the service joins a request for a conv it is already unboxing; a forced one gets one more pass
test('every request reaches the service, which does the dedup', async () => {
  unboxRows([convID])
  unboxRows([convID])
  forceUnboxRowsForService([convID])
  await tick()

  expect(unboxRequests()).toEqual([
    {convIDs: [convID], force: false},
    {convIDs: [convID], force: false},
    {convIDs: [convID], force: true},
  ])
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
  act(() => useDaemonState.setState({handshakeState: 'loading'}))
  await flush()
  act(() => useDaemonState.setState({handshakeState: 'done'}))
  await flush()
  expect(unboxRequests()).toHaveLength(2)
})
