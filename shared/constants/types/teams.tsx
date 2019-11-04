import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import {ConversationIDKey} from './chat2'
import {RetentionPolicy} from './retention-policy'
import * as RPCChatTypes from './rpc-chat-gen'
import {TeamBuildingSubState} from './team-building'

export type TeamID = string
export const stringToTeamID = (s: string): TeamID => s
export const teamIDToString = (t: TeamID): string => t
export const noTeamID = 'NOTEAMID'

export type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner' | 'bot' | 'restrictedbot'
export type DisabledReasonsForRolePicker = {[K in TeamRoleType]?: string}
export type MaybeTeamRoleType = 'none' | TeamRoleType
export type TeamOperations = RPCTypes.TeamOperation
export type PublicitySettings = {
  ignoreAccessRequests: boolean
  openTeam: boolean
  openTeamRole: TeamRoleType
  publicityAnyMember: boolean
  publicityMember: boolean
  publicityTeam: boolean
}

export type Teamname = string

export type TeamProfileAddList = {
  disabledReason: string
  teamName: Teamname
  open: boolean
}
export type _PublicitySettings = {
  anyMemberShowcase: boolean
  description: string
  ignoreAccessRequests: boolean
  member: boolean
  team: boolean
}

export type _TeamSettings = {} & RPCTypes.TeamSettings
export type TeamSettings = I.RecordOf<_TeamSettings> // TODO remove

export type ChannelMembershipState = {[K in ConversationIDKey]: boolean}

export type _ChannelInfo = {
  channelname: string
  description: string
  hasAllMembers?: boolean | null
  memberStatus: RPCChatTypes.ConversationMemberStatus
  mtime: number
  numParticipants: number
}
export type ChannelInfo = I.RecordOf<_ChannelInfo>

export type MemberStatus = 'active' | 'deleted' | 'reset'
export type _MemberInfo = {
  fullName: string
  status: MemberStatus
  type: TeamRoleType
  username: string
}
export type MemberInfo = I.RecordOf<_MemberInfo>

export type _InviteInfo = {
  email: string
  phone: string
  name: string
  role: TeamRoleType
  username: string
  id: string
}
export type InviteInfo = I.RecordOf<_InviteInfo> // TODO remove

export type TabKey = 'members' | 'requests' | 'pending'

export type _SubteamInfo = {
  key: string
  members: number
  onCreateSubteam: ((e: React.SyntheticEvent) => void) | null
  onHideSubteamsBanner: () => void
  onReadMore: () => void
  teamname: string
  type: 'addSubteam' | 'intro' | 'noSubteams' | 'subteam'
}
export type SubteamInfo = I.RecordOf<_SubteamInfo>

export type TypeMap = {[K in TeamRoleType]: string}

export type BoolTypeMap = {[K in TeamRoleType]: boolean}

export type ResetUserBadgeID = Buffer
export type ResetUserBadgeIDKey = string
export type _ResetUser = {
  username: string
  badgeIDKey: ResetUserBadgeIDKey
}
export type ResetUser = I.RecordOf<_ResetUser>

export type EmailInviteError = {
  malformed: Set<string>
  message: string
}

export type AddUserToTeamsState = 'notStarted' | 'pending' | 'succeeded' | 'failed'

export type TeamDetails = {
  allowPromote: boolean
  id: TeamID
  isMember: boolean
  isOpen: boolean
  memberCount: number
  role: MaybeTeamRoleType
  showcasing: boolean
  teamname: string

  members?: Map<string, _MemberInfo>
  settings?: _TeamSettings
  invites?: Set<_InviteInfo>
  subteams?: Set<string>
  requests?: Set<string>
}

export type TeamRoleAndDetails = {
  implicitAdmin: boolean
  role: MaybeTeamRoleType
}

export type TeamRoleMap = {
  latestKnownVersion: number
  loadedVersion: number
  roles: Map<TeamID, TeamRoleAndDetails>
}

export type State = Readonly<{
  addUserToTeamsState: AddUserToTeamsState
  addUserToTeamsResults: string
  channelCreationError: string
  deletedTeams: Array<RPCTypes.DeletedTeamInfo>
  emailInviteError: EmailInviteError
  teamsWithChosenChannels: Set<Teamname>
  sawChatBanner: boolean
  sawSubteamsBanner: boolean
  teamAccessRequestsPending: Set<Teamname>
  teamInviteError: string
  teamJoinError: string
  teamJoinSuccess: boolean
  teamJoinSuccessTeamName: string
  teamCreationError: string
  teamDetails: Map<TeamID, TeamDetails>
  teamNameToChannelInfos: I.Map<Teamname, I.Map<ConversationIDKey, ChannelInfo>>
  teamNameToID: I.Map<Teamname, string>
  teamNameToInvites: I.Map<Teamname, I.Set<InviteInfo>> // TODO remove
  teamNameToIsOpen: I.Map<Teamname, boolean> // TODO remove
  teamNameToLoadingInvites: I.Map<Teamname, I.Map<string, boolean>>
  teamNameToMembers: I.Map<Teamname, I.Map<string, MemberInfo>> // TODO remove
  teamNameToRequests: I.Map<Teamname, I.Set<string>> // TODO remove
  teamNameToResetUsers: I.Map<Teamname, I.Set<ResetUser>>
  teamNameToRetentionPolicy: I.Map<Teamname, RetentionPolicy>
  teamNameToRole: I.Map<Teamname, MaybeTeamRoleType>
  teamNameToSubteams: I.Map<Teamname, I.Set<Teamname>> // TODO remove
  teamNameToCanPerform: I.Map<Teamname, TeamOperations>
  teamNameToSettings: I.Map<Teamname, TeamSettings>
  teamNameToPublicitySettings: I.Map<Teamname, _PublicitySettings>
  teamNameToAllowPromote: I.Map<Teamname, boolean> // TODO remove
  teamNameToIsShowcasing: I.Map<Teamname, boolean> // TODO remove
  teamnames: Set<Teamname> // TODO remove
  teammembercounts: I.Map<Teamname, number>
  teamProfileAddList: Array<TeamProfileAddList>
  teamRoleMap: TeamRoleMap
  newTeams: Set<TeamID>
  newTeamRequests: Map<TeamID, number>
  newTeamRequestsByName: Map<string, number> // TODO remove
  teamBuilding: TeamBuildingSubState
}>
