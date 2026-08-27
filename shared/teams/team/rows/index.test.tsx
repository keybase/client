/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, jest, test, describe, beforeEach} from '@jest/globals'
import type * as React from 'react'
import {renderHook} from '@testing-library/react'
import type * as T from '@/constants/types'
import {emptyTeamDetails, initialCanUserPerform, makeTeamMeta} from '@/constants/teams'
import {useCurrentUserState} from '@/stores/current-user'
import * as TeamsList from '@/teams/use-teams-list'
import {
  useChannelsSections,
  useInvitesSections,
  useMembersSections,
  useSubteamsSections,
  type Item,
  type Section,
} from './index'

const teamID = 'tid1' as T.Teams.TeamID

const ops = (over?: Partial<T.Teams.TeamOperations>): T.Teams.TeamOperations => ({
  ...initialCanUserPerform,
  ...over,
})

const member = (
  username: string,
  type: T.Teams.TeamRoleType = 'writer',
  status: T.Teams.MemberStatus = 'active'
): T.Teams.MemberInfo => ({fullName: '', needsPUK: false, status, type, username})

const details = (over?: Partial<T.Teams.TeamDetails>): T.Teams.TeamDetails => ({
  ...emptyTeamDetails,
  invites: new Set(),
  members: new Map(),
  requests: new Set(),
  subteams: new Set(),
  ...over,
})

const channel = (channelname: string): T.Teams.TeamChannelInfo =>
  ({
    channelname,
    conversationIDKey: channelname as T.Chat.ConversationIDKey,
    description: '',
  }) as T.Teams.TeamChannelInfo

const types = (sections: Array<Section>) =>
  sections.map(s => (s.data as ReadonlyArray<Item>).map(d => d.type))

const flatTypes = (sections: Array<Section>) => types(sections).flat()

beforeEach(() => {
  useCurrentUserState.setState({username: 'testuser'})
})

describe('useMembersSections', () => {
  test('shows a loading row while the member list is still empty', () => {
    const {result} = renderHook(() =>
      useMembersSections(teamID, false, makeTeamMeta({memberCount: 3}), details(), ops())
    )
    expect(flatTypes(result.current)).toEqual(['members-loading'])
  })

  test('an explicit loading flag wins even when members are present', () => {
    const {result} = renderHook(() =>
      useMembersSections(
        teamID,
        true,
        makeTeamMeta({memberCount: 1}),
        details({members: new Map([['testuser', member('testuser')]])}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['members-loading'])
  })

  test('lists ordered members with the count in the title', () => {
    const members = new Map([
      ['zed', member('zed', 'reader')],
      ['boss', member('boss', 'owner')],
      ['abot', member('abot', 'bot')],
    ])
    const {result} = renderHook(() =>
      useMembersSections(teamID, false, makeTeamMeta({memberCount: 3}), details({members}), ops())
    )
    expect(result.current[0]?.title).toBe('Already in team (3)')
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(
      data.map(d => (d.type === 'member-members' ? d.mi.username : d.type))
    ).toEqual(['boss', 'zed'])
  })

  test('a team of just you still shows the empty-members prompt', () => {
    const members = new Map([['testuser', member('testuser', 'owner')]])
    const {result} = renderHook(() =>
      useMembersSections(
        teamID,
        false,
        makeTeamMeta({memberCount: 1, role: 'owner'}),
        details({members}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['member-members', 'members-none'])
  })

  test('a one-member team you are not in does not show the prompt', () => {
    const members = new Map([['someone', member('someone')]])
    const {result} = renderHook(() =>
      useMembersSections(
        teamID,
        false,
        makeTeamMeta({memberCount: 1, role: 'none'}),
        details({members}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['member-members'])
  })
})

describe('useInvitesSections', () => {
  const noop = () => {}

  test('nothing pending means no sections at all', () => {
    const {result} = renderHook(() =>
      useInvitesSections(teamID, details(), false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    expect(result.current).toEqual([])
  })

  test('join requests and reset members share the requests section', () => {
    const d = details({
      members: new Map([
        ['reset-user', member('reset-user', 'writer', 'reset')],
        ['fine-user', member('fine-user')],
      ]),
      requests: new Set([{ctime: 5, fullName: 'Asker', username: 'asker'}]) as never,
    })
    const {result} = renderHook(() =>
      useInvitesSections(teamID, d, false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(
      data.map(i => (i.type === 'invite-requests' ? [i.username, !!i.reset] : i.type))
    ).toEqual([
      ['asker', false],
      ['reset-user', true],
    ])
  })

  test('invitations are sorted and counted, collapsing empties the data but keeps the header', () => {
    const invites = new Set([
      {email: '', id: 'i2', name: '', phone: '', role: 'writer', username: 'zed'},
      {email: 'aaa@b.com', id: 'i1', name: '', phone: '', role: 'writer', username: ''},
    ]) as unknown as T.Teams.TeamDetails['invites']
    const d = details({invites})

    const open = renderHook(() =>
      useInvitesSections(teamID, d, false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    const section = open.result.current[0]!
    expect(section.title).toBe('Invitations (2)')
    expect(
      (section.data as ReadonlyArray<Item>).map(i => (i.type === 'member-invites' ? i.ii.id : i.type))
    ).toEqual(['i1', 'i2'])

    const closed = renderHook(() =>
      useInvitesSections(teamID, d, true, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    expect(closed.result.current[0]?.collapsed).toBe(true)
    expect(closed.result.current[0]?.data).toEqual([])
    expect(closed.result.current[0]?.title).toBe('Invitations (2)')
  })

  test('requests come before invitations', () => {
    const d = details({
      invites: new Set([
        {email: 'a@b.com', id: 'i1', name: '', phone: '', role: 'writer', username: ''},
      ]) as unknown as T.Teams.TeamDetails['invites'],
      requests: new Set([{ctime: 1, fullName: '', username: 'asker'}]) as never,
    })
    const {result} = renderHook(() =>
      useInvitesSections(teamID, d, false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    expect(types(result.current)).toEqual([['invite-requests'], ['member-invites']])
  })
})

describe('useChannelsSections', () => {
  const many = new Map([
    ['zulu', channel('zulu')],
    ['general', channel('general')],
    ['alpha', channel('alpha')],
  ])

  test('loading with nothing yet shows the loading row', () => {
    const {result} = renderHook(() => useChannelsSections(teamID, ops(), new Map(), true))
    expect(flatTypes(result.current)).toEqual(['channel-loading'])
  })

  test('a team with only #general is treated as small', () => {
    const {result} = renderHook(() =>
      useChannelsSections(teamID, ops(), new Map([['general', channel('general')]]), false)
    )
    expect(flatTypes(result.current)).toEqual(['channel-empty'])
  })

  test('general is pinned first and the rest sort alphabetically', () => {
    const {result} = renderHook(() => useChannelsSections(teamID, ops(), many, false))
    const channelSection = result.current.find(s =>
      (s.data as ReadonlyArray<Item>).some(d => d.type === 'channel-channels')
    )!
    expect(
      (channelSection.data as ReadonlyArray<Item>).map(d =>
        d.type === 'channel-channels' ? d.c.channelname : d.type
      )
    ).toEqual(['general', 'alpha', 'zulu'])
  })

  test('only channel creators get the add row and the make-more-channels nudge', () => {
    const withPerm = renderHook(() =>
      useChannelsSections(teamID, ops({createChannel: true}), many, false)
    )
    expect(flatTypes(withPerm.result.current)).toEqual([
      'channel-add',
      'channel-channels',
      'channel-channels',
      'channel-channels',
      'channel-few',
    ])

    const withoutPerm = renderHook(() => useChannelsSections(teamID, ops(), many, false))
    expect(flatTypes(withoutPerm.result.current)).toEqual([
      'channel-channels',
      'channel-channels',
      'channel-channels',
      'channel-info',
    ])
  })

  test('past five channels the nudge becomes the plain info row', () => {
    const five = new Map(
      ['general', 'a', 'b', 'c', 'd'].map(n => [n, channel(n)] as const)
    )
    const {result} = renderHook(() =>
      useChannelsSections(teamID, ops({createChannel: true}), five, false)
    )
    expect(flatTypes(result.current).at(-1)).toBe('channel-info')
  })

  test('channels that arrived already win over a stale loading flag', () => {
    const {result} = renderHook(() => useChannelsSections(teamID, ops(), many, true))
    expect(flatTypes(result.current)).not.toContain('channel-loading')
  })
})

describe('useSubteamsSections', () => {
  const noop = () => {}
  const teamsMap = new Map([
    ['sub-b', {id: 'sub-b', teamname: 'parent.beta'}],
    ['sub-a', {id: 'sub-a', teamname: 'parent.alpha'}],
  ]) as unknown as Map<T.Teams.TeamID, T.Teams.TeamMeta>

  beforeEach(() => {
    jest.spyOn(TeamsList, 'useTeamsListMap').mockImplementation(() => teamsMap)
  })

  test('with no subteams you get the empty row and no add row', () => {
    const {result} = renderHook(() =>
      useSubteamsSections(
        teamID,
        details(),
        ops({manageSubteams: true}),
        '',
        noop as React.Dispatch<React.SetStateAction<string>>
      )
    )
    expect(flatTypes(result.current)).toEqual(['subteam-none'])
  })

  test('subteams get an add row only when you can manage them', () => {
    const d = details({subteams: new Set(['sub-b', 'sub-a'])})
    const canManage = renderHook(() =>
      useSubteamsSections(
        teamID,
        d,
        ops({manageSubteams: true}),
        '',
        noop as React.Dispatch<React.SetStateAction<string>>
      )
    )
    expect(flatTypes(canManage.result.current)).toEqual([
      'subteam-add',
      'subteams',
      'subteams',
      'subteam-info',
    ])

    const cannot = renderHook(() =>
      useSubteamsSections(teamID, d, ops(), '', noop as React.Dispatch<React.SetStateAction<string>>)
    )
    expect(flatTypes(cannot.result.current)).toEqual(['subteams', 'subteams', 'subteam-info'])
  })

  test('the filter matches on the team name, case insensitively', () => {
    const d = details({subteams: new Set(['sub-b', 'sub-a'])})
    const {result} = renderHook(() =>
      useSubteamsSections(
        teamID,
        d,
        ops(),
        '  ALPHA ',
        noop as React.Dispatch<React.SetStateAction<string>>
      )
    )
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(data.map(i => (i.type === 'subteams' ? i.id : i.type))).toEqual(['sub-a'])
  })

  test('a filter matching nothing still keeps the info row, not the empty state', () => {
    const d = details({subteams: new Set(['sub-b'])})
    const {result} = renderHook(() =>
      useSubteamsSections(teamID, d, ops(), 'zzz', noop as React.Dispatch<React.SetStateAction<string>>)
    )
    expect(flatTypes(result.current)).toEqual(['subteam-info'])
  })
})
