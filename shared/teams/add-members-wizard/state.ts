import {isPhone} from '@/constants/platform'
import * as T from '@/constants/types'

export type AddMembersWizard = Pick<
  T.Teams.AddMembersWizardState,
  'addToChannels' | 'addingMembers' | 'membersAlreadyInTeam' | 'role' | 'teamID'
>

const emptyAddMembersWizard = Object.freeze<Omit<AddMembersWizard, 'teamID'>>({
  addToChannels: undefined,
  addingMembers: [],
  membersAlreadyInTeam: [],
  role: 'writer',
})

const dedupAddingMembers = (
  existing: ReadonlyArray<T.Teams.AddingMember>,
  toAdd: ReadonlyArray<T.Teams.AddingMember>
) => {
  const next = [...existing]
  for (const member of toAdd) {
    if (!next.find(m => m.assertion === member.assertion)) {
      next.unshift(member)
    }
  }
  return next
}

const coerceAssertionRole = (member: T.Teams.AddingMember): T.Teams.AddingMember =>
  member.assertion.includes('@') && ['admin', 'owner'].includes(member.role)
    ? {...member, role: 'writer'}
    : member

export const makeAddMembersWizard = (
  teamID: T.Teams.TeamID,
  overrides?: Partial<Omit<AddMembersWizard, 'teamID'>>
): AddMembersWizard => ({
  ...emptyAddMembersWizard,
  ...overrides,
  teamID,
})

export const addMembersToWizard = async (
  wizard: AddMembersWizard,
  members: ReadonlyArray<T.Teams.AddingMember>
): Promise<AddMembersWizard> => {
  const assertions = members
    .filter(member => member.assertion.includes('@') || !!member.resolvedFrom)
    .map(({assertion}) => assertion)
  const existingAssertions =
    wizard.teamID === T.Teams.newTeamWizardTeamID
      ? []
      : await T.RPCGen.teamsFindAssertionsInTeamNoResolveRpcPromise({
          assertions,
          teamID: wizard.teamID,
        })
  const assertionsInTeam = new Set(existingAssertions ?? [])
  const filteredMembers = members.filter(member => !assertionsInTeam.has(member.assertion))
  const nextRole =
    ['admin', 'owner'].includes(wizard.role) && filteredMembers.some(member => member.assertion.includes('@'))
      ? isPhone
        ? 'writer'
        : 'setIndividually'
      : wizard.role
  let addingMembers = dedupAddingMembers(
    wizard.addingMembers,
    filteredMembers.map(member => coerceAssertionRole(member))
  )
  if (nextRole === 'writer' && wizard.role !== 'writer') {
    addingMembers = addingMembers.map(member => ({...member, role: 'writer'}))
  }
  return {
    ...wizard,
    addingMembers,
    membersAlreadyInTeam: members
      .filter(member => assertionsInTeam.has(member.assertion))
      .map(member => member.resolvedFrom ?? member.assertion),
    role: nextRole,
  }
}

export const removeWizardMember = (wizard: AddMembersWizard, assertion: string): AddMembersWizard => ({
  ...wizard,
  addingMembers: wizard.addingMembers.filter(member => member.assertion !== assertion),
})

export const setWizardRole = (
  wizard: AddMembersWizard,
  role: T.Teams.AddingMemberTeamRoleType | 'setIndividually'
): AddMembersWizard => ({
  ...wizard,
  addingMembers:
    role === 'setIndividually'
      ? wizard.addingMembers
      : wizard.addingMembers.map(member => ({...member, role})),
  role,
})

export const setWizardIndividualRole = (
  wizard: AddMembersWizard,
  assertion: string,
  role: T.Teams.AddingMemberTeamRoleType
): AddMembersWizard => ({
  ...wizard,
  addingMembers: wizard.addingMembers.map(member =>
    member.assertion === assertion ? {...member, role} : member
  ),
})

export const setWizardDefaultChannels = (
  wizard: AddMembersWizard,
  toAdd?: ReadonlyArray<T.Teams.ChannelNameID>,
  toRemove?: T.Teams.ChannelNameID
): AddMembersWizard => {
  const addToChannels = wizard.addToChannels ? [...wizard.addToChannels] : []
  toAdd?.forEach(channel => {
    if (!addToChannels.find(existing => existing.conversationIDKey === channel.conversationIDKey)) {
      addToChannels.push(channel)
    }
  })
  const removeIndex =
    (toRemove &&
      addToChannels.findIndex(channel => channel.conversationIDKey === toRemove.conversationIDKey)) ??
    -1
  if (removeIndex >= 0) {
    addToChannels.splice(removeIndex, 1)
  }
  return {
    ...wizard,
    addToChannels,
  }
}
