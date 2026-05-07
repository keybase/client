import type * as T from '@/constants/types'

const subteamsCannotHaveOwners = {owner: 'Subteams cannot have owners.'}
const onlyOwnersCanTurnTeamMembersIntoOwners = {owner: 'Only owners can turn team members into owners.'}
const roleChangeSub = {
  admin: 'You must be at least an admin to make role changes.',
  owner: 'Subteams cannot have owners.',
  reader: 'You must be at least an admin to make role changes.',
  writer: 'You must be at least an admin to make role changes.',
}
const roleChangeNotSub = {
  admin: 'You must be at least an admin to make role changes.',
  owner: 'You must be at least an admin to make role changes.',
  reader: 'You must be at least an admin to make role changes.',
  writer: 'You must be at least an admin to make role changes.',
}
const anotherRoleChangeSub = {
  admin: `Only owners can change another owner's role`,
  owner: 'Subteams cannot have owners.',
  reader: `Only owners can change another owner's role`,
  writer: `Only owners can change another owner's role`,
}
const anotherRoleChangeNotSub = {
  admin: `Only owners can change another owner's role`,
  owner: `Only owners can change another owner's role`,
  reader: `Only owners can change another owner's role`,
  writer: `Only owners can change another owner's role`,
}
const notOwnerSub = {owner: 'Subteams cannot have owners.'}
const notOwnerNotSub = {owner: `Only owners can turn members into owners`}
const noRemoveLastOwner = {
  admin: `You can't demote a team's last owner`,
  reader: `You can't demote a team's last owner`,
  writer: `You can't demote a team's last owner`,
}
const emptyDisabledReasons = {}

const isSubteam = (teamname: string) => teamname.split('.').length > 1

const noOtherOwnersAfterModification = (
  members: ReadonlyMap<string, T.Teams.MemberInfo>,
  currentUsername: string,
  membersToModify?: string | string[]
) => {
  let noOtherOwners = true
  members.forEach(({type}, name) => {
    if (name !== currentUsername && type === 'owner') {
      if (typeof membersToModify === 'string' || !membersToModify?.includes(name)) {
        noOtherOwners = false
      }
    }
  })
  return noOtherOwners
}

export const isLastOwnerInTeamMembers = (
  members: ReadonlyMap<string, T.Teams.MemberInfo>,
  currentUsername: string
) => {
  if (members.get(currentUsername)?.type !== 'owner') {
    return false
  }
  let ownerCount = 0
  return ![...members.values()].some(member => {
    if (member.type === 'owner') {
      ownerCount++
    }
    return ownerCount > 1
  })
}

export const getRolePickerDisabledReasons = ({
  canManageMembers,
  currentUsername,
  members,
  membersToModify,
  teamname,
}: {
  canManageMembers: boolean
  currentUsername: string
  members: ReadonlyMap<string, T.Teams.MemberInfo>
  membersToModify?: string | string[]
  teamname: string
}): T.Teams.DisabledReasonsForRolePicker => {
  let theyAreOwner = false
  if (typeof membersToModify === 'string') {
    theyAreOwner = members.get(membersToModify)?.type === 'owner'
  } else if (Array.isArray(membersToModify)) {
    theyAreOwner = membersToModify.some(username => members.get(username)?.type === 'owner')
  }

  const yourRole = members.get(currentUsername)?.type ?? 'reader'

  if (canManageMembers) {
    if (isSubteam(teamname)) {
      return subteamsCannotHaveOwners
    }
    if (yourRole !== 'owner') {
      return theyAreOwner
        ? isSubteam(teamname)
          ? anotherRoleChangeSub
          : anotherRoleChangeNotSub
        : onlyOwnersCanTurnTeamMembersIntoOwners
    }
    const modifyingSelf =
      membersToModify === currentUsername ||
      (Array.isArray(membersToModify) && membersToModify.includes(currentUsername))
    if (modifyingSelf && noOtherOwnersAfterModification(members, currentUsername, membersToModify)) {
      return noRemoveLastOwner
    }
    return emptyDisabledReasons
  }

  if (yourRole !== 'owner' && yourRole !== 'admin') {
    return isSubteam(teamname) ? roleChangeSub : roleChangeNotSub
  }

  if (theyAreOwner && yourRole !== 'owner') {
    return isSubteam(teamname) ? anotherRoleChangeSub : anotherRoleChangeNotSub
  }

  if (yourRole !== 'owner') {
    return isSubteam(teamname) ? notOwnerSub : notOwnerNotSub
  }

  return emptyDisabledReasons
}
