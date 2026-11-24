/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, beforeEach, expect, test} from '@jest/globals'
import {act, cleanup, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import {_onEngineIncoming} from '@/constants/init/shared'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {pushTeamChanged} from '@/test/team-changed'
import {LoadedTeamsListProvider} from '../use-teams-list'
import {LoadedTeamProvider, useLoadedTeam} from './use-loaded-team'

const teamA = 'tidA' as T.Teams.TeamID
const teamB = 'tidB' as T.Teams.TeamID
const getAnnotatedTeam = 'keybase.1.teams.getAnnotatedTeam'
const teamListUnverified = 'keybase.1.teams.teamListUnverified'
const getTeamRoleMap = 'keybase.1.teams.getTeamRoleMap'

let fake: FakeEngine
let roleMapVersion = 1

const callsOf = (method: string) => fake.calls.filter(c => c.method === method)
const teamLoads = (teamID: T.Teams.TeamID) =>
  callsOf(getAnnotatedTeam).filter(c => (c.params as {teamID: string}).teamID === teamID).length

beforeEach(() => {
  roleMapVersion = 1
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  fake.answer(getAnnotatedTeam, (p: {teamID: string}) => ({
    invites: [],
    joinRequests: [],
    members: [],
    name: `team-${p.teamID}`,
    settings: {joinAs: T.RPCGen.TeamRole.reader, open: false},
    showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
    tarsDisabled: false,
    transitiveSubteamsUnverified: {entries: []},
  }))
  fake.answer(teamListUnverified, () => ({teams: []}))
  fake.answer(getTeamRoleMap, () => ({teams: {}, version: roleMapVersion}))
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  cleanup()
  resetAllStores()
  jest.useRealTimers()
})

// past the reload debounce, so the next notice is a burst of its own
const settleReloads = async () => {
  await act(async () => {
    jest.advanceTimersByTime(10_000)
    await flush()
  })
}

const Name = (props: {teamID: T.Teams.TeamID}) => {
  const {teamMeta} = useLoadedTeam(props.teamID)
  return <div>{`${props.teamID}:${teamMeta.teamname}`}</div>
}

// two team pages open at once, as with a team and a subteam in the stack
const mountTwoTeams = async () => {
  render(
    <LoadedTeamsListProvider>
      <LoadedTeamProvider teamID={teamA}>
        <Name teamID={teamA} />
      </LoadedTeamProvider>
      <LoadedTeamProvider teamID={teamB}>
        <Name teamID={teamB} />
      </LoadedTeamProvider>
    </LoadedTeamsListProvider>
  )
  await flush()
  expect(teamLoads(teamA)).toBe(1)
  expect(teamLoads(teamB)).toBe(1)
}

test("a change to one team reloads that team's page and not another's", async () => {
  await mountTwoTeams()

  await pushTeamChanged(fake, teamA, {membership: true})

  expect(teamLoads(teamA)).toBe(2)
  expect(teamLoads(teamB)).toBe(1)
})

test('a team page reloads only for kinds that change what it shows', async () => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate']})
  await mountTwoTeams()

  await pushTeamChanged(fake, teamA, {channels: true, keyRotated: true, memberCount: true})
  await settleReloads()
  expect(teamLoads(teamA)).toBe(1)

  for (const kind of ['roles', 'renamed', 'settings'] as const) {
    await pushTeamChanged(fake, teamA, {[kind]: true})
    await settleReloads()
  }
  expect(teamLoads(teamA)).toBe(4)
})

const mountTwoPagesForTeamA = () => render(<TwoPagesForTeamA />)

function TwoPagesForTeamA() {
  return (
    <LoadedTeamsListProvider>
      <LoadedTeamProvider teamID={teamA}>
        <Name teamID={teamA} />
      </LoadedTeamProvider>
      <LoadedTeamProvider teamID={teamA}>
        <Name teamID={teamA} />
      </LoadedTeamProvider>
    </LoadedTeamsListProvider>
  )
}

// a bulk add sends a notice per member: the burst reloads once at its start and
// once after it, not per notice, and two pages for the team share each load
test('a burst of changes to a team costs a load at its start and one after it', async () => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate']})
  mountTwoPagesForTeamA()
  await flush()
  const loads = teamLoads(teamA)

  await pushTeamChanged(fake, teamA, {membership: true})
  expect(teamLoads(teamA)).toBe(loads + 1)

  for (let i = 0; i < 20; i++) {
    await pushTeamChanged(fake, teamA, {membership: true})
  }
  expect(teamLoads(teamA)).toBe(loads + 1)

  await act(async () => {
    jest.advanceTimersByTime(1000)
    await flush()
  })
  expect(teamLoads(teamA)).toBe(loads + 2)

  await settleReloads()
  expect(teamLoads(teamA)).toBe(loads + 2)
})

// the role map and member showcase are about you, not one team; the role map provider and the
// teams list pick them up, and the team page re-derives your role from the role map
test('changes about the current user do not reload team pages', async () => {
  await mountTwoTeams()

  roleMapVersion = 2
  await pushTeamChanged(fake, '', {roleMap: true}, 2)
  await pushTeamChanged(fake, '', {memberShowcase: true})

  expect(teamLoads(teamA)).toBe(1)
  expect(teamLoads(teamB)).toBe(1)
})

test('a deleted or left team drops its page data and leaves other teams alone', async () => {
  await mountTwoTeams()
  expect(screen.queryByText(`${teamA}:team-${teamA}`)).not.toBeNull()

  await pushTeamChanged(fake, teamA, {deleted: true})
  expect(screen.queryByText(`${teamA}:`)).not.toBeNull()
  expect(screen.queryByText(`${teamB}:team-${teamB}`)).not.toBeNull()

  await pushTeamChanged(fake, teamB, {exited: true})
  expect(screen.queryByText(`${teamB}:`)).not.toBeNull()
  expect(teamLoads(teamA)).toBe(1)
  expect(teamLoads(teamB)).toBe(1)
})

test('the teams list reloads for list changes in any team, not for channel changes', async () => {
  await mountTwoTeams()
  const lists = callsOf(teamListUnverified).length

  await pushTeamChanged(fake, teamB, {channels: true, keyRotated: true})
  expect(callsOf(teamListUnverified).length).toBe(lists)

  await pushTeamChanged(fake, teamB, {memberCount: true})
  expect(callsOf(teamListUnverified).length).toBe(lists + 1)
})

test('the role map reloads only for a version newer than the one it has', async () => {
  await mountTwoTeams()
  const loads = callsOf(getTeamRoleMap).length

  await pushTeamChanged(fake, '', {roleMap: true}, 1)
  expect(callsOf(getTeamRoleMap).length).toBe(loads)

  roleMapVersion = 2
  await pushTeamChanged(fake, '', {roleMap: true}, 2)
  expect(callsOf(getTeamRoleMap).length).toBe(loads + 1)
})
