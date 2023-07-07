import type * as RPCTypes from './rpc-gen'
import type {ConversationIDKey} from './chat2'
import type {RetentionPolicy} from './retention-policy'
import type * as RPCChatTypes from './rpc-chat-gen'
import type {TeamBuildingSubState} from './team-building'

export type TeamID = string
export const stringToTeamID = (s: string): TeamID => s
export const teamIDToString = (t: TeamID): string => t
export const noTeamID = 'NOTEAMID'
export const newTeamWizardTeamID = 'NewTeamWizardTeam'

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

export type MemberStatus = 'active' | 'deleted' | 'reset'
export type TreeloaderSparseMemberInfo = {
  joinTime?: number
  type: MaybeTeamRoleType
}
export type SparseMemberInfo = {
  joinTime?: number
  type: TeamRoleType
}
export type MemberInfo = SparseMemberInfo & {
  username: string
  fullName: string
  status: MemberStatus
  needsPUK: boolean
}
export type MemberInfoWithLastActivity = MemberInfo & {
  lastActivity?: number
}

export type InviteInfo = {
  email: string
  phone: string
  name: string
  role: TeamRoleType
  username: string
  id: string
}

export type TabKey = 'members' | 'invites' | 'bots' | 'subteams' | 'emoji' | 'settings' | 'channels'

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

export type InviteLink = {
  creatorUsername: string
  id: string
  isValid: boolean
  validityDescription: string
  lastJoinedUsername?: string
  numUses: number
  role: TeamRoleType
  url: string
}

export type TeamDetails = {
  members: Map<string, MemberInfo>
  settings: TeamSettings2
  // Legacy invites that are guaranteed to be active
  invites: Set<InviteInfo>
  // Invitelinks, some of which may be invalid already; most recent first
  inviteLinks: Array<InviteLink>
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

export type AvatarCrop = {
  crop: RPCTypes.ImageCropRect
  offsetLeft?: number
  offsetTop?: number
  scaledWidth?: number
}

export type TeamTreeMemberships = {
  guid: number
  targetTeamID: TeamID
  targetUsername: string
  expectedCount?: number
  memberships: Array<RPCTypes.TeamTreeMembership>
}

export type TeamChannelInfo = {
  channelname: string
  conversationIDKey: ConversationIDKey
  description: string
}

export type TeamWizardTeamType = 'friends' | 'project' | 'community' | 'other' | 'subteam'

export type NewTeamWizardState = {
  teamType: TeamWizardTeamType
  name: string
  description: string
  open: boolean
  openTeamJoinRole: TeamRoleType
  profileShowcase: boolean // showcase team on creator's profile
  addYourself: boolean // for subteams
  avatarFilename?: string
  avatarCrop?: AvatarCrop
  isBig: boolean
  channels?: string[]
  subteams?: string[]
  parentTeamID?: TeamID
  error?: string
}

export type AddingMemberTeamRoleType = 'owner' | 'admin' | 'reader' | 'writer'

export type AddingMember = {
  assertion: string
  role: AddingMemberTeamRoleType

  // If an imptofu assertion got resolved to a username, preserve that
  // assertion. Will be displayed in the confirmation screen near that
  // username, and it's also needed to display the "person was already
  // invited".
  resolvedFrom?: string
}
export type AddMembersWizardState = {
  addToChannels: Array<ChannelNameID> | undefined
  addingMembers: Array<AddingMember>
  // Assertions that were "added" through "Add people" but will not be added to
  // the team because they are already in it. This state only holds the list of
  // redundant assertions from the last "Add people" action.
  membersAlreadyInTeam: Array<string>
  justFinished: boolean
  role: AddingMemberTeamRoleType | 'setIndividually'
  teamID: TeamID
}

export type ChannelNameID = {
  channelname: string
  conversationIDKey: ConversationIDKey
}

export type ActivityLevels = {
  channels: Map<ConversationIDKey, ActivityLevel>
  teams: Map<TeamID, ActivityLevel>
  loaded: boolean
}

export type TeamListSort = 'role' | 'activity' | 'alphabetical'

export type TeamInviteState = {
  inviteID: string
  inviteKey: string
  inviteDetails?: RPCTypes.InviteLinkDetails
}

export type State = {
  addMembersWizard: AddMembersWizardState
  addUserToTeamsState: AddUserToTeamsState
  addUserToTeamsResults: string
  channelInfo: Map<TeamID, Map<ConversationIDKey, TeamChannelInfo>>
  channelSelectedMembers: Map<ConversationIDKey, Set<string>>
  creatingChannels: boolean
  deletedTeams: Array<RPCTypes.DeletedTeamInfo>
  errorInAddToTeam: string
  errorInChannelCreation: string
  errorInEditDescription: string
  errorInEditMember: {error: string; teamID: TeamID; username: string}
  errorInEditWelcomeMessage: string
  errorInEmailInvite: EmailInviteError
  errorInSettings: string
  errorInTeamCreation: string
  errorInTeamInvite: string
  errorInTeamJoin: string
  invitesCollapsed: Set<TeamID>
  teamsWithChosenChannels: Set<Teamname>
  sawChatBanner: boolean
  sawSubteamsBanner: boolean
  teamSelectedChannels: Map<TeamID, Set<string>>
  teamSelectedMembers: Map<TeamID, Set<string>>
  subteamFilter: string
  subteamsFiltered: Set<TeamID> | undefined
  teamAccessRequestsPending: Set<Teamname>
  teamJoinSuccess: boolean
  teamJoinSuccessOpen: boolean
  teamJoinSuccessTeamName: string
  teamListFilter: string
  teamListSort: TeamListSort
  teamMeta: Map<TeamID, TeamMeta>
  teamMetaStale: boolean // if we've received an update since we last loaded team list
  teamMetaSubscribeCount: number // if >0 we are eagerly reloading team list
  teamDetails: Map<TeamID, TeamDetails>
  teamDetailsSubscriptionCount: Map<TeamID, number> // >0 if we are eagerly reloading a team
  teamIDToMembers: Map<TeamID, Map<string, MemberInfo>> // Used by chat sidebar until team loading gets easier
  teamVersion: Map<TeamID, TeamVersion>
  teamIDToResetUsers: Map<TeamID, Set<string>>
  teamIDToWelcomeMessage: Map<TeamID, RPCChatTypes.WelcomeMessageDisplay>
  teamIDToRetentionPolicy: Map<TeamID, RetentionPolicy>

  treeLoaderTeamIDToSparseMemberInfos: Map<TeamID, Map<string, TreeloaderSparseMemberInfo>>
  teamMemberToTreeMemberships: Map<TeamID, Map<string, TeamTreeMemberships>>

  teamMemberToLastActivity: Map<TeamID, Map<string, number>>
  teamNameToID: Map<Teamname, string>
  teamNameToLoadingInvites: Map<Teamname, Map<string, boolean>>
  teamnames: Set<Teamname> // TODO remove
  teamProfileAddList: Array<TeamProfileAddList>
  teamRoleMap: TeamRoleMap
  newTeams: Set<TeamID>
  newTeamRequests: Map<TeamID, Set<string>>
  teamBuilding: TeamBuildingSubState
  newTeamWizard: NewTeamWizardState

  teamInviteDetails: TeamInviteState
}
