/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import type * as T from '@/constants/types'
import {useTeamsState} from '../teams'
import {
  makeAddMembersWizard,
  removeWizardMember,
  setWizardIndividualRole,
  setWizardRole,
} from '@/teams/add-members-wizard/state'

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

test('add members role updates synchronize top-level and per-member roles', () => {
  let wizard = makeAddMembersWizard(parentTeamID, {
    addingMembers: [
      {assertion: 'alice', role: 'writer'},
      {assertion: 'bob', role: 'writer'},
    ],
  })

  wizard = setWizardRole(wizard, 'admin')
  expect(wizard.role).toBe('admin')
  expect(wizard.addingMembers.map(m => m.role)).toEqual(['admin', 'admin'])

  wizard = setWizardIndividualRole(wizard, 'bob', 'reader')
  expect(wizard.addingMembers.find(m => m.assertion === 'bob')?.role).toBe('reader')

  wizard = removeWizardMember(wizard, 'alice')
  expect(wizard.addingMembers.map(m => m.assertion)).toEqual(['bob'])
})
