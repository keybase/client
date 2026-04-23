/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import type * as T from '@/constants/types'
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
