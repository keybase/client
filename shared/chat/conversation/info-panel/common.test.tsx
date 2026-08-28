/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as T from '@/constants/types'
import {cleanup, renderHook} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'

// the humans split is pure derivation on top of the team roles
let mockMembers = new Map<string, T.Teams.MemberInfo>()
jest.mock('../team-hooks', () => ({
  useChatTeamMembers: () => ({loading: false, members: mockMembers}),
}))

import {useHumans, useTeamHumans} from './common'

const member = (username: string, type: T.Teams.TeamRoleType): [string, T.Teams.MemberInfo] => [
  username,
  {fullName: '', needsPUK: false, status: 'active', type, username},
]

const teamID = 'team-1' as T.Teams.TeamID

const participantInfo = (all: Array<string>, name: Array<string>): T.Chat.ParticipantInfo => ({
  all,
  contactName: new Map(),
  name,
})

afterEach(() => {
  cleanup()
  mockMembers = new Map()
})

test('team humans exclude bots of either flavor', () => {
  mockMembers = new Map([
    member('testuser', 'owner'),
    member('testuser-mac', 'writer'),
    member('chatbot', 'bot'),
    member('limitedbot', 'restrictedbot'),
  ])
  const {bots, teamHumanCount} = renderHook(() => useTeamHumans(teamID)).result.current
  expect(bots).toEqual(new Set(['chatbot', 'limitedbot']))
  expect(teamHumanCount).toBe(2)
})

test('a team with no members has no humans', () => {
  const {bots, teamHumanCount} = renderHook(() => useTeamHumans(teamID)).result.current
  expect(bots.size).toBe(0)
  expect(teamHumanCount).toBe(0)
})

test('channel humans on a team conv come from the participant list minus the team bots', () => {
  mockMembers = new Map([member('testuser', 'writer'), member('chatbot', 'restrictedbot')])
  const meta = {...makeConversationMeta(), teamID, teamType: 'big' as const, teamname: 'acme'}
  const {channelHumans, teamHumanCount} = renderHook(() =>
    useHumans(participantInfo(['testuser', 'chatbot'], []), meta)
  ).result.current
  expect(channelHumans).toEqual(['testuser'])
  expect(teamHumanCount).toBe(1)
})

test('adhoc convs use the conversation name list and ignore team roles', () => {
  mockMembers = new Map([member('chatbot', 'restrictedbot')])
  const meta = {...makeConversationMeta(), teamType: 'adhoc' as const}
  const {channelHumans} = renderHook(() =>
    useHumans(participantInfo(['testuser', 'testuser-mac', 'chatbot'], ['testuser', 'testuser-mac']), meta)
  ).result.current
  expect(channelHumans).toEqual(['testuser', 'testuser-mac'])
})
