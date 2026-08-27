/// <reference types="jest" />
import {expect, jest, test, describe, beforeEach} from '@jest/globals'
import * as T from '@/constants/types'
import {
  createNewTeamFromWizard,
  getNextRouteAfterAvatar,
  makeNewTeamWizard,
  newTeamWizardEmptyState,
  newTeamWizardToAddMembersWizard,
} from './state'

let createCalls: Array<{teamInfo: T.RPCGen.TeamCreateFancyInfo}> = []
jest.spyOn(T.RPCGen, 'teamsTeamCreateFancyRpcPromise').mockImplementation(async (params: unknown) => {
  createCalls.push(params as {teamInfo: T.RPCGen.TeamCreateFancyInfo})
  await Promise.resolve()
  return 'newid' as never
})

beforeEach(() => {
  createCalls = []
})

describe('makeNewTeamWizard', () => {
  test('defaults describe an unnamed small closed team you join yourself', () => {
    expect(makeNewTeamWizard()).toEqual(newTeamWizardEmptyState)
    expect(newTeamWizardEmptyState.addYourself).toBe(true)
    expect(newTeamWizardEmptyState.isBig).toBe(false)
    expect(newTeamWizardEmptyState.open).toBe(false)
    expect(newTeamWizardEmptyState.openTeamJoinRole).toBe('reader')
  })

  test('overrides layer on top of the defaults', () => {
    const wizard = makeNewTeamWizard({name: 'keybase', teamType: 'project'})
    expect(wizard.name).toBe('keybase')
    expect(wizard.teamType).toBe('project')
    expect(wizard.addYourself).toBe(true)
  })
})

describe('newTeamWizardToAddMembersWizard', () => {
  test('hands the new team wizard off under the sentinel team id', () => {
    const wizard = makeNewTeamWizard({name: 'keybase'})
    const addMembers = newTeamWizardToAddMembersWizard(wizard)
    expect(addMembers.teamID).toBe(T.Teams.newTeamWizardTeamID)
    expect(addMembers.newTeamWizard).toBe(wizard)
    expect(addMembers.role).toBe('writer')
    expect(addMembers.addingMembers).toEqual([])
  })

  test('overrides apply to the add-members side', () => {
    const addMembers = newTeamWizardToAddMembersWizard(makeNewTeamWizard(), {role: 'admin'})
    expect(addMembers.role).toBe('admin')
    expect(addMembers.teamID).toBe(T.Teams.newTeamWizardTeamID)
  })
})

describe('getNextRouteAfterAvatar', () => {
  test('friends and other teams go straight to adding members', () => {
    for (const teamType of ['friends', 'other'] as const) {
      const route = getNextRouteAfterAvatar(makeNewTeamWizard({teamType}), 10)
      expect(route.name).toBe('teamAddToTeamFromWhere')
      expect(route.params.wizard).toHaveProperty('teamID', T.Teams.newTeamWizardTeamID)
    }
  })

  test('a project team picks channels first', () => {
    expect(getNextRouteAfterAvatar(makeNewTeamWizard({teamType: 'project'}), 10).name).toBe(
      'teamWizard5Channels'
    )
  })

  test('a community team picks its size first', () => {
    expect(getNextRouteAfterAvatar(makeNewTeamWizard({teamType: 'community'}), 10).name).toBe(
      'teamWizard4TeamSize'
    )
  })

  test('a subteam offers to pull in parent members only when the parent has more than one', () => {
    const wizard = makeNewTeamWizard({teamType: 'subteam'})
    expect(getNextRouteAfterAvatar(wizard, 2).name).toBe('teamWizardSubteamMembers')
    // a one-person parent has nobody to pull in, so skip that screen
    expect(getNextRouteAfterAvatar(wizard, 1).name).toBe('teamAddToTeamFromWhere')
    expect(getNextRouteAfterAvatar(wizard, 0).name).toBe('teamAddToTeamFromWhere')
  })

  test('the subteam-members route carries the raw new team wizard, not the add-members one', () => {
    const wizard = makeNewTeamWizard({teamType: 'subteam'})
    const route = getNextRouteAfterAvatar(wizard, 5)
    expect(route.params.wizard).toBe(wizard)
  })
})

describe('createNewTeamFromWizard', () => {
  test('translates the wizard plus staged members into the create rpc payload', async () => {
    await createNewTeamFromWizard(
      makeNewTeamWizard({
        channels: ['general', 'random'],
        description: 'a team',
        isBig: true,
        name: 'keybase',
        open: true,
        openTeamJoinRole: 'writer',
        profileShowcase: true,
        subteams: ['sub'],
      }),
      [
        {assertion: 'testuser', role: 'admin'},
        {assertion: 'a@b.com', role: 'writer'},
      ]
    )

    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]!.teamInfo).toEqual({
      avatar: null,
      chatChannels: ['general', 'random'],
      description: 'a team',
      joinSubteam: true,
      name: 'keybase',
      openSettings: {joinAs: T.RPCGen.TeamRole.writer, open: true},
      profileShowcase: true,
      subteams: ['sub'],
      users: [
        {assertion: 'testuser', role: T.RPCGen.TeamRole.admin},
        {assertion: 'a@b.com', role: T.RPCGen.TeamRole.writer},
      ],
    })
  })

  test('an avatar filename with no crop still sends the avatar', async () => {
    await createNewTeamFromWizard(makeNewTeamWizard({avatarFilename: '/tmp/a.png', name: 'keybase'}), [])
    expect(createCalls[0]!.teamInfo.avatar).toEqual({avatarFilename: '/tmp/a.png', crop: undefined})
  })

  test('addYourself false becomes joinSubteam false', async () => {
    await createNewTeamFromWizard(makeNewTeamWizard({addYourself: false, name: 'keybase'}), [])
    expect(createCalls[0]!.teamInfo.joinSubteam).toBe(false)
    expect(createCalls[0]!.teamInfo.users).toEqual([])
  })
})
