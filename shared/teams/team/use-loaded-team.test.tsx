/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, beforeEach, expect, test} from '@jest/globals'
import {act, cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {LoadedTeamsListProvider} from '../use-teams-list'
import {LoadedTeamChannelsProvider, useLoadedTeamChannels} from '../common/use-loaded-team-channels'
import {LoadedTeamProvider, useLoadedTeam} from './use-loaded-team'
import {flush} from '@/test/flush'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'

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

let engine: FakeEngine
let bodyRenders = 0

const annotatedCalls = () => engine.callCount('keybase.1.teams.getAnnotatedTeam')
const listCalls = () => engine.callCount('keybase.1.teams.teamListUnverified')

// the module-scope resource caches outlive a single test, so without a fresh
// engine and a store reset each test sees whatever the previous one left behind
beforeEach(() => {
  bodyRenders = 0
  engine = installFakeEngine({
    'chat.1.local.getTLFConversationsLocal': () => ({convs: [], offline: false}),
    'keybase.1.teams.getAnnotatedTeam': () => annotated,
    'keybase.1.teams.getTeamRoleMap': () => ({teams: {}, version: 1}),
    'keybase.1.teams.teamListUnverified': () =>
      ({
        teams: [
          {
            fqName: 'testteam',
            isOpenTeam: false,
            memberCount: 1,
            role: T.RPCGen.TeamRole.owner,
            teamID,
            username: 'testuser',
          },
        ],
      }) as unknown as T.RPCGen.AnnotatedTeamList,
  })
  resetAllStores()
})

afterEach(() => {
  cleanup()
  engine.uninstall()
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
  expect(listCalls()).toBe(1)
  expect(bodyRenders).toBeLessThan(10)
  expect(annotatedCalls()).toBe(1)
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
  const callsWhileSignedIn = annotatedCalls()
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
  expect(annotatedCalls()).toBe(callsWhileSignedIn + 1)
})

// The engine listeners, the debounce and the epoch used to be hand-rolled here;
// they are now one invalidateOn declaration, so a team notification still has to
// put the team back on the wire - and exactly once for the whole screen, not
// once per mounted consumer.
test('a team change reloads the screen once', async () => {
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
  expect(annotatedCalls()).toBe(1)

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {teamID}},
      type: 'keybase.1.NotifyTeam.teamChangedByID',
    } as never)
  })
  await flush()
  expect(annotatedCalls()).toBe(2)
})

// A notification for some other team must not cost this one an rpc.
test('a change to another team leaves this one alone', async () => {
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
  expect(annotatedCalls()).toBe(1)

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {teamID: 'tid2'}},
      type: 'keybase.1.NotifyTeam.teamChangedByID',
    } as never)
  })
  await flush()
  expect(annotatedCalls()).toBe(1)
})
