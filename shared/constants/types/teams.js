// @flow
import * as I from 'immutable'
import * as Types from './chat'
import * as RPCTypes from './flow-types'

import {type NoErrorTypedAction} from './flux'

export type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'

export type PublicitySettings = {
  openTeam: boolean,
  openTeamRole: TeamRoleType,
  publicityAnyMember: boolean,
  publicityMember: boolean,
  publicityTeam: boolean,
}

export type SetChannelCreationError = NoErrorTypedAction<
  'teams:setChannelCreationError',
  {channelCreationError: string}
>

export type SetTeamCreationError = NoErrorTypedAction<
  'teams:setTeamCreationError',
  {teamCreationError: string}
>

export type SetTeamCreationPending = NoErrorTypedAction<
  'teams:setTeamCreationPending',
  {teamCreationPending: boolean}
>

export type AddPeopleToTeam = NoErrorTypedAction<
  'teams:addPeopleToTeam',
  {role: string, teamname: string, sendChatNotification: boolean}
>

export type SetPublicity = NoErrorTypedAction<
  'teams:setPublicity',
  {settings: PublicitySettings, teamname: string}
>

// username -> removeMember
// email -> removePendingInvite
// id -> removePendingSeitanInvite
export type RemoveMemberOrPendingInvite = NoErrorTypedAction<
  'teams:removeMemberOrPendingInvite',
  {name: string, username: string, email: string, inviteID: string}
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

export type CreateChannel = NoErrorTypedAction<
  'teams:createChannel',
  {
    channelname: string,
    description: string,
    teamname: string,
    rootPath: I.List<string>,
    sourceSubPath: I.List<string>,
    destSubPath: I.List<string>,
  }
>

export type Teamname = string

export type EditDescription = NoErrorTypedAction<'teams:editDescription', {description: string, name: string}>
export type InviteToTeamByPhone = NoErrorTypedAction<
  'teams:inviteToTeamByPhone',
  {
    teamname: string,
    role: string,
    phoneNumber: string,
    fullName: ?string,
  }
>

export type _PublicitySettings = {
  anyMemberShowcase: boolean,
  description: string,
  member: boolean,
  team: boolean,
}

export type TeamSettings = RPCTypes.TeamSettings
export type ChannelMembershipState = {[channelname: string]: boolean}

export type CreateNewTeam = NoErrorTypedAction<
  'teams:createNewTeam',
  {
    name: string,
    rootPath: I.List<string>,
    sourceSubPath: I.List<string>,
    destSubPath: I.List<string>,
  }
>

export type CreateNewTeamFromConversation = NoErrorTypedAction<
  'teams:createNewTeamFromConversation',
  {
    conversationIDKey: Types.ConversationIDKey,
    name: string,
  }
>

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

export type SetupTeamHandlers = NoErrorTypedAction<'teams:setupTeamHandlers', void>
export type GetDetails = NoErrorTypedAction<'teams:getDetails', {teamname: string}>

export type _ChannelInfo = {
  channelname: ?string,
  description: ?string,
  participants: I.Set<string>,
}

export type ChannelInfo = I.RecordOf<_ChannelInfo>
export type _MemberInfo = {
  type: ?TeamRoleType,
  username: string,
}

export type MemberInfo = I.RecordOf<_MemberInfo>

export type _InviteInfo = {
  email: string,
  name: string,
  role: TeamRoleType,
  username: string,
  id: string,
}

export type InviteInfo = I.RecordOf<_InviteInfo>
export type _RequestInfo = {
  username: string,
}

export type RequestInfo = I.RecordOf<_RequestInfo>
export type TabKey = 'members' | 'requests' | 'pending'

export type SetTeamJoinError = NoErrorTypedAction<'teams:setTeamJoinError', {teamJoinError: string}>
export type SetTeamJoinSuccess = NoErrorTypedAction<'teams:setTeamJoinSuccess', {teamJoinSuccess: boolean}>

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
  {conversationIDKey: Types.ConversationIDKey, newChannelName: string}
>

export type UpdateTopic = NoErrorTypedAction<
  'teams:updateTopic',
  {conversationIDKey: Types.ConversationIDKey, newTopic: string}
>

export type DeleteChannelConfirmed = NoErrorTypedAction<
  'teams:deleteChannelConfirmed',
  {conversationIDKey: Types.ConversationIDKey}
>

export type SaveChannelMembership = NoErrorTypedAction<
  'teams:saveChannelMembership',
  {channelState: ChannelMembershipState, teamname: string}
>

export type CheckRequestedAccess = NoErrorTypedAction<'teams:checkRequestedAccess', {}>

export type TypeMap = {
  admin: string | boolean,
  owner: string | boolean,
  reader: string | boolean,
  writer: string | boolean,
}

export type _State = {
  convIDToChannelInfo: I.Map<Types.ConversationIDKey, ChannelInfo>,
  sawChatBanner: boolean,
  teamAccessRequestsPending: I.Set<Teamname>,
  teamNameToConvIDs: I.Map<Teamname, I.Set<Types.ConversationIDKey>>,
  teamNameToInvites: I.Map<
    Teamname,
    I.Set<
      I.RecordOf<{
        email: string,
        name: string,
        role: TeamRoleType,
        username: string,
        id: string,
      }>
    >
  >,
  teamNameToLoadingInvites: I.Map<Teamname, I.Map<string, boolean>>,
  teamNameToMembers: I.Map<Teamname, I.Set<MemberInfo>>,
  teamNameToMemberUsernames: I.Map<Teamname, I.Set<string>>,
  teamNameToImplicitAdminUsernames: I.Map<Teamname, I.Set<string>>,
  teamNameToLoading: I.Map<Teamname, boolean>,
  teamNameToRequests: I.Map<Teamname, I.Set<RequestInfo>>,
  teamNameToRole: I.Map<Teamname, TeamRoleType>,
  teamNameToTeamSettings: I.Map<Teamname, TeamSettings>,
  teamNameToPublicitySettings: I.Map<Teamname, _PublicitySettings>,
  teamnames: I.Set<Teamname>,
  teammembercounts: I.Map<Teamname, number>,
  newTeams: I.Set<string>,
  newTeamRequests: I.List<string>,
  loaded: boolean,
}

export type State = I.RecordOf<_State>
