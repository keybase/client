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

export type ActivityLevel = 'active' | 'recently' | 'none'

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
  conversationIDKey: ConversationIDKey
  description: string
  memberStatus: RPCChatTypes.ConversationMemberStatus
  mtime: number
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

export type TabKey = 'members' | 'invites' | 'bots' | 'subteams' | 'settings' | 'channels'

export type TypeMap = {[K in TeamRoleType]: string}

export type BoolTypeMap = {[K in TeamRoleType]: boolean}

export type EmailInviteError = {
  malformed: Set<string>
  message: string
}

export type AddUserToTeamsState = 'notStarted' | 'pending' | 'succeeded' | 'failed'

export type JoinRequest = {
  ctime: number
  fullName: string
  username: string
}

export type TeamMeta = {
  allowPromote: boolean // if members other than admins can showcase
  id: TeamID
  isMember: boolean
  isOpen: boolean
  memberCount: number
  role: MaybeTeamRoleType
  showcasing: boolean // if this team is showcased on your profile
  teamname: string
}

export type TeamDetails = {
  members: Map<string, MemberInfo>
  settings: TeamSettings2
  invites: Set<InviteInfo>
  subteams: Set<TeamID>
  requests: Set<JoinRequest>
  description: string
}

export type TeamSettings2 = {
  open: boolean
  openJoinAs: TeamRoleType
  tarsDisabled: boolean
  teamShowcased: boolean // showcased on "popular teams"
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

export type TeamVersion = {
  latestSeqno: number
  latestHiddenSeqno: number
  latestOffchainSeqno: number
}

export type TeamWizardTeamType = 'friends' | 'project' | 'community' | 'other'
export type NewTeamWizardState = {
  teamType: TeamWizardTeamType
  teamNameTaken: boolean
  name: string
  description: string
  open: boolean
  openTeamJoinRole: TeamRoleType
  showcase: boolean
}
export type AddMembersWizardState = {
  justFinished: boolean
}

export type State = {
  readonly addMembersWizard: AddMembersWizardState
  readonly addUserToTeamsState: AddUserToTeamsState
  readonly addUserToTeamsResults: string
  readonly canPerform: Map<TeamID, TeamOperations>
  readonly channelSelectedMembers: Map<ConversationIDKey, Set<string>>
  readonly deletedTeams: Array<RPCTypes.DeletedTeamInfo>
  readonly errorInAddToTeam: string
  readonly errorInChannelCreation: string
  readonly errorInEditDescription: string
  readonly errorInEditWelcomeMessage: string
  readonly errorInEmailInvite: EmailInviteError
  readonly errorInSettings: string
  readonly errorInTeamCreation: string
  readonly errorInTeamInvite: string
  readonly errorInTeamJoin: string
  readonly invitesCollapsed: Set<TeamID>
  readonly teamsWithChosenChannels: Set<Teamname>
  readonly sawChatBanner: boolean
  readonly sawSubteamsBanner: boolean
  readonly teamSelectedChannels: Map<TeamID, Set<string>>
  readonly teamSelectedMembers: Map<TeamID, Set<string>>
  readonly subteamFilter: string
  readonly subteamsFiltered: Set<TeamID> | undefined
  readonly teamAccessRequestsPending: Set<Teamname>
  readonly teamJoinSuccess: boolean
  readonly teamJoinSuccessOpen: boolean
  readonly teamJoinSuccessTeamName: string
  readonly teamMeta: Map<TeamID, TeamMeta>
  readonly teamMetaStale: boolean // if we've received an update since we last loaded team list
  readonly teamMetaSubscribeCount: number // if >0 we are eagerly reloading team list
  readonly teamDetails: Map<TeamID, TeamDetails>
  readonly teamDetailsSubscriptionCount: Map<TeamID, number> // >0 if we are eagerly reloading a team
  readonly teamIDToChannelInfos: Map<TeamID, Map<ConversationIDKey, ChannelInfo>>
  readonly teamIDToMembers: Map<TeamID, Map<string, MemberInfo>> // Used by chat sidebar until team loading gets easier
  readonly teamVersion: Map<TeamID, TeamVersion>
  readonly teamIDToResetUsers: Map<TeamID, Set<string>>
  readonly teamIDToWelcomeMessage: Map<TeamID, RPCChatTypes.WelcomeMessageDisplay>
  readonly teamIDToRetentionPolicy: Map<TeamID, RetentionPolicy>
  readonly teamNameToID: Map<Teamname, string>
  readonly teamNameToLoadingInvites: Map<Teamname, Map<string, boolean>>
  readonly teamnames: Set<Teamname> // TODO remove
  readonly teamProfileAddList: Array<TeamProfileAddList>
  readonly teamRoleMap: TeamRoleMap
  readonly newTeams: Set<TeamID>
  readonly newTeamRequests: Map<TeamID, number>
  readonly teamBuilding: TeamBuildingSubState
  readonly newTeamWizard: NewTeamWizardState
}
