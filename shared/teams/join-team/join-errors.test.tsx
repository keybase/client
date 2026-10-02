/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {getJoinTeamError} from './container'
import {getInviteError} from './join-from-invite'

afterEach(() => {
  resetAllStores()
})

// The error a join attempt's listener RPC rejects with when the service fails it.
const joinFailure = async (code: T.RPCGen.StatusCode, desc: string) => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.teams.teamAcceptInviteOrRequestAccess', () => fakeError(code, desc))
  const failed = T.RPCGen.teamsTeamAcceptInviteOrRequestAccessRpcListener({
    incomingCallMap: {},
    params: {tokenOrName: 'testteam'},
  }).catch((e: unknown) => e)
  const e = await failed
  uninstallFakeEngine()
  return e
}

test('the join dialog names a bad token, an expired invite, and otherwise the service message', async () => {
  expect(getJoinTeamError(await joinFailure(T.RPCGen.StatusCode.scteaminvitebadtoken, 'bad'))).toBe(
    'Sorry, that team name or token is not valid.'
  )
  expect(getJoinTeamError(await joinFailure(T.RPCGen.StatusCode.scnotfound, 'gone'))).toBe(
    'This invitation is no longer valid, or has expired.'
  )
  expect(getJoinTeamError(await joinFailure(T.RPCGen.StatusCode.scgeneric, 'team is full'))).toBe(
    'team is full'
  )
})

test('joining from an invite link names a bad token and an expired invite', async () => {
  expect(getInviteError(await joinFailure(T.RPCGen.StatusCode.scteaminvitebadtoken, 'bad'), false)).toBe(
    'Sorry, that team name or token is not valid.'
  )
  expect(getInviteError(await joinFailure(T.RPCGen.StatusCode.scnotfound, 'gone'), false)).toBe(
    'This invitation is no longer valid, or has expired.'
  )
})
