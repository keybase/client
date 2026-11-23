/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {metasReceived, participantInfoReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {flush} from '@/test/flush'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {useChannelMembers} from './members'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const teamID = 'team-1' as T.Teams.TeamID
const refreshParticipants = 'chat.1.local.refreshParticipants'
const getTeamMembers = 'keybase.1.teams.teamGetMembersByID'

const member = (username: string, role: T.RPCGen.TeamRole): T.RPCGen.TeamMemberDetails => ({
  fullName: `${username} fullname`,
  needsPUK: false,
  role,
  status: T.RPCGen.TeamMemberStatus.active,
  username,
  uv: {eldestSeqno: 1, uid: `${username}-uid`},
})

const teamChannelMeta = (over: Partial<T.Chat.ConversationMeta> = {}): T.Chat.ConversationMeta => ({
  ...makeConversationMeta(),
  channelname: 'random',
  conversationIDKey,
  teamID,
  teamType: 'big',
  teamname: 'acme',
  trustedState: 'trusted',
  ...over,
})

const setConversation = (meta: T.Chat.ConversationMeta, all?: Array<string>) => {
  metasReceived([meta])
  if (all) {
    participantInfoReceived(conversationIDKey, {all, contactName: new Map(), name: []})
  }
}

// The team's members, as the service answers the hook's teamGetMembersByID
const answerMembers = (members: Array<T.RPCGen.TeamMemberDetails> = []) =>
  fake.answer(getTeamMembers, () => members)

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

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const refreshes = () => paramsOf(fake, refreshParticipants)

test('opening a team channel asks the service for its participants', async () => {
  setConversation(teamChannelMeta())
  answerMembers()
  fake.answer(refreshParticipants, () => null)
  renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  expect(refreshes()).toEqual([{convID}])
})

test('an adhoc conversation has no team participants to refresh', async () => {
  setConversation({...makeConversationMeta(), conversationIDKey, teamType: 'adhoc', trustedState: 'trusted'})
  renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  expect(fake.calls).toEqual([])
})

test('a membership change in the team refreshes the open list', async () => {
  setConversation(teamChannelMeta())
  answerMembers()
  fake.answer(refreshParticipants, () => null)
  renderHook(() => useChannelMembers(conversationIDKey))
  await flush()
  expect(refreshes()).toHaveLength(1)

  act(() => {
    notifyEngineActionListeners(teamChangedByID())
  })
  await flush()

  expect(refreshes()).toEqual([{convID}, {convID}])
})

// teamChangedByID also fires for every message in the team
test('team activity that did not change membership does not refresh the open list', async () => {
  setConversation(teamChannelMeta())
  answerMembers()
  fake.answer(refreshParticipants, () => null)
  renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  act(() => {
    notifyEngineActionListeners(teamChangedByID({...noChanges, misc: true}))
  })
  await flush()

  expect(refreshes()).toHaveLength(1)
})

test('a re-render of the same channel does not re-ask for participants', async () => {
  setConversation(teamChannelMeta())
  answerMembers()
  fake.answer(refreshParticipants, () => null)
  const {rerender} = renderHook(() => useChannelMembers(conversationIDKey))
  rerender()
  rerender()
  await flush()

  expect(refreshes()).toHaveLength(1)
})

test('the list shows the channel participants, owners and admins first', async () => {
  answerMembers([
    member('testuser', T.RPCGen.TeamRole.writer),
    member('testuser-mac', T.RPCGen.TeamRole.admin),
    member('zeta', T.RPCGen.TeamRole.owner),
  ])
  fake.answer(refreshParticipants, () => null)
  setConversation(teamChannelMeta(), ['testuser', 'testuser-mac', 'zeta'])

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  const {participantsItems, showSpinner} = result.current
  expect(showSpinner).toBe(false)
  expect(participantsItems.map(i => i.username)).toEqual(['testuser-mac', 'zeta', 'testuser'])
  expect(participantsItems.map(i => i.isOwner)).toEqual([false, true, false])
  expect(participantsItems.map(i => i.isAdmin)).toEqual([true, false, false])
})

test('a member added to the channel appears in the list', async () => {
  answerMembers([member('testuser', T.RPCGen.TeamRole.writer), member('testuser-mac', T.RPCGen.TeamRole.writer)])
  fake.answer(refreshParticipants, () => null)
  setConversation(teamChannelMeta(), ['testuser'])

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()
  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser'])

  act(() => {
    participantInfoReceived(conversationIDKey, {all: ['testuser', 'testuser-mac'], contactName: new Map(), name: []})
  })

  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser', 'testuser-mac'])
})

test('bots on the team are not listed as members once the team members load', async () => {
  const held = fake.hold(getTeamMembers)
  fake.answer(refreshParticipants, () => null)
  setConversation(teamChannelMeta(), ['testuser', 'chatbot', 'limitedbot'])

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()
  held[0]!.reply([
    member('testuser', T.RPCGen.TeamRole.writer),
    member('chatbot', T.RPCGen.TeamRole.bot),
    member('limitedbot', T.RPCGen.TeamRole.restrictedbot),
  ])
  await flush()

  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser'])
})

test('a channel with no participants yet shows a spinner instead of an empty list', async () => {
  answerMembers()
  fake.answer(refreshParticipants, () => null)
  setConversation(teamChannelMeta())

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  expect(result.current.showSpinner).toBe(true)
  expect(result.current.participantsItems).toEqual([])
})

test('general lists the whole team rather than the conversation participants, auditing while they load', async () => {
  const held = fake.hold(getTeamMembers)
  fake.answer(refreshParticipants, () => null)
  setConversation(teamChannelMeta({channelname: 'general'}), ['testuser'])

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()
  expect(result.current.showAuditingBanner).toBe(true)

  held[0]!.reply([member('testuser', T.RPCGen.TeamRole.writer), member('testuser-mac', T.RPCGen.TeamRole.writer)])
  await flush()

  expect(result.current.showAuditingBanner).toBe(false)
  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser', 'testuser-mac'])
})

test('a failed participant refresh on open is swallowed: nothing logged, the list still renders', async () => {
  fake.answer(refreshParticipants, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
  answerMembers([member('testuser', T.RPCGen.TeamRole.writer)])
  const logInfo = jest.spyOn(logger, 'info')
  const logError = jest.spyOn(logger, 'error')
  setConversation(teamChannelMeta(), ['testuser'])

  const {result} = renderHook(() => useChannelMembers(conversationIDKey))
  await flush()

  expect(refreshes()).toEqual([{convID}])
  expect(logInfo).not.toHaveBeenCalled()
  expect(logError).not.toHaveBeenCalled()
  expect(result.current.participantsItems.map(i => i.username)).toEqual(['testuser'])
})

test('a failed refresh after a membership change is logged at info and not surfaced', async () => {
  setConversation(teamChannelMeta())
  answerMembers()
  fake.answer(refreshParticipants, () => null)
  renderHook(() => useChannelMembers(conversationIDKey))
  await flush()
  fake.answer(refreshParticipants, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
  const logInfo = jest.spyOn(logger, 'info').mockImplementation(() => {})

  act(() => {
    notifyEngineActionListeners(teamChangedByID())
  })
  await flush()

  expect(refreshes()).toEqual([{convID}, {convID}])
  expect(logInfo).toHaveBeenCalledWith(`refreshConversationParticipants: failed for ${conversationIDKey}`)
})
