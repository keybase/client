/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, jest, test} from '@jest/globals'
import {act, render} from '@testing-library/react'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {LoadedTeamsListProvider} from '../use-teams-list'
import {LoadedTeamChannelsProvider, useLoadedTeamChannels} from '../common/use-loaded-team-channels'
import {LoadedTeamProvider, useLoadedTeam} from './use-loaded-team'

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
jest.spyOn(T.RPCGen, 'teamsGetAnnotatedTeamRpcPromise').mockImplementation(async () => {
  annotatedCalls++
  await Promise.resolve()
  return annotated
})
jest.spyOn(T.RPCChat, 'localGetTLFConversationsLocalRpcPromise').mockImplementation(async () => {
  await Promise.resolve()
  return {convs: [], offline: false} as never
})
let listCalls = 0
jest.spyOn(T.RPCGen, 'teamsTeamListUnverifiedRpcPromise').mockImplementation(async () => {
  listCalls++
  await Promise.resolve()
  return {
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
  } as never
})
jest.spyOn(T.RPCGen, 'teamsGetTeamRoleMapRpcPromise').mockImplementation(async () => {
  await Promise.resolve()
  return {teams: {}, version: 1} as never
})

let bodyRenders = 0
const Body = () => {
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
  for (let i = 0; i < 60; i++) {
    await act(async () => {
      await Promise.resolve()
    })
  }
  expect(listCalls).toBe(1)
  expect(bodyRenders).toBeLessThan(10)
  expect(annotatedCalls).toBe(1)
})
