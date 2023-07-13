import type * as RPCTypes from './rpc-gen'
import type {ConversationIDKey} from './chat2'

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
