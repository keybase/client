// @flow
import * as I from 'immutable'
import * as ChatTypes from './types/chat2'
import * as Types from './types/teams'
import {userIsActiveInTeam} from './selectors'
import * as RPCTypes from './types/rpc-gen'
import * as RPCChatTypes from './types/rpc-chat-gen'
import invert from 'lodash/invert'

import type {Service} from './types/search'
import {type TypedState} from './reducer'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner']

// Waiting keys
// Add granularity as necessary
export const teamWaitingKey = (teamname: string) => `team:${teamname}`
export const settingsWaitingKey = (teamname: string) => `teamSettings:${teamname}`

export const makeChannelInfo: I.RecordFactory<Types._ChannelInfo> = I.Record({
  channelname: null,
  description: null,
  participants: I.Set(),
})

export const makeMemberInfo: I.RecordFactory<Types._MemberInfo> = I.Record({
  active: true,
  fullName: '',
  type: null,
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

export const teamRoleByEnum = invert(RPCTypes.teamsTeamRole)

export const typeToLabel: Types.TypeMap = {
  admin: 'Admin',
  none: 'None',
  owner: 'Owner',
  reader: 'Reader',
  writer: 'Writer',
}

export const makeTeamSettings: I.RecordFactory<Types._TeamSettings> = I.Record({
  open: false,
  joinAs: 1,
})

export const makeRetentionPolicy: I.RecordFactory<Types._RetentionPolicy> = I.Record({
  type: 'retain',
  days: 0,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  channelCreationError: '',
  convIDToChannelInfo: I.Map(),
  loaded: false,
  sawChatBanner: false,
  sawSubteamsBanner: false,
  teamCreationError: '',
  teamCreationPending: false,
  teamAccessRequestsPending: I.Set(),
  teamJoinError: '',
  teamJoinSuccess: false,
  teamJoinSuccessTeamName: '',
  teamNameToConvIDs: I.Map(),
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
  teamNameToTeamSettings: I.Map(),
  teamNameToPublicitySettings: I.Map(),
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
const teamRetentionPolicies = [
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

const convRetentionPolicies = [policyInherit, ...teamRetentionPolicies]

const userIsActiveInTeamHelper = (state: TypedState, username: string, service: Service, teamname: string) =>
  service === 'Keybase' ? userIsActiveInTeam(state, teamname, username) : false

const getConvIdsFromTeamName = (state: TypedState, teamname: string): I.Set<ChatTypes.ConversationIDKey> =>
  state.entities.teams.teamNameToConvIDs.get(teamname, I.Set())

const getTeamNameFromConvID = (state: TypedState, conversationIDKey: ChatTypes.ConversationIDKey) =>
  state.entities.teams.teamNameToConvIDs.findKey(i => i.has(conversationIDKey))

const getChannelInfoFromConvID = (state: TypedState, conversationIDKey: ChatTypes.ConversationIDKey) =>
  state.entities.teams.convIDToChannelInfo.get(conversationIDKey, null)

const getChannelNameFromConvID = (state: TypedState, conversationIDKey: ChatTypes.ConversationIDKey) =>
  state.entities.teams.convIDToChannelInfo.getIn([conversationIDKey, 'channelname'], null)

const getTopicFromConvID = (state: TypedState, conversationIDKey: ChatTypes.ConversationIDKey) =>
  state.entities.teams.convIDToChannelInfo.getIn([conversationIDKey, 'description'], null)

const getRole = (state: TypedState, teamname: Types.Teamname): ?Types.TeamRoleType =>
  state.entities.getIn(['teams', 'teamNameToRole', teamname], null)

const getCanPerform = (state: TypedState, teamname: Types.Teamname): RPCTypes.TeamOperation =>
  state.entities.getIn(['teams', 'teamNameToCanPerform', teamname], initialCanUserPerform)

const hasCanPerform = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.entities.hasIn(['teams', 'teamNameToCanPerform', teamname])

const getTeamMemberCount = (state: TypedState, teamname: Types.Teamname): number =>
  state.entities.getIn(['teams', 'teammembercounts', teamname], 0)

const getTeamID = (state: TypedState, teamname: Types.Teamname): string =>
  state.entities.getIn(['teams', 'teamNameToID', teamname], '')

const getTeamRetentionPolicy = (state: TypedState, teamname: Types.Teamname): ?Types.RetentionPolicy =>
  state.entities.getIn(['teams', 'teamNameToRetentionPolicy', teamname], null)

const isAdmin = (type: ?Types.TeamRoleType) => type === 'admin'
const isOwner = (type: ?Types.TeamRoleType) => type === 'owner'

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
  getConvIdsFromTeamName,
  getRole,
  getCanPerform,
  hasCanPerform,
  getTeamMemberCount,
  userIsActiveInTeamHelper,
  getTeamNameFromConvID,
  getChannelInfoFromConvID,
  getChannelNameFromConvID,
  getTeamID,
  getTeamRetentionPolicy,
  getTopicFromConvID,
  isAdmin,
  isOwner,
  isSubteam,
  serviceRetentionPolicyToRetentionPolicy,
  retentionPolicyToServiceRetentionPolicy,
  teamRetentionPolicies,
  convRetentionPolicies,
  retentionPolicies,
}
