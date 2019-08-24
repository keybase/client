import * as I from 'immutable'
import * as ChatTypes from './types/chat2'
import * as Types from './types/teams'
import * as RPCTypes from './types/rpc-gen'
import * as RPCChatTypes from './types/rpc-chat-gen'
import {getFullRoute} from './router2'
import {invert} from 'lodash-es'
import {teamsTab} from './tabs'
import {memoize} from '../util/memoize'
import * as TeamBuildingConstants from '../constants/team-building'
import {Service} from './types/search'
import {_RetentionPolicy, RetentionPolicy} from './types/retention-policy'
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
export const teamGetWaitingKey = (teamname: Types.Teamname) => `teamGet:${teamname}`
export const teamTarsWaitingKey = (teamname: Types.Teamname) => `teamTars:${teamname}`
export const teamCreationWaitingKey = 'teamCreate'

export const addUserToTeamsWaitingKey = (username: string) => `addUserToTeams:${username}`
export const addPeopleToTeamWaitingKey = (teamname: Types.Teamname) => `teamAddPeople:${teamname}`
export const addToTeamByEmailWaitingKey = (teamname: Types.Teamname) => `teamAddByEmail:${teamname}`
export const getChannelsWaitingKey = (teamname: Types.Teamname) => `getChannels:${teamname}`
export const createChannelWaitingKey = (teamname: Types.Teamname) => `createChannel:${teamname}`
export const settingsWaitingKey = (teamname: Types.Teamname) => `teamSettings:${teamname}`
export const retentionWaitingKey = (teamname: Types.Teamname) => `teamRetention:${teamname}`
export const addMemberWaitingKey = (teamname: Types.Teamname, username: string) =>
  `teamAdd:${teamname};${username}`
// also for pending invites, hence id rather than username
export const removeMemberWaitingKey = (teamname: Types.Teamname, id: string) => `teamRemove:${teamname};${id}`
export const addToTeamSearchKey = 'addToTeamSearch'
export const teamProfileAddListWaitingKey = 'teamProfileAddList'
export const deleteTeamWaitingKey = (teamname: Types.Teamname) => `teamDelete:${teamname}`
export const leaveTeamWaitingKey = (teamname: Types.Teamname) => `teamLeave:${teamname}`
export const teamRenameWaitingKey = 'teams:rename'

export const makeChannelInfo = I.Record<Types._ChannelInfo>({
  channelname: '',
  description: '',
  hasAllMembers: null,
  memberStatus: RPCChatTypes.ConversationMemberStatus.active,
  mtime: 0,
  numParticipants: 0,
})

export const makeMemberInfo = I.Record<Types._MemberInfo>({
  fullName: '',
  status: 'active',
  type: 'reader',
  username: '',
})

export const rpcDetailsToMemberInfos = (
  allRoleMembers: RPCTypes.TeamMembersDetails
): I.Map<string, Types.MemberInfo> => {
  const infos: Array<[string, Types.MemberInfo]> = []
  const types: Types.TeamRoleType[] = ['reader', 'writer', 'admin', 'owner']
  const typeToKey: Types.TypeMap = {
    admin: 'admins',
    owner: 'owners',
    reader: 'readers',
    writer: 'writers',
  }
  types.forEach(type => {
    const key = typeToKey[type]
    // @ts-ignore
    const members: Array<RPCTypes.TeamMemberDetails> = (allRoleMembers[key] || []) as any
    members.forEach(({fullName, status, username}) => {
      infos.push([
        username,
        makeMemberInfo({
          fullName,
          status: rpcMemberStatusToStatus[status],
          type,
          username,
        }),
      ])
    })
  })
  return I.Map(infos)
}

export const makeInviteInfo = I.Record<Types._InviteInfo>({
  email: '',
  id: '',
  name: '',
  role: 'writer',
  username: '',
})

export const makeRequestInfo = I.Record<Types._RequestInfo>({
  username: '',
})

export const makeEmailInviteError = I.Record<Types._EmailInviteError>({
  malformed: I.Set(),
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

export const typeToLabel: Types.TypeMap = {
  admin: 'Admin',
  owner: 'Owner',
  reader: 'Reader',
  writer: 'Writer',
}

export const makeTeamSettings = I.Record<Types._TeamSettings>({
  joinAs: RPCTypes.TeamRole.reader,
  open: false,
})

export const makeRetentionPolicy = I.Record<_RetentionPolicy>({
  seconds: 0,
  title: '',
  type: 'retain',
})

export const makeState = I.Record<Types._State>({
  addUserToTeamsResults: '',
  addUserToTeamsState: 'notStarted',
  channelCreationError: '',
  deletedTeams: I.List(),
  emailInviteError: makeEmailInviteError(),
  newTeamRequests: I.List(),
  newTeams: I.Set(),
  sawChatBanner: false,
  sawSubteamsBanner: false,
  teamAccessRequestsPending: I.Set(),
  teamBuilding: TeamBuildingConstants.makeSubState(),
  teamCreationError: '',
  teamInviteError: '',
  teamJoinError: '',
  teamJoinSuccess: false,
  teamJoinSuccessTeamName: '',
  teamNameToAllowPromote: I.Map(),
  teamNameToCanPerform: I.Map(),
  teamNameToChannelInfos: I.Map(),
  teamNameToID: I.Map(),
  teamNameToInvites: I.Map(),
  teamNameToIsOpen: I.Map(),
  teamNameToIsShowcasing: I.Map(),
  teamNameToLoadingInvites: I.Map(),
  teamNameToMembers: I.Map(),
  teamNameToPublicitySettings: I.Map(),
  teamNameToRequests: I.Map(),
  teamNameToResetUsers: I.Map(),
  teamNameToRetentionPolicy: I.Map(),
  teamNameToRole: I.Map(),
  teamNameToSettings: I.Map(),
  teamNameToSubteams: I.Map(),
  teamProfileAddList: I.List(),
  teammembercounts: I.Map(),
  teamnames: I.Set(),
  teamsWithChosenChannels: I.Set(),
})

export const initialCanUserPerform: RPCTypes.TeamOperation = {
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
  leaveTeam: false,
  listFirst: false,
  manageMembers: false,
  manageSubteams: false,
  renameChannel: false,
  renameTeam: false,
  setMemberShowcase: false,
  setMinWriterRole: false,
  setPublicityAny: false,
  setRetentionPolicy: false,
  setTeamShowcase: false,
}

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
const baseRetentionPolicies = [
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

const retentionPolicies = {
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

const userIsActiveInTeamHelper = (
  state: TypedState,
  _username: string | null,
  _service: Service | null,
  _teamname: string | null
): boolean => {
  const username = _username || ''
  const service = _service || ''
  const teamname = _teamname || ''
  if (service !== 'Keybase') {
    return false
  }

  const members = state.teams.teamNameToMembers.get(teamname)
  if (!members) {
    return false
  }

  const member = members.get(username)
  if (!member) {
    return false
  }

  return member.status === 'active'
}

export const userIsRoleInTeamWithInfo = (
  memberInfo: I.Map<string, Types.MemberInfo>,
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
  teamname: Types.Teamname,
  username: string,
  role: Types.TeamRoleType
): boolean => {
  return userIsRoleInTeamWithInfo(state.teams.teamNameToMembers.get(teamname, I.Map()), username, role)
}

const getEmailInviteError = (state: TypedState) => state.teams.emailInviteError

const isTeamWithChosenChannels = (state: TypedState, teamname: string): boolean =>
  state.teams.teamsWithChosenChannels.has(teamname)

const getTeamChannelInfos = (
  state: TypedState,
  teamname: Types.Teamname
): I.Map<ChatTypes.ConversationIDKey, Types.ChannelInfo> => {
  return state.teams.teamNameToChannelInfos.get(teamname, I.Map())
}

const getChannelInfoFromConvID = (
  state: TypedState,
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey
): Types.ChannelInfo | null => getTeamChannelInfos(state, teamname).get(conversationIDKey) || null

const getRole = (state: TypedState, teamname: Types.Teamname): Types.MaybeTeamRoleType =>
  state.teams.teamNameToRole.get(teamname, 'none')

const getCanPerform = (state: TypedState, teamname: Types.Teamname): RPCTypes.TeamOperation =>
  state.teams.teamNameToCanPerform.get(teamname, initialCanUserPerform)

const hasCanPerform = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.hasIn(['teamNameToCanPerform', teamname])

const hasChannelInfos = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.hasIn(['teamNameToChannelInfos', teamname])

const getTeamMemberCount = (state: TypedState, teamname: Types.Teamname): number =>
  state.teams.teammembercounts.get(teamname, 0)

const isLastOwner = (state: TypedState, teamname: Types.Teamname): boolean =>
  isOwner(getRole(state, teamname)) && !isMultiOwnerTeam(state, teamname)

const getDisabledReasonsForRolePicker = (
  state: TypedState,
  teamname: Types.Teamname,
  memberToModify: string | null
): Types.DisabledReasonsForRolePicker => {
  const canManageMembers = getCanPerform(state, teamname).manageMembers
  const members = getTeamMembers(state, teamname)
  const member = memberToModify ? members.get(memberToModify) : null
  const theyAreOwner = member ? member.type === 'owner' : false
  const you = members.get(state.config.username)
  // Fallback to the lowest role, although this shouldn't happen
  const yourRole = you ? you.type : 'reader'

  if (canManageMembers) {
    // If you're an implicit admin, the tests below will fail for you, but you can still change roles.
    return isSubteam(teamname)
      ? {owner: 'Subteams cannot have owners.'}
      : yourRole !== 'owner'
      ? {owner: 'Only owners can turn team members into owners.'}
      : {}
  }

  // We shouldn't get here, but in case we do this is correct.
  if (yourRole !== 'owner' && yourRole !== 'admin') {
    return {
      admin: 'You must be at least an admin to make role changes.',
      owner: isSubteam(teamname)
        ? 'Subteams cannot have owners'
        : 'You must be at least an admin to make role changes.',
      reader: 'You must be at least an admin to make role changes.',
      writer: 'You must be at least an admin to make role changes.',
    }
  }

  // We shouldn't get here, but in case we do this is correct.
  if (theyAreOwner && yourRole !== 'owner') {
    return {
      admin: `Only owners can change another owner's role`,
      owner: isSubteam(teamname)
        ? 'Subteams cannot have owners.'
        : `Only owners can change another owner's role`,
      reader: `Only owners can change another owner's role`,
      writer: `Only owners can change another owner's role`,
    }
  }

  // We shouldn't get here, but in case we do this is correct.
  if (yourRole !== 'owner') {
    return {
      owner: isSubteam(teamname)
        ? 'Subteams cannot have owners.'
        : `Only owners can turn members into owners`,
    }
  }

  return {}
}

const isMultiOwnerTeam = (state: TypedState, teamname: Types.Teamname): boolean => {
  let countOfOwners = 0
  const allTeamMembers = state.teams.teamNameToMembers.get(teamname, I.Map<string, Types.MemberInfo>())
  const moreThanOneOwner = allTeamMembers.some(tm => {
    if (isOwner(tm.type)) {
      countOfOwners++
    }
    return countOfOwners > 1
  })
  return moreThanOneOwner
}

const getTeamID = (state: TypedState, teamname: Types.Teamname): string =>
  state.teams.teamNameToID.get(teamname, '')

const getTeamNameFromID = (state: TypedState, teamID: string): Types.Teamname | null =>
  state.teams.teamNameToID.findKey(value => value === teamID) || null

const getTeamRetentionPolicy = (state: TypedState, teamname: Types.Teamname): RetentionPolicy | null =>
  state.teams.teamNameToRetentionPolicy.get(teamname, null)

const getSelectedTeamNames = (): Types.Teamname[] => {
  const path = getFullRoute()
  return path.reduce<Array<string>>((names, curr) => {
    if (curr.routeName === 'team') {
      curr.params && curr.params.teamname && names.push(curr.params.teamname)
    }
    return names
  }, [])
}

/**
 *  Gets the number of channels you're subscribed to on a team
 */
const getNumberOfSubscribedChannels = (state: TypedState, teamname: Types.Teamname): number =>
  state.chat2.metaMap.count(c => c.teamname === teamname)

/**
 * Gets whether the team is big or small for teams you are a member of
 */
const getTeamType = (state: TypedState, teamname: Types.Teamname): 'big' | 'small' | null => {
  const mm = state.chat2.metaMap
  const conv = mm.find(c => c.teamname === teamname)
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
const isBigTeam = (state: TypedState, teamname: Types.Teamname): boolean =>
  getTeamType(state, teamname) === 'big'

const getTeamMembers = (state: TypedState, teamname: Types.Teamname): I.Map<string, Types.MemberInfo> =>
  state.teams.teamNameToMembers.get(teamname, I.Map())

const getTeamPublicitySettings = (state: TypedState, teamname: Types.Teamname): Types._PublicitySettings =>
  state.teams.teamNameToPublicitySettings.get(teamname, {
    anyMemberShowcase: false,
    description: '',
    ignoreAccessRequests: false,
    member: false,
    team: false,
  })

const getTeamInvites = (state: TypedState, teamname: Types.Teamname): I.Set<Types.InviteInfo> =>
  state.teams.teamNameToInvites.get(teamname, I.Set())

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

const isInTeam = (state: TypedState, teamname: Types.Teamname): boolean => getRole(state, teamname) !== 'none'

const isInSomeTeam = (state: TypedState): boolean =>
  !!state.teams.teamNameToRole.find(role => role !== 'none')

const isAccessRequestPending = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.hasIn(['teamNameAccessRequestsPending', teamname])

const getTeamSubteams = (state: TypedState, teamname: Types.Teamname): I.Set<Types.Teamname> =>
  state.teams.teamNameToSubteams.get(teamname, I.Set())

const getTeamSettings = (state: TypedState, teamname: Types.Teamname): Types.TeamSettings =>
  state.teams.teamNameToSettings.get(teamname, makeTeamSettings())

const getTeamResetUsers = (state: TypedState, teamname: Types.Teamname): I.Set<Types.ResetUser> =>
  state.teams.teamNameToResetUsers.get(teamname, I.Set())

const getTeamLoadingInvites = (state: TypedState, teamname: Types.Teamname): I.Map<string, boolean> =>
  state.teams.teamNameToLoadingInvites.get(teamname, I.Map())

const getTeamRequests = (state: TypedState, teamname: Types.Teamname): I.Set<Types.RequestInfo> =>
  state.teams.teamNameToRequests.get(teamname, I.Set())

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

const _memoizedSorted = memoize(names => names.toArray().sort(sortTeamnames))
const getSortedTeamnames = (state: TypedState): Types.Teamname[] => _memoizedSorted(state.teams.teamnames)

const isAdmin = (type: Types.MaybeTeamRoleType) => type === 'admin'
const isOwner = (type: Types.MaybeTeamRoleType) => type === 'owner'

// TODO make this check for only valid subteam names
const isSubteam = (maybeTeamname: string) => {
  const subteams = maybeTeamname.split('.')
  if (subteams.length <= 1) {
    return false
  }
  return true
}
const serviceRetentionPolicyToRetentionPolicy = (
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

const retentionPolicyToServiceRetentionPolicy = (policy: RetentionPolicy): RPCChatTypes.RetentionPolicy => {
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

export const resetUserBadgeIDToKey = (id: Types.ResetUserBadgeID): Types.ResetUserBadgeIDKey =>
  id.toString('hex')
export const keyToResetUserBadgeID = (key: Types.ResetUserBadgeIDKey): Types.ResetUserBadgeID =>
  Buffer.from(key, 'hex')

export const makeResetUser = I.Record<Types._ResetUser>({
  badgeIDKey: '',
  username: '',
})

export const chosenChannelsGregorKey = 'chosenChannelsForTeam'

export const isOnTeamsTab = () => {
  const path = getFullRoute()
  return Array.isArray(path) ? path.some(p => p.routeName === teamsTab) : false
}

export {
  getNumberOfSubscribedChannels,
  getRole,
  getCanPerform,
  getDisabledReasonsForRolePicker,
  hasCanPerform,
  hasChannelInfos,
  getEmailInviteError,
  getTeamMemberCount,
  isLastOwner,
  userIsActiveInTeamHelper,
  getTeamChannelInfos,
  getChannelInfoFromConvID,
  getTeamID,
  getTeamRetentionPolicy,
  getTeamMembers,
  getTeamNameFromID,
  getTeamPublicitySettings,
  getTeamInvites,
  isInTeam,
  isInSomeTeam,
  isAccessRequestPending,
  getSelectedTeamNames,
  getTeamSubteams,
  getTeamSettings,
  getTeamResetUsers,
  getTeamLoadingInvites,
  getTeamRequests,
  getSortedTeamnames,
  getTeamType,
  isAdmin,
  isBigTeam,
  isOwner,
  isSubteam,
  isTeamWithChosenChannels,
  serviceRetentionPolicyToRetentionPolicy,
  retentionPolicyToServiceRetentionPolicy,
  baseRetentionPolicies,
  retentionPolicies,
}
