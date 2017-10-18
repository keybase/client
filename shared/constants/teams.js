// @flow
import * as I from 'immutable'
import * as ChatConstants from './chat'
import {userIsInTeam} from './selectors'
import invert from 'lodash/invert'
import {TeamsTeamRole} from './types/flow-types'

import type {Service} from './search'
import {type NoErrorTypedAction} from './types/flux'
import {type TypedState} from './reducer'

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

export type GetTeams = NoErrorTypedAction<'teams:getTeams', {}>

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
  name: string,
  role: string,
}
export type InviteInfo = I.RecordOf<_InviteInfo>
export const makeInviteInfo: I.RecordFactory<_InviteInfo> = I.Record({
  name: '',
  role: '',
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

export type SetTeamJoinError = NoErrorTypedAction<'teams:setTeamJoinError', {teamJoinError: string}>
export type SetTeamJoinSuccess = NoErrorTypedAction<'teams:setTeamJoinSuccess', {teamJoinSuccess: boolean}>

export type AddPeopleToTeam = NoErrorTypedAction<'teams:addPeopleToTeam', {role: string, teamname: string}>

export type InviteToTeamByEmail = NoErrorTypedAction<'teams:inviteToTeamByEmail', {invitees: string, role: string, teamname: string}>

export const teamRoleByEnum = invert(TeamsTeamRole)

type _State = {
  convIDToChannelInfo: I.Map<ChatConstants.ConversationIDKey, ChannelInfo>,
  sawChatBanner: boolean,
  teamNameToConvIDs: I.Map<Teamname, ChatConstants.ConversationIDKey>,
  teamNameToInvites: I.Map<Teamname, I.Record<{
    role: teamRoleByEnum,
    name: string,
  }>>,
  teamNameToMembers: I.Map<Teamname, I.Set<MemberInfo>>,
  teamNameToMemberUsernames: I.Map<Teamname, I.Set<string>>,
  teamNameToLoading: I.Map<Teamname, boolean>,
  teamNameToRequests: I.Map<Teamname, I.List<string>>,
  teamnames: I.Set<Teamname>,
  loaded: boolean,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  convIDToChannelInfo: I.Map(),
  sawChatBanner: false,
  teamNameToConvIDs: I.Map(),
  teamNameToInvites: I.Map(),
  teamNameToLoading: I.Map(),
  teamNameToMemberUsernames: I.Map(),
  teamNameToMembers: I.Map(),
  teamNameToRequests: I.Map(),
  teamnames: I.Set(),
  loaded: false,
})

const userIsInTeamHelper = (state: TypedState, username: string, service: Service, teamname: string) =>
  service === 'Keybase' ? userIsInTeam(state, teamname, username) : false

const getConversationIDKeyFromChannelName = (state: TypedState, channelname: string) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo'], I.Map()).findKey(i => i.channelname === channelname)

const getParticipants = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo', conversationIDKey, 'participants'], I.Set())

export const getFollowingMap = ChatConstants.getFollowingMap
export const getFollowerMap = (state: TypedState) => state.config.followers

export {getConversationIDKeyFromChannelName, getParticipants, userIsInTeamHelper}
