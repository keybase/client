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
export type TeamOperations = Omit<RPCTypes.TeamOperation, 'leaveTeam' | 'setMemberShowcase'>
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

export type TeamSettings = {} & RPCTypes.TeamSettings

export type ChannelMembershipState = {[K in ConversationIDKey]: boolean}

export type ChannelInfo = {
  channelname: string
  description: string
  hasAllMembers?: boolean | null
  memberStatus: RPCChatTypes.ConversationMemberStatus
  mtime: number
  numParticipants: number
}

export type MemberStatus = 'active' | 'deleted' | 'reset'
export type MemberInfo = {
  fullName: string
  status: MemberStatus
  type: TeamRoleType
  username: string
}

export type InviteInfo = {
  email: string
  phone: string
  name: string
  role: TeamRoleType
  username: string
  id: string
}

export type TabKey = 'members' | 'invites' | 'bots' | 'subteams' | 'settings'

export type TypeMap = {[K in TeamRoleType]: string}

export type BoolTypeMap = {[K in TeamRoleType]: boolean}

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

  members?: Map<string, MemberInfo>
  settings?: TeamSettings
  invites?: Set<InviteInfo>
  subteams?: Set<TeamID>
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
  canPerform: Map<TeamID, TeamOperations>
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
  teamJoinSuccessOpen: boolean
  teamJoinSuccessTeamName: string
  teamCreationError: string
  teamDetails: Map<TeamID, TeamDetails>
  teamDetailsMetaStale: boolean // if we've received an update since we last loaded team list
  teamDetailsMetaSubscribeCount: number // if >0 we are eagerly reloading team list
  teamIDToChannelInfos: Map<TeamID, Map<ConversationIDKey, ChannelInfo>>
  teamIDToPublicitySettings: Map<TeamID, _PublicitySettings>
  teamIDToResetUsers: Map<TeamID, Set<string>>
  teamIDToRetentionPolicy: Map<TeamID, RetentionPolicy>
  teamNameToID: Map<Teamname, string>
  teamNameToLoadingInvites: Map<Teamname, Map<string, boolean>>
  teamnames: Set<Teamname> // TODO remove
  teamProfileAddList: Array<TeamProfileAddList>
  teamRoleMap: TeamRoleMap
  newTeams: Set<TeamID>
  newTeamRequests: Map<TeamID, number>
  teamBuilding: TeamBuildingSubState
}>
