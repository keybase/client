/// <reference types="jest" />
import * as T from '@/constants/types'
import {StatusCode} from '@/constants/rpc/rpc-gen'
import {installFakeEngine, type FakeEngine} from './fake-engine'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {RPCError} from '@/util/errors'

// RPCError deliberately does not extend Error, so a rejection with one has to be
// built in a single place the lint rule can be told about.
const rejectWithRPCError = (desc: string): never => {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new RPCError(desc, StatusCode.scgeneric)
}

let engine: FakeEngine | undefined

afterEach(() => {
  engine?.uninstall()
  engine = undefined
  resetAllStores()
})

test('answers a generated RpcPromise by wire method and counts the call', async () => {
  engine = installFakeEngine({
    'keybase.1.teams.getTeamRoleMap': () => ({teams: {}, version: 7}),
  })

  const res = await T.RPCGen.teamsGetTeamRoleMapRpcPromise()

  expect(res.version).toBe(7)
  expect(engine.callCount('keybase.1.teams.getTeamRoleMap')).toBe(1)
  expect(engine.unhandledMethods()).toEqual([])
})

test('records the params the caller sent', async () => {
  engine = installFakeEngine({
    'keybase.1.teams.getAnnotatedTeam': () => ({name: 'testteam'}) as never,
  })

  await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: 'tid1' as T.Teams.TeamID})

  expect(engine.calls('keybase.1.teams.getAnnotatedTeam')).toEqual([
    {method: 'keybase.1.teams.getAnnotatedTeam', params: {teamID: 'tid1'}},
  ])
})

test('a rejecting handler rejects the promise', async () => {
  engine = installFakeEngine({
    'keybase.1.teams.getTeamRoleMap': () => rejectWithRPCError('nope'),
  })

  await expect(T.RPCGen.teamsGetTeamRoleMapRpcPromise()).rejects.toMatchObject({desc: 'nope'})
})

test('an unstubbed method fails loudly instead of hanging', async () => {
  // this test asserts on the failure itself, so it opts out of fail-on-console
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  engine = installFakeEngine({})

  await expect(T.RPCGen.teamsGetTeamRoleMapRpcPromise()).rejects.toMatchObject({
    code: StatusCode.scgeneric,
  })
  expect(engine.unhandledMethods()).toEqual(['keybase.1.teams.getTeamRoleMap'])
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('keybase.1.teams.getTeamRoleMap'))
  spy.mockRestore()
})

test('a waitingKey is held for the life of the call', async () => {
  let release = (_: unknown) => {}
  engine = installFakeEngine({
    'keybase.1.teams.getTeamRoleMap': () => new Promise(resolve => (release = resolve)) as never,
  })

  const p = T.RPCGen.teamsGetTeamRoleMapRpcPromise(undefined, 'rolemap')
  expect(useWaitingState.getState().counts.get('rolemap')).toBe(1)

  // handlers run a microtask after the call, so let this one install its resolver
  await Promise.resolve()
  release({teams: {}, version: 1})
  await p
  expect(useWaitingState.getState().counts.get('rolemap')).toBeUndefined()
})

test('a failing call leaves the error on the waiting key', async () => {
  engine = installFakeEngine({
    'keybase.1.teams.getTeamRoleMap': () => rejectWithRPCError('boom'),
  })

  await expect(T.RPCGen.teamsGetTeamRoleMapRpcPromise(undefined, 'rolemap')).rejects.toBeTruthy()
  expect(useWaitingState.getState().counts.get('rolemap')).toBeUndefined()
  expect(useWaitingState.getState().errors.get('rolemap')?.desc).toBe('boom')
})

test('streaming handlers reach the callers incomingCallMap before the call settles', async () => {
  const hits: Array<string> = []
  engine = installFakeEngine({
    'chat.1.local.searchInbox': async (_params, ctx) => {
      ctx.incoming('chat.1.chatUi.chatSearchInboxHit', {searchHit: {query: 'a'}})
      ctx.incoming('chat.1.chatUi.chatSearchInboxHit', {searchHit: {query: 'b'}})
      // the listener defers each incoming call by a macrotask, so let them land
      await new Promise(resolve => setTimeout(resolve, 0))
      return {} as never
    },
  })

  await T.RPCChat.localSearchInboxRpcListener({
    incomingCallMap: {
      'chat.1.chatUi.chatSearchInboxHit': (p: {searchHit?: {query?: string}}) => {
        hits.push(p.searchHit?.query ?? '')
      },
    } as never,
    params: {} as never,
  })

  expect(hits).toEqual(['a', 'b'])
})

test('cancelling a session rejects the caller rather than stranding it', async () => {
  let cancel = () => {}
  engine = installFakeEngine({
    'chat.1.local.searchInbox': () => new Promise(() => {}) as never,
  })

  const p = T.RPCChat.localSearchInboxRpcListener({
    incomingCallMap: {} as never,
    onSessionCreated: c => {
      cancel = c
    },
    params: {} as never,
  })
  cancel()

  await expect(p).rejects.toMatchObject({code: StatusCode.sccanceled})
})

test('setHandlers swaps the answer for a later call', async () => {
  engine = installFakeEngine({
    'keybase.1.teams.getTeamRoleMap': () => ({teams: {}, version: 1}),
  })
  expect((await T.RPCGen.teamsGetTeamRoleMapRpcPromise()).version).toBe(1)

  engine.setHandlers({'keybase.1.teams.getTeamRoleMap': () => ({teams: {}, version: 2})})
  expect((await T.RPCGen.teamsGetTeamRoleMapRpcPromise()).version).toBe(2)
  expect(engine.callCount('keybase.1.teams.getTeamRoleMap')).toBe(2)
})

// Session.start puts the sessionID in the outgoing param, so a stub standing in
// for the service sees it - while calls() keeps the raw params for assertions.
test('the stub sees the sessionID the real session would have injected', async () => {
  let seen: unknown
  engine = installFakeEngine({
    'keybase.1.teams.getTeamRoleMap': params => {
      seen = params
      return {teams: {}, version: 1}
    },
  })

  await T.RPCGen.teamsGetTeamRoleMapRpcPromise()

  expect(seen).toEqual({sessionID: expect.any(Number)})
  expect(engine.calls('keybase.1.teams.getTeamRoleMap')[0]?.params).toBeUndefined()
})

// A file that installs twice, or one that had a real engine, must not be left
// with an empty seam - the next getEngine() would throw.
test('uninstall restores the adapter that was installed before it', async () => {
  const first = installFakeEngine({'keybase.1.teams.getTeamRoleMap': () => ({teams: {}, version: 1})})
  const second = installFakeEngine({'keybase.1.teams.getTeamRoleMap': () => ({teams: {}, version: 2})})
  expect((await T.RPCGen.teamsGetTeamRoleMapRpcPromise()).version).toBe(2)

  second.uninstall()
  expect((await T.RPCGen.teamsGetTeamRoleMapRpcPromise()).version).toBe(1)
  expect(first.callCount('keybase.1.teams.getTeamRoleMap')).toBe(1)

  engine = first
})
