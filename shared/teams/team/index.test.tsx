/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {act, cleanup, render, screen} from '@testing-library/react'
import {_onEngineIncoming} from '@/constants/init/shared'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper, renders} from '@/test/navigation'
import {pushTeamChanged} from '@/test/team-changed'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {LoadedTeamsListProvider} from '../use-teams-list'
import Team from './index'

const teamID = 'tid1' as T.Teams.TeamID
const getAnnotatedTeam = 'keybase.1.teams.getAnnotatedTeam'

// each bot row carries its menu button
const botRows = () => screen.queryAllByTestId(TestIDs.TEAMS_BOT_ROW_MENU).length
const settle = async () =>
  act(async () => {
    await flush()
    await renders()
    await flush()
  })

const annotatedTeam = (): T.RPCGen.AnnotatedTeam =>
  ({
    invites: [],
    joinRequests: [],
    members: [
      {
        allowProfilePromote: false,
        fullName: '',
        isMemberShowcased: false,
        joinTime: 0,
        role: T.RPCGen.TeamRole.restrictedbot,
        status: T.RPCGen.TeamMemberStatus.active,
        username: 'testuser-bot',
        uv: {eldestSeqno: 1, uid: 'bot-uid'},
      },
    ],
    name: 'testteam',
    settings: {joinAs: T.RPCGen.TeamRole.reader, open: false},
    showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
    tarsDisabled: false,
    transitiveSubteamsUnverified: {entries: []},
  }) as unknown as T.RPCGen.AnnotatedTeam

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  fake.answer(getAnnotatedTeam, () => annotatedTeam())
  fake.answer('keybase.1.teams.getTeamRoleMap', () => ({
    teams: {[teamID]: {implicitRole: T.RPCGen.TeamRole.none, role: T.RPCGen.TeamRole.admin}},
    version: 1,
  }))
  fake.answer('keybase.1.teams.teamListUnverified', () => ({annotatedActiveInvites: {}, teams: []}))
  fake.answer('chat.1.local.getTLFConversationsLocal', () => ({convs: [], offline: false}))
  fake.answer('keybase.1.featuredBot.search', () => ({bots: [], isLastPage: true}))
  fake.answer('chat.1.local.findGeneralConvFromTeamID', () => fakeError(T.RPCGen.StatusCode.scgeneric, 'none'))
  fake.answer('chat.1.local.getLastActiveForTeams', () => ({channels: {}, teams: {}}))
  fake.answer('keybase.1.gregor.dismissCategory', () => null)
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  cleanup()
  resetAllStores()
})


// A refresh while the page shows its rows keeps them: replacing them with a loading row unmounts
// any row whose menu is open, closing it under the user.
test('a team reload keeps the bot rows on screen', async () => {
  const {wrapper} = navigationWrapper({params: {initialTab: 'bots', teamID}, route: 'team', tab: Tabs.teamsTab})
  render(
    <LoadedTeamsListProvider>
      <Team teamID={teamID} initialTab="bots" />
    </LoadedTeamsListProvider>,
    {wrapper}
  )
  await settle()
  expect(botRows()).toBe(1)

  const held = fake.hold(getAnnotatedTeam)
  await pushTeamChanged(fake, teamID, {roles: true})
  await settle()
  expect(held.length).toBeGreaterThan(0)
  expect(botRows()).toBe(1)

  act(() => {
    held.forEach(c => c.reply(annotatedTeam()))
  })
  await settle()
  expect(botRows()).toBe(1)
})
