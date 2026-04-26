import * as C from '@/constants'
import * as T from '@/constants/types'
import {makeAddMembersWizard, type AddMembersWizard} from '../../add-members-wizard/state'

export type NewTeamWizard = T.Teams.NewTeamWizardState

export const newTeamWizardEmptyState = Object.freeze<NewTeamWizard>({
  addYourself: true,
  description: '',
  isBig: false,
  name: '',
  open: false,
  openTeamJoinRole: 'reader',
  profileShowcase: false,
  teamType: 'other',
})

export const makeNewTeamWizard = (overrides?: Partial<NewTeamWizard>): NewTeamWizard => ({
  ...newTeamWizardEmptyState,
  ...overrides,
})

export const clearNewTeamWizardError = (wizard: NewTeamWizard): NewTeamWizard => {
  const next = {...wizard}
  delete next.error
  return next
}

export const newTeamWizardToAddMembersWizard = (
  wizard: NewTeamWizard,
  overrides?: Partial<Omit<AddMembersWizard, 'teamID'>>
): AddMembersWizard =>
  makeAddMembersWizard(T.Teams.newTeamWizardTeamID, {
    newTeamWizard: wizard,
    ...overrides,
  })

export const createNewTeamFromWizard = async (
  wizard: NewTeamWizard,
  addingMembers: ReadonlyArray<T.Teams.AddingMember>
) => {
  const {name, description, open, openTeamJoinRole, profileShowcase, addYourself} = wizard
  const {avatarFilename, avatarCrop, channels, subteams} = wizard
  const teamInfo: T.RPCGen.TeamCreateFancyInfo = {
    avatar: avatarFilename
      ? {avatarFilename, ...(avatarCrop?.crop ? {crop: avatarCrop.crop} : {})}
      : null,
    ...(channels === undefined ? {} : {chatChannels: channels}),
    description,
    joinSubteam: addYourself,
    name,
    openSettings: {joinAs: T.RPCGen.TeamRole[openTeamJoinRole], open},
    profileShowcase,
    ...(subteams === undefined ? {} : {subteams}),
    users: addingMembers.map(member => ({
      assertion: member.assertion,
      role: T.RPCGen.TeamRole[member.role],
    })),
  }
  return T.RPCGen.teamsTeamCreateFancyRpcPromise({teamInfo}, C.waitingKeyTeamsCreation)
}

export const getNextRouteAfterAvatar = (wizard: NewTeamWizard, parentTeamMemberCount: number) => {
  switch (wizard.teamType) {
    case 'subteam':
      return parentTeamMemberCount > 1
        ? {name: 'teamWizardSubteamMembers' as const, params: {wizard}}
        : {
            name: 'teamAddToTeamFromWhere' as const,
            params: {wizard: newTeamWizardToAddMembersWizard(wizard)},
          }
    case 'friends':
    case 'other':
      return {
        name: 'teamAddToTeamFromWhere' as const,
        params: {wizard: newTeamWizardToAddMembersWizard(wizard)},
      }
    case 'project':
      return {name: 'teamWizard5Channels' as const, params: {wizard}}
    case 'community':
      return {name: 'teamWizard4TeamSize' as const, params: {wizard}}
  }
}
