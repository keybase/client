/* eslint-disable */

// This file is auto-generated. Run `yarn update-protocol` to regenerate it.
import {getEngine as engine, getEngineListener} from '@/engine/require'
import * as Gregor1 from './rpc-gregor-gen'
export {Gregor1}
type WaitingKey = string | ReadonlyArray<string>
type SimpleError = {code?: number, desc?: string}
export type IncomingErrorCallback = (err?: SimpleError | null) => void



export type MessageTypes = {
  'keybase.1.NotifyApp.exit': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.NotifyAudit.boxAuditError': {
    inParam: {readonly message: string},
    outParam: void,
  },
  'keybase.1.NotifyAudit.rootAuditError': {
    inParam: {readonly message: string},
    outParam: void,
  },
  'keybase.1.NotifyBadges.badgeState': {
    inParam: {readonly badgeState: BadgeState},
    outParam: void,
  },
  'keybase.1.NotifyEmailAddress.emailAddressVerified': {
    inParam: {readonly emailAddress: EmailAddress},
    outParam: void,
  },
  'keybase.1.NotifyEmailAddress.emailsChanged': {
    inParam: {readonly list?: ReadonlyArray<Email> | null,readonly category: string,readonly email: EmailAddress},
    outParam: void,
  },
  'keybase.1.NotifyFS.FSActivity': {
    inParam: {readonly notification: FSNotification},
    outParam: void,
  },
  'keybase.1.NotifyFS.FSOverallSyncStatusChanged': {
    inParam: {readonly status: FolderSyncStatus},
    outParam: void,
  },
  'keybase.1.NotifyFS.FSSubscriptionNotify': {
    inParam: {readonly clientID: string,readonly subscriptionIDs?: ReadonlyArray<string> | null,readonly topic: SubscriptionTopic},
    outParam: void,
  },
  'keybase.1.NotifyFS.FSSubscriptionNotifyPath': {
    inParam: {readonly clientID: string,readonly subscriptionIDs?: ReadonlyArray<string> | null,readonly path: string,readonly topics?: ReadonlyArray<PathSubscriptionTopic> | null},
    outParam: void,
  },
  'keybase.1.NotifyFeaturedBots.featuredBotsUpdate': {
    inParam: {readonly bots?: ReadonlyArray<FeaturedBot> | null,readonly limit: number,readonly offset: number},
    outParam: void,
  },
  'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.NotifyPhoneNumber.phoneNumbersChanged': {
    inParam: {readonly list?: ReadonlyArray<UserPhoneNumber> | null,readonly category: string,readonly phoneNumber: PhoneNumber},
    outParam: void,
  },
  'keybase.1.NotifyRuntimeStats.runtimeStatsUpdate': {
    inParam: {readonly stats?: RuntimeStats | null},
    outParam: void,
  },
  'keybase.1.NotifyService.HTTPSrvInfoUpdate': {
    inParam: {readonly info: HttpSrvInfo},
    outParam: void,
  },
  'keybase.1.NotifyService.handleKeybaseLink': {
    inParam: {readonly link: string,readonly deferred: boolean},
    outParam: void,
  },
  'keybase.1.NotifyService.shutdown': {
    inParam: {readonly code: number},
    outParam: void,
  },
  'keybase.1.NotifySession.clientOutOfDate': {
    inParam: {readonly upgradeTo: string,readonly upgradeURI: string,readonly upgradeMsg: string},
    outParam: void,
  },
  'keybase.1.NotifySession.loggedIn': {
    inParam: {readonly username: string,readonly signedUp: boolean},
    outParam: void,
  },
  'keybase.1.NotifySession.loggedOut': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged': {
    inParam: {readonly status: SimpleFSArchiveStatus},
    outParam: void,
  },
  'keybase.1.NotifyTeam.avatarUpdated': {
    inParam: {readonly name: string,readonly formats?: ReadonlyArray<AvatarFormat> | null,readonly typ: AvatarUpdateType},
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamChangedByID': {
    inParam: {readonly teamID: TeamID,readonly latestSeqno: Seqno,readonly implicitTeam: boolean,readonly changes: TeamChangeSet,readonly latestHiddenSeqno: Seqno,readonly latestOffchainSeqno: Seqno,readonly source: TeamChangedSource},
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamDeleted': {
    inParam: {readonly teamID: TeamID},
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamExit': {
    inParam: {readonly teamID: TeamID},
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamMetadataUpdate': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamRoleMapChanged': {
    inParam: {readonly newVersion: UserTeamVersion},
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamTreeMembershipsDone': {
    inParam: {readonly result: TeamTreeMembershipsDoneResult},
    outParam: void,
  },
  'keybase.1.NotifyTeam.teamTreeMembershipsPartial': {
    inParam: {readonly membership: TeamTreeMembership},
    outParam: void,
  },
  'keybase.1.NotifyTracking.notifyUserBlocked': {
    inParam: {readonly b: UserBlockedSummary},
    outParam: void,
  },
  'keybase.1.NotifyTracking.trackingChanged': {
    inParam: {readonly uid: UID,readonly username: string,readonly isTracking: boolean},
    outParam: void,
  },
  'keybase.1.NotifyTracking.trackingInfo': {
    inParam: {readonly uid: UID,readonly followers?: ReadonlyArray<string> | null,readonly followees?: ReadonlyArray<string> | null},
    outParam: void,
  },
  'keybase.1.NotifyUsers.identifyUpdate': {
    inParam: {readonly okUsernames?: ReadonlyArray<string> | null,readonly brokenUsernames?: ReadonlyArray<string> | null},
    outParam: void,
  },
  'keybase.1.NotifyUsers.passwordChanged': {
    inParam: {readonly state: PassphraseState},
    outParam: void,
  },
  'keybase.1.NotifyUsers.userChanged': {
    inParam: {readonly uid: UID},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSArchiveAllFiles': {
    inParam: {readonly outputDir: string,readonly overwriteZip: boolean,readonly includePublicReadonly: boolean},
    outParam: SimpleFSArchiveAllFilesResult,
  },
  'keybase.1.SimpleFS.simpleFSArchiveAllGitRepos': {
    inParam: {readonly outputDir: string,readonly overwriteZip: boolean},
    outParam: SimpleFSArchiveAllGitReposResult,
  },
  'keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob': {
    inParam: {readonly jobID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSArchiveStart': {
    inParam: {readonly archiveJobStartPath: ArchiveJobStartPath,readonly outputPath: string,readonly overwriteZip: boolean},
    outParam: SimpleFSArchiveJobDesc,
  },
  'keybase.1.SimpleFS.simpleFSCancelDownload': {
    inParam: {readonly downloadID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSCheckReachability': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSClearConflictState': {
    inParam: {readonly path: Path},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSConfigureDownload': {
    inParam: {readonly cacheDirOverride: string,readonly downloadDirOverride: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSCopyRecursive': {
    inParam: {readonly opID: OpID,readonly src: Path,readonly dest: Path,readonly overwriteExistingFiles: boolean},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSDismissDownload': {
    inParam: {readonly downloadID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSDismissUpload': {
    inParam: {readonly uploadID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSFinishResolvingConflict': {
    inParam: {readonly path: Path},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSFolderSyncConfigAndStatus': {
    inParam: {readonly path: Path},
    outParam: FolderSyncConfigAndStatus,
  },
  'keybase.1.SimpleFS.simpleFSGetArchiveJobFreshness': {
    inParam: {readonly jobID: string},
    outParam: SimpleFSArchiveJobFreshness,
  },
  'keybase.1.SimpleFS.simpleFSGetArchiveStatus': {
    inParam: undefined,
    outParam: SimpleFSArchiveStatus,
  },
  'keybase.1.SimpleFS.simpleFSGetDownloadInfo': {
    inParam: {readonly downloadID: string},
    outParam: DownloadInfo,
  },
  'keybase.1.SimpleFS.simpleFSGetDownloadStatus': {
    inParam: undefined,
    outParam: DownloadStatus,
  },
  'keybase.1.SimpleFS.simpleFSGetFilesTabBadge': {
    inParam: undefined,
    outParam: FilesTabBadge,
  },
  'keybase.1.SimpleFS.simpleFSGetFolder': {
    inParam: {readonly path: KBFSPath},
    outParam: FolderWithFavFlags,
  },
  'keybase.1.SimpleFS.simpleFSGetGUIFileContext': {
    inParam: {readonly path: KBFSPath},
    outParam: GUIFileContext,
  },
  'keybase.1.SimpleFS.simpleFSGetOnlineStatus': {
    inParam: {readonly clientID: string},
    outParam: KbfsOnlineStatus,
  },
  'keybase.1.SimpleFS.simpleFSGetUploadStatus': {
    inParam: undefined,
    outParam: ReadonlyArray<UploadState> | null,
  },
  'keybase.1.SimpleFS.simpleFSList': {
    inParam: {readonly opID: OpID,readonly path: Path,readonly filter: ListFilter,readonly refreshSubscription: boolean},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSListFavorites': {
    inParam: undefined,
    outParam: FavoritesResult,
  },
  'keybase.1.SimpleFS.simpleFSListRecursiveToDepth': {
    inParam: {readonly opID: OpID,readonly path: Path,readonly filter: ListFilter,readonly refreshSubscription: boolean,readonly depth: number},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSMakeTempDirForUpload': {
    inParam: undefined,
    outParam: string,
  },
  'keybase.1.SimpleFS.simpleFSMove': {
    inParam: {readonly opID: OpID,readonly src: Path,readonly dest: Path,readonly overwriteExistingFiles: boolean},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSOpen': {
    inParam: {readonly opID: OpID,readonly dest: Path,readonly flags: OpenFlags},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSReadList': {
    inParam: {readonly opID: OpID},
    outParam: SimpleFSListResult,
  },
  'keybase.1.SimpleFS.simpleFSRemove': {
    inParam: {readonly opID: OpID,readonly path: Path,readonly recursive: boolean},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSetDebugLevel': {
    inParam: {readonly level: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSetFolderSyncConfig': {
    inParam: {readonly path: Path,readonly config: FolderSyncConfig},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSetNotificationThreshold': {
    inParam: {readonly threshold: number},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed': {
    inParam: {readonly dismissed: boolean},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSetSyncOnCellular': {
    inParam: {readonly syncOnCellular: boolean},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSettings': {
    inParam: undefined,
    outParam: FSSettings,
  },
  'keybase.1.SimpleFS.simpleFSStartDownload': {
    inParam: {readonly path: KBFSPath,readonly isRegularDownload: boolean},
    outParam: string,
  },
  'keybase.1.SimpleFS.simpleFSStartUpload': {
    inParam: {readonly sourceLocalPath: string,readonly targetParentPath: KBFSPath},
    outParam: string,
  },
  'keybase.1.SimpleFS.simpleFSStat': {
    inParam: {readonly path: Path,readonly refreshSubscription: boolean},
    outParam: Dirent,
  },
  'keybase.1.SimpleFS.simpleFSSubscribeNonPath': {
    inParam: {readonly identifyBehavior?: TLFIdentifyBehavior | null,readonly clientID: string,readonly subscriptionID: string,readonly topic: SubscriptionTopic,readonly deduplicateIntervalSecond: number},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSubscribePath': {
    inParam: {readonly identifyBehavior?: TLFIdentifyBehavior | null,readonly clientID: string,readonly subscriptionID: string,readonly kbfsPath: string,readonly topic: PathSubscriptionTopic,readonly deduplicateIntervalSecond: number},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSSyncStatus': {
    inParam: {readonly filter: ListFilter},
    outParam: FSSyncStatus,
  },
  'keybase.1.SimpleFS.simpleFSUnsubscribe': {
    inParam: {readonly identifyBehavior?: TLFIdentifyBehavior | null,readonly clientID: string,readonly subscriptionID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSUserEditHistory': {
    inParam: undefined,
    outParam: ReadonlyArray<FSFolderEditHistory> | null,
  },
  'keybase.1.SimpleFS.simpleFSUserIn': {
    inParam: {readonly clientID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSUserOut': {
    inParam: {readonly clientID: string},
    outParam: void,
  },
  'keybase.1.SimpleFS.simpleFSWait': {
    inParam: {readonly opID: OpID},
    outParam: void,
  },
  'keybase.1.account.cancelReset': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.account.enterResetPipeline': {
    inParam: {readonly usernameOrEmail: string,readonly passphrase: string,readonly interactive: boolean},
    outParam: void,
  },
  'keybase.1.account.getLockdownMode': {
    inParam: undefined,
    outParam: GetLockdownResponse,
  },
  'keybase.1.account.guessCurrentLocation': {
    inParam: {readonly defaultCountry: string},
    outParam: string,
  },
  'keybase.1.account.hasServerKeys': {
    inParam: undefined,
    outParam: HasServerKeysRes,
  },
  'keybase.1.account.passphraseChange': {
    inParam: {readonly oldPassphrase: string,readonly passphrase: string,readonly force: boolean},
    outParam: void,
  },
  'keybase.1.account.passphraseCheck': {
    inParam: {readonly passphrase: string},
    outParam: boolean,
  },
  'keybase.1.account.recoverUsernameWithEmail': {
    inParam: {readonly email: string},
    outParam: void,
  },
  'keybase.1.account.recoverUsernameWithPhone': {
    inParam: {readonly phone: PhoneNumber},
    outParam: void,
  },
  'keybase.1.account.setLockdownMode': {
    inParam: {readonly enabled: boolean},
    outParam: void,
  },
  'keybase.1.account.userGetContactSettings': {
    inParam: undefined,
    outParam: ContactSettings,
  },
  'keybase.1.account.userSetContactSettings': {
    inParam: {readonly settings: ContactSettings},
    outParam: void,
  },
  'keybase.1.apiserver.Delete': {
    inParam: {readonly endpoint: string,readonly args?: ReadonlyArray<StringKVPair> | null,readonly httpStatus?: ReadonlyArray<number> | null,readonly appStatusCode?: ReadonlyArray<number> | null},
    outParam: APIRes,
  },
  'keybase.1.apiserver.GetWithSession': {
    inParam: {readonly endpoint: string,readonly args?: ReadonlyArray<StringKVPair> | null,readonly httpStatus?: ReadonlyArray<number> | null,readonly appStatusCode?: ReadonlyArray<number> | null,readonly useText?: boolean | null},
    outParam: APIRes,
  },
  'keybase.1.apiserver.Post': {
    inParam: {readonly endpoint: string,readonly args?: ReadonlyArray<StringKVPair> | null,readonly httpStatus?: ReadonlyArray<number> | null,readonly appStatusCode?: ReadonlyArray<number> | null},
    outParam: APIRes,
  },
  'keybase.1.apiserver.PostJSON': {
    inParam: {readonly endpoint: string,readonly args?: ReadonlyArray<StringKVPair> | null,readonly JSONPayload?: ReadonlyArray<StringKVPair> | null,readonly httpStatus?: ReadonlyArray<number> | null,readonly appStatusCode?: ReadonlyArray<number> | null},
    outParam: APIRes,
  },
  'keybase.1.appState.powerMonitorEvent': {
    inParam: {readonly event: string},
    outParam: void,
  },
  'keybase.1.appState.updateMobileNetState': {
    inParam: {readonly state: string},
    outParam: void,
  },
  'keybase.1.config.appendGUILogs': {
    inParam: {readonly content: string},
    outParam: void,
  },
  'keybase.1.config.generateWebAuthToken': {
    inParam: undefined,
    outParam: string,
  },
  'keybase.1.config.getBootstrapStatus': {
    inParam: undefined,
    outParam: BootstrapStatus,
  },
  'keybase.1.config.getProxyData': {
    inParam: undefined,
    outParam: ProxyData,
  },
  'keybase.1.config.getRememberPassphrase': {
    inParam: undefined,
    outParam: boolean,
  },
  'keybase.1.config.getUpdateInfo': {
    inParam: undefined,
    outParam: UpdateInfo,
  },
  'keybase.1.config.getUpdateInfo2': {
    inParam: {readonly platform?: string | null,readonly version?: string | null},
    outParam: UpdateInfo2,
  },
  'keybase.1.config.guiGetValue': {
    inParam: {readonly path: string},
    outParam: ConfigValue,
  },
  'keybase.1.config.guiSetValue': {
    inParam: {readonly path: string,readonly value: ConfigValue},
    outParam: void,
  },
  'keybase.1.config.helloIAm': {
    inParam: {readonly details: ClientDetails},
    outParam: void,
  },
  'keybase.1.config.logSend': {
    inParam: {readonly statusJSON: string,readonly feedback: string,readonly sendLogs: boolean,readonly sendMaxBytes: boolean},
    outParam: LogSendID,
  },
  'keybase.1.config.requestFollowingAndUnverifiedFollowers': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.config.setProxyData': {
    inParam: {readonly proxyData: ProxyData},
    outParam: void,
  },
  'keybase.1.config.setRememberPassphrase': {
    inParam: {readonly remember: boolean},
    outParam: void,
  },
  'keybase.1.config.startUpdateIfNeeded': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.config.toggleRuntimeStats': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.config.updateLastLoggedInAndServerConfig': {
    inParam: {readonly serverConfigPath: string},
    outParam: void,
  },
  'keybase.1.config.waitForClient': {
    inParam: {readonly clientType: ClientType,readonly timeout: DurationSec},
    outParam: boolean,
  },
  'keybase.1.contacts.getContactsForUserRecommendations': {
    inParam: undefined,
    outParam: ReadonlyArray<ProcessedContact> | null,
  },
  'keybase.1.contacts.saveContactList': {
    inParam: {readonly contacts?: ReadonlyArray<Contact> | null},
    outParam: ContactListResolutionResult,
  },
  'keybase.1.cryptocurrency.registerAddress': {
    inParam: {readonly address: string,readonly force: boolean,readonly wantedFamily: string,readonly sigVersion?: SigVersion | null},
    outParam: RegisterAddressRes,
  },
  'keybase.1.ctl.dbNuke': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.ctl.getOnLoginStartup': {
    inParam: undefined,
    outParam: OnLoginStartupStatus,
  },
  'keybase.1.ctl.setOnLoginStartup': {
    inParam: {readonly enabled: boolean},
    outParam: void,
  },
  'keybase.1.ctl.stop': {
    inParam: {readonly exitCode: ExitCode},
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerChatUI': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerGregorFirehoseFiltered': {
    inParam: {readonly systems?: ReadonlyArray<string> | null},
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerHomeUI': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerIdentify3UI': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerLogUI': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerRekeyUI': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.delegateUiCtl.registerSecretUI': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.device.checkDeviceNameFormat': {
    inParam: {readonly name: string},
    outParam: boolean,
  },
  'keybase.1.device.deviceAdd': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.device.deviceHistoryList': {
    inParam: undefined,
    outParam: ReadonlyArray<DeviceDetail> | null,
  },
  'keybase.1.device.dismissDeviceChangeNotifications': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.emails.addEmail': {
    inParam: {readonly email: EmailAddress,readonly visibility: IdentityVisibility},
    outParam: void,
  },
  'keybase.1.emails.deleteEmail': {
    inParam: {readonly email: EmailAddress},
    outParam: void,
  },
  'keybase.1.emails.sendVerificationEmail': {
    inParam: {readonly email: EmailAddress},
    outParam: void,
  },
  'keybase.1.emails.setPrimaryEmail': {
    inParam: {readonly email: EmailAddress},
    outParam: void,
  },
  'keybase.1.emails.setVisibilityEmail': {
    inParam: {readonly email: EmailAddress,readonly visibility: IdentityVisibility},
    outParam: void,
  },
  'keybase.1.favorite.favoriteIgnore': {
    inParam: {readonly folder: FolderHandle},
    outParam: void,
  },
  'keybase.1.featuredBot.featuredBots': {
    inParam: {readonly limit: number,readonly offset: number,readonly skipCache: boolean},
    outParam: FeaturedBotsRes,
  },
  'keybase.1.featuredBot.search': {
    inParam: {readonly query: string,readonly limit: number,readonly offset: number},
    outParam: SearchRes,
  },
  'keybase.1.git.createPersonalRepo': {
    inParam: {readonly repoName: GitRepoName},
    outParam: RepoID,
  },
  'keybase.1.git.createTeamRepo': {
    inParam: {readonly repoName: GitRepoName,readonly teamName: TeamName,readonly notifyTeam: boolean},
    outParam: RepoID,
  },
  'keybase.1.git.deletePersonalRepo': {
    inParam: {readonly repoName: GitRepoName},
    outParam: void,
  },
  'keybase.1.git.deleteTeamRepo': {
    inParam: {readonly repoName: GitRepoName,readonly teamName: TeamName,readonly notifyTeam: boolean},
    outParam: void,
  },
  'keybase.1.git.getAllGitMetadata': {
    inParam: undefined,
    outParam: ReadonlyArray<GitRepoResult> | null,
  },
  'keybase.1.git.setTeamRepoSettings': {
    inParam: {readonly folder: FolderHandle,readonly repoID: RepoID,readonly channelName?: string | null,readonly chatDisabled: boolean},
    outParam: void,
  },
  'keybase.1.gpgUi.selectKey': {
    inParam: {readonly keys?: ReadonlyArray<GPGKey> | null},
    outParam: string,
  },
  'keybase.1.gpgUi.wantToAddGPGKey': {
    inParam: undefined,
    outParam: boolean,
  },
  'keybase.1.gregor.dismissCategory': {
    inParam: {readonly category: Gregor1.Category},
    outParam: void,
  },
  'keybase.1.gregor.getState': {
    inParam: undefined,
    outParam: Gregor1.State,
  },
  'keybase.1.gregor.updateCategory': {
    inParam: {readonly category: string,readonly body: string,readonly dtime: Gregor1.TimeOrOffset},
    outParam: Gregor1.MsgID,
  },
  'keybase.1.gregorUI.pushState': {
    inParam: {readonly state: Gregor1.State,readonly reason: PushReason},
    outParam: void,
  },
  'keybase.1.home.homeDismissAnnouncement': {
    inParam: {readonly i: HomeScreenAnnouncementID},
    outParam: void,
  },
  'keybase.1.home.homeGetScreen': {
    inParam: {readonly markViewed: boolean,readonly numFollowSuggestionsWanted: number},
    outParam: HomeScreen,
  },
  'keybase.1.home.homeMarkViewed': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.home.homeSkipTodoType': {
    inParam: {readonly t: HomeScreenTodoType},
    outParam: void,
  },
  'keybase.1.homeUI.homeUIRefresh': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.identify3.identify3': {
    inParam: {readonly assertion: Identify3Assertion,readonly guiID: Identify3GUIID,readonly ignoreCache: boolean},
    outParam: void,
  },
  'keybase.1.identify3.identify3FollowUser': {
    inParam: {readonly guiID: Identify3GUIID,readonly follow: boolean},
    outParam: void,
  },
  'keybase.1.identify3.identify3IgnoreUser': {
    inParam: {readonly guiID: Identify3GUIID},
    outParam: void,
  },
  'keybase.1.identify3Ui.identify3Result': {
    inParam: {readonly guiID: Identify3GUIID,readonly result: Identify3ResultType},
    outParam: void,
  },
  'keybase.1.identify3Ui.identify3ShowTracker': {
    inParam: {readonly guiID: Identify3GUIID,readonly assertion: Identify3Assertion,readonly reason: IdentifyReason,readonly forceDisplay?: boolean},
    outParam: void,
  },
  'keybase.1.identify3Ui.identify3Summary': {
    inParam: {readonly summary: Identify3Summary},
    outParam: void,
  },
  'keybase.1.identify3Ui.identify3UpdateRow': {
    inParam: {readonly row: Identify3Row},
    outParam: void,
  },
  'keybase.1.identify3Ui.identify3UpdateUserCard': {
    inParam: {readonly guiID: Identify3GUIID,readonly card: UserCard},
    outParam: void,
  },
  'keybase.1.identify3Ui.identify3UserReset': {
    inParam: {readonly guiID: Identify3GUIID},
    outParam: void,
  },
  'keybase.1.incomingShare.getIncomingShareItems': {
    inParam: undefined,
    outParam: ReadonlyArray<IncomingShareItem> | null,
  },
  'keybase.1.incomingShare.getPreference': {
    inParam: undefined,
    outParam: IncomingSharePreference,
  },
  'keybase.1.incomingShare.setPreference': {
    inParam: {readonly preference: IncomingSharePreference},
    outParam: void,
  },
  'keybase.1.install.fuseStatus': {
    inParam: {readonly bundleVersion: string},
    outParam: FuseStatus,
  },
  'keybase.1.install.installFuse': {
    inParam: undefined,
    outParam: InstallResult,
  },
  'keybase.1.install.installKBFS': {
    inParam: undefined,
    outParam: InstallResult,
  },
  'keybase.1.install.uninstallKBFS': {
    inParam: undefined,
    outParam: UninstallResult,
  },
  'keybase.1.kbfsMount.GetCurrentMountDir': {
    inParam: undefined,
    outParam: string,
  },
  'keybase.1.kbfsMount.GetKBFSPathInfo': {
    inParam: {readonly standardPath: string},
    outParam: KBFSPathInfo,
  },
  'keybase.1.kbfsMount.GetPreferredMountDirs': {
    inParam: undefined,
    outParam: ReadonlyArray<string> | null,
  },
  'keybase.1.kbfsMount.WaitForMounts': {
    inParam: undefined,
    outParam: boolean,
  },
  'keybase.1.log.perfLogPoint': {
    inParam: {readonly msg: string},
    outParam: void,
  },
  'keybase.1.logUi.log': {
    inParam: {readonly level: LogLevel,readonly text: Text},
    outParam: void,
  },
  'keybase.1.login.accountDelete': {
    inParam: {readonly passphrase?: string | null},
    outParam: void,
  },
  'keybase.1.login.deprovision': {
    inParam: {readonly username: string,readonly doRevoke: boolean},
    outParam: void,
  },
  'keybase.1.login.getConfiguredAccounts': {
    inParam: undefined,
    outParam: ReadonlyArray<ConfiguredAccount> | null,
  },
  'keybase.1.login.isOnline': {
    inParam: undefined,
    outParam: boolean,
  },
  'keybase.1.login.login': {
    inParam: {readonly deviceType: DeviceTypeV2,readonly username: string,readonly clientType: ClientType,readonly doUserSwitch?: boolean,readonly paperKey: string,readonly deviceName: string},
    outParam: void,
  },
  'keybase.1.login.logout': {
    inParam: {readonly force: boolean,readonly keepSecrets: boolean},
    outParam: void,
  },
  'keybase.1.login.paperKey': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.login.paperKeySubmit': {
    inParam: {readonly paperPhrase: string},
    outParam: void,
  },
  'keybase.1.login.recoverPassphrase': {
    inParam: {readonly username: string},
    outParam: void,
  },
  'keybase.1.loginUi.chooseDeviceToRecoverWith': {
    inParam: {readonly devices?: ReadonlyArray<Device> | null},
    outParam: DeviceID,
  },
  'keybase.1.loginUi.displayPaperKeyPhrase': {
    inParam: {readonly phrase: string},
    outParam: void,
  },
  'keybase.1.loginUi.displayPrimaryPaperKey': {
    inParam: {readonly phrase: string},
    outParam: void,
  },
  'keybase.1.loginUi.displayResetProgress': {
    inParam: {readonly text: string,readonly endTime: Time,readonly needVerify: boolean},
    outParam: void,
  },
  'keybase.1.loginUi.explainDeviceRecovery': {
    inParam: {readonly kind: DeviceType,readonly name: string},
    outParam: void,
  },
  'keybase.1.loginUi.getEmailOrUsername': {
    inParam: undefined,
    outParam: string,
  },
  'keybase.1.loginUi.promptPassphraseRecovery': {
    inParam: {readonly kind: PassphraseRecoveryPromptType},
    outParam: boolean,
  },
  'keybase.1.loginUi.promptResetAccount': {
    inParam: {readonly prompt: ResetPrompt},
    outParam: ResetPromptResponse,
  },
  'keybase.1.loginUi.promptRevokePaperKeys': {
    inParam: {readonly device: Device,readonly index: number},
    outParam: boolean,
  },
  'keybase.1.logsend.prepareLogsend': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.notifyCtl.setNotifications': {
    inParam: {readonly channels: NotificationChannels},
    outParam: void,
  },
  'keybase.1.pgp.pgpKeyGenDefault': {
    inParam: {readonly createUids: PGPCreateUids},
    outParam: void,
  },
  'keybase.1.pgp.pgpStorageDismiss': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.pgpUi.finished': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.pgpUi.keyGenerated': {
    inParam: {readonly kid: KID,readonly key: KeyInfo},
    outParam: void,
  },
  'keybase.1.pgpUi.shouldPushPrivate': {
    inParam: {readonly prompt: boolean},
    outParam: boolean,
  },
  'keybase.1.phoneNumbers.addPhoneNumber': {
    inParam: {readonly phoneNumber: PhoneNumber,readonly visibility: IdentityVisibility},
    outParam: void,
  },
  'keybase.1.phoneNumbers.deletePhoneNumber': {
    inParam: {readonly phoneNumber: PhoneNumber},
    outParam: void,
  },
  'keybase.1.phoneNumbers.resendVerificationForPhoneNumber': {
    inParam: {readonly phoneNumber: PhoneNumber},
    outParam: void,
  },
  'keybase.1.phoneNumbers.setVisibilityPhoneNumber': {
    inParam: {readonly phoneNumber: PhoneNumber,readonly visibility: IdentityVisibility},
    outParam: void,
  },
  'keybase.1.phoneNumbers.verifyPhoneNumber': {
    inParam: {readonly phoneNumber: PhoneNumber,readonly code: string},
    outParam: void,
  },
  'keybase.1.pprof.logProcessorProfile': {
    inParam: {readonly logDirForMobile: string,readonly profileDurationSeconds: DurationSec},
    outParam: void,
  },
  'keybase.1.pprof.logTrace': {
    inParam: {readonly logDirForMobile: string,readonly traceDurationSeconds: DurationSec},
    outParam: void,
  },
  'keybase.1.prove.checkProof': {
    inParam: {readonly sigID: SigID},
    outParam: CheckProofStatus,
  },
  'keybase.1.prove.startProof': {
    inParam: {readonly service: string,readonly username: string,readonly force: boolean,readonly promptPosted: boolean,readonly auto: boolean,readonly sigVersion?: SigVersion | null},
    outParam: StartProofResult,
  },
  'keybase.1.proveUi.checking': {
    inParam: {readonly name: string},
    outParam: void,
  },
  'keybase.1.proveUi.continueChecking': {
    inParam: undefined,
    outParam: boolean,
  },
  'keybase.1.proveUi.displayRecheckWarning': {
    inParam: {readonly text: Text},
    outParam: void,
  },
  'keybase.1.proveUi.okToCheck': {
    inParam: {readonly name: string,readonly attempt: number},
    outParam: boolean,
  },
  'keybase.1.proveUi.outputInstructions': {
    inParam: {readonly instructions: Text,readonly proof: string,readonly parameters?: ProveParameters | null},
    outParam: void,
  },
  'keybase.1.proveUi.outputPrechecks': {
    inParam: {readonly text: Text},
    outParam: void,
  },
  'keybase.1.proveUi.preProofWarning': {
    inParam: {readonly text: Text},
    outParam: boolean,
  },
  'keybase.1.proveUi.promptOverwrite': {
    inParam: {readonly account: string,readonly typ: PromptOverwriteType},
    outParam: boolean,
  },
  'keybase.1.proveUi.promptUsername': {
    inParam: {readonly prompt: string,readonly prevError?: Status | null,readonly parameters?: ProveParameters | null},
    outParam: string,
  },
  'keybase.1.provisionUi.DisplayAndPromptSecret': {
    inParam: {readonly secret: Uint8Array,readonly phrase: string,readonly otherDeviceType: DeviceType,readonly previousErr: string},
    outParam: SecretResponse,
  },
  'keybase.1.provisionUi.DisplaySecretExchanged': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.provisionUi.PromptNewDeviceName': {
    inParam: {readonly existingDevices?: ReadonlyArray<string> | null,readonly errorMessage: string},
    outParam: string,
  },
  'keybase.1.provisionUi.ProvisioneeSuccess': {
    inParam: {readonly username: string,readonly deviceName: string},
    outParam: void,
  },
  'keybase.1.provisionUi.ProvisionerSuccess': {
    inParam: {readonly deviceName: string,readonly deviceType: DeviceTypeV2},
    outParam: void,
  },
  'keybase.1.provisionUi.chooseDevice': {
    inParam: {readonly devices?: ReadonlyArray<Device> | null,readonly canSelectNoDevice: boolean},
    outParam: DeviceID,
  },
  'keybase.1.provisionUi.chooseDeviceType': {
    inParam: {readonly kind: ChooseType},
    outParam: DeviceType,
  },
  'keybase.1.provisionUi.chooseGPGMethod': {
    inParam: {readonly keys?: ReadonlyArray<GPGKey> | null},
    outParam: GPGMethod,
  },
  'keybase.1.provisionUi.switchToGPGSignOK': {
    inParam: {readonly key: GPGKey,readonly importError: string},
    outParam: boolean,
  },
  'keybase.1.reachability.checkReachability': {
    inParam: undefined,
    outParam: Reachability,
  },
  'keybase.1.reachability.reachabilityChanged': {
    inParam: {readonly reachability: Reachability},
    outParam: void,
  },
  'keybase.1.reachability.startReachability': {
    inParam: undefined,
    outParam: Reachability,
  },
  'keybase.1.rekey.getRevokeWarning': {
    inParam: {readonly actingDevice: DeviceID,readonly targetDevice: DeviceID},
    outParam: RevokeWarning,
  },
  'keybase.1.rekey.rekeyStatusFinish': {
    inParam: undefined,
    outParam: Outcome,
  },
  'keybase.1.rekey.showPendingRekeyStatus': {
    inParam: undefined,
    outParam: void,
  },
  'keybase.1.rekeyUI.delegateRekeyUI': {
    inParam: undefined,
    outParam: number,
  },
  'keybase.1.rekeyUI.refresh': {
    inParam: {readonly problemSetDevices: ProblemSetDevices},
    outParam: void,
  },
  'keybase.1.rekeyUI.rekeySendEvent': {
    inParam: {readonly event: RekeyEvent},
    outParam: void,
  },
  'keybase.1.revoke.revokeDevice': {
    inParam: {readonly deviceID: DeviceID,readonly forceSelf: boolean,readonly forceLast: boolean},
    outParam: void,
  },
  'keybase.1.revoke.revokeKey': {
    inParam: {readonly keyID: KID},
    outParam: void,
  },
  'keybase.1.revoke.revokeSigs': {
    inParam: {readonly sigIDQueries?: ReadonlyArray<string> | null},
    outParam: void,
  },
  'keybase.1.saltpack.saltpackDecryptFile': {
    inParam: {readonly encryptedFilename: string,readonly destinationDir: string},
    outParam: SaltpackFileResult,
  },
  'keybase.1.saltpack.saltpackDecryptString': {
    inParam: {readonly ciphertext: string},
    outParam: SaltpackPlaintextResult,
  },
  'keybase.1.saltpack.saltpackEncryptFile': {
    inParam: {readonly filename: string,readonly destinationDir: string,readonly opts: SaltpackFrontendEncryptOptions},
    outParam: SaltpackEncryptFileResult,
  },
  'keybase.1.saltpack.saltpackEncryptString': {
    inParam: {readonly plaintext: string,readonly opts: SaltpackFrontendEncryptOptions},
    outParam: SaltpackEncryptStringResult,
  },
  'keybase.1.saltpack.saltpackSaveCiphertextToFile': {
    inParam: {readonly ciphertext: string},
    outParam: string,
  },
  'keybase.1.saltpack.saltpackSaveSignedMsgToFile': {
    inParam: {readonly signedMsg: string},
    outParam: string,
  },
  'keybase.1.saltpack.saltpackSignFile': {
    inParam: {readonly filename: string,readonly destinationDir: string},
    outParam: string,
  },
  'keybase.1.saltpack.saltpackSignString': {
    inParam: {readonly plaintext: string},
    outParam: string,
  },
  'keybase.1.saltpack.saltpackVerifyFile': {
    inParam: {readonly signedFilename: string,readonly destinationDir: string},
    outParam: SaltpackVerifyFileResult,
  },
  'keybase.1.saltpack.saltpackVerifyString': {
    inParam: {readonly signedMsg: string},
    outParam: SaltpackVerifyResult,
  },
  'keybase.1.secretUi.getPassphrase': {
    inParam: {readonly pinentry: GUIEntryArg,readonly terminal?: SecretEntryArg | null},
    outParam: GetPassphraseRes,
  },
  'keybase.1.signup.checkUsernameAvailable': {
    inParam: {readonly username: string},
    outParam: void,
  },
  'keybase.1.signup.getInvitationCode': {
    inParam: undefined,
    outParam: string,
  },
  'keybase.1.signup.signup': {
    inParam: {readonly email: string,readonly inviteCode: string,readonly passphrase: string,readonly username: string,readonly deviceName: string,readonly deviceType: DeviceType,readonly storeSecret: boolean,readonly skipMail: boolean,readonly genPGPBatch: boolean,readonly genPaper: boolean,readonly randomPw: boolean,readonly verifyEmail: boolean,readonly botToken: BotToken,readonly skipGPG: boolean},
    outParam: SignupRes,
  },
  'keybase.1.teams.findAssertionsInTeamNoResolve': {
    inParam: {readonly teamID: TeamID,readonly assertions?: ReadonlyArray<string> | null},
    outParam: ReadonlyArray<string> | null,
  },
  'keybase.1.teams.getAnnotatedTeam': {
    inParam: {readonly teamID: TeamID},
    outParam: AnnotatedTeam,
  },
  'keybase.1.teams.getInviteLinkDetails': {
    inParam: {readonly inviteID: TeamInviteID},
    outParam: InviteLinkDetails,
  },
  'keybase.1.teams.getTeamID': {
    inParam: {readonly teamName: string},
    outParam: TeamID,
  },
  'keybase.1.teams.getTeamRoleMap': {
    inParam: undefined,
    outParam: TeamRoleMapAndVersion,
  },
  'keybase.1.teams.getUntrustedTeamInfo': {
    inParam: {readonly teamName: TeamName},
    outParam: UntrustedTeamInfo,
  },
  'keybase.1.teams.loadTeamTreeMembershipsAsync': {
    inParam: {readonly teamID: TeamID,readonly username: string},
    outParam: TeamTreeInitial,
  },
  'keybase.1.teams.setTarsDisabled': {
    inParam: {readonly teamID: TeamID,readonly disabled: boolean},
    outParam: void,
  },
  'keybase.1.teams.setTeamMemberShowcase': {
    inParam: {readonly teamID: TeamID,readonly isShowcased: boolean},
    outParam: void,
  },
  'keybase.1.teams.setTeamShowcase': {
    inParam: {readonly teamID: TeamID,readonly isShowcased?: boolean | null,readonly description?: string | null,readonly anyMemberShowcase?: boolean | null},
    outParam: void,
  },
  'keybase.1.teams.teamAcceptInviteOrRequestAccess': {
    inParam: {readonly tokenOrName: string},
    outParam: TeamAcceptOrRequestResult,
  },
  'keybase.1.teams.teamAddEmailsBulk': {
    inParam: {readonly name: string,readonly emails: string,readonly role: TeamRole},
    outParam: BulkRes,
  },
  'keybase.1.teams.teamAddMember': {
    inParam: {readonly teamID: TeamID,readonly email: string,readonly phone: string,readonly username: string,readonly role: TeamRole,readonly botSettings?: TeamBotSettings | null,readonly sendChatNotification: boolean,readonly emailInviteMessage?: string | null},
    outParam: TeamAddMemberResult,
  },
  'keybase.1.teams.teamAddMembersMultiRole': {
    inParam: {readonly teamID: TeamID,readonly users?: ReadonlyArray<UserRolePair> | null,readonly sendChatNotification: boolean,readonly emailInviteMessage?: string | null,readonly addToChannels?: ReadonlyArray<string> | null},
    outParam: TeamAddMembersResult,
  },
  'keybase.1.teams.teamCreate': {
    inParam: {readonly name: string,readonly joinSubteam: boolean},
    outParam: TeamCreateResult,
  },
  'keybase.1.teams.teamCreateFancy': {
    inParam: {readonly teamInfo: TeamCreateFancyInfo},
    outParam: TeamID,
  },
  'keybase.1.teams.teamCreateSeitanTokenV2': {
    inParam: {readonly teamname: string,readonly role: TeamRole,readonly label: SeitanKeyLabel},
    outParam: SeitanIKeyV2,
  },
  'keybase.1.teams.teamDelete': {
    inParam: {readonly teamID: TeamID},
    outParam: void,
  },
  'keybase.1.teams.teamEditMembers': {
    inParam: {readonly teamID: TeamID,readonly users?: ReadonlyArray<UserRolePair> | null},
    outParam: TeamEditMembersResult,
  },
  'keybase.1.teams.teamGetMembersByID': {
    inParam: {readonly id: TeamID},
    outParam: ReadonlyArray<TeamMemberDetails> | null,
  },
  'keybase.1.teams.teamIgnoreRequest': {
    inParam: {readonly name: string,readonly username: string},
    outParam: void,
  },
  'keybase.1.teams.teamLeave': {
    inParam: {readonly name: string,readonly permanent: boolean},
    outParam: void,
  },
  'keybase.1.teams.teamListMyAccessRequests': {
    inParam: {readonly teamName?: string | null},
    outParam: ReadonlyArray<TeamName> | null,
  },
  'keybase.1.teams.teamListUnverified': {
    inParam: {readonly userAssertion: string,readonly includeImplicitTeams: boolean},
    outParam: AnnotatedTeamList,
  },
  'keybase.1.teams.teamProfileAddList': {
    inParam: {readonly username: string},
    outParam: ReadonlyArray<TeamProfileAddEntry> | null,
  },
  'keybase.1.teams.teamReAddMemberAfterReset': {
    inParam: {readonly id: TeamID,readonly username: string},
    outParam: void,
  },
  'keybase.1.teams.teamRemoveMember': {
    inParam: {readonly teamID: TeamID,readonly member: TeamMemberToRemove},
    outParam: void,
  },
  'keybase.1.teams.teamRename': {
    inParam: {readonly prevName: TeamName,readonly newName: TeamName},
    outParam: void,
  },
  'keybase.1.teams.teamSetSettings': {
    inParam: {readonly teamID: TeamID,readonly settings: TeamSettings},
    outParam: void,
  },
  'keybase.1.teams.untrustedTeamExists': {
    inParam: {readonly teamName: TeamName},
    outParam: UntrustedTeamExistsResult,
  },
  'keybase.1.teams.uploadTeamAvatar': {
    inParam: {readonly teamname: string,readonly filename: string,readonly crop?: ImageCropRect | null,readonly sendChatNotification: boolean},
    outParam: void,
  },
  'keybase.1.teamsUi.confirmInviteLinkAccept': {
    inParam: {readonly details: InviteLinkDetails},
    outParam: boolean,
  },
  'keybase.1.teamsUi.confirmRootTeamDelete': {
    inParam: {readonly teamName: string},
    outParam: boolean,
  },
  'keybase.1.teamsUi.confirmSubteamDelete': {
    inParam: {readonly teamName: string},
    outParam: boolean,
  },
  'keybase.1.user.blockUser': {
    inParam: {readonly username: string},
    outParam: void,
  },
  'keybase.1.user.canLogout': {
    inParam: undefined,
    outParam: CanLogoutRes,
  },
  'keybase.1.user.dismissBlockButtons': {
    inParam: {readonly tlfID: TLFID},
    outParam: void,
  },
  'keybase.1.user.getUserBlocks': {
    inParam: {readonly usernames?: ReadonlyArray<string> | null},
    outParam: ReadonlyArray<UserBlock> | null,
  },
  'keybase.1.user.interestingPeople': {
    inParam: {readonly maxUsers: number,readonly namespace: string},
    outParam: ReadonlyArray<InterestingPerson> | null,
  },
  'keybase.1.user.listTrackersUnverified': {
    inParam: {readonly assertion: string},
    outParam: UserSummarySet,
  },
  'keybase.1.user.listTracking': {
    inParam: {readonly filter: string,readonly assertion: string},
    outParam: UserSummarySet,
  },
  'keybase.1.user.loadMySettings': {
    inParam: undefined,
    outParam: UserSettings,
  },
  'keybase.1.user.loadPassphraseState': {
    inParam: undefined,
    outParam: PassphraseState,
  },
  'keybase.1.user.profileEdit': {
    inParam: {readonly fullName: string,readonly location: string,readonly bio: string},
    outParam: void,
  },
  'keybase.1.user.proofSuggestions': {
    inParam: undefined,
    outParam: ProofSuggestionsRes,
  },
  'keybase.1.user.reportUser': {
    inParam: {readonly username: string,readonly reason: string,readonly comment: string,readonly includeTranscript: boolean,readonly convID?: string | null},
    outParam: void,
  },
  'keybase.1.user.setUserBlocks': {
    inParam: {readonly blocks?: ReadonlyArray<UserBlockArg> | null},
    outParam: void,
  },
  'keybase.1.user.unblockUser': {
    inParam: {readonly username: string},
    outParam: void,
  },
  'keybase.1.user.uploadUserAvatar': {
    inParam: {readonly filename: string,readonly crop?: ImageCropRect | null},
    outParam: void,
  },
  'keybase.1.user.userCard': {
    inParam: {readonly username: string,readonly useSession: boolean},
    outParam: UserCard | null,
  },
  'keybase.1.userSearch.bulkEmailOrPhoneSearch': {
    inParam: {readonly emails: string,readonly phoneNumbers?: ReadonlyArray<PhoneNumber> | null},
    outParam: ReadonlyArray<EmailOrPhoneNumberSearchResult> | null,
  },
  'keybase.1.userSearch.getNonUserDetails': {
    inParam: {readonly assertion: string},
    outParam: NonUserDetails,
  },
  'keybase.1.userSearch.userSearch': {
    inParam: {readonly query: string,readonly service: string,readonly maxResults: number,readonly includeServicesSummary: boolean,readonly includeContacts: boolean},
    outParam: ReadonlyArray<APIUserSearchResult> | null,
  },
}
export type MessageKey = keyof MessageTypes
export type RpcIn<M extends MessageKey> = MessageTypes[M]['inParam']
export type RpcOut<M extends MessageKey> = MessageTypes[M]['outParam']
export type RpcResponse<M extends MessageKey> = {error: IncomingErrorCallback, result: (res: RpcOut<M>) => void}
type PromiseMethod = 'keybase.1.account.cancelReset' | 'keybase.1.account.getLockdownMode' | 'keybase.1.account.guessCurrentLocation' | 'keybase.1.account.hasServerKeys' | 'keybase.1.account.passphraseChange' | 'keybase.1.account.passphraseCheck' | 'keybase.1.account.recoverUsernameWithEmail' | 'keybase.1.account.recoverUsernameWithPhone' | 'keybase.1.account.setLockdownMode' | 'keybase.1.account.userGetContactSettings' | 'keybase.1.account.userSetContactSettings' | 'keybase.1.apiserver.Delete' | 'keybase.1.apiserver.GetWithSession' | 'keybase.1.apiserver.Post' | 'keybase.1.apiserver.PostJSON' | 'keybase.1.appState.powerMonitorEvent' | 'keybase.1.appState.updateMobileNetState' | 'keybase.1.config.appendGUILogs' | 'keybase.1.config.generateWebAuthToken' | 'keybase.1.config.getBootstrapStatus' | 'keybase.1.config.getProxyData' | 'keybase.1.config.getRememberPassphrase' | 'keybase.1.config.getUpdateInfo' | 'keybase.1.config.getUpdateInfo2' | 'keybase.1.config.guiGetValue' | 'keybase.1.config.guiSetValue' | 'keybase.1.config.helloIAm' | 'keybase.1.config.logSend' | 'keybase.1.config.requestFollowingAndUnverifiedFollowers' | 'keybase.1.config.setProxyData' | 'keybase.1.config.setRememberPassphrase' | 'keybase.1.config.startUpdateIfNeeded' | 'keybase.1.config.toggleRuntimeStats' | 'keybase.1.config.updateLastLoggedInAndServerConfig' | 'keybase.1.config.waitForClient' | 'keybase.1.contacts.getContactsForUserRecommendations' | 'keybase.1.contacts.saveContactList' | 'keybase.1.cryptocurrency.registerAddress' | 'keybase.1.ctl.dbNuke' | 'keybase.1.ctl.getOnLoginStartup' | 'keybase.1.ctl.setOnLoginStartup' | 'keybase.1.ctl.stop' | 'keybase.1.delegateUiCtl.registerChatUI' | 'keybase.1.delegateUiCtl.registerGregorFirehoseFiltered' | 'keybase.1.delegateUiCtl.registerHomeUI' | 'keybase.1.delegateUiCtl.registerIdentify3UI' | 'keybase.1.delegateUiCtl.registerLogUI' | 'keybase.1.delegateUiCtl.registerRekeyUI' | 'keybase.1.delegateUiCtl.registerSecretUI' | 'keybase.1.device.checkDeviceNameFormat' | 'keybase.1.device.deviceHistoryList' | 'keybase.1.device.dismissDeviceChangeNotifications' | 'keybase.1.emails.addEmail' | 'keybase.1.emails.deleteEmail' | 'keybase.1.emails.sendVerificationEmail' | 'keybase.1.emails.setPrimaryEmail' | 'keybase.1.emails.setVisibilityEmail' | 'keybase.1.favorite.favoriteIgnore' | 'keybase.1.featuredBot.featuredBots' | 'keybase.1.featuredBot.search' | 'keybase.1.git.createPersonalRepo' | 'keybase.1.git.createTeamRepo' | 'keybase.1.git.deletePersonalRepo' | 'keybase.1.git.deleteTeamRepo' | 'keybase.1.git.getAllGitMetadata' | 'keybase.1.git.setTeamRepoSettings' | 'keybase.1.gregor.dismissCategory' | 'keybase.1.gregor.getState' | 'keybase.1.gregor.updateCategory' | 'keybase.1.home.homeDismissAnnouncement' | 'keybase.1.home.homeGetScreen' | 'keybase.1.home.homeMarkViewed' | 'keybase.1.home.homeSkipTodoType' | 'keybase.1.identify3.identify3FollowUser' | 'keybase.1.identify3.identify3IgnoreUser' | 'keybase.1.incomingShare.getIncomingShareItems' | 'keybase.1.incomingShare.getPreference' | 'keybase.1.incomingShare.setPreference' | 'keybase.1.install.fuseStatus' | 'keybase.1.install.installFuse' | 'keybase.1.install.installKBFS' | 'keybase.1.install.uninstallKBFS' | 'keybase.1.kbfsMount.GetCurrentMountDir' | 'keybase.1.kbfsMount.GetKBFSPathInfo' | 'keybase.1.kbfsMount.GetPreferredMountDirs' | 'keybase.1.kbfsMount.WaitForMounts' | 'keybase.1.log.perfLogPoint' | 'keybase.1.login.accountDelete' | 'keybase.1.login.deprovision' | 'keybase.1.login.getConfiguredAccounts' | 'keybase.1.login.isOnline' | 'keybase.1.login.logout' | 'keybase.1.login.paperKeySubmit' | 'keybase.1.notifyCtl.setNotifications' | 'keybase.1.pgp.pgpStorageDismiss' | 'keybase.1.phoneNumbers.addPhoneNumber' | 'keybase.1.phoneNumbers.deletePhoneNumber' | 'keybase.1.phoneNumbers.resendVerificationForPhoneNumber' | 'keybase.1.phoneNumbers.setVisibilityPhoneNumber' | 'keybase.1.phoneNumbers.verifyPhoneNumber' | 'keybase.1.pprof.logProcessorProfile' | 'keybase.1.pprof.logTrace' | 'keybase.1.prove.checkProof' | 'keybase.1.reachability.checkReachability' | 'keybase.1.reachability.startReachability' | 'keybase.1.rekey.getRevokeWarning' | 'keybase.1.rekey.rekeyStatusFinish' | 'keybase.1.rekey.showPendingRekeyStatus' | 'keybase.1.revoke.revokeDevice' | 'keybase.1.revoke.revokeKey' | 'keybase.1.revoke.revokeSigs' | 'keybase.1.saltpack.saltpackDecryptFile' | 'keybase.1.saltpack.saltpackDecryptString' | 'keybase.1.saltpack.saltpackEncryptFile' | 'keybase.1.saltpack.saltpackEncryptString' | 'keybase.1.saltpack.saltpackSaveCiphertextToFile' | 'keybase.1.saltpack.saltpackSaveSignedMsgToFile' | 'keybase.1.saltpack.saltpackSignFile' | 'keybase.1.saltpack.saltpackSignString' | 'keybase.1.saltpack.saltpackVerifyFile' | 'keybase.1.saltpack.saltpackVerifyString' | 'keybase.1.signup.checkUsernameAvailable' | 'keybase.1.signup.getInvitationCode' | 'keybase.1.SimpleFS.simpleFSArchiveAllFiles' | 'keybase.1.SimpleFS.simpleFSArchiveAllGitRepos' | 'keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob' | 'keybase.1.SimpleFS.simpleFSArchiveStart' | 'keybase.1.SimpleFS.simpleFSCancelDownload' | 'keybase.1.SimpleFS.simpleFSCheckReachability' | 'keybase.1.SimpleFS.simpleFSClearConflictState' | 'keybase.1.SimpleFS.simpleFSConfigureDownload' | 'keybase.1.SimpleFS.simpleFSCopyRecursive' | 'keybase.1.SimpleFS.simpleFSDismissDownload' | 'keybase.1.SimpleFS.simpleFSDismissUpload' | 'keybase.1.SimpleFS.simpleFSFinishResolvingConflict' | 'keybase.1.SimpleFS.simpleFSFolderSyncConfigAndStatus' | 'keybase.1.SimpleFS.simpleFSGetArchiveJobFreshness' | 'keybase.1.SimpleFS.simpleFSGetArchiveStatus' | 'keybase.1.SimpleFS.simpleFSGetDownloadInfo' | 'keybase.1.SimpleFS.simpleFSGetDownloadStatus' | 'keybase.1.SimpleFS.simpleFSGetFilesTabBadge' | 'keybase.1.SimpleFS.simpleFSGetFolder' | 'keybase.1.SimpleFS.simpleFSGetGUIFileContext' | 'keybase.1.SimpleFS.simpleFSGetOnlineStatus' | 'keybase.1.SimpleFS.simpleFSGetUploadStatus' | 'keybase.1.SimpleFS.simpleFSList' | 'keybase.1.SimpleFS.simpleFSListFavorites' | 'keybase.1.SimpleFS.simpleFSListRecursiveToDepth' | 'keybase.1.SimpleFS.simpleFSMakeTempDirForUpload' | 'keybase.1.SimpleFS.simpleFSMove' | 'keybase.1.SimpleFS.simpleFSOpen' | 'keybase.1.SimpleFS.simpleFSReadList' | 'keybase.1.SimpleFS.simpleFSRemove' | 'keybase.1.SimpleFS.simpleFSSetDebugLevel' | 'keybase.1.SimpleFS.simpleFSSetFolderSyncConfig' | 'keybase.1.SimpleFS.simpleFSSetNotificationThreshold' | 'keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed' | 'keybase.1.SimpleFS.simpleFSSetSyncOnCellular' | 'keybase.1.SimpleFS.simpleFSSettings' | 'keybase.1.SimpleFS.simpleFSStartDownload' | 'keybase.1.SimpleFS.simpleFSStartUpload' | 'keybase.1.SimpleFS.simpleFSStat' | 'keybase.1.SimpleFS.simpleFSSubscribeNonPath' | 'keybase.1.SimpleFS.simpleFSSubscribePath' | 'keybase.1.SimpleFS.simpleFSSyncStatus' | 'keybase.1.SimpleFS.simpleFSUnsubscribe' | 'keybase.1.SimpleFS.simpleFSUserEditHistory' | 'keybase.1.SimpleFS.simpleFSUserIn' | 'keybase.1.SimpleFS.simpleFSUserOut' | 'keybase.1.SimpleFS.simpleFSWait' | 'keybase.1.teams.findAssertionsInTeamNoResolve' | 'keybase.1.teams.getAnnotatedTeam' | 'keybase.1.teams.getInviteLinkDetails' | 'keybase.1.teams.getTeamID' | 'keybase.1.teams.getTeamRoleMap' | 'keybase.1.teams.getUntrustedTeamInfo' | 'keybase.1.teams.loadTeamTreeMembershipsAsync' | 'keybase.1.teams.setTarsDisabled' | 'keybase.1.teams.setTeamMemberShowcase' | 'keybase.1.teams.setTeamShowcase' | 'keybase.1.teams.teamAddEmailsBulk' | 'keybase.1.teams.teamAddMember' | 'keybase.1.teams.teamAddMembersMultiRole' | 'keybase.1.teams.teamCreate' | 'keybase.1.teams.teamCreateFancy' | 'keybase.1.teams.teamCreateSeitanTokenV2' | 'keybase.1.teams.teamEditMembers' | 'keybase.1.teams.teamGetMembersByID' | 'keybase.1.teams.teamIgnoreRequest' | 'keybase.1.teams.teamLeave' | 'keybase.1.teams.teamListMyAccessRequests' | 'keybase.1.teams.teamListUnverified' | 'keybase.1.teams.teamProfileAddList' | 'keybase.1.teams.teamReAddMemberAfterReset' | 'keybase.1.teams.teamRemoveMember' | 'keybase.1.teams.teamRename' | 'keybase.1.teams.teamSetSettings' | 'keybase.1.teams.untrustedTeamExists' | 'keybase.1.teams.uploadTeamAvatar' | 'keybase.1.user.blockUser' | 'keybase.1.user.canLogout' | 'keybase.1.user.dismissBlockButtons' | 'keybase.1.user.getUserBlocks' | 'keybase.1.user.interestingPeople' | 'keybase.1.user.listTrackersUnverified' | 'keybase.1.user.listTracking' | 'keybase.1.user.loadMySettings' | 'keybase.1.user.loadPassphraseState' | 'keybase.1.user.profileEdit' | 'keybase.1.user.proofSuggestions' | 'keybase.1.user.reportUser' | 'keybase.1.user.setUserBlocks' | 'keybase.1.user.unblockUser' | 'keybase.1.user.uploadUserAvatar' | 'keybase.1.user.userCard' | 'keybase.1.userSearch.bulkEmailOrPhoneSearch' | 'keybase.1.userSearch.getNonUserDetails' | 'keybase.1.userSearch.userSearch'
export type RpcFn<M extends PromiseMethod> = [RpcIn<M>] extends [undefined]
  ? (params?: undefined, waitingKey?: WaitingKey) => Promise<RpcOut<M>>
  : (params: RpcIn<M>, waitingKey?: WaitingKey) => Promise<RpcOut<M>>
const createRpc = <M extends PromiseMethod>(method: M): RpcFn<M> =>
  ((params?: RpcIn<M>, waitingKey?: WaitingKey) =>
    new Promise<RpcOut<M>>((resolve, reject) =>
      engine()._rpcOutgoing({
        method,
        callback: (error: SimpleError, result: RpcOut<M>) => error ? reject(error) : resolve(result),
        ...(params === undefined ? {} : {params}),
        ...(waitingKey === undefined ? {} : {waitingKey}),
      }))) as RpcFn<M>
type ListenerMethod = 'keybase.1.account.enterResetPipeline' | 'keybase.1.device.deviceAdd' | 'keybase.1.identify3.identify3' | 'keybase.1.login.login' | 'keybase.1.login.paperKey' | 'keybase.1.login.recoverPassphrase' | 'keybase.1.pgp.pgpKeyGenDefault' | 'keybase.1.prove.startProof' | 'keybase.1.signup.signup' | 'keybase.1.teams.teamAcceptInviteOrRequestAccess' | 'keybase.1.teams.teamDelete'
type ListenerArgs<M extends ListenerMethod> = {
  params: RpcIn<M>,
  incomingCallMap: IncomingCallMapType,
  customResponseIncomingCallMap?: CustomResponseIncomingCallMap,
  waitingKey?: WaitingKey,
}
export type ListenerFn<M extends ListenerMethod> = (p: ListenerArgs<M>) => Promise<RpcOut<M>>
const createListener = <M extends ListenerMethod>(method: M): ListenerFn<M> =>
  ((p: ListenerArgs<M>) =>
    getEngineListener<ListenerArgs<M>, Promise<RpcOut<M>>>()({
      method,
      params: p.params,
      incomingCallMap: p.incomingCallMap,
      ...(p.customResponseIncomingCallMap === undefined
        ? {}
        : {customResponseIncomingCallMap: p.customResponseIncomingCallMap}),
      ...(p.waitingKey === undefined ? {} : {waitingKey: p.waitingKey}),
    })) as ListenerFn<M>

export enum AppLinkType {
  none = 0,
  people = 1,
  chat = 2,
  files = 3,
  wallet = 4,
  git = 5,
  devices = 6,
  settings = 7,
  teams = 8,
}

export enum ArchiveJobStartPathType {
  kbfs = 0,
  git = 1,
}

export enum AsyncOps {
  list = 0,
  listRecursive = 1,
  read = 2,
  write = 3,
  copy = 4,
  move = 5,
  remove = 6,
  listRecursiveToDepth = 7,
  getRevisions = 8,
}

export enum AuditMode {
  standard = 0,
  justCreated = 1,
  skip = 2,
  standardNoHidden = 3,
}

export enum AuditVersion {
  v0 = 0,
  v1 = 1,
  v2 = 2,
  v3 = 3,
  v4 = 4,
}

export enum AuthenticityType {
  signed = 0,
  repudiable = 1,
  anonymous = 2,
}

export enum AvatarUpdateType {
  none = 0,
  user = 1,
  team = 2,
}

export enum BlockStatus {
  unknown = 0,
  live = 1,
  archived = 2,
}

export enum BlockType {
  data = 0,
  md = 1,
  git = 2,
}

export enum BoxAuditAttemptResult {
  failureRetryable = 0,
  failureMaliciousServer = 1,
  okVerified = 2,
  okNotAttemptedRole = 3,
  okNotAttemptedOpenteam = 4,
  okNotAttemptedSubteam = 5,
}

export enum CheckResultFreshness {
  fresh = 0,
  aged = 1,
  rancid = 2,
}

export enum ChooseType {
  existingDevice = 0,
  newDevice = 1,
}

export enum ClientType {
  none = 0,
  cli = 1,
  guiMain = 2,
  kbfs = 3,
  guiHelper = 4,
}

export enum ConflictStateType {
  normalview = 1,
  manualresolvinglocalview = 2,
}

export enum DbType {
  main = 0,
  chat = 1,
  fsBlockCache = 2,
  fsBlockCacheMeta = 3,
  fsSyncBlockCache = 4,
  fsSyncBlockCacheMeta = 5,
}

export enum DeviceType {
  desktop = 0,
  mobile = 1,
}

export enum DirentType {
  file = 0,
  dir = 1,
  sym = 2,
  exec = 3,
}

export enum DismissReasonType {
  none = 0,
  handledElsewhere = 1,
}

export enum ExitCode {
  ok = 0,
  notok = 2,
  restart = 4,
}

export enum FSErrorType {
  accessDenied = 0,
  userNotFound = 1,
  revokedDataDetected = 2,
  notLoggedIn = 3,
  timeout = 4,
  rekeyNeeded = 5,
  badFolder = 6,
  notImplemented = 7,
  oldVersion = 8,
  overQuota = 9,
  noSigChain = 10,
  tooManyFolders = 11,
  exdevNotSupported = 12,
  diskLimitReached = 13,
  diskCacheErrorLogSend = 14,
  offlineArchived = 15,
  offlineUnsynced = 16,
}

export enum FSNotificationType {
  encrypting = 0,
  decrypting = 1,
  signing = 2,
  verifying = 3,
  rekeying = 4,
  connection = 5,
  mdReadSuccess = 6,
  fileCreated = 7,
  fileModified = 8,
  fileDeleted = 9,
  fileRenamed = 10,
  initialized = 11,
  syncConfigChanged = 12,
}

export enum FSStatusCode {
  start = 0,
  finish = 1,
  error = 2,
}

export enum FileType {
  unknown = 0,
  directory = 1,
  file = 2,
}

export enum FilesTabBadge {
  none = 0,
  uploadingStuck = 1,
  awaitingUpload = 2,
  uploading = 3,
}

export enum FolderConflictType {
  none = 0,
  inConflict = 1,
  inConflictAndStuck = 2,
  clearedConflict = 3,
}

export enum FolderSyncMode {
  disabled = 0,
  enabled = 1,
  partial = 2,
}

export enum FolderType {
  unknown = 0,
  private = 1,
  public = 2,
  team = 3,
}

export enum ForkType {
  none = 0,
  auto = 1,
  watchdog = 2,
  launchd = 3,
  systemd = 4,
}

export enum FullNamePackageVersion {
  v0 = 0,
  v1 = 1,
  v2 = 2,
}

export enum GPGMethod {
  gpgNone = 0,
  gpgImport = 1,
  gpgSign = 2,
}

export enum GUIViewType {
  default = 0,
  text = 1,
  image = 2,
  audio = 3,
  video = 4,
  pdf = 5,
}

export enum GitLocalMetadataVersion {
  v1 = 1,
}

export enum GitPushType {
  default = 0,
  createrepo = 1,
  renamerepo = 3,
}

export enum GitRepoResultState {
  err = 0,
  ok = 1,
}

export enum HomeScreenItemType {
  todo = 1,
  people = 2,
  announcement = 3,
}

export enum HomeScreenPeopleNotificationType {
  followed = 1,
  followedMulti = 2,
  contact = 3,
  contactMulti = 4,
}

export enum HomeScreenTodoType {
  none = 0,
  bio = 1,
  proof = 2,
  device = 3,
  follow = 4,
  paperkey = 6,
  team = 7,
  folder = 8,
  gitRepo = 9,
  teamShowcase = 10,
  avatarTeam = 12,
  addPhoneNumber = 18,
  verifyAllPhoneNumber = 19,
  verifyAllEmail = 20,
  legacyEmailVisibility = 21,
  addEmail = 22,
  avatarUser = 23,
  chat = 24,
  annoncementPlaceholder = 10000,
}

export enum Identify3ResultType {
  ok = 0,
  broken = 1,
  needsUpgrade = 2,
  canceled = 3,
}

export enum Identify3RowColor {
  blue = 1,
  red = 2,
  black = 3,
  green = 4,
  gray = 5,
  yellow = 6,
  orange = 7,
}

export enum Identify3RowState {
  checking = 1,
  valid = 2,
  error = 3,
  warning = 4,
  revoked = 5,
}

export enum IdentifyReasonType {
  none = 0,
  id = 1,
  track = 2,
  encrypt = 3,
  decrypt = 4,
  verify = 5,
  resource = 6,
  background = 7,
}

export enum IdentityVisibility {
  private = 0,
  public = 1,
}

export enum IncomingShareCompressPreference {
  original = 0,
  compressed = 1,
}

export enum IncomingShareType {
  file = 0,
  text = 1,
  image = 2,
  video = 3,
}

export enum InstallAction {
  unknown = 0,
  none = 1,
  upgrade = 2,
  reinstall = 3,
  install = 4,
}

export enum InstallStatus {
  unknown = 0,
  error = 1,
  notInstalled = 2,
  installed = 4,
}

export enum KBFSArchivedType {
  revision = 0,
  time = 1,
  timeString = 2,
  relTimeString = 3,
}

export enum KbfsOnlineStatus {
  offline = 0,
  trying = 1,
  online = 2,
}

export enum KeyType {
  none = 0,
  nacl = 1,
  pgp = 2,
}

export enum ListFilter {
  noFilter = 0,
  filterAllHidden = 1,
  filterSystemHidden = 2,
}

export enum LogLevel {
  none = 0,
  debug = 1,
  info = 2,
  notice = 3,
  warn = 4,
  error = 5,
  critical = 6,
  fatal = 7,
}

export enum MerkleTreeID {
  master = 0,
  kbfsPublic = 1,
  kbfsPrivate = 2,
  kbfsPrivateteam = 3,
}

export enum MobileAppState {
  foreground = 0,
  background = 1,
  inactive = 2,
  backgroundactive = 3,
}

export enum MobileNetworkState {
  none = 0,
  wifi = 1,
  cellular = 2,
  unknown = 3,
  notavailable = 4,
}

export enum NetworkSource {
  local = 0,
  remote = 1,
}

export enum OfflineAvailability {
  none = 0,
  bestEffort = 1,
}

export enum OnLoginStartupStatus {
  unknown = 0,
  disabled = 1,
  enabled = 2,
}

export enum OpenFlags {
  read = 0,
  replace = 1,
  existing = 2,
  write = 4,
  append = 8,
  directory = 16,
}

export enum Outcome {
  none = 0,
  fixed = 1,
  ignored = 2,
}

export enum PTKType {
  reader = 0,
}

export enum PassphraseRecoveryPromptType {
  encryptedPgpKeys = 0,
}

export enum PassphraseState {
  known = 0,
  random = 1,
}

export enum PassphraseType {
  none = 0,
  paperKey = 1,
  passPhrase = 2,
  verifyPassPhrase = 3,
}

export enum PathSubscriptionTopic {
  children = 0,
  stat = 1,
}

export enum PathType {
  local = 0,
  kbfs = 1,
  kbfsArchived = 2,
}

export enum PerTeamSeedCheckVersion {
  v1 = 1,
}

export enum PerfEventType {
  network = 0,
  teamboxaudit = 1,
  teamaudit = 2,
  userchain = 3,
  teamchain = 4,
  clearconv = 5,
  clearinbox = 6,
  teamtreeload = 7,
}

export enum PrefetchStatus {
  notStarted = 0,
  inProgress = 1,
  complete = 2,
}

export enum ProcessType {
  main = 0,
  kbfs = 1,
}

export enum PromptDefault {
  none = 0,
  yes = 1,
  no = 2,
}

export enum PromptOverwriteType {
  social = 0,
  site = 1,
}

export enum ProofState {
  none = 0,
  ok = 1,
  tempFailure = 2,
  permFailure = 3,
  looking = 4,
  superseded = 5,
  posted = 6,
  revoked = 7,
  deleted = 8,
  unknownType = 9,
  sigHintMissing = 10,
  unchecked = 11,
}

export enum ProofStatus {
  none = 0,
  ok = 1,
  local = 2,
  found = 3,
  baseError = 100,
  hostUnreachable = 101,
  permissionDenied = 103,
  failedParse = 106,
  dnsError = 107,
  authFailed = 108,
  http429 = 129,
  http500 = 150,
  timeout = 160,
  internalError = 170,
  unchecked = 171,
  missingPvl = 172,
  baseHardError = 200,
  notFound = 201,
  contentFailure = 202,
  badUsername = 203,
  badRemoteId = 204,
  textNotFound = 205,
  badArgs = 206,
  contentMissing = 207,
  titleNotFound = 208,
  serviceError = 209,
  torSkipped = 210,
  torIncompatible = 211,
  http300 = 230,
  http400 = 240,
  httpOther = 260,
  emptyJson = 270,
  deleted = 301,
  serviceDead = 302,
  badSignature = 303,
  badApiUrl = 304,
  unknownType = 305,
  noHint = 306,
  badHintText = 307,
  invalidPvl = 308,
}

export enum ProofType {
  none = 0,
  keybase = 1,
  twitter = 2,
  github = 3,
  reddit = 4,
  coinbase = 5,
  hackernews = 6,
  facebook = 8,
  genericSocial = 9,
  genericWebSite = 1000,
  dns = 1001,
  pgp = 1002,
  rooter = 100001,
}

export enum ProvisionMethod {
  device = 0,
  paperKey = 1,
  passphrase = 2,
  gpgImport = 3,
  gpgSign = 4,
}

export enum ProxyType {
  noProxy = 0,
  httpConnect = 1,
  socks = 2,
}

export enum PushReason {
  none = 0,
  reconnected = 1,
  newData = 2,
}

export enum RatchetType {
  main = 0,
  blinded = 1,
  self = 2,
  uncommitted = 3,
}

export enum Reachable {
  unknown = 0,
  yes = 1,
  no = 2,
}

export enum ReacjiSkinTone {
  none = 0,
  skintone1 = 1,
  skintone2 = 2,
  skintone3 = 3,
  skintone4 = 4,
  skintone5 = 5,
}

export enum RekeyEventType {
  none = 0,
  notLoggedIn = 1,
  apiError = 2,
  noProblems = 3,
  loadMeError = 4,
  currentDeviceCanRekey = 5,
  deviceLoadError = 6,
  harass = 7,
  noGregorMessages = 8,
}

export enum ResetMessage {
  enteredVerified = 0,
  enteredPasswordless = 1,
  requestVerified = 2,
  notCompleted = 3,
  canceled = 4,
  completed = 5,
  resetLinkSent = 6,
}

export enum ResetPromptResponse {
  nothing = 0,
  cancelReset = 1,
  confirmReset = 2,
}

export enum ResetPromptType {
  complete = 0,
  enterNoDevices = 1,
  enterForgotPw = 2,
  enterResetPw = 3,
}

export enum ResetType {
  none = 0,
  reset = 1,
  delete = 2,
}

export enum RevisionSpanType {
  default = 0,
  lastFive = 1,
}

export enum RotationType {
  visible = 0,
  hidden = 1,
  clkr = 2,
}

export enum RuntimeGroup {
  unknown = 0,
  linuxlike = 1,
  darwinlike = 2,
  windowslike = 3,
}

export enum SaltpackOperationType {
  encrypt = 0,
  decrypt = 1,
  sign = 2,
  verify = 3,
}

export enum SaltpackSenderType {
  notTracked = 0,
  unknown = 1,
  anonymous = 2,
  trackingBroke = 3,
  trackingOk = 4,
  self = 5,
  revoked = 6,
  expired = 7,
}

export enum SeitanKeyAndLabelVersion {
  v1 = 1,
  v2 = 2,
  invitelink = 3,
}

export enum SeitanKeyLabelType {
  sms = 1,
  generic = 2,
}

export enum SeqType {
  none = 0,
  public = 1,
  private = 2,
  semiprivate = 3,
  userPrivateHidden = 16,
  teamPrivateHidden = 17,
}

export enum SignMode {
  attached = 0,
  detached = 1,
  clear = 2,
}

export enum SimpleFSArchiveJobPhase {
  queued = 0,
  indexing = 1,
  indexed = 2,
  copying = 3,
  copied = 4,
  zipping = 5,
  done = 6,
}

export enum SimpleFSFileArchiveState {
  todo = 0,
  inprogress = 1,
  complete = 2,
  skipped = 3,
}

export enum StatsSeverityLevel {
  normal = 0,
  warning = 1,
  severe = 2,
}

export enum StatusCode {
  scok = 0,
  scinputerror = 100,
  scassertionparseerror = 101,
  scloginrequired = 201,
  scbadsession = 202,
  scbadloginusernotfound = 203,
  scbadloginpassword = 204,
  scnotfound = 205,
  scthrottlecontrol = 210,
  scdeleted = 216,
  scgeneric = 218,
  scalreadyloggedin = 235,
  scexists = 230,
  sccanceled = 237,
  scinputcanceled = 239,
  scbadusername = 243,
  scoffline = 267,
  screloginrequired = 274,
  scresolutionfailed = 275,
  scprofilenotpublic = 276,
  scidentifyfailed = 277,
  sctrackingbroke = 278,
  scwrongcryptoformat = 279,
  scdecryptionerror = 280,
  scinvalidaddress = 281,
  scwrongcryptomsgtype = 282,
  scnosession = 283,
  scaccountreset = 290,
  scidentifiesfailed = 295,
  scnospaceondevice = 297,
  scmerkleclienterror = 299,
  scmerkleupdateroot = 300,
  scbademail = 472,
  scratelimit = 602,
  scbadsignupusernametaken = 701,
  scduplicate = 706,
  scbadinvitationcode = 707,
  scbadsignupusernamereserved = 710,
  scbadsignupteamname = 711,
  scfeatureflag = 712,
  scemailtaken = 713,
  scemailalreadyadded = 714,
  scemaillimitexceeded = 715,
  scemailcannotdeleteprimary = 716,
  scemailunknown = 717,
  scbotsignuptokennotfound = 719,
  scnoupdate = 723,
  scmissingresult = 801,
  sckeynotfound = 901,
  sckeycorrupted = 905,
  sckeyinuse = 907,
  sckeybadgen = 913,
  sckeynosecret = 914,
  sckeybaduids = 915,
  sckeynoactive = 916,
  sckeynosig = 917,
  sckeybadsig = 918,
  sckeybadeldest = 919,
  sckeynoeldest = 920,
  sckeyduplicateupdate = 921,
  scsibkeyalreadyexists = 922,
  scdecryptionkeynotfound = 924,
  scverificationkeynotfound = 925,
  sckeynopgpencryption = 927,
  sckeynonaclencryption = 928,
  sckeysyncedpgpnotfound = 929,
  sckeynomatchinggpg = 930,
  sckeyrevoked = 931,
  scsigcannotverify = 1002,
  scsigwrongkey = 1008,
  scsigoldseqno = 1010,
  scsigcreationdisallowed = 1016,
  scsigmissingratchet = 1021,
  scsigbadtotalorder = 1022,
  scbadtracksession = 1301,
  scdevicebadname = 1404,
  scdevicebadstatus = 1405,
  scdevicenameinuse = 1408,
  scdevicenotfound = 1409,
  scdevicemismatch = 1410,
  scdevicerequired = 1411,
  scdeviceprevprovisioned = 1413,
  scdevicenoprovision = 1414,
  scdeviceprovisionviadevice = 1415,
  screvokecurrentdevice = 1416,
  screvokelastdevice = 1417,
  scdeviceprovisionoffline = 1418,
  screvokelastdevicepgp = 1419,
  scstreamexists = 1501,
  scstreamnotfound = 1502,
  scstreamwrongkind = 1503,
  scstreameof = 1504,
  scstreamunknown = 1505,
  scgenericapierror = 1600,
  scapinetworkerror = 1601,
  sctimeout = 1602,
  sckbfsclienttimeout = 1603,
  scprooferror = 1701,
  scidentificationexpired = 1702,
  scselfnotfound = 1703,
  scbadkexphrase = 1704,
  scnouidelegation = 1705,
  scnoui = 1706,
  scgpgunavailable = 1707,
  scinvalidversionerror = 1800,
  scoldversionerror = 1801,
  scinvalidlocationerror = 1802,
  scservicestatuserror = 1803,
  scinstallerror = 1804,
  scloadkexterror = 1810,
  scloadkextpermerror = 1811,
  scgitinternal = 2300,
  scgitrepoalreadyexists = 2301,
  scgitinvalidreponame = 2302,
  scgitcannotdelete = 2303,
  scgitrepodoesntexist = 2304,
  scloginstatetimeout = 2400,
  scchatinternal = 2500,
  scchatratelimit = 2501,
  scchatconvexists = 2502,
  scchatunknowntlfid = 2503,
  scchatnotinconv = 2504,
  scchatbadmsg = 2505,
  scchatbroadcast = 2506,
  scchatalreadysuperseded = 2507,
  scchatalreadydeleted = 2508,
  scchattlffinalized = 2509,
  scchatcollision = 2510,
  scidentifysummaryerror = 2511,
  scneedselfrekey = 2512,
  scneedotherrekey = 2513,
  scchatmessagecollision = 2514,
  scchatduplicatemessage = 2515,
  scchatclienterror = 2516,
  scchatnotinteam = 2517,
  scchatstalepreviousstate = 2518,
  scchatephemeralretentionpolicyviolatederror = 2519,
  scchatusersalreadyinconversationerror = 2520,
  scchatbadconversationerror = 2521,
  scteambadmembership = 2604,
  scteamselfnotowner = 2607,
  scteamnotfound = 2614,
  scteamexists = 2619,
  scteamreaderror = 2623,
  scteamwritepermdenied = 2625,
  scteambadgeneration = 2634,
  scnoop = 2638,
  scteaminvitebadcancel = 2645,
  scteaminvitebadtoken = 2646,
  scteaminvitecompletionmissing = 2648,
  scteambadnamereserveddb = 2650,
  scteamtarduplicate = 2663,
  scteamtarnotfound = 2664,
  scteammemberexists = 2665,
  scteamnotreleased = 2666,
  scteampermanentlyleft = 2667,
  scteamneedrootid = 2668,
  scteamhaslivechildren = 2669,
  scteamdeleteerror = 2670,
  scteambadrootteam = 2671,
  scteamnameconflictswithuser = 2672,
  scteamdeletenouppointer = 2673,
  scteamneedowner = 2674,
  scteamnoownerallowed = 2675,
  scteamimplicitnononsbs = 2676,
  scteamimplicitbadhash = 2677,
  scteamimplicitbadname = 2678,
  scteamimplicitclash = 2679,
  scteamimplicitduplicate = 2680,
  scteamimplicitbadop = 2681,
  scteamimplicitbadrole = 2682,
  scteamimplicitnotfound = 2683,
  scteambadadminseqnotype = 2684,
  scteamimplicitbadadd = 2685,
  scteamimplicitbadremove = 2686,
  scteaminvitetokenreused = 2696,
  scteamkeymasknotfound = 2697,
  scteambanned = 2702,
  scteaminvalidban = 2703,
  scteamshowcasepermdenied = 2711,
  scteamprovisionalcankey = 2721,
  scteamprovisionalcannotkey = 2722,
  scteamftloutdated = 2736,
  scteamstoragewrongrevision = 2760,
  scteamstoragebadgeneration = 2761,
  scteamstoragenotfound = 2762,
  scteamcontactsettingsblock = 2763,
  scteamseitaninviteneedpuk = 2770,
  scephemeralkeybadgeneration = 2900,
  scephemeralkeyunexpectedbox = 2901,
  scephemeralkeymissingbox = 2902,
  scephemeralkeywrongnumberofkeys = 2903,
  scephemeralkeymismatchedkey = 2904,
  scephemeralpairwisemacsmissinguids = 2905,
  scephemeraldeviceafterek = 2906,
  scephemeralmemberafterek = 2907,
  scephemeraldevicestale = 2908,
  scephemeraluserstale = 2909,
  scstellarerror = 3100,
  scstellarbadinput = 3101,
  scstellarwrongrevision = 3102,
  scstellarmissingbundle = 3103,
  scstellarbadpuk = 3104,
  scstellarmissingaccount = 3105,
  scstellarbadprev = 3106,
  scstellarwrongprimary = 3107,
  scstellarunsupportedcurrency = 3108,
  scstellarneeddisclaimer = 3109,
  scstellardevicenotmobile = 3110,
  scstellarmobileonlypurgatory = 3111,
  scstellarincompatibleversion = 3112,
  scnistwrongsize = 3201,
  scnistbadmode = 3202,
  scnisthashwrongsize = 3203,
  scnistsigwrongsize = 3204,
  scnistsigbadinput = 3205,
  scnistsigbaduid = 3206,
  scnistsigbaddeviceid = 3207,
  scnistsigbadnonce = 3208,
  scnistnosigorhash = 3209,
  scnistexpired = 3210,
  scnistsigrevoked = 3211,
  scnistkeyrevoked = 3212,
  scnistuserdeleted = 3213,
  scnistnodevice = 3214,
  scnistsigcannotVerify = 3215,
  scnistreplay = 3216,
  scnistsigbadlifetime = 3217,
  scnistnotfound = 3218,
  scnistbadclock = 3219,
  scnistsigbadctime = 3220,
  scbadsignupusernamedeleted = 3221,
  scphonenumberunknown = 3400,
  scphonenumberalreadyverified = 3401,
  scphonenumberverificationcodeexpired = 3402,
  scphonenumberwrongverificationcode = 3403,
  scphonenumberlimitexceeded = 3404,
  scnopaperkeys = 3605,
  scteambotkeygenerationexists = 3800,
  scteambotkeyoldboxedgeneration = 3801,
  scteambotkeybadgeneration = 3802,
  scairdropregisterfailedmisc = 4207,
  scsimplefsnameexists = 5101,
  scsimplefsdirnotempty = 5102,
  scsimplefsnotexist = 5103,
  scsimplefsnoaccess = 5104,
}

export enum SubscriptionTopic {
  favorites = 0,
  journalStatus = 1,
  onlineStatus = 2,
  downloadStatus = 3,
  filesTabBadge = 4,
  overallSyncStatus = 5,
  settings = 6,
  uploadStatus = 7,
}

export enum TLFIdentifyBehavior {
  unset = 0,
  chatCli = 1,
  chatGui = 2,
  removedAndUnused = 3,
  kbfsRekey = 4,
  kbfsQr = 5,
  chatSkip = 6,
  saltpack = 7,
  cli = 8,
  gui = 9,
  defaultKbfs = 10,
  kbfsChat = 11,
  resolveAndCheck = 12,
  guiProfile = 13,
  kbfsInit = 14,
  fsGui = 15,
}

export enum TLFVisibility {
  any = 0,
  public = 1,
  private = 2,
}

export enum TeamApplication {
  kbfs = 1,
  chat = 2,
  saltpack = 3,
  gitMetadata = 4,
  seitanInviteToken = 5,
  stellarRelay = 6,
  kvstore = 7,
}

export enum TeamChangedSource {
  server = 0,
  local = 1,
  localRename = 2,
}

export enum TeamEphemeralKeyType {
  team = 0,
  teambot = 1,
}

export enum TeamInviteCategory {
  none = 0,
  unknown = 1,
  keybase = 2,
  email = 3,
  sbs = 4,
  seitan = 5,
  phone = 6,
  invitelink = 7,
}

export enum TeamInviteMetadataStatusCode {
  active = 0,
  obsolete = 1,
  cancelled = 2,
  completed = 3,
}

export enum TeamMemberStatus {
  active = 0,
  reset = 1,
  deleted = 2,
}

export enum TeamMemberToRemoveType {
  assertion = 0,
  inviteid = 1,
}

export enum TeamRole {
  none = 0,
  reader = 1,
  writer = 2,
  admin = 3,
  owner = 4,
  bot = 5,
  restrictedbot = 6,
}

export enum TeamStatus {
  none = 0,
  live = 1,
  deleted = 2,
  abandoned = 3,
}

export enum TeamTreeMembershipStatus {
  ok = 0,
  error = 1,
  hidden = 2,
}

export enum TeamType {
  none = 0,
  legacy = 1,
  modern = 2,
}

export enum TrackDiffType {
  none = 0,
  error = 1,
  clash = 2,
  revoked = 3,
  upgraded = 4,
  new = 5,
  remoteFail = 6,
  remoteWorking = 7,
  remoteChanged = 8,
  newEldest = 9,
  noneViaTemporary = 10,
}

export enum TrackStatus {
  newOk = 1,
  newZeroProofs = 2,
  newFailProofs = 3,
  updateBrokenFailedProofs = 4,
  updateNewProofs = 5,
  updateOk = 6,
  updateBrokenRevoked = 7,
}

export enum UPAKVersion {
  v1 = 1,
  v2 = 2,
}

export enum UPK2MinorVersion {
  v0 = 0,
  v1 = 1,
  v2 = 2,
  v3 = 3,
  v4 = 4,
  v5 = 5,
  v6 = 6,
}

export enum UPKLiteMinorVersion {
  v0 = 0,
}

export enum UpdateInfoStatus {
  upToDate = 0,
  needUpdate = 1,
  criticallyOutOfDate = 2,
}

export enum UpdateInfoStatus2 {
  ok = 0,
  suggested = 1,
  critical = 2,
}

export enum UserBlockType {
  chat = 0,
  follow = 1,
}

export enum UserOrTeamResult {
  user = 1,
  team = 2,
}

export enum WotReactionType {
  reject = 0,
  accept = 1,
}

export enum WotStatusType {
  none = 0,
  proposed = 1,
  accepted = 2,
  rejected = 3,
  revoked = 4,
}
export type APIRes = {readonly status: string,readonly body: string,readonly httpStatus: number,readonly appStatus: string,}
export type APIUserKeybaseResult = {readonly username: string,readonly uid: UID,readonly pictureUrl?: string | null,readonly fullName?: string | null,readonly rawScore: number,readonly stellar?: string | null,readonly isFollowee: boolean,}
export type APIUserSearchResult = {readonly score: number,readonly keybase?: APIUserKeybaseResult | null,readonly service?: APIUserServiceResult | null,readonly contact?: ProcessedContact | null,readonly imptofu?: ImpTofuSearchResult | null,readonly servicesSummary?: {[key: string]: APIUserServiceSummary} | null,readonly rawScore: number,}
export type APIUserServiceID = string
export type APIUserServiceResult = {readonly serviceName: APIUserServiceID,readonly username: string,readonly pictureUrl: string,readonly bio: string,readonly location: string,readonly fullName: string,readonly confirmed?: boolean | null,}
export type APIUserServiceSummary = {readonly serviceName: APIUserServiceID,readonly username: string,}
export type AirdropDetails = {readonly uid: UID,readonly kid: BinaryKID,readonly vid: VID,readonly vers: string,readonly time: Time,}
export type AllProvisionedUsernames = {readonly defaultUsername: string,readonly provisionedUsernames?: ReadonlyArray<string> | null,readonly hasProvisionedUser: boolean,}
export type AnnotatedMemberInfo = {readonly userID: UID,readonly teamID: TeamID,readonly username: string,readonly fullName: string,readonly fqName: string,readonly isImplicitTeam: boolean,readonly impTeamDisplayName: string,readonly isOpenTeam: boolean,readonly role: TeamRole,readonly implicit?: ImplicitRole | null,readonly needsPUK: boolean,readonly memberCount: number,readonly eldestSeqno: Seqno,readonly allowProfilePromote: boolean,readonly isMemberShowcased: boolean,readonly status: TeamMemberStatus,}
export type AnnotatedTeam = {readonly teamID: TeamID,readonly name: string,readonly transitiveSubteamsUnverified: SubteamListResult,readonly members?: ReadonlyArray<TeamMemberDetails> | null,readonly invites?: ReadonlyArray<AnnotatedTeamInvite> | null,readonly settings: TeamSettings,readonly keyGeneration: PerTeamKeyGeneration,readonly showcase: TeamShowcase,readonly joinRequests?: ReadonlyArray<TeamJoinRequest> | null,readonly tarsDisabled: boolean,}
export type AnnotatedTeamInvite = {readonly inviteMetadata: TeamInviteMetadata,readonly displayName: TeamInviteDisplayName,readonly inviterUsername: string,readonly teamName: string,readonly isValid: boolean,readonly validityDescription: string,readonly inviteExt: AnnotatedTeamInviteExt,}
export type AnnotatedTeamInviteExt ={ c: TeamInviteCategory.keybase, keybase: KeybaseInviteExt } | { c: TeamInviteCategory.invitelink, invitelink: InvitelinkInviteExt } | { c: TeamInviteCategory.none} | { c: TeamInviteCategory.unknown} | { c: TeamInviteCategory.email} | { c: TeamInviteCategory.sbs} | { c: TeamInviteCategory.seitan} | { c: TeamInviteCategory.phone}
export type AnnotatedTeamList = {readonly teams?: ReadonlyArray<AnnotatedMemberInfo> | null,}
export type AnnotatedTeamUsedInviteLogPoint = {readonly username: string,readonly teamUsedInviteLogPoint: TeamUsedInviteLogPoint,}
export type ArchiveJobStartPath ={ archiveJobStartPathType: ArchiveJobStartPathType.kbfs, kbfs: KBFSPath } | { archiveJobStartPathType: ArchiveJobStartPathType.git, git: string }
export type AssertionTeamMemberToRemove = {readonly assertion: string,readonly removeFromSubtree: boolean,}
export type Audit = {readonly time: Time,readonly mms /* maxMerkleSeqno */ : Seqno,readonly mcs /* maxChainSeqno */ : Seqno,readonly mhs /* maxHiddenSeqno */ : Seqno,readonly mmp /* maxMerkleProbe */ : Seqno,}
export type AuditHistory = {readonly ID: TeamID,readonly public: boolean,readonly priorMerkleSeqno: Seqno,readonly version: AuditVersion,readonly audits?: ReadonlyArray<Audit> | null,readonly preProbes?: {[key: string]: Probe} | null,readonly postProbes?: {[key: string]: Probe} | null,readonly tails?: {[key: string]: LinkID} | null,readonly hiddenTails?: {[key: string]: LinkID} | null,readonly preProbesToRetry?: ReadonlyArray<Seqno> | null,readonly postProbesToRetry?: ReadonlyArray<Seqno> | null,readonly skipUntil: Time,}
export type AvatarClearCacheMsg = {readonly name: string,readonly formats?: ReadonlyArray<AvatarFormat> | null,readonly typ: AvatarUpdateType,}
export type AvatarFormat = string
export type AvatarUrl = string
export type BadgeConversationInfo = {readonly convID: ChatConversationID,readonly badgeCount: number,readonly unreadMessages: number,}
export type BadgeState = {readonly newTlfs: number,readonly rekeysNeeded: number,readonly newFollowers: number,readonly inboxVers: number,readonly homeTodoItems: number,readonly unverifiedEmails: number,readonly unverifiedPhones: number,readonly smallTeamBadgeCount: number,readonly bigTeamBadgeCount: number,readonly newTeamAccessRequestCount: number,readonly newDevices?: ReadonlyArray<DeviceID> | null,readonly revokedDevices?: ReadonlyArray<DeviceID> | null,readonly conversations?: ReadonlyArray<BadgeConversationInfo> | null,readonly newGitRepoGlobalUniqueIDs?: ReadonlyArray<string> | null,readonly newTeams?: ReadonlyArray<TeamID> | null,readonly deletedTeams?: ReadonlyArray<DeletedTeamInfo> | null,readonly teamsWithResetUsers?: ReadonlyArray<TeamMemberOutReset> | null,readonly unreadWalletAccounts?: ReadonlyArray<WalletAccountInfo> | null,readonly wotUpdates?: {[key: string]: WotUpdate} | null,readonly resetState: ResetState,}
export type BinaryKID = Uint8Array
export type BinaryLinkID = Uint8Array
export type BlockIdCombo = {readonly blockHash: string,readonly chargedTo: UserOrTeamID,readonly blockType: BlockType,}
export type BlockIdCount = {readonly id: BlockIdCombo,readonly liveCount: number,}
export type BlockPingResponse = {}
export type BlockQuotaInfo = {readonly folders?: ReadonlyArray<FolderUsageStat> | null,readonly total: UsageStat,readonly limit: number,readonly gitLimit: number,}
export type BlockRefNonce = string | null
export type BlockReference = {readonly bid: BlockIdCombo,readonly nonce: BlockRefNonce,readonly chargedTo: UserOrTeamID,}
export type BlockReferenceCount = {readonly ref: BlockReference,readonly liveCount: number,}
export type BootstrapStatus = {readonly registered: boolean,readonly loggedIn: boolean,readonly uid: UID,readonly username: string,readonly deviceID: DeviceID,readonly deviceName: string,readonly fullname: FullName,readonly userReacjis: UserReacjis,readonly httpSrvInfo?: HttpSrvInfo | null,}
export type BotToken = string
export type BotTokenInfo = {readonly token: BotToken,readonly ctime: Time,}
export type BoxAuditAttempt = {readonly ctime: UnixTime,readonly error?: string | null,readonly result: BoxAuditAttemptResult,readonly generation?: PerTeamKeyGeneration | null,readonly rotated: boolean,}
export type BoxNonce = string | null
export type BoxPublicKey = string | null
export type BoxSummaryHash = string
export type BulkRes = {readonly malformed?: ReadonlyArray<string> | null,}
export type Bytes32 = string | null
export type CanLogoutRes = {readonly canLogout: boolean,readonly reason: string,readonly passphraseState: PassphraseState,}
export type CanonicalTLFNameAndIDWithBreaks = {readonly tlfID: TLFID,readonly CanonicalName: CanonicalTlfName,readonly breaks: TLFBreak,}
export type CanonicalTlfName = string
export type ChallengeInfo = {readonly now: number,readonly challenge: string,}
export type ChatConversationID = Uint8Array
export type CheckProofStatus = {readonly found: boolean,readonly status: ProofStatus,readonly proofText: string,readonly state: ProofState,}
export type CheckResult = {readonly proofResult: ProofResult,readonly time: Time,readonly freshness: CheckResultFreshness,}
export type CiphertextBundle = {readonly kid: KID,readonly ciphertext: EncryptedBytes32,readonly nonce: BoxNonce,readonly publicKey: BoxPublicKey,}
export type ClientDetails = {readonly pid: number,readonly clientType: ClientType,readonly argv?: ReadonlyArray<string> | null,readonly desc: string,readonly version: string,}
export type ClientStatus = {readonly details: ClientDetails,readonly connectionID: number,readonly notificationChannels: NotificationChannels,}
export type CompatibilityTeamID ={ typ: TeamType.legacy, legacy: TLFID } | { typ: TeamType.modern, modern: TeamID } | { typ: TeamType.none}
export type ComponentResult = {readonly name: string,readonly status: Status,readonly exitCode: number,}
export type Confidence = {readonly usernameVerifiedVia: UsernameVerificationType,readonly proofs?: ReadonlyArray<WotProof> | null,readonly other: string,}
export type Config = {readonly serverURI: string,readonly socketFile: string,readonly label: string,readonly runMode: string,readonly gpgExists: boolean,readonly gpgPath: string,readonly version: string,readonly path: string,readonly binaryRealpath: string,readonly configPath: string,readonly versionShort: string,readonly versionFull: string,readonly isAutoForked: boolean,readonly forkType: ForkType,}
export type ConfigValue = {readonly isNull: boolean,readonly b?: boolean | null,readonly i?: number | null,readonly f?: number | null,readonly s?: string | null,readonly o?: string | null,}
export type ConfiguredAccount = {readonly username: string,readonly fullname: FullName,readonly hasStoredSecret: boolean,readonly isCurrent: boolean,readonly uid: UID,}
export type ConfirmResult = {readonly identityConfirmed: boolean,readonly remoteConfirmed: boolean,readonly expiringLocal: boolean,readonly autoConfirmed: boolean,}
export type ConflictGeneration = number
export type ConflictState ={ conflictStateType: ConflictStateType.normalview, normalview: FolderNormalView } | { conflictStateType: ConflictStateType.manualresolvinglocalview, manualresolvinglocalview: FolderConflictManualResolvingLocalView }
export type Contact = {readonly name: string,readonly components?: ReadonlyArray<ContactComponent> | null,}
export type ContactComponent = {readonly label: string,readonly phoneNumber?: RawPhoneNumber | null,readonly email?: EmailAddress | null,}
export type ContactListResolutionResult = {readonly newlyResolved?: ReadonlyArray<ProcessedContact> | null,readonly resolved?: ReadonlyArray<ProcessedContact> | null,}
export type ContactSettings = {readonly version?: number | null,readonly allowFolloweeDegrees: number,readonly allowGoodTeams: boolean,readonly enabled: boolean,readonly teams?: ReadonlyArray<TeamContactSettings> | null,}
export type CopyArgs = {readonly opID: OpID,readonly src: Path,readonly dest: Path,readonly overwriteExistingFiles: boolean,}
export type CryptKey = {readonly KeyGeneration: number,readonly Key: Bytes32,}
export type Cryptocurrency = {readonly rowId: number,readonly pkhash: Uint8Array,readonly address: string,readonly sigID: SigID,readonly type: string,readonly family: string,}
export type CsrfToken = string
export type CurrentStatus = {readonly configured: boolean,readonly registered: boolean,readonly loggedIn: boolean,readonly sessionIsValid: boolean,readonly user?: User | null,readonly deviceName: string,}
export type DbKey = {readonly dbType: DbType,readonly objType: number,readonly key: string,}
export type DbStats = {readonly type: DbType,readonly memCompActive: boolean,readonly tableCompActive: boolean,}
export type DbValue = Uint8Array
export type DeletedTeamInfo = {readonly teamName: string,readonly deletedBy: string,readonly id: Gregor1.MsgID,}
export type DesktopStatus = {readonly version: string,readonly running: boolean,readonly log: string,}
export type Device = {readonly type: DeviceTypeV2,readonly name: string,readonly deviceID: DeviceID,readonly deviceNumberOfType: number,readonly cTime: Time,readonly mTime: Time,readonly lastUsedTime: Time,readonly encryptKey: KID,readonly verifyKey: KID,readonly status: number,}
export type DeviceDetail = {readonly device: Device,readonly eldest: boolean,readonly provisioner?: Device | null,readonly provisionedAt?: Time | null,readonly revokedAt?: Time | null,readonly revokedBy: KID,readonly revokedByDevice?: Device | null,readonly currentDevice: boolean,}
export type DeviceEk = {readonly seed: Bytes32,readonly metadata: DeviceEkMetadata,}
export type DeviceEkMetadata = {readonly kid: KID,readonly hashMeta: HashMeta,readonly generation: EkGeneration,readonly ctime: Time,readonly deviceCtime: Time,}
export type DeviceEkStatement = {readonly currentDeviceEkMetadata: DeviceEkMetadata,}
export type DeviceID = string
export type DeviceTypeV2 = string
export type DirSizeInfo = {readonly numFiles: number,readonly name: string,readonly humanSize: string,}
export type Dirent = {readonly time: Time,readonly size: number,readonly name: string,readonly direntType: DirentType,readonly lastWriterUnverified: User,readonly writable: boolean,readonly prefetchStatus: PrefetchStatus,readonly prefetchProgress: PrefetchProgress,readonly symlinkTarget: string,}
export type DirentWithRevision = {readonly entry: Dirent,readonly revision: KBFSRevision,}
export type DismissReason = {readonly type: DismissReasonType,readonly reason: string,readonly resource: string,}
export type DownPointer = {readonly id: TeamID,readonly nameComponent: string,readonly isDeleted: boolean,}
export type DowngradeReferenceRes = {readonly completed?: ReadonlyArray<BlockReferenceCount> | null,readonly failed: BlockReference,}
export type DownloadInfo = {readonly downloadID: string,readonly path: KBFSPath,readonly filename: string,readonly startTime: Time,readonly isRegularDownload: boolean,}
export type DownloadState = {readonly downloadID: string,readonly progress: number,readonly endEstimate: Time,readonly localPath: string,readonly error: string,readonly done: boolean,readonly canceled: boolean,}
export type DownloadStatus = {readonly regularDownloadIDs?: ReadonlyArray<string> | null,readonly states?: ReadonlyArray<DownloadState> | null,}
export type DurationMsec = number
export type DurationSec = number
export type ED25519PublicKey = string | null
export type ED25519Signature = string | null
export type ED25519SignatureInfo = {readonly sig: ED25519Signature,readonly publicKey: ED25519PublicKey,}
export type EkGeneration = number
export type Email = {readonly email: EmailAddress,readonly isVerified: boolean,readonly isPrimary: boolean,readonly visibility: IdentityVisibility,readonly lastVerifyEmailDate: UnixTime,}
export type EmailAddress = string
export type EmailAddressChangedMsg = {readonly email: EmailAddress,}
export type EmailAddressVerifiedMsg = {readonly email: EmailAddress,}
export type EmailInvites = {readonly commaSeparatedEmailsFromUser?: string | null,readonly emailsFromContacts?: ReadonlyArray<EmailAddress> | null,}
export type EmailLookupResult = {readonly email: EmailAddress,readonly uid?: UID | null,}
export type EmailOrPhoneNumberSearchResult = {readonly input: string,readonly assertion: string,readonly assertionValue: string,readonly assertionKey: string,readonly foundUser: boolean,readonly username: string,readonly fullName: string,}
export type EncryptedBytes32 = string | null
export type EncryptedGitMetadata = {readonly v: number,readonly e: Uint8Array,readonly n: BoxNonce,readonly gen: PerTeamKeyGeneration,}
export type EncryptedKVEntry = {readonly v: number,readonly e: Uint8Array,readonly n: Uint8Array,}
export type ErrorNum = number
export type ExtendedStatus = {readonly standalone: boolean,readonly passphraseStreamCached: boolean,readonly tsecCached: boolean,readonly deviceSigKeyCached: boolean,readonly deviceEncKeyCached: boolean,readonly paperSigKeyCached: boolean,readonly paperEncKeyCached: boolean,readonly storedSecret: boolean,readonly secretPromptSkip: boolean,readonly rememberPassphrase: boolean,readonly device?: Device | null,readonly deviceErr?: LoadDeviceErr | null,readonly logDir: string,readonly session?: SessionStatus | null,readonly defaultUsername: string,readonly provisionedUsernames?: ReadonlyArray<string> | null,readonly configuredAccounts?: ReadonlyArray<ConfiguredAccount> | null,readonly Clients?: ReadonlyArray<ClientStatus> | null,readonly deviceEkNames?: ReadonlyArray<string> | null,readonly platformInfo: PlatformInfo,readonly defaultDeviceID: DeviceID,readonly localDbStats?: ReadonlyArray<string> | null,readonly localChatDbStats?: ReadonlyArray<string> | null,readonly localBlockCacheDbStats?: ReadonlyArray<string> | null,readonly localSyncCacheDbStats?: ReadonlyArray<string> | null,readonly cacheDirSizeInfo?: ReadonlyArray<DirSizeInfo> | null,readonly uiRouterMapping?: {[key: string]: number} | null,}
export type ExternalServiceConfig = {readonly schemaVersion: number,readonly display?: ServiceDisplayConfig | null,readonly config?: ParamProofServiceConfig | null,}
export type FSEditListRequest = {readonly folder: Folder,readonly requestID: number,}
export type FSFolderEditHistory = {readonly folder: Folder,readonly serverTime: Time,readonly history?: ReadonlyArray<FSFolderWriterEditHistory> | null,}
export type FSFolderWriterEdit = {readonly filename: string,readonly notificationType: FSNotificationType,readonly serverTime: Time,}
export type FSFolderWriterEditHistory = {readonly writerName: string,readonly edits?: ReadonlyArray<FSFolderWriterEdit> | null,readonly deletes?: ReadonlyArray<FSFolderWriterEdit> | null,}
export type FSNotification = {readonly filename: string,readonly status: string,readonly statusCode: FSStatusCode,readonly notificationType: FSNotificationType,readonly errorType: FSErrorType,readonly params?: {[key: string]: string} | null,readonly writerUid: UID,readonly localTime: Time,readonly folderType: FolderType,}
export type FSPathSyncStatus = {readonly folderType: FolderType,readonly path: string,readonly syncingBytes: number,readonly syncingOps: number,readonly syncedBytes: number,}
export type FSSettings = {readonly spaceAvailableNotificationThreshold: number,readonly sfmiBannerDismissed: boolean,readonly syncOnCellular: boolean,}
export type FSSyncStatus = {readonly totalSyncingBytes: number,readonly syncingPaths?: ReadonlyArray<string> | null,readonly endEstimate?: Time | null,}
export type FSSyncStatusRequest = {readonly requestID: number,}
export type FastTeamData = {readonly frozen: boolean,readonly subversion: number,readonly tombstoned: boolean,readonly name: TeamName,readonly chain: FastTeamSigChainState,readonly perTeamKeySeeds /* perTeamKeySeedsUnverified */ ?: {[key: string]: PerTeamKeySeed} | null,readonly maxContinuousPTKGeneration: PerTeamKeyGeneration,readonly seedChecks?: {[key: string]: PerTeamSeedCheck} | null,readonly latestKeyGeneration: PerTeamKeyGeneration,readonly readerKeyMasks?: {[key: string]: {[key: string]: MaskB64} | null} | null,readonly latestSeqnoHint: Seqno,readonly cachedAt: Time,readonly loadedLatest: boolean,}
export type FastTeamLoadArg = {readonly ID: TeamID,readonly public: boolean,readonly assertTeamName?: TeamName | null,readonly applications?: ReadonlyArray<TeamApplication> | null,readonly keyGenerationsNeeded?: ReadonlyArray<PerTeamKeyGeneration> | null,readonly needLatestKey: boolean,readonly forceRefresh: boolean,readonly hiddenChainIsOptional: boolean,}
export type FastTeamLoadRes = {readonly name: TeamName,readonly applicationKeys?: ReadonlyArray<TeamApplicationKey> | null,}
export type FastTeamSigChainState = {readonly ID: TeamID,readonly public: boolean,readonly rootAncestor: TeamName,readonly nameDepth: number,readonly last?: LinkTriple | null,readonly perTeamKeys?: {[key: string]: PerTeamKey} | null,readonly perTeamKeySeedsVerified?: {[key: string]: PerTeamKeySeed} | null,readonly downPointers?: {[key: string]: DownPointer} | null,readonly lastUpPointer?: UpPointer | null,readonly perTeamKeyCTime: UnixTime,readonly linkIDs?: {[key: string]: LinkID} | null,readonly merkleInfo?: {[key: string]: MerkleRootV2} | null,}
export type FavoritesResult = {readonly favoriteFolders?: ReadonlyArray<Folder> | null,readonly ignoredFolders?: ReadonlyArray<Folder> | null,readonly newFolders?: ReadonlyArray<Folder> | null,}
export type Feature = {readonly allow: boolean,readonly defaultValue: boolean,readonly readonly: boolean,readonly label: string,}
export type FeaturedBot = {readonly botAlias: string,readonly description: string,readonly extendedDescription: string,readonly extendedDescriptionRaw: string,readonly botUsername: string,readonly ownerTeam?: string | null,readonly ownerUser?: string | null,readonly rank: number,readonly isPromoted: boolean,}
export type FeaturedBotsRes = {readonly bots?: ReadonlyArray<FeaturedBot> | null,readonly isLastPage: boolean,}
export type File = {readonly path: string,}
export type FileContent = {readonly data: Uint8Array,readonly progress: Progress,}
export type FileDescriptor = {readonly name: string,readonly type: FileType,}
export type FindNextMDResponse = {readonly kbfsRoot: MerkleRoot,readonly merkleNodes?: ReadonlyArray<Uint8Array> | null,readonly rootSeqno: Seqno,readonly rootHash: HashMeta,}
export type FirstStepResult = {readonly valPlusTwo: number,}
export type Folder = {readonly name: string,readonly private: boolean,readonly created: boolean,readonly folderType: FolderType,readonly team_id /* teamID */ ?: TeamID | null,readonly reset_members /* resetMembers */ ?: ReadonlyArray<User> | null,readonly mtime?: Time | null,readonly conflictState?: ConflictState | null,readonly syncConfig?: FolderSyncConfig | null,}
export type FolderConflictManualResolvingLocalView = {readonly normalView: Path,}
export type FolderHandle = {readonly name: string,readonly folderType: FolderType,readonly created: boolean,}
export type FolderNormalView = {readonly resolvingConflict: boolean,readonly stuckInConflict: boolean,readonly localViews?: ReadonlyArray<Path> | null,}
export type FolderSyncConfig = {readonly mode: FolderSyncMode,readonly paths?: ReadonlyArray<string> | null,}
export type FolderSyncConfigAndStatus = {readonly config: FolderSyncConfig,readonly status: FolderSyncStatus,}
export type FolderSyncConfigAndStatusWithFolder = {readonly folder: Folder,readonly config: FolderSyncConfig,readonly status: FolderSyncStatus,}
export type FolderSyncStatus = {readonly localDiskBytesAvailable: number,readonly localDiskBytesTotal: number,readonly prefetchStatus: PrefetchStatus,readonly prefetchProgress: PrefetchProgress,readonly storedBytesTotal: number,readonly outOfSyncSpace: boolean,}
export type FolderUsageStat = {readonly folderID: string,readonly stats: UsageStat,}
export type FolderWithFavFlags = {readonly folder: Folder,readonly isFavorite: boolean,readonly isIgnored: boolean,readonly isNew: boolean,}
export type FullName = string
export type FullNamePackage = {readonly version: FullNamePackageVersion,readonly fullName: FullName,readonly eldestSeqno: Seqno,readonly status: StatusCode,readonly cachedAt: Time,}
export type FullStatus = {readonly username: string,readonly configPath: string,readonly curStatus: CurrentStatus,readonly extStatus: ExtendedStatus,readonly client: KbClientStatus,readonly service: KbServiceStatus,readonly kbfs: KBFSStatus,readonly desktop: DesktopStatus,readonly updater: UpdaterStatus,readonly start: StartStatus,readonly git: GitStatus,}
export type FuseMountInfo = {readonly path: string,readonly fstype: string,readonly output: string,}
export type FuseStatus = {readonly version: string,readonly bundleVersion: string,readonly kextID: string,readonly path: string,readonly kextStarted: boolean,readonly installStatus: InstallStatus,readonly installAction: InstallAction,readonly mountInfos?: ReadonlyArray<FuseMountInfo> | null,readonly status: Status,}
export type GPGKey = {readonly algorithm: string,readonly keyID: string,readonly creation: string,readonly expiration: string,readonly identities?: ReadonlyArray<PGPIdentity> | null,}
export type GUIEntryArg = {readonly windowTitle: string,readonly prompt: string,readonly username: string,readonly submitLabel: string,readonly cancelLabel: string,readonly retryLabel: string,readonly type: PassphraseType,readonly features: GUIEntryFeatures,}
export type GUIEntryFeatures = {readonly showTyping: Feature,}
export type GUIFileContext = {readonly viewType: GUIViewType,readonly contentType: string,readonly url: string,}
export type GcOptions = {readonly maxLooseRefs: number,readonly pruneMinLooseObjects: number,readonly pruneExpireTime: Time,readonly maxObjectPacks: number,}
export type Generic = {readonly m?: {[key: string]: Generic} | null,readonly a?: ReadonlyArray<Generic> | null,readonly s?: string | null,readonly i?: number | null,}
export type GetBlockRes = {readonly blockKey: string,readonly buf: Uint8Array,readonly size: number,readonly status: BlockStatus,}
export type GetBlockSizesRes = {readonly sizes?: ReadonlyArray<number> | null,readonly statuses?: ReadonlyArray<BlockStatus> | null,}
export type GetLockdownResponse = {readonly history?: ReadonlyArray<LockdownHistory> | null,readonly status: boolean,}
export type GetPassphraseRes = {readonly passphrase: string,readonly storeSecret: boolean,}
export type GetRevisionsArgs = {readonly opID: OpID,readonly path: Path,readonly spanType: RevisionSpanType,}
export type GetRevisionsResult = {readonly revisions?: ReadonlyArray<DirentWithRevision> | null,readonly progress: Progress,}
export type GetTLFCryptKeysRes = {readonly nameIDBreaks: CanonicalTLFNameAndIDWithBreaks,readonly CryptKeys?: ReadonlyArray<CryptKey> | null,}
export type GitCommit = {readonly commitHash: string,readonly message: string,readonly authorName: string,readonly authorEmail: string,readonly ctime: Time,}
export type GitLocalMetadata = {readonly repoName: GitRepoName,readonly refs?: ReadonlyArray<GitRefMetadata> | null,readonly pushType: GitPushType,readonly previousRepoName: GitRepoName,}
export type GitLocalMetadataV1 = {readonly repoName: GitRepoName,}
export type GitLocalMetadataVersioned ={ version: GitLocalMetadataVersion.v1, v1: GitLocalMetadataV1 }
export type GitRefMetadata = {readonly refName: string,readonly commits?: ReadonlyArray<GitCommit> | null,readonly moreCommitsAvailable: boolean,readonly isDelete: boolean,}
export type GitRepoInfo = {readonly folder: FolderHandle,readonly repoID: RepoID,readonly localMetadata: GitLocalMetadata,readonly serverMetadata: GitServerMetadata,readonly repoUrl: string,readonly globalUniqueID: string,readonly canDelete: boolean,readonly teamRepoSettings?: GitTeamRepoSettings | null,}
export type GitRepoName = string
export type GitRepoResult ={ state: GitRepoResultState.err, err: string } | { state: GitRepoResultState.ok, ok: GitRepoInfo }
export type GitServerMetadata = {readonly ctime: Time,readonly mtime: Time,readonly lastModifyingUsername: string,readonly lastModifyingDeviceID: DeviceID,readonly lastModifyingDeviceName: string,}
export type GitStatus = {readonly log: string,readonly perfLog: string,}
export type GitTeamRepoSettings = {readonly channelName?: string | null,readonly chatDisabled: boolean,}
export type HasServerKeysRes = {readonly hasServerKeys: boolean,}
export type HashMeta = Uint8Array
export type Hello2Res = {readonly encryptionKey: KID,readonly sigPayload: HelloRes,readonly deviceEkKID: KID,}
export type HelloRes = string
export type HiddenTeamChain = {readonly id: TeamID,readonly subversion: number,readonly public: boolean,readonly frozen: boolean,readonly tombstoned: boolean,readonly last: Seqno,readonly lastFull: Seqno,readonly latestSeqnoHint: Seqno,readonly lastCommittedSeqno: Seqno,readonly linkReceiptTimes?: {[key: string]: Time} | null,readonly lastPerTeamKeys?: {[key: string]: Seqno} | null,readonly outer?: {[key: string]: LinkID} | null,readonly inner?: {[key: string]: HiddenTeamChainLink} | null,readonly readerPerTeamKeys?: {[key: string]: Seqno} | null,readonly ratchetSet: HiddenTeamChainRatchetSet,readonly cachedAt: Time,readonly needRotate: boolean,readonly merkleRoots?: {[key: string]: MerkleRootV2} | null,}
export type HiddenTeamChainLink = {readonly m /* merkleRoot */ : MerkleRootV2,readonly p /* parentChain */ : LinkTriple,readonly s /* signer */ : Signer,readonly k /* ptk */ ?: {[key: string]: PerTeamKeyAndCheck} | null,}
export type HiddenTeamChainRatchetSet = {readonly ratchets?: {[key: string]: LinkTripleAndTime} | null,}
export type HomeScreen = {readonly lastViewed: Time,readonly version: number,readonly visits: number,readonly items?: ReadonlyArray<HomeScreenItem> | null,readonly followSuggestions?: ReadonlyArray<HomeUserSummary> | null,readonly announcementsVersion: number,}
export type HomeScreenAnnouncement = {readonly id: HomeScreenAnnouncementID,readonly version: HomeScreenAnnouncementVersion,readonly appLink: AppLinkType,readonly confirmLabel: string,readonly dismissable: boolean,readonly iconUrl: string,readonly text: string,readonly url: string,}
export type HomeScreenAnnouncementID = number
export type HomeScreenAnnouncementVersion = number
export type HomeScreenItem = {readonly badged: boolean,readonly data: HomeScreenItemData,readonly dataExt: HomeScreenItemDataExt,}
export type HomeScreenItemData ={ t: HomeScreenItemType.todo, todo: HomeScreenTodo } | { t: HomeScreenItemType.people, people: HomeScreenPeopleNotification } | { t: HomeScreenItemType.announcement, announcement: HomeScreenAnnouncement }
export type HomeScreenItemDataExt ={ t: HomeScreenItemType.todo, todo: HomeScreenTodoExt } | { t: HomeScreenItemType.people} | { t: HomeScreenItemType.announcement}
export type HomeScreenItemID = string
export type HomeScreenPeopleNotification ={ t: HomeScreenPeopleNotificationType.followed, followed: HomeScreenPeopleNotificationFollowed } | { t: HomeScreenPeopleNotificationType.followedMulti, followedMulti: HomeScreenPeopleNotificationFollowedMulti } | { t: HomeScreenPeopleNotificationType.contact, contact: HomeScreenPeopleNotificationContact } | { t: HomeScreenPeopleNotificationType.contactMulti, contactMulti: HomeScreenPeopleNotificationContactMulti }
export type HomeScreenPeopleNotificationContact = {readonly resolveTime: Time,readonly username: string,readonly description: string,readonly resolvedContactBlob: string,}
export type HomeScreenPeopleNotificationContactMulti = {readonly contacts?: ReadonlyArray<HomeScreenPeopleNotificationContact> | null,readonly numOthers: number,}
export type HomeScreenPeopleNotificationFollowed = {readonly followTime: Time,readonly followedBack: boolean,readonly user: UserSummary,}
export type HomeScreenPeopleNotificationFollowedMulti = {readonly followers?: ReadonlyArray<HomeScreenPeopleNotificationFollowed> | null,readonly numOthers: number,}
export type HomeScreenTodo ={ t: HomeScreenTodoType.verifyAllPhoneNumber, verifyAllPhoneNumber: PhoneNumber } | { t: HomeScreenTodoType.verifyAllEmail, verifyAllEmail: EmailAddress } | { t: HomeScreenTodoType.legacyEmailVisibility, legacyEmailVisibility: EmailAddress } | { t: HomeScreenTodoType.none} | { t: HomeScreenTodoType.bio} | { t: HomeScreenTodoType.proof} | { t: HomeScreenTodoType.device} | { t: HomeScreenTodoType.follow} | { t: HomeScreenTodoType.paperkey} | { t: HomeScreenTodoType.team} | { t: HomeScreenTodoType.folder} | { t: HomeScreenTodoType.gitRepo} | { t: HomeScreenTodoType.teamShowcase} | { t: HomeScreenTodoType.avatarTeam} | { t: HomeScreenTodoType.addPhoneNumber} | { t: HomeScreenTodoType.addEmail} | { t: HomeScreenTodoType.avatarUser} | { t: HomeScreenTodoType.chat} | { t: HomeScreenTodoType.annoncementPlaceholder}
export type HomeScreenTodoExt ={ t: HomeScreenTodoType.verifyAllEmail, verifyAllEmail: VerifyAllEmailTodoExt } | { t: HomeScreenTodoType.none} | { t: HomeScreenTodoType.bio} | { t: HomeScreenTodoType.proof} | { t: HomeScreenTodoType.device} | { t: HomeScreenTodoType.follow} | { t: HomeScreenTodoType.paperkey} | { t: HomeScreenTodoType.team} | { t: HomeScreenTodoType.folder} | { t: HomeScreenTodoType.gitRepo} | { t: HomeScreenTodoType.teamShowcase} | { t: HomeScreenTodoType.avatarTeam} | { t: HomeScreenTodoType.addPhoneNumber} | { t: HomeScreenTodoType.verifyAllPhoneNumber} | { t: HomeScreenTodoType.legacyEmailVisibility} | { t: HomeScreenTodoType.addEmail} | { t: HomeScreenTodoType.avatarUser} | { t: HomeScreenTodoType.chat} | { t: HomeScreenTodoType.annoncementPlaceholder}
export type HomeUserSummary = {readonly uid: UID,readonly username: string,readonly bio: string,readonly fullName: string,readonly pics?: Pics | null,}
export type HttpSrvInfo = {readonly address: string,readonly token: string,}
export type Identify2Res = {readonly upk: UserPlusKeys,readonly identifiedAt: Time,readonly trackBreaks?: IdentifyTrackBreaks | null,}
export type Identify2ResUPK2 = {readonly upk: UserPlusKeysV2AllIncarnations,readonly identifiedAt: Time,readonly trackBreaks?: IdentifyTrackBreaks | null,}
export type Identify3Assertion = string
export type Identify3GUIID = string
export type Identify3Row = {readonly guiID: Identify3GUIID,readonly key: string,readonly value: string,readonly priority: number,readonly siteURL: string,readonly siteIcon?: ReadonlyArray<SizedImage> | null,readonly siteIconDarkmode?: ReadonlyArray<SizedImage> | null,readonly siteIconFull?: ReadonlyArray<SizedImage> | null,readonly siteIconFullDarkmode?: ReadonlyArray<SizedImage> | null,readonly proofURL: string,readonly sigID: SigID,readonly ctime: Time,readonly state: Identify3RowState,readonly metas?: ReadonlyArray<Identify3RowMeta> | null,readonly color: Identify3RowColor,readonly kid?: KID | null,readonly wotProof?: WotProof | null,}
export type Identify3RowMeta = {readonly color: Identify3RowColor,readonly label: string,}
export type Identify3Summary = {readonly guiID: Identify3GUIID,readonly numProofsToCheck: number,}
export type IdentifyKey = {readonly pgpFingerprint: Uint8Array,readonly KID: KID,readonly trackDiff?: TrackDiff | null,readonly breaksTracking: boolean,readonly sigID: SigID,}
export type IdentifyLiteRes = {readonly ul: UserOrTeamLite,readonly trackBreaks?: IdentifyTrackBreaks | null,}
export type IdentifyOutcome = {readonly username: string,readonly status?: Status | null,readonly warnings?: ReadonlyArray<string> | null,readonly trackUsed?: TrackSummary | null,readonly trackStatus: TrackStatus,readonly numTrackFailures: number,readonly numTrackChanges: number,readonly numProofFailures: number,readonly numRevoked: number,readonly numProofSuccesses: number,readonly revoked?: ReadonlyArray<TrackDiff> | null,readonly trackOptions: TrackOptions,readonly forPGPPull: boolean,readonly reason: IdentifyReason,}
export type IdentifyProofBreak = {readonly remoteProof: RemoteProof,readonly lcr: LinkCheckResult,}
export type IdentifyReason = {readonly type: IdentifyReasonType,readonly reason: string,readonly resource: string,}
export type IdentifyRow = {readonly rowId: number,readonly proof: RemoteProof,readonly trackDiff?: TrackDiff | null,}
export type IdentifyTrackBreaks = {readonly keys?: ReadonlyArray<IdentifyKey> | null,readonly proofs?: ReadonlyArray<IdentifyProofBreak> | null,}
export type Identity = {readonly status?: Status | null,readonly whenLastTracked: Time,readonly proofs?: ReadonlyArray<IdentifyRow> | null,readonly cryptocurrency?: ReadonlyArray<Cryptocurrency> | null,readonly revoked?: ReadonlyArray<TrackDiff> | null,readonly revokedDetails?: ReadonlyArray<RevokedProof> | null,readonly breaksTracking: boolean,}
export type ImageCropRect = {readonly x0: number,readonly y0: number,readonly x1: number,readonly y1: number,}
export type ImpTofuSearchResult = {readonly assertion: string,readonly assertionValue: string,readonly assertionKey: string,readonly label: string,readonly prettyName: string,readonly keybaseUsername: string,}
export type ImplicitRole = {readonly role: TeamRole,readonly ancestor: TeamID,}
export type ImplicitTeamConflictInfo = {readonly generation: ConflictGeneration,readonly time: Time,}
export type ImplicitTeamDisplayName = {readonly isPublic: boolean,readonly writers: ImplicitTeamUserSet,readonly readers: ImplicitTeamUserSet,readonly conflictInfo?: ImplicitTeamConflictInfo | null,}
export type ImplicitTeamUserSet = {readonly keybaseUsers?: ReadonlyArray<string> | null,readonly unresolvedUsers?: ReadonlyArray<SocialAssertion> | null,}
export type IncomingShareItem = {readonly type: IncomingShareType,readonly originalPath?: string | null,readonly originalSize?: number | null,readonly scaledPath?: string | null,readonly scaledSize?: number | null,readonly thumbnailPath?: string | null,readonly content?: string | null,}
export type IncomingSharePreference = {readonly compressPreference: IncomingShareCompressPreference,}
export type IndexProgressRecord = {readonly endEstimate: Time,readonly bytesTotal: number,readonly bytesSoFar: number,}
export type InstallResult = {readonly componentResults?: ReadonlyArray<ComponentResult> | null,readonly status: Status,readonly fatal: boolean,}
export type InstrumentationStat = {readonly t /* tag */ : string,readonly n /* numCalls */ : number,readonly c /* ctime */ : Time,readonly m /* mtime */ : Time,readonly ad /* avgDur */ : DurationMsec,readonly xd /* maxDur */ : DurationMsec,readonly nd /* minDur */ : DurationMsec,readonly td /* totalDur */ : DurationMsec,readonly as /* avgSize */ : number,readonly xs /* maxSize */ : number,readonly ns /* minSize */ : number,readonly ts /* totalSize */ : number,}
export type InterestingPerson = {readonly uid: UID,readonly username: string,readonly fullname: string,readonly serviceMap?: {[key: string]: string} | null,}
export type InviteCounts = {readonly inviteCount: number,readonly percentageChange: number,readonly showNumInvites: boolean,readonly showFire: boolean,readonly tooltipMarkdown: string,}
export type InviteLinkDetails = {readonly inviteID: TeamInviteID,readonly inviterResetOrDel: boolean,readonly inviterUID: UID,readonly inviterUsername: string,readonly isMember: boolean,readonly teamAvatars?: {[key: string]: AvatarUrl} | null,readonly teamDesc: string,readonly teamID: TeamID,readonly teamIsOpen: boolean,readonly teamName: TeamName,readonly teamNumMembers: number,}
export type InviteTeamMemberToRemove = {readonly inviteID: TeamInviteID,}
export type Invitelink = {readonly ikey: SeitanIKeyInvitelink,readonly url: string,}
export type InvitelinkInviteExt = {readonly annotatedUsedInvites?: ReadonlyArray<AnnotatedTeamUsedInviteLogPoint> | null,}
export type KBFSArchivedParam ={ KBFSArchivedType: KBFSArchivedType.revision, revision: KBFSRevision } | { KBFSArchivedType: KBFSArchivedType.time, time: Time } | { KBFSArchivedType: KBFSArchivedType.timeString, timeString: string } | { KBFSArchivedType: KBFSArchivedType.relTimeString, relTimeString: string }
export type KBFSArchivedPath = {readonly path: string,readonly archivedParam: KBFSArchivedParam,readonly identifyBehavior?: TLFIdentifyBehavior | null,}
export type KBFSPath = {readonly path: string,readonly identifyBehavior?: TLFIdentifyBehavior | null,}
export type KBFSPathInfo = {readonly standardPath: string,readonly deeplinkPath: string,readonly platformAfterMountPath: string,}
export type KBFSRevision = number
export type KBFSRoot = {readonly treeID: MerkleTreeID,readonly root: KBFSRootHash,}
export type KBFSRootHash = Uint8Array
export type KBFSStatus = {readonly version: string,readonly installedVersion: string,readonly running: boolean,readonly pid: string,readonly log: string,readonly perfLog: string,readonly mount: string,}
export type KBFSTeamSettings = {readonly tlfID: TLFID,}
export type KID = string
export type KVDeleteEntryResult = {readonly teamName: string,readonly namespace: string,readonly entryKey: string,readonly revision: number,}
export type KVEntryID = {readonly teamID: TeamID,readonly namespace: string,readonly entryKey: string,}
export type KVGetResult = {readonly teamName: string,readonly namespace: string,readonly entryKey: string,readonly entryValue?: string | null,readonly revision: number,}
export type KVListEntryKey = {readonly entryKey: string,readonly revision: number,}
export type KVListEntryResult = {readonly teamName: string,readonly namespace: string,readonly entryKeys?: ReadonlyArray<KVListEntryKey> | null,}
export type KVListNamespaceResult = {readonly teamName: string,readonly namespaces?: ReadonlyArray<string> | null,}
export type KVPutResult = {readonly teamName: string,readonly namespace: string,readonly entryKey: string,readonly revision: number,}
export type KbClientStatus = {readonly version: string,}
export type KbServiceStatus = {readonly version: string,readonly running: boolean,readonly pid: string,readonly log: string,readonly ekLog: string,readonly perfLog: string,}
export type KeyBundle = {readonly version: number,readonly bundle: Uint8Array,}
export type KeyBundleResponse = {readonly WriterBundle: KeyBundle,readonly ReaderBundle: KeyBundle,}
export type KeyHalf = {readonly user: UID,readonly deviceKID: KID,readonly key: Uint8Array,}
export type KeyInfo = {readonly fingerprint: string,readonly key: string,readonly desc: string,}
export type KeybaseInviteExt = {readonly inviteeUv: UserVersion,readonly status: TeamMemberStatus,readonly fullName: FullName,readonly username: string,}
export type KeybaseTime = {readonly unix: Time,readonly chain: Seqno,}
export type LeaseID = string
export type LinkCheckResult = {readonly proofId: number,readonly proofResult: ProofResult,readonly snoozedResult: ProofResult,readonly torWarning: boolean,readonly tmpTrackExpireTime: Time,readonly cached?: CheckResult | null,readonly diff?: TrackDiff | null,readonly remoteDiff?: TrackDiff | null,readonly hint?: SigHint | null,readonly breaksTracking: boolean,}
export type LinkID = string
export type LinkTriple = {readonly seqno: Seqno,readonly seqType: SeqType,readonly linkID: LinkID,}
export type LinkTripleAndTime = {readonly triple: LinkTriple,readonly time: Time,}
export type ListArgs = {readonly opID: OpID,readonly path: Path,readonly filter: ListFilter,}
export type ListResult = {readonly files?: ReadonlyArray<File> | null,}
export type ListToDepthArgs = {readonly opID: OpID,readonly path: Path,readonly filter: ListFilter,readonly depth: number,}
export type LoadAvatarsRes = {readonly picmap?: {[key: string]: {[key: string]: AvatarUrl} | null} | null,}
export type LoadDeviceErr = {readonly where: string,readonly desc: string,}
export type LoadTeamArg = {readonly ID: TeamID,readonly name: string,readonly public: boolean,readonly needAdmin: boolean,readonly refreshUIDMapper: boolean,readonly refreshers: TeamRefreshers,readonly forceFullReload: boolean,readonly forceRepoll: boolean,readonly staleOK: boolean,readonly allowNameLookupBurstCache: boolean,readonly skipNeedHiddenRotateCheck: boolean,readonly auditMode: AuditMode,}
export type LockContext = {readonly requireLockID: LockID,readonly releaseAfterSuccess: boolean,}
export type LockID = number
export type LockdownHistory = {readonly status: boolean,readonly creationTime: Time,readonly deviceID: DeviceID,readonly deviceName: string,}
export type LogSendID = string
export type LookupImplicitTeamRes = {readonly teamID: TeamID,readonly name: TeamName,readonly displayName: ImplicitTeamDisplayName,readonly tlfID: TLFID,}
export type MDBlock = {readonly version: number,readonly timestamp: Time,readonly block: Uint8Array,}
export type MDPriority = number
export type MaskB64 = Uint8Array
export type MemberEmail = {readonly email: string,readonly role: string,}
export type MemberInfo = {readonly userID: UID,readonly teamID: TeamID,readonly fqName: string,readonly isImplicitTeam: boolean,readonly isOpenTeam: boolean,readonly role: TeamRole,readonly implicit?: ImplicitRole | null,readonly memberCount: number,readonly allowProfilePromote: boolean,readonly isMemberShowcased: boolean,}
export type MemberUsername = {readonly username: string,readonly role: string,}
export type MerkleRoot = {readonly version: number,readonly root: Uint8Array,}
export type MerkleRootAndTime = {readonly root: MerkleRootV2,readonly updateTime: Time,readonly fetchTime: Time,}
export type MerkleRootV2 = {readonly seqno: Seqno,readonly hashMeta: HashMeta,}
export type MerkleStoreEntry = {readonly hash: MerkleStoreKitHash,readonly entry: MerkleStoreEntryString,}
export type MerkleStoreEntryString = string
export type MerkleStoreKit = string
export type MerkleStoreKitHash = string
export type MerkleStoreSupportedVersion = number
export type MerkleTreeLocation = {readonly leaf: UserOrTeamID,readonly loc: SigChainLocation,}
export type MetadataResponse = {readonly folderID: string,readonly mdBlocks?: ReadonlyArray<MDBlock> | null,}
export type MoveArgs = {readonly opID: OpID,readonly src: Path,readonly dest: Path,readonly overwriteExistingFiles: boolean,}
export type NaclDHKeyPrivate = string | null
export type NaclDHKeyPublic = string | null
export type NaclSigningKeyPrivate = string | null
export type NaclSigningKeyPublic = string | null
export type NextMerkleRootRes = {readonly res?: MerkleRootV2 | null,}
export type NonUserDetails = {readonly isNonUser: boolean,readonly assertionValue: string,readonly assertionKey: string,readonly description: string,readonly contact?: ProcessedContact | null,readonly service?: APIUserServiceResult | null,readonly siteIcon?: ReadonlyArray<SizedImage> | null,readonly siteIconDarkmode?: ReadonlyArray<SizedImage> | null,readonly siteIconFull?: ReadonlyArray<SizedImage> | null,readonly siteIconFullDarkmode?: ReadonlyArray<SizedImage> | null,}
export type NotificationChannels = {readonly session: boolean,readonly users: boolean,readonly kbfs: boolean,readonly kbfsdesktop: boolean,readonly kbfslegacy: boolean,readonly kbfssubscription: boolean,readonly notifysimplefs: boolean,readonly tracking: boolean,readonly favorites: boolean,readonly paperkeys: boolean,readonly keyfamily: boolean,readonly service: boolean,readonly app: boolean,readonly chat: boolean,readonly pgp: boolean,readonly kbfsrequest: boolean,readonly badges: boolean,readonly reachability: boolean,readonly team: boolean,readonly ephemeral: boolean,readonly teambot: boolean,readonly chatkbfsedits: boolean,readonly chatdev: boolean,readonly chatemoji: boolean,readonly chatemojicross: boolean,readonly deviceclone: boolean,readonly chatattachments: boolean,readonly wallet: boolean,readonly audit: boolean,readonly runtimestats: boolean,readonly featuredBots: boolean,readonly saltpack: boolean,readonly allowChatNotifySkips: boolean,readonly chatarchive: boolean,}
export type OpDescription ={ asyncOp: AsyncOps.list, list: ListArgs } | { asyncOp: AsyncOps.listRecursive, listRecursive: ListArgs } | { asyncOp: AsyncOps.listRecursiveToDepth, listRecursiveToDepth: ListToDepthArgs } | { asyncOp: AsyncOps.read, read: ReadArgs } | { asyncOp: AsyncOps.write, write: WriteArgs } | { asyncOp: AsyncOps.copy, copy: CopyArgs } | { asyncOp: AsyncOps.move, move: MoveArgs } | { asyncOp: AsyncOps.remove, remove: RemoveArgs } | { asyncOp: AsyncOps.getRevisions, getRevisions: GetRevisionsArgs }
export type OpID = string | null
export type OpProgress = {readonly start: Time,readonly endEstimate: Time,readonly opType: AsyncOps,readonly bytesTotal: number,readonly bytesRead: number,readonly bytesWritten: number,readonly filesTotal: number,readonly filesRead: number,readonly filesWritten: number,}
export type OutOfDateInfo = {readonly upgradeTo: string,readonly upgradeURI: string,readonly customMessage: string,readonly criticalClockSkew: number,}
export type PGPCreateUids = {readonly useDefault: boolean,readonly ids?: ReadonlyArray<PGPIdentity> | null,}
export type PGPDecryptOptions = {readonly assertSigned: boolean,readonly signedBy: string,}
export type PGPEncryptOptions = {readonly recipients?: ReadonlyArray<string> | null,readonly noSign: boolean,readonly noSelf: boolean,readonly binaryOut: boolean,readonly keyQuery: string,}
export type PGPFingerprint = string | null
export type PGPIdentity = {readonly username: string,readonly comment: string,readonly email: string,}
export type PGPPurgeRes = {readonly filenames?: ReadonlyArray<string> | null,}
export type PGPQuery = {readonly secret: boolean,readonly query: string,readonly exactMatch: boolean,}
export type PGPSigVerification = {readonly isSigned: boolean,readonly verified: boolean,readonly signer: User,readonly signKey: PublicKey,readonly warnings?: ReadonlyArray<string> | null,}
export type PGPSignOptions = {readonly keyQuery: string,readonly mode: SignMode,readonly binaryIn: boolean,readonly binaryOut: boolean,}
export type PGPVerifyOptions = {readonly signedBy: string,readonly signature: Uint8Array,}
export type ParamProofJSON = {readonly sigHash: SigID,readonly kbUsername: string,}
export type ParamProofServiceConfig = {readonly version: number,readonly domain: string,readonly displayName: string,readonly description: string,readonly usernameConfig: ParamProofUsernameConfig,readonly brandColor: string,readonly prefillUrl: string,readonly profileUrl: string,readonly checkUrl: string,readonly checkPath?: ReadonlyArray<SelectorEntry> | null,readonly avatarPath?: ReadonlyArray<SelectorEntry> | null,}
export type ParamProofUsernameConfig = {readonly re: string,readonly min: number,readonly max: number,}
export type PassphraseStream = {readonly passphraseStream: Uint8Array,readonly generation: number,}
export type Path ={ PathType: PathType.local, local: string } | { PathType: PathType.kbfs, kbfs: KBFSPath } | { PathType: PathType.kbfsArchived, kbfsArchived: KBFSArchivedPath }
export type PerTeamKey = {readonly gen: PerTeamKeyGeneration,readonly seqno: Seqno,readonly sigKID: KID,readonly encKID: KID,}
export type PerTeamKeyAndCheck = {readonly ptk: PerTeamKey,readonly check: PerTeamSeedCheckPostImage,}
export type PerTeamKeyGeneration = number
export type PerTeamKeySeed = string | null
export type PerTeamKeySeedItem = {readonly seed: PerTeamKeySeed,readonly generation: PerTeamKeyGeneration,readonly seqno: Seqno,readonly check?: PerTeamSeedCheck | null,}
export type PerTeamSeedCheck = {readonly version: PerTeamSeedCheckVersion,readonly value: PerTeamSeedCheckValue,}
export type PerTeamSeedCheckPostImage = {readonly h /* value */ : PerTeamSeedCheckValuePostImage,readonly v /* version */ : PerTeamSeedCheckVersion,}
export type PerTeamSeedCheckValue = Uint8Array
export type PerTeamSeedCheckValuePostImage = Uint8Array
export type PerUserKey = {readonly gen: number,readonly seqno: Seqno,readonly sigKID: KID,readonly encKID: KID,readonly signedByKID: KID,}
export type PerUserKeyBox = {readonly generation: PerUserKeyGeneration,readonly box: string,readonly receiverKID: KID,}
export type PerUserKeyGeneration = number
export type PerfEvent = {readonly message: string,readonly ctime: Time,readonly eventType: PerfEventType,}
export type PhoneLookupResult = {readonly uid: UID,readonly username: string,readonly ctime: UnixTime,}
export type PhoneNumber = string
export type PhoneNumberChangedMsg = {readonly phoneNumber: PhoneNumber,}
export type PhoneNumberLookupResult = {readonly phoneNumber: RawPhoneNumber,readonly coercedPhoneNumber: PhoneNumber,readonly err?: string | null,readonly uid?: UID | null,}
export type Pics = {readonly square40: string,readonly square200: string,readonly square360: string,}
export type PingResponse = {readonly timestamp: Time,}
export type PlatformInfo = {readonly os: string,readonly osVersion: string,readonly arch: string,readonly goVersion: string,}
export type PrefetchProgress = {readonly start: Time,readonly endEstimate: Time,readonly bytesTotal: number,readonly bytesFetched: number,}
export type Probe = {readonly i /* index */ : number,readonly s /* teamSeqno */ : Seqno,readonly h /* teamHiddenSeqno */ : Seqno,}
export type ProblemSet = {readonly user: User,readonly kid: KID,readonly tlfs?: ReadonlyArray<ProblemTLF> | null,}
export type ProblemSetDevices = {readonly problemSet: ProblemSet,readonly devices?: ReadonlyArray<Device> | null,}
export type ProblemTLF = {readonly tlf: TLF,readonly score: number,readonly solution_kids?: ReadonlyArray<KID> | null,}
export type Process = {readonly pid: string,readonly command: string,readonly fileDescriptors?: ReadonlyArray<FileDescriptor> | null,}
export type ProcessRuntimeStats = {readonly type: ProcessType,readonly cpu: string,readonly resident: string,readonly virt: string,readonly free: string,readonly goheap: string,readonly goheapsys: string,readonly goreleased: string,readonly cpuSeverity: StatsSeverityLevel,readonly residentSeverity: StatsSeverityLevel,}
export type ProcessedContact = {readonly contactIndex: number,readonly contactName: string,readonly component: ContactComponent,readonly resolved: boolean,readonly uid: UID,readonly username: string,readonly fullName: string,readonly following: boolean,readonly serviceMap?: {[key: string]: string} | null,readonly assertion: string,readonly displayName: string,readonly displayLabel: string,}
export type ProfileTeamLoadRes = {readonly loadTimeNsec: number,}
export type Progress = number
export type ProofResult = {readonly state: ProofState,readonly status: ProofStatus,readonly desc: string,}
export type ProofSuggestion = {readonly key: string,readonly belowFold: boolean,readonly profileText: string,readonly profileIcon?: ReadonlyArray<SizedImage> | null,readonly profileIconDarkmode?: ReadonlyArray<SizedImage> | null,readonly pickerText: string,readonly pickerSubtext: string,readonly pickerIcon?: ReadonlyArray<SizedImage> | null,readonly pickerIconDarkmode?: ReadonlyArray<SizedImage> | null,readonly metas?: ReadonlyArray<Identify3RowMeta> | null,}
export type ProofSuggestionsRes = {readonly suggestions?: ReadonlyArray<ProofSuggestion> | null,readonly showMore: boolean,}
export type Proofs = {readonly social?: ReadonlyArray<TrackProof> | null,readonly web?: ReadonlyArray<WebProof> | null,readonly publicKeys?: ReadonlyArray<PublicKey> | null,}
export type ProveParameters = {readonly logoFull?: ReadonlyArray<SizedImage> | null,readonly logoBlack?: ReadonlyArray<SizedImage> | null,readonly logoWhite?: ReadonlyArray<SizedImage> | null,readonly title: string,readonly subtext: string,readonly suffix: string,readonly buttonLabel: string,}
export type ProxyData = {readonly addressWithPort: string,readonly proxyType: ProxyType,readonly certPinning: boolean,}
export type PublicKey = {readonly KID: KID,readonly PGPFingerprint: string,readonly PGPIdentities?: ReadonlyArray<PGPIdentity> | null,readonly isSibkey: boolean,readonly isEldest: boolean,readonly parentID: string,readonly deviceID: DeviceID,readonly deviceDescription: string,readonly deviceType: DeviceTypeV2,readonly cTime: Time,readonly eTime: Time,readonly isRevoked: boolean,}
export type PublicKeyV2 ={ keyType: KeyType.nacl, nacl: PublicKeyV2NaCl } | { keyType: KeyType.pgp, pgp: PublicKeyV2PGPSummary } | { keyType: KeyType.none}
export type PublicKeyV2Base = {readonly kid: KID,readonly isSibkey: boolean,readonly isEldest: boolean,readonly cTime: Time,readonly eTime: Time,readonly provisioning: SignatureMetadata,readonly revocation?: SignatureMetadata | null,}
export type PublicKeyV2NaCl = {readonly base: PublicKeyV2Base,readonly parent?: KID | null,readonly deviceID: DeviceID,readonly deviceDescription: string,readonly deviceType: DeviceTypeV2,}
export type PublicKeyV2PGPSummary = {readonly base: PublicKeyV2Base,readonly fingerprint: PGPFingerprint,readonly identities?: ReadonlyArray<PGPIdentity> | null,}
export type RawPhoneNumber = string
export type Reachability = {readonly reachable: Reachable,}
export type ReadArgs = {readonly opID: OpID,readonly path: Path,readonly offset: number,readonly size: number,}
export type ReaderKeyMask = {readonly application: TeamApplication,readonly generation: PerTeamKeyGeneration,readonly mask: MaskB64,}
export type ReferenceCountRes = {readonly counts?: ReadonlyArray<BlockIdCount> | null,}
export type RegisterAddressRes = {readonly type: string,readonly family: string,}
export type RekeyEvent = {readonly eventType: RekeyEventType,readonly interruptType: number,}
export type RekeyRequest = {readonly folderID: string,readonly revision: number,}
export type RemoteProof = {readonly proofType: ProofType,readonly key: string,readonly value: string,readonly displayMarkup: string,readonly sigID: SigID,readonly mTime: Time,}
export type RemoteTrack = {readonly username: string,readonly uid: UID,readonly linkID: LinkID,}
export type RemoveArgs = {readonly opID: OpID,readonly path: Path,readonly recursive: boolean,}
export type RemoveTeamMemberFailure = {readonly teamMember: TeamMemberToRemove,readonly errorAtTarget?: string | null,readonly errorAtSubtree?: string | null,}
export type RepoID = string
export type ResetLink = {readonly ctime: UnixTime,readonly merkleRoot: ResetMerkleRoot,readonly prev: ResetPrev,readonly resetSeqno: Seqno,readonly type: ResetType,readonly uid: UID,}
export type ResetMerkleRoot = {readonly hashMeta: HashMeta,readonly seqno: Seqno,}
export type ResetPrev = {readonly eldestKID?: KID | null,readonly lastSeqno: Seqno,readonly reset: SHA512,}
export type ResetPrompt ={ t: ResetPromptType.complete, complete: ResetPromptInfo } | { t: ResetPromptType.enterNoDevices} | { t: ResetPromptType.enterForgotPw} | { t: ResetPromptType.enterResetPw}
export type ResetPromptInfo = {readonly hasWallet: boolean,}
export type ResetState = {readonly endTime: Time,readonly active: boolean,}
export type ResetSummary = {readonly ctime: UnixTime,readonly merkleRoot: ResetMerkleRoot,readonly resetSeqno: Seqno,readonly eldestSeqno: Seqno,readonly type: ResetType,}
export type ResolveIdentifyImplicitTeamRes = {readonly displayName: string,readonly teamID: TeamID,readonly writers?: ReadonlyArray<UserVersion> | null,readonly trackBreaks?: {[key: string]: IdentifyTrackBreaks} | null,readonly folderID: TLFID,}
export type RevokeWarning = {readonly endangeredTLFs?: ReadonlyArray<TLF> | null,}
export type RevokedKey = {readonly key: PublicKey,readonly time: KeybaseTime,readonly by: KID,}
export type RevokedProof = {readonly proof: RemoteProof,readonly diff: TrackDiff,readonly snoozed: boolean,}
export type RuntimeStats = {readonly processStats?: ReadonlyArray<ProcessRuntimeStats> | null,readonly dbStats?: ReadonlyArray<DbStats> | null,readonly perfEvents?: ReadonlyArray<PerfEvent> | null,readonly convLoaderActive: boolean,readonly selectiveSyncActive: boolean,}
export type SHA512 = Uint8Array
export type SaltpackDecryptOptions = {readonly interactive: boolean,readonly forceRemoteCheck: boolean,readonly usePaperKey: boolean,}
export type SaltpackEncryptFileResult = {readonly usedUnresolvedSBS: boolean,readonly unresolvedSBSAssertion: string,readonly filename: string,}
export type SaltpackEncryptOptions = {readonly recipients?: ReadonlyArray<string> | null,readonly teamRecipients?: ReadonlyArray<string> | null,readonly authenticityType: AuthenticityType,readonly useEntityKeys: boolean,readonly useDeviceKeys: boolean,readonly usePaperKeys: boolean,readonly noSelfEncrypt: boolean,readonly binary: boolean,readonly saltpackVersion: number,readonly noForcePoll: boolean,readonly useKBFSKeysOnlyForTesting: boolean,}
export type SaltpackEncryptResult = {readonly usedUnresolvedSBS: boolean,readonly unresolvedSBSAssertion: string,}
export type SaltpackEncryptStringResult = {readonly usedUnresolvedSBS: boolean,readonly unresolvedSBSAssertion: string,readonly ciphertext: string,}
export type SaltpackEncryptedMessageInfo = {readonly devices?: ReadonlyArray<Device> | null,readonly numAnonReceivers: number,readonly receiverIsAnon: boolean,readonly sender: SaltpackSender,}
export type SaltpackFileResult = {readonly info: SaltpackEncryptedMessageInfo,readonly decryptedFilename: string,readonly signed: boolean,}
export type SaltpackFrontendEncryptOptions = {readonly recipients?: ReadonlyArray<string> | null,readonly signed: boolean,readonly includeSelf: boolean,}
export type SaltpackPlaintextResult = {readonly info: SaltpackEncryptedMessageInfo,readonly plaintext: string,readonly signed: boolean,}
export type SaltpackSender = {readonly uid: UID,readonly username: string,readonly fullname: string,readonly senderType: SaltpackSenderType,}
export type SaltpackSignOptions = {readonly detached: boolean,readonly binary: boolean,readonly saltpackVersion: number,}
export type SaltpackVerifyFileResult = {readonly signingKID: KID,readonly sender: SaltpackSender,readonly verifiedFilename: string,readonly verified: boolean,}
export type SaltpackVerifyOptions = {readonly signedBy: string,readonly signature: Uint8Array,}
export type SaltpackVerifyResult = {readonly signingKID: KID,readonly sender: SaltpackSender,readonly plaintext: string,readonly verified: boolean,}
export type SearchRes = {readonly bots?: ReadonlyArray<FeaturedBot> | null,readonly isLastPage: boolean,}
export type SecretEntryArg = {readonly desc: string,readonly prompt: string,readonly err: string,readonly cancel: string,readonly ok: string,readonly reason: string,readonly showTyping: boolean,}
export type SecretEntryRes = {readonly text: string,readonly canceled: boolean,readonly storeSecret: boolean,}
export type SecretKeys = {readonly signing: NaclSigningKeyPrivate,readonly encryption: NaclDHKeyPrivate,}
export type SecretResponse = {readonly secret: Uint8Array,readonly phrase: string,}
export type SeitanAKey = string
export type SeitanIKey = string
export type SeitanIKeyInvitelink = string
export type SeitanIKeyV2 = string
export type SeitanKeyAndLabel ={ v: SeitanKeyAndLabelVersion.v1, v1: SeitanKeyAndLabelVersion1 } | { v: SeitanKeyAndLabelVersion.v2, v2: SeitanKeyAndLabelVersion2 } | { v: SeitanKeyAndLabelVersion.invitelink, invitelink: SeitanKeyAndLabelInvitelink }
export type SeitanKeyAndLabelInvitelink = {readonly i: SeitanIKeyInvitelink,readonly l: SeitanKeyLabel,}
export type SeitanKeyAndLabelVersion1 = {readonly i: SeitanIKey,readonly l: SeitanKeyLabel,}
export type SeitanKeyAndLabelVersion2 = {readonly k: SeitanPubKey,readonly l: SeitanKeyLabel,}
export type SeitanKeyLabel ={ t: SeitanKeyLabelType.sms, sms: SeitanKeyLabelSms } | { t: SeitanKeyLabelType.generic, generic: SeitanKeyLabelGeneric }
export type SeitanKeyLabelGeneric = {readonly l: string,}
export type SeitanKeyLabelSms = {readonly f: string,readonly n: string,}
export type SeitanPubKey = string
export type SelectKeyRes = {readonly keyID: string,readonly doSecretPush: boolean,}
export type SelectorEntry = {readonly isIndex: boolean,readonly index: number,readonly isKey: boolean,readonly key: string,readonly isAll: boolean,readonly isContents: boolean,}
export type Seqno = number
export type ServiceDisplayConfig = {readonly creationDisabled: boolean,readonly priority: number,readonly key: string,readonly group?: string | null,readonly new: boolean,readonly logoKey: string,}
export type ServiceStatus = {readonly version: string,readonly label: string,readonly pid: string,readonly lastExitStatus: string,readonly bundleVersion: string,readonly installStatus: InstallStatus,readonly installAction: InstallAction,readonly status: Status,}
export type ServicesStatus = {readonly service?: ReadonlyArray<ServiceStatus> | null,readonly kbfs?: ReadonlyArray<ServiceStatus> | null,readonly updater?: ReadonlyArray<ServiceStatus> | null,}
export type Session = {readonly uid: UID,readonly username: string,readonly token: string,readonly deviceSubkeyKid: KID,readonly deviceSibkeyKid: KID,}
export type SessionStatus = {readonly SessionFor: string,readonly Loaded: boolean,readonly Cleared: boolean,readonly SaltOnly: boolean,readonly Expired: boolean,}
export type SessionToken = string
export type Sig = {readonly seqno: Seqno,readonly sigID: SigID,readonly sigIDDisplay: string,readonly type: string,readonly cTime: Time,readonly revoked: boolean,readonly active: boolean,readonly key: string,readonly body: string,}
export type SigChainLocation = {readonly seqno: Seqno,readonly seqType: SeqType,}
export type SigHint = {readonly remoteId: string,readonly humanUrl: string,readonly apiUrl: string,readonly checkText: string,}
export type SigID = string
export type SigListArgs = {readonly sessionID: number,readonly username: string,readonly allKeys: boolean,readonly types?: SigTypes | null,readonly filterx: string,readonly verbose: boolean,readonly revoked: boolean,}
export type SigTypes = {readonly track: boolean,readonly proof: boolean,readonly cryptocurrency: boolean,readonly isSelf: boolean,}
export type SigVersion = number
export type SignatureMetadata = {readonly signingKID: KID,readonly prevMerkleRootSigned: MerkleRootV2,readonly firstAppearedUnverified: Seqno,readonly time: Time,readonly sigChainLocation: SigChainLocation,}
export type Signer = {readonly e: Seqno,readonly k: KID,readonly u: UID,}
export type SignupRes = {readonly passphraseOk: boolean,readonly postOk: boolean,readonly writeOk: boolean,readonly paperKey: string,}
export type SimpleFSArchiveAllFilesResult = {readonly tlfPathToJobDesc?: {[key: string]: SimpleFSArchiveJobDesc} | null,readonly tlfPathToError?: {[key: string]: string} | null,readonly skippedTLFPaths?: ReadonlyArray<string> | null,}
export type SimpleFSArchiveAllGitReposResult = {readonly gitRepoToJobDesc?: {[key: string]: SimpleFSArchiveJobDesc} | null,readonly gitRepoToError?: {[key: string]: string} | null,}
export type SimpleFSArchiveCheckArchiveResult = {readonly desc: SimpleFSArchiveJobDesc,readonly currentTLFRevision: KBFSRevision,readonly pathsWithIssues?: {[key: string]: string} | null,}
export type SimpleFSArchiveFile = {readonly state: SimpleFSFileArchiveState,readonly direntType: DirentType,readonly sha256SumHex: string,}
export type SimpleFSArchiveJobDesc = {readonly jobID: string,readonly kbfsPathWithRevision: KBFSArchivedPath,readonly gitRepo?: string | null,readonly overwriteZip: boolean,readonly startTime: Time,readonly stagingPath: string,readonly targetName: string,readonly zipFilePath: string,}
export type SimpleFSArchiveJobErrorState = {readonly error: string,readonly nextRetry: Time,}
export type SimpleFSArchiveJobFreshness = {readonly currentTLFRevision: KBFSRevision,}
export type SimpleFSArchiveJobState = {readonly desc: SimpleFSArchiveJobDesc,readonly manifest?: {[key: string]: SimpleFSArchiveFile} | null,readonly phase: SimpleFSArchiveJobPhase,readonly bytesTotal: number,readonly bytesCopied: number,readonly bytesZipped: number,}
export type SimpleFSArchiveJobStatus = {readonly desc: SimpleFSArchiveJobDesc,readonly phase: SimpleFSArchiveJobPhase,readonly todoCount: number,readonly inProgressCount: number,readonly completeCount: number,readonly skippedCount: number,readonly totalCount: number,readonly bytesTotal: number,readonly bytesCopied: number,readonly bytesZipped: number,readonly error?: SimpleFSArchiveJobErrorState | null,}
export type SimpleFSArchiveState = {readonly jobs?: {[key: string]: SimpleFSArchiveJobState} | null,readonly lastUpdated: Time,}
export type SimpleFSArchiveStatus = {readonly jobs?: ReadonlyArray<SimpleFSArchiveJobStatus> | null,readonly lastUpdated: Time,}
export type SimpleFSIndexProgress = {readonly overallProgress: IndexProgressRecord,readonly currFolder: Folder,readonly currProgress: IndexProgressRecord,readonly foldersLeft?: ReadonlyArray<Folder> | null,}
export type SimpleFSListResult = {readonly entries?: ReadonlyArray<Dirent> | null,readonly progress: Progress,}
export type SimpleFSQuotaUsage = {readonly usageBytes: number,readonly archiveBytes: number,readonly limitBytes: number,readonly gitUsageBytes: number,readonly gitArchiveBytes: number,readonly gitLimitBytes: number,}
export type SimpleFSSearchHit = {readonly path: string,}
export type SimpleFSSearchResults = {readonly hits?: ReadonlyArray<SimpleFSSearchHit> | null,readonly nextResult: number,}
export type SimpleFSStats = {readonly processStats: ProcessRuntimeStats,readonly blockCacheDbStats?: ReadonlyArray<string> | null,readonly syncCacheDbStats?: ReadonlyArray<string> | null,readonly runtimeDbStats?: ReadonlyArray<DbStats> | null,}
export type SizedImage = {readonly path: string,readonly width: number,}
export type SocialAssertion = {readonly user: string,readonly service: SocialAssertionService,}
export type SocialAssertionService = string
export type StartProofResult = {readonly sigID: SigID,}
export type StartStatus = {readonly log: string,}
export type Status = {readonly code: number,readonly name: string,readonly desc: string,readonly fields?: ReadonlyArray<StringKVPair> | null,}
export type StellarAccount = {readonly accountID: string,readonly federationAddress: string,readonly sigID: SigID,readonly hidden: boolean,}
export type Stream = {readonly fd: number,}
export type StringKVPair = {readonly key: string,readonly value: string,}
export type SubteamListEntry = {readonly name: TeamName,readonly teamID: TeamID,readonly memberCount: number,}
export type SubteamListResult = {readonly entries?: ReadonlyArray<SubteamListEntry> | null,}
export type SubteamLogPoint = {readonly name: TeamName,readonly seqno: Seqno,}
export type SyncConfigAndStatusRes = {readonly folders?: ReadonlyArray<FolderSyncConfigAndStatusWithFolder> | null,readonly overallStatus: FolderSyncStatus,}
export type TLF = {readonly id: TLFID,readonly name: string,readonly writers?: ReadonlyArray<string> | null,readonly readers?: ReadonlyArray<string> | null,readonly isPrivate: boolean,}
export type TLFBreak = {readonly breaks?: ReadonlyArray<TLFIdentifyFailure> | null,}
export type TLFID = string
export type TLFIdentifyFailure = {readonly user: User,readonly breaks?: IdentifyTrackBreaks | null,}
export type TLFQuery = {readonly tlfName: string,readonly identifyBehavior: TLFIdentifyBehavior,}
export type TeamAcceptOrRequestResult = {readonly wasToken: boolean,readonly wasSeitan: boolean,readonly wasTeamName: boolean,readonly wasOpenTeam: boolean,}
export type TeamAccessRequest = {readonly uid: UID,readonly eldestSeqno: Seqno,}
export type TeamAddMemberResult = {readonly invited: boolean,readonly user?: User | null,readonly chatSending: boolean,}
export type TeamAddMembersResult = {readonly notAdded?: ReadonlyArray<User> | null,}
export type TeamAndMemberShowcase = {readonly teamShowcase: TeamShowcase,readonly isMemberShowcased: boolean,}
export type TeamApplicationKey = {readonly application: TeamApplication,readonly keyGeneration: PerTeamKeyGeneration,readonly key: Bytes32,}
export type TeamAvatar = {readonly avatarFilename: string,readonly crop?: ImageCropRect | null,}
export type TeamBlock = {readonly teamName: string,readonly createTime: Time,}
export type TeamBotSettings = {readonly cmds: boolean,readonly mentions: boolean,readonly triggers?: ReadonlyArray<string> | null,readonly convs?: ReadonlyArray<string> | null,}
export type TeamCLKRMsg = {readonly teamID: TeamID,readonly generation: PerTeamKeyGeneration,readonly score: number,readonly resetUsersUntrusted?: ReadonlyArray<TeamCLKRResetUser> | null,}
export type TeamCLKRResetUser = {readonly uid: UID,readonly userEldestSeqno: Seqno,readonly memberEldestSeqno: Seqno,}
export type TeamChangeReq = {readonly owners?: ReadonlyArray<UserVersion> | null,readonly admins?: ReadonlyArray<UserVersion> | null,readonly writers?: ReadonlyArray<UserVersion> | null,readonly readers?: ReadonlyArray<UserVersion> | null,readonly bots?: ReadonlyArray<UserVersion> | null,readonly restrictedBots?: {[key: string]: TeamBotSettings} | null,readonly none?: ReadonlyArray<UserVersion> | null,readonly completedInvites?: {[key: string]: UserVersionPercentForm} | null,readonly usedInvites?: ReadonlyArray<TeamUsedInvite> | null,}
export type TeamChangeRow = {readonly id: TeamID,readonly name: string,readonly keyRotated: boolean,readonly membershipChanged: boolean,readonly latestSeqno: Seqno,readonly latestHiddenSeqno: Seqno,readonly latestOffchainSeqno: Seqno,readonly implicitTeam: boolean,readonly misc: boolean,readonly removedResetUsers: boolean,}
export type TeamChangeSet = {readonly membershipChanged: boolean,readonly keyRotated: boolean,readonly renamed: boolean,readonly misc: boolean,}
export type TeamContactSettings = {readonly teamID: TeamID,readonly enabled: boolean,}
export type TeamCreateFancyInfo = {readonly name: string,readonly description: string,readonly joinSubteam: boolean,readonly openSettings: TeamSettings,readonly profileShowcase: boolean,readonly avatar?: TeamAvatar | null,readonly chatChannels?: ReadonlyArray<string> | null,readonly subteams?: ReadonlyArray<string> | null,readonly users?: ReadonlyArray<UserRolePair> | null,readonly emailInviteMessage?: string | null,}
export type TeamCreateResult = {readonly teamID: TeamID,readonly chatSent: boolean,readonly creatorAdded: boolean,}
export type TeamData = {readonly v /* subversion */ : number,readonly frozen: boolean,readonly tombstoned: boolean,readonly secretless: boolean,readonly name: TeamName,readonly chain: TeamSigChainState,readonly perTeamKeySeeds /* perTeamKeySeedsUnverified */ ?: {[key: string]: PerTeamKeySeedItem} | null,readonly readerKeyMasks?: {[key: string]: {[key: string]: MaskB64} | null} | null,readonly latestSeqnoHint: Seqno,readonly cachedAt: Time,readonly tlfCryptKeys?: {[key: string]: ReadonlyArray<CryptKey> | null} | null,}
export type TeamDebugRes = {readonly chain: TeamSigChainState,}
export type TeamDetails = {readonly name: string,readonly members: TeamMembersDetails,readonly keyGeneration: PerTeamKeyGeneration,readonly annotatedActiveInvites?: {[key: string]: AnnotatedTeamInvite} | null,readonly settings: TeamSettings,readonly showcase: TeamShowcase,}
export type TeamEditMembersResult = {readonly failures?: ReadonlyArray<UserRolePair> | null,}
export type TeamEk = {readonly seed: Bytes32,readonly metadata: TeamEkMetadata,}
export type TeamEkBoxMetadata = {readonly box: string,readonly recipientGeneration: EkGeneration,readonly recipientUID: UID,}
export type TeamEkBoxed = {readonly box: string,readonly userEkGeneration: EkGeneration,readonly metadata: TeamEkMetadata,}
export type TeamEkMetadata = {readonly kid: KID,readonly hashMeta: HashMeta,readonly generation: EkGeneration,readonly ctime: Time,}
export type TeamEkStatement = {readonly currentTeamEkMetadata: TeamEkMetadata,}
export type TeamEncryptedKBFSKeyset = {readonly v: number,readonly e: Uint8Array,readonly n: Uint8Array,}
export type TeamEncryptedKBFSKeysetHash = string
export type TeamEphemeralKey ={ keyType: TeamEphemeralKeyType.team, team: TeamEk } | { keyType: TeamEphemeralKeyType.teambot, teambot: TeambotEk }
export type TeamEphemeralKeyBoxed ={ keyType: TeamEphemeralKeyType.team, team: TeamEkBoxed } | { keyType: TeamEphemeralKeyType.teambot, teambot: TeambotEkBoxed }
export type TeamExitRow = {readonly id: TeamID,}
export type TeamGetLegacyTLFUpgrade = {readonly encryptedKeyset: string,readonly teamGeneration: PerTeamKeyGeneration,readonly legacyGeneration: number,readonly appType: TeamApplication,}
export type TeamID = string
export type TeamIDAndName = {readonly id: TeamID,readonly name: TeamName,}
export type TeamIDWithVisibility = {readonly teamID: TeamID,readonly visibility: TLFVisibility,}
export type TeamInvite = {readonly role: TeamRole,readonly id: TeamInviteID,readonly type: TeamInviteType,readonly name: TeamInviteName,readonly inviter: UserVersion,readonly maxUses?: TeamInviteMaxUses | null,readonly etime?: UnixTime | null,}
export type TeamInviteDisplayName = string
export type TeamInviteID = string
export type TeamInviteMaxUses = number
export type TeamInviteMetadata = {readonly invite: TeamInvite,readonly teamSigMeta: TeamSignatureMetadata,readonly status: TeamInviteMetadataStatus,readonly usedInvites?: ReadonlyArray<TeamUsedInviteLogPoint> | null,}
export type TeamInviteMetadataCancel = {readonly teamSigMeta: TeamSignatureMetadata,}
export type TeamInviteMetadataCompleted = {readonly teamSigMeta: TeamSignatureMetadata,}
export type TeamInviteMetadataStatus ={ code: TeamInviteMetadataStatusCode.active } | { code: TeamInviteMetadataStatusCode.obsolete } | { code: TeamInviteMetadataStatusCode.cancelled, cancelled: TeamInviteMetadataCancel } | { code: TeamInviteMetadataStatusCode.completed, completed: TeamInviteMetadataCompleted }
export type TeamInviteName = string
export type TeamInviteSocialNetwork = string
export type TeamInviteType ={ c: TeamInviteCategory.unknown, unknown: string } | { c: TeamInviteCategory.sbs, sbs: TeamInviteSocialNetwork } | { c: TeamInviteCategory.none} | { c: TeamInviteCategory.keybase} | { c: TeamInviteCategory.email} | { c: TeamInviteCategory.seitan} | { c: TeamInviteCategory.phone} | { c: TeamInviteCategory.invitelink}
export type TeamInvitee = {readonly inviteID: TeamInviteID,readonly uid: UID,readonly eldestSeqno: Seqno,readonly role: TeamRole,}
export type TeamJoinRequest = {readonly name: string,readonly username: string,readonly fullName: FullName,readonly ctime: UnixTime,}
export type TeamKBFSKeyRefresher = {readonly generation: number,readonly appType: TeamApplication,}
export type TeamLegacyTLFUpgradeChainInfo = {readonly keysetHash: TeamEncryptedKBFSKeysetHash,readonly teamGeneration: PerTeamKeyGeneration,readonly legacyGeneration: number,readonly appType: TeamApplication,}
export type TeamList = {readonly teams?: ReadonlyArray<MemberInfo> | null,}
export type TeamMember = {readonly uid: UID,readonly role: TeamRole,readonly eldestSeqno: Seqno,readonly status: TeamMemberStatus,readonly botSettings?: TeamBotSettings | null,}
export type TeamMemberDetails = {readonly uv: UserVersion,readonly username: string,readonly fullName: FullName,readonly needsPUK: boolean,readonly status: TeamMemberStatus,readonly joinTime?: Time | null,readonly role: TeamRole,}
export type TeamMemberOutFromReset = {readonly teamID: TeamID,readonly teamName: string,readonly resetUser: TeamResetUser,}
export type TeamMemberOutReset = {readonly teamID: TeamID,readonly teamname: string,readonly username: string,readonly uid: UID,readonly id: Gregor1.MsgID,}
export type TeamMemberRole = {readonly uid: UID,readonly username: string,readonly fullName: FullName,readonly role: TeamRole,}
export type TeamMemberToRemove ={ type: TeamMemberToRemoveType.assertion, assertion: AssertionTeamMemberToRemove } | { type: TeamMemberToRemoveType.inviteid, inviteid: InviteTeamMemberToRemove }
export type TeamMembers = {readonly owners?: ReadonlyArray<UserVersion> | null,readonly admins?: ReadonlyArray<UserVersion> | null,readonly writers?: ReadonlyArray<UserVersion> | null,readonly readers?: ReadonlyArray<UserVersion> | null,readonly bots?: ReadonlyArray<UserVersion> | null,readonly restrictedBots?: ReadonlyArray<UserVersion> | null,}
export type TeamMembersDetails = {readonly owners?: ReadonlyArray<TeamMemberDetails> | null,readonly admins?: ReadonlyArray<TeamMemberDetails> | null,readonly writers?: ReadonlyArray<TeamMemberDetails> | null,readonly readers?: ReadonlyArray<TeamMemberDetails> | null,readonly bots?: ReadonlyArray<TeamMemberDetails> | null,readonly restrictedBots?: ReadonlyArray<TeamMemberDetails> | null,}
export type TeamName = {readonly parts?: ReadonlyArray<TeamNamePart> | null,}
export type TeamNameLogPoint = {readonly lastPart: TeamNamePart,readonly seqno: Seqno,}
export type TeamNamePart = string
export type TeamNewlyAddedRow = {readonly id: TeamID,readonly name: string,}
export type TeamOpenReqMsg = {readonly teamID: TeamID,readonly tars?: ReadonlyArray<TeamAccessRequest> | null,}
export type TeamOpenSweepMsg = {readonly teamID: TeamID,readonly resetUsersUntrusted?: ReadonlyArray<TeamCLKRResetUser> | null,}
export type TeamOperation = {readonly manageMembers: boolean,readonly manageSubteams: boolean,readonly createChannel: boolean,readonly chat: boolean,readonly deleteChannel: boolean,readonly renameChannel: boolean,readonly renameTeam: boolean,readonly editChannelDescription: boolean,readonly editTeamDescription: boolean,readonly setTeamShowcase: boolean,readonly setMemberShowcase: boolean,readonly setRetentionPolicy: boolean,readonly setMinWriterRole: boolean,readonly changeOpenTeam: boolean,readonly leaveTeam: boolean,readonly joinTeam: boolean,readonly setPublicityAny: boolean,readonly listFirst: boolean,readonly changeTarsDisabled: boolean,readonly deleteChatHistory: boolean,readonly deleteOtherEmojis: boolean,readonly deleteOtherMessages: boolean,readonly deleteTeam: boolean,readonly pinMessage: boolean,readonly manageBots: boolean,readonly manageEmojis: boolean,}
export type TeamPlusApplicationKeys = {readonly id: TeamID,readonly name: string,readonly implicit: boolean,readonly public: boolean,readonly application: TeamApplication,readonly writers?: ReadonlyArray<UserVersion> | null,readonly onlyReaders?: ReadonlyArray<UserVersion> | null,readonly onlyRestrictedBots?: ReadonlyArray<UserVersion> | null,readonly applicationKeys?: ReadonlyArray<TeamApplicationKey> | null,}
export type TeamProfileAddEntry = {readonly teamID: TeamID,readonly teamName: TeamName,readonly open: boolean,readonly disabledReason: string,}
export type TeamRefreshers = {readonly needKeyGeneration: PerTeamKeyGeneration,readonly needApplicationsAtGenerations?: {[key: string]: ReadonlyArray<TeamApplication> | null} | null,readonly needApplicationsAtGenerationsWithKBFS?: {[key: string]: ReadonlyArray<TeamApplication> | null} | null,readonly wantMembers?: ReadonlyArray<UserVersion> | null,readonly wantMembersRole: TeamRole,readonly needKBFSKeyGeneration: TeamKBFSKeyRefresher,}
export type TeamRemoveMembersResult = {readonly failures?: ReadonlyArray<RemoveTeamMemberFailure> | null,}
export type TeamRequestAccessResult = {readonly open: boolean,}
export type TeamResetUser = {readonly username: string,readonly uid: UID,readonly eldestSeqno: Seqno,readonly isDelete: boolean,}
export type TeamRoleMapAndVersion = {readonly teams?: {[key: string]: TeamRolePair} | null,readonly version: UserTeamVersion,}
export type TeamRoleMapStored = {readonly data: TeamRoleMapAndVersion,readonly cachedAt: Time,}
export type TeamRolePair = {readonly role: TeamRole,readonly implicitRole: TeamRole,}
export type TeamSBSMsg = {readonly teamID: TeamID,readonly score: number,readonly invitees?: ReadonlyArray<TeamInvitee> | null,}
export type TeamSearchExport = {readonly items?: {[key: string]: TeamSearchItem} | null,readonly suggested?: ReadonlyArray<TeamID> | null,}
export type TeamSearchItem = {readonly id: TeamID,readonly name: string,readonly description?: string | null,readonly memberCount: number,readonly lastActive: Time,readonly isDemoted: boolean,readonly inTeam: boolean,}
export type TeamSearchRes = {readonly results?: ReadonlyArray<TeamSearchItem> | null,}
export type TeamSeitanMsg = {readonly teamID: TeamID,readonly seitans?: ReadonlyArray<TeamSeitanRequest> | null,}
export type TeamSeitanRequest = {readonly inviteID: TeamInviteID,readonly uid: UID,readonly eldestSeqno: Seqno,readonly akey: SeitanAKey,readonly role: TeamRole,readonly unixCTime: number,}
export type TeamSettings = {readonly open: boolean,readonly joinAs: TeamRole,}
export type TeamShowcase = {readonly isShowcased: boolean,readonly description?: string | null,readonly setByUID?: UID | null,readonly anyMemberShowcase: boolean,}
export type TeamSigChainState = {readonly reader: UserVersion,readonly id: TeamID,readonly implicit: boolean,readonly public: boolean,readonly rootAncestor: TeamName,readonly nameDepth: number,readonly nameLog?: ReadonlyArray<TeamNameLogPoint> | null,readonly lastSeqno: Seqno,readonly lastLinkID: LinkID,readonly lastHighSeqno: Seqno,readonly lastHighLinkID: LinkID,readonly parentID?: TeamID | null,readonly userLog?: {[key: string]: ReadonlyArray<UserLogPoint> | null} | null,readonly subteamLog?: {[key: string]: ReadonlyArray<SubteamLogPoint> | null} | null,readonly perTeamKeys?: {[key: string]: PerTeamKey} | null,readonly maxPerTeamKeyGeneration: PerTeamKeyGeneration,readonly perTeamKeyCTime: UnixTime,readonly linkIDs?: {[key: string]: LinkID} | null,readonly stubbedLinks?: {[key: string]: boolean} | null,readonly inviteMetadatas?: {[key: string]: TeamInviteMetadata} | null,readonly open: boolean,readonly openTeamJoinAs: TeamRole,readonly bots?: {[key: string]: TeamBotSettings} | null,readonly tlfIDs?: ReadonlyArray<TLFID> | null,readonly tlfLegacyUpgrade?: {[key: string]: TeamLegacyTLFUpgradeChainInfo} | null,readonly headMerkle?: MerkleRootV2 | null,readonly merkleRoots?: {[key: string]: MerkleRootV2} | null,}
export type TeamSignatureMetadata = {readonly sigMeta: SignatureMetadata,readonly uv: UserVersion,}
export type TeamTreeEntry = {readonly name: TeamName,readonly admin: boolean,}
export type TeamTreeError = {readonly message: string,readonly willSkipSubtree: boolean,readonly willSkipAncestors: boolean,}
export type TeamTreeInitial = {readonly guid: number,}
export type TeamTreeMembership = {readonly teamName: string,readonly result: TeamTreeMembershipResult,readonly targetTeamID: TeamID,readonly targetUsername: string,readonly guid: number,}
export type TeamTreeMembershipResult ={ s: TeamTreeMembershipStatus.ok, ok: TeamTreeMembershipValue } | { s: TeamTreeMembershipStatus.error, error: TeamTreeError } | { s: TeamTreeMembershipStatus.hidden }
export type TeamTreeMembershipValue = {readonly role: TeamRole,readonly joinTime?: Time | null,readonly teamID: TeamID,}
export type TeamTreeMembershipsDoneResult = {readonly expectedCount: number,readonly targetTeamID: TeamID,readonly targetUsername: string,readonly guid: number,}
export type TeamTreeResult = {readonly entries?: ReadonlyArray<TeamTreeEntry> | null,}
export type TeamUsedInvite = {readonly inviteID: TeamInviteID,readonly uv: UserVersionPercentForm,}
export type TeamUsedInviteLogPoint = {readonly uv: UserVersion,readonly logPoint: number,}
export type TeambotEk = {readonly seed: Bytes32,readonly metadata: TeambotEkMetadata,}
export type TeambotEkBoxed = {readonly box: string,readonly metadata: TeambotEkMetadata,}
export type TeambotEkMetadata = {readonly kid: KID,readonly generation: EkGeneration,readonly uid: UID,readonly userEkGeneration: EkGeneration,readonly hashMeta: HashMeta,readonly ctime: Time,}
export type TeambotKey = {readonly seed: Bytes32,readonly metadata: TeambotKeyMetadata,}
export type TeambotKeyBoxed = {readonly box: string,readonly metadata: TeambotKeyMetadata,}
export type TeambotKeyGeneration = number
export type TeambotKeyMetadata = {readonly kid: KID,readonly generation: TeambotKeyGeneration,readonly uid: UID,readonly pukGeneration: PerUserKeyGeneration,readonly application: TeamApplication,}
export type Test = {readonly reply: string,}
export type Text = {readonly data: string,readonly markup: boolean,}
export type Time = number
export type TrackDiff = {readonly type: TrackDiffType,readonly displayMarkup: string,}
export type TrackOptions = {readonly localOnly: boolean,readonly bypassConfirm: boolean,readonly forceRetrack: boolean,readonly expiringLocal: boolean,readonly forPGPPull: boolean,readonly sigVersion?: SigVersion | null,}
export type TrackProof = {readonly proofType: string,readonly proofName: string,readonly idString: string,}
export type TrackSummary = {readonly username: string,readonly time: Time,readonly isRemote: boolean,}
export type TrackToken = string
export type UID = string
export type UPAKVersioned ={ v: UPAKVersion.v1, v1: UserPlusAllKeys } | { v: UPAKVersion.v2, v2: UserPlusKeysV2AllIncarnations }
export type UPKLiteV1 = {readonly uid: UID,readonly username: string,readonly eldestSeqno: Seqno,readonly status: StatusCode,readonly deviceKeys?: {[key: string]: PublicKeyV2NaCl} | null,readonly reset?: ResetSummary | null,}
export type UPKLiteV1AllIncarnations = {readonly current: UPKLiteV1,readonly pastIncarnations?: ReadonlyArray<UPKLiteV1> | null,readonly seqnoLinkIDs?: {[key: string]: LinkID} | null,readonly minorVersion: UPKLiteMinorVersion,}
export type UnboxAnyRes = {readonly kid: KID,readonly plaintext: Bytes32,readonly index: number,}
export type UninstallResult = {readonly componentResults?: ReadonlyArray<ComponentResult> | null,readonly status: Status,}
export type UnixTime = number
export type UntrustedTeamExistsResult = {readonly exists: boolean,readonly status: StatusCode,}
export type UntrustedTeamInfo = {readonly name: TeamName,readonly inTeam: boolean,readonly open: boolean,readonly description: string,readonly publicAdmins?: ReadonlyArray<string> | null,readonly numMembers: number,readonly publicMembers?: ReadonlyArray<TeamMemberRole> | null,}
export type UpPointer = {readonly ourSeqno: Seqno,readonly parentID: TeamID,readonly parentSeqno: Seqno,readonly deletion: boolean,}
export type UpdateDetails = {readonly message: string,}
export type UpdateInfo = {readonly status: UpdateInfoStatus,readonly message: string,}
export type UpdateInfo2 ={ status: UpdateInfoStatus2.ok } | { status: UpdateInfoStatus2.suggested, suggested: UpdateDetails } | { status: UpdateInfoStatus2.critical, critical: UpdateDetails }
export type UpdaterStatus = {readonly log: string,}
export type UploadState = {readonly uploadID: string,readonly targetPath: KBFSPath,readonly error?: string | null,readonly canceled: boolean,}
export type UsageStat = {readonly bytes: UsageStatRecord,readonly blocks: UsageStatRecord,readonly mtime: Time,}
export type UsageStatRecord = {readonly write: number,readonly archive: number,readonly read: number,readonly mdWrite: number,readonly gitWrite: number,readonly gitArchive: number,}
export type User = {readonly uid: UID,readonly username: string,}
export type UserBlock = {readonly username: string,readonly chatBlocked: boolean,readonly followBlocked: boolean,readonly createTime?: Time | null,readonly modifyTime?: Time | null,}
export type UserBlockArg = {readonly username: string,readonly setChatBlock?: boolean | null,readonly setFollowBlock?: boolean | null,}
export type UserBlockState = {readonly blockType: UserBlockType,readonly blocked: boolean,}
export type UserBlockedBody = {readonly blocks?: ReadonlyArray<UserBlockedRow> | null,readonly uid: UID,readonly username: string,}
export type UserBlockedRow = {readonly uid: UID,readonly username: string,readonly chat?: boolean | null,readonly follow?: boolean | null,}
export type UserBlockedSummary = {readonly blocker: string,readonly blocks?: {[key: string]: ReadonlyArray<UserBlockState> | null} | null,}
export type UserCard = {readonly unverifiedNumFollowing: number,readonly unverifiedNumFollowers: number,readonly uid: UID,readonly fullName: string,readonly location: string,readonly bio: string,readonly bioDecorated: string,readonly website: string,readonly twitter: string,readonly teamShowcase?: ReadonlyArray<UserTeamShowcase> | null,readonly registeredForAirdrop: boolean,readonly stellarHidden: boolean,readonly blocked: boolean,readonly hidFromFollowers: boolean,}
export type UserEk = {readonly seed: Bytes32,readonly metadata: UserEkMetadata,}
export type UserEkBoxMetadata = {readonly box: string,readonly recipientGeneration: EkGeneration,readonly recipientDeviceID: DeviceID,}
export type UserEkBoxed = {readonly box: string,readonly deviceEkGeneration: EkGeneration,readonly metadata: UserEkMetadata,}
export type UserEkMetadata = {readonly kid: KID,readonly hashMeta: HashMeta,readonly generation: EkGeneration,readonly ctime: Time,}
export type UserEkReboxArg = {readonly userEkBoxMetadata: UserEkBoxMetadata,readonly deviceID: DeviceID,readonly deviceEkStatementSig: string,}
export type UserEkStatement = {readonly currentUserEkMetadata: UserEkMetadata,}
export type UserLogPoint = {readonly role: TeamRole,readonly sigMeta: SignatureMetadata,}
export type UserOrTeamID = string
export type UserOrTeamLite = {readonly id: UserOrTeamID,readonly name: string,}
export type UserPassphraseStateMsg = {readonly passphraseState: PassphraseState,}
export type UserPhoneNumber = {readonly phoneNumber: PhoneNumber,readonly verified: boolean,readonly superseded: boolean,readonly visibility: IdentityVisibility,readonly ctime: UnixTime,}
export type UserPlusAllKeys = {readonly base: UserPlusKeys,readonly pgpKeys?: ReadonlyArray<PublicKey> | null,readonly remoteTracks?: ReadonlyArray<RemoteTrack> | null,}
export type UserPlusKeys = {readonly uid: UID,readonly username: string,readonly eldestSeqno: Seqno,readonly status: StatusCode,readonly deviceKeys?: ReadonlyArray<PublicKey> | null,readonly revokedDeviceKeys?: ReadonlyArray<RevokedKey> | null,readonly pgpKeyCount: number,readonly uvv: UserVersionVector,readonly deletedDeviceKeys?: ReadonlyArray<PublicKey> | null,readonly perUserKeys?: ReadonlyArray<PerUserKey> | null,readonly resets?: ReadonlyArray<ResetSummary> | null,}
export type UserPlusKeysV2 = {readonly uid: UID,readonly username: string,readonly eldestSeqno: Seqno,readonly status: StatusCode,readonly perUserKeys?: ReadonlyArray<PerUserKey> | null,readonly deviceKeys?: {[key: string]: PublicKeyV2NaCl} | null,readonly pgpKeys?: {[key: string]: PublicKeyV2PGPSummary} | null,readonly stellarAccountID?: string | null,readonly remoteTracks?: {[key: string]: RemoteTrack} | null,readonly reset?: ResetSummary | null,readonly unstubbed: boolean,}
export type UserPlusKeysV2AllIncarnations = {readonly current: UserPlusKeysV2,readonly pastIncarnations?: ReadonlyArray<UserPlusKeysV2> | null,readonly uvv: UserVersionVector,readonly seqnoLinkIDs?: {[key: string]: LinkID} | null,readonly minorVersion: UPK2MinorVersion,readonly stale: boolean,}
export type UserReacji = {readonly name: string,readonly customAddr?: string | null,readonly customAddrNoAnim?: string | null,}
export type UserReacjis = {readonly topReacjis?: ReadonlyArray<UserReacji> | null,readonly skinTone: ReacjiSkinTone,}
export type UserRolePair = {readonly assertion: string,readonly role: TeamRole,readonly botSettings?: TeamBotSettings | null,}
export type UserSettings = {readonly emails?: ReadonlyArray<Email> | null,readonly phoneNumbers?: ReadonlyArray<UserPhoneNumber> | null,}
export type UserSummary = {readonly uid: UID,readonly username: string,readonly fullName: string,readonly linkID?: LinkID | null,}
export type UserSummarySet = {readonly users?: ReadonlyArray<UserSummary> | null,readonly time: Time,readonly version: number,}
export type UserTeamShowcase = {readonly fqName: string,readonly open: boolean,readonly teamIsShowcased: boolean,readonly description: string,readonly role: TeamRole,readonly publicAdmins?: ReadonlyArray<string> | null,readonly numMembers: number,}
export type UserTeamVersion = number
export type UserTeamVersionUpdate = {readonly version: UserTeamVersion,}
export type UserVersion = {readonly uid: UID,readonly eldestSeqno: Seqno,}
export type UserVersionPercentForm = string
export type UserVersionVector = {readonly id: number,readonly sigHints: number,readonly sigChain: number,readonly cachedAt: Time,}
export type UsernameVerificationType = string
export type VID = string
export type VerifyAllEmailTodoExt = {readonly lastVerifyEmailDate: UnixTime,}
export type VerifySessionRes = {readonly uid: UID,readonly sid: string,readonly generated: number,readonly lifetime: number,}
export type WalletAccountInfo = {readonly accountID: string,readonly numUnread: number,}
export type WebProof = {readonly hostname: string,readonly protocols?: ReadonlyArray<string> | null,}
export type WotProof = {readonly proofType: ProofType,readonly name: string,readonly username: string,readonly protocol: string,readonly hostname: string,readonly domain: string,}
export type WotProofUI = {readonly type: string,readonly value: string,readonly siteIcon?: ReadonlyArray<SizedImage> | null,readonly siteIconDarkmode?: ReadonlyArray<SizedImage> | null,}
export type WotUpdate = {readonly voucher: string,readonly vouchee: string,readonly status: WotStatusType,}
export type WotVouch = {readonly status: WotStatusType,readonly vouchProof: SigID,readonly vouchee: UserVersion,readonly voucheeUsername: string,readonly voucher: UserVersion,readonly voucherUsername: string,readonly vouchText: string,readonly vouchedAt: Time,readonly confidence: Confidence,readonly proofs?: ReadonlyArray<WotProofUI> | null,}
export type WriteArgs = {readonly opID: OpID,readonly path: Path,readonly offset: number,}

type IncomingMethod = 'keybase.1.NotifyAudit.boxAuditError' | 'keybase.1.NotifyAudit.rootAuditError' | 'keybase.1.NotifyBadges.badgeState' | 'keybase.1.NotifyFS.FSActivity' | 'keybase.1.NotifySession.loggedOut' | 'keybase.1.NotifyTracking.trackingChanged' | 'keybase.1.NotifyUsers.userChanged' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.pgpUi.finished' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.provisionUi.DisplaySecretExchanged' | 'keybase.1.provisionUi.ProvisioneeSuccess' | 'keybase.1.provisionUi.ProvisionerSuccess' | 'keybase.1.reachability.reachabilityChanged' | 'keybase.1.rekeyUI.refresh' | 'keybase.1.rekeyUI.rekeySendEvent'
export type IncomingCallMapType = Partial<{[M in IncomingMethod]: (params: RpcIn<M>) => void}>

type CustomIncomingMethod = 'keybase.1.NotifyApp.exit' | 'keybase.1.NotifyEmailAddress.emailAddressVerified' | 'keybase.1.NotifyEmailAddress.emailsChanged' | 'keybase.1.NotifyFS.FSOverallSyncStatusChanged' | 'keybase.1.NotifyFS.FSSubscriptionNotify' | 'keybase.1.NotifyFS.FSSubscriptionNotifyPath' | 'keybase.1.NotifyFeaturedBots.featuredBotsUpdate' | 'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile' | 'keybase.1.NotifyPhoneNumber.phoneNumbersChanged' | 'keybase.1.NotifyRuntimeStats.runtimeStatsUpdate' | 'keybase.1.NotifyService.HTTPSrvInfoUpdate' | 'keybase.1.NotifyService.handleKeybaseLink' | 'keybase.1.NotifyService.shutdown' | 'keybase.1.NotifySession.clientOutOfDate' | 'keybase.1.NotifySession.loggedIn' | 'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged' | 'keybase.1.NotifyTeam.avatarUpdated' | 'keybase.1.NotifyTeam.teamChangedByID' | 'keybase.1.NotifyTeam.teamDeleted' | 'keybase.1.NotifyTeam.teamExit' | 'keybase.1.NotifyTeam.teamMetadataUpdate' | 'keybase.1.NotifyTeam.teamRoleMapChanged' | 'keybase.1.NotifyTeam.teamTreeMembershipsDone' | 'keybase.1.NotifyTeam.teamTreeMembershipsPartial' | 'keybase.1.NotifyTracking.notifyUserBlocked' | 'keybase.1.NotifyTracking.trackingInfo' | 'keybase.1.NotifyUsers.identifyUpdate' | 'keybase.1.NotifyUsers.passwordChanged' | 'keybase.1.gpgUi.selectKey' | 'keybase.1.gpgUi.wantToAddGPGKey' | 'keybase.1.gregorUI.pushState' | 'keybase.1.homeUI.homeUIRefresh' | 'keybase.1.identify3Ui.identify3Result' | 'keybase.1.identify3Ui.identify3ShowTracker' | 'keybase.1.identify3Ui.identify3Summary' | 'keybase.1.identify3Ui.identify3UpdateRow' | 'keybase.1.identify3Ui.identify3UpdateUserCard' | 'keybase.1.identify3Ui.identify3UserReset' | 'keybase.1.logUi.log' | 'keybase.1.loginUi.chooseDeviceToRecoverWith' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.loginUi.getEmailOrUsername' | 'keybase.1.loginUi.promptPassphraseRecovery' | 'keybase.1.loginUi.promptResetAccount' | 'keybase.1.loginUi.promptRevokePaperKeys' | 'keybase.1.logsend.prepareLogsend' | 'keybase.1.pgpUi.finished' | 'keybase.1.pgpUi.keyGenerated' | 'keybase.1.pgpUi.shouldPushPrivate' | 'keybase.1.proveUi.checking' | 'keybase.1.proveUi.continueChecking' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.okToCheck' | 'keybase.1.proveUi.outputInstructions' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.proveUi.preProofWarning' | 'keybase.1.proveUi.promptOverwrite' | 'keybase.1.proveUi.promptUsername' | 'keybase.1.provisionUi.DisplayAndPromptSecret' | 'keybase.1.provisionUi.DisplaySecretExchanged' | 'keybase.1.provisionUi.PromptNewDeviceName' | 'keybase.1.provisionUi.ProvisioneeSuccess' | 'keybase.1.provisionUi.ProvisionerSuccess' | 'keybase.1.provisionUi.chooseDevice' | 'keybase.1.provisionUi.chooseDeviceType' | 'keybase.1.provisionUi.chooseGPGMethod' | 'keybase.1.provisionUi.switchToGPGSignOK' | 'keybase.1.rekeyUI.delegateRekeyUI' | 'keybase.1.rekeyUI.refresh' | 'keybase.1.rekeyUI.rekeySendEvent' | 'keybase.1.secretUi.getPassphrase' | 'keybase.1.teamsUi.confirmInviteLinkAccept' | 'keybase.1.teamsUi.confirmRootTeamDelete' | 'keybase.1.teamsUi.confirmSubteamDelete'
export type CustomResponseIncomingCallMap = Partial<{[M in CustomIncomingMethod]: (params: RpcIn<M>, response: RpcResponse<M>) => void}>
export const SimpleFSSimpleFSArchiveAllFilesRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSArchiveAllFiles')
export const SimpleFSSimpleFSArchiveAllGitReposRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSArchiveAllGitRepos')
export const SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob')
export const SimpleFSSimpleFSArchiveStartRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSArchiveStart')
export const SimpleFSSimpleFSCancelDownloadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSCancelDownload')
export const SimpleFSSimpleFSCheckReachabilityRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSCheckReachability')
export const SimpleFSSimpleFSClearConflictStateRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSClearConflictState')
export const SimpleFSSimpleFSConfigureDownloadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSConfigureDownload')
export const SimpleFSSimpleFSCopyRecursiveRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSCopyRecursive')
export const SimpleFSSimpleFSDismissDownloadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSDismissDownload')
export const SimpleFSSimpleFSDismissUploadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSDismissUpload')
export const SimpleFSSimpleFSFinishResolvingConflictRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSFinishResolvingConflict')
export const SimpleFSSimpleFSFolderSyncConfigAndStatusRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSFolderSyncConfigAndStatus')
export const SimpleFSSimpleFSGetArchiveJobFreshnessRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetArchiveJobFreshness')
export const SimpleFSSimpleFSGetArchiveStatusRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetArchiveStatus')
export const SimpleFSSimpleFSGetDownloadInfoRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetDownloadInfo')
export const SimpleFSSimpleFSGetDownloadStatusRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetDownloadStatus')
export const SimpleFSSimpleFSGetFilesTabBadgeRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetFilesTabBadge')
export const SimpleFSSimpleFSGetFolderRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetFolder')
export const SimpleFSSimpleFSGetGUIFileContextRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetGUIFileContext')
export const SimpleFSSimpleFSGetOnlineStatusRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetOnlineStatus')
export const SimpleFSSimpleFSGetUploadStatusRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSGetUploadStatus')
export const SimpleFSSimpleFSListFavoritesRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSListFavorites')
export const SimpleFSSimpleFSListRecursiveToDepthRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSListRecursiveToDepth')
export const SimpleFSSimpleFSListRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSList')
export const SimpleFSSimpleFSMakeTempDirForUploadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSMakeTempDirForUpload')
export const SimpleFSSimpleFSMoveRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSMove')
export const SimpleFSSimpleFSOpenRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSOpen')
export const SimpleFSSimpleFSReadListRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSReadList')
export const SimpleFSSimpleFSRemoveRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSRemove')
export const SimpleFSSimpleFSSetDebugLevelRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSetDebugLevel')
export const SimpleFSSimpleFSSetFolderSyncConfigRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSetFolderSyncConfig')
export const SimpleFSSimpleFSSetNotificationThresholdRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSetNotificationThreshold')
export const SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed')
export const SimpleFSSimpleFSSetSyncOnCellularRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSetSyncOnCellular')
export const SimpleFSSimpleFSSettingsRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSettings')
export const SimpleFSSimpleFSStartDownloadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSStartDownload')
export const SimpleFSSimpleFSStartUploadRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSStartUpload')
export const SimpleFSSimpleFSStatRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSStat')
export const SimpleFSSimpleFSSubscribeNonPathRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSubscribeNonPath')
export const SimpleFSSimpleFSSubscribePathRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSubscribePath')
export const SimpleFSSimpleFSSyncStatusRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSSyncStatus')
export const SimpleFSSimpleFSUnsubscribeRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSUnsubscribe')
export const SimpleFSSimpleFSUserEditHistoryRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSUserEditHistory')
export const SimpleFSSimpleFSUserInRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSUserIn')
export const SimpleFSSimpleFSUserOutRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSUserOut')
export const SimpleFSSimpleFSWaitRpcPromise = createRpc('keybase.1.SimpleFS.simpleFSWait')
export const accountCancelResetRpcPromise = createRpc('keybase.1.account.cancelReset')
export const accountEnterResetPipelineRpcListener = createListener('keybase.1.account.enterResetPipeline')
export const accountGetLockdownModeRpcPromise = createRpc('keybase.1.account.getLockdownMode')
export const accountGuessCurrentLocationRpcPromise = createRpc('keybase.1.account.guessCurrentLocation')
export const accountHasServerKeysRpcPromise = createRpc('keybase.1.account.hasServerKeys')
export const accountPassphraseChangeRpcPromise = createRpc('keybase.1.account.passphraseChange')
export const accountPassphraseCheckRpcPromise = createRpc('keybase.1.account.passphraseCheck')
export const accountRecoverUsernameWithEmailRpcPromise = createRpc('keybase.1.account.recoverUsernameWithEmail')
export const accountRecoverUsernameWithPhoneRpcPromise = createRpc('keybase.1.account.recoverUsernameWithPhone')
export const accountSetLockdownModeRpcPromise = createRpc('keybase.1.account.setLockdownMode')
export const accountUserGetContactSettingsRpcPromise = createRpc('keybase.1.account.userGetContactSettings')
export const accountUserSetContactSettingsRpcPromise = createRpc('keybase.1.account.userSetContactSettings')
export const apiserverDeleteRpcPromise = createRpc('keybase.1.apiserver.Delete')
export const apiserverGetWithSessionRpcPromise = createRpc('keybase.1.apiserver.GetWithSession')
export const apiserverPostJSONRpcPromise = createRpc('keybase.1.apiserver.PostJSON')
export const apiserverPostRpcPromise = createRpc('keybase.1.apiserver.Post')
export const appStatePowerMonitorEventRpcPromise = createRpc('keybase.1.appState.powerMonitorEvent')
export const appStateUpdateMobileNetStateRpcPromise = createRpc('keybase.1.appState.updateMobileNetState')
export const configAppendGUILogsRpcPromise = createRpc('keybase.1.config.appendGUILogs')
export const configGenerateWebAuthTokenRpcPromise = createRpc('keybase.1.config.generateWebAuthToken')
export const configGetBootstrapStatusRpcPromise = createRpc('keybase.1.config.getBootstrapStatus')
export const configGetProxyDataRpcPromise = createRpc('keybase.1.config.getProxyData')
export const configGetRememberPassphraseRpcPromise = createRpc('keybase.1.config.getRememberPassphrase')
export const configGetUpdateInfo2RpcPromise = createRpc('keybase.1.config.getUpdateInfo2')
export const configGetUpdateInfoRpcPromise = createRpc('keybase.1.config.getUpdateInfo')
export const configGuiGetValueRpcPromise = createRpc('keybase.1.config.guiGetValue')
export const configGuiSetValueRpcPromise = createRpc('keybase.1.config.guiSetValue')
export const configHelloIAmRpcPromise = createRpc('keybase.1.config.helloIAm')
export const configLogSendRpcPromise = createRpc('keybase.1.config.logSend')
export const configRequestFollowingAndUnverifiedFollowersRpcPromise = createRpc('keybase.1.config.requestFollowingAndUnverifiedFollowers')
export const configSetProxyDataRpcPromise = createRpc('keybase.1.config.setProxyData')
export const configSetRememberPassphraseRpcPromise = createRpc('keybase.1.config.setRememberPassphrase')
export const configStartUpdateIfNeededRpcPromise = createRpc('keybase.1.config.startUpdateIfNeeded')
export const configToggleRuntimeStatsRpcPromise = createRpc('keybase.1.config.toggleRuntimeStats')
export const configUpdateLastLoggedInAndServerConfigRpcPromise = createRpc('keybase.1.config.updateLastLoggedInAndServerConfig')
export const configWaitForClientRpcPromise = createRpc('keybase.1.config.waitForClient')
export const contactsGetContactsForUserRecommendationsRpcPromise = createRpc('keybase.1.contacts.getContactsForUserRecommendations')
export const contactsSaveContactListRpcPromise = createRpc('keybase.1.contacts.saveContactList')
export const cryptocurrencyRegisterAddressRpcPromise = createRpc('keybase.1.cryptocurrency.registerAddress')
export const ctlDbNukeRpcPromise = createRpc('keybase.1.ctl.dbNuke')
export const ctlGetOnLoginStartupRpcPromise = createRpc('keybase.1.ctl.getOnLoginStartup')
export const ctlSetOnLoginStartupRpcPromise = createRpc('keybase.1.ctl.setOnLoginStartup')
export const ctlStopRpcPromise = createRpc('keybase.1.ctl.stop')
export const delegateUiCtlRegisterChatUIRpcPromise = createRpc('keybase.1.delegateUiCtl.registerChatUI')
export const delegateUiCtlRegisterGregorFirehoseFilteredRpcPromise = createRpc('keybase.1.delegateUiCtl.registerGregorFirehoseFiltered')
export const delegateUiCtlRegisterHomeUIRpcPromise = createRpc('keybase.1.delegateUiCtl.registerHomeUI')
export const delegateUiCtlRegisterIdentify3UIRpcPromise = createRpc('keybase.1.delegateUiCtl.registerIdentify3UI')
export const delegateUiCtlRegisterLogUIRpcPromise = createRpc('keybase.1.delegateUiCtl.registerLogUI')
export const delegateUiCtlRegisterRekeyUIRpcPromise = createRpc('keybase.1.delegateUiCtl.registerRekeyUI')
export const delegateUiCtlRegisterSecretUIRpcPromise = createRpc('keybase.1.delegateUiCtl.registerSecretUI')
export const deviceCheckDeviceNameFormatRpcPromise = createRpc('keybase.1.device.checkDeviceNameFormat')
export const deviceDeviceAddRpcListener = createListener('keybase.1.device.deviceAdd')
export const deviceDeviceHistoryListRpcPromise = createRpc('keybase.1.device.deviceHistoryList')
export const deviceDismissDeviceChangeNotificationsRpcPromise = createRpc('keybase.1.device.dismissDeviceChangeNotifications')
export const emailsAddEmailRpcPromise = createRpc('keybase.1.emails.addEmail')
export const emailsDeleteEmailRpcPromise = createRpc('keybase.1.emails.deleteEmail')
export const emailsSendVerificationEmailRpcPromise = createRpc('keybase.1.emails.sendVerificationEmail')
export const emailsSetPrimaryEmailRpcPromise = createRpc('keybase.1.emails.setPrimaryEmail')
export const emailsSetVisibilityEmailRpcPromise = createRpc('keybase.1.emails.setVisibilityEmail')
export const favoriteFavoriteIgnoreRpcPromise = createRpc('keybase.1.favorite.favoriteIgnore')
export const featuredBotFeaturedBotsRpcPromise = createRpc('keybase.1.featuredBot.featuredBots')
export const featuredBotSearchRpcPromise = createRpc('keybase.1.featuredBot.search')
export const gitCreatePersonalRepoRpcPromise = createRpc('keybase.1.git.createPersonalRepo')
export const gitCreateTeamRepoRpcPromise = createRpc('keybase.1.git.createTeamRepo')
export const gitDeletePersonalRepoRpcPromise = createRpc('keybase.1.git.deletePersonalRepo')
export const gitDeleteTeamRepoRpcPromise = createRpc('keybase.1.git.deleteTeamRepo')
export const gitGetAllGitMetadataRpcPromise = createRpc('keybase.1.git.getAllGitMetadata')
export const gitSetTeamRepoSettingsRpcPromise = createRpc('keybase.1.git.setTeamRepoSettings')
export const gregorDismissCategoryRpcPromise = createRpc('keybase.1.gregor.dismissCategory')
export const gregorGetStateRpcPromise = createRpc('keybase.1.gregor.getState')
export const gregorUpdateCategoryRpcPromise = createRpc('keybase.1.gregor.updateCategory')
export const homeHomeDismissAnnouncementRpcPromise = createRpc('keybase.1.home.homeDismissAnnouncement')
export const homeHomeGetScreenRpcPromise = createRpc('keybase.1.home.homeGetScreen')
export const homeHomeMarkViewedRpcPromise = createRpc('keybase.1.home.homeMarkViewed')
export const homeHomeSkipTodoTypeRpcPromise = createRpc('keybase.1.home.homeSkipTodoType')
export const identify3Identify3FollowUserRpcPromise = createRpc('keybase.1.identify3.identify3FollowUser')
export const identify3Identify3IgnoreUserRpcPromise = createRpc('keybase.1.identify3.identify3IgnoreUser')
export const identify3Identify3RpcListener = createListener('keybase.1.identify3.identify3')
export const incomingShareGetIncomingShareItemsRpcPromise = createRpc('keybase.1.incomingShare.getIncomingShareItems')
export const incomingShareGetPreferenceRpcPromise = createRpc('keybase.1.incomingShare.getPreference')
export const incomingShareSetPreferenceRpcPromise = createRpc('keybase.1.incomingShare.setPreference')
export const installFuseStatusRpcPromise = createRpc('keybase.1.install.fuseStatus')
export const installInstallFuseRpcPromise = createRpc('keybase.1.install.installFuse')
export const installInstallKBFSRpcPromise = createRpc('keybase.1.install.installKBFS')
export const installUninstallKBFSRpcPromise = createRpc('keybase.1.install.uninstallKBFS')
export const kbfsMountGetCurrentMountDirRpcPromise = createRpc('keybase.1.kbfsMount.GetCurrentMountDir')
export const kbfsMountGetKBFSPathInfoRpcPromise = createRpc('keybase.1.kbfsMount.GetKBFSPathInfo')
export const kbfsMountGetPreferredMountDirsRpcPromise = createRpc('keybase.1.kbfsMount.GetPreferredMountDirs')
export const kbfsMountWaitForMountsRpcPromise = createRpc('keybase.1.kbfsMount.WaitForMounts')
export const logPerfLogPointRpcPromise = createRpc('keybase.1.log.perfLogPoint')
export const loginAccountDeleteRpcPromise = createRpc('keybase.1.login.accountDelete')
export const loginDeprovisionRpcPromise = createRpc('keybase.1.login.deprovision')
export const loginGetConfiguredAccountsRpcPromise = createRpc('keybase.1.login.getConfiguredAccounts')
export const loginIsOnlineRpcPromise = createRpc('keybase.1.login.isOnline')
export const loginLoginRpcListener = createListener('keybase.1.login.login')
export const loginLogoutRpcPromise = createRpc('keybase.1.login.logout')
export const loginPaperKeyRpcListener = createListener('keybase.1.login.paperKey')
export const loginPaperKeySubmitRpcPromise = createRpc('keybase.1.login.paperKeySubmit')
export const loginRecoverPassphraseRpcListener = createListener('keybase.1.login.recoverPassphrase')
export const notifyCtlSetNotificationsRpcPromise = createRpc('keybase.1.notifyCtl.setNotifications')
export const pgpPgpKeyGenDefaultRpcListener = createListener('keybase.1.pgp.pgpKeyGenDefault')
export const pgpPgpStorageDismissRpcPromise = createRpc('keybase.1.pgp.pgpStorageDismiss')
export const phoneNumbersAddPhoneNumberRpcPromise = createRpc('keybase.1.phoneNumbers.addPhoneNumber')
export const phoneNumbersDeletePhoneNumberRpcPromise = createRpc('keybase.1.phoneNumbers.deletePhoneNumber')
export const phoneNumbersResendVerificationForPhoneNumberRpcPromise = createRpc('keybase.1.phoneNumbers.resendVerificationForPhoneNumber')
export const phoneNumbersSetVisibilityPhoneNumberRpcPromise = createRpc('keybase.1.phoneNumbers.setVisibilityPhoneNumber')
export const phoneNumbersVerifyPhoneNumberRpcPromise = createRpc('keybase.1.phoneNumbers.verifyPhoneNumber')
export const pprofLogProcessorProfileRpcPromise = createRpc('keybase.1.pprof.logProcessorProfile')
export const pprofLogTraceRpcPromise = createRpc('keybase.1.pprof.logTrace')
export const proveCheckProofRpcPromise = createRpc('keybase.1.prove.checkProof')
export const proveStartProofRpcListener = createListener('keybase.1.prove.startProof')
export const reachabilityCheckReachabilityRpcPromise = createRpc('keybase.1.reachability.checkReachability')
export const reachabilityStartReachabilityRpcPromise = createRpc('keybase.1.reachability.startReachability')
export const rekeyGetRevokeWarningRpcPromise = createRpc('keybase.1.rekey.getRevokeWarning')
export const rekeyRekeyStatusFinishRpcPromise = createRpc('keybase.1.rekey.rekeyStatusFinish')
export const rekeyShowPendingRekeyStatusRpcPromise = createRpc('keybase.1.rekey.showPendingRekeyStatus')
export const revokeRevokeDeviceRpcPromise = createRpc('keybase.1.revoke.revokeDevice')
export const revokeRevokeKeyRpcPromise = createRpc('keybase.1.revoke.revokeKey')
export const revokeRevokeSigsRpcPromise = createRpc('keybase.1.revoke.revokeSigs')
export const saltpackSaltpackDecryptFileRpcPromise = createRpc('keybase.1.saltpack.saltpackDecryptFile')
export const saltpackSaltpackDecryptStringRpcPromise = createRpc('keybase.1.saltpack.saltpackDecryptString')
export const saltpackSaltpackEncryptFileRpcPromise = createRpc('keybase.1.saltpack.saltpackEncryptFile')
export const saltpackSaltpackEncryptStringRpcPromise = createRpc('keybase.1.saltpack.saltpackEncryptString')
export const saltpackSaltpackSaveCiphertextToFileRpcPromise = createRpc('keybase.1.saltpack.saltpackSaveCiphertextToFile')
export const saltpackSaltpackSaveSignedMsgToFileRpcPromise = createRpc('keybase.1.saltpack.saltpackSaveSignedMsgToFile')
export const saltpackSaltpackSignFileRpcPromise = createRpc('keybase.1.saltpack.saltpackSignFile')
export const saltpackSaltpackSignStringRpcPromise = createRpc('keybase.1.saltpack.saltpackSignString')
export const saltpackSaltpackVerifyFileRpcPromise = createRpc('keybase.1.saltpack.saltpackVerifyFile')
export const saltpackSaltpackVerifyStringRpcPromise = createRpc('keybase.1.saltpack.saltpackVerifyString')
export const signupCheckUsernameAvailableRpcPromise = createRpc('keybase.1.signup.checkUsernameAvailable')
export const signupGetInvitationCodeRpcPromise = createRpc('keybase.1.signup.getInvitationCode')
export const signupSignupRpcListener = createListener('keybase.1.signup.signup')
export const teamsFindAssertionsInTeamNoResolveRpcPromise = createRpc('keybase.1.teams.findAssertionsInTeamNoResolve')
export const teamsGetAnnotatedTeamRpcPromise = createRpc('keybase.1.teams.getAnnotatedTeam')
export const teamsGetInviteLinkDetailsRpcPromise = createRpc('keybase.1.teams.getInviteLinkDetails')
export const teamsGetTeamIDRpcPromise = createRpc('keybase.1.teams.getTeamID')
export const teamsGetTeamRoleMapRpcPromise = createRpc('keybase.1.teams.getTeamRoleMap')
export const teamsGetUntrustedTeamInfoRpcPromise = createRpc('keybase.1.teams.getUntrustedTeamInfo')
export const teamsLoadTeamTreeMembershipsAsyncRpcPromise = createRpc('keybase.1.teams.loadTeamTreeMembershipsAsync')
export const teamsSetTarsDisabledRpcPromise = createRpc('keybase.1.teams.setTarsDisabled')
export const teamsSetTeamMemberShowcaseRpcPromise = createRpc('keybase.1.teams.setTeamMemberShowcase')
export const teamsSetTeamShowcaseRpcPromise = createRpc('keybase.1.teams.setTeamShowcase')
export const teamsTeamAcceptInviteOrRequestAccessRpcListener = createListener('keybase.1.teams.teamAcceptInviteOrRequestAccess')
export const teamsTeamAddEmailsBulkRpcPromise = createRpc('keybase.1.teams.teamAddEmailsBulk')
export const teamsTeamAddMemberRpcPromise = createRpc('keybase.1.teams.teamAddMember')
export const teamsTeamAddMembersMultiRoleRpcPromise = createRpc('keybase.1.teams.teamAddMembersMultiRole')
export const teamsTeamCreateFancyRpcPromise = createRpc('keybase.1.teams.teamCreateFancy')
export const teamsTeamCreateRpcPromise = createRpc('keybase.1.teams.teamCreate')
export const teamsTeamCreateSeitanTokenV2RpcPromise = createRpc('keybase.1.teams.teamCreateSeitanTokenV2')
export const teamsTeamDeleteRpcListener = createListener('keybase.1.teams.teamDelete')
export const teamsTeamEditMembersRpcPromise = createRpc('keybase.1.teams.teamEditMembers')
export const teamsTeamGetMembersByIDRpcPromise = createRpc('keybase.1.teams.teamGetMembersByID')
export const teamsTeamIgnoreRequestRpcPromise = createRpc('keybase.1.teams.teamIgnoreRequest')
export const teamsTeamLeaveRpcPromise = createRpc('keybase.1.teams.teamLeave')
export const teamsTeamListMyAccessRequestsRpcPromise = createRpc('keybase.1.teams.teamListMyAccessRequests')
export const teamsTeamListUnverifiedRpcPromise = createRpc('keybase.1.teams.teamListUnverified')
export const teamsTeamProfileAddListRpcPromise = createRpc('keybase.1.teams.teamProfileAddList')
export const teamsTeamReAddMemberAfterResetRpcPromise = createRpc('keybase.1.teams.teamReAddMemberAfterReset')
export const teamsTeamRemoveMemberRpcPromise = createRpc('keybase.1.teams.teamRemoveMember')
export const teamsTeamRenameRpcPromise = createRpc('keybase.1.teams.teamRename')
export const teamsTeamSetSettingsRpcPromise = createRpc('keybase.1.teams.teamSetSettings')
export const teamsUntrustedTeamExistsRpcPromise = createRpc('keybase.1.teams.untrustedTeamExists')
export const teamsUploadTeamAvatarRpcPromise = createRpc('keybase.1.teams.uploadTeamAvatar')
export const userBlockUserRpcPromise = createRpc('keybase.1.user.blockUser')
export const userCanLogoutRpcPromise = createRpc('keybase.1.user.canLogout')
export const userDismissBlockButtonsRpcPromise = createRpc('keybase.1.user.dismissBlockButtons')
export const userGetUserBlocksRpcPromise = createRpc('keybase.1.user.getUserBlocks')
export const userInterestingPeopleRpcPromise = createRpc('keybase.1.user.interestingPeople')
export const userListTrackersUnverifiedRpcPromise = createRpc('keybase.1.user.listTrackersUnverified')
export const userListTrackingRpcPromise = createRpc('keybase.1.user.listTracking')
export const userLoadMySettingsRpcPromise = createRpc('keybase.1.user.loadMySettings')
export const userLoadPassphraseStateRpcPromise = createRpc('keybase.1.user.loadPassphraseState')
export const userProfileEditRpcPromise = createRpc('keybase.1.user.profileEdit')
export const userProofSuggestionsRpcPromise = createRpc('keybase.1.user.proofSuggestions')
export const userReportUserRpcPromise = createRpc('keybase.1.user.reportUser')
export const userSearchBulkEmailOrPhoneSearchRpcPromise = createRpc('keybase.1.userSearch.bulkEmailOrPhoneSearch')
export const userSearchGetNonUserDetailsRpcPromise = createRpc('keybase.1.userSearch.getNonUserDetails')
export const userSearchUserSearchRpcPromise = createRpc('keybase.1.userSearch.userSearch')
export const userSetUserBlocksRpcPromise = createRpc('keybase.1.user.setUserBlocks')
export const userUnblockUserRpcPromise = createRpc('keybase.1.user.unblockUser')
export const userUploadUserAvatarRpcPromise = createRpc('keybase.1.user.uploadUserAvatar')
export const userUserCardRpcPromise = createRpc('keybase.1.user.userCard')
// Not enabled calls. To enable add to enabled-calls.json:
// 'keybase.1.account.passphrasePrompt'
// 'keybase.1.account.emailChange'
// 'keybase.1.account.resetAccount'
// 'keybase.1.account.timeTravelReset'
// 'keybase.1.airdrop.reg1'
// 'keybase.1.airdrop.reg2'
// 'keybase.1.apiserver.Get'
// 'keybase.1.audit.isInJail'
// 'keybase.1.audit.boxAuditTeam'
// 'keybase.1.audit.attemptBoxAudit'
// 'keybase.1.audit.knownTeamIDs'
// 'keybase.1.avatars.loadUserAvatars'
// 'keybase.1.avatars.loadTeamAvatars'
// 'keybase.1.badger.getBadgeState'
// 'keybase.1.block.getSessionChallenge'
// 'keybase.1.block.authenticateSession'
// 'keybase.1.block.putBlock'
// 'keybase.1.block.putBlockAgain'
// 'keybase.1.block.getBlock'
// 'keybase.1.block.getBlockSizes'
// 'keybase.1.block.addReference'
// 'keybase.1.block.delReference'
// 'keybase.1.block.archiveReference'
// 'keybase.1.block.delReferenceWithCount'
// 'keybase.1.block.archiveReferenceWithCount'
// 'keybase.1.block.getReferenceCount'
// 'keybase.1.block.getUserQuotaInfo'
// 'keybase.1.block.getTeamQuotaInfo'
// 'keybase.1.block.getUserQuotaInfo2'
// 'keybase.1.block.getTeamQuotaInfo2'
// 'keybase.1.block.blockPing'
// 'keybase.1.bot.botTokenList'
// 'keybase.1.bot.botTokenCreate'
// 'keybase.1.bot.botTokenDelete'
// 'keybase.1.BTC.registerBTC'
// 'keybase.1.config.getCurrentStatus'
// 'keybase.1.config.getClientStatus'
// 'keybase.1.config.getFullStatus'
// 'keybase.1.config.isServiceRunning'
// 'keybase.1.config.isKBFSRunning'
// 'keybase.1.config.getNetworkStats'
// 'keybase.1.config.getAllProvisionedUsernames'
// 'keybase.1.config.getConfig'
// 'keybase.1.config.setUserConfig'
// 'keybase.1.config.setPath'
// 'keybase.1.config.setValue'
// 'keybase.1.config.clearValue'
// 'keybase.1.config.getValue'
// 'keybase.1.config.guiClearValue'
// 'keybase.1.config.checkAPIServerOutOfDateWarning'
// 'keybase.1.contacts.lookupContactList'
// 'keybase.1.contacts.lookupSavedContactsList'
// 'keybase.1.crypto.signED25519'
// 'keybase.1.crypto.signED25519ForKBFS'
// 'keybase.1.crypto.signToString'
// 'keybase.1.crypto.unboxBytes32'
// 'keybase.1.crypto.unboxBytes32Any'
// 'keybase.1.ctl.stopService'
// 'keybase.1.ctl.logRotate'
// 'keybase.1.ctl.reload'
// 'keybase.1.ctl.dbClean'
// 'keybase.1.ctl.appExit'
// 'keybase.1.ctl.dbDelete'
// 'keybase.1.ctl.dbPut'
// 'keybase.1.ctl.dbGet'
// 'keybase.1.ctl.dbKeysWithPrefixes'
// 'keybase.1.debugging.firstStep'
// 'keybase.1.debugging.secondStep'
// 'keybase.1.debugging.increment'
// 'keybase.1.debugging.script'
// 'keybase.1.delegateUiCtl.registerIdentifyUI'
// 'keybase.1.delegateUiCtl.registerUpdateUI'
// 'keybase.1.delegateUiCtl.registerGregorFirehose'
// 'keybase.1.device.deviceList'
// 'keybase.1.device.checkDeviceNameForUser'
// 'keybase.1.emails.editEmail'
// 'keybase.1.emails.setVisibilityAllEmail'
// 'keybase.1.emails.getEmails'
// 'keybase.1.favorite.favoriteAdd'
// 'keybase.1.favorite.getFavorites'
// 'keybase.1.featuredBot.searchLocal'
// 'keybase.1.fs.List'
// 'keybase.1.git.putGitMetadata'
// 'keybase.1.git.deleteGitMetadata'
// 'keybase.1.git.getGitMetadata'
// 'keybase.1.git.gcPersonalRepo'
// 'keybase.1.git.gcTeamRepo'
// 'keybase.1.git.getTeamRepoSettings'
// 'keybase.1.gpgUi.confirmDuplicateKeyChosen'
// 'keybase.1.gpgUi.confirmImportSecretToExistingKey'
// 'keybase.1.gpgUi.selectKeyAndPushOption'
// 'keybase.1.gpgUi.sign'
// 'keybase.1.gpgUi.getTTY'
// 'keybase.1.gregor.injectItem'
// 'keybase.1.gregor.dismissItem'
// 'keybase.1.gregor.updateItem'
// 'keybase.1.gregorUI.pushOutOfBandMessages'
// 'keybase.1.home.homeActionTaken'
// 'keybase.1.identify.Resolve3'
// 'keybase.1.identify.identify2'
// 'keybase.1.identify.identifyLite'
// 'keybase.1.identify.resolveIdentifyImplicitTeam'
// 'keybase.1.identify.resolveImplicitTeam'
// 'keybase.1.identify.normalizeSocialAssertion'
// 'keybase.1.identify3Ui.identify3TrackerTimedOut'
// 'keybase.1.identifyUi.displayTLFCreateWithInvite'
// 'keybase.1.identifyUi.delegateIdentifyUI'
// 'keybase.1.identifyUi.start'
// 'keybase.1.identifyUi.displayKey'
// 'keybase.1.identifyUi.reportLastTrack'
// 'keybase.1.identifyUi.launchNetworkChecks'
// 'keybase.1.identifyUi.displayTrackStatement'
// 'keybase.1.identifyUi.finishWebProofCheck'
// 'keybase.1.identifyUi.finishSocialProofCheck'
// 'keybase.1.identifyUi.displayCryptocurrency'
// 'keybase.1.identifyUi.displayStellarAccount'
// 'keybase.1.identifyUi.reportTrackToken'
// 'keybase.1.identifyUi.displayUserCard'
// 'keybase.1.identifyUi.confirm'
// 'keybase.1.identifyUi.cancel'
// 'keybase.1.identifyUi.finish'
// 'keybase.1.identifyUi.dismiss'
// 'keybase.1.implicitTeamMigration.startMigration'
// 'keybase.1.implicitTeamMigration.finalizeMigration'
// 'keybase.1.install.installCommandLinePrivileged'
// 'keybase.1.inviteFriends.invitePeople'
// 'keybase.1.inviteFriends.getInviteCounts'
// 'keybase.1.inviteFriends.requestInviteCounts'
// 'keybase.1.kbfs.FSEvent'
// 'keybase.1.kbfs.FSPathUpdate'
// 'keybase.1.kbfs.FSEditList'
// 'keybase.1.kbfs.FSSyncStatus'
// 'keybase.1.kbfs.FSSyncEvent'
// 'keybase.1.kbfs.FSOverallSyncEvent'
// 'keybase.1.kbfs.FSOnlineStatusChangedEvent'
// 'keybase.1.kbfs.FSFavoritesChangedEvent'
// 'keybase.1.kbfs.FSSubscriptionNotifyPathEvent'
// 'keybase.1.kbfs.FSSubscriptionNotifyEvent'
// 'keybase.1.kbfs.createTLF'
// 'keybase.1.kbfs.getKBFSTeamSettings'
// 'keybase.1.kbfs.upgradeTLF'
// 'keybase.1.kbfs.encryptFavorites'
// 'keybase.1.kbfs.decryptFavorites'
// 'keybase.1.KBFSGit.createRepo'
// 'keybase.1.KBFSGit.deleteRepo'
// 'keybase.1.KBFSGit.gc'
// 'keybase.1.kbfsMount.GetAllAvailableMountDirs'
// 'keybase.1.kbfsMount.SetCurrentMountDir'
// 'keybase.1.Kex2Provisionee.hello'
// 'keybase.1.Kex2Provisionee.didCounterSign'
// 'keybase.1.Kex2Provisionee2.hello2'
// 'keybase.1.Kex2Provisionee2.didCounterSign2'
// 'keybase.1.Kex2Provisioner.kexStart'
// 'keybase.1.kvstore.getKVEntry'
// 'keybase.1.kvstore.putKVEntry'
// 'keybase.1.kvstore.listKVNamespaces'
// 'keybase.1.kvstore.listKVEntries'
// 'keybase.1.kvstore.delKVEntry'
// 'keybase.1.log.registerLogger'
// 'keybase.1.login.loginProvisionedDevice'
// 'keybase.1.login.loginWithPaperKey'
// 'keybase.1.login.recoverAccountFromEmailAddress'
// 'keybase.1.login.unlock'
// 'keybase.1.login.unlockWithPassphrase'
// 'keybase.1.login.loginOneshot'
// 'keybase.1.loginUi.displayResetMessage'
// 'keybase.1.merkle.getCurrentMerkleRoot'
// 'keybase.1.merkle.verifyMerkleRootAndKBFS'
// 'keybase.1.metadata.getChallenge'
// 'keybase.1.metadata.authenticate'
// 'keybase.1.metadata.putMetadata'
// 'keybase.1.metadata.getMetadata'
// 'keybase.1.metadata.getMetadataByTimestamp'
// 'keybase.1.metadata.registerForUpdates'
// 'keybase.1.metadata.pruneBranch'
// 'keybase.1.metadata.putKeys'
// 'keybase.1.metadata.getKey'
// 'keybase.1.metadata.deleteKey'
// 'keybase.1.metadata.truncateLock'
// 'keybase.1.metadata.truncateUnlock'
// 'keybase.1.metadata.getFolderHandle'
// 'keybase.1.metadata.getFoldersForRekey'
// 'keybase.1.metadata.ping'
// 'keybase.1.metadata.ping2'
// 'keybase.1.metadata.getLatestFolderHandle'
// 'keybase.1.metadata.getKeyBundles'
// 'keybase.1.metadata.lock'
// 'keybase.1.metadata.releaseLock'
// 'keybase.1.metadata.startImplicitTeamMigration'
// 'keybase.1.metadata.getMerkleRoot'
// 'keybase.1.metadata.getMerkleRootLatest'
// 'keybase.1.metadata.getMerkleRootSince'
// 'keybase.1.metadata.getMerkleNode'
// 'keybase.1.metadata.findNextMD'
// 'keybase.1.metadata.setImplicitTeamModeForTest'
// 'keybase.1.metadata.forceMerkleBuildForTest'
// 'keybase.1.metadataUpdate.metadataUpdate'
// 'keybase.1.metadataUpdate.folderNeedsRekey'
// 'keybase.1.metadataUpdate.foldersNeedRekey'
// 'keybase.1.NotifyCanUserPerform.canUserPerformChanged'
// 'keybase.1.NotifyDeviceClone.deviceCloneCountChanged'
// 'keybase.1.NotifyEphemeral.newTeamEk'
// 'keybase.1.NotifyEphemeral.newTeambotEk'
// 'keybase.1.NotifyEphemeral.teambotEkNeeded'
// 'keybase.1.NotifyFavorites.favoritesChanged'
// 'keybase.1.NotifyFS.FSPathUpdated'
// 'keybase.1.NotifyFS.FSSyncActivity'
// 'keybase.1.NotifyFS.FSEditListResponse'
// 'keybase.1.NotifyFS.FSSyncStatusResponse'
// 'keybase.1.NotifyFS.FSFavoritesChanged'
// 'keybase.1.NotifyFS.FSOnlineStatusChanged'
// 'keybase.1.NotifyFSRequest.FSEditListRequest'
// 'keybase.1.NotifyFSRequest.FSSyncStatusRequest'
// 'keybase.1.NotifyInviteFriends.updateInviteCounts'
// 'keybase.1.NotifyKeyfamily.keyfamilyChanged'
// 'keybase.1.NotifyPaperKey.paperKeyCached'
// 'keybase.1.NotifySaltpack.saltpackOperationStart'
// 'keybase.1.NotifySaltpack.saltpackOperationProgress'
// 'keybase.1.NotifySaltpack.saltpackOperationDone'
// 'keybase.1.NotifyTeam.teamChangedByName'
// 'keybase.1.NotifyTeam.teamAbandoned'
// 'keybase.1.NotifyTeam.newlyAddedToTeam'
// 'keybase.1.NotifyTeambot.newTeambotKey'
// 'keybase.1.NotifyTeambot.teambotKeyNeeded'
// 'keybase.1.NotifyUsers.webOfTrustChanged'
// 'keybase.1.paperprovision.paperProvision'
// 'keybase.1.pgp.pgpSign'
// 'keybase.1.pgp.pgpPull'
// 'keybase.1.pgp.pgpEncrypt'
// 'keybase.1.pgp.pgpDecrypt'
// 'keybase.1.pgp.pgpVerify'
// 'keybase.1.pgp.pgpImport'
// 'keybase.1.pgp.pgpExport'
// 'keybase.1.pgp.pgpExportByFingerprint'
// 'keybase.1.pgp.pgpExportByKID'
// 'keybase.1.pgp.pgpKeyGen'
// 'keybase.1.pgp.pgpDeletePrimary'
// 'keybase.1.pgp.pgpSelect'
// 'keybase.1.pgp.pgpUpdate'
// 'keybase.1.pgp.pgpPurge'
// 'keybase.1.pgp.pgpPushPrivate'
// 'keybase.1.pgp.pgpPullPrivate'
// 'keybase.1.pgpUi.outputPGPWarning'
// 'keybase.1.pgpUi.outputSignatureSuccess'
// 'keybase.1.pgpUi.outputSignatureNonKeybase'
// 'keybase.1.phoneNumbers.editPhoneNumber'
// 'keybase.1.phoneNumbers.getPhoneNumbers'
// 'keybase.1.phoneNumbers.setVisibilityAllPhoneNumber'
// 'keybase.1.pprof.processorProfile'
// 'keybase.1.pprof.heapProfile'
// 'keybase.1.pprof.trace'
// 'keybase.1.prove.listSomeProofServices'
// 'keybase.1.prove.listProofServices'
// 'keybase.1.prove.validateUsername'
// 'keybase.1.provisionUi.chooseProvisioningMethod'
// 'keybase.1.quota.verifySession'
// 'keybase.1.rekey.getPendingRekeyStatus'
// 'keybase.1.rekey.debugShowRekeyStatus'
// 'keybase.1.rekey.rekeySync'
// 'keybase.1.saltpack.saltpackEncrypt'
// 'keybase.1.saltpack.saltpackDecrypt'
// 'keybase.1.saltpack.saltpackSign'
// 'keybase.1.saltpack.saltpackVerify'
// 'keybase.1.saltpack.saltpackEncryptStringToTextFile'
// 'keybase.1.saltpack.saltpackSignStringToTextFile'
// 'keybase.1.saltpackUi.saltpackPromptForDecrypt'
// 'keybase.1.saltpackUi.saltpackVerifySuccess'
// 'keybase.1.saltpackUi.saltpackVerifyBadSender'
// 'keybase.1.ScanProofs.scanProofs'
// 'keybase.1.SecretKeys.getSecretKeys'
// 'keybase.1.selfprovision.selfProvision'
// 'keybase.1.session.currentSession'
// 'keybase.1.session.sessionPing'
// 'keybase.1.signup.inviteRequest'
// 'keybase.1.signup.checkInvitationCode'
// 'keybase.1.sigs.sigList'
// 'keybase.1.sigs.sigListJSON'
// 'keybase.1.SimpleFS.simpleFSListRecursive'
// 'keybase.1.SimpleFS.simpleFSCopy'
// 'keybase.1.SimpleFS.simpleFSSymlink'
// 'keybase.1.SimpleFS.simpleFSRename'
// 'keybase.1.SimpleFS.simpleFSSetStat'
// 'keybase.1.SimpleFS.simpleFSRead'
// 'keybase.1.SimpleFS.simpleFSWrite'
// 'keybase.1.SimpleFS.simpleFSGetRevisions'
// 'keybase.1.SimpleFS.simpleFSReadRevisions'
// 'keybase.1.SimpleFS.simpleFSMakeOpid'
// 'keybase.1.SimpleFS.simpleFSClose'
// 'keybase.1.SimpleFS.simpleFSCancel'
// 'keybase.1.SimpleFS.simpleFSCheck'
// 'keybase.1.SimpleFS.simpleFSGetOps'
// 'keybase.1.SimpleFS.simpleFSDumpDebuggingInfo'
// 'keybase.1.SimpleFS.simpleFSForceStuckConflict'
// 'keybase.1.SimpleFS.simpleFSFolderEditHistory'
// 'keybase.1.SimpleFS.simpleFSGetUserQuotaUsage'
// 'keybase.1.SimpleFS.simpleFSGetTeamQuotaUsage'
// 'keybase.1.SimpleFS.simpleFSReset'
// 'keybase.1.SimpleFS.simpleFSSyncConfigAndStatus'
// 'keybase.1.SimpleFS.simpleFSObfuscatePath'
// 'keybase.1.SimpleFS.simpleFSDeobfuscatePath'
// 'keybase.1.SimpleFS.simpleFSGetStats'
// 'keybase.1.SimpleFS.simpleFSCancelUpload'
// 'keybase.1.SimpleFS.simpleFSSearch'
// 'keybase.1.SimpleFS.simpleFSResetIndex'
// 'keybase.1.SimpleFS.simpleFSGetIndexProgress'
// 'keybase.1.SimpleFS.simpleFSCancelJournalUploads'
// 'keybase.1.SimpleFS.simpleFSArchiveCheckArchive'
// 'keybase.1.streamUi.close'
// 'keybase.1.streamUi.read'
// 'keybase.1.streamUi.reset'
// 'keybase.1.streamUi.write'
// 'keybase.1.teams.teamCreateWithSettings'
// 'keybase.1.teams.teamGetByID'
// 'keybase.1.teams.teamGet'
// 'keybase.1.teams.teamListTeammates'
// 'keybase.1.teams.teamListVerified'
// 'keybase.1.teams.teamListSubteamsRecursive'
// 'keybase.1.teams.teamAddMembers'
// 'keybase.1.teams.teamRemoveMembers'
// 'keybase.1.teams.teamEditMember'
// 'keybase.1.teams.teamGetBotSettings'
// 'keybase.1.teams.teamSetBotSettings'
// 'keybase.1.teams.teamAcceptInvite'
// 'keybase.1.teams.teamRequestAccess'
// 'keybase.1.teams.teamListRequests'
// 'keybase.1.teams.teamTreeUnverified'
// 'keybase.1.teams.teamGetSubteamsUnverified'
// 'keybase.1.teams.teamCreateSeitanToken'
// 'keybase.1.teams.teamCreateSeitanInvitelink'
// 'keybase.1.teams.teamCreateSeitanInvitelinkWithDuration'
// 'keybase.1.teams.lookupImplicitTeam'
// 'keybase.1.teams.lookupOrCreateImplicitTeam'
// 'keybase.1.teams.loadTeamPlusApplicationKeys'
// 'keybase.1.teams.getTeamRootID'
// 'keybase.1.teams.getTeamShowcase'
// 'keybase.1.teams.getTeamAndMemberShowcase'
// 'keybase.1.teams.canUserPerform'
// 'keybase.1.teams.teamRotateKey'
// 'keybase.1.teams.teamDebug'
// 'keybase.1.teams.getTarsDisabled'
// 'keybase.1.teams.tryDecryptWithTeamKey'
// 'keybase.1.teams.findNextMerkleRootAfterTeamRemoval'
// 'keybase.1.teams.findNextMerkleRootAfterTeamRemovalBySigningKey'
// 'keybase.1.teams.profileTeamLoad'
// 'keybase.1.teams.getTeamName'
// 'keybase.1.teams.ftl'
// 'keybase.1.teams.getAnnotatedTeamByName'
// 'keybase.1.teamSearch.teamSearch'
// 'keybase.1.test.test'
// 'keybase.1.test.testCallback'
// 'keybase.1.test.panic'
// 'keybase.1.test.testAirdropReg'
// 'keybase.1.test.echo'
// 'keybase.1.tlf.CryptKeys'
// 'keybase.1.tlf.publicCanonicalTLFNameAndID'
// 'keybase.1.tlf.completeAndCanonicalizePrivateTlfName'
// 'keybase.1.tlfKeys.getTLFCryptKeys'
// 'keybase.1.tlfKeys.getPublicCanonicalTLFNameAndID'
// 'keybase.1.track.track'
// 'keybase.1.track.trackWithToken'
// 'keybase.1.track.dismissWithToken'
// 'keybase.1.track.untrack'
// 'keybase.1.track.checkTracking'
// 'keybase.1.track.fakeTrackingChanged'
// 'keybase.1.ui.promptYesNo'
// 'keybase.1.user.listTrackingJSON'
// 'keybase.1.user.loadUser'
// 'keybase.1.user.loadUserByName'
// 'keybase.1.user.loadUserPlusKeys'
// 'keybase.1.user.loadUserPlusKeysV2'
// 'keybase.1.user.loadPublicKeys'
// 'keybase.1.user.loadMyPublicKeys'
// 'keybase.1.user.loadAllPublicKeysUnverified'
// 'keybase.1.user.meUserVersion'
// 'keybase.1.user.getUPAK'
// 'keybase.1.user.getUPAKLite'
// 'keybase.1.user.findNextMerkleRootAfterRevoke'
// 'keybase.1.user.findNextMerkleRootAfterReset'
// 'keybase.1.user.getTeamBlocks'
// 'keybase.1.wot.wotVouch'
// 'keybase.1.wot.wotVouchCLI'
// 'keybase.1.wot.wotReact'
// 'keybase.1.wot.dismissWotNotifications'
// 'keybase.1.wot.wotFetchVouches'
