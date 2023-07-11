import * as ChatTypes from './types/chat2'
import * as EngineGen from '../actions/engine-gen-gen'
import * as GregorConstants from './gregor'
import * as ConfigConstants from './config'
import * as RPCChatTypes from './types/rpc-chat-gen'
import * as RPCTypes from './types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as TeamBuildingConstants from './team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Types from './types/teams'
import * as Z from '../util/zustand'
import {isMobile, isPhone} from './platform'
import invert from 'lodash/invert'
import logger from '../logger'
import type {RetentionPolicy} from './types/retention-policy'
import type {TypedState} from './reducer'
import {RPCError} from '../util/errors'
import {mapGetEnsureValue} from '../util/map'
import {memoize} from '../util/memoize'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner'] as const

export const rpcMemberStatusToStatus = invert(RPCTypes.TeamMemberStatus) as {
  [K in RPCTypes.TeamMemberStatus]: keyof typeof RPCTypes.TeamMemberStatus
}

// Waiting keys
// Add granularity as necessary
export const teamsLoadedWaitingKey = 'teams:loaded'
export const teamsAccessRequestWaitingKey = 'teams:accessRequests'
export const joinTeamWaitingKey = 'teams:joinTeam'
export const teamWaitingKey = (teamID: Types.TeamID) => `team:${teamID}`

export const setMemberPublicityWaitingKey = (teamID: Types.TeamID) => `teamMemberPub:${teamID}`
export const teamGetWaitingKey = (teamID: Types.TeamID) => `teamGet:${teamID}`
export const teamTarsWaitingKey = (teamID: Types.TeamID) => `teamTars:${teamID}`
export const teamCreationWaitingKey = 'teamCreate'

export const addUserToTeamsWaitingKey = (username: string) => `addUserToTeams:${username}`
export const addPeopleToTeamWaitingKey = (teamname: Types.Teamname) => `teamAddPeople:${teamname}`
export const addToTeamByEmailWaitingKey = (teamname: Types.Teamname) => `teamAddByEmail:${teamname}`
export const getChannelsWaitingKey = (teamID: Types.TeamID) => `getChannels:${teamID}`
export const createChannelWaitingKey = (teamID: Types.TeamID) => `createChannel:${teamID}`
export const settingsWaitingKey = (teamID: Types.TeamID) => `teamSettings:${teamID}`
export const retentionWaitingKey = (teamID: Types.TeamID) => `teamRetention:${teamID}`
export const addMemberWaitingKey = (teamID: Types.TeamID, ...usernames: Array<string>) =>
  `teamAdd:${teamID};${usernames.join(',')}`
export const addInviteWaitingKey = (teamname: Types.Teamname, value: string) =>
  `teamAddInvite:${teamname};${value}`
// also for pending invites, hence id rather than username
export const removeMemberWaitingKey = (teamID: Types.TeamID, id: string) => `teamRemove:${teamID};${id}`
export const addToTeamSearchKey = 'addToTeamSearch'
export const teamProfileAddListWaitingKey = 'teamProfileAddList'
export const deleteChannelWaitingKey = (teamID: Types.TeamID) => `channelDelete:${teamID}`
export const deleteTeamWaitingKey = (teamID: Types.TeamID) => `teamDelete:${teamID}`
export const leaveTeamWaitingKey = (teamname: Types.Teamname) => `teamLeave:${teamname}`
export const teamRenameWaitingKey = 'teams:rename'
export const loadWelcomeMessageWaitingKey = (teamID: Types.TeamID) => `loadWelcomeMessage:${teamID}`
export const setWelcomeMessageWaitingKey = (teamID: Types.TeamID) => `setWelcomeMessage:${teamID}`
export const loadTeamTreeActivityWaitingKey = (teamID: Types.TeamID, username: string) =>
  `loadTeamTreeActivity:${teamID};${username}`
export const editMembershipWaitingKey = (teamID: Types.TeamID, ...usernames: Array<string>) =>
  `editMembership:${teamID};${usernames.join(',')}`
export const updateChannelNameWaitingKey = (teamID: Types.TeamID) => `updateChannelName:${teamID}`

export const initialMemberInfo = Object.freeze<Types.MemberInfo>({
  fullName: '',
  needsPUK: false,
  status: 'active',
  type: 'reader',
  username: '',
})

export const rpcDetailsToMemberInfos = (
  members: Array<RPCTypes.TeamMemberDetails>
): Map<string, Types.MemberInfo> => {
  const infos: Array<[string, Types.MemberInfo]> = []
  members.forEach(({fullName, joinTime, needsPUK, status, username, role}) => {
    const maybeRole = teamRoleByEnum[role]
    if (!maybeRole || maybeRole === 'none') {
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

export const emptyInviteInfo = Object.freeze<Types.InviteInfo>({
  email: '',
  id: '',
  name: '',
  phone: '',
  role: 'writer',
  username: '',
})

export const emptyEmailInviteError = Object.freeze<Types.EmailInviteError>({
  malformed: new Set<string>(),
  message: '',
})

const emptyTeamChannelInfo: Types.TeamChannelInfo = {
  channelname: '',
  conversationIDKey: '', // would be noConversationIDKey but causes import cycle
  description: '',
}

export const getTeamChannelInfo = (
  _state: unknown,
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
) => useState.getState().channelInfo.get(teamID)?.get(conversationIDKey) ?? emptyTeamChannelInfo

export const teamRoleByEnum = ((m: {[K in Types.MaybeTeamRoleType]: RPCTypes.TeamRole}) => {
  const mInv: {[K in RPCTypes.TeamRole]?: Types.MaybeTeamRoleType} = {}
  for (const roleStr in m) {
    // roleStr is typed as string; see
    // https://github.com/facebook/flow/issues/1736 .
    // @ts-ignore
    const role: Types.TeamRoleType = roleStr
    const e = m[role]
    mInv[e] = role
  }
  return mInv
})(RPCTypes.TeamRole)

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
export const compareTeamRoles = (a: Types.MaybeTeamRoleType, b: Types.MaybeTeamRoleType) => {
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
  a: Types.ActivityLevel | undefined,
  b: Types.ActivityLevel | undefined
) => {
  return activityLevelToCompare[b || 'none'] - activityLevelToCompare[a || 'none']
}

export const rpcTeamRoleMapAndVersionToTeamRoleMap = (
  m: RPCTypes.TeamRoleMapAndVersion
): Types.TeamRoleMap => {
  const ret: Types.TeamRoleMap = {
    latestKnownVersion: m.version,
    loadedVersion: m.version,
    roles: new Map<Types.TeamID, Types.TeamRoleAndDetails>(),
  }
  for (const key in m.teams) {
    const value = m.teams[key]
    if (value) {
      ret.roles.set(key, {
        implicitAdmin:
          value.implicitRole === RPCTypes.TeamRole.admin || value.implicitRole == RPCTypes.TeamRole.owner,
        role: teamRoleByEnum[value.role] || 'none',
      })
    }
  }
  return ret
}

export const typeToLabel: Types.TypeMap = {
  admin: 'Admin',
  bot: 'Bot',
  owner: 'Owner',
  reader: 'Reader',
  restrictedbot: 'Restricted bot',
  writer: 'Writer',
}

export const initialTeamSettings = Object.freeze({
  joinAs: RPCTypes.TeamRole.reader,
  open: false,
})

export const makeRetentionPolicy = (r?: Partial<RetentionPolicy>): RetentionPolicy => ({
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
  teamID: Types.noTeamID,
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

export const emptyErrorInEditMember = {error: '', teamID: Types.noTeamID, username: ''}

const emptyState: Types.State = {
  teamBuilding: TeamBuildingConstants.makeSubState(),
  teamMemberToLastActivity: new Map(),
  teamMemberToTreeMemberships: new Map(),
  teamProfileAddList: [],
  treeLoaderTeamIDToSparseMemberInfos: new Map(),
}

export const makeState = (s?: Partial<Types.State>): Types.State =>
  s ? Object.assign({...emptyState}, s) : emptyState

export const initialCanUserPerform = Object.freeze<Types.TeamOperations>({
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
  memberInfo: Map<string, Types.MemberInfo>,
  username: string,
  role: Types.TeamRoleType
): boolean => {
  const member = memberInfo.get(username)
  if (!member) {
    return false
  }
  return member.type === role
}

export const userIsRoleInTeam = (
  state: State,
  teamID: Types.TeamID,
  username: string,
  role: Types.TeamRoleType
): boolean => {
  return userIsRoleInTeamWithInfo(
    state.teamIDToMembers.get(teamID) || new Map<string, Types.MemberInfo>(),
    username,
    role
  )
}
export const isBot = (type: Types.TeamRoleType) => type === 'bot' || type === 'restrictedbot'
export const userInTeamNotBotWithInfo = (
  memberInfo: Map<string, Types.MemberInfo>,
  username: string
): boolean => {
  const memb = memberInfo.get(username)
  if (!memb) {
    return false
  }
  return !isBot(memb.type)
}

export const isTeamWithChosenChannels = (_: unknown, teamname: string): boolean =>
  useState.getState().teamsWithChosenChannels.has(teamname)

export const getRole = (state: State, teamID: Types.TeamID): Types.MaybeTeamRoleType =>
  state.teamRoleMap.roles.get(teamID)?.role || 'none'

export const getRoleByName = (state: State, teamname: string): Types.MaybeTeamRoleType =>
  getRole(state, getTeamID(state, teamname))

export const isLastOwner = (state: State, teamID: Types.TeamID): boolean =>
  isOwner(getRole(state, teamID)) && !isMultiOwnerTeam(teamID)

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
  teamID: Types.TeamID,
  membersToModify?: string | string[]
): Types.DisabledReasonsForRolePicker => {
  const canManageMembers = getCanPerformByID(state, teamID).manageMembers
  const teamMeta = getTeamMeta(state, teamID)
  const teamDetails = useState.getState().teamDetails.get(teamID)
  const members: Map<string, Types.MemberInfo> =
    teamDetails?.members || state.teamIDToMembers.get(teamID) || new Map<string, Types.MemberInfo>()
  const teamname = teamMeta.teamname
  let theyAreOwner = false
  if (typeof membersToModify === 'string') {
    const member = members.get(membersToModify)
    theyAreOwner = member?.type === 'owner'
  } else if (Array.isArray(membersToModify)) {
    theyAreOwner = membersToModify.some(username => members.get(username)?.type === 'owner')
  }

  const myUsername = ConfigConstants.useCurrentUserState.getState().username
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
      (Array.isArray(membersToModify) && membersToModify?.includes(myUsername))
    let noOtherOwners = true
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

const isMultiOwnerTeam = (teamID: Types.TeamID): boolean => {
  let countOfOwners = 0
  const allTeamMembers =
    useState.getState().teamDetails.get(teamID)?.members || new Map<string, Types.MemberInfo>()
  const moreThanOneOwner = [...allTeamMembers.values()].some(tm => {
    if (isOwner(tm.type)) {
      countOfOwners++
    }
    return countOfOwners > 1
  })
  return moreThanOneOwner
}

export const getTeamID = (state: State, teamname: Types.Teamname) =>
  state.teamNameToID.get(teamname) || Types.noTeamID

export const getTeamNameFromID = (state: State, teamID: Types.TeamID) => state.teamMeta.get(teamID)?.teamname

export const getTeamRetentionPolicyByID = (state: State, teamID: Types.TeamID) =>
  state.teamIDToRetentionPolicy.get(teamID)

/**
 *  Gets the number of channels you're subscribed to on a team
 */
export const getNumberOfSubscribedChannels = (state: TypedState, teamname: Types.Teamname): number =>
  [...state.chat2.metaMap.values()].reduce((count, c) => (count += c.teamname === teamname ? 1 : 0), 0)

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: TypedState, teamID: Types.TeamID): boolean => {
  const bigTeams = state.chat2.inboxLayout?.bigTeams
  return (bigTeams || []).some(
    v => v.state === RPCChatTypes.UIInboxBigTeamRowTyp.label && v.label.id === teamID
  )
}

export const initialPublicitySettings = Object.freeze<Types._PublicitySettings>({
  anyMemberShowcase: false,
  description: '',
  ignoreAccessRequests: false,
  member: false,
  team: false,
})

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

export const isInTeam = (state: State, teamname: Types.Teamname): boolean =>
  getRoleByName(state, teamname) !== 'none'

export const isInSomeTeam = (state: State): boolean =>
  [...state.teamRoleMap.roles.values()].some(rd => rd.role !== 'none')

export const getTeamResetUsers = (state: State, teamID: Types.TeamID): Set<string> =>
  state.teamIDToResetUsers.get(teamID) || new Set()

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

export const sortTeamsByName = memoize((teamMeta: Map<Types.TeamID, Types.TeamMeta>) =>
  [...teamMeta.values()].sort((a, b) => sortTeamnames(a.teamname, b.teamname))
)

// sorted by name
export const getSortedTeams = () => sortTeamsByName(useState.getState().teamMeta)

export const isAdmin = (type: Types.MaybeTeamRoleType) => type === 'admin'
export const isOwner = (type: Types.MaybeTeamRoleType) => type === 'owner'

// TODO make this check for only valid subteam names
export const isSubteam = (maybeTeamname: string) => {
  const subteams = maybeTeamname.split('.')
  if (subteams.length <= 1) {
    return false
  }
  return true
}
export const serviceRetentionPolicyToRetentionPolicy = (
  policy?: RPCChatTypes.RetentionPolicy | null
): RetentionPolicy => {
  // !policy implies a default policy of retainment
  let retentionPolicy: RetentionPolicy = makeRetentionPolicy({type: 'retain'})
  if (policy) {
    // replace retentionPolicy with whatever is explicitly set
    switch (policy.typ) {
      case RPCChatTypes.RetentionPolicyType.retain:
        retentionPolicy = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
        break
      case RPCChatTypes.RetentionPolicyType.expire: {
        if (!policy.expire) {
          throw new Error(`RPC returned retention policy of type 'expire' with no expire data`)
        }
        const {expire} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: expire.age,
          title: baseRetentionPoliciesTitleMap[expire.age] || `${expire.age} seconds`,
          type: 'expire',
        })
        break
      }
      case RPCChatTypes.RetentionPolicyType.ephemeral: {
        if (!policy.ephemeral) {
          throw new Error(`RPC returned retention policy of type 'ephemeral' with no ephemeral data`)
        }
        const {ephemeral} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: ephemeral.age,
          title: baseRetentionPoliciesTitleMap[ephemeral.age] || `${ephemeral.age} seconds`,
          type: 'explode',
        })
        break
      }
      case RPCChatTypes.RetentionPolicyType.inherit:
        retentionPolicy = makeRetentionPolicy({type: 'inherit'})
    }
  }
  return retentionPolicy
}

export const retentionPolicyToServiceRetentionPolicy = (
  policy: RetentionPolicy
): RPCChatTypes.RetentionPolicy => {
  let res: RPCChatTypes.RetentionPolicy | null = null
  switch (policy.type) {
    case 'retain':
      res = {retain: {}, typ: RPCChatTypes.RetentionPolicyType.retain}
      break
    case 'expire':
      res = {expire: {age: policy.seconds}, typ: RPCChatTypes.RetentionPolicyType.expire}
      break
    case 'explode':
      res = {ephemeral: {age: policy.seconds}, typ: RPCChatTypes.RetentionPolicyType.ephemeral}
      break
    case 'inherit':
      res = {inherit: {}, typ: RPCChatTypes.RetentionPolicyType.inherit}
      break
  }
  if (!res) {
    throw new Error(`Unable to convert retention policy of unknown type: ${policy.type}`)
  }
  return res
}

// How many public admins should we display on a showcased team card at once?
export const publicAdminsLimit = 6

export const chosenChannelsGregorKey = 'chosenChannelsForTeam'
export const newRequestsGregorPrefix = 'team.request_access:'
export const newRequestsGregorKey = (teamID: Types.TeamID) => `${newRequestsGregorPrefix}${teamID}`

// Merge new teamMeta objs into old ones, removing any old teams that are not in the new map
export const mergeTeamMeta = (oldMap: State['teamMeta'], newMap: State['teamMeta']) => {
  const ret = new Map(newMap)
  for (const [teamID, teamMeta] of newMap.entries()) {
    ret.set(teamID, {...oldMap.get(teamID), ...teamMeta})
  }
  return ret
}

export const emptyTeamMeta = Object.freeze<Types.TeamMeta>({
  allowPromote: false,
  id: Types.noTeamID,
  isMember: false,
  isOpen: false,
  memberCount: -1,
  role: 'none',
  showcasing: false,
  teamname: '',
})

export const makeTeamMeta = (td: Partial<Types.TeamMeta>): Types.TeamMeta =>
  td ? Object.assign({...emptyTeamMeta}, td) : emptyTeamMeta

export const getTeamMeta = (state: State, teamID: Types.TeamID) =>
  teamID === Types.newTeamWizardTeamID
    ? makeTeamMeta({
        id: teamID,
        isMember: true,
        isOpen: state.newTeamWizard.open,
        memberCount: 0,
        showcasing: state.newTeamWizard.profileShowcase,
        teamname: state.newTeamWizard.name == '' ? 'New team' : state.newTeamWizard.name,
      })
    : state.teamMeta.get(teamID) ?? emptyTeamMeta

export const getTeamMemberLastActivity = (
  state: TypedState,
  teamID: Types.TeamID,
  username: string
): number | null => state.teams.teamMemberToLastActivity.get(teamID)?.get(username) ?? null

export const teamListToMeta = (
  list: Array<RPCTypes.AnnotatedMemberInfo>
): Map<Types.TeamID, Types.TeamMeta> => {
  return new Map(
    list.map(t => [
      t.teamID,
      {
        allowPromote: t.allowProfilePromote,
        id: t.teamID,
        isMember: t.role !== RPCTypes.TeamRole.none,
        isOpen: t.isOpenTeam,
        memberCount: t.memberCount,
        role: teamRoleByEnum[t.role] || 'none',
        showcasing: t.isMemberShowcased,
        teamname: t.fqName,
      },
    ])
  )
}

type InviteDetails = {inviteLinks: Array<Types.InviteLink>; invites: Set<Types.InviteInfo>}
const annotatedInvitesToInviteDetails = (
  annotatedInvites: Array<RPCTypes.AnnotatedTeamInvite> = []
): InviteDetails =>
  annotatedInvites.reduce<InviteDetails>(
    (invitesAndLinks, annotatedInvite) => {
      const inviteMD = annotatedInvite.inviteMetadata
      const teamInvite = inviteMD.invite

      const {invites, inviteLinks} = invitesAndLinks
      const role = teamRoleByEnum[teamInvite.role]
      if (!role || role === 'none') {
        return invitesAndLinks
      }

      if (annotatedInvite.inviteExt.c === RPCTypes.TeamInviteCategory.invitelink) {
        const ext = annotatedInvite.inviteExt.invitelink
        const annotatedUsedInvites = ext.annotatedUsedInvites ?? []
        const lastJoinedUsername = annotatedUsedInvites
          ? annotatedUsedInvites[annotatedUsedInvites.length - 1]?.username
          : undefined
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
        if (teamInvite.type.c === RPCTypes.TeamInviteCategory.sbs) {
          username = annotatedInvite.displayName
        }
        invites.add({
          email: teamInvite.type.c === RPCTypes.TeamInviteCategory.email ? annotatedInvite.displayName : '',
          id: teamInvite.id,
          name: [RPCTypes.TeamInviteCategory.seitan].includes(teamInvite.type.c)
            ? annotatedInvite.displayName
            : '',
          phone: teamInvite.type.c === RPCTypes.TeamInviteCategory.phone ? annotatedInvite.displayName : '',
          role,
          username,
        })
      }
      return invitesAndLinks
    },
    {inviteLinks: [], invites: new Set()}
  )

export const emptyTeamDetails: Types.TeamDetails = {
  description: '',
  inviteLinks: [],
  invites: new Set(),
  members: new Map(),
  requests: new Set(),
  settings: {open: false, openJoinAs: 'reader', tarsDisabled: false, teamShowcased: false},
  subteams: new Set(),
}

export const emptyTeamSettings = Object.freeze(emptyTeamDetails.settings)

export const annotatedTeamToDetails = (t: RPCTypes.AnnotatedTeam): Types.TeamDetails => {
  const maybeOpenJoinAs = teamRoleByEnum[t.settings.joinAs] ?? 'reader'
  const members = new Map<string, Types.MemberInfo>()
  t.members?.forEach(member => {
    const {fullName, needsPUK, status, username} = member
    const maybeRole = teamRoleByEnum[member.role]
    members.set(username, {
      fullName,
      joinTime: member.joinTime || undefined,
      needsPUK,
      status: rpcMemberStatusToStatus[status],
      type: !maybeRole || maybeRole === 'none' ? 'reader' : maybeRole,
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
    subteams: new Set(t.transitiveSubteamsUnverified?.entries?.map(e => e.teamID) ?? []),
  }
}

// Keep in sync with constants/notifications#badgeStateToBadgeCounts
// Don't count new team because those are shown with a 'NEW' meta instead of badge
export const getTeamRowBadgeCount = (
  newTeamRequests: Store['newTeamRequests'],
  teamIDToResetUsers: Store['teamIDToResetUsers'],
  teamID: Types.TeamID
) => {
  return newTeamRequests.get(teamID)?.size ?? 0 + (teamIDToResetUsers.get(teamID)?.size ?? 0)
}

export const canShowcase = (state: State, teamID: Types.TeamID) => {
  const role = getRole(state, teamID)
  return getTeamMeta(state, teamID).allowPromote || role === 'admin' || role === 'owner'
}

const _canUserPerformCache: {[key: string]: Types.TeamOperations} = {}
const _canUserPerformCacheKey = (t: Types.TeamRoleAndDetails) => t.role + t.implicitAdmin
export const deriveCanPerform = (roleAndDetails?: Types.TeamRoleAndDetails): Types.TeamOperations => {
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

export const getCanPerform = (state: State, teamname: Types.Teamname): Types.TeamOperations =>
  getCanPerformByID(state, getTeamID(state, teamname))

export const getCanPerformByID = (state: State, teamID: Types.TeamID): Types.TeamOperations =>
  deriveCanPerform(state.teamRoleMap.roles.get(teamID))

// Don't allow version to roll back
export const ratchetTeamVersion = (newVersion: Types.TeamVersion, oldVersion?: Types.TeamVersion) =>
  oldVersion
    ? {
        latestHiddenSeqno: Math.max(newVersion.latestHiddenSeqno, oldVersion.latestHiddenSeqno),
        latestOffchainSeqno: Math.max(newVersion.latestOffchainSeqno, oldVersion.latestOffchainSeqno),
        latestSeqno: Math.max(newVersion.latestSeqno, oldVersion.latestSeqno),
      }
    : newVersion

export const dedupAddingMembeers = (
  _existing: Array<Types.AddingMember>,
  toAdds: Array<Types.AddingMember>
) => {
  const existing = [..._existing]
  for (const toAdd of toAdds) {
    if (!existing.find(m => m.assertion === toAdd.assertion)) {
      existing.unshift(toAdd)
    }
  }
  return existing
}

export const coerceAssertionRole = (mem: Types.AddingMember): Types.AddingMember => {
  if (mem.assertion.includes('@') && ['admin, owner'].includes(mem.role)) {
    return {...mem, role: 'writer'}
  }
  return mem
}

export const lastActiveStatusToActivityLevel: {
  [key in RPCChatTypes.LastActiveStatus]: Types.ActivityLevel
} = {
  [RPCChatTypes.LastActiveStatus.active]: 'active',
  [RPCChatTypes.LastActiveStatus.none]: 'none',
  [RPCChatTypes.LastActiveStatus.recentlyActive]: 'recently',
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
  value: RPCTypes.TeamTreeMembershipValue
): Types.TreeloaderSparseMemberInfo => {
  return {
    joinTime: value.joinTime ?? undefined,
    type: teamRoleByEnum[value.role] || 'none',
  }
}

// maybeGetSparseMemberInfo first looks in the details, which should be kept up-to-date, then looks
// in the treeloader-powered map (which can go stale) as a backup. If it returns null, it means we
// don't know the answer (yet). If it returns type='none', that means the user is not in the team.
export const maybeGetSparseMemberInfo = (state: TypedState, teamID: string, username: string) => {
  const details = useState.getState().teamDetails.get(teamID)
  if (details) {
    return details.members.get(username) ?? {type: 'none'}
  }
  return state.teams.treeLoaderTeamIDToSparseMemberInfos.get(teamID)?.get(username)
}

export const countValidInviteLinks = (inviteLinks: Array<Types.InviteLink>): Number => {
  return inviteLinks.reduce((t, inviteLink) => {
    if (inviteLink.isValid) {
      return t + 1
    }
    return t
  }, 0)
}

export const maybeGetMostRecentValidInviteLink = (inviteLinks: Array<Types.InviteLink>) =>
  inviteLinks.find(inviteLink => inviteLink.isValid)

export type Store = {
  activityLevels: Types.ActivityLevels
  addUserToTeamsResults: string
  addUserToTeamsState: Types.AddUserToTeamsState
  channelInfo: Map<Types.TeamID, Map<ChatTypes.ConversationIDKey, Types.TeamChannelInfo>>
  channelSelectedMembers: Map<ChatTypes.ConversationIDKey, Set<string>>
  creatingChannels: boolean
  deletedTeams: Array<RPCTypes.DeletedTeamInfo>
  errorInAddToTeam: string
  errorInChannelCreation: string
  errorInEditDescription: string
  errorInEditMember: {error: string; teamID: Types.TeamID; username: string}
  errorInEditWelcomeMessage: string
  errorInEmailInvite: Types.EmailInviteError
  errorInSettings: string
  newTeamRequests: Map<Types.TeamID, Set<string>>
  newTeams: Set<Types.TeamID>
  teamIDToResetUsers: Map<Types.TeamID, Set<string>>
  teamIDToWelcomeMessage: Map<Types.TeamID, RPCChatTypes.WelcomeMessageDisplay>
  teamNameToLoadingInvites: Map<Types.Teamname, Map<string, boolean>>
  errorInTeamCreation: string
  teamNameToID: Map<Types.Teamname, string>
  teamMetaSubscribeCount: number // if >0 we are eagerly reloading team list
  teamnames: Set<Types.Teamname> // TODO remove
  teamMetaStale: boolean // if we've received an update since we last loaded team list
  teamMeta: Map<Types.TeamID, Types.TeamMeta>
  invitesCollapsed: Set<Types.TeamID>
  teamsWithChosenChannels: Set<Types.Teamname>
  teamRoleMap: Types.TeamRoleMap
  sawChatBanner: boolean
  sawSubteamsBanner: boolean
  subteamFilter: string
  subteamsFiltered: Set<Types.TeamID> | undefined
  teamDetails: Map<Types.TeamID, Types.TeamDetails>
  teamDetailsSubscriptionCount: Map<Types.TeamID, number> // >0 if we are eagerly reloading a team
  teamSelectedChannels: Map<Types.TeamID, Set<string>>
  teamSelectedMembers: Map<Types.TeamID, Set<string>>
  teamAccessRequestsPending: Set<Types.Teamname>
  teamListFilter: string
  teamListSort: Types.TeamListSort
  newTeamWizard: Types.NewTeamWizardState
  addMembersWizard: Types.AddMembersWizardState
  errorInTeamJoin: string
  teamInviteDetails: Types.TeamInviteState
  teamJoinSuccess: boolean
  teamJoinSuccessOpen: boolean
  teamJoinSuccessTeamName: string
  teamVersion: Map<Types.TeamID, Types.TeamVersion>
  teamIDToMembers: Map<Types.TeamID, Map<string, Types.MemberInfo>> // Used by chat sidebar until team loading gets easier
  teamIDToRetentionPolicy: Map<Types.TeamID, RetentionPolicy>
}

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
  teamMeta: new Map(),
  teamMetaStale: true, // start out true, we have not loaded
  teamMetaSubscribeCount: 0,
  teamNameToID: new Map(),
  teamNameToLoadingInvites: new Map(),
  teamRoleMap: {latestKnownVersion: -1, loadedVersion: -1, roles: new Map()},
  teamSelectedChannels: new Map(),
  teamSelectedMembers: new Map(),
  teamVersion: new Map(),
  teamnames: new Set(),
  teamsWithChosenChannels: new Set(),
}

export type State = Store & {
  dispatch: {
    addMembersWizardPushMembers: (members: Array<Types.AddingMember>) => void
    addMembersWizardRemoveMember: (assertion: string) => void
    addMembersWizardSetDefaultChannels: (
      toAdd?: Array<Types.ChannelNameID>,
      toRemove?: Types.ChannelNameID
    ) => void
    addTeamWithChosenChannels: (teamID: Types.TeamID) => void
    addToTeam: (
      teamID: Types.TeamID,
      users: Array<{assertion: string; role: Types.TeamRoleType}>,
      sendChatNotification: boolean,
      fromTeamBuilder?: boolean
    ) => void
    addUserToTeams: (role: Types.TeamRoleType, teams: Array<string>, user: string) => void
    cancelAddMembersWizard: () => void
    channelSetMemberSelected: (
      conversationIDKey: ChatTypes.ConversationIDKey,
      username: string,
      selected: boolean,
      clearAll?: boolean
    ) => void
    checkRequestedAccess: (teamname: string) => void
    clearAddUserToTeamsResults: () => void
    createChannels: (teamID: Types.TeamID, channelnames: Array<string>) => void
    createNewTeam: (
      teamname: string,
      joinSubteam: boolean,
      fromChat?: boolean,
      thenAddMembers?: {
        users: Array<{assertion: string; role: Types.TeamRoleType}>
        sendChatNotification: boolean
        fromTeamBuilder?: boolean
      }
    ) => void
    createNewTeamFromConversation: (conversationIDKey: ChatTypes.ConversationIDKey, teamname: string) => void
    editMembership: (teamID: Types.TeamID, usernames: Array<string>, role: Types.TeamRoleType) => void
    editTeamDescription: (teamID: Types.TeamID, description: string) => void
    finishNewTeamWizard: () => void
    finishedAddMembersWizard: () => void
    getActivityForTeams: () => void
    getMembers: (teamID: Types.TeamID) => void
    getTeamRetentionPolicy: (teamID: Types.TeamID) => void
    getTeams: (subscribe?: boolean, forceReload?: boolean) => void
    inviteToTeamByEmail: (
      invitees: string,
      role: Types.TeamRoleType,
      teamID: Types.TeamID,
      teamname: string,
      loadingKey?: string
    ) => void
    joinTeam: (teamname: string, deeplink?: boolean) => void
    launchNewTeamWizardOrModal: (subteamOf?: Types.TeamID) => void
    loadTeam: (teamID: Types.TeamID, _subscribe?: boolean) => void
    loadTeamChannelList: (teamID: Types.TeamID) => void
    loadWelcomeMessage: (teamID: Types.TeamID) => void
    loadedWelcomeMessage: (teamID: Types.TeamID, message: RPCChatTypes.WelcomeMessageDisplay) => void
    openInviteLink: (inviteID: string, inviteKey: string) => void
    refreshTeamRoleMap: () => void
    requestInviteLinkDetails: () => void
    resetErrorInEmailInvite: () => void
    resetErrorInSettings: () => void
    resetErrorInTeamCreation: () => void
    resetState: 'default'
    resetTeamMetaStale: () => void
    resetTeamJoin: () => void
    respondToInviteLink: (accept: boolean) => void
    setAddMembersWizardIndividualRole: (assertion: string, role: Types.AddingMemberTeamRoleType) => void
    setAddMembersWizardRole: (role: Types.AddingMemberTeamRoleType | 'setIndividually') => void
    setChannelCreationError: (error: string) => void
    setChannelSelected: (teamID: Types.TeamID, channel: string, selected: boolean, clearAll?: boolean) => void
    setJustFinishedAddMembersWizard: (justFinished: boolean) => void
    setMemberPublicity: (teamID: Types.TeamID, showcase: boolean) => void
    setMemberSelected: (teamID: Types.TeamID, username: string, selected: boolean, clearAll?: boolean) => void
    setNewTeamInfo: (
      deletedTeams: Array<RPCTypes.DeletedTeamInfo>,
      newTeams: Set<Types.TeamID>,
      teamIDToResetUsers: Map<Types.TeamID, Set<string>>
    ) => void
    setNewTeamRequests: (newTeamRequests: Map<Types.TeamID, Set<string>>) => void
    setSubteamFilter: (filter: string, parentTeam?: Types.TeamID) => void
    setTeamListFilterSort: (filter?: string, sortOrder?: Types.TeamListSort) => void
    setTeamRetentionPolicy: (teamID: Types.TeamID, policy: RetentionPolicy) => void
    setTeamRoleMapLatestKnownVersion: (version: number) => void
    setTeamSawChatBanner: () => void
    setTeamSawSubteamsBanner: () => void
    setTeamWizardAvatar: (crop?: Types.AvatarCrop, filename?: string) => void
    setTeamWizardChannels: (channels: Array<string>) => void
    setTeamWizardNameDescription: (p: {
      teamname: string
      description: string
      openTeam: boolean
      openTeamJoinRole: Types.TeamRoleType
      profileShowcase: boolean
      addYourself: boolean
    }) => void
    setTeamWizardSubteamMembers: (members: Array<string>) => void
    setTeamWizardSubteams: (subteams: Array<string>) => void
    setTeamWizardTeamSize: (isBig: boolean) => void
    setTeamWizardTeamType: (teamType: Types.TeamWizardTeamType) => void
    setTeamsWithChosenChannels: (teamsWithChosenChannels: Set<Types.TeamID>) => void
    setWelcomeMessage: (teamID: Types.TeamID, message: RPCChatTypes.WelcomeMessage) => void
    startAddMembersWizard: (teamID: Types.TeamID) => void
    teamChangedByID: (c: EngineGen.Keybase1NotifyTeamTeamChangedByIDPayload['payload']['params']) => void
    toggleInvitesCollapsed: (teamID: Types.TeamID) => void
    unsubscribeTeamDetails: (teamID: Types.TeamID) => void
    unsubscribeTeamList: () => void
    updateTeamRetentionPolicy: (metas: Array<ChatTypes.ConversationMeta>) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const getReduxStore = Z.getReduxStore() // TODO remoe >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  const _respondToInviteLink = () => {
    // should be overridden
  }
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
          teamID === Types.newTeamWizardTeamID
            ? []
            : await RPCTypes.teamsFindAssertionsInTeamNoResolveRpcPromise({
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

        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamConfirm']}))
      }
      Z.ignorePromise(f())
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
          const pushState = await RPCTypes.gregorGetStateRpcPromise(undefined, teamWaitingKey(teamID))
          const item = pushState?.items?.find(i => i.item?.category === chosenChannelsGregorKey)
          let teams: Array<string> = []
          let msgID: Buffer | undefined
          if (item?.item?.body) {
            const body = item.item.body
            msgID = item.md?.msgID
            teams = GregorConstants.bodyToJSON(body)
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
          await RPCTypes.gregorUpdateCategoryRpcPromise(
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
      Z.ignorePromise(f())
    },
    addToTeam: (teamID, users, sendChatNotification, fromTeamBuilder) => {
      set(s => {
        s.errorInAddToTeam = ''
      })
      const f = async () => {
        try {
          const res = await RPCTypes.teamsTeamAddMembersMultiRoleRpcPromise(
            {
              sendChatNotification,
              teamID,
              users: users.map(({assertion, role}) => ({
                assertion: assertion,
                role: RPCTypes.TeamRole[role],
              })),
            },
            [teamWaitingKey(teamID), addMemberWaitingKey(teamID, ...users.map(({assertion}) => assertion))]
          )
          if (res.notAdded && res.notAdded.length > 0) {
            const usernames = res.notAdded.map(elem => elem.username)
            reduxDispatch(TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}))
            reduxDispatch(
              RouteTreeGen.createNavigateAppend({
                path: [{props: {source: 'teamAddSomeFailed', usernames}, selected: 'contactRestricted'}],
              })
            )
            return
          }

          set(s => {
            s.errorInAddToTeam = ''
          })
          if (fromTeamBuilder) {
            reduxDispatch(TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}))
          }
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // If all of the users couldn't be added due to contact settings, the RPC fails.
          if (error.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
            const users = (error.fields as Array<{key?: string; value?: string} | undefined> | undefined)
              ?.filter(elem => elem?.key === 'usernames')
              .map(elem => elem?.value)
            const usernames = users?.[0]?.split(',') ?? []
            reduxDispatch(TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}))
            reduxDispatch(
              RouteTreeGen.createNavigateAppend({
                path: [{props: {source: 'teamAddAllFailed', usernames}, selected: 'contactRestricted'}],
              })
            )
            return
          }

          const msg = error.desc
          set(s => {
            s.errorInAddToTeam = msg
          })
          // TODO this should not error on member already in team
          if (fromTeamBuilder) {
            reduxDispatch(TeamBuildingGen.createSetError({error: msg, namespace: 'teams'}))
          }
        }
      }
      Z.ignorePromise(f())
    },
    addUserToTeams: (role, teams, user) => {
      const f = async () => {
        const teamsAddedTo: Array<string> = []
        const errorAddingTo: Array<string> = []
        for (const team of teams) {
          try {
            const teamID = getTeamID(get(), team)
            if (teamID === Types.noTeamID) {
              logger.warn(`no team ID found for ${team}`)
              errorAddingTo.push(team)
              continue
            }
            await RPCTypes.teamsTeamAddMemberRpcPromise(
              {
                email: '',
                phone: '',
                role: RPCTypes.TeamRole[role],
                sendChatNotification: true,
                teamID,
                username: user,
              },
              [teamWaitingKey(teamID), addUserToTeamsWaitingKey(user)]
            )
            teamsAddedTo.push(team)
          } catch (error) {
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
      Z.ignorePromise(f())
    },
    cancelAddMembersWizard: () => {
      set(s => {
        s.addMembersWizard = {...addMembersWizardEmptyState}
      })
      reduxDispatch(RouteTreeGen.createClearModals())
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
        const result = await RPCTypes.teamsTeamListMyAccessRequestsRpcPromise(
          {},
          teamsAccessRequestWaitingKey
        )
        set(s => {
          s.teamAccessRequestsPending = new Set<Types.Teamname>(
            result?.map(row => row.parts?.join('.') ?? '')
          )
        })
      }
      Z.ignorePromise(f())
    },
    clearAddUserToTeamsResults: () => {
      set(s => {
        s.addUserToTeamsResults = ''
        s.addUserToTeamsState = 'notStarted'
      })
    },
    createChannels: (teamID, channelnames) => {
      set(s => {
        s.creatingChannels = true
      })
      const f = async () => {
        const teamname = getTeamNameFromID(get(), teamID)
        if (teamname === null) {
          get().dispatch.setChannelCreationError('Invalid team name')
          return
        }

        try {
          for (const c of channelnames) {
            await RPCChatTypes.localNewConversationLocalRpcPromise({
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
              membersType: RPCChatTypes.ConversationMembersType.team,
              tlfName: teamname ?? '',
              tlfVisibility: RPCTypes.TLFVisibility.private,
              topicName: c,
              topicType: RPCChatTypes.TopicType.chat,
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
      Z.ignorePromise(f())
    },
    createNewTeam: (teamname, joinSubteam, fromChat, thenAddMembers) => {
      set(s => {
        s.errorInTeamCreation = ''
      })
      const f = async () => {
        try {
          const {teamID} = await RPCTypes.teamsTeamCreateRpcPromise(
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
            reduxDispatch(RouteTreeGen.createClearModals())
            reduxDispatch(Chat2Gen.createNavigateToInbox())
            reduxDispatch(
              Chat2Gen.createPreviewConversation({channelname: 'general', reason: 'convertAdHoc', teamname})
            )
          } else {
            reduxDispatch(RouteTreeGen.createClearModals())
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
            if (isMobile) {
              reduxDispatch(
                RouteTreeGen.createNavigateAppend({
                  path: [{props: {createdTeam: true, teamID}, selected: 'profileEditAvatar'}],
                })
              )
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
      Z.ignorePromise(f())
    },
    createNewTeamFromConversation: (conversationIDKey, teamname) => {
      set(s => {
        s.errorInTeamCreation = ''
      })
      const f = async () => {
        const ChatConstants = await import('./chat2')
        const me = ConfigConstants.useCurrentUserState.getState().username
        const participantInfo = ChatConstants.getParticipantInfo(getReduxStore(), conversationIDKey)
        // exclude bots from the newly created team, they can be added back later.
        const participants = participantInfo.name.filter(p => p !== me) // we will already be in as 'owner'
        const users = participants.map(assertion => ({
          assertion,
          role: assertion === me ? ('admin' as const) : ('writer' as const),
        }))
        get().dispatch.createNewTeam(teamname, false, true, {sendChatNotification: true, users})
      }
      Z.ignorePromise(f())
    },
    editMembership: (teamID, usernames, r) => {
      const f = async () => {
        const role = RPCTypes.TeamRole[r]
        try {
          await RPCTypes.teamsTeamEditMembersRpcPromise(
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
      Z.ignorePromise(f())
    },
    editTeamDescription: (teamID, description) => {
      set(s => {
        s.errorInEditDescription = ''
      })
      const f = async () => {
        try {
          await RPCTypes.teamsSetTeamShowcaseRpcPromise({description, teamID}, teamWaitingKey(teamID))
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              s.errorInEditDescription = error.message
            }
          })
        }
      }
      Z.ignorePromise(f())
    },
    finishNewTeamWizard: () => {
      set(s => {
        s.newTeamWizard.error = undefined
      })
      const f = async () => {
        const {name, description, open, openTeamJoinRole, profileShowcase, addYourself} = get().newTeamWizard
        const {avatarFilename, avatarCrop, channels, subteams} = get().newTeamWizard
        const teamInfo: RPCTypes.TeamCreateFancyInfo = {
          avatar: avatarFilename ? {avatarFilename, crop: avatarCrop?.crop} : null,
          chatChannels: channels,
          description,
          joinSubteam: addYourself,
          name,
          openSettings: {joinAs: RPCTypes.TeamRole[openTeamJoinRole], open},
          profileShowcase,
          subteams,
          users: get().addMembersWizard.addingMembers.map(member => ({
            assertion: member.assertion,
            role: RPCTypes.TeamRole[member.role],
          })),
        }
        try {
          const teamID = await RPCTypes.teamsTeamCreateFancyRpcPromise({teamInfo}, teamCreationWaitingKey)
          set(s => {
            s.newTeamWizard = newTeamWizardEmptyState
            s.addMembersWizard = {...addMembersWizardEmptyState, justFinished: true}
          })
          reduxDispatch(RouteTreeGen.createClearModals())
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
        } catch (error) {
          set(s => {
            if (error instanceof RPCError) {
              s.newTeamWizard.error = error.desc
            }
          })
        }
      }
      Z.ignorePromise(f())
    },
    finishedAddMembersWizard: () => {
      set(s => {
        s.addMembersWizard = {...addMembersWizardEmptyState, justFinished: true}
      })
      reduxDispatch(RouteTreeGen.createClearModals())
    },
    getActivityForTeams: () => {
      const f = async () => {
        try {
          const results = await RPCChatTypes.localGetLastActiveForTeamsRpcPromise()
          const teams = Object.entries(results.teams).reduce<Map<Types.TeamID, Types.ActivityLevel>>(
            (res, [teamID, status]) => {
              if (status === RPCChatTypes.LastActiveStatus.none) {
                return res
              }
              res.set(teamID, lastActiveStatusToActivityLevel[status])
              return res
            },
            new Map()
          )
          const channels = Object.entries(results.channels).reduce<
            Map<ChatTypes.ConversationIDKey, Types.ActivityLevel>
          >((res, [conversationIDKey, status]) => {
            if (status === RPCChatTypes.LastActiveStatus.none) {
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
      Z.ignorePromise(f())
    },
    getMembers: (teamID: Types.TeamID) => {
      const f = async () => {
        try {
          const res = await RPCTypes.teamsTeamGetMembersByIDRpcPromise({
            id: teamID,
          })
          const members = rpcDetailsToMemberInfos(res ?? [])
          set(s => {
            s.teamIDToMembers.set(teamID, members)
          })
          // TODO update users members >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
          // [TeamsGen.setMembers]: (draftState, action) => {
          //   const {members} = action.payload
          //   const {infoMap} = draftState
          //   members.forEach((v, username) => {
          //     updateInfo(infoMap, username, {fullname: v.fullName})
          //   })
          // },
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error updating members for ${teamID}: ${error.desc}`)
          }
        }
        return
      }
      Z.ignorePromise(f())
    },
    getTeamRetentionPolicy: teamID => {
      const f = async () => {
        let retentionPolicy = makeRetentionPolicy()
        try {
          const policy = await RPCChatTypes.localGetTeamRetentionLocalRpcPromise(
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
        } catch (_) {}
        set(s => {
          s.teamIDToRetentionPolicy.set(teamID, retentionPolicy)
        })
      }
      Z.ignorePromise(f())
    },
    getTeams: (subscribe, forceReload) => {
      if (subscribe) {
        set(s => {
          s.teamMetaSubscribeCount++
        })
      }

      const f = async () => {
        const username = ConfigConstants.useCurrentUserState.getState().username
        const loggedIn = ConfigConstants.useConfigState.getState().loggedIn
        if (!username || !loggedIn) {
          logger.warn('getTeams while logged out')
          return
        }
        if (!forceReload && !get().teamMetaStale) {
          // bail
          return
        }
        try {
          const results = await RPCTypes.teamsTeamListUnverifiedRpcPromise(
            {includeImplicitTeams: false, userAssertion: username},
            teamsLoadedWaitingKey
          )
          const teams: Array<RPCTypes.AnnotatedMemberInfo> = results.teams || []
          const teamnames: Array<string> = []
          const teamNameToID = new Map<string, Types.TeamID>()
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
            if (error.code === RPCTypes.StatusCode.scapinetworkerror) {
              // Ignore API errors due to offline
            } else {
              logger.error(error)
            }
          }
        }
      }
      Z.ignorePromise(f())
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
          const res = await RPCTypes.teamsTeamAddEmailsBulkRpcPromise(
            {
              emails: invitees,
              name: teamname,
              role: role ? RPCTypes.TeamRole[role] : RPCTypes.TeamRole.none,
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
            //
            get().dispatch.resetErrorInEmailInvite()
            if (!isMobile) {
              // mobile does not nav away
              reduxDispatch(RouteTreeGen.createClearModals())
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
      Z.ignorePromise(f())
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
          const result = await RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcListener(
            {
              customResponseIncomingCallMap: {
                'keybase.1.teamsUi.confirmInviteLinkAccept': (params, response) => {
                  set(s => {
                    s.teamInviteDetails.inviteDetails = params.details
                  })
                  if (!deeplink) {
                    reduxDispatch(
                      RouteTreeGen.createNavigateAppend({path: ['teamInviteLinkJoin'], replace: true})
                    )
                  }
                  set(s => {
                    s.dispatch.respondToInviteLink = accept => {
                      response.result(accept)
                      set(s => {
                        s.dispatch.respondToInviteLink = _respondToInviteLink
                      })
                    }
                  })
                },
              },
              incomingCallMap: {},
              params: {tokenOrName: teamname},
              waitingKey: joinTeamWaitingKey,
            },
            Z.dummyListenerApi
          )
          set(s => {
            s.teamJoinSuccess = true
            s.teamJoinSuccessOpen = result?.wasOpenTeam ?? false
            s.teamJoinSuccessTeamName = result?.wasTeamName ? teamname : ''
          })
        } catch (error) {
          if (error instanceof RPCError) {
            const desc =
              error.code === RPCTypes.StatusCode.scteaminvitebadtoken
                ? 'Sorry, that team name or token is not valid.'
                : error.code === RPCTypes.StatusCode.scnotfound
                ? 'This invitation is no longer valid, or has expired.'
                : error.desc
            set(s => {
              s.errorInTeamJoin = desc
            })
          }
        } finally {
          set(s => {
            s.dispatch.respondToInviteLink = _respondToInviteLink
          })
        }
      }
      Z.ignorePromise(f())
    },
    launchNewTeamWizardOrModal: subteamOf => {
      set(s => {
        s.newTeamWizard = {
          ...newTeamWizardEmptyState,
          parentTeamID: subteamOf,
          teamType: 'subteam',
        }
      })

      if (subteamOf) {
        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard2TeamInfo']}))
      } else {
        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard1TeamPurpose']}))
      }
    },
    loadTeam: (teamID, subscribe) => {
      set(s => {
        if (subscribe) {
          s.teamDetailsSubscriptionCount.set(teamID, (s.teamDetailsSubscriptionCount.get(teamID) ?? 0) + 1)
        }
      })
      const f = async () => {
        if (!teamID || teamID === Types.noTeamID) {
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
          const team = await RPCTypes.teamsGetAnnotatedTeamRpcPromise({teamID})
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
            s.teamDetails.set(teamID, details)
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(error.message)
          }
        }
      }
      Z.ignorePromise(f())
    },
    loadTeamChannelList: teamID => {
      const f = async () => {
        const teamname = getTeamMeta(get(), teamID).teamname
        if (!teamname) {
          logger.warn('bailing on no teamMeta')
          return
        }
        try {
          const {convs} = await RPCChatTypes.localGetTLFConversationsLocalRpcPromise({
            membersType: RPCChatTypes.ConversationMembersType.team,
            tlfName: teamname,
            topicType: RPCChatTypes.TopicType.chat,
          })
          const channels =
            convs?.reduce<Map<ChatTypes.ConversationIDKey, Types.TeamChannelInfo>>((res, inboxUIItem) => {
              const conversationIDKey = ChatTypes.stringToConversationIDKey(inboxUIItem.convID)
              res.set(conversationIDKey, {
                channelname: inboxUIItem.channel,
                conversationIDKey,
                description: inboxUIItem.headline,
              })
              return res
            }, new Map()) ?? new Map<ChatTypes.ConversationIDKey, Types.TeamChannelInfo>()

          // ensure we refresh participants, but don't fail the saga if this somehow fails
          try {
            for (const c of channels.values()) {
              Z.ignorePromise(
                RPCChatTypes.localRefreshParticipantsRpcPromise({
                  convID: ChatTypes.keyToConversationID(c.conversationIDKey),
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
      Z.ignorePromise(f())
    },
    loadWelcomeMessage: teamID => {
      const f = async () => {
        try {
          const message = await RPCChatTypes.localGetWelcomeMessageRpcPromise(
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
      Z.ignorePromise(f())
    },
    loadedWelcomeMessage: (teamID, message) => {
      set(s => {
        s.teamIDToWelcomeMessage.set(teamID, message)
      })
    },
    openInviteLink: (inviteID, inviteKey) => {
      set(s => {
        s.teamInviteDetails.inviteDetails = undefined
        s.teamInviteDetails.inviteID = inviteID
        s.teamInviteDetails.inviteKey = inviteKey
      })
      reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamInviteLinkJoin']}))
    },
    refreshTeamRoleMap: () => {
      const f = async () => {
        try {
          const _map = await RPCTypes.teamsGetTeamRoleMapRpcPromise()
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
      Z.ignorePromise(f())
    },
    requestInviteLinkDetails: () => {
      const f = async () => {
        try {
          const details = await RPCTypes.teamsGetInviteLinkDetailsRpcPromise({
            inviteID: get().teamInviteDetails.inviteID,
          })
          set(s => {
            s.teamInviteDetails.inviteDetails = details
          })
        } catch (error) {
          if (error instanceof RPCError) {
            const desc =
              error.code === RPCTypes.StatusCode.scteaminvitebadtoken
                ? 'Sorry, that invite token is not valid.'
                : error.code === RPCTypes.StatusCode.scnotfound
                ? 'This invitation is no longer valid, or has expired.'
                : error.desc
            set(s => {
              s.errorInTeamJoin = desc
            })
          }
        }
      }
      Z.ignorePromise(f())
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
    respondToInviteLink: _respondToInviteLink,
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
          await RPCTypes.teamsSetTeamMemberShowcaseRpcPromise({isShowcased: showcase, teamID}, [
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
      Z.ignorePromise(f())
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
        s.deletedTeams = deletedTeams
        s.newTeams = newTeams
        s.teamIDToResetUsers = teamIDToResetUsers
      })
    },
    setNewTeamRequests: newTeamRequests => {
      set(s => {
        s.newTeamRequests = newTeamRequests
      })
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
    setTeamListFilterSort: (filter, sortOrder) => {
      set(s => {
        if (filter !== undefined) {
          s.teamListFilter = filter
        }
        if (sortOrder !== undefined) {
          s.teamListSort = sortOrder
        }
      })
    },
    setTeamRetentionPolicy: (teamID, policy) => {
      const f = async () => {
        try {
          const servicePolicy = retentionPolicyToServiceRetentionPolicy(policy)
          await RPCChatTypes.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
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
      Z.ignorePromise(f())
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
            reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizardSubteamMembers']}))
            return
          } else {
            get().dispatch.startAddMembersWizard(Types.newTeamWizardTeamID)
            return
          }
        }
        case 'friends':
        case 'other':
          get().dispatch.startAddMembersWizard(Types.newTeamWizardTeamID)
          return
        case 'project':
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard5Channels']}))
          return
        case 'community':
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard4TeamSize']}))
          return
      }
    },
    setTeamWizardChannels: channels => {
      set(s => {
        s.newTeamWizard.channels = channels
      })
      reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard6Subteams']}))
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
      reduxDispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {createdTeam: true, teamID: Types.newTeamWizardTeamID, wizard: true},
              selected: 'profileEditAvatar',
            },
          ],
        })
      )
    },
    setTeamWizardSubteamMembers: members => {
      set(s => {
        s.addMembersWizard = {
          ...addMembersWizardEmptyState,
          addingMembers: members.map(m => ({assertion: m, role: 'writer'})),
          teamID: Types.newTeamWizardTeamID,
        }
      })
      reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamConfirm']}))
    },
    setTeamWizardSubteams: subteams => {
      set(s => {
        s.newTeamWizard.subteams = subteams
      })
      get().dispatch.startAddMembersWizard(Types.newTeamWizardTeamID)
    },
    setTeamWizardTeamSize: isBig => {
      set(s => {
        s.newTeamWizard.isBig = isBig
      })
      if (isBig) {
        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard5Channels']}))
      } else {
        get().dispatch.startAddMembersWizard(Types.newTeamWizardTeamID)
      }
    },
    setTeamWizardTeamType: teamType => {
      set(s => {
        s.newTeamWizard.teamType = teamType
      })
      reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamWizard2TeamInfo']}))
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
          await RPCChatTypes.localSetWelcomeMessageRpcPromise(
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
      Z.ignorePromise(f())
    },
    startAddMembersWizard: teamID => {
      set(s => {
        s.addMembersWizard = {...addMembersWizardEmptyState, teamID}
      })
      reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamFromWhere']}))
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
  }
  return {
    ...initialStore,
    dispatch,
  }
})
