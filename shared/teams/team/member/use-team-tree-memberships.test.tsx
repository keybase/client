/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, jest, test, describe, beforeEach, afterEach} from '@jest/globals'
import {act, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useTeamTreeMemberships} from './use-team-tree-memberships'

const teamID = 'tid1' as T.Teams.TeamID
const username = 'testuser'

let loadCalls: Array<{teamID: string; username: string}> = []
jest
  .spyOn(T.RPCGen, 'teamsLoadTeamTreeMembershipsAsyncRpcPromise')
  .mockImplementation(async (params: unknown) => {
    loadCalls.push(params as {teamID: string; username: string})
    await Promise.resolve()
    return undefined as never
  })
jest.spyOn(T.RPCChat, 'localGetLastActiveAtMultiLocalRpcPromise').mockImplementation(async () => {
  await Promise.resolve()
  return {} as never
})

// state updates land through engine notifications and a follow-up activity rpc;
// let both settle inside act so react does not warn about updates outside it
const emit = async (fn: () => void) => {
  await act(async () => {
    fn()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const done = (p: {expectedCount: number; guid: number; targetTeamID?: string; targetUsername?: string}) => {
  notifyEngineActionListeners({
    payload: {
      params: {
        result: {
          expectedCount: p.expectedCount,
          guid: p.guid,
          targetTeamID: p.targetTeamID ?? teamID,
          targetUsername: p.targetUsername ?? username,
        },
      },
    },
    type: 'keybase.1.NotifyTeam.teamTreeMembershipsDone',
  } as never)
}

const partialOk = (p: {
  guid: number
  joinTime?: number
  role: T.RPCGen.TeamRole
  subTeamID: string
  targetTeamID?: string
  teamName: string
}) => {
  notifyEngineActionListeners({
    payload: {
      params: {
        membership: {
          guid: p.guid,
          result: {
            ok: {joinTime: p.joinTime ?? null, role: p.role, teamID: p.subTeamID},
            s: T.RPCGen.TeamTreeMembershipStatus.ok,
          },
          targetTeamID: p.targetTeamID ?? teamID,
          targetUsername: username,
          teamName: p.teamName,
        },
      },
    },
    type: 'keybase.1.NotifyTeam.teamTreeMembershipsPartial',
  } as never)
}

const partialError = (p: {guid: number; teamName: string}) => {
  notifyEngineActionListeners({
    payload: {
      params: {
        membership: {
          guid: p.guid,
          result: {error: {message: 'boom'}, s: T.RPCGen.TeamTreeMembershipStatus.error},
          targetTeamID: teamID,
          targetUsername: username,
          teamName: p.teamName,
        },
      },
    },
    type: 'keybase.1.NotifyTeam.teamTreeMembershipsPartial',
  } as never)
}

beforeEach(() => {
  loadCalls = []
})

afterEach(() => {
  resetAllStores()
})

describe('useTeamTreeMemberships', () => {
  test('kicks off a load for the target team and starts out loading', () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    expect(loadCalls).toEqual([{teamID, username}])
    expect(result.current.loading).toBe(true)
    expect(result.current.nodesIn).toEqual([])
    expect(result.current.nodesNotIn).toEqual([])
  })

  test('splits results into teams you are in and teams you are not', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 2, guid: 1})
      partialOk({guid: 1, joinTime: 55, role: T.RPCGen.TeamRole.admin, subTeamID: 'sub1', teamName: 'p.a'})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.none, subTeamID: 'sub2', teamName: 'p.b'})
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.nodesIn).toEqual([
      {
        joinTime: 55,
        lastActivity: undefined,
        memberCount: undefined,
        role: 'admin',
        teamID: 'sub1',
        teamname: 'p.a',
      },
    ])
    expect(result.current.nodesNotIn).toEqual([
      {joinTime: undefined, lastActivity: undefined, memberCount: undefined, teamID: 'sub2', teamname: 'p.b'},
    ])
  })

  test('stays loading until every expected membership has landed', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 3, guid: 1})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'sub1', teamName: 'p.a'})
    })
    expect(result.current.loading).toBe(true)
    await emit(() => {
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'sub2', teamName: 'p.b'})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'sub3', teamName: 'p.c'})
    })
    expect(result.current.loading).toBe(false)
  })

  test('a newer generation throws away everything from the old one', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 1, guid: 1})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'stale', teamName: 'p.stale'})
    })
    expect(result.current.nodesIn.map(n => n.teamID)).toEqual(['stale'])

    await emit(() => {
      partialOk({guid: 2, role: T.RPCGen.TeamRole.reader, subTeamID: 'fresh', teamName: 'p.fresh'})
    })
    expect(result.current.nodesIn.map(n => n.teamID)).toEqual(['fresh'])
  })

  test('a late partial from an older generation is ignored', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 1, guid: 5})
      partialOk({guid: 5, role: T.RPCGen.TeamRole.writer, subTeamID: 'current', teamName: 'p.current'})
      partialOk({guid: 4, role: T.RPCGen.TeamRole.writer, subTeamID: 'old', teamName: 'p.old'})
    })
    expect(result.current.nodesIn.map(n => n.teamID)).toEqual(['current'])
  })

  test('a late done from an older generation does not reset the expected count', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 1, guid: 5})
      partialOk({guid: 5, role: T.RPCGen.TeamRole.writer, subTeamID: 'current', teamName: 'p.current'})
    })
    expect(result.current.loading).toBe(false)

    await emit(() => {
      done({expectedCount: 9, guid: 4})
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.nodesIn.map(n => n.teamID)).toEqual(['current'])
  })

  test('notifications for another team or user are ignored', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 1, guid: 1, targetTeamID: 'other'})
      done({expectedCount: 1, guid: 1, targetUsername: 'testuser-mac'})
      partialOk({
        guid: 1,
        role: T.RPCGen.TeamRole.writer,
        subTeamID: 'nope',
        targetTeamID: 'other',
        teamName: 'other.a',
      })
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.nodesIn).toEqual([])
  })

  test('failed subtrees are surfaced as errors, not as rows', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 2, guid: 1})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'sub1', teamName: 'p.a'})
      partialError({guid: 1, teamName: 'p.broken'})
    })
    expect(result.current.nodesIn.map(n => n.teamID)).toEqual(['sub1'])
    expect(result.current.nodesNotIn).toEqual([])
    expect(result.current.errors.map(e => e.teamName)).toEqual(['p.broken'])
  })

  test('reload clears the rows and asks the service again', async () => {
    const {result} = renderHook(() => useTeamTreeMemberships(teamID, username))
    await emit(() => {
      done({expectedCount: 1, guid: 1})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'sub1', teamName: 'p.a'})
    })
    expect(result.current.nodesIn).toHaveLength(1)

    await emit(() => {
      result.current.reload()
    })
    expect(result.current.nodesIn).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(loadCalls).toHaveLength(2)
  })

  test('switching the target team drops the previous team rows immediately', async () => {
    const {rerender, result} = renderHook(
      ({id}: {id: T.Teams.TeamID}) => useTeamTreeMemberships(id, username),
      {initialProps: {id: teamID}}
    )
    await emit(() => {
      done({expectedCount: 1, guid: 1})
      partialOk({guid: 1, role: T.RPCGen.TeamRole.writer, subTeamID: 'sub1', teamName: 'p.a'})
    })
    expect(result.current.nodesIn).toHaveLength(1)

    rerender({id: 'tid2' as T.Teams.TeamID})
    expect(result.current.nodesIn).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(loadCalls.at(-1)).toEqual({teamID: 'tid2', username})
  })
})
