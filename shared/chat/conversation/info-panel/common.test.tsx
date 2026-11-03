/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {answerTeamMembers, memberDetails, teamGetMembersByID} from '@/test/team-members'
import {useHumans, useTeamHumans} from './common'

// the humans split is pure derivation on top of the team roles, which load from the service
const {TeamRole} = T.RPCGen
const teamID = 'team-1' as T.Teams.TeamID

const participantInfo = (all: Array<string>, name: Array<string>): T.Chat.ParticipantInfo => ({
  all,
  contactName: new Map(),
  name,
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('team humans exclude bots of either flavor', async () => {
  const fake = installFakeEngine()
  answerTeamMembers(fake, {
    [teamID]: [
      memberDetails('testuser', TeamRole.owner),
      memberDetails('testuser-mac', TeamRole.writer),
      memberDetails('chatbot', TeamRole.bot),
      memberDetails('limitedbot', TeamRole.restrictedbot),
    ],
  })
  const {result} = renderHook(() => useTeamHumans(teamID))
  // nothing to count until the members load
  expect(result.current.teamHumanCount).toBe(0)
  await flush()
  expect(result.current.bots).toEqual(new Set(['chatbot', 'limitedbot']))
  expect(result.current.teamHumanCount).toBe(2)
})

test('a team with no members has no humans', async () => {
  const fake = installFakeEngine()
  answerTeamMembers(fake, {})
  const {result} = renderHook(() => useTeamHumans(teamID))
  await flush()
  expect(fake.calls.map(c => c.method)).toEqual([teamGetMembersByID])
  expect(result.current.bots.size).toBe(0)
  expect(result.current.teamHumanCount).toBe(0)
})

test('channel humans on a team conv come from the participant list minus the team bots', async () => {
  const fake = installFakeEngine()
  answerTeamMembers(fake, {
    [teamID]: [memberDetails('testuser', TeamRole.writer), memberDetails('chatbot', TeamRole.restrictedbot)],
  })
  const meta = {...makeConversationMeta(), teamID, teamType: 'big' as const, teamname: 'acme'}
  const {result} = renderHook(() => useHumans(participantInfo(['testuser', 'chatbot'], []), meta))
  await flush()
  expect(result.current.channelHumans).toEqual(['testuser'])
  expect(result.current.teamHumanCount).toBe(1)
})

test('adhoc convs use the conversation name list and ignore team roles', async () => {
  // an adhoc conv's implicit team still has members the service reports; the name list, not the
  // participant list minus team bots, is who is in it (helperbot is in no team list)
  const fake = installFakeEngine()
  answerTeamMembers(fake, {[teamID]: [memberDetails('chatbot', TeamRole.restrictedbot)]})
  const meta = {...makeConversationMeta(), teamID, teamType: 'adhoc' as const}
  const {result} = renderHook(() =>
    useHumans(participantInfo(['testuser', 'testuser-mac', 'chatbot', 'helperbot'], ['testuser', 'testuser-mac']), meta)
  )
  await flush()
  expect(result.current.channelHumans).toEqual(['testuser', 'testuser-mac'])
})
