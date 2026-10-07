import type * as T from './types'
import {conversationIDKeyToString} from './types/chat/common'

export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const addEmailWaitingKey = 'settings:addEmail'
export const importContactsWaitingKey = 'settings:importContacts'

export const waitingKeySignup = 'signup:waiting'

export const waitingKeyChatLeaveConversation = 'chat:leaveConversation'
export const waitingKeyChatInboxRefresh = 'chat:inboxRefresh'
export const waitingKeyChatCreating = 'chat:creatingConvo'
export const waitingKeyChatInboxSyncStarted = 'chat:inboxSyncStarted'
export const waitingKeyChatBotAdd = 'chat:botAdd'
export const waitingKeyChatBotRemove = 'chat:botRemove'
export const waitingKeyChatThreadLoad = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:loadingThread:${conversationIDKeyToString(conversationIDKey)}` as const
export const waitingKeyChatUnpin = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:unpin:${conversationIDKeyToString(conversationIDKey)}` as const
export const waitingKeyChatMutualTeams = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:mutualTeams:${conversationIDKeyToString(conversationIDKey)}` as const

export const waitingKeyTracker = 'tracker:waitingKey'
export const waitingKeyTrackerProfileLoad = 'tracker:profileLoad'
export const waitingKeyTrackerSharedTeams = (username: string) =>
  `tracker:sharedTeams:${username.toLowerCase()}` as const

export const waitingKeyProvision = 'provision:waiting'
export const waitingKeyProvisionForgotUsername = 'provision:forgotUsername'

export const waitingKeyProfile = 'profile:waiting'
export const waitingKeyProfileUploadAvatar = 'profile:uploadAvatar'

export const waitingKeyBotsSearchFeatured = 'bots:search:featured'
export const waitingKeyBotsSearchUsers = 'bots:search:users'

export const waitingKeyDevices = 'devices:devicesPage'

export const waitingKeyRecoverPassword = 'recover-password:waiting'

export const waitingKeyCrypto = 'cryptoWaiting'

export const searchWaitingKey = 'teamBuilding:search'

export const waitingKeyTeamsLoaded = 'teams:loaded'
export const waitingKeyTeamsJoinTeam = 'teams:joinTeam'
export const waitingKeyTeamsTeam = (teamID: T.Teams.TeamID) => `team:${teamID}` as const
export const waitingKeyTeamsSetOpenTeam = (teamID: T.Teams.TeamID) => `teamOpen:${teamID}` as const
export const waitingKeyTeamsSetMemberPublicity = (teamID: T.Teams.TeamID) =>
  `teamMemberPub:${teamID}` as const
export const waitingKeyTeamsSetTeamShowcase = (teamID: T.Teams.TeamID) => `teamShowcase:${teamID}` as const
export const waitingKeyTeamsTeamTars = (teamID: T.Teams.TeamID) => `teamTars:${teamID}` as const
export const waitingKeyTeamsCreation = 'teamCreate'
export const waitingKeyTeamsAddUserToTeams = (username: string) => `addUserToTeams:${username}` as const
export const waitingKeyTeamsAddToTeamByEmail = (teamname: T.Teams.Teamname) =>
  `teamAddByEmail:${teamname}` as const
export const waitingKeyTeamsGetChannels = (teamID: T.Teams.TeamID) => `getChannels:${teamID}` as const
export const waitingKeyTeamsCreateChannel = (teamID: T.Teams.TeamID) => `createChannel:${teamID}` as const
export const waitingKeyTeamsAddMember = (teamID: T.Teams.TeamID, ...usernames: ReadonlyArray<string>) =>
  `teamAdd:${teamID};${usernames.join(',')}` as const
export const waitingKeyTeamsRemoveMember = (teamID: T.Teams.TeamID, id: string) =>
  `teamRemove:${teamID};${id}` as const
export const waitingKeyTeamsProfileAddList = 'teamProfileAddList'
export const waitingKeyTeamsDeleteChannel = (teamID: T.Teams.TeamID) => `channelDelete:${teamID}` as const
export const waitingKeyTeamsDeleteTeam = (teamID: T.Teams.TeamID) => `teamDelete:${teamID}` as const
export const waitingKeyTeamsLeaveTeam = (teamname: T.Teams.Teamname) => `teamLeave:${teamname}` as const
export const waitingKeyTeamsRename = 'teams:rename'
export const waitingKeyTeamsLoadWelcomeMessage = (teamID: T.Teams.TeamID) =>
  `loadWelcomeMessage:${teamID}` as const
export const waitingKeyTeamsLoadRetentionPolicy = (teamID: T.Teams.TeamID) =>
  `teamRetentionLoad:${teamID}` as const
export const waitingKeyTeamsSetRetentionPolicy = (teamID: T.Teams.TeamID) =>
  `teamRetention:${teamID}` as const
export const waitingKeyTeamsLoadTeamTreeActivity = (teamID: T.Teams.TeamID, username: string) =>
  `loadTeamTreeActivity:${teamID};${username}` as const
export const waitingKeyTeamsEditMembership = (teamID: T.Teams.TeamID, ...usernames: ReadonlyArray<string>) =>
  `editMembership:${teamID};${usernames.join(',')}` as const
export const waitingKeyTeamsUpdateChannelName = (teamID: T.Teams.TeamID) =>
  `updateChannelName:${teamID}` as const
export const waitingKeyTeamsEmailLookup = 'emailLookup'
export const waitingKeyTeamsPhoneLookup = 'phoneLookup'

export const waitingKeyConfigLoginAsOther = 'config:loginAsOther'
export const waitingKeyConfigLogin = 'login:waiting'

export const waitingKeyAutoresetEnterPipeline = 'autoreset:EnterPipelineWaitingKey'
export const waitingKeyAutoresetActuallyReset = 'autoreset:ActuallyResetWaitingKey'
export const waitingKeyAutoresetCancel = 'autoreset:cancelWaitingKey'

export const waitingKeySettingsSetLockdownMode = 'settings:setLockdownMode'
export const waitingKeySettingsCheckPassword = 'settings:checkPassword'
export const waitingKeySettingsSendFeedback = 'settings:sendFeedback'
export const waitingKeySettingsLoadSettings = 'settings:loadSettings'
export const waitingKeySettingsGeneric = 'settings:generic'
export const waitingKeySettingsFollowButton = (username: string) =>
  `settings:followButton:${username}` as const
export const waitingKeySettingsWaveButton = (recipient: string) => `settings:waveButton:${recipient}` as const
export const traceInProgressKey = 'settings:traceInProgress'
export const processorProfileInProgressKey = 'settings:processorProfileInProgress'

export const waitingKeySettingsPhoneVerifyPhoneNumber = 'settings:verifyPhoneNumber'
export const waitingKeySettingsPhoneAddPhoneNumber = 'settings:addPhoneNumber'
export const waitingKeySettingsPhoneResendVerification = 'settings:resendVerificationForPhone'

export const waitingKeySettingsChatContactSettingsSave = 'settings:contactSettingsSaveWaitingKey'
export const waitingKeySettingsChatUnfurl = 'settings:chatUnfurlWaitingKey'

export const waitingKeyFSSyncToggle = 'fs:syncToggle'
export const waitingKeyFSFolderList = 'fs:folderList'
export const waitingKeyFSStat = 'fs:stat'
export const waitingKeyFSCommitEdit = 'fs:commitEditWaitingKey'
export const waitingKeyFSSetSyncOnCellular = 'fs:setSyncOnCellular'

export const loadAccountsWaitingKey = 'wallets:loadAccounts'

export const waitingKeyGitLoading = 'git:loading'

export const waitingKeyPeopleGetData = 'getPeopleData'

export const waitingKeyUnlockFolders = 'unlock-folders:waiting'

export const waitingKeyUsersGetUserBlocks = 'users:getUserBlocks'
export const waitingKeyUsersSetUserBlocks = 'users:setUserBlocks'
export const waitingKeyUsersReportUser = 'users:reportUser'

export const waitingKeyPushPermissionsRequesting = 'push:permissionsRequesting'
