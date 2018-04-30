// @flow
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import type {ConversationIDKey} from './chat2'

export type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'
export type MaybeTeamRoleType = 'none' | TeamRoleType

export type TeamOperations = RPCTypes.TeamOperation

export type PublicitySettings = {
  ignoreAccessRequests: boolean,
  openTeam: boolean,
  openTeamRole: TeamRoleType,
  publicityAnyMember: boolean,
  publicityMember: boolean,
  publicityTeam: boolean,
}

export type Teamname = string

export type _PublicitySettings = {
  anyMemberShowcase: boolean,
  description: string,
  ignoreAccessRequests: boolean,
  member: boolean,
  team: boolean,
}

// Record types don't play well with $ReadOnly types, which
// RPCTypes.TeamSettings is, so we want to extract the underlying
// writeable type. Just spreading doesn't give us what we want, as
// that makes all keys optional (see
// https://github.com/facebook/flow/issues/3534 ), so use $Exact to
// fix that.
export type _TeamSettings = {...$Exact<RPCTypes.TeamSettings>}
export type TeamSettings = I.RecordOf<_TeamSettings>

export type ChannelMembershipState = {[ConversationIDKey]: boolean}

// `days` should be left as 0 unless `type` is expire
export type _RetentionPolicy = {type: 'inherit' | 'expire' | 'retain', days: number}
export type RetentionPolicy = I.RecordOf<_RetentionPolicy>

export type _ChannelInfo = {
  channelname: string,
  description: string,
  participants: I.Set<string>,
}
export type ChannelInfo = I.RecordOf<_ChannelInfo>

export type _MemberInfo = {
  active: boolean,
  fullName: string,
  type: TeamRoleType,
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

export type _SubteamInfo = {
  key: string,
  members: number,
  onCreateSubteam: ?(e: SyntheticEvent<>) => void,
  onHideSubteamsBanner: () => void,
  onReadMore: () => void,
  teamname: string,
  type: 'addSubteam' | 'intro' | 'noSubteams' | 'subteam',
}
export type SubteamInfo = I.RecordOf<_SubteamInfo>

export type TypeMap = {[TeamRoleType]: string}

export type BoolTypeMap = {[TeamRoleType]: boolean}

export type ResetUserBadgeID = Buffer
export type ResetUserBadgeIDKey = string
export type _ResetUser = {
  username: string,
  badgeIDKey: ResetUserBadgeIDKey,
}
export type ResetUser = I.RecordOf<_ResetUser>

export type _State = {
  channelCreationError: string,
  teamsWithChosenChannels: I.Set<Teamname>,
  sawChatBanner: boolean,
  sawSubteamsBanner: boolean,
  teamAccessRequestsPending: I.Set<Teamname>,
  teamInviteError: string,
  teamJoinError: string,
  teamJoinSuccess: boolean,
  teamJoinSuccessTeamName: string,
  teamCreationError: string,
  teamCreationPending: boolean,
  teamNameToChannelInfos: I.Map<Teamname, I.Map<ConversationIDKey, ChannelInfo>>,
  teamNameToID: I.Map<Teamname, string>,
  teamNameToInvites: I.Map<Teamname, I.Set<InviteInfo>>,
  teamNameToIsOpen: I.Map<Teamname, boolean>,
  teamNameToLoadingInvites: I.Map<Teamname, I.Map<string, boolean>>,
  teamNameToMembers: I.Map<Teamname, I.Map<string, MemberInfo>>,
  teamNameToRequests: I.Map<Teamname, I.Set<RequestInfo>>,
  teamNameToResetUsers: I.Map<Teamname, I.Set<ResetUser>>,
  teamNameToRetentionPolicy: I.Map<Teamname, RetentionPolicy>,
  teamNameToRole: I.Map<Teamname, MaybeTeamRoleType>,
  teamNameToSubteams: I.Map<Teamname, I.Set<Teamname>>,
  teamNameToCanPerform: I.Map<Teamname, TeamOperations>,
  teamNameToSettings: I.Map<Teamname, TeamSettings>,
  teamNameToPublicitySettings: I.Map<Teamname, _PublicitySettings>,
  teamNameToAllowPromote: I.Map<Teamname, boolean>,
  teamNameToIsShowcasing: I.Map<Teamname, boolean>,
  teamnames: I.Set<Teamname>,
  teammembercounts: I.Map<Teamname, number>,
  newTeams: I.Set<string>,
  newTeamRequests: I.List<string>,
  loaded: boolean,
}

export type State = I.RecordOf<_State>
