/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import type * as T from '@/constants/types'
import {addMembersWizardEmptyState, useTeamsState} from '../teams'

const parentTeamID = 'team-parent' as T.Teams.TeamID

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

test('team list controls update store-local view state', () => {
  const state = useTeamsState.getState()

  state.dispatch.setTeamListFilter('acme')
  state.dispatch.setTeamListSort('activity')
  expect(useTeamsState.getState().teamListFilter).toBe('acme')
  expect(useTeamsState.getState().teamListSort).toBe('activity')
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
