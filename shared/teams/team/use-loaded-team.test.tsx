/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {LoadedTeamsListProvider} from '../use-teams-list'
import {LoadedTeamChannelsProvider, useLoadedTeamChannels} from '../common/use-loaded-team-channels'
import {LoadedTeamProvider, useLoadedTeam} from './use-loaded-team'
import {flush} from '@/test/flush'

const teamID = 'tid1' as T.Teams.TeamID

const annotated = {
  invites: [],
  joinRequests: [],
  members: [],
  name: 'testteam',
  settings: {joinAs: T.RPCGen.TeamRole.reader, open: false},
  showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
  tarsDisabled: false,
  transitiveSubteamsUnverified: {entries: []},
} as unknown as T.RPCGen.AnnotatedTeam

let annotatedCalls = 0
let teamIsShowcased = false
jest.spyOn(T.RPCGen, 'teamsGetAnnotatedTeamRpcPromise').mockImplementation(async () => {
  annotatedCalls++
  await Promise.resolve()
  return {...annotated, showcase: {...annotated.showcase, isShowcased: teamIsShowcased}}
})
jest.spyOn(T.RPCChat, 'localGetTLFConversationsLocalRpcPromise').mockImplementation(async () => {
  await Promise.resolve()
  return {convs: [], offline: false} as never
})
let listCalls = 0
let memberShowcased = false
let listHasTeam = true
jest.spyOn(T.RPCGen, 'teamsTeamListUnverifiedRpcPromise').mockImplementation(async () => {
  listCalls++
  await Promise.resolve()
  return {
    teams: listHasTeam ? [
      {
        fqName: 'testteam',
        isMemberShowcased: memberShowcased,
        isOpenTeam: false,
        memberCount: 1,
        role: T.RPCGen.TeamRole.owner,
        teamID,
        username: 'testuser',
      },
    ] : [],
  } as never
})
jest.spyOn(T.RPCGen, 'teamsGetTeamRoleMapRpcPromise').mockImplementation(async () => {
  await Promise.resolve()
  return {teams: {}, version: 1} as never
})

let bodyRenders = 0

// these counters and the module-scope resource caches both outlive a single
// test, so without a reset each test sees whatever the previous one left behind
beforeEach(() => {
  annotatedCalls = 0
  listCalls = 0
  teamIsShowcased = false
  memberShowcased = false
  listHasTeam = true
  bodyRenders = 0
  resetAllStores()
})

afterEach(() => {
  cleanup()
})

const Body = () => {
  // counts real renders: compiling this away is exactly what the test measures
  'use no memo'
  bodyRenders++
  const {teamMeta} = useLoadedTeam(teamID)
  const {channels} = useLoadedTeamChannels(teamID)
  return (
    <div>
      {teamMeta.teamname}
      {channels.size}
    </div>
  )
}

const WithChannels = () => {
  const {teamMeta} = useLoadedTeam(teamID)
  return (
    <LoadedTeamChannelsProvider teamID={teamID} teamname={teamMeta.teamname}>
      <Body />
    </LoadedTeamChannelsProvider>
  )
}

// The team screen mounts one real loader plus a shadow instance per consumer;
// a teams-list load landing must not re-issue getAnnotatedTeam.
test('team screen loads getAnnotatedTeam once', async () => {
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
  render(
    <LoadedTeamsListProvider>
      <LoadedTeamProvider teamID={teamID}>
        <WithChannels />
      </LoadedTeamProvider>
    </LoadedTeamsListProvider>
  )
  await flush()
  expect(listCalls).toBe(1)
  expect(bodyRenders).toBeLessThan(10)
  expect(annotatedCalls).toBe(1)
})

// These caches live at module scope, so they outlive the signed-in session. If
// sign-out did not clear them the next user would be served the previous user's
// team inside the stale window - and the entries are keyed on teamID, which
// says nothing about who loaded them.
test('signing out drops the shared team caches', async () => {
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
  const first = render(
    <LoadedTeamsListProvider>
      <LoadedTeamProvider teamID={teamID}>
        <WithChannels />
      </LoadedTeamProvider>
    </LoadedTeamsListProvider>
  )
  await flush()
  const callsWhileSignedIn = annotatedCalls
  expect(callsWhileSignedIn).toBeGreaterThan(0)

  first.unmount()
  act(() => {
    resetAllStores()
  })

  // a different user mounting the same screen must re-issue the RPC rather than
  // read the entry the previous one left behind
  useCurrentUserState.setState({username: 'testuser-mac'})
  useConfigState.setState({loggedIn: true})
  render(
    <LoadedTeamsListProvider>
      <LoadedTeamProvider teamID={teamID}>
        <WithChannels />
      </LoadedTeamProvider>
    </LoadedTeamsListProvider>
  )
  await flush()
  expect(annotatedCalls).toBe(callsWhileSignedIn + 1)
})

const Showcasing = () => {
  const {loaded, showcasingKnown, teamMeta} = useLoadedTeam(teamID)
  return <div>{loaded ? (showcasingKnown ? `showcasing:${String(teamMeta.showcasing)}` : 'showcasing:unknown') : 'loading'}</div>
}

const renderShowcasing = async () => {
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
  const r = render(
    <LoadedTeamsListProvider>
      <LoadedTeamProvider teamID={teamID}>
        <Showcasing />
      </LoadedTeamProvider>
    </LoadedTeamsListProvider>
  )
  await flush()
  return r
}

// The settings box and the feature-team card read showcasing as "featured on your own profile",
// which only the teams list carries; the annotated team's showcase is the team's own publicity.
test('showcasing is your showcase of the team, not the team being public', async () => {
  teamIsShowcased = true
  memberShowcased = false
  expect((await renderShowcasing()).queryByText('showcasing:false')).not.toBeNull()
})

test('showcasing follows your showcase of a team that is not public', async () => {
  teamIsShowcased = false
  memberShowcased = true
  expect((await renderShowcasing()).queryByText('showcasing:true')).not.toBeNull()
})

// a teams list without the team (still loading, a deep link, a failed load) says nothing about
// your showcase of it: the settings box must not read that as "not featured"
test('showcasing is unknown while the teams list lacks the team', async () => {
  listHasTeam = false
  teamIsShowcased = true
  expect((await renderShowcasing()).queryByText('showcasing:unknown')).not.toBeNull()
})
