// @flow
import * as I from 'immutable'
import * as ChatTypes from './types/chat'
import * as Types from './types/teams'
import {userIsActiveInTeam} from './selectors'
import * as RPCTypes from './types/rpc-gen'
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

export const makeState: I.RecordFactory<Types._State> = I.Record({
  convIDToChannelInfo: I.Map(),
  loaded: false,
  sawChatBanner: false,
  sawSubteamsBanner: false,
  teamAccessRequestsPending: I.Set(),
  teamNameToConvIDs: I.Map(),
  teamNameToInvites: I.Map(),
  teamNameToIsOpen: I.Map(),
  teamNameToLoadingInvites: I.Map(),
  teamNameToMemberUsernames: I.Map(),
  teamNameToMembers: I.Map(),
  teamNameToRequests: I.Map(),
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
  createChannel: false,
  deleteChannel: false,
  renameChannel: false,
  editChannelDescription: false,
  setTeamShowcase: false,
  setMemberShowcase: false,
  changeOpenTeam: false,
  leaveTeam: false,
  joinTeam: false,
  setPublicityAny: false,
  listFirst: false,
  changeTarsDisabled: false,
  deleteChatHistory: false,
}

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

// How many public admins should we display on a showcased team card at once?
export const publicAdminsLimit = 6

export {
  getConvIdsFromTeamName,
  getRole,
  getCanPerform,
  userIsActiveInTeamHelper,
  getTeamNameFromConvID,
  getChannelInfoFromConvID,
  getChannelNameFromConvID,
  getTopicFromConvID,
  isAdmin,
  isOwner,
  isSubteam,
}
