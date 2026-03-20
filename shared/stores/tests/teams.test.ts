/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import type * as T from '@/constants/types'
import {addMembersWizardEmptyState, emptyTeamDetails, useTeamsState} from '../teams'

const parentTeamID = 'team-parent' as T.Teams.TeamID
const childAlphaID = 'team-alpha' as T.Teams.TeamID
const childBetaID = 'team-beta' as T.Teams.TeamID

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  resetAllStores()
})

test('channel and member selection can add, remove, and clear all choices', () => {
  const state = useTeamsState.getState()

  state.dispatch.setChannelSelected(parentTeamID, 'general', true)
  state.dispatch.setChannelSelected(parentTeamID, 'random', true)
  expect([...useTeamsState.getState().teamSelectedChannels.get(parentTeamID)!]).toEqual(['general', 'random'])

  state.dispatch.setChannelSelected(parentTeamID, 'general', false)
  expect([...useTeamsState.getState().teamSelectedChannels.get(parentTeamID)!]).toEqual(['random'])

  state.dispatch.setChannelSelected(parentTeamID, 'ignored', false, true)
  expect(useTeamsState.getState().teamSelectedChannels.has(parentTeamID)).toBe(false)

  state.dispatch.setMemberSelected(parentTeamID, 'alice', true)
  state.dispatch.setMemberSelected(parentTeamID, 'bob', true)
  expect([...useTeamsState.getState().teamSelectedMembers.get(parentTeamID)!]).toEqual(['alice', 'bob'])

  state.dispatch.setMemberSelected(parentTeamID, 'bob', false)
  expect([...useTeamsState.getState().teamSelectedMembers.get(parentTeamID)!]).toEqual(['alice'])

  state.dispatch.setMemberSelected(parentTeamID, 'ignored', false, true)
  expect(useTeamsState.getState().teamSelectedMembers.has(parentTeamID)).toBe(false)
})

test('setSubteamFilter derives filtered subteams from team metadata and clears when empty', () => {
  useTeamsState.setState({
    teamDetails: new Map([[parentTeamID, {...emptyTeamDetails, subteams: new Set([childAlphaID, childBetaID])}]]),
    teamMeta: new Map([
      [childAlphaID, {teamname: 'acme.alpha'}],
      [childBetaID, {teamname: 'acme.beta'}],
    ]),
  } as never)

  useTeamsState.getState().dispatch.setSubteamFilter('alp', parentTeamID)
  expect(useTeamsState.getState().subteamFilter).toBe('alp')
  expect(useTeamsState.getState().subteamsFiltered).toEqual(new Set([childAlphaID]))

  useTeamsState.getState().dispatch.setSubteamFilter('', parentTeamID)
  expect(useTeamsState.getState().subteamsFiltered).toBeUndefined()
})

test('team list controls and invite collapsing update store-local view state', () => {
  const state = useTeamsState.getState()

  state.dispatch.setTeamListFilter('acme')
  state.dispatch.setTeamListSort('activity')
  state.dispatch.toggleInvitesCollapsed(parentTeamID)
  expect(useTeamsState.getState().teamListFilter).toBe('acme')
  expect(useTeamsState.getState().teamListSort).toBe('activity')
  expect(useTeamsState.getState().invitesCollapsed.has(parentTeamID)).toBe(true)

  state.dispatch.toggleInvitesCollapsed(parentTeamID)
  expect(useTeamsState.getState().invitesCollapsed.has(parentTeamID)).toBe(false)
})

test('add members role updates synchronize top-level and per-member roles', () => {
  useTeamsState.setState({
    addMembersWizard: {
      ...addMembersWizardEmptyState,
      addingMembers: [
        {assertion: 'alice', role: 'writer'},
        {assertion: 'bob', role: 'writer'},
      ],
      teamID: parentTeamID,
    },
  } as never)

  const state = useTeamsState.getState()
  state.dispatch.setAddMembersWizardRole('admin')
  expect(useTeamsState.getState().addMembersWizard.role).toBe('admin')
  expect(useTeamsState.getState().addMembersWizard.addingMembers.map(m => m.role)).toEqual(['admin', 'admin'])

  state.dispatch.setAddMembersWizardIndividualRole('bob', 'reader')
  expect(useTeamsState.getState().addMembersWizard.addingMembers.find(m => m.assertion === 'bob')?.role).toBe(
    'reader'
  )

  state.dispatch.addMembersWizardRemoveMember('alice')
  expect(useTeamsState.getState().addMembersWizard.addingMembers.map(m => m.assertion)).toEqual(['bob'])
})
