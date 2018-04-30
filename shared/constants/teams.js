// @flow
import * as I from 'immutable'
import * as ChatTypes from './types/chat2'
import * as Types from './types/teams'
import * as RPCTypes from './types/rpc-gen'
import * as RPCChatTypes from './types/rpc-chat-gen'
import {getPathProps} from '../route-tree'
import {teamsTab} from './tabs'

import type {Service} from './types/search'
import {type TypedState} from './reducer'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner']

// Waiting keys
// Add granularity as necessary
export const teamWaitingKey = (teamname: Types.Teamname) => `team:${teamname}`
export const getChannelsWaitingKey = (teamname: Types.Teamname) => `getChannels:${teamname}`
export const settingsWaitingKey = (teamname: Types.Teamname) => `teamSettings:${teamname}`
export const retentionWaitingKey = (teamname: Types.Teamname) => `teamRetention:${teamname}`
export const addMemberWaitingKey = (teamname: Types.Teamname, username: string) =>
  `teamAdd:${teamname};${username}`
// also for pending invites, hence id rather than username
export const removeMemberWaitingKey = (teamname: Types.Teamname, id: string) => `teamRemove:${teamname};${id}`

export const makeChannelInfo: I.RecordFactory<Types._ChannelInfo> = I.Record({
  channelname: '',
  description: '',
  participants: I.Set(),
})

export const makeMemberInfo: I.RecordFactory<Types._MemberInfo> = I.Record({
  active: true,
  fullName: '',
  type: 'reader',
  username: '',
})

export const makeInviteInfo: I.RecordFactory<Types._InviteInfo> = I.Record({
  email: '',
  name: '',
  role: 'writer',
  username: '',
  id: '',
})

export const makeRequestInfo: I.RecordFactory<Types._RequestInfo> = I.Record({
  username: '',
})

export const teamRoleByEnum = ((m: {[Types.MaybeTeamRoleType]: RPCTypes.TeamRole}) => {
  const mInv: {[RPCTypes.TeamRole]: Types.MaybeTeamRoleType} = {}
  for (const roleStr in m) {
    // roleStr is typed as string; see
    // https://github.com/facebook/flow/issues/1736 .
    // $ForceType
    const role: Types.TeamRoleType = roleStr
    const e = m[role]
    mInv[e] = role
  }
  return mInv
})(RPCTypes.teamsTeamRole)

export const typeToLabel: Types.TypeMap = {
  admin: 'Admin',
  owner: 'Owner',
  reader: 'Reader',
  writer: 'Writer',
}

export const makeTeamSettings: I.RecordFactory<Types._TeamSettings> = I.Record({
  open: false,
  joinAs: RPCTypes.teamsTeamRole.reader,
})

export const makeRetentionPolicy: I.RecordFactory<Types._RetentionPolicy> = I.Record({
  type: 'retain',
  days: 0,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  channelCreationError: '',
  teamsWithChosenChannels: I.Set(),
  loaded: false,
  sawChatBanner: false,
  sawSubteamsBanner: false,
  teamCreationError: '',
  teamCreationPending: false,
  teamAccessRequestsPending: I.Set(),
  teamInviteError: '',
  teamJoinError: '',
  teamJoinSuccess: false,
  teamJoinSuccessTeamName: '',
  teamNameToChannelInfos: I.Map(),
  teamNameToID: I.Map(),
  teamNameToInvites: I.Map(),
  teamNameToIsOpen: I.Map(),
  teamNameToLoadingInvites: I.Map(),
  teamNameToMemberUsernames: I.Map(),
  teamNameToMembers: I.Map(),
  teamNameToRequests: I.Map(),
  teamNameToResetUsers: I.Map(),
  teamNameToRetentionPolicy: I.Map(),
  teamNameToRole: I.Map(),
  teamNameToSubteams: I.Map(),
  teamNameToCanPerform: I.Map(),
  teamNameToSettings: I.Map(),
  teamNameToPublicitySettings: I.Map(),
  teamNameToAllowPromote: I.Map(),
  teamNameToIsShowcasing: I.Map(),
  teammembercounts: I.Map(),
  newTeams: I.Set(),
  newTeamRequests: I.List(),
  teamnames: I.Set(),
})

export const initialCanUserPerform: RPCTypes.TeamOperation = {
  manageMembers: false,
  manageSubteams: false,
  chat: false,
  createChannel: false,
  deleteChannel: false,
  renameChannel: false,
  editChannelDescription: false,
  setTeamShowcase: false,
  setMemberShowcase: false,
  setRetentionPolicy: false,
  changeOpenTeam: false,
  leaveTeam: false,
  joinTeam: false,
  setPublicityAny: false,
  listFirst: false,
  changeTarsDisabled: false,
  deleteChatHistory: false,
}

const policyInherit = makeRetentionPolicy({type: 'inherit'})
const policyRetain = makeRetentionPolicy({type: 'retain'})
const policyDay = makeRetentionPolicy({type: 'expire', days: 1})
const policyWeek = makeRetentionPolicy({type: 'expire', days: 7})
const policyMonth = makeRetentionPolicy({type: 'expire', days: 30})
const policyThreeMonths = makeRetentionPolicy({type: 'expire', days: 90})
const policyYear = makeRetentionPolicy({type: 'expire', days: 365})
const baseRetentionPolicies = [
  policyDay,
  policyWeek,
  policyMonth,
  policyThreeMonths,
  policyYear,
  policyRetain,
]
const retentionPolicies = {
  policyInherit,
  policyRetain,
  policyDay,
  policyWeek,
  policyMonth,
  policyThreeMonths,
  policyYear,
}

const userIsActiveInTeamHelper = (
  state: TypedState,
  username: string,
  service: Service,
  teamname: string
) => {
  if (service !== 'Keybase') {
    return false
  }

  const members = state.teams.teamNameToMembers.get(teamname)
  if (!members) {
    return false
  }

  const member = members.get(username)
  return member && member.active
}

const isTeamWithChosenChannels = (state: TypedState, teamname: string): boolean =>
  state.teams.teamsWithChosenChannels.has(teamname)

const getTeamChannelInfos = (
  state: TypedState,
  teamname: Types.Teamname
): I.Map<ChatTypes.ConversationIDKey, Types.ChannelInfo> => {
  return state.teams.getIn(['teamNameToChannelInfos', teamname], I.Map())
}

const getChannelInfoFromConvID = (
  state: TypedState,
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey
): ?Types.ChannelInfo => getTeamChannelInfos(state, teamname).get(conversationIDKey)

const getRole = (state: TypedState, teamname: Types.Teamname): Types.MaybeTeamRoleType =>
  state.teams.getIn(['teamNameToRole', teamname], 'none')

const getCanPerform = (state: TypedState, teamname: Types.Teamname): RPCTypes.TeamOperation =>
  state.teams.getIn(['teamNameToCanPerform', teamname], initialCanUserPerform)

const hasCanPerform = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.hasIn(['teamNameToCanPerform', teamname])

const getTeamMemberCount = (state: TypedState, teamname: Types.Teamname): number =>
  state.teams.getIn(['teammembercounts', teamname], 0)

const getTeamID = (state: TypedState, teamname: Types.Teamname): string =>
  state.teams.getIn(['teamNameToID', teamname], '')

const getTeamNameFromID = (state: TypedState, teamID: string): ?Types.Teamname =>
  state.teams.teamNameToID.findKey(value => value === teamID)

const getTeamRetentionPolicy = (state: TypedState, teamname: Types.Teamname): ?Types.RetentionPolicy =>
  state.teams.getIn(['teamNameToRetentionPolicy', teamname], null)

const getSelectedTeamNames = (state: TypedState): Types.Teamname[] => {
  const pathProps = getPathProps(state.routeTree.routeState, [teamsTab])
  return pathProps.reduce((res, val) => {
    const teamname = val.props.get('teamname')
    if (val.node === 'team' && teamname) {
      return res.concat(teamname)
    }
    return res
  }, [])
}

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
  state.teams.getIn(['teamNameToMembers', teamname], I.Map())

const getTeamPublicitySettings = (state: TypedState, teamname: Types.Teamname): Types._PublicitySettings =>
  state.teams.getIn(['teamNameToPublicitySettings', teamname], {
    anyMemberShowcase: false,
    description: '',
    ignoreAccessRequests: false,
    member: false,
    team: false,
  })

const getTeamInvites = (state: TypedState, teamname: Types.Teamname): I.Set<Types.InviteInfo> =>
  state.teams.getIn(['teamNameToInvites', teamname], I.Set())

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

const isInTeam = (state: TypedState, teamname: Types.Teamname): boolean => getRole(state, teamname) !== 'none'

const isInSomeTeam = (state: TypedState): boolean =>
  !!state.teams.teamNameToRole.find(role => role !== 'none')

const isAccessRequestPending = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.hasIn(['teamNameAccessRequestsPending', teamname])

const getTeamSubteams = (state: TypedState, teamname: Types.Teamname): I.Set<Types.Teamname> =>
  state.teams.getIn(['teamNameToSubteams', teamname], I.Set())

const getTeamSettings = (state: TypedState, teamname: Types.Teamname): Types.TeamSettings =>
  state.teams.getIn(['teamNameToSettings', teamname], makeTeamSettings())

const getTeamResetUsers = (state: TypedState, teamname: Types.Teamname): I.Set<Types.ResetUser> =>
  state.teams.getIn(['teamNameToResetUsers', teamname], I.Set())

const getTeamLoadingInvites = (state: TypedState, teamname: Types.Teamname): I.Map<string, boolean> =>
  state.teams.getIn(['teamNameToLoadingInvites', teamname], I.Map())

const getTeamRequests = (state: TypedState, teamname: Types.Teamname): I.Set<Types.RequestInfo> =>
  state.teams.getIn(['teamNameToRequests', teamname], I.Set())

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

const getSortedTeamnames = (state: TypedState): Types.Teamname[] => {
  let teamnames = state.teams.teamnames.toArray()
  teamnames.sort(sortTeamnames)
  return teamnames
}

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
const secondsToDays = (seconds: number) => seconds / (3600 * 24)
const serviceRetentionPolicyToRetentionPolicy = (
  policy: ?RPCChatTypes.RetentionPolicy
): Types.RetentionPolicy => {
  // !policy implies a default policy of retainment
  let retentionPolicy: Types.RetentionPolicy = makeRetentionPolicy({type: 'retain'})
  if (policy) {
    // replace retentionPolicy with whatever is explicitly set
    switch (policy.typ) {
      case RPCChatTypes.commonRetentionPolicyType.retain:
        retentionPolicy = makeRetentionPolicy({type: 'retain'})
        break
      case RPCChatTypes.commonRetentionPolicyType.expire:
        if (!policy.expire) {
          throw new Error(`RPC returned retention policy of type 'expire' with no expire data`)
        }
        retentionPolicy = makeRetentionPolicy({
          type: 'expire',
          days: secondsToDays(policy.expire.age),
        })
        break
      case RPCChatTypes.commonRetentionPolicyType.inherit:
        retentionPolicy = makeRetentionPolicy({type: 'inherit'})
    }
  }
  return retentionPolicy
}

const daysToSeconds = (days: number) => days * 3600 * 24
const retentionPolicyToServiceRetentionPolicy = (
  policy: Types.RetentionPolicy
): RPCChatTypes.RetentionPolicy => {
  let res: ?RPCChatTypes.RetentionPolicy
  switch (policy.type) {
    case 'retain':
      res = {typ: RPCChatTypes.commonRetentionPolicyType.retain, retain: {}}
      break
    case 'expire':
      res = {typ: RPCChatTypes.commonRetentionPolicyType.expire, expire: {age: daysToSeconds(policy.days)}}
      break
    case 'inherit':
      res = {typ: RPCChatTypes.commonRetentionPolicyType.inherit, inherit: {}}
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

export const makeResetUser: I.RecordFactory<Types._ResetUser> = I.Record({
  username: '',
  badgeIDKey: '',
})

export {
  getRole,
  getCanPerform,
  hasCanPerform,
  getTeamMemberCount,
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
