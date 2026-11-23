/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {
  forceUnboxRowsForService,
  loadConversationMeta,
  getInboxConversationMeta,
  metasReceived,
  participantInfoReceived,
  syncInboxParticipantsFromParticipantMap,
  unboxRows,
  useInboxMetadataState,
} from './metadata'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
  jest.useRealTimers()
})

const makeMeta = (over: Partial<T.Chat.ConversationMeta>): T.Chat.ConversationMeta => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey: convID,
  ...over,
})

// Why every membership change has to ask for a participant refresh: the conversation
// you are looking at is already trusted, so the ordinary reload is dropped here and
// no fresh participants ever come back. See chat/inbox/refresh-participants.
test('an ordinary reload of a trusted conversation never reaches the service', async () => {
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  metasReceived([makeMeta({inboxVersion: 1, trustedState: 'trusted'})])

  unboxRows([convID])
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).not.toHaveBeenCalled()

  forceUnboxRowsForService([convID])
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(1)
})

test('an ordinary reload of an untrusted conversation does reach the service', async () => {
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  metasReceived([makeMeta({inboxVersion: 1, trustedState: 'untrusted'})])

  unboxRows([convID])
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(1)
})

const uiParticipant = (assertion: string): T.RPCChat.UIParticipant => ({
  assertion,
  inConvName: false,
  type: T.RPCChat.UIParticipantType.user,
})

test('a participants notification replaces the stored participants for that conversation', () => {
  participantInfoReceived(convID, {all: ['testuser'], contactName: new Map(), name: []})

  syncInboxParticipantsFromParticipantMap({
    [T.Chat.conversationIDKeyToString(convID)]: [uiParticipant('testuser'), uiParticipant('testuser-mac')],
  })

  expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual([
    'testuser',
    'testuser-mac',
  ])
})

test('a participants notification for another conversation leaves this one alone', () => {
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 9, 9, 9]))
  participantInfoReceived(convID, {all: ['testuser'], contactName: new Map(), name: []})

  syncInboxParticipantsFromParticipantMap({
    [T.Chat.conversationIDKeyToString(otherConvID)]: [uiParticipant('someone-else')],
  })

  expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual(['testuser'])
})

// an empty list is what the service sends before it has computed anything, so it must
// not wipe a list that is already on screen
test('an empty participants notification does not clear what is already known', () => {
  participantInfoReceived(convID, {all: ['testuser'], contactName: new Map(), name: []})

  syncInboxParticipantsFromParticipantMap({[T.Chat.conversationIDKeyToString(convID)]: []})

  expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual(['testuser'])
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

const makeInboxUIItem = (): T.RPCChat.InboxUIItem =>
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

const mockFetch = () =>
  jest.spyOn(T.RPCChat, 'localGetInboxAndUnboxUILocalRpcPromise').mockResolvedValue({offline: false})

test('loading the meta waits on its fetch, and leaves no timer once it lands', async () => {
  jest.useFakeTimers()
  const rpc = jest
    .spyOn(T.RPCChat, 'localGetInboxAndUnboxUILocalRpcPromise')
    .mockResolvedValue({conversations: [makeInboxUIItem()], offline: false})

  const meta = await loadConversationMeta(convID)

  expect(rpc).toHaveBeenCalledTimes(1)
  expect(meta?.trustedState).toBe('trusted')
  expect(jest.getTimerCount()).toBe(0)
})

test('loading the meta of a conversation the store already trusts asks nothing', async () => {
  const rpc = mockFetch()
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, trustedState: 'trusted'}])

  expect((await loadConversationMeta(convID))?.conversationIDKey).toBe(convID)
  expect(rpc).not.toHaveBeenCalled()
})

test('userSwitching skips inbox unbox', async () => {
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  useConfigState.setState({loggedIn: true, userSwitching: true})

  unboxRows([convID])
  await flushPromises()

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).not.toHaveBeenCalled()
})

test('setUserSwitching abandons further unbox until switch completes', async () => {
  const resolvers = new Array<() => void>()
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockImplementation(
    async () =>
      new Promise(resolve => {
        resolvers.push(() => {
          resolve(undefined)
        })
      })
  )

  unboxRows([convID])
  await flushPromises()
  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(1)

  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  resolvers[0]?.()
  await flushPromises()

  unboxRows([convID])
  await flushPromises()
  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(1)
})
