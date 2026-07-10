/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {
  ensureConversationMetaLoaded,
  forceUnboxRowsForService,
  getInboxConversationMeta,
  metasReceived,
  participantInfoReceived,
} from './metadata'

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
  jest.useRealTimers()
})

test('forceUnboxRowsForService reruns once for requests made while an unbox is in flight', async () => {
  const resolvers = new Array<() => void>()
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockImplementation(
    async () =>
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

  expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(2)

  resolvers[1]?.()
  await flushPromises()
})

const makeMeta = (over: Partial<T.Chat.ConversationMeta>): T.Chat.ConversationMeta => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey: convID,
  ...over,
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

// ensureConversationMetaLoaded: self-heal for the blank thread header

const participants = {
  all: ['testuser', 'testuser-mac'],
  contactName: new Map<string, string>(),
  name: ['testuser', 'testuser-mac'],
}

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

test('ensure retries with backoff until the response carries the conv, then stops', async () => {
  jest.useFakeTimers()
  // service returns nothing at first (conv not available yet)
  const rpc = mockFetch()

  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(0)
  expect(rpc).toHaveBeenCalledTimes(1)

  await jest.advanceTimersByTimeAsync(2000)
  expect(rpc).toHaveBeenCalledTimes(2)

  // now the response carries the unboxed conv: the loop writes it and stops
  rpc.mockResolvedValue({conversations: [makeInboxUIItem()], offline: false})
  await jest.advanceTimersByTimeAsync(4000)
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(getInboxConversationMeta(convID)?.trustedState).toBe('trusted')

  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).toHaveBeenCalledTimes(3)

  // complete data: re-arming is a no-op
  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).toHaveBeenCalledTimes(3)
})

test('ensure stops once participants arrive via the notification path', async () => {
  jest.useFakeTimers()
  const rpc = mockFetch()

  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(0)
  expect(rpc).toHaveBeenCalledTimes(1)

  // trusted meta lands but it's an adhoc conv with no participants yet: still not renderable
  metasReceived([makeMeta({trustedState: 'trusted'})])
  await jest.advanceTimersByTimeAsync(2000)
  expect(rpc).toHaveBeenCalledTimes(2)

  // participants arrive (ChatParticipantsInfo path): loop must stop
  participantInfoReceived(convID, participants)
  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).toHaveBeenCalledTimes(2)
})

test('ensure treats a conv with a teamname as renderable without participants', async () => {
  jest.useFakeTimers()
  const rpc = mockFetch()
  metasReceived([makeMeta({teamname: 'keybase', trustedState: 'trusted'})])

  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).not.toHaveBeenCalled()
})

test('ensure gives up after the backoff schedule, and a later mount starts over', async () => {
  jest.useFakeTimers()
  const rpc = mockFetch()

  ensureConversationMetaLoaded(convID)
  // schedule is 2s/4s/8s/16s/32s: 6 total attempts, then nothing
  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).toHaveBeenCalledTimes(6)

  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).toHaveBeenCalledTimes(6)

  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(0)
  expect(rpc).toHaveBeenCalledTimes(7)
})

test('a hung fetch times out instead of wedging the loop', async () => {
  jest.useFakeTimers()
  const rpc = jest
    .spyOn(T.RPCChat, 'localGetInboxAndUnboxUILocalRpcPromise')
    .mockImplementation(async () => new Promise<never>(() => {}))

  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(0)
  expect(rpc).toHaveBeenCalledTimes(1)

  // the 10s timeout race frees the loop, then the 2s backoff fires the retry
  await jest.advanceTimersByTimeAsync(9000)
  expect(rpc).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(4000)
  expect(rpc).toHaveBeenCalledTimes(2)
})

test('ensure does not run while logged out and can re-arm after login', async () => {
  jest.useFakeTimers()
  const rpc = mockFetch()
  useConfigState.setState({loggedIn: false})

  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(120000)
  expect(rpc).not.toHaveBeenCalled()

  // the data hook re-arms on login
  useConfigState.setState({loggedIn: true})
  ensureConversationMetaLoaded(convID)
  await jest.advanceTimersByTimeAsync(0)
  expect(rpc).toHaveBeenCalledTimes(1)
})
