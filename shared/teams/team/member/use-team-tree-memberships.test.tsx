/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, beforeEach, describe, expect, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {_onEngineIncoming} from '@/constants/init/shared'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {pushTeamChanged} from '@/test/team-changed'
import {useTeamTreeMemberships} from './use-team-tree-memberships'

const teamID = 'tid1' as T.Teams.TeamID
const username = 'testuser-mac'
const loadTree = 'keybase.1.teams.loadTeamTreeMemberships'
const lastActive = 'chat.1.local.getLastActiveAtMultiLocal'

let fake: FakeEngine

const ok = (
  teamName: string,
  subTeamID: string,
  role: T.RPCGen.TeamRole,
  extra?: {joinTime?: number; memberCount?: number}
): T.RPCGen.TeamTreeMembership => ({
  result: {
    ok: {joinTime: extra?.joinTime ?? null, memberCount: extra?.memberCount ?? null, role, teamID: subTeamID},
    s: T.RPCGen.TeamTreeMembershipStatus.ok,
  },
  teamName,
})
const failed = (teamName: string): T.RPCGen.TeamTreeMembership => ({
  result: {
    error: {message: 'boom', willSkipAncestors: false, willSkipSubtree: true},
    s: T.RPCGen.TeamTreeMembershipStatus.error,
  },
  teamName,
})

const tree = [
  ok('p', teamID, T.RPCGen.TeamRole.admin, {joinTime: 10, memberCount: 4}),
  ok('p.a', 'sub1', T.RPCGen.TeamRole.writer, {joinTime: 55, memberCount: 2}),
  ok('p.b', 'sub2', T.RPCGen.TeamRole.none, {memberCount: 7}),
  failed('p.c'),
]

const loads = () => fake.calls.filter(c => c.method === loadTree)

beforeEach(() => {
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  fake.answer(loadTree, () => tree)
  fake.answer(lastActive, (p: {teamIDs: Array<string>}) => ({[p.teamIDs[0] ?? '']: 1000}))
  useCurrentUserState.setState({username: 'testuser'})
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const mount = async () => {
  const hook = renderHook(() => useTeamTreeMemberships(teamID, username))
  await flush()
  return hook
}

describe('useTeamTreeMemberships', () => {
  test('loads the tree in one call and splits it into rows and errors', async () => {
    const {result} = await mount()

    expect(loads().map(c => c.params)).toEqual([expect.objectContaining({teamID, username})])
    expect(result.current.loading).toBe(false)
    expect(result.current.nodesIn).toEqual([
      {joinTime: 10, lastActivity: 1000, memberCount: 4, role: 'admin', teamID, teamname: 'p'},
      {joinTime: 55, lastActivity: 1000, memberCount: 2, role: 'writer', teamID: 'sub1', teamname: 'p.a'},
    ])
    expect(result.current.nodesNotIn).toEqual([
      {joinTime: undefined, memberCount: 7, teamID: 'sub2', teamname: 'p.b'},
    ])
    expect(result.current.errors.map(e => e.teamName)).toEqual(['p.c'])
  })

  test('is loading until the tree arrives', async () => {
    const held = fake.hold(loadTree)
    const {result} = await mount()
    expect(result.current.loading).toBe(true)
    expect(result.current.nodesIn).toEqual([])

    held[0]?.reply(tree)
    await flush()
    expect(result.current.loading).toBe(false)
    expect(result.current.nodesIn).toHaveLength(2)
  })

  test('asks for activity once per team the user is in, and one failure costs only that row', async () => {
    fake.answer(lastActive, (p: {teamIDs: Array<string>}) =>
      p.teamIDs[0] === 'sub1' ? fakeError(1, 'no activity') : {[p.teamIDs[0] ?? '']: 1000}
    )
    const {result} = await mount()

    const activityCalls = fake.calls.filter(c => c.method === lastActive).map(c => c.params)
    expect(activityCalls).toEqual([
      expect.objectContaining({teamIDs: [teamID], username}),
      expect.objectContaining({teamIDs: ['sub1'], username}),
    ])
    expect(result.current.nodesIn.map(n => n.lastActivity)).toEqual([1000, undefined])
  })

  test('a failed load ends loading with no rows', async () => {
    fake.answer(loadTree, () => fakeError(2623, 'not an admin'))
    const {result} = await mount()
    expect(result.current.loading).toBe(false)
    expect(result.current.nodesIn).toEqual([])
    expect(result.current.errors).toEqual([])
  })

  test('reloads for a change to any team in the tree, and not for other teams', async () => {
    await mount()
    expect(loads()).toHaveLength(1)

    await pushTeamChanged(fake, 'elsewhere', {membership: true})
    expect(loads()).toHaveLength(1)

    await pushTeamChanged(fake, 'sub2', {membership: true})
    expect(loads()).toHaveLength(2)

    await pushTeamChanged(fake, teamID, {renamed: true})
    expect(loads()).toHaveLength(3)
  })

  test('ignores kinds the rows do not show, and reloads for a change with no kind', async () => {
    await mount()

    await pushTeamChanged(fake, 'sub1', {channels: true, keyRotated: true, settings: true})
    expect(loads()).toHaveLength(1)

    await pushTeamChanged(fake, 'sub1', {})
    expect(loads()).toHaveLength(2)

    await pushTeamChanged(fake, 'sub1', {memberCount: true})
    expect(loads()).toHaveLength(3)
  })

  test('a burst of changes during a load costs one more load', async () => {
    await mount()
    const held = fake.hold(loadTree)

    await pushTeamChanged(fake, 'sub1', {membership: true})
    await pushTeamChanged(fake, 'sub2', {membership: true})
    await pushTeamChanged(fake, teamID, {membership: true})
    expect(loads()).toHaveLength(2)

    held[0]?.reply(tree)
    await flush()
    expect(loads()).toHaveLength(3)
    held[1]?.reply(tree)
    await flush()
    expect(loads()).toHaveLength(3)
  })

  test('switching the target team drops the old rows and ignores the old answer', async () => {
    const held = fake.hold(loadTree)
    const {rerender, result} = renderHook(
      ({id}: {id: T.Teams.TeamID}) => useTeamTreeMemberships(id, username),
      {initialProps: {id: teamID}}
    )
    await flush()

    rerender({id: 'tid2'})
    await flush()
    expect(loads().map(c => (c.params as {teamID: string}).teamID)).toEqual([teamID, 'tid2'])

    held[0]?.reply(tree)
    await flush()
    expect(result.current.nodesIn).toEqual([])
    expect(result.current.loading).toBe(true)

    held[1]?.reply([ok('q', 'tid2', T.RPCGen.TeamRole.reader)])
    await flush()
    expect(result.current.nodesIn.map(n => n.teamID)).toEqual(['tid2'])
  })

  test('an account switch mid-load drops the old account answer', async () => {
    const held = fake.hold(loadTree)
    const {result} = await mount()

    act(() => useCurrentUserState.setState({username: 'testuser2'}))
    await flush()
    expect(loads()).toHaveLength(2)

    held[0]?.reply(tree)
    await flush()
    expect(result.current.nodesIn).toEqual([])
    expect(result.current.loading).toBe(true)

    held[1]?.reply([ok('q', teamID, T.RPCGen.TeamRole.reader)])
    await flush()
    expect(result.current.nodesIn.map(n => n.teamname)).toEqual(['q'])
  })

  test("activity that lands after an account switch does not replace the new account's", async () => {
    const heldActivity = fake.hold(lastActive)
    const {result} = await mount()
    expect(heldActivity).toHaveLength(2)

    act(() => useCurrentUserState.setState({username: 'testuser2'}))
    await flush()
    expect(heldActivity).toHaveLength(4)

    heldActivity[2]?.reply({[teamID]: 2000})
    heldActivity[3]?.reply({sub1: 2000})
    await flush()
    heldActivity[0]?.reply({[teamID]: 5})
    heldActivity[1]?.reply({sub1: 5})
    await flush()
    expect(result.current.nodesIn.map(n => n.lastActivity)).toEqual([2000, 2000])
  })
})
