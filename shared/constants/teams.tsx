import * as ChatTypes from './types/chat2'
import * as Types from './types/teams'
import * as RPCTypes from './types/rpc-gen'
import * as RPCChatTypes from './types/rpc-chat-gen'
import {getFullRoute} from './router2'
import invert from 'lodash/invert'
import {teamsTab} from './tabs'
import {memoize} from '../util/memoize'
import * as TeamBuildingConstants from './team-building'
import {RetentionPolicy} from './types/retention-policy'
import {TypedState} from './reducer'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner']

export const rpcMemberStatusToStatus = invert(RPCTypes.TeamMemberStatus) as {
  [K in RPCTypes.TeamMemberStatus]: keyof typeof RPCTypes.TeamMemberStatus
}

// Waiting keys
// Add granularity as necessary
export const teamsLoadedWaitingKey = 'teams:loaded'
export const teamsAccessRequestWaitingKey = 'teams:accessRequests'
export const teamWaitingKey = (teamname: Types.Teamname) => `team:${teamname}`
export const teamWaitingKeyByID = (teamID: Types.TeamID, state: TypedState) => {
  // TODO: eventually, delete teamWaitingKey and then change this to only use the ID
  const teamname = getTeamNameFromID(state, teamID) ?? ''
  return teamWaitingKey(teamname)
}
export const teamGetWaitingKey = (teamname: Types.Teamname) => `teamGet:${teamname}`
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
export const deleteTeamWaitingKey = (teamID: Types.TeamID) => `teamDelete:${teamID}`
export const leaveTeamWaitingKey = (teamname: Types.Teamname) => `teamLeave:${teamname}`
export const teamRenameWaitingKey = 'teams:rename'

export const initialChannelInfo = Object.freeze<Types.ChannelInfo>({
  channelname: '',
  description: '',
  hasAllMembers: null,
  memberStatus: RPCChatTypes.ConversationMemberStatus.active,
  mtime: 0,
  numParticipants: 0,
})

export const initialMemberInfo = Object.freeze<Types.MemberInfo>({
  fullName: '',
  status: 'active',
  type: 'reader',
  username: '',
})

export const rpcDetailsToMemberInfos = (
  allRoleMembers: RPCTypes.TeamMembersDetails
): Map<string, Types.MemberInfo> => {
  const infos: Array<[string, Types.MemberInfo]> = []
  const types: Types.TeamRoleType[] = ['reader', 'writer', 'admin', 'owner', 'bot', 'restrictedbot']
  const typeToKey: Types.TypeMap = {
    admin: 'admins',
    bot: 'bots',
    owner: 'owners',
    reader: 'readers',
    restrictedbot: 'restrictedBots',
    writer: 'writers',
  }
  types.forEach(type => {
    const key = typeToKey[type]
    // @ts-ignore
    const members: Array<RPCTypes.TeamMemberDetails> = (allRoleMembers[key] || []) as any
    members.forEach(({fullName, status, username}) => {
      infos.push([
        username,
        {
          fullName,
          status: rpcMemberStatusToStatus[status],
          type,
          username,
        },
      ])
    })
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
    ret.roles.set(key, {
      implicitAdmin:
        value.implicitRole === RPCTypes.TeamRole.admin || value.implicitRole == RPCTypes.TeamRole.owner,
      role: teamRoleByEnum[value.role] || 'none',
    })
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

const emptyState: Types.State = {
  addUserToTeamsResults: '',
  addUserToTeamsState: 'notStarted',
  canPerform: new Map(),
  channelCreationError: '',
  deletedTeams: [],
  emailInviteError: emptyEmailInviteError,
  newTeamRequests: new Map(),
  newTeams: new Set(),
  sawChatBanner: false,
  sawSubteamsBanner: false,
  teamAccessRequestsPending: new Set(),
  teamBuilding: TeamBuildingConstants.makeSubState(),
  teamCreationError: '',
  teamDetails: new Map(),
  teamDetailsMetaStale: true, // start out true, we have not loaded
  teamDetailsMetaSubscribeCount: 0,
  teamIDToChannelInfos: new Map(),
  teamIDToPublicitySettings: new Map(),
  teamIDToResetUsers: new Map(),
  teamIDToRetentionPolicy: new Map(),
  teamInviteError: '',
  teamJoinError: '',
  teamJoinSuccess: false,
  teamJoinSuccessOpen: false,
  teamJoinSuccessTeamName: '',
  teamNameToID: new Map(),
  teamNameToLoadingInvites: new Map(),
  teamProfileAddList: [],
  teamRoleMap: {latestKnownVersion: -1, loadedVersion: -1, roles: new Map()},
  teamnames: new Set(),
  teamsWithChosenChannels: new Set(),
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
  deleteOtherMessages: false,
  deleteTeam: false,
  editChannelDescription: false,
  editTeamDescription: false,
  joinTeam: false,
  listFirst: false,
  manageBots: false,
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
  state: TypedState,
  teamID: Types.TeamID,
  username: string,
  role: Types.TeamRoleType
): boolean => {
  return userIsRoleInTeamWithInfo(
    state.teams.teamDetails.get(teamID)?.members || new Map<string, Types.MemberInfo>(),
    username,
    role
  )
}

export const userInTeamNotBotWithInfo = (
  memberInfo: Map<string, Types.MemberInfo>,
  username: string
): boolean => {
  const memb = memberInfo.get(username)
  if (!memb) {
    return false
  }
  return memb.type !== 'bot' && memb.type !== 'restrictedbot'
}

export const getEmailInviteError = (state: TypedState) => state.teams.emailInviteError

export const isTeamWithChosenChannels = (state: TypedState, teamname: string): boolean =>
  state.teams.teamsWithChosenChannels.has(teamname)

const noInfos = new Map<ChatTypes.ConversationIDKey, Types.ChannelInfo>()

export const getTeamChannelInfos = (
  state: TypedState,
  teamID: Types.TeamID
): Map<ChatTypes.ConversationIDKey, Types.ChannelInfo> =>
  state.teams.teamIDToChannelInfos.get(teamID) ?? noInfos

export const getChannelInfoFromConvID = (
  state: TypedState,
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
): Types.ChannelInfo | null => getTeamChannelInfos(state, teamID).get(conversationIDKey) || null

export const getRole = (state: TypedState, teamID: Types.TeamID): Types.MaybeTeamRoleType =>
  state.teams.teamRoleMap.roles.get(teamID)?.role || 'none'

export const getRoleByName = (state: TypedState, teamname: string): Types.MaybeTeamRoleType =>
  getRole(state, getTeamID(state, teamname))

export const hasChannelInfos = (state: TypedState, teamID: Types.TeamID): boolean =>
  state.teams.teamIDToChannelInfos.has(teamID)

export const isLastOwner = (state: TypedState, teamID: Types.TeamID): boolean =>
  isOwner(getRole(state, teamID)) && !isMultiOwnerTeam(state, teamID)

const subteamsCannotHaveOwners = {owner: 'Subteams cannot have owners.'}
const onlyOwnersCanTurnTeamMembersInfoOwners = {owner: 'Only owners can turn team members into owners.'}
const roleChangeSub = {
  admin: 'You must be at least an admin to make role changes.',
  owner: 'Subteams cannot have owners',
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

export const getDisabledReasonsForRolePicker = (
  state: TypedState,
  teamID: Types.TeamID,
  memberToModify: string | null
): Types.DisabledReasonsForRolePicker => {
  const canManageMembers = getCanPerformByID(state, teamID).manageMembers
  const teamDetails = getTeamDetails(state, teamID)
  const members = teamDetails.members || new Map()
  const teamname = teamDetails.teamname
  const member = memberToModify ? members.get(memberToModify) : null
  const theyAreOwner = member ? member.type === 'owner' : false
  const you = members.get(state.config.username)
  // Fallback to the lowest role, although this shouldn't happen
  const yourRole = you ? you.type : 'reader'

  if (canManageMembers) {
    // If you're an implicit admin, the tests below will fail for you, but you can still change roles.
    return isSubteam(teamname)
      ? subteamsCannotHaveOwners
      : yourRole !== 'owner'
      ? onlyOwnersCanTurnTeamMembersInfoOwners
      : emptyObj
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

const isMultiOwnerTeam = (state: TypedState, teamID: Types.TeamID): boolean => {
  let countOfOwners = 0
  const allTeamMembers = state.teams.teamDetails.get(teamID)?.members || new Map<string, Types.MemberInfo>()
  const moreThanOneOwner = [...allTeamMembers.values()].some(tm => {
    if (isOwner(tm.type)) {
      countOfOwners++
    }
    return countOfOwners > 1
  })
  return moreThanOneOwner
}

export const getTeamID = (state: TypedState, teamname: Types.Teamname): string =>
  state.teams.teamNameToID.get(teamname) || Types.noTeamID

export const getTeamNameFromID = (state: TypedState, teamID: Types.TeamID): Types.Teamname | null =>
  state.teams.teamDetails.get(teamID)?.teamname ?? null

export const getTeamRetentionPolicyByID = (state: TypedState, teamID: Types.TeamID): RetentionPolicy | null =>
  state.teams.teamIDToRetentionPolicy.get(teamID) ?? null

export const getSelectedTeams = (): Types.TeamID[] => {
  const path = getFullRoute()
  return path.reduce<Array<string>>((names, curr) => {
    if (curr.routeName === 'team') {
      curr.params && curr.params.teamID && names.push(curr.params.teamID)
    }
    return names
  }, [])
}

/**
 *  Gets the number of channels you're subscribed to on a team
 */
export const getNumberOfSubscribedChannels = (state: TypedState, teamname: Types.Teamname): number =>
  [...state.chat2.metaMap.values()].reduce((count, c) => (count += c.teamname === teamname ? 1 : 0), 0)

/**
 * Gets whether the team is big or small for teams you are a member of
 */
export const getTeamType = (state: TypedState, teamname: Types.Teamname): 'big' | 'small' | null => {
  // TODO do not use metaMap here. It's likely this team has no convos in the metaMap.
  const conv = [...state.chat2.metaMap.values()].find(c => c.teamname === teamname)
  if (conv) {
    if (conv.teamType === 'big' || conv.teamType === 'small') {
      return conv.teamType
    }
  }
  return null
}

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: TypedState, teamname: Types.Teamname): boolean =>
  getTeamType(state, teamname) === 'big'

export const initialPublicitySettings = Object.freeze<Types._PublicitySettings>({
  anyMemberShowcase: false,
  description: '',
  ignoreAccessRequests: false,
  member: false,
  team: false,
})

export const getTeamPublicitySettings = (state: TypedState, teamID: Types.TeamID): Types._PublicitySettings =>
  state.teams.teamIDToPublicitySettings.get(teamID) || initialPublicitySettings

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

export const isInTeam = (state: TypedState, teamname: Types.Teamname): boolean =>
  getRoleByName(state, teamname) !== 'none'

export const isInSomeTeam = (state: TypedState): boolean =>
  [...state.teams.teamRoleMap.roles.values()].some(rd => rd.role !== 'none')

export const isAccessRequestPending = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.teamAccessRequestsPending.has(teamname)

export const getTeamResetUsers = (state: TypedState, teamID: Types.TeamID): Set<string> =>
  state.teams.teamIDToResetUsers.get(teamID) || new Set()

export const getTeamLoadingInvites = (state: TypedState, teamname: Types.Teamname): Map<string, boolean> =>
  state.teams.teamNameToLoadingInvites.get(teamname) || new Map()

// Sorts teamnames canonically.
function sortTeamnames(a: string, b: string) {
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

const _memoizedSorted = memoize((names: Set<Types.Teamname>) => [...names].sort(sortTeamnames))
export const getSortedTeamnames = (state: TypedState): Types.Teamname[] =>
  _memoizedSorted(state.teams.teamnames)

export const sortTeamsByName = memoize((teamDetails: Map<Types.TeamID, Types.TeamDetails>) =>
  [...teamDetails.values()].sort((a, b) => sortTeamnames(a.teamname, b.teamname))
)

// sorted by name
export const getSortedTeams = (state: TypedState) => sortTeamsByName(state.teams.teamDetails)

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

export const isOnTeamsTab = () => {
  const path = getFullRoute()
  return Array.isArray(path) ? path.some(p => p.routeName === teamsTab) : false
}

// Merge new teamDetails objs into old ones, removing any old teams that are not in the new map
export const mergeTeamDetails = (oldMap: Types.State['teamDetails'], newMap: Types.State['teamDetails']) => {
  const ret = new Map(newMap)
  for (const [teamID, teamDetails] of newMap.entries()) {
    ret.set(teamID, {...oldMap.get(teamID), ...teamDetails})
  }
  return ret
}

export const emptyTeamDetails = Object.freeze<Types.TeamDetails>({
  allowPromote: false,
  id: Types.noTeamID,
  isMember: false,
  isOpen: false,
  memberCount: -1,
  role: 'none',
  showcasing: false,
  teamname: '',
})

export const makeTeamDetails = (td: Partial<Types.TeamDetails>): Types.TeamDetails =>
  td ? Object.assign({...emptyTeamDetails}, td) : emptyTeamDetails

export const teamListToDetails = (
  list: Array<RPCTypes.AnnotatedMemberInfo>
): Map<Types.TeamID, Types.TeamDetails> => {
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

export const annotatedInvitesToInviteInfo = (
  invites: RPCTypes.TeamDetails['annotatedActiveInvites']
): Array<Types.InviteInfo> =>
  Object.values(invites).reduce<Array<Types.InviteInfo>>((arr, invite) => {
    const role = teamRoleByEnum[invite.role]
    if (!role || role === 'none') {
      return arr
    }

    let username = ''
    const t = invite.type
    if (t.c === RPCTypes.TeamInviteCategory.sbs) {
      const sbs: RPCTypes.TeamInviteSocialNetwork = t.sbs
      username = `${invite.name}@${sbs}`
    }
    const {e164ToDisplay} = require('../util/phone-numbers')
    arr.push({
      email: invite.type.c === RPCTypes.TeamInviteCategory.email ? invite.name : '',
      id: invite.id,
      name: invite.type.c === RPCTypes.TeamInviteCategory.seitan ? invite.name : '',
      phone: invite.type.c === RPCTypes.TeamInviteCategory.phone ? e164ToDisplay('+' + invite.name) : '',
      role,
      username,
    })
    return arr
  }, [])

export const getTeamDetails = (state: TypedState, teamID: Types.TeamID) =>
  state.teams.teamDetails.get(teamID) || emptyTeamDetails

const _canUserPerformCache: {[key: string]: Types.TeamOperations} = {}
const _canUserPerformCacheKey = (t: Types.TeamRoleAndDetails) => t.role + t.implicitAdmin
const deriveCanPerform = (roleAndDetails?: Types.TeamRoleAndDetails): Types.TeamOperations => {
  if (!roleAndDetails) {
    // can happen if an empty teamID was passed to a getter
    return initialCanUserPerform
  }

  const ck = _canUserPerformCacheKey(roleAndDetails)
  if (_canUserPerformCache[ck]) return _canUserPerformCache[ck]

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
    deleteOtherMessages: isAdminOrAbove,
    deleteTeam: role === 'owner' || implicitAdmin, // role = owner for root teams, otherwise implicitAdmin
    editChannelDescription: isWriterOrAbove,
    editTeamDescription: isAdminOrAbove || implicitAdmin,
    joinTeam: role === 'none' && implicitAdmin,
    listFirst: implicitAdmin,
    manageBots: isAdminOrAbove || implicitAdmin,
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

export const getCanPerform = (state: TypedState, teamname: Types.Teamname): Types.TeamOperations =>
  getCanPerformByID(state, getTeamID(state, teamname))

export const getCanPerformByID = (state: TypedState, teamID: Types.TeamID): Types.TeamOperations =>
  deriveCanPerform(state.teams.teamRoleMap.roles.get(teamID))
