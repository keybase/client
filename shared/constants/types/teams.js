// @flow
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import type {ConversationIDKey} from './chat'

export type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'

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

export type TeamSettings = RPCTypes.TeamSettings
export type ChannelMembershipState = {[channelname: string]: boolean}

export type _ChannelInfo = {
  channelname: ?string,
  description: ?string,
  participants: I.Set<string>,
}

export type ChannelInfo = I.RecordOf<_ChannelInfo>
export type _MemberInfo = {
  active: boolean,
  fullName: string,
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

export type TypeMap = {
  admin: string | boolean,
  owner: string | boolean,
  reader: string | boolean,
  writer: string | boolean,
}

export type _State = {
  convIDToChannelInfo: I.Map<ConversationIDKey, ChannelInfo>,
  sawChatBanner: boolean,
  sawSubteamsBanner: boolean,
  teamAccessRequestsPending: I.Set<Teamname>,
  teamNameToConvIDs: I.Map<Teamname, I.Set<ConversationIDKey>>,
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
  teamNameToIsOpen: I.Map<Teamname, boolean>,
  teamNameToLoadingInvites: I.Map<Teamname, I.Map<string, boolean>>,
  teamNameToMembers: I.Map<Teamname, I.Set<MemberInfo>>,
  teamNameToMemberUsernames: I.Map<Teamname, I.Set<string>>,
  teamNameToRequests: I.Map<Teamname, I.Set<RequestInfo>>,
  teamNameToRole: I.Map<Teamname, TeamRoleType>,
  teamNameToSubteams: I.Map<Teamname, I.Set<Teamname>>,
  teamNameToCanPerform: I.Map<Teamname, RPCTypes.TeamOperation>,
  teamNameToTeamSettings: I.Map<Teamname, TeamSettings>,
  teamNameToPublicitySettings: I.Map<Teamname, _PublicitySettings>,
  teamnames: I.Set<Teamname>,
  teammembercounts: I.Map<Teamname, number>,
  newTeams: I.Set<string>,
  newTeamRequests: I.List<string>,
  loaded: boolean,
}

export type State = I.RecordOf<_State>
