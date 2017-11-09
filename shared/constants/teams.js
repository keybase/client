// @flow
import * as I from 'immutable'
import * as ChatConstants from './chat'
import {userIsInTeam, usernameSelector} from './selectors'
import * as RPCTypes from './types/flow-types'
import invert from 'lodash/invert'

import type {Service} from './search'
import {type NoErrorTypedAction} from './types/flux'
import {type TypedState} from './reducer'

type _PublicitySettings = {
  member: boolean,
  team: boolean,
}
export type TeamSettings = RPCTypes.TeamSettings
export type ChannelMembershipState = {[channelname: string]: boolean}

export type CreateNewTeam = NoErrorTypedAction<
  'teams:createNewTeam',
  {
    name: string,
  }
>

export type CreateNewTeamFromConversation = NoErrorTypedAction<
  'teams:createNewTeamFromConversation',
  {
    conversationIDKey: ChatConstants.ConversationIDKey,
    name: string,
  }
>

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner']
export type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'

export type AddToTeam = NoErrorTypedAction<
  'teams:addToTeam',
  {
    name: string,
    email: string,
    username: string,
    role: ?TeamRoleType,
    sendChatNotification: boolean,
  }
>
export type EditMembership = NoErrorTypedAction<
  'teams:editMembership',
  {name: string, username: string, role: TeamRoleType}
>
export type InviteToTeamByPhone = NoErrorTypedAction<
  'teams:inviteToTeamByPhone',
  {
    teamname: string,
    role: string,
    phoneNumber: string,
  }
>

// username -> removeMember
// email -> removePendingInvite
export type RemoveMemberOrPendingInvite = NoErrorTypedAction<
  'teams:removeMemberOrPendingInvite',
  {name: string, username: string, email: string}
>

export type IgnoreRequest = NoErrorTypedAction<'teams:ignoreRequest', {name: string, username: string}>
export type JoinTeam = NoErrorTypedAction<'teams:joinTeam', {teamname: string}>
export type LeaveTeam = NoErrorTypedAction<'teams:leaveTeam', {teamname: string}>
export type GetChannels = NoErrorTypedAction<'teams:getChannels', {teamname: string}>

export type MakeTeamOpen = NoErrorTypedAction<
  'teams:makeTeamOpen',
  {convertToOpen: boolean, defaultRole: TeamRoleType, teamname: string}
>

export type GetTeams = NoErrorTypedAction<'teams:getTeams', {}>

export type BadgeAppForTeams = NoErrorTypedAction<
  'teams:badgeAppForTeams',
  {newTeamNames?: ?Array<string>, newTeamAccessRequests?: ?Array<string>}
>

export type ToggleChannelMembership = NoErrorTypedAction<
  'teams:toggleChannelMembership',
  {teamname: string, channelname: string}
>

export type SetupTeamHandlers = NoErrorTypedAction<'teams:setupTeamHandlers', void>
export type GetDetails = NoErrorTypedAction<'teams:getDetails', {teamname: string}>
export type CreateChannel = NoErrorTypedAction<
  'teams:createChannel',
  {channelname: string, description: string, teamname: string}
>

export type Teamname = string

type _ChannelInfo = {
  channelname: ?string,
  description: ?string,
  participants: I.Set<string>,
}

export type ChannelInfo = I.RecordOf<_ChannelInfo>
export const makeChannelInfo: I.RecordFactory<_ChannelInfo> = I.Record({
  channelname: null,
  description: null,
  participants: I.Set(),
})

type _MemberInfo = {
  type: ?TeamRoleType,
  username: string,
}

export type MemberInfo = I.RecordOf<_MemberInfo>
export const makeMemberInfo: I.RecordFactory<_MemberInfo> = I.Record({
  type: null,
  username: '',
})

type _InviteInfo = {
  email: string,
  role: TeamRoleType,
  username: string,
}

export type InviteInfo = I.RecordOf<_InviteInfo>
export const makeInviteInfo: I.RecordFactory<_InviteInfo> = I.Record({
  email: '',
  role: 'writer',
  username: '',
})

type _RequestInfo = {
  username: string,
}

export type RequestInfo = I.RecordOf<_RequestInfo>
export const makeRequestInfo: I.RecordFactory<_RequestInfo> = I.Record({
  username: '',
})

export type TabKey = 'members' | 'requests' | 'pending'

export type SetTeamCreationError = NoErrorTypedAction<
  'teams:setTeamCreationError',
  {teamCreationError: string}
>

export type SetTeamCreationPending = NoErrorTypedAction<
  'teams:setTeamCreationPending',
  {teamCreationPending: boolean}
>

export type SetTeamJoinError = NoErrorTypedAction<'teams:setTeamJoinError', {teamJoinError: string}>
export type SetTeamJoinSuccess = NoErrorTypedAction<'teams:setTeamJoinSuccess', {teamJoinSuccess: boolean}>

export type AddPeopleToTeam = NoErrorTypedAction<'teams:addPeopleToTeam', {role: string, teamname: string}>

export type InviteToTeamByEmail = NoErrorTypedAction<
  'teams:inviteToTeamByEmail',
  {invitees: string, role: string, teamname: string}
>

export type SetPublicityMember = NoErrorTypedAction<
  'teams:setPublicityMember',
  {enabled: boolean, teamname: string}
>

export type SetPublicityTeam = NoErrorTypedAction<
  'teams:setPublicityTeam',
  {enabled: boolean, teamname: string}
>

export type UpdateChannelName = NoErrorTypedAction<
  'teams:updateChannelName',
  {conversationIDKey: ChatConstants.ConversationIDKey, newChannelName: string}
>

export type UpdateTopic = NoErrorTypedAction<
  'teams:updateTopic',
  {conversationIDKey: ChatConstants.ConversationIDKey, newTopic: string}
>

export type DeleteChannel = NoErrorTypedAction<
  'teams:deleteChannel',
  {conversationIDKey: ChatConstants.ConversationIDKey}
>

export type SaveChannelMembership = NoErrorTypedAction<
  'teams:saveChannelMembership',
  {channelState: ChannelMembershipState, teamname: string}
>

export const teamRoleByEnum = invert(RPCTypes.teamsTeamRole)

export type TypeMap = {
  admin: string | boolean,
  owner: string | boolean,
  reader: string | boolean,
  writer: string | boolean,
}

export const typeToLabel: TypeMap = {
  admin: 'Admin',
  owner: 'Owner',
  reader: 'Reader',
  writer: 'Writer',
}

type _State = {
  convIDToChannelInfo: I.Map<ChatConstants.ConversationIDKey, ChannelInfo>,
  sawChatBanner: boolean,
  teamNameToConvIDs: I.Map<Teamname, I.Set<ChatConstants.ConversationIDKey>>,
  teamNameToInvites: I.Map<
    Teamname,
    I.Set<
      I.RecordOf<{
        email: string,
        role: TeamRoleType,
        username: string,
      }>
    >
  >,
  teamNameToLoadingInvites: I.Map<Teamname, I.Map<string, boolean>>,
  teamNameToMembers: I.Map<Teamname, I.Set<MemberInfo>>,
  teamNameToMemberUsernames: I.Map<Teamname, I.Set<string>>,
  teamNameToImplicitAdminUsernames: I.Map<Teamname, I.Set<string>>,
  teamNameToLoading: I.Map<Teamname, boolean>,
  teamNameToRequests: I.Map<Teamname, I.List<string>>,
  teamNameToTeamSettings: I.Map<Teamname, TeamSettings>,
  teamNameToPublicitySettings: I.Map<Teamname, _PublicitySettings>,
  teamnames: I.Set<Teamname>,
  teammembercounts: I.Map<Teamname, number>,
  newTeams: I.Set<string>,
  newTeamRequests: I.List<string>,
  loaded: boolean,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  convIDToChannelInfo: I.Map(),
  loaded: false,
  sawChatBanner: false,
  teamNameToConvIDs: I.Map(),
  teamNameToInvites: I.Map(),
  teamNameToLoadingInvites: I.Map(),
  teamNameToLoading: I.Map(),
  teamNameToMemberUsernames: I.Map(),
  teamNameToImplicitAdminUsernames: I.Map(),
  teamNameToMembers: I.Map(),
  teamNameToRequests: I.Map(),
  teamNameToTeamSettings: I.Map(),
  teamNameToPublicitySettings: I.Map(),
  teammembercounts: I.Map(),
  newTeams: I.Set(),
  newTeamRequests: I.List(),
  teamnames: I.Set(),
})

const userIsInTeamHelper = (state: TypedState, username: string, service: Service, teamname: string) =>
  service === 'Keybase' ? userIsInTeam(state, teamname, username) : false

// TODO this is broken. channelnames are not unique
const getConversationIDKeyFromChannelName = (state: TypedState, channelname: string) => null

const getConvIdsFromTeamName = (state: TypedState, teamname: string) =>
  state.entities.teams.teamNameToConvIDs.get(teamname, I.Set())

const getTeamNameFromConvID = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.teams.teamNameToConvIDs.findKey(i => i.has(conversationIDKey))

const getChannelNameFromConvID = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.teams.convIDToChannelInfo.getIn([conversationIDKey, 'channelname'], null)

const getTopicFromConvID = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.teams.convIDToChannelInfo.getIn([conversationIDKey, 'description'], null)

const getParticipants = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo', conversationIDKey, 'participants'], I.Set())

const getMembersFromConvID = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) => {
  const teamname = getTeamNameFromConvID(state, conversationIDKey)
  if (teamname) {
    return state.entities.teams.teamNameToMembers.get(teamname, I.Set())
  }
  return I.Set()
}

const getYourRoleFromConvID = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) => {
  const members = getMembersFromConvID(state, conversationIDKey)
  const you = usernameSelector(state)
  const youAsMember = members.find(m => m.username === you)
  if (youAsMember) {
    return youAsMember.type
  }
  return null
}

const isAdmin = (type: TeamRoleType) => type === 'admin'
const isOwner = (type: TeamRoleType) => type === 'owner'

export const getFollowingMap = (state: TypedState) => state.config.following
export const getFollowerMap = (state: TypedState) => state.config.followers

export {
  getConvIdsFromTeamName,
  getConversationIDKeyFromChannelName,
  getParticipants,
  userIsInTeamHelper,
  getTeamNameFromConvID,
  getChannelNameFromConvID,
  getTopicFromConvID,
  getYourRoleFromConvID,
  isAdmin,
  isOwner,
}
