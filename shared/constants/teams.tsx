import * as C from '.'
import * as T from './types'
import * as EngineGen from '../actions/engine-gen-gen'
import * as ProfileConstants from './profile'
import * as Router2Constants from './router2'
import * as Tabs from './tabs'
import * as Z from '@/util/zustand'
import invert from 'lodash/invert'
import logger from '@/logger'
import openSMS from '@/util/sms'
import {RPCError, logError} from '@/util/errors'
import {isMobile, isPhone} from './platform'
import {mapGetEnsureValue} from '@/util/map'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner'] as const

export const rpcMemberStatusToStatus = invert(T.RPCGen.TeamMemberStatus) as unknown as {
  [K in keyof typeof T.RPCGen.TeamMemberStatus as (typeof T.RPCGen.TeamMemberStatus)[K]]: K
}

// Waiting keys
// Add granularity as necessary
export const teamsLoadedWaitingKey = 'teams:loaded'
export const teamsAccessRequestWaitingKey = 'teams:accessRequests'
export const joinTeamWaitingKey = 'teams:joinTeam'
export const teamWaitingKey = (teamID: T.Teams.TeamID) => `team:${teamID}`

export const setMemberPublicityWaitingKey = (teamID: T.Teams.TeamID) => `teamMemberPub:${teamID}`
export const teamGetWaitingKey = (teamID: T.Teams.TeamID) => `teamGet:${teamID}`
export const teamTarsWaitingKey = (teamID: T.Teams.TeamID) => `teamTars:${teamID}`
export const teamCreationWaitingKey = 'teamCreate'

export const addUserToTeamsWaitingKey = (username: string) => `addUserToTeams:${username}`
export const addPeopleToTeamWaitingKey = (teamname: T.Teams.Teamname) => `teamAddPeople:${teamname}`
export const addToTeamByEmailWaitingKey = (teamname: T.Teams.Teamname) => `teamAddByEmail:${teamname}`
export const getChannelsWaitingKey = (teamID: T.Teams.TeamID) => `getChannels:${teamID}`
export const createChannelWaitingKey = (teamID: T.Teams.TeamID) => `createChannel:${teamID}`
export const settingsWaitingKey = (teamID: T.Teams.TeamID) => `teamSettings:${teamID}`
export const retentionWaitingKey = (teamID: T.Teams.TeamID) => `teamRetention:${teamID}`
export const addMemberWaitingKey = (teamID: T.Teams.TeamID, ...usernames: ReadonlyArray<string>) =>
  `teamAdd:${teamID};${usernames.join(',')}`
export const addInviteWaitingKey = (teamname: T.Teams.Teamname, value: string) =>
  `teamAddInvite:${teamname};${value}`
// also for pending invites, hence id rather than username
export const removeMemberWaitingKey = (teamID: T.Teams.TeamID, id: string) => `teamRemove:${teamID};${id}`
export const addToTeamSearchKey = 'addToTeamSearch'
export const teamProfileAddListWaitingKey = 'teamProfileAddList'
export const deleteChannelWaitingKey = (teamID: T.Teams.TeamID) => `channelDelete:${teamID}`
export const deleteTeamWaitingKey = (teamID: T.Teams.TeamID) => `teamDelete:${teamID}`
export const leaveTeamWaitingKey = (teamname: T.Teams.Teamname) => `teamLeave:${teamname}`
export const teamRenameWaitingKey = 'teams:rename'
export const loadWelcomeMessageWaitingKey = (teamID: T.Teams.TeamID) => `loadWelcomeMessage:${teamID}`
export const setWelcomeMessageWaitingKey = (teamID: T.Teams.TeamID) => `setWelcomeMessage:${teamID}`
export const loadTeamTreeActivityWaitingKey = (teamID: T.Teams.TeamID, username: string) =>
  `loadTeamTreeActivity:${teamID};${username}`
export const editMembershipWaitingKey = (teamID: T.Teams.TeamID, ...usernames: ReadonlyArray<string>) =>
  `editMembership:${teamID};${usernames.join(',')}`
export const updateChannelNameWaitingKey = (teamID: T.Teams.TeamID) => `updateChannelName:${teamID}`

export const initialMemberInfo = Object.freeze<T.Teams.MemberInfo>({
  fullName: '',
  needsPUK: false,
  status: 'active',
  type: 'reader',
  username: '',
})

export const rpcDetailsToMemberInfos = (
  members: ReadonlyArray<T.RPCGen.TeamMemberDetails>
): Map<string, T.Teams.MemberInfo> => {
  const infos: Array<[string, T.Teams.MemberInfo]> = []
  members.forEach(({fullName, joinTime, needsPUK, status, username, role}) => {
    const maybeRole = teamRoleByEnum[role]
    if (maybeRole === 'none') {
      return
    }
    infos.push([
      username,
      {
        fullName,
        joinTime: joinTime || undefined,
        needsPUK,
        status: rpcMemberStatusToStatus[status],
        type: maybeRole,
        username,
      },
    ])
  })
  return new Map(infos)
}

export const emptyInviteInfo = Object.freeze<T.Teams.InviteInfo>({
  email: '',
  id: '',
  name: '',
  phone: '',
  role: 'writer',
  username: '',
})

export const emptyEmailInviteError = Object.freeze<T.Teams.EmailInviteError>({
  malformed: new Set<string>(),
  message: '',
})

const emptyTeamChannelInfo: T.Teams.TeamChannelInfo = {
  channelname: '',
  conversationIDKey: '', // would be noConversationIDKey but causes import cycle
  description: '',
}

export const getTeamChannelInfo = (
  state: State,
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
) => state.channelInfo.get(teamID)?.get(conversationIDKey) ?? emptyTeamChannelInfo

export const teamRoleByEnum = invert(T.RPCGen.TeamRole) as unknown as {
  [K in keyof typeof T.RPCGen.TeamRole as (typeof T.RPCGen.TeamRole)[K]]: K
}

/* eslint-disable sort-keys */
const teamRoleToCompare = {
  owner: 6,
  admin: 5,
  writer: 4,
  reader: 3,
  bot: 2,
  restrictedbot: 1,
  none: 0,
}
/* eslint-enable sort-keys */
export const compareTeamRoles = (a: T.Teams.MaybeTeamRoleType, b: T.Teams.MaybeTeamRoleType) => {
  return teamRoleToCompare[b] - teamRoleToCompare[a]
}

/* eslint-disable sort-keys */
const activityLevelToCompare = {
  active: 2,
  recently: 1,
  none: 0,
}
/* eslint-enable sort-keys */
export const compareActivityLevels = (
  a: T.Teams.ActivityLevel | undefined,
  b: T.Teams.ActivityLevel | undefined
) => {
  return activityLevelToCompare[b || 'none'] - activityLevelToCompare[a || 'none']
}

export const rpcTeamRoleMapAndVersionToTeamRoleMap = (
  m: T.RPCGen.TeamRoleMapAndVersion
): T.Teams.TeamRoleMap => {
  const ret: T.Teams.TeamRoleMap = {
    latestKnownVersion: m.version,
    loadedVersion: m.version,
    roles: new Map<T.Teams.TeamID, T.Teams.TeamRoleAndDetails>(),
  }
  for (const key in m.teams) {
    const value = m.teams[key]
    if (value) {
      ret.roles.set(key, {
        implicitAdmin:
          value.implicitRole === T.RPCGen.TeamRole.admin || value.implicitRole === T.RPCGen.TeamRole.owner,
        role: teamRoleByEnum[value.role],
      })
    }
  }
  return ret
}

export const typeToLabel: T.Teams.TypeMap = {
  admin: 'Admin',
  bot: 'Bot',
  owner: 'Owner',
  reader: 'Reader',
  restrictedbot: 'Restricted bot',
  writer: 'Writer',
}

export const initialTeamSettings = Object.freeze({
  joinAs: T.RPCGen.TeamRole.reader,
  open: false,
})

export const makeRetentionPolicy = (
  r?: Partial<T.Retention.RetentionPolicy>
): T.Retention.RetentionPolicy => ({
  seconds: 0,
  title: '',
  type: 'retain',
  ...(r || {}),
})

export const addMembersWizardEmptyState: State['addMembersWizard'] = {
  addToChannels: undefined,
  addingMembers: [],
  justFinished: false,
  membersAlreadyInTeam: [],
  role: 'writer',
  teamID: T.Teams.noTeamID,
}

export const newTeamWizardEmptyState: State['newTeamWizard'] = {
  addYourself: true,
  description: '',
  isBig: false,
  name: '',
  open: false,
  openTeamJoinRole: 'reader',
  profileShowcase: false,
  teamType: 'other',
}

export const emptyErrorInEditMember = {error: '', teamID: T.Teams.noTeamID, username: ''}

export const initialCanUserPerform = Object.freeze<T.Teams.TeamOperations>({
  changeOpenTeam: false,
  changeTarsDisabled: false,
  chat: false,
  createChannel: false,
  deleteChannel: false,
  deleteChatHistory: false,
  deleteOtherEmojis: false,
  deleteOtherMessages: false,
  deleteTeam: false,
  editChannelDescription: false,
  editTeamDescription: false,
  joinTeam: false,
  listFirst: false,
  manageBots: false,
  manageEmojis: false,
  manageMembers: false,
  manageSubteams: false,
  pinMessage: false,
  renameChannel: false,
  renameTeam: false,
  setMinWriterRole: false,
  setPublicityAny: false,
  setRetentionPolicy: false,
  setTeamShowcase: false,
})

const dayInS = 3600 * 24
const policyInherit = makeRetentionPolicy({title: '', type: 'inherit'})
const policyRetain = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
const policyThirtySeconds = makeRetentionPolicy({seconds: 30, title: '30 seconds', type: 'explode'})
const policyFiveMinutes = makeRetentionPolicy({seconds: 5 * 60, title: '5 minutes', type: 'explode'})
const policyOneHour = makeRetentionPolicy({seconds: 3600, title: '60 minutes', type: 'explode'})
const policySixHours = makeRetentionPolicy({seconds: 3600 * 6, title: '6 hours', type: 'explode'})
const policyOneDay = makeRetentionPolicy({seconds: dayInS, title: '24 hours', type: 'explode'})
const policyThreeDays = makeRetentionPolicy({seconds: 3 * dayInS, title: '3 days', type: 'explode'})
const policySevenDays = makeRetentionPolicy({seconds: 7 * dayInS, title: '7 days', type: 'explode'})
const policyMonth = makeRetentionPolicy({seconds: 30 * dayInS, title: '30 days', type: 'expire'})
const policyThreeMonths = makeRetentionPolicy({seconds: 90 * dayInS, title: '90 days', type: 'expire'})
const policySixMonths = makeRetentionPolicy({seconds: 180 * dayInS, title: '180 days', type: 'expire'})
const policyYear = makeRetentionPolicy({seconds: 365 * dayInS, title: '365 days', type: 'expire'})
export const baseRetentionPolicies = [
  policyRetain,
  policyYear,
  policySixMonths,
  policyThreeMonths,
  policyMonth,
  policySevenDays,
  policyThreeDays,
  policyOneDay,
  policySixHours,
  policyOneHour,
  policyFiveMinutes,
  policyThirtySeconds,
]

const baseRetentionPoliciesTitleMap = baseRetentionPolicies.reduce<{[key: number]: string}>((map, p) => {
  map[p.seconds] = p.title
  return map
}, {})

export const retentionPolicies = {
  policyFiveMinutes,
  policyInherit,
  policyMonth,
  policyOneDay,
  policyOneHour,
  policyRetain,
  policySevenDays,
  policySixHours,
  policySixMonths,
  policyThirtySeconds,
  policyThreeDays,
  policyThreeMonths,
  policyYear,
}

export const userIsRoleInTeamWithInfo = (
  memberInfo: ReadonlyMap<string, T.Teams.MemberInfo>,
  username: string,
  role: T.Teams.TeamRoleType
): boolean => {
  const member = memberInfo.get(username)
  if (!member) {
    return false
  }
  return member.type === role
}

export const userIsRoleInTeam = (
  state: State,
  teamID: T.Teams.TeamID,
  username: string,
  role: T.Teams.TeamRoleType
): boolean => {
  return userIsRoleInTeamWithInfo(
    state.teamIDToMembers.get(teamID) || new Map<string, T.Teams.MemberInfo>(),
    username,
    role
  )
}
export const isBot = (type: T.Teams.TeamRoleType) => type === 'bot' || type === 'restrictedbot'
export const userInTeamNotBotWithInfo = (
  memberInfo: ReadonlyMap<string, T.Teams.MemberInfo>,
  username: string
): boolean => {
  const memb = memberInfo.get(username)
  if (!memb) {
    return false
  }
  return !isBot(memb.type)
}

export const isTeamWithChosenChannels = (state: State, teamname: string): boolean =>
  state.teamsWithChosenChannels.has(teamname)

export const getRole = (state: State, teamID: T.Teams.TeamID): T.Teams.MaybeTeamRoleType =>
  state.teamRoleMap.roles.get(teamID)?.role || 'none'

export const getRoleByName = (state: State, teamname: string): T.Teams.MaybeTeamRoleType =>
  getRole(state, getTeamID(state, teamname))

export const isLastOwner = (state: State, teamID: T.Teams.TeamID): boolean =>
  isOwner(getRole(state, teamID)) && !isMultiOwnerTeam(state, teamID)

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
const emptyObj = {}
const noRemoveLastOwner = {
  admin: `You can't demote a team's last owner`,
  reader: `You can't demote a team's last owner`,
  writer: `You can't demote a team's last owner`,
}

export const getDisabledReasonsForRolePicker = (
  state: State,
  teamID: T.Teams.TeamID,
  membersToModify?: string | string[]
): T.Teams.DisabledReasonsForRolePicker => {
  const canManageMembers = getCanPerformByID(state, teamID).manageMembers
  const teamMeta = getTeamMeta(state, teamID)
  const teamDetails = _useState.getState().teamDetails.get(teamID)
  const members: ReadonlyMap<string, T.Teams.MemberInfo> =
    teamDetails?.members || state.teamIDToMembers.get(teamID) || new Map<string, T.Teams.MemberInfo>()
  const teamname = teamMeta.teamname
  let theyAreOwner = false
  if (typeof membersToModify === 'string') {
    const member = members.get(membersToModify)
    theyAreOwner = member?.type === 'owner'
  } else if (Array.isArray(membersToModify)) {
    theyAreOwner = membersToModify.some(username => members.get(username)?.type === 'owner')
  }

  const myUsername = C.useCurrentUserState.getState().username
  const you = members.get(myUsername)
  // Fallback to the lowest role, although this shouldn't happen
  const yourRole = you?.type ?? 'reader'

  if (canManageMembers) {
    // If you're an implicit admin, the tests below will fail for you, but you can still change roles.
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
      membersToModify === myUsername ||
      (Array.isArray(membersToModify) && membersToModify.includes(myUsername))
    let noOtherOwners = true as boolean
    members.forEach(({type}, name) => {
      if (name !== myUsername && type === 'owner') {
        if (typeof membersToModify === 'string' || !membersToModify?.includes(name)) {
          noOtherOwners = false
        }
      }
    })

    if (modifyingSelf && noOtherOwners) {
      return noRemoveLastOwner
    }
    return emptyObj
  }

  // We shouldn't get here, but in case we do this is correct.
  if (yourRole !== 'owner' && yourRole !== 'admin') {
    return isSubteam(teamname) ? roleChangeSub : roleChangeNotSub
  }

  // We shouldn't get here, but in case we do this is correct.
  if (theyAreOwner && yourRole !== 'owner') {
    return isSubteam(teamname) ? anotherRoleChangeSub : anotherRoleChangeNotSub
  }

  // We shouldn't get here, but in case we do this is correct.
  if (yourRole !== 'owner') {
    return isSubteam(teamname) ? notOwnerSub : notOwnerNotSub
  }

  return {}
}

const isMultiOwnerTeam = (state: State, teamID: T.Teams.TeamID): boolean => {
  let countOfOwners = 0
  const allTeamMembers = state.teamDetails.get(teamID)?.members || new Map<string, T.Teams.MemberInfo>()
  const moreThanOneOwner = [...allTeamMembers.values()].some(tm => {
    if (isOwner(tm.type)) {
      countOfOwners++
    }
    return countOfOwners > 1
  })
  return moreThanOneOwner
}

export const getTeamID = (state: State, teamname: T.Teams.Teamname) =>
  state.teamNameToID.get(teamname) || T.Teams.noTeamID

export const getTeamNameFromID = (state: State, teamID: T.Teams.TeamID) =>
  state.teamMeta.get(teamID)?.teamname

export const getTeamRetentionPolicyByID = (state: State, teamID: T.Teams.TeamID) =>
  state.teamIDToRetentionPolicy.get(teamID)

/**
 *  Gets the number of channels you're subscribed to on a team
 */

export const initialPublicitySettings = Object.freeze<T.Teams._PublicitySettings>({
  anyMemberShowcase: false,
  description: '',
  ignoreAccessRequests: false,
  member: false,
  team: false,
})

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

export const isInTeam = (state: State, teamname: T.Teams.Teamname): boolean =>
  getRoleByName(state, teamname) !== 'none'

export const isInSomeTeam = (state: State): boolean =>
  [...state.teamRoleMap.roles.values()].some(rd => rd.role !== 'none')

export const getTeamResetUsers = (state: State, teamID: T.Teams.TeamID): ReadonlySet<string> =>
  state.teamIDToResetUsers.get(teamID) ?? new Set()

// Sorts teamnames canonically.
export function sortTeamnames(a: string, b: string) {
  const aName = a.toUpperCase()
  const bName = b.toUpperCase()
  if (aName < bName) {
    return -1
  } else if (aName > bName) {
    return 1
  } else {
    return 0
  }
}

export const sortTeamsByName = (teamMeta: ReadonlyMap<T.Teams.TeamID, T.Teams.TeamMeta>) =>
  [...teamMeta.values()].sort((a, b) => sortTeamnames(a.teamname, b.teamname))

export const isAdmin = (type: T.Teams.MaybeTeamRoleType) => type === 'admin'
export const isOwner = (type: T.Teams.MaybeTeamRoleType) => type === 'owner'

// TODO make this check for only valid subteam names
export const isSubteam = (maybeTeamname: string) => {
  const subteams = maybeTeamname.split('.')
  if (subteams.length <= 1) {
    return false
  }
  return true
}
export const serviceRetentionPolicyToRetentionPolicy = (
  policy?: T.RPCChat.RetentionPolicy | null
): T.Retention.RetentionPolicy => {
  // !policy implies a default policy of retainment
  let retentionPolicy: T.Retention.RetentionPolicy = makeRetentionPolicy({type: 'retain'})
  if (policy) {
    // replace retentionPolicy with whatever is explicitly set
    switch (policy.typ) {
      case T.RPCChat.RetentionPolicyType.retain:
        retentionPolicy = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
        break
      case T.RPCChat.RetentionPolicyType.expire: {
        const {expire} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: expire.age,
          title: baseRetentionPoliciesTitleMap[expire.age] || `${expire.age} seconds`,
          type: 'expire',
        })
        break
      }
      case T.RPCChat.RetentionPolicyType.ephemeral: {
        const {ephemeral} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: ephemeral.age,
          title: baseRetentionPoliciesTitleMap[ephemeral.age] || `${ephemeral.age} seconds`,
          type: 'explode',
        })
        break
      }
      case T.RPCChat.RetentionPolicyType.inherit:
        retentionPolicy = makeRetentionPolicy({type: 'inherit'})
        break
      default:
    }
  }
  return retentionPolicy
}

export const retentionPolicyToServiceRetentionPolicy = (
  policy: T.Retention.RetentionPolicy
): T.RPCChat.RetentionPolicy => {
  switch (policy.type) {
    case 'retain':
      return {retain: {}, typ: T.RPCChat.RetentionPolicyType.retain}
    case 'expire':
      return {expire: {age: policy.seconds}, typ: T.RPCChat.RetentionPolicyType.expire}
    case 'explode':
      return {ephemeral: {age: policy.seconds}, typ: T.RPCChat.RetentionPolicyType.ephemeral}
    case 'inherit':
      return {inherit: {}, typ: T.RPCChat.RetentionPolicyType.inherit}
  }
}

// How many public admins should we display on a showcased team card at once?
export const publicAdminsLimit = 6

export const chosenChannelsGregorKey = 'chosenChannelsForTeam'
export const newRequestsGregorPrefix = 'team.request_access:'
export const newRequestsGregorKey = (teamID: T.Teams.TeamID) => `${newRequestsGregorPrefix}${teamID}`

// Merge new teamMeta objs into old ones, removing any old teams that are not in the new map
export const mergeTeamMeta = (oldMap: State['teamMeta'], newMap: State['teamMeta']) => {
  const ret = new Map(newMap)
  for (const [teamID, teamMeta] of newMap.entries()) {
    ret.set(teamID, {...oldMap.get(teamID), ...teamMeta})
  }
  return ret
}

export const emptyTeamMeta = Object.freeze<T.Teams.TeamMeta>({
  allowPromote: false,
  id: T.Teams.noTeamID,
  isMember: false,
  isOpen: false,
  memberCount: -1,
  role: 'none',
  showcasing: false,
  teamname: '',
})

export const makeTeamMeta = (td: Partial<T.Teams.TeamMeta>): T.Teams.TeamMeta => ({...emptyTeamMeta, ...td})

export const getTeamMeta = (state: State, teamID: T.Teams.TeamID) =>
  teamID === T.Teams.newTeamWizardTeamID
    ? makeTeamMeta({
        id: teamID,
        isMember: true,
        isOpen: state.newTeamWizard.open,
        memberCount: 0,
        showcasing: state.newTeamWizard.profileShowcase,
        teamname: state.newTeamWizard.name === '' ? 'New team' : state.newTeamWizard.name,
      })
    : state.teamMeta.get(teamID) ?? emptyTeamMeta

export const getTeamMemberLastActivity = (
  state: State,
  teamID: T.Teams.TeamID,
  username: string
): number | null => state.teamMemberToLastActivity.get(teamID)?.get(username) ?? null

export const teamListToMeta = (
  list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>
): Map<T.Teams.TeamID, T.Teams.TeamMeta> => {
  return new Map(
    list.map(t => [
      t.teamID,
      {
        allowPromote: t.allowProfilePromote,
        id: t.teamID,
        isMember: t.role !== T.RPCGen.TeamRole.none,
        isOpen: t.isOpenTeam,
        memberCount: t.memberCount,
        role: teamRoleByEnum[t.role],
        showcasing: t.isMemberShowcased,
        teamname: t.fqName,
      },
    ])
  )
}

type InviteDetails = {inviteLinks: ReadonlyArray<T.Teams.InviteLink>; invites: Set<T.Teams.InviteInfo>}
type InviteDetailsMutable = {inviteLinks: Array<T.Teams.InviteLink>; invites: Set<T.Teams.InviteInfo>}
const annotatedInvitesToInviteDetails = (
  annotatedInvites: ReadonlyArray<T.RPCGen.AnnotatedTeamInvite> = []
): InviteDetails =>
  annotatedInvites.reduce<InviteDetailsMutable>(
    (invitesAndLinks, annotatedInvite) => {
      const inviteMD = annotatedInvite.inviteMetadata
      const teamInvite = inviteMD.invite

      const {invites, inviteLinks} = invitesAndLinks
      const role = teamRoleByEnum[teamInvite.role]
      if (role === 'none') {
        return invitesAndLinks
      }

      if (annotatedInvite.inviteExt.c === T.RPCGen.TeamInviteCategory.invitelink) {
        const ext = annotatedInvite.inviteExt.invitelink
        const annotatedUsedInvites = ext.annotatedUsedInvites ?? []
        const lastJoinedUsername = annotatedUsedInvites.at(-1)?.username
        inviteLinks.push({
          creatorUsername: annotatedInvite.inviterUsername,
          id: teamInvite.id,
          isValid: annotatedInvite.isValid,
          lastJoinedUsername,
          numUses: annotatedUsedInvites.length,
          role,
          url: annotatedInvite.displayName,
          validityDescription: annotatedInvite.validityDescription,
        })
      } else {
        // skip invalid invites for non-invitelinks
        if (!annotatedInvite.isValid) {
          return invitesAndLinks
        }

        let username = ''
        if (teamInvite.type.c === T.RPCGen.TeamInviteCategory.sbs) {
          username = annotatedInvite.displayName
        }
        invites.add({
          email: teamInvite.type.c === T.RPCGen.TeamInviteCategory.email ? annotatedInvite.displayName : '',
          id: teamInvite.id,
          name: [T.RPCGen.TeamInviteCategory.seitan].includes(teamInvite.type.c)
            ? annotatedInvite.displayName
            : '',
          phone: teamInvite.type.c === T.RPCGen.TeamInviteCategory.phone ? annotatedInvite.displayName : '',
          role,
          username,
        })
      }
      return invitesAndLinks
    },
    {inviteLinks: [], invites: new Set()}
  )

export const emptyTeamDetails: T.Teams.TeamDetails = {
  description: '',
  inviteLinks: [],
  invites: new Set(),
  members: new Map(),
  requests: new Set(),
  settings: {open: false, openJoinAs: 'reader', tarsDisabled: false, teamShowcased: false},
  subteams: new Set(),
}

export const emptyTeamSettings = Object.freeze(emptyTeamDetails.settings)

export const annotatedTeamToDetails = (t: T.RPCGen.AnnotatedTeam): T.Teams.TeamDetails => {
  const maybeOpenJoinAs = teamRoleByEnum[t.settings.joinAs]
  const members = new Map<string, T.Teams.MemberInfo>()
  t.members?.forEach(member => {
    const {fullName, needsPUK, status, username} = member
    const maybeRole = teamRoleByEnum[member.role]
    members.set(username, {
      fullName,
      joinTime: member.joinTime || undefined,
      needsPUK,
      status: rpcMemberStatusToStatus[status],
      type: maybeRole === 'none' ? 'reader' : maybeRole,
      username,
    })
  })
  return {
    ...annotatedInvitesToInviteDetails(t.invites ?? undefined),
    description: t.showcase.description ?? '',
    members,
    requests: t.joinRequests ? new Set(t.joinRequests) : new Set(),
    settings: {
      open: !!t.settings.open,
      openJoinAs: maybeOpenJoinAs === 'none' ? 'reader' : maybeOpenJoinAs,
      tarsDisabled: t.tarsDisabled,
      teamShowcased: t.showcase.isShowcased,
    },
    subteams: new Set(t.transitiveSubteamsUnverified.entries?.map(e => e.teamID) ?? []),
  }
}

// Keep in sync with constants/notifications#badgeStateToBadgeCounts
// Don't count new team because those are shown with a 'NEW' meta instead of badge
export const getTeamRowBadgeCount = (
  newTeamRequests: Store['newTeamRequests'],
  teamIDToResetUsers: Store['teamIDToResetUsers'],
  teamID: T.Teams.TeamID
) => {
  return newTeamRequests.get(teamID)?.size ?? 0 + (teamIDToResetUsers.get(teamID)?.size ?? 0)
}

export const canShowcase = (state: State, teamID: T.Teams.TeamID) => {
  const role = getRole(state, teamID)
  return getTeamMeta(state, teamID).allowPromote || role === 'admin' || role === 'owner'
}

const _canUserPerformCache: {[key: string]: T.Teams.TeamOperations} = {}
const _canUserPerformCacheKey = (t: T.Teams.TeamRoleAndDetails) => t.role + t.implicitAdmin
export const deriveCanPerform = (roleAndDetails?: T.Teams.TeamRoleAndDetails): T.Teams.TeamOperations => {
  if (!roleAndDetails) {
    // can happen if an empty teamID was passed to a getter
    return initialCanUserPerform
  }

  const ck = _canUserPerformCacheKey(roleAndDetails)
  if (_canUserPerformCache[ck]) return _canUserPerformCache[ck]!

  const {role, implicitAdmin} = roleAndDetails
  const isAdminOrAbove = role === 'admin' || role === 'owner'
  const isWriterOrAbove = role === 'writer' || isAdminOrAbove
  const isBotOrAbove = role === 'bot' || role === 'reader' || isWriterOrAbove

  const canPerform = {
    changeOpenTeam: isAdminOrAbove || implicitAdmin,
    changeTarsDisabled: isAdminOrAbove || implicitAdmin,
    chat: isBotOrAbove,
    createChannel: isWriterOrAbove,
    deleteChannel: isAdminOrAbove,
    deleteChatHistory: isAdminOrAbove,
    deleteOtherEmojis: isAdminOrAbove,
    deleteOtherMessages: isAdminOrAbove,
    deleteTeam: role === 'owner' || implicitAdmin, // role = owner for root teams, otherwise implicitAdmin
    editChannelDescription: isWriterOrAbove,
    editTeamDescription: isAdminOrAbove || implicitAdmin,
    joinTeam: role === 'none' && implicitAdmin,
    listFirst: implicitAdmin,
    manageBots: isAdminOrAbove || implicitAdmin,
    manageEmojis: isWriterOrAbove,
    manageMembers: isAdminOrAbove || implicitAdmin,
    manageSubteams: isAdminOrAbove || implicitAdmin,
    pinMessage: isWriterOrAbove,
    renameChannel: isWriterOrAbove,
    renameTeam: implicitAdmin,
    setMemberShowcase: false, // TODO remove, depends on team publicity settings
    setMinWriterRole: isAdminOrAbove,
    setPublicityAny: isAdminOrAbove || implicitAdmin,
    setRetentionPolicy: isAdminOrAbove,
    setTeamShowcase: isAdminOrAbove,
  }
  _canUserPerformCache[ck] = canPerform
  return canPerform
}

export const getCanPerform = (state: State, teamname: T.Teams.Teamname): T.Teams.TeamOperations =>
  getCanPerformByID(state, getTeamID(state, teamname))

export const getCanPerformByID = (state: State, teamID: T.Teams.TeamID): T.Teams.TeamOperations =>
  deriveCanPerform(state.teamRoleMap.roles.get(teamID))

// Don't allow version to roll back
export const ratchetTeamVersion = (newVersion: T.Teams.TeamVersion, oldVersion?: T.Teams.TeamVersion) =>
  oldVersion
    ? {
        latestHiddenSeqno: Math.max(newVersion.latestHiddenSeqno, oldVersion.latestHiddenSeqno),
        latestOffchainSeqno: Math.max(newVersion.latestOffchainSeqno, oldVersion.latestOffchainSeqno),
        latestSeqno: Math.max(newVersion.latestSeqno, oldVersion.latestSeqno),
      }
    : newVersion

export const dedupAddingMembeers = (
  _existing: ReadonlyArray<T.Teams.AddingMember>,
  toAdds: ReadonlyArray<T.Teams.AddingMember>
) => {
  const existing = [..._existing]
  for (const toAdd of toAdds) {
    if (!existing.find(m => m.assertion === toAdd.assertion)) {
      existing.unshift(toAdd)
    }
  }
  return existing
}

export const coerceAssertionRole = (mem: T.Teams.AddingMember): T.Teams.AddingMember => {
  if (mem.assertion.includes('@') && ['admin, owner'].includes(mem.role)) {
    return {...mem, role: 'writer'}
  }
  return mem
}

export const lastActiveStatusToActivityLevel: {
  [key in T.RPCChat.LastActiveStatus]: T.Teams.ActivityLevel
} = {
  [T.RPCChat.LastActiveStatus.active]: 'active',
  [T.RPCChat.LastActiveStatus.none]: 'none',
  [T.RPCChat.LastActiveStatus.recentlyActive]: 'recently',
}

export const stringifyPeople = (people: string[]): string => {
  switch (people.length) {
    case 0:
      return 'nobody'
    case 1:
      return people[0]!
    case 2:
      return `${people[0]!} and ${people[1]!}`
    case 3:
      return `${people[0]!}, ${people[1]!} and ${people[2]!}`
    default:
      return `${people[0] ?? ''}, ${people[1] ?? ''}, and ${people.length - 2} others`
  }
}

export const consumeTeamTreeMembershipValue = (
  value: T.RPCGen.TeamTreeMembershipValue
): T.Teams.TreeloaderSparseMemberInfo => {
  return {
    joinTime: value.joinTime ?? undefined,
    type: teamRoleByEnum[value.role],
  }
}

// maybeGetSparseMemberInfo first looks in the details, which should be kept up-to-date, then looks
// in the treeloader-powered map (which can go stale) as a backup. If it returns null, it means we
// don't know the answer (yet). If it returns type='none', that means the user is not in the team.
export const maybeGetSparseMemberInfo = (state: State, teamID: string, username: string) => {
  const details = _useState.getState().teamDetails.get(teamID)
  if (details) {
    return details.members.get(username) ?? {type: 'none'}
  }
  return state.treeLoaderTeamIDToSparseMemberInfos.get(teamID)?.get(username)
}

export const countValidInviteLinks = (inviteLinks: ReadonlyArray<T.Teams.InviteLink>): number => {
  return inviteLinks.reduce((t, inviteLink) => {
    if (inviteLink.isValid) {
      return t + 1
    }
    return t
  }, 0)
}

export const maybeGetMostRecentValidInviteLink = (inviteLinks: ReadonlyArray<T.Teams.InviteLink>) =>
  inviteLinks.find(inviteLink => inviteLink.isValid)

export type Store = T.Immutable<{
  activityLevels: T.Teams.ActivityLevels
  addUserToTeamsResults: string
  addUserToTeamsState: T.Teams.AddUserToTeamsState
  channelInfo: Map<T.Teams.TeamID, Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>>
  channelSelectedMembers: Map<T.Chat.ConversationIDKey, Set<string>>
  creatingChannels: boolean
  deletedTeams: Array<T.RPCGen.DeletedTeamInfo>
  errorInAddToTeam: string
  errorInChannelCreation: string
  errorInEditDescription: string
  errorInEditMember: {error: string; teamID: T.Teams.TeamID; username: string}
  errorInEditWelcomeMessage: string
  errorInEmailInvite: T.Teams.EmailInviteError
  errorInSettings: string
  newTeamRequests: Map<T.Teams.TeamID, Set<string>>
  newTeams: Set<T.Teams.TeamID>
  teamIDToResetUsers: Map<T.Teams.TeamID, Set<string>>
  teamIDToWelcomeMessage: Map<T.Teams.TeamID, T.RPCChat.WelcomeMessageDisplay>
  teamNameToLoadingInvites: Map<T.Teams.Teamname, Map<string, boolean>>
  errorInTeamCreation: string
  teamNameToID: Map<T.Teams.Teamname, string>
  teamMetaSubscribeCount: number // if >0 we are eagerly reloading team list
  teamnames: Set<T.Teams.Teamname> // TODO remove
  teamMetaStale: boolean // if we've received an update since we last loaded team list
  teamMeta: Map<T.Teams.TeamID, T.Teams.TeamMeta>
  invitesCollapsed: Set<T.Teams.TeamID>
  teamsWithChosenChannels: Set<T.Teams.Teamname>
  teamRoleMap: T.Teams.TeamRoleMap
  sawChatBanner: boolean
  sawSubteamsBanner: boolean
  subteamFilter: string
  subteamsFiltered: Set<T.Teams.TeamID> | undefined
  teamDetails: Map<T.Teams.TeamID, T.Teams.TeamDetails>
  teamDetailsSubscriptionCount: Map<T.Teams.TeamID, number> // >0 if we are eagerly reloading a team
  teamSelectedChannels: Map<T.Teams.TeamID, Set<string>>
  teamSelectedMembers: Map<T.Teams.TeamID, Set<string>>
  teamAccessRequestsPending: Set<T.Teams.Teamname>
  teamListFilter: string
  teamListSort: T.Teams.TeamListSort
  newTeamWizard: T.Teams.NewTeamWizardState
  addMembersWizard: T.Teams.AddMembersWizardState
  errorInTeamJoin: string
  teamInviteDetails: T.Teams.TeamInviteState
  teamJoinSuccess: boolean
  teamJoinSuccessOpen: boolean
  teamJoinSuccessTeamName: string
  teamVersion: Map<T.Teams.TeamID, T.Teams.TeamVersion>
  teamIDToMembers: Map<T.Teams.TeamID, Map<string, T.Teams.MemberInfo>> // Used by chat sidebar until team loading gets easier
  teamIDToRetentionPolicy: Map<T.Teams.TeamID, T.Retention.RetentionPolicy>
  treeLoaderTeamIDToSparseMemberInfos: Map<T.Teams.TeamID, Map<string, T.Teams.TreeloaderSparseMemberInfo>>
  teamMemberToTreeMemberships: Map<T.Teams.TeamID, Map<string, T.Teams.TeamTreeMemberships>>
  teamMemberToLastActivity: Map<T.Teams.TeamID, Map<string, number>>
  teamProfileAddList: Array<T.Teams.TeamProfileAddList>
}>

const initialStore: Store = {
  activityLevels: {channels: new Map(), loaded: false, teams: new Map()},
  addMembersWizard: addMembersWizardEmptyState,
  addUserToTeamsResults: '',
  addUserToTeamsState: 'notStarted',
  channelInfo: new Map(),
  channelSelectedMembers: new Map(),
  creatingChannels: false,
  deletedTeams: [],
  errorInAddToTeam: '',
  errorInChannelCreation: '',
  errorInEditDescription: '',
  errorInEditMember: emptyErrorInEditMember,
  errorInEditWelcomeMessage: '',
  errorInEmailInvite: emptyEmailInviteError,
  errorInSettings: '',
  errorInTeamCreation: '',
  errorInTeamJoin: '',
  invitesCollapsed: new Set(),
  newTeamRequests: new Map(),
  newTeamWizard: newTeamWizardEmptyState,
  newTeams: new Set(),
  sawChatBanner: false,
  sawSubteamsBanner: false,
  subteamFilter: '',
  subteamsFiltered: undefined,
  teamAccessRequestsPending: new Set(),
  teamDetails: new Map(),
  teamDetailsSubscriptionCount: new Map(),
  teamIDToMembers: new Map(),
  teamIDToResetUsers: new Map(),
  teamIDToRetentionPolicy: new Map(),
  teamIDToWelcomeMessage: new Map(),
  teamInviteDetails: {inviteID: '', inviteKey: ''},
  teamJoinSuccess: false,
  teamJoinSuccessOpen: false,
  teamJoinSuccessTeamName: '',
  teamListFilter: '',
  teamListSort: 'role',
  teamMemberToLastActivity: new Map(),
  teamMemberToTreeMemberships: new Map(),
  teamMeta: new Map(),
  teamMetaStale: true, // start out true, we have not loaded
  teamMetaSubscribeCount: 0,
  teamNameToID: new Map(),
  teamNameToLoadingInvites: new Map(),
  teamProfileAddList: [],
  teamRoleMap: {latestKnownVersion: -1, loadedVersion: -1, roles: new Map()},
  teamSelectedChannels: new Map(),
  teamSelectedMembers: new Map(),
  teamVersion: new Map(),
  teamnames: new Set(),
  teamsWithChosenChannels: new Set(),
  treeLoaderTeamIDToSparseMemberInfos: new Map(),
}

export interface State extends Store {
  dispatch: {
    dynamic: {
      respondToInviteLink?: (accept: boolean) => void
    }
    addMembersWizardPushMembers: (members: Array<T.Teams.AddingMember>) => void
    addMembersWizardRemoveMember: (assertion: string) => void
    addMembersWizardSetDefaultChannels: (
      toAdd?: ReadonlyArray<T.Teams.ChannelNameID>,
      toRemove?: T.Teams.ChannelNameID
    ) => void
    addTeamWithChosenChannels: (teamID: T.Teams.TeamID) => void
    addToTeam: (
      teamID: T.Teams.TeamID,
      users: Array<{assertion: string; role: T.Teams.TeamRoleType}>,
      sendChatNotification: boolean,
      fromTeamBuilder?: boolean
    ) => void
    addUserToTeams: (role: T.Teams.TeamRoleType, teams: Array<string>, user: string) => void
    cancelAddMembersWizard: () => void
    channelSetMemberSelected: (
      conversationIDKey: T.Chat.ConversationIDKey,
      username: string,
      selected: boolean,
      clearAll?: boolean
    ) => void
    checkRequestedAccess: (teamname: string) => void
    clearAddUserToTeamsResults: () => void
    clearNavBadges: () => void
    createChannel: (p: {
      teamID: T.Teams.TeamID
      channelname: string
      description?: string
      navToChatOnSuccess: boolean
    }) => void
    createChannels: (teamID: T.Teams.TeamID, channelnames: Array<string>) => void
    createNewTeam: (
      teamname: string,
      joinSubteam: boolean,
      fromChat?: boolean,
      thenAddMembers?: {
        users: Array<{assertion: string; role: T.Teams.TeamRoleType}>
        sendChatNotification: boolean
        fromTeamBuilder?: boolean
      }
    ) => void
    createNewTeamFromConversation: (conversationIDKey: T.Chat.ConversationIDKey, teamname: string) => void
    deleteChannelConfirmed: (teamID: T.Teams.TeamID, conversationIDKey: T.Chat.ConversationIDKey) => void
    deleteMultiChannelsConfirmed: (teamID: T.Teams.TeamID, channels: Array<T.Chat.ConversationIDKey>) => void
    deleteTeam: (teamID: T.Teams.TeamID) => void
    eagerLoadTeams: () => void
    editMembership: (teamID: T.Teams.TeamID, usernames: Array<string>, role: T.Teams.TeamRoleType) => void
    editTeamDescription: (teamID: T.Teams.TeamID, description: string) => void
    finishNewTeamWizard: () => void
    finishedAddMembersWizard: () => void
    getActivityForTeams: () => void
    getMembers: (teamID: T.Teams.TeamID) => void
    getTeamRetentionPolicy: (teamID: T.Teams.TeamID) => void
    getTeams: (subscribe?: boolean, forceReload?: boolean) => void
    getTeamProfileAddList: (username: string) => void
    ignoreRequest: (teamID: T.Teams.TeamID, teamname: string, username: string) => void
    inviteToTeamByEmail: (
      invitees: string,
      role: T.Teams.TeamRoleType,
      teamID: T.Teams.TeamID,
      teamname: string,
      loadingKey?: string
    ) => void
    inviteToTeamByPhone: (
      teamID: T.Teams.TeamID,
      teamname: string,
      role: T.Teams.TeamRoleType,
      phoneNumber: string,
      fullName: string,
      loadingKey?: string
    ) => void
    joinTeam: (teamname: string, deeplink?: boolean) => void
    launchNewTeamWizardOrModal: (subteamOf?: T.Teams.TeamID) => void
    leaveTeam: (teamname: string, permanent: boolean, context: 'teams' | 'chat') => void
    loadTeam: (teamID: T.Teams.TeamID, _subscribe?: boolean) => void
    loadTeamChannelList: (teamID: T.Teams.TeamID) => void
    loadTeamTree: (teamID: T.Teams.TeamID, username: string) => void
    loadWelcomeMessage: (teamID: T.Teams.TeamID) => void
    loadedWelcomeMessage: (teamID: T.Teams.TeamID, message: T.RPCChat.WelcomeMessageDisplay) => void
    manageChatChannels: (teamID: T.Teams.TeamID) => void
    notifyTreeMembershipsDone: (result: T.RPCChat.Keybase1.TeamTreeMembershipsDoneResult) => void
    notifyTreeMembershipsPartial: (membership: T.RPCChat.Keybase1.TeamTreeMembership) => void
    notifyTeamTeamRoleMapChanged: (newVersion: number) => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    openInviteLink: (inviteID: string, inviteKey: string) => void
    onGregorPushState: (gs: Array<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>) => void
    reAddToTeam: (teamID: T.Teams.TeamID, username: string) => void
    refreshTeamRoleMap: () => void
    removeMember: (teamID: T.Teams.TeamID, username: string) => void
    removePendingInvite: (teamID: T.Teams.TeamID, inviteID: string) => void
    renameTeam: (oldName: string, newName: string) => void
    requestInviteLinkDetails: () => void
    resetErrorInEmailInvite: () => void
    resetErrorInSettings: () => void
    resetErrorInTeamCreation: () => void
    resetState: 'default'
    resetTeamJoin: () => void
    resetTeamMetaStale: () => void
    resetTeamProfileAddList: () => void
    saveChannelMembership: (
      teamID: T.Teams.TeamID,
      oldChannelState: T.Teams.ChannelMembershipState,
      newChannelState: T.Teams.ChannelMembershipState
    ) => void
    setAddMembersWizardIndividualRole: (assertion: string, role: T.Teams.AddingMemberTeamRoleType) => void
    setAddMembersWizardRole: (role: T.Teams.AddingMemberTeamRoleType | 'setIndividually') => void
    setChannelCreationError: (error: string) => void
    setChannelSelected: (
      teamID: T.Teams.TeamID,
      channel: string,
      selected: boolean,
      clearAll?: boolean
    ) => void
    setJustFinishedAddMembersWizard: (justFinished: boolean) => void
    setMemberPublicity: (teamID: T.Teams.TeamID, showcase: boolean) => void
    setMemberSelected: (
      teamID: T.Teams.TeamID,
      username: string,
      selected: boolean,
      clearAll?: boolean
    ) => void
    setNewTeamInfo: (
      deletedTeams: ReadonlyArray<T.RPCGen.DeletedTeamInfo>,
      newTeams: Set<T.Teams.TeamID>,
      teamIDToResetUsers: Map<T.Teams.TeamID, Set<string>>
    ) => void
    setNewTeamRequests: (newTeamRequests: Map<T.Teams.TeamID, Set<string>>) => void
    setPublicity: (teamID: T.Teams.TeamID, settings: T.Teams.PublicitySettings) => void
    setSubteamFilter: (filter: string, parentTeam?: T.Teams.TeamID) => void
    setTeamListFilter: (filter: string) => void
    setTeamListSort: (sortOrder: T.Teams.TeamListSort) => void
    setTeamRetentionPolicy: (teamID: T.Teams.TeamID, policy: T.Retention.RetentionPolicy) => void
    setTeamRoleMapLatestKnownVersion: (version: number) => void
    setTeamSawChatBanner: () => void
    setTeamSawSubteamsBanner: () => void
    setTeamWizardAvatar: (crop?: T.Teams.AvatarCrop, filename?: string) => void
    setTeamWizardChannels: (channels: Array<string>) => void
    setTeamWizardNameDescription: (p: {
      teamname: string
      description: string
      openTeam: boolean
      openTeamJoinRole: T.Teams.TeamRoleType
      profileShowcase: boolean
      addYourself: boolean
    }) => void
    setTeamWizardSubteamMembers: (members: Array<string>) => void
    setTeamWizardSubteams: (subteams: Array<string>) => void
    setTeamWizardTeamSize: (isBig: boolean) => void
    setTeamWizardTeamType: (teamType: T.Teams.TeamWizardTeamType) => void
    setTeamsWithChosenChannels: (teamsWithChosenChannels: Set<T.Teams.TeamID>) => void
    setWelcomeMessage: (teamID: T.Teams.TeamID, message: T.RPCChat.WelcomeMessage) => void
    showTeamByName: (
      teamname: string,
      initialTab?: T.Teams.TabKey,
      join?: boolean,
      addMembers?: boolean
    ) => void
    startAddMembersWizard: (teamID: T.Teams.TeamID) => void
    teamChangedByID: (c: EngineGen.Keybase1NotifyTeamTeamChangedByIDPayload['payload']['params']) => void
    teamSeen: (teamID: T.Teams.TeamID) => void
    toggleInvitesCollapsed: (teamID: T.Teams.TeamID) => void
    unsubscribeTeamDetails: (teamID: T.Teams.TeamID) => void
    unsubscribeTeamList: () => void
    updateChannelName: (
      teamID: T.Teams.TeamID,
      conversationIDKey: T.Chat.ConversationIDKey,
      newChannelName: string
    ) => Promise<void>
    updateTopic: (
      teamID: T.Teams.TeamID,
      conversationIDKey: T.Chat.ConversationIDKey,
      newTopic: string
    ) => Promise<void>
    uploadTeamAvatar: (
      teamname: string,
      filename: string,
      sendChatNotification: boolean,
      crop?: T.RPCGen.ImageCropRect
    ) => void
    updateTeamRetentionPolicy: (metas: Array<T.Chat.ConversationMeta>) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    addMembersWizardPushMembers: members => {
      const f = async () => {
        // Call FindAssertionsInTeamNoResolve RPC and pass the results along with the
        // members to addMembersWizardSetMembers action.
        const {teamID} = get().addMembersWizard
        const assertions = members
          .filter(member => member.assertion.includes('@') || !!member.resolvedFrom)
          .map(({assertion}) => assertion)

        const existingAssertions =
          teamID === T.Teams.newTeamWizardTeamID
            ? []
            : await T.RPCGen.teamsFindAssertionsInTeamNoResolveRpcPromise({
                assertions,
                teamID,
              })

        set(s => {
          const assertionsInTeam = new Set(existingAssertions ?? [])
          // Set `membersAlreadyInTeam` first. It's only shown for last add, so
          // just overwrite the list.
          //
          // Prefer to show "resolvedFrom" which will contain the original assertion
          // that user tried to add (e.g. phone number or email) in case it resolved
          // to a user that's already in the team.
          s.addMembersWizard.membersAlreadyInTeam = members
            .filter(m => assertionsInTeam.has(m.assertion))
            .map(m => m.resolvedFrom ?? m.assertion)
          // - Filter out all members that are already in team as team members or
          //   team invites.
          // - De-duplicate with current addingMembers list
          // - Coerce assertion role (ensures it's no higher than 'writer' for
          //   non-usernames).
          const filteredMembers = members.filter(m => !assertionsInTeam.has(m.assertion))
          s.addMembersWizard.addingMembers = dedupAddingMembeers(
            s.addMembersWizard.addingMembers,
            filteredMembers.map(coerceAssertionRole)
          )
          // Check if after adding the new batch of members we are not violating the
          // "only Keybase users can be added as admins" contract.
          if (
            ['admin', 'owner'].includes(s.addMembersWizard.role) &&
            filteredMembers.some(m => m.assertion.includes('@'))
          ) {
            if (isPhone) {
              s.addMembersWizard.role = 'writer'
              s.addMembersWizard.addingMembers.forEach(member => (member.role = 'writer'))
            } else {
              s.addMembersWizard.role = 'setIndividually'
            }
          }
        })

        C.useRouterState.getState().dispatch.navigateAppend('teamAddToTeamConfirm')
      }
      C.ignorePromise(f())
    },
    addMembersWizardRemoveMember: assertion => {
      set(s => {
        const idx = s.addMembersWizard.addingMembers.findIndex(member => member.assertion === assertion)
        if (idx >= 0) {
          s.addMembersWizard.addingMembers.splice(idx, 1)
        }
      })
    },
    addMembersWizardSetDefaultChannels: (toAdd, toRemove) => {
      set(s => {
        if (!s.addMembersWizard.addToChannels) {
          // we're definitely setting these manually now
          s.addMembersWizard.addToChannels = []
        }
        const addToChannels = s.addMembersWizard.addToChannels
        toAdd?.forEach(channel => {
          if (!addToChannels.find(dc => dc.conversationIDKey === channel.conversationIDKey)) {
            addToChannels.push(channel)
          }
        })
        const maybeRemoveIdx =
          (toRemove && addToChannels.findIndex(dc => dc.conversationIDKey === toRemove.conversationIDKey)) ??
          -1
        if (maybeRemoveIdx >= 0) {
          addToChannels.splice(maybeRemoveIdx, 1)
        }
      })
    },
    addTeamWithChosenChannels: teamID => {
      const f = async () => {
        const existingTeams = get().teamsWithChosenChannels
        const teamname = getTeamNameFromID(get(), teamID)
        if (!teamname) {
          logger.warn('No team name in store for teamID:', teamID)
          return
        }
        if (get().teamsWithChosenChannels.has(teamname)) {
          // we've already dismissed for this team and we already know about it, bail
          return
        }
        const logPrefix = `[addTeamWithChosenChannels]:${teamname}`
        try {
          const pushState = await T.RPCGen.gregorGetStateRpcPromise(undefined, teamWaitingKey(teamID))
          const item = pushState.items?.find(i => i.item?.category === chosenChannelsGregorKey)
          let teams: Array<string> = []
          let msgID: Uint8Array | undefined
          if (item?.item?.body) {
            const body = item.item.body
            msgID = item.md?.msgID
            teams = C.Gregor.bodyToJSON(body) as Array<string>
          } else {
            logger.info(
              `${logPrefix} No item in gregor state found, making new item. Total # of items: ${
                pushState.items?.length || 0
              }`
            )
          }
          if (existingTeams.size > teams.length) {
            // Bad - we don't have an accurate view of things. Log and bail
            logger.warn(
              `${logPrefix} Existing list longer than list in gregor state, got list with length ${teams.length} when we have ${existingTeams.size} already. Bailing on update.`
            )
            return
          }
          teams.push(teamname)
          // make sure there're no dupes
          teams = [...new Set(teams)]

          const dtime = {offset: 0, time: 0}
          // update if exists, else create
          if (msgID) {
            logger.info(`${logPrefix} Updating teamsWithChosenChannels`)
          } else {
            logger.info(`${logPrefix} Creating teamsWithChosenChannels`)
          }
          await T.RPCGen.gregorUpdateCategoryRpcPromise(
            {
              body: JSON.stringify(teams),
              category: chosenChannelsGregorKey,
              dtime,
            },
            teams.map(t => teamWaitingKey(getTeamID(get(), t)))
          )
        } catch (err) {
          // failure getting the push state, don't bother the user with an error
          // and don't try to move forward updating the state
          logger.error(`${logPrefix} error fetching gregor state: ${String(err)}`)
        }
      }
      C.ignorePromise(f())
    },
    addToTeam: (teamID, users, sendChatNotification, fromTeamBuilder) => {
      set(s => {
        s.errorInAddToTeam = ''
      })
      const f = async () => {
        try {
          const res = await T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise(
            {
              sendChatNotification,
              teamID,
              users: users.map(({assertion, role}) => ({
                assertion: assertion,
                role: T.RPCGen.TeamRole[role],
              })),
            },
            [teamWaitingKey(teamID), addMemberWaitingKey(teamID, ...users.map(({assertion}) => assertion))]
          )
          if (res.notAdded && res.notAdded.length > 0) {
            const usernames = res.notAdded.map(elem => elem.username)
            C.TBstores.get('teams')?.getState().dispatch.finishedTeamBuilding()
            C.useRouterState.getState().dispatch.navigateAppend({
              props: {source: 'teamAddSomeFailed', usernames},
              selected: 'contactRestricted',
            })
            return
          }

          set(s => {
            s.errorInAddToTeam = ''
          })
          if (fromTeamBuilder) {
            C.TBstores.get('teams')?.getState().dispatch.finishedTeamBuilding()
          }
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // If all of the users couldn't be added due to contact settings, the RPC fails.
          if (error.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
            const users = (error.fields as Array<{key?: string; value?: string} | undefined> | undefined)
              ?.filter(elem => elem?.key === 'usernames')
              .map(elem => elem?.value)
            const usernames = users?.[0]?.split(',') ?? []
            C.TBstores.get('teams')?.getState().dispatch.finishedTeamBuilding()
            C.useRouterState.getState().dispatch.navigateAppend({
              props: {source: 'teamAddAllFailed', usernames},
              selected: 'contactRestricted',
            })
            return
          }

          const msg = error.desc
          set(s => {
            s.errorInAddToTeam = msg
          })
          // TODO this should not error on member already in team
          if (fromTeamBuilder) {
            C.TBstores.get('teams')?.getState().dispatch.setError(msg)
          }
        }
      }
      C.ignorePromise(f())
    },
    addUserToTeams: (role, teams, user) => {
      const f = async () => {
        const teamsAddedTo: Array<string> = []
        const errorAddingTo: Array<string> = []
        for (const team of teams) {
          try {
            const teamID = getTeamID(get(), team)
            if (teamID === T.Teams.noTeamID) {
              logger.warn(`no team ID found for ${team}`)
              errorAddingTo.push(team)
              continue
            }
            await T.RPCGen.teamsTeamAddMemberRpcPromise(
              {
                email: '',
                phone: '',
                role: T.RPCGen.TeamRole[role],
                sendChatNotification: true,
                teamID,
                username: user,
              },
              [teamWaitingKey(teamID), addUserToTeamsWaitingKey(user)]
            )
            teamsAddedTo.push(team)
          } catch {
            errorAddingTo.push(team)
          }
        }

        // TODO: We should split these results into two messages, showing one in green and
        // the other in red instead of lumping them together.
        let result = ''
        if (teamsAddedTo.length) {
          result += `${user} was added to `
          if (teamsAddedTo.length > 3) {
            result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo.length - 2} teams.`
          } else if (teamsAddedTo.length === 3) {
            result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo[2]}.`
          } else if (teamsAddedTo.length === 2) {
            result += `${teamsAddedTo[0]} and ${teamsAddedTo[1]}.`
          } else {
            result += `${teamsAddedTo[0]}.`
          }
        }

        if (errorAddingTo.length) {
          if (result.length > 0) {
            result += ' But we '
          } else {
            result += 'We '
          }
          result += `were unable to add ${user} to ${errorAddingTo.join(', ')}.`
        }
        set(s => {
          s.addUserToTeamsResults = result
          s.addUserToTeamsState = errorAddingTo.length > 0 ? 'failed' : 'succeeded'
        })
      }
      C.ignorePromise(f())
    },
    cancelAddMembersWizard: () => {
      set(s => {
        s.addMembersWizard = T.castDraft({...addMembersWizardEmptyState})
      })
      C.useRouterState.getState().dispatch.clearModals()
    },
    channelSetMemberSelected: (conversationIDKey, username, selected, clearAll) => {
      set(s => {
        if (clearAll) {
          s.channelSelectedMembers.delete(conversationIDKey)
        } else {
          const membersSelected = mapGetEnsureValue(s.channelSelectedMembers, conversationIDKey, new Set())
          if (selected) {
            membersSelected.add(username)
          } else {
            membersSelected.delete(username)
          }
        }
      })
    },
    checkRequestedAccess: _teamname => {
      // we never use teamname?
      const f = async () => {
        const result = await T.RPCGen.teamsTeamListMyAccessRequestsRpcPromise(
          {},
          teamsAccessRequestWaitingKey
        )
        set(s => {
          s.teamAccessRequestsPending = new Set<T.Teams.Teamname>(
            result?.map(row => row.parts?.join('.') ?? '')
          )
        })
      }
      C.ignorePromise(f())
    },
    clearAddUserToTeamsResults: () => {
      set(s => {
        s.addUserToTeamsResults = ''
        s.addUserToTeamsState = 'notStarted'
      })
    },
    clearNavBadges: () => {
      const f = async () => {
        try {
          await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'team.newly_added_to_team'})
          await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'team.delete'})
        } catch (err) {
          logError(err)
        }
      }
      C.ignorePromise(f())
    },
    createChannel: p => {
      const f = async () => {
        const {channelname, description, teamID, navToChatOnSuccess} = p
        const teamname = getTeamNameFromID(get(), teamID)
        if (teamname === undefined) {
          logger.warn('Team name was not in store!')
          return
        }
        try {
          const result = await T.RPCChat.localNewConversationLocalRpcPromise(
            {
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              membersType: T.RPCChat.ConversationMembersType.team,
              tlfName: teamname,
              tlfVisibility: T.RPCGen.TLFVisibility.private,
              topicName: channelname,
              topicType: T.RPCChat.TopicType.chat,
            },
            createChannelWaitingKey(teamID)
          )
          // No error if we get here.
          const newConversationIDKey = T.Chat.conversationIDToKey(result.conv.info.id)
          if (!newConversationIDKey) {
            logger.warn('No convoid from newConvoRPC')
            return
          }
          // If we were given a description, set it
          if (description) {
            await T.RPCChat.localPostHeadlineNonblockRpcPromise(
              {
                clientPrev: 0,
                conversationID: result.conv.info.id,
                headline: description,
                identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
                tlfName: teamname,
                tlfPublic: false,
              },
              createChannelWaitingKey(teamID)
            )
          }

          // Dismiss the create channel dialog.
          const visibleScreen = Router2Constants.getVisibleScreen()
          if (visibleScreen && visibleScreen.name === 'chatCreateChannel') {
            C.useRouterState.getState().dispatch.clearModals()
          }
          // Reload on team page
          get().dispatch.loadTeamChannelList(teamID)
          // Select the new channel, and switch to the chat tab.
          if (navToChatOnSuccess) {
            const {previewConversation} = C.useChatState.getState().dispatch
            previewConversation({
              channelname,
              conversationIDKey: newConversationIDKey,
              reason: 'newChannel',
              teamname,
            })
          }
        } catch (error) {
          if (error instanceof RPCError) {
            get().dispatch.setChannelCreationError(error.desc)
          }
        }
      }
      C.ignorePromise(f())
    },
    createChannels: (teamID, channelnames) => {
      set(s => {
        s.creatingChannels = true
      })
      const f = async () => {
        const teamname = getTeamNameFromID(get(), teamID)
        if (!teamname) {
          get().dispatch.setChannelCreationError('Invalid team name')
          return
        }

        try {
          for (const c of channelnames) {
            await T.RPCChat.localNewConversationLocalRpcPromise({
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              membersType: T.RPCChat.ConversationMembersType.team,
              tlfName: teamname,
              tlfVisibility: T.RPCGen.TLFVisibility.private,
              topicName: c,
              topicType: T.RPCChat.TopicType.chat,
            })
          }
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          get().dispatch.setChannelCreationError(error.desc)
          return
        }
        get().dispatch.loadTeamChannelList(teamID)
        set(s => {
          s.creatingChannels = false
        })
      }
      C.ignorePromise(f())
    },
    createNewTeam: (teamname, joinSubteam, fromChat, thenAddMembers) => {
      set(s => {
        s.errorInTeamCreation = ''
      })
      const f = async () => {
        try {
          const {teamID} = await T.RPCGen.teamsTeamCreateRpcPromise(
            {joinSubteam, name: teamname},
            teamCreationWaitingKey
          )
          set(s => {
            s.teamNameToID.set(teamname, teamID)
          })
          if (thenAddMembers) {
            get().dispatch.addToTeam(teamID, thenAddMembers.users, false)
          }

          if (fromChat) {
            C.useRouterState.getState().dispatch.clearModals()
            const {previewConversation, navigateToInbox} = C.useChatState.getState().dispatch
            navigateToInbox()
            previewConversation({channelname: 'general', reason: 'convertAdHoc', teamname})
          } else {
            C.useRouterState.getState().dispatch.clearModals()
            C.useRouterState.getState().dispatch.navigateAppend({props: {teamID}, selected: 'team'})
            if (isMobile) {
              C.useRouterState
                .getState()
                .dispatch.navigateAppend({props: {createdTeam: true, teamID}, selected: 'profileEditAvatar'})
            }
          }
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              s.errorInTeamCreation = error.desc
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    createNewTeamFromConversation: (conversationIDKey, teamname) => {
      set(s => {
        s.errorInTeamCreation = ''
      })
      const me = C.useCurrentUserState.getState().username
      const participantInfo = C.getConvoState(conversationIDKey).participants
      // exclude bots from the newly created team, they can be added back later.
      const participants = participantInfo.name.filter(p => p !== me) // we will already be in as 'owner'
      const users = participants.map(assertion => ({
        assertion,
        role: assertion === me ? ('admin' as const) : ('writer' as const),
      }))
      get().dispatch.createNewTeam(teamname, false, true, {sendChatNotification: true, users})
    },
    deleteChannelConfirmed: (teamID, conversationIDKey) => {
      const f = async () => {
        // channelName is only needed for confirmation, so since we handle
        // confirmation ourselves we don't need to plumb it through.
        await T.RPCChat.localDeleteConversationLocalRpcPromise(
          {
            channelName: '',
            confirmed: true,
            convID: T.Chat.keyToConversationID(conversationIDKey),
          },
          teamWaitingKey(teamID)
        )
        get().dispatch.loadTeamChannelList(teamID)
        C.useRouterState.getState().dispatch.clearModals()
      }
      C.ignorePromise(f())
    },
    deleteMultiChannelsConfirmed: (teamID, channels) => {
      const f = async () => {
        for (const conversationIDKey of channels) {
          await T.RPCChat.localDeleteConversationLocalRpcPromise(
            {
              channelName: '',
              confirmed: true,
              convID: T.Chat.keyToConversationID(conversationIDKey),
            },
            deleteChannelWaitingKey(teamID)
          )
        }
        get().dispatch.loadTeamChannelList(teamID)
        C.useRouterState.getState().dispatch.clearModals()
      }
      C.ignorePromise(f())
    },
    deleteTeam: teamID => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamDeleteRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.teamsUi.confirmRootTeamDelete': (_, response) => response.result(true),
              'keybase.1.teamsUi.confirmSubteamDelete': (_, response) => response.result(true),
            },
            incomingCallMap: {},
            params: {teamID},
            waitingKey: deleteTeamWaitingKey(teamID),
          })
        } catch (error) {
          if (error instanceof RPCError) {
            // handled through waiting store
            logger.warn('error:', error.message)
          }
        }
      }
      C.ignorePromise(f())
    },
    dynamic: {
      respondToInviteLink: undefined,
    },
    eagerLoadTeams: () => {
      if (get().teamMetaSubscribeCount > 0) {
        logger.info('eagerly reloading')
        get().dispatch.getTeams()
      } else {
        logger.info('skipping')
      }
    },
    editMembership: (teamID, usernames, r) => {
      const f = async () => {
        const role = T.RPCGen.TeamRole[r]
        try {
          await T.RPCGen.teamsTeamEditMembersRpcPromise(
            {
              teamID,
              users: usernames.map(assertion => ({assertion, role})),
            },
            [teamWaitingKey(teamID), editMembershipWaitingKey(teamID, ...usernames)]
          )
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              if (usernames.length === 1) {
                // error is shown in the member page
                s.errorInEditMember.error = error.message
                s.errorInEditMember.username = usernames[0] ?? ''
                s.errorInEditMember.teamID = teamID
              }
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    editTeamDescription: (teamID, description) => {
      set(s => {
        s.errorInEditDescription = ''
      })
      const f = async () => {
        try {
          await T.RPCGen.teamsSetTeamShowcaseRpcPromise({description, teamID}, teamWaitingKey(teamID))
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              s.errorInEditDescription = error.message
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    finishNewTeamWizard: () => {
      set(s => {
        s.newTeamWizard.error = undefined
      })
      const f = async () => {
        const {name, description, open, openTeamJoinRole, profileShowcase, addYourself} = get().newTeamWizard
        const {avatarFilename, avatarCrop, channels, subteams} = get().newTeamWizard
        const teamInfo: T.RPCGen.TeamCreateFancyInfo = {
          avatar: avatarFilename ? {avatarFilename, crop: avatarCrop?.crop} : null,
          chatChannels: channels,
          description,
          joinSubteam: addYourself,
          name,
          openSettings: {joinAs: T.RPCGen.TeamRole[openTeamJoinRole], open},
          profileShowcase,
          subteams,
          users: get().addMembersWizard.addingMembers.map(member => ({
            assertion: member.assertion,
            role: T.RPCGen.TeamRole[member.role],
          })),
        }
        try {
          const teamID = await T.RPCGen.teamsTeamCreateFancyRpcPromise({teamInfo}, teamCreationWaitingKey)
          set(s => {
            s.newTeamWizard = T.castDraft(newTeamWizardEmptyState)
            s.addMembersWizard = T.castDraft({...addMembersWizardEmptyState, justFinished: true})
          })
          C.useRouterState.getState().dispatch.navigateAppend({props: {teamID}, selected: 'team'})
          C.useRouterState.getState().dispatch.clearModals()
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              s.newTeamWizard.error = error.desc
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    finishedAddMembersWizard: () => {
      set(s => {
        s.addMembersWizard = T.castDraft({...addMembersWizardEmptyState, justFinished: true})
      })
      C.useRouterState.getState().dispatch.clearModals()
    },
    getActivityForTeams: () => {
      const f = async () => {
        try {
          const results = await T.RPCChat.localGetLastActiveForTeamsRpcPromise()
          const teams = Object.entries(results.teams ?? {}).reduce<
            Map<T.Teams.TeamID, T.Teams.ActivityLevel>
          >((res, [teamID, status]) => {
            if (status === T.RPCChat.LastActiveStatus.none) {
              return res
            }
            res.set(teamID, lastActiveStatusToActivityLevel[status])
            return res
          }, new Map())
          const channels = Object.entries(results.channels ?? {}).reduce<
            Map<T.Chat.ConversationIDKey, T.Teams.ActivityLevel>
          >((res, [conversationIDKey, status]) => {
            if (status === T.RPCChat.LastActiveStatus.none) {
              return res
            }
            res.set(conversationIDKey, lastActiveStatusToActivityLevel[status])
            return res
          }, new Map())
          set(s => {
            s.activityLevels = {channels, loaded: true, teams}
          })
        } catch (e) {
          logger.warn(e)
        }
        return
      }
      C.ignorePromise(f())
    },
    getMembers: (teamID: T.Teams.TeamID) => {
      const f = async () => {
        try {
          const res = await T.RPCGen.teamsTeamGetMembersByIDRpcPromise({
            id: teamID,
          })
          const members = rpcDetailsToMemberInfos(res ?? [])
          set(s => {
            s.teamIDToMembers.set(teamID, members)
          })
          C.useUsersState.getState().dispatch.updates(
            [...members.values()].map(m => ({
              info: {fullname: m.fullName},
              name: m.username,
            }))
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error updating members for ${teamID}: ${error.desc}`)
          }
        }
        return
      }
      C.ignorePromise(f())
    },
    getTeamProfileAddList: username => {
      const f = async () => {
        const res =
          (await T.RPCGen.teamsTeamProfileAddListRpcPromise({username}, teamProfileAddListWaitingKey)) ?? []
        const teamlist = res.map(team => ({
          disabledReason: team.disabledReason,
          open: team.open,
          teamName: team.teamName.parts ? team.teamName.parts.join('.') : '',
        }))
        teamlist.sort((a, b) => a.teamName.localeCompare(b.teamName))
        set(s => {
          s.teamProfileAddList = teamlist
        })
      }
      C.ignorePromise(f())
    },
    getTeamRetentionPolicy: teamID => {
      const f = async () => {
        let retentionPolicy = makeRetentionPolicy()
        try {
          const policy = await T.RPCChat.localGetTeamRetentionLocalRpcPromise(
            {teamID},
            teamWaitingKey(teamID)
          )
          try {
            retentionPolicy = serviceRetentionPolicyToRetentionPolicy(policy)
            if (retentionPolicy.type === 'inherit') {
              throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
            }
          } catch (error) {
            if (error instanceof RPCError) {
              logger.error(error.message)
            }
          }
        } catch {}
        set(s => {
          s.teamIDToRetentionPolicy.set(teamID, retentionPolicy)
        })
      }
      C.ignorePromise(f())
    },
    getTeams: (subscribe, forceReload) => {
      if (subscribe) {
        set(s => {
          s.teamMetaSubscribeCount++
        })
      }

      const f = async () => {
        const username = C.useCurrentUserState.getState().username
        const loggedIn = C.useConfigState.getState().loggedIn
        if (!username || !loggedIn) {
          logger.warn('getTeams while logged out')
          return
        }
        if (!forceReload && !get().teamMetaStale) {
          // bail
          return
        }
        try {
          const results = await T.RPCGen.teamsTeamListUnverifiedRpcPromise(
            {includeImplicitTeams: false, userAssertion: username},
            teamsLoadedWaitingKey
          )
          const teams: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo> = results.teams || []
          const teamnames: Array<string> = []
          const teamNameToID = new Map<string, T.Teams.TeamID>()
          teams.forEach(team => {
            teamnames.push(team.fqName)
            teamNameToID.set(team.fqName, team.teamID)
          })
          set(s => {
            s.teamNameToID = teamNameToID
            s.teamnames = new Set<string>(teamnames)
            s.teamMeta = mergeTeamMeta(s.teamMeta, teamListToMeta(teams))
            s.teamMetaStale = false
          })
        } catch (error) {
          if (error instanceof RPCError) {
            if (error.code === T.RPCGen.StatusCode.scapinetworkerror) {
              // Ignore API errors due to offline
            } else {
              logger.error(error)
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    ignoreRequest: (teamID, teamname, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamIgnoreRequestRpcPromise({name: teamname, username}, teamWaitingKey(teamID))
        } catch {}
      }
      C.ignorePromise(f())
    },
    inviteToTeamByEmail: (invitees, role, teamID, teamname, loadingKey) => {
      const f = async () => {
        if (loadingKey) {
          set(s => {
            const oldLoadingInvites = mapGetEnsureValue(s.teamNameToLoadingInvites, teamname, new Map())
            oldLoadingInvites.set(loadingKey, true)
            s.teamNameToLoadingInvites.set(teamname, oldLoadingInvites)
          })
        }
        try {
          const res = await T.RPCGen.teamsTeamAddEmailsBulkRpcPromise(
            {
              emails: invitees,
              name: teamname,
              role: T.RPCGen.TeamRole[role],
            },
            [teamWaitingKey(teamID), addToTeamByEmailWaitingKey(teamname)]
          )
          if (res.malformed && res.malformed.length > 0) {
            const malformed = res.malformed
            logger.warn(`teamInviteByEmail: Unable to parse ${malformed.length} email addresses`)
            set(s => {
              s.errorInEmailInvite.malformed = new Set(malformed)
              s.errorInEmailInvite.message = isMobile
                ? `Error parsing email: ${malformed[0]}`
                : `There was an error parsing ${malformed.length} address${malformed.length > 1 ? 'es' : ''}.`
            })
          } else {
            // no malformed emails, assume everything went swimmingly
            get().dispatch.resetErrorInEmailInvite()
            if (!isMobile) {
              // mobile does not nav away
              C.useRouterState.getState().dispatch.clearModals()
            }
          }
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              // other error. display messages and leave all emails in input box
              s.errorInEmailInvite.malformed = new Set()
              s.errorInEmailInvite.message = error.desc
            }
          })
        } finally {
          if (loadingKey) {
            set(s => {
              const oldLoadingInvites = mapGetEnsureValue(s.teamNameToLoadingInvites, teamname, new Map())
              oldLoadingInvites.set(loadingKey, false)
              s.teamNameToLoadingInvites.set(teamname, oldLoadingInvites)
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    inviteToTeamByPhone: (teamID, teamname, role, phoneNumber, fullName, loadingKey) => {
      const f = async () => {
        const generateSMSBody = (teamname: string, seitan: string): string => {
          // seitan is 18chars
          // message sans teamname is 118chars. Teamname can be 33 chars before we truncate to 25 and pre-ellipsize
          let team: string
          const teamOrSubteam = teamname.includes('.') ? 'subteam' : 'team'
          if (teamname.length <= 33) {
            team = `${teamname} ${teamOrSubteam}`
          } else {
            team = `..${teamname.substring(teamname.length - 30)} subteam`
          }
          return `Join the ${team} on Keybase. Copy this message into the "Teams" tab.\n\ntoken: ${seitan.toLowerCase()}\n\ninstall: keybase.io/_/go`
        }
        if (loadingKey) {
          set(s => {
            const oldLoadingInvites = mapGetEnsureValue(s.teamNameToLoadingInvites, teamname, new Map())
            oldLoadingInvites.set(loadingKey, true)
          })
        }
        try {
          const seitan = await T.RPCGen.teamsTeamCreateSeitanTokenV2RpcPromise(
            {
              label: {sms: {f: fullName || '', n: phoneNumber} as T.RPCGen.SeitanKeyLabelSms, t: 1},
              role: T.RPCGen.TeamRole[role],
              teamname,
            },
            teamWaitingKey(teamID)
          )
          /* Open SMS */
          const bodyText = generateSMSBody(teamname, seitan)
          await openSMS([phoneNumber], bodyText)
        } catch (err) {
          logger.info('Error sending SMS', err)
        } finally {
          if (loadingKey) {
            set(s => {
              const oldLoadingInvites = mapGetEnsureValue(s.teamNameToLoadingInvites, teamname, new Map())
              oldLoadingInvites.set(loadingKey, false)
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    joinTeam: (teamname, deeplink) => {
      set(s => {
        s.teamInviteDetails.inviteDetails = undefined
      })

      const f = async () => {
        // In the deeplink flow, a modal is displayed which runs `joinTeam` (or an
        // alternative flow, but we're not concerned with that here). In that case,
        // we can fully manage the UX from inside of this handler.
        // In the "Join team" flow, user pastes their link into the input box, which
        // then calls `joinTeam` on its own. Since we need to switch to another modal,
        // we simply plumb `deeplink` into the `promptInviteLinkJoin` handler and
        // do the nav in the modal.
        get().dispatch.resetTeamJoin()
        try {
          const result = await T.RPCGen.teamsTeamAcceptInviteOrRequestAccessRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.teamsUi.confirmInviteLinkAccept': (params, response) => {
                set(s => {
                  s.teamInviteDetails.inviteDetails = T.castDraft(params.details)
                })
                if (!deeplink) {
                  C.useRouterState.getState().dispatch.navigateAppend('teamInviteLinkJoin', true)
                }
                set(s => {
                  s.dispatch.dynamic.respondToInviteLink = C.wrapErrors((accept: boolean) => {
                    set(s => {
                      s.dispatch.dynamic.respondToInviteLink = undefined
                    })
                    response.result(accept)
                  })
                })
              },
            },
            incomingCallMap: {},
            params: {tokenOrName: teamname},
            waitingKey: joinTeamWaitingKey,
          })
          set(s => {
            s.teamJoinSuccess = true
            s.teamJoinSuccessOpen = result.wasOpenTeam
            s.teamJoinSuccessTeamName = result.wasTeamName ? teamname : ''
          })
        } catch (error) {
          if (error instanceof RPCError) {
            const desc =
              error.code === T.RPCGen.StatusCode.scteaminvitebadtoken
                ? 'Sorry, that team name or token is not valid.'
                : error.code === T.RPCGen.StatusCode.scnotfound
                  ? 'This invitation is no longer valid, or has expired.'
                  : error.desc
            set(s => {
              s.errorInTeamJoin = desc
            })
          }
        } finally {
          set(s => {
            s.dispatch.dynamic.respondToInviteLink = undefined
          })
        }
      }
      C.ignorePromise(f())
    },
    launchNewTeamWizardOrModal: subteamOf => {
      set(s => {
        s.newTeamWizard = T.castDraft({
          ...newTeamWizardEmptyState,
          parentTeamID: subteamOf,
          teamType: 'subteam',
        })
      })

      if (subteamOf) {
        C.useRouterState.getState().dispatch.navigateAppend('teamWizard2TeamInfo')
      } else {
        C.useRouterState.getState().dispatch.navigateAppend('teamWizard1TeamPurpose')
      }
    },
    leaveTeam: (teamname, permanent, context) => {
      const f = async () => {
        logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
        try {
          await T.RPCGen.teamsTeamLeaveRpcPromise({name: teamname, permanent}, leaveTeamWaitingKey(teamname))
          logger.info(`leaveTeam: left ${teamname} successfully`)
          C.useRouterState.getState().dispatch.clearModals()
          C.useRouterState.getState().dispatch.navUpToScreen(context === 'chat' ? 'chatRoot' : 'teamsRoot')
          get().dispatch.getTeams()
        } catch (error) {
          if (error instanceof RPCError) {
            // handled through waiting store
            logger.warn('error:', error.message)
          }
        }
      }
      C.ignorePromise(f())
    },
    loadTeam: (teamID, subscribe) => {
      set(s => {
        if (subscribe) {
          s.teamDetailsSubscriptionCount.set(teamID, (s.teamDetailsSubscriptionCount.get(teamID) ?? 0) + 1)
        }
      })
      const f = async () => {
        if (!teamID || teamID === T.Teams.noTeamID) {
          logger.warn(`bail on invalid team ID ${teamID}`)
          return
        }

        // If we're already subscribed to team details for this team ID, we're already up to date
        const subscriptions = get().teamDetailsSubscriptionCount.get(teamID) ?? 0
        if (subscribe && subscriptions > 1) {
          logger.info('bail on already subscribed')
          return
        }
        try {
          const team = await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID})
          set(s => {
            const maybeMeta = s.teamMeta.get(teamID)
            if (maybeMeta && maybeMeta.teamname !== team.name) {
              if (team.name.includes('.')) {
                // subteam name changed. store loaded name
                maybeMeta.teamname = team.name
              } else {
                // bad. teamlist lied to us about the teamname
                throw new Error('Team name mismatch! Please report this error.')
              }
            }
            const details = annotatedTeamToDetails(team)
            s.teamDetails.set(teamID, T.castDraft(details))
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(error.message)
          }
        }
      }
      C.ignorePromise(f())
    },
    loadTeamChannelList: teamID => {
      const f = async () => {
        const teamname = getTeamMeta(get(), teamID).teamname
        if (!teamname) {
          logger.warn('bailing on no teamMeta')
          return
        }
        try {
          const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise({
            membersType: T.RPCChat.ConversationMembersType.team,
            tlfName: teamname,
            topicType: T.RPCChat.TopicType.chat,
          })
          const channels =
            convs?.reduce<Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>>((res, inboxUIItem) => {
              const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
              res.set(conversationIDKey, {
                channelname: inboxUIItem.channel,
                conversationIDKey,
                description: inboxUIItem.headline,
              })
              return res
            }, new Map()) ?? new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()

          // ensure we refresh participants, but don't fail the saga if this somehow fails
          try {
            for (const c of channels.values()) {
              C.ignorePromise(
                T.RPCChat.localRefreshParticipantsRpcPromise({
                  convID: T.Chat.keyToConversationID(c.conversationIDKey),
                })
              )
            }
          } catch (e) {
            logger.error('this should never happen', e)
          }
          set(s => {
            s.channelInfo.set(teamID, channels)
          })
        } catch (err) {
          logger.warn(err)
        }
      }
      C.ignorePromise(f())
    },
    loadTeamTree: (teamID, username) => {
      // See protocol/avdl/keybase1/teams.avdl:loadTeamTreeAsync for a description of this RPC.
      const f = async () => {
        await T.RPCGen.teamsLoadTeamTreeMembershipsAsyncRpcPromise({teamID, username})
      }
      C.ignorePromise(f())
    },
    loadWelcomeMessage: teamID => {
      const f = async () => {
        try {
          const message = await T.RPCChat.localGetWelcomeMessageRpcPromise(
            {teamID},
            loadWelcomeMessageWaitingKey(teamID)
          )
          set(s => {
            s.teamIDToWelcomeMessage.set(teamID, message)
          })
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              logger.error(error)
              s.errorInSettings = error.desc
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    loadedWelcomeMessage: (teamID, message) => {
      set(s => {
        s.teamIDToWelcomeMessage.set(teamID, message)
      })
    },
    manageChatChannels: teamID => {
      C.useRouterState.getState().dispatch.navigateAppend({props: {teamID}, selected: 'teamAddToChannels'})
    },
    notifyTeamTeamRoleMapChanged: (newVersion: number) => {
      const loadedVersion = get().teamRoleMap.loadedVersion
      logger.info(`Got teamRoleMapChanged with version ${newVersion}, loadedVersion is ${loadedVersion}`)
      if (loadedVersion < newVersion) {
        get().dispatch.refreshTeamRoleMap()
      }
      get().dispatch.setTeamRoleMapLatestKnownVersion(newVersion)
    },
    notifyTreeMembershipsDone: (result: T.RPCChat.Keybase1.TeamTreeMembershipsDoneResult) => {
      const {guid, targetTeamID, targetUsername, expectedCount} = result
      set(s => {
        const usernameMemberships = mapGetEnsureValue(s.teamMemberToTreeMemberships, targetTeamID, new Map())
        let memberships = usernameMemberships.get(targetUsername)
        if (memberships && guid < memberships.guid) {
          // noop
          return
        }
        if (!memberships || guid > memberships.guid) {
          // start over
          memberships = {
            guid,
            memberships: [],
            targetTeamID,
            targetUsername,
          }
          usernameMemberships.set(targetUsername, memberships)
        }
        memberships.expectedCount = expectedCount
      })
    },
    notifyTreeMembershipsPartial: membership => {
      const {guid, targetTeamID, targetUsername} = membership
      set(s => {
        const usernameMemberships = mapGetEnsureValue(s.teamMemberToTreeMemberships, targetTeamID, new Map())
        let memberships = usernameMemberships.get(targetUsername)
        if (memberships && guid < memberships.guid) {
          // noop
          return
        }
        if (!memberships || guid > memberships.guid) {
          // start over
          memberships = {
            guid,
            memberships: [],
            targetTeamID,
            targetUsername,
          }
          usernameMemberships.set(targetUsername, memberships)
        }
        memberships.memberships.push(membership)
        if (T.RPCGen.TeamTreeMembershipStatus.ok === membership.result.s) {
          const value = membership.result.ok
          const sparseMemberInfos = mapGetEnsureValue(
            s.treeLoaderTeamIDToSparseMemberInfos,
            value.teamID,
            new Map()
          )
          sparseMemberInfos.set(targetUsername, consumeTeamTreeMembershipValue(value))
        }
      })

      const f = async () => {
        if (T.RPCGen.TeamTreeMembershipStatus.ok !== membership.result.s) {
          return
        }
        const teamID = membership.result.ok.teamID
        const username = membership.targetUsername
        const waitingKey = loadTeamTreeActivityWaitingKey(teamID, username)
        try {
          const _activityMap = await T.RPCChat.localGetLastActiveAtMultiLocalRpcPromise(
            {teamIDs: [teamID], username},
            waitingKey
          )
          const activityMap = new Map(Object.entries(_activityMap ?? {}))
          set(s => {
            activityMap.forEach((lastActivity, teamID) => {
              if (!s.teamMemberToLastActivity.has(teamID)) {
                s.teamMemberToLastActivity.set(teamID, new Map())
              }
              s.teamMemberToLastActivity.get(teamID)?.set(username, lastActivity)
            })
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(
              `loadTeamTreeActivity: unable to get activity for ${teamID}:${username}: ${error.message}`
            )
          }
        }
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.chat1ChatUiChatShowManageChannels: {
          const {teamname} = action.payload.params
          const teamID = C.useTeamsState.getState().teamNameToID.get(teamname) ?? T.Teams.noTeamID
          C.useTeamsState.getState().dispatch.manageChatChannels(teamID)
          break
        }
        case EngineGen.keybase1NotifyTeamTeamMetadataUpdate:
          get().dispatch.eagerLoadTeams()
          get().dispatch.resetTeamMetaStale()
          break
        case EngineGen.chat1NotifyChatChatWelcomeMessageLoaded: {
          const {teamID, message} = action.payload.params
          get().dispatch.loadedWelcomeMessage(teamID, message)
          break
        }
        case EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial: {
          const {membership} = action.payload.params
          get().dispatch.notifyTreeMembershipsPartial(membership)
          break
        }
        case EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone: {
          const {result} = action.payload.params
          get().dispatch.notifyTreeMembershipsDone(result)
          break
        }
        case EngineGen.keybase1NotifyTeamTeamRoleMapChanged: {
          const {newVersion} = action.payload.params
          get().dispatch.notifyTeamTeamRoleMapChanged(newVersion)
          break
        }
        case EngineGen.keybase1NotifyTeamTeamChangedByID:
          get().dispatch.teamChangedByID(action.payload.params)
          break
        case EngineGen.keybase1NotifyTeamTeamDeleted:
          // likely wrong?
          if (C.Router2.getTab()) {
            C.useRouterState.getState().dispatch.navUpToScreen('teamsRoot')
          }
          break
        case EngineGen.keybase1NotifyTeamTeamExit:
          if (C.Router2.getTab()) {
            C.useRouterState.getState().dispatch.navUpToScreen('teamsRoot')
          }
          break
        default:
      }
    },
    onGregorPushState: items => {
      let sawChatBanner = false as boolean
      let sawSubteamsBanner = false as boolean
      let chosenChannels: undefined | (typeof items)[0]
      const newTeamRequests = new Map<T.Teams.TeamID, Set<string>>()
      items.forEach(i => {
        if (i.item.category === 'sawChatBanner') {
          sawChatBanner = true
        }
        if (i.item.category === 'sawSubteamsBanner') {
          sawSubteamsBanner = true
        }
        if (i.item.category === chosenChannelsGregorKey) {
          chosenChannels = i
        }
        if (i.item.category.startsWith(newRequestsGregorPrefix)) {
          const body = C.Gregor.bodyToJSON(i.item.body) as undefined | {id: T.Teams.TeamID; username: string}
          if (body) {
            const request = body
            const requests = mapGetEnsureValue(newTeamRequests, request.id, new Set())
            requests.add(request.username)
          }
        }
      })
      sawChatBanner && get().dispatch.setTeamSawChatBanner()
      sawSubteamsBanner && get().dispatch.setTeamSawSubteamsBanner()
      get().dispatch.setNewTeamRequests(newTeamRequests)
      get().dispatch.setTeamsWithChosenChannels(
        new Set<T.Teams.Teamname>(C.Gregor.bodyToJSON(chosenChannels?.item.body) as Array<string>)
      )
    },
    openInviteLink: (inviteID, inviteKey) => {
      set(s => {
        s.teamInviteDetails.inviteDetails = undefined
        s.teamInviteDetails.inviteID = inviteID
        s.teamInviteDetails.inviteKey = inviteKey
      })
      C.useRouterState.getState().dispatch.navigateAppend('teamInviteLinkJoin')
    },
    reAddToTeam: (teamID, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamReAddMemberAfterResetRpcPromise(
            {id: teamID, username},
            addMemberWaitingKey(teamID, username)
          )
        } catch (error) {
          if (error instanceof RPCError) {
            // identify error
            if (error.code === T.RPCGen.StatusCode.scidentifysummaryerror) {
              // show profile card
              C.useProfileState.getState().dispatch.showUserProfile(username)
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    refreshTeamRoleMap: () => {
      const f = async () => {
        try {
          const _map = await T.RPCGen.teamsGetTeamRoleMapRpcPromise()
          const map = rpcTeamRoleMapAndVersionToTeamRoleMap(_map)
          set(s => {
            s.teamRoleMap = {
              latestKnownVersion: Math.max(map.latestKnownVersion, s.teamRoleMap.latestKnownVersion),
              loadedVersion: map.loadedVersion,
              roles: map.roles,
            }
          })
        } catch {
          logger.info(`Failed to refresh TeamRoleMap; service will retry`)
        }
      }
      C.ignorePromise(f())
    },
    removeMember: (teamID, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamRemoveMemberRpcPromise(
            {
              member: {
                assertion: {assertion: username, removeFromSubtree: false},
                type: T.RPCGen.TeamMemberToRemoveType.assertion,
              },
              teamID,
            },
            [teamWaitingKey(teamID), removeMemberWaitingKey(teamID, username)]
          )
        } catch (err) {
          logger.error('Failed to remove member', err)
          // TODO: create setEmailInviteError?`
        }
      }
      C.ignorePromise(f())
    },
    removePendingInvite: (teamID, inviteID) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamRemoveMemberRpcPromise(
            {
              member: {inviteid: {inviteID}, type: T.RPCGen.TeamMemberToRemoveType.inviteid},
              teamID,
            },
            [teamWaitingKey(teamID), removeMemberWaitingKey(teamID, inviteID)]
          )
        } catch (err) {
          logger.error('Failed to remove pending invite', err)
        }
      }
      C.ignorePromise(f())
    },
    renameTeam: (oldName, _newName) => {
      const f = async () => {
        const prevName = {parts: oldName.split('.')}
        const newName = {parts: _newName.split('.')}
        try {
          await T.RPCGen.teamsTeamRenameRpcPromise({newName, prevName}, teamRenameWaitingKey)
        } catch {
          // err displayed from waiting store in component
        }
      }
      C.ignorePromise(f())
    },
    requestInviteLinkDetails: () => {
      const f = async () => {
        try {
          const details = await T.RPCGen.teamsGetInviteLinkDetailsRpcPromise({
            inviteID: get().teamInviteDetails.inviteID,
          })
          set(s => {
            s.teamInviteDetails.inviteDetails = T.castDraft(details)
          })
        } catch (error) {
          if (error instanceof RPCError) {
            const desc =
              error.code === T.RPCGen.StatusCode.scteaminvitebadtoken
                ? 'Sorry, that invite token is not valid.'
                : error.code === T.RPCGen.StatusCode.scnotfound
                  ? 'This invitation is no longer valid, or has expired.'
                  : error.desc
            set(s => {
              s.errorInTeamJoin = desc
            })
          }
        }
      }
      C.ignorePromise(f())
    },
    resetErrorInEmailInvite: () => {
      set(s => {
        s.errorInEmailInvite.message = ''
        s.errorInEmailInvite.malformed = new Set()
      })
    },
    resetErrorInSettings: () => {
      set(s => {
        s.errorInSettings = ''
      })
    },
    resetErrorInTeamCreation: () => {
      set(s => {
        s.errorInTeamCreation = ''
      })
    },
    resetState: 'default',
    resetTeamJoin: () => {
      set(s => {
        s.errorInTeamJoin = ''
        s.teamJoinSuccess = false
        s.teamJoinSuccessOpen = false
        s.teamJoinSuccessTeamName = ''
      })
    },
    resetTeamMetaStale: () => {
      set(s => {
        s.teamMetaStale = true
      })
    },
    resetTeamProfileAddList: () => {
      set(s => {
        s.teamProfileAddList = []
      })
    },
    saveChannelMembership: (teamID, oldChannelState, newChannelState) => {
      const f = async () => {
        const waitingKey = teamWaitingKey(teamID)
        for (const convIDKeyStr in newChannelState) {
          const conversationIDKey = T.Chat.stringToConversationIDKey(convIDKeyStr)
          if (oldChannelState[conversationIDKey] === newChannelState[conversationIDKey]) {
            continue
          }
          if (newChannelState[conversationIDKey]) {
            try {
              const convID = T.Chat.keyToConversationID(conversationIDKey)
              await T.RPCChat.localJoinConversationByIDLocalRpcPromise({convID}, waitingKey)
            } catch (error) {
              C.useConfigState.getState().dispatch.setGlobalError(error)
            }
          } else {
            try {
              const convID = T.Chat.keyToConversationID(conversationIDKey)
              await T.RPCChat.localLeaveConversationLocalRpcPromise({convID}, waitingKey)
            } catch (error) {
              C.useConfigState.getState().dispatch.setGlobalError(error)
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    setAddMembersWizardIndividualRole: (assertion, role) => {
      set(s => {
        const maybeMember = s.addMembersWizard.addingMembers.find(m => m.assertion === assertion)
        if (maybeMember) {
          maybeMember.role = role
        }
      })
    },
    setAddMembersWizardRole: role => {
      set(s => {
        s.addMembersWizard.role = role
        if (role !== 'setIndividually') {
          // keep roles stored with indiv members in sync with top level one
          s.addMembersWizard.addingMembers.forEach(member => {
            member.role = role
          })
        }
      })
    },
    setChannelCreationError: error => {
      set(s => {
        s.creatingChannels = false
        s.errorInChannelCreation = error
      })
    },
    setChannelSelected: (teamID, channel, selected, clearAll) => {
      set(s => {
        if (clearAll) {
          s.teamSelectedChannels.delete(teamID)
        } else {
          const channelsSelected = mapGetEnsureValue(s.teamSelectedChannels, teamID, new Set())
          if (selected) {
            channelsSelected.add(channel)
          } else {
            channelsSelected.delete(channel)
          }
        }
      })
    },
    setJustFinishedAddMembersWizard: justFinished => {
      set(s => {
        s.addMembersWizard.justFinished = justFinished
      })
    },
    setMemberPublicity: (teamID, showcase) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsSetTeamMemberShowcaseRpcPromise({isShowcased: showcase, teamID}, [
            teamWaitingKey(teamID),
            setMemberPublicityWaitingKey(teamID),
          ])
          return
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              s.errorInSettings = error.desc
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    setMemberSelected: (teamID, username, selected, clearAll) => {
      set(s => {
        if (clearAll) {
          s.teamSelectedMembers.delete(teamID)
        } else {
          const membersSelected = mapGetEnsureValue(s.teamSelectedMembers, teamID, new Set())
          if (selected) {
            membersSelected.add(username)
          } else {
            membersSelected.delete(username)
          }
        }
      })
    },
    setNewTeamInfo: (deletedTeams, newTeams, teamIDToResetUsers) => {
      set(s => {
        s.deletedTeams = T.castDraft(deletedTeams)
        s.newTeams = newTeams
        s.teamIDToResetUsers = teamIDToResetUsers
      })
    },
    setNewTeamRequests: newTeamRequests => {
      set(s => {
        s.newTeamRequests = newTeamRequests
      })
    },
    setPublicity: (teamID, settings) => {
      const f = async () => {
        const waitingKey = settingsWaitingKey(teamID)
        const teamMeta = getTeamMeta(get(), teamID)
        const teamSettings = (get().teamDetails.get(teamID) ?? emptyTeamDetails).settings
        const ignoreAccessRequests = teamSettings.tarsDisabled
        const openTeam = teamSettings.open
        const openTeamRole = teamSettings.openJoinAs
        const publicityAnyMember = teamMeta.allowPromote
        const publicityMember = teamMeta.showcasing
        const publicityTeam = teamSettings.teamShowcased

        if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
          try {
            await T.RPCGen.teamsTeamSetSettingsRpcPromise(
              {
                settings: {joinAs: T.RPCGen.TeamRole[settings.openTeamRole], open: settings.openTeam},
                teamID,
              },
              waitingKey
            )
          } catch (payload) {
            C.useConfigState.getState().dispatch.setGlobalError(payload)
          }
        }
        if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
          try {
            await T.RPCGen.teamsSetTarsDisabledRpcPromise(
              {disabled: settings.ignoreAccessRequests, teamID},
              waitingKey
            )
          } catch (payload) {
            C.useConfigState.getState().dispatch.setGlobalError(payload)
          }
        }
        if (publicityAnyMember !== settings.publicityAnyMember) {
          try {
            await T.RPCGen.teamsSetTeamShowcaseRpcPromise(
              {anyMemberShowcase: settings.publicityAnyMember, teamID},
              waitingKey
            )
          } catch (payload) {
            C.useConfigState.getState().dispatch.setGlobalError(payload)
          }
        }
        if (publicityMember !== settings.publicityMember) {
          try {
            await T.RPCGen.teamsSetTeamMemberShowcaseRpcPromise(
              {isShowcased: settings.publicityMember, teamID},
              waitingKey
            )
          } catch (payload) {
            C.useConfigState.getState().dispatch.setGlobalError(payload)
          }
        }
        if (publicityTeam !== settings.publicityTeam) {
          try {
            await T.RPCGen.teamsSetTeamShowcaseRpcPromise(
              {isShowcased: settings.publicityTeam, teamID},
              waitingKey
            )
          } catch (payload) {
            C.useConfigState.getState().dispatch.setGlobalError(payload)
          }
        }
      }
      C.ignorePromise(f())
    },
    setSubteamFilter: (filter, parentTeam) => {
      set(s => {
        s.subteamFilter = filter
        if (parentTeam && filter) {
          const flc = filter.toLowerCase()
          s.subteamsFiltered = new Set(
            [...(s.teamDetails.get(parentTeam)?.subteams || [])].filter(sID =>
              s.teamMeta.get(sID)?.teamname.toLowerCase().includes(flc)
            )
          )
        } else {
          s.subteamsFiltered = undefined
        }
      })
    },
    setTeamListFilter: filter => {
      set(s => {
        s.teamListFilter = filter
      })
    },
    setTeamListSort: (sortOrder: T.Teams.TeamListSort) => {
      set(s => {
        s.teamListSort = sortOrder
      })
    },
    setTeamRetentionPolicy: (teamID, policy) => {
      const f = async () => {
        try {
          const servicePolicy = retentionPolicyToServiceRetentionPolicy(policy)
          await T.RPCChat.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
            teamWaitingKey(teamID),
            retentionWaitingKey(teamID),
          ])
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              logger.error(error.message)
              s.errorInSettings = error.desc
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    setTeamRoleMapLatestKnownVersion: version => {
      set(s => {
        s.teamRoleMap.latestKnownVersion = version
      })
    },
    setTeamSawChatBanner: () => {
      set(s => {
        s.sawChatBanner = true
      })
    },
    setTeamSawSubteamsBanner: () => {
      set(s => {
        s.sawSubteamsBanner = true
      })
    },
    setTeamWizardAvatar: (crop, filename) => {
      set(s => {
        s.newTeamWizard.avatarCrop = crop
        s.newTeamWizard.avatarFilename = filename
      })
      switch (get().newTeamWizard.teamType) {
        case 'subteam': {
          const parentTeamID = get().newTeamWizard.parentTeamID
          const parentTeamMeta = getTeamMeta(get(), parentTeamID ?? '')
          // If it's just you, don't show the subteam members screen empty
          if (parentTeamMeta.memberCount > 1) {
            C.useRouterState.getState().dispatch.navigateAppend('teamWizardSubteamMembers')
            return
          } else {
            get().dispatch.startAddMembersWizard(T.Teams.newTeamWizardTeamID)
            return
          }
        }
        case 'friends':
        case 'other':
          get().dispatch.startAddMembersWizard(T.Teams.newTeamWizardTeamID)
          return
        case 'project':
          C.useRouterState.getState().dispatch.navigateAppend('teamWizard5Channels')
          return
        case 'community':
          C.useRouterState.getState().dispatch.navigateAppend('teamWizard4TeamSize')
          return
      }
    },
    setTeamWizardChannels: channels => {
      set(s => {
        s.newTeamWizard.channels = channels
      })
      C.useRouterState.getState().dispatch.navigateAppend('teamWizard6Subteams')
    },
    setTeamWizardNameDescription: p => {
      set(s => {
        s.newTeamWizard.name = p.teamname
        s.newTeamWizard.description = p.description
        s.newTeamWizard.open = p.openTeam
        s.newTeamWizard.openTeamJoinRole = p.openTeamJoinRole
        s.newTeamWizard.profileShowcase = p.profileShowcase
        s.newTeamWizard.addYourself = p.addYourself
      })
      C.useRouterState.getState().dispatch.navigateAppend({
        props: {createdTeam: true, teamID: T.Teams.newTeamWizardTeamID, wizard: true},
        selected: 'profileEditAvatar',
      })
    },
    setTeamWizardSubteamMembers: members => {
      set(s => {
        s.addMembersWizard = T.castDraft({
          ...addMembersWizardEmptyState,
          addingMembers: members.map(m => ({assertion: m, role: 'writer'})),
          teamID: T.Teams.newTeamWizardTeamID,
        })
      })
      C.useRouterState.getState().dispatch.navigateAppend('teamAddToTeamConfirm')
    },
    setTeamWizardSubteams: subteams => {
      set(s => {
        s.newTeamWizard.subteams = subteams
      })
      get().dispatch.startAddMembersWizard(T.Teams.newTeamWizardTeamID)
    },
    setTeamWizardTeamSize: isBig => {
      set(s => {
        s.newTeamWizard.isBig = isBig
      })
      if (isBig) {
        C.useRouterState.getState().dispatch.navigateAppend('teamWizard5Channels')
      } else {
        get().dispatch.startAddMembersWizard(T.Teams.newTeamWizardTeamID)
      }
    },
    setTeamWizardTeamType: teamType => {
      set(s => {
        s.newTeamWizard.teamType = teamType
      })
      C.useRouterState.getState().dispatch.navigateAppend('teamWizard2TeamInfo')
    },
    setTeamsWithChosenChannels: teamsWithChosenChannels => {
      set(s => {
        s.teamsWithChosenChannels = teamsWithChosenChannels
      })
    },
    setWelcomeMessage: (teamID, message) => {
      set(s => {
        s.errorInEditWelcomeMessage = ''
      })
      const f = async () => {
        try {
          await T.RPCChat.localSetWelcomeMessageRpcPromise(
            {message, teamID},
            setWelcomeMessageWaitingKey(teamID)
          )
          get().dispatch.loadWelcomeMessage(teamID)
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              logger.error(error)
              s.errorInEditWelcomeMessage = error.desc
            }
          })
        }
      }
      C.ignorePromise(f())
    },
    showTeamByName: (teamname, initialTab, join, addMembers) => {
      const f = async () => {
        let teamID: string
        try {
          teamID = await T.RPCGen.teamsGetTeamIDRpcPromise({teamName: teamname})
        } catch (err) {
          logger.info(`team="${teamname}" cannot be loaded:`, err)
          // navigate to team page for team we're not in
          logger.info(`showing external team page, join=${join}`)
          C.useRouterState
            .getState()
            .dispatch.navigateAppend({props: {teamname}, selected: 'teamExternalTeam'})
          if (join) {
            C.useRouterState
              .getState()
              .dispatch.navigateAppend({props: {initialTeamname: teamname}, selected: 'teamJoinTeamDialog'})
          }
          return
        }

        if (addMembers) {
          // Check if we have the right role to be adding members, otherwise don't
          // show the team builder.
          try {
            // Get (hopefully fresh) role map. The app might have just started so it's
            // not enough to just look in the react store.
            const map = await T.RPCGen.teamsGetTeamRoleMapRpcPromise()
            const role = map.teams?.[teamID]?.role || map.teams?.[teamID]?.implicitRole
            if (role !== T.RPCGen.TeamRole.admin && role !== T.RPCGen.TeamRole.owner) {
              logger.info(`ignoring team="${teamname}" with addMember, user is not an admin but role=${role}`)
              return
            }
          } catch (err) {
            logger.info(`team="${teamname}" failed to check if user is an admin:`, err)
            return
          }
        }
        C.useRouterState.getState().dispatch.switchTab(Tabs.teamsTab)
        C.useRouterState.getState().dispatch.navigateAppend({props: {initialTab, teamID}, selected: 'team'})
        if (addMembers) {
          C.useRouterState.getState().dispatch.navigateAppend({
            props: {namespace: 'teams', teamID, title: ''},
            selected: 'teamsTeamBuilder',
          })
        }
      }
      C.ignorePromise(f())
    },
    startAddMembersWizard: teamID => {
      set(s => {
        s.addMembersWizard = T.castDraft({...addMembersWizardEmptyState, teamID})
      })
      C.useRouterState.getState().dispatch.navigateAppend('teamAddToTeamFromWhere')
    },
    teamChangedByID: c => {
      const {teamID, latestHiddenSeqno, latestOffchainSeqno, latestSeqno} = c
      // Any of the Seqnos can be 0, which means that it was unknown at the source
      // at the time when this notification was generated.
      const version = get().teamVersion.get(teamID)
      let versionChanged = true
      if (version) {
        versionChanged =
          latestHiddenSeqno > version.latestHiddenSeqno ||
          latestOffchainSeqno > version.latestOffchainSeqno ||
          latestSeqno > version.latestSeqno
      }
      const shouldLoad = versionChanged && !!get().teamDetailsSubscriptionCount.get(teamID)
      set(s => {
        s.teamVersion.set(
          teamID,
          ratchetTeamVersion({latestHiddenSeqno, latestOffchainSeqno, latestSeqno}, s.teamVersion.get(teamID))
        )
      })
      if (shouldLoad) {
        get().dispatch.loadTeam(teamID)
      }
    },
    teamSeen: teamID => {
      const f = async () => {
        try {
          await T.RPCGen.gregorDismissCategoryRpcPromise({category: newRequestsGregorKey(teamID)})
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(error.message)
          }
        }
      }
      C.ignorePromise(f())
    },
    toggleInvitesCollapsed: teamID => {
      set(s => {
        const {invitesCollapsed} = s
        if (invitesCollapsed.has(teamID)) {
          invitesCollapsed.delete(teamID)
        } else {
          invitesCollapsed.add(teamID)
        }
      })
    },
    unsubscribeTeamDetails: teamID => {
      set(s => {
        s.teamDetailsSubscriptionCount.set(teamID, (s.teamDetailsSubscriptionCount.get(teamID) ?? 1) - 1)
      })
    },
    unsubscribeTeamList: () => {
      set(s => {
        if (s.teamMetaSubscribeCount > 0) {
          s.teamMetaSubscribeCount--
        }
      })
    },
    updateChannelName: async (teamID, conversationIDKey, newChannelName) => {
      const param = {
        channelName: newChannelName,
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        tlfName: getTeamNameFromID(get(), teamID) ?? '',
        tlfPublic: false,
      }

      try {
        await T.RPCChat.localPostMetadataRpcPromise(param, updateChannelNameWaitingKey(teamID))
      } catch (error) {
        if (error instanceof RPCError) {
          get().dispatch.setChannelCreationError(error.desc)
        }
      }
    },
    updateTeamRetentionPolicy: metas => {
      const first = metas[0]
      if (!first) {
        logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
        return
      }
      const {teamRetentionPolicy, teamID} = first
      set(s => {
        s.teamIDToRetentionPolicy.set(teamID, teamRetentionPolicy)
      })
    },
    updateTopic: async (teamID, conversationIDKey, newTopic) => {
      const param = {
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        headline: newTopic,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        tlfName: getTeamNameFromID(get(), teamID) ?? '',
        tlfPublic: false,
      }
      try {
        await T.RPCChat.localPostHeadlineRpcPromise(param, updateChannelNameWaitingKey(teamID))
      } catch {}
    },
    uploadTeamAvatar: (teamname, filename, sendChatNotification, crop) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsUploadTeamAvatarRpcPromise(
            {crop, filename, sendChatNotification, teamname},
            ProfileConstants.uploadAvatarWaitingKey
          )
          C.useRouterState.getState().dispatch.navigateUp()
        } catch (error) {
          if (error instanceof RPCError) {
            // error displayed in component
            logger.warn(`Error uploading team avatar: ${error.message}`)
          }
        }
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
