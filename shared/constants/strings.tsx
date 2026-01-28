import * as Platforms from './platform'
import type * as T from './types'
import {conversationIDKeyToString} from './types/chat2/common'

export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const addEmailWaitingKey = 'settings:addEmail'
export const importContactsWaitingKey = 'settings:importContacts'

export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'

export const waitingKeySignup = 'signup:waiting'

export const waitingKeyChatLeaveConversation = 'chat:leaveConversation'
export const waitingKeyChatInboxRefresh = 'chat:inboxRefresh'
export const waitingKeyChatCreating = 'chat:creatingConvo'
export const waitingKeyChatInboxSyncStarted = 'chat:inboxSyncStarted'
export const waitingKeyChatBotAdd = 'chat:botAdd'
export const waitingKeyChatBotRemove = 'chat:botRemove'
export const waitingKeyChatLoadingEmoji = 'chat:loadingEmoji'
export const waitingKeyChatThreadLoad = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:loadingThread:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyChatUnpin = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:unpin:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyChatMutualTeams = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:mutualTeams:${conversationIDKeyToString(conversationIDKey)}`

export const waitingKeyTracker = 'tracker2:waitingKey'
export const waitingKeyTrackerProfileLoad = 'tracker2:profileLoad'

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
export const waitingKeyTeamsTeam = (teamID: T.Teams.TeamID) => `team:${teamID}`
export const waitingKeyTeamsSetMemberPublicity = (teamID: T.Teams.TeamID) => `teamMemberPub:${teamID}`
export const waitingKeyTeamsTeamTars = (teamID: T.Teams.TeamID) => `teamTars:${teamID}`
export const waitingKeyTeamsCreation = 'teamCreate'
export const waitingKeyTeamsAddUserToTeams = (username: string) => `addUserToTeams:${username}`
export const waitingKeyTeamsAddToTeamByEmail = (teamname: T.Teams.Teamname) => `teamAddByEmail:${teamname}`
export const waitingKeyTeamsGetChannels = (teamID: T.Teams.TeamID) => `getChannels:${teamID}`
export const waitingKeyTeamsCreateChannel = (teamID: T.Teams.TeamID) => `createChannel:${teamID}`
export const waitingKeyTeamsAddMember = (teamID: T.Teams.TeamID, ...usernames: ReadonlyArray<string>) =>
  `teamAdd:${teamID};${usernames.join(',')}`
export const waitingKeyTeamsRemoveMember = (teamID: T.Teams.TeamID, id: string) =>
  `teamRemove:${teamID};${id}`
export const waitingKeyTeamsProfileAddList = 'teamProfileAddList'
export const waitingKeyTeamsDeleteChannel = (teamID: T.Teams.TeamID) => `channelDelete:${teamID}`
export const waitingKeyTeamsDeleteTeam = (teamID: T.Teams.TeamID) => `teamDelete:${teamID}`
export const waitingKeyTeamsLeaveTeam = (teamname: T.Teams.Teamname) => `teamLeave:${teamname}`
export const waitingKeyTeamsRename = 'teams:rename'
export const waitingKeyTeamsLoadWelcomeMessage = (teamID: T.Teams.TeamID) => `loadWelcomeMessage:${teamID}`
export const waitingKeyTeamsLoadTeamTreeActivity = (teamID: T.Teams.TeamID, username: string) =>
  `loadTeamTreeActivity:${teamID};${username}`
export const waitingKeyTeamsEditMembership = (teamID: T.Teams.TeamID, ...usernames: ReadonlyArray<string>) =>
  `editMembership:${teamID};${usernames.join(',')}`
export const waitingKeyTeamsUpdateChannelName = (teamID: T.Teams.TeamID) => `updateChannelName:${teamID}`

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

export const currentVersion: string = '5.5.0'
export const lastVersion: string = '5.4.0'
export const lastLastVersion: string = '5.3.0'
export const keybaseFM = 'Keybase FM 87.7'

export const waitingKeyGitLoading = 'git:loading'

export const waitingKeyUsersGetUserBlocks = 'users:getUserBlocks'
export const waitingKeyUsersSetUserBlocks = 'users:setUserBlocks'
export const waitingKeyUsersReportUser = 'users:reportUser'

export const waitingKeyPushPermissionsRequesting = 'push:permissionsRequesting'

export const defaultDevicename =
  (Platforms.isAndroid ? 'Android Device' : undefined) ||
  (Platforms.isIOS ? 'iOS Device' : undefined) ||
  (Platforms.isDarwin ? 'Mac Device' : undefined) ||
  (Platforms.isWindows ? 'Windows Device' : undefined) ||
  (Platforms.isLinux ? 'Linux Device' : undefined) ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')
