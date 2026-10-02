/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {flush} from '@/test/flush'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const teamID = 'team-1' as T.Teams.TeamID

let mockMembers = new Map<string, T.Teams.MemberInfo>()
let mockMeta: T.Chat.ConversationMeta = makeConversationMeta()
let mockParticipants: T.Chat.ParticipantInfo = {all: [], contactName: new Map(), name: []}

jest.mock('../team-hooks', () => ({
  useChatTeamMembers: () => ({loading: false, members: mockMembers}),
}))
jest.mock('../data-hooks', () => ({
  useConversationMetadata: () => ({meta: mockMeta, participants: mockParticipants}),
}))

import {useChannelMembers} from './members'

const member = (username: string, type: T.Teams.TeamRoleType): [string, T.Teams.MemberInfo] => [
  username,
  {fullName: `${username} fullname`, needsPUK: false, status: 'active', type, username},
]

const teamChannelMeta = (over: Partial<T.Chat.ConversationMeta> = {}): T.Chat.ConversationMeta => ({
  ...makeConversationMeta(),
  channelname: 'random',
  conversationIDKey,
  teamID,
  teamType: 'big',
  teamname: 'acme',
  ...over,
})

const noChanges = {keyRotated: false, membershipChanged: false, misc: false, renamed: false}

const teamChangedByID = (changes = {...noChanges, membershipChanged: true}) =>
  ({
    payload: {
      params: {
        changes,
        implicitTeam: false,
        latestHiddenSeqno: 0,
        latestOffchainSeqno: 0,
        latestSeqno: 1,
        source: 0,
        teamID,
      },
    },
    type: 'keybase.1.NotifyTeam.teamChangedByID',
  }) as never

let rpc: FakeChatRpc

beforeEach(() => {
  rpc = installFakeChatRpc()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreChatRpc()
  resetAllStores()
  mockMembers = new Map()
  mockMeta = makeConversationMeta()
  mockParticipants = {all: [], contactName: new Map(), name: []}
})

test('opening a team channel asks the service for its participants', () => {
  mockMeta = teamChannelMeta()
  renderHook(() => useChannelMembers(conversationIDKey))

  expect(rpc.calls('refreshParticipants')).toEqual([[conversationIDKey]])
})

test('an adhoc conversation has no team participants to refresh', () => {
  mockMeta = {...makeConversationMeta(), conversationIDKey, teamType: 'adhoc'}
  renderHook(() => useChannelMembers(conversationIDKey))

  expect(rpc.calls('refreshParticipants')).toEqual([])
})

test('a membership change in the team refreshes the open list', () => {
  mockMeta = teamChannelMeta()
  renderHook(() => useChannelMembers(conversationIDKey))
  rpc.clearLog()

  act(() => {
    notifyEngineActionListeners(teamChangedByID())
  })

  expect(rpc.calls('refreshParticipants')).toEqual([[conversationIDKey]])
})

// teamChangedByID also fires for every message in the team
test('team activity that did not change membership does not refresh the open list', () => {
  mockMeta = teamChannelMeta()
  renderHook(() => useChannelMembers(conversationIDKey))
  rpc.clearLog()

  act(() => {
    notifyEngineActionListeners(teamChangedByID({...noChanges, misc: true}))
  })

  expect(rpc.calls('refreshParticipants')).toEqual([])
})

test('a re-render of the same channel does not re-ask for participants', () => {
  mockMeta = teamChannelMeta()
  const {rerender} = renderHook(() => useChannelMembers(conversationIDKey))
  rerender()
  rerender()

  expect(rpc.calls('refreshParticipants')).toHaveLength(1)
})

test('the list shows the channel participants, owners and admins first', () => {
  mockMembers = new Map([
    member('testuser', 'writer'),
    member('testuser-mac', 'admin'),
    member('zeta', 'owner'),
  ])
  mockMeta = teamChannelMeta()
  mockParticipants = {all: ['testuser', 'testuser-mac', 'zeta'], contactName: new Map(), name: []}

  const {participantsItems, showSpinner} = renderHook(() =>
    useChannelMembers(conversationIDKey)
  ).result.current

  expect(showSpinner).toBe(false)
  expect(participantsItems.map(i => i.username)).toEqual(['testuser-mac', 'zeta', 'testuser'])
  expect(participantsItems.map(i => i.isOwner)).toEqual([false, true, false])
  expect(participantsItems.map(i => i.isAdmin)).toEqual([true, false, false])
})

test('a member added to the channel appears in the list', () => {
  mockMembers = new Map([member('testuser', 'writer'), member('testuser-mac', 'writer')])
  mockMeta = teamChannelMeta()
  mockParticipants = {all: ['testuser'], contactName: new Map(), name: []}

  const {rerender, result} = renderHook(() => useChannelMembers(conversationIDKey))
  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser'])

  mockParticipants = {all: ['testuser', 'testuser-mac'], contactName: new Map(), name: []}
  rerender()

  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser', 'testuser-mac'])
})

test('bots on the team are not listed as members', () => {
  mockMembers = new Map([
    member('testuser', 'writer'),
    member('chatbot', 'bot'),
    member('limitedbot', 'restrictedbot'),
  ])
  mockMeta = teamChannelMeta()
  mockParticipants = {all: ['testuser', 'chatbot', 'limitedbot'], contactName: new Map(), name: []}

  const {participantsItems} = renderHook(() => useChannelMembers(conversationIDKey)).result.current

  expect(participantsItems.map(i => i.username)).toEqual(['testuser'])
})

test('a channel with no participants yet shows a spinner instead of an empty list', () => {
  mockMeta = teamChannelMeta()

  const {participantsItems, showSpinner} = renderHook(() =>
    useChannelMembers(conversationIDKey)
  ).result.current

  expect(showSpinner).toBe(true)
  expect(participantsItems).toEqual([])
})

test('general lists the whole team rather than the conversation participants', () => {
  mockMembers = new Map([member('testuser', 'writer'), member('testuser-mac', 'writer')])
  mockMeta = teamChannelMeta({channelname: 'general'})
  mockParticipants = {all: ['testuser'], contactName: new Map(), name: []}

  const {participantsItems} = renderHook(() => useChannelMembers(conversationIDKey)).result.current

  expect(participantsItems.map(i => i.username)).toEqual(['testuser', 'testuser-mac'])
})

test('a failed participant refresh on open is swallowed: nothing logged, the list still renders', async () => {
  rpc.fail('refreshParticipants', new Error('offline'))
  const logInfo = jest.spyOn(logger, 'info')
  const logError = jest.spyOn(logger, 'error')
  mockMembers = new Map([member('testuser', 'writer')])
  mockMeta = teamChannelMeta()
  mockParticipants = {all: ['testuser'], contactName: new Map(), name: []}

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  expect(rpc.calls('refreshParticipants')).toEqual([[conversationIDKey]])
  expect(logInfo).not.toHaveBeenCalled()
  expect(logError).not.toHaveBeenCalled()
  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser'])
})

test('a failed refresh after a membership change is logged at info and not surfaced', async () => {
  mockMeta = teamChannelMeta()
  renderHook(() => useChannelMembers(conversationIDKey))
  rpc.clearLog()
  rpc.fail('refreshParticipants', new Error('offline'))
  const logInfo = jest.spyOn(logger, 'info').mockImplementation(() => {})

  act(() => {
    notifyEngineActionListeners(teamChangedByID())
  })
  await flush()

  expect(rpc.calls('refreshParticipants')).toEqual([[conversationIDKey]])
  expect(logInfo).toHaveBeenCalledWith(`refreshConversationParticipants: failed for ${conversationIDKey}`)
})
