/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {_onEngineIncoming} from '@/constants/init/shared'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
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
const activityLoads = () => fake.calls.filter(c => c.method === lastActive)

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

  test('refreshes only activity when the page is shown again', async () => {
    useConfigState.setState({loggedIn: true})
    const {wrapper} = navigationWrapper({params: {teamID, username}, route: 'teamMember'})
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username), {wrapper})
    await flush()
    expect(loads()).toHaveLength(1)
    expect(activityLoads()).toHaveLength(2)

    act(() => {
      C.Router2.navigateAppend({name: 'chatNewChat', params: {namespace: 'chat', title: 'New chat'}})
    })
    await flush()
    fake.answer(lastActive, (p: {teamIDs: Array<string>}) => ({[p.teamIDs[0] ?? '']: 3000}))
    act(() => C.Router2.clearModals())
    await flush()

    expect(loads()).toHaveLength(1)
    expect(activityLoads().map(c => (c.params as {teamIDs: Array<string>}).teamIDs)).toEqual([
      [teamID],
      ['sub1'],
      [teamID],
      ['sub1'],
    ])
    expect(result.current.nodesIn.map(n => n.lastActivity)).toEqual([3000, 3000])
  })

  describe('team changes', () => {
    beforeEach(() => {
      jest.useFakeTimers({doNotFake: ['setImmediate']})
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    const advance = async (ms: number) => {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
      })
      await flush()
    }
    const change = async (changedTeamID: string, kinds: Partial<T.RPCGen.TeamChangedKinds>) => {
      await pushTeamChanged(fake, changedTeamID, kinds)
      await advance(0)
    }
    const mountNow = async () => {
      const hook = renderHook(() => useTeamTreeMemberships(teamID, username))
      await advance(0)
      return hook
    }

    test('reloads for a change to any team in the tree, and not for other teams', async () => {
      await mountNow()
      expect(loads()).toHaveLength(1)

      await change('elsewhere', {membership: true})
      await advance(10_000)
      expect(loads()).toHaveLength(1)

      // the first change in a window reloads at once
      await change('sub2', {membership: true})
      expect(loads()).toHaveLength(2)

      await advance(10_000)
      await change(teamID, {renamed: true})
      expect(loads()).toHaveLength(3)

      // a subteam made under a team of the tree comes as that team's settings
      await advance(10_000)
      await change('sub1', {settings: true})
      expect(loads()).toHaveLength(4)
    })

    test('ignores kinds the rows do not show', async () => {
      await mountNow()

      await change('sub1', {channels: true, keyRotated: true, memberShowcase: true})
      await advance(10_000)
      expect(loads()).toHaveLength(1)
    })

    test("the member counts a tree load caches for each team do not reload it", async () => {
      await mountNow()
      for (const id of [teamID, 'sub1', 'sub2']) {
        await change(id, {memberCount: true})
      }
      await advance(10_000)
      expect(loads()).toHaveLength(1)
    })

    test('a trickle of changes costs at most one reload per window', async () => {
      await mountNow()

      // the first reloads at once; the rest of the window costs one more, at its end
      await change('sub1', {membership: true})
      expect(loads()).toHaveLength(2)
      await advance(3500)
      await change('sub2', {membership: true})
      await advance(3500)
      await change('sub1', {roles: true})
      expect(loads()).toHaveLength(2)
      await advance(3500)
      expect(loads()).toHaveLength(3)
    })

    test('a burst of changes during a load costs one more load', async () => {
      await mountNow()
      const held = fake.hold(loadTree)

      await change('sub1', {membership: true})
      await advance(10_000)
      expect(loads()).toHaveLength(2)
      await change('sub2', {membership: true})
      await advance(10_000)
      await change(teamID, {membership: true})
      await advance(10_000)
      expect(loads()).toHaveLength(2)

      held[0]?.reply(tree)
      await advance(0)
      expect(loads()).toHaveLength(3)
      held[1]?.reply(tree)
      await advance(10_000)
      expect(loads()).toHaveLength(3)
    })

    test('a reload that fails shows its error in place of the old rows, and is in flight until it settles', async () => {
      const {result} = await mountNow()
      expect(result.current.errors.map(e => e.teamName)).toEqual(['p.c'])

      const held = fake.hold(loadTree)
      act(() => result.current.reload())
      // the engine throttles waiting increments
      await advance(500)
      expect(result.current.loading).toBe(true)
      expect(result.current.nodesIn).toHaveLength(2)

      held[0]?.reply(fakeError(2623, 'not an admin'))
      await advance(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.loadError).toBe('not an admin')
      expect(result.current.nodesIn).toEqual([])
      expect(result.current.nodesNotIn).toEqual([])
      expect(result.current.errors).toEqual([])

      fake.answer(loadTree, () => tree)
      act(() => result.current.reload())
      await advance(0)
      expect(result.current.loadError).toBeUndefined()
      expect(result.current.nodesIn).toHaveLength(2)
    })

    test('the target team going away clears the rows at once and shows why', async () => {
      const {result} = await mountNow()
      expect(result.current.nodesIn).toHaveLength(2)

      const held = fake.hold(loadTree)
      await change(teamID, {deleted: true})
      expect(loads()).toHaveLength(2)
      expect(result.current.nodesIn).toEqual([])
      expect(result.current.nodesNotIn).toEqual([])
      expect(result.current.errors).toEqual([])
      await advance(500)
      expect(result.current.loading).toBe(true)

      held[0]?.reply(fakeError(2614, 'team not found'))
      await advance(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.loadError).toBe('team not found')
      expect(result.current.nodesIn).toEqual([])
    })
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
