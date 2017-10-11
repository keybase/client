// @flow
import * as I from 'immutable'
import * as ChatConstants from './chat'
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

type _State = {
  convIDToChannelInfo: I.Map<ChatConstants.ConversationIDKey, ChannelInfo>,
  sawChatBanner: boolean,
  teamNameToConvIDs: I.Map<Teamname, ChatConstants.ConversationIDKey>,
  teamNameToMembers: I.Map<Teamname, I.Set<MemberInfo>>,
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
  teamNameToMembers: I.Map(),
  teamNameToLoading: I.Map(),
  teamNameToRequests: I.Map(),
  teamnames: I.Set(),
  loaded: false,
})

const getConversationIDKeyFromChannelName = (state: TypedState, channelname: string) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo'], I.Map()).findKey(i => i.channelname === channelname)

const getParticipants = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo', conversationIDKey, 'participants'], I.Set())

export const getFollowingMap = ChatConstants.getFollowingMap

export {getConversationIDKeyFromChannelName, getParticipants}
