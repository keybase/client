// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as chat1Types from '@/constants/rpc/rpc-chat-gen'
import type * as keybase1Types from '@/constants/rpc/rpc-gen'

type Chat1IncomingAction =
  'chat.1.NotifyChat.ChatArchiveComplete' |
  'chat.1.NotifyChat.ChatArchiveProgress' |
  'chat.1.NotifyChat.ChatAttachmentDownloadComplete' |
  'chat.1.NotifyChat.ChatAttachmentDownloadProgress' |
  'chat.1.NotifyChat.ChatAttachmentUploadProgress' |
  'chat.1.NotifyChat.ChatAttachmentUploadStart' |
  'chat.1.NotifyChat.ChatConvUpdate' |
  'chat.1.NotifyChat.ChatIdentifyUpdate' |
  'chat.1.NotifyChat.ChatInboxStale' |
  'chat.1.NotifyChat.ChatInboxSyncStarted' |
  'chat.1.NotifyChat.ChatInboxSynced' |
  'chat.1.NotifyChat.ChatParticipantsInfo' |
  'chat.1.NotifyChat.ChatPaymentInfo' |
  'chat.1.NotifyChat.ChatPromptUnfurl' |
  'chat.1.NotifyChat.ChatRequestInfo' |
  'chat.1.NotifyChat.ChatSetConvRetention' |
  'chat.1.NotifyChat.ChatSetConvSettings' |
  'chat.1.NotifyChat.ChatSetTeamRetention' |
  'chat.1.NotifyChat.ChatSubteamRename' |
  'chat.1.NotifyChat.ChatTLFFinalize' |
  'chat.1.NotifyChat.ChatThreadsStale' |
  'chat.1.NotifyChat.ChatTypingUpdate' |
  'chat.1.NotifyChat.ChatWelcomeMessageLoaded' |
  'chat.1.NotifyChat.NewChatActivity'

type Chat1IncomingActionMap<K extends chat1Types.MessageKey> = {
  [P in K]: {readonly params: chat1Types.RpcIn<P>}
}

type Chat1ResponseAction =
  'chat.1.chatUi.chatBotCommandsUpdateStatus' |
  'chat.1.chatUi.chatClearWatch' |
  'chat.1.chatUi.chatCoinFlipStatus' |
  'chat.1.chatUi.chatCommandMarkdown' |
  'chat.1.chatUi.chatCommandStatus' |
  'chat.1.chatUi.chatGiphySearchResults' |
  'chat.1.chatUi.chatGiphyToggleResultWindow' |
  'chat.1.chatUi.chatInboxConversation' |
  'chat.1.chatUi.chatInboxFailed' |
  'chat.1.chatUi.chatInboxLayout' |
  'chat.1.chatUi.chatInboxUnverified' |
  'chat.1.chatUi.chatLoadGalleryHit' |
  'chat.1.chatUi.chatMaybeMentionUpdate' |
  'chat.1.chatUi.chatSearchBotHits' |
  'chat.1.chatUi.chatSearchConvHits' |
  'chat.1.chatUi.chatSearchDone' |
  'chat.1.chatUi.chatSearchHit' |
  'chat.1.chatUi.chatSearchInboxDone' |
  'chat.1.chatUi.chatSearchInboxHit' |
  'chat.1.chatUi.chatSearchInboxStart' |
  'chat.1.chatUi.chatSearchIndexStatus' |
  'chat.1.chatUi.chatSearchTeamHits' |
  'chat.1.chatUi.chatShowManageChannels' |
  'chat.1.chatUi.chatStellarDataConfirm' |
  'chat.1.chatUi.chatStellarDataError' |
  'chat.1.chatUi.chatStellarDone' |
  'chat.1.chatUi.chatStellarShowConfirm' |
  'chat.1.chatUi.chatThreadCached' |
  'chat.1.chatUi.chatThreadFull' |
  'chat.1.chatUi.chatThreadStatus' |
  'chat.1.chatUi.chatWatchPosition' |
  'chat.1.chatUi.triggerContactSync'

type Chat1ResponseActionMap<K extends chat1Types.MessageKey> = {
  [P in K]: {readonly params: chat1Types.RpcIn<P>; readonly response: chat1Types.RpcResponse<P>}
}

type Keybase1IncomingAction =
  'keybase.1.NotifyAudit.boxAuditError' |
  'keybase.1.NotifyAudit.rootAuditError' |
  'keybase.1.NotifyBadges.badgeState' |
  'keybase.1.NotifyFS.FSActivity' |
  'keybase.1.NotifySession.loggedOut' |
  'keybase.1.NotifyTracking.trackingChanged' |
  'keybase.1.NotifyUsers.userChanged' |
  'keybase.1.reachability.reachabilityChanged'

type Keybase1IncomingActionMap<K extends keybase1Types.MessageKey> = {
  [P in K]: {readonly params: keybase1Types.RpcIn<P>}
}

type Keybase1ResponseAction =
  'keybase.1.NotifyApp.exit' |
  'keybase.1.NotifyEmailAddress.emailAddressVerified' |
  'keybase.1.NotifyEmailAddress.emailsChanged' |
  'keybase.1.NotifyFS.FSOverallSyncStatusChanged' |
  'keybase.1.NotifyFS.FSSubscriptionNotify' |
  'keybase.1.NotifyFS.FSSubscriptionNotifyPath' |
  'keybase.1.NotifyFeaturedBots.featuredBotsUpdate' |
  'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile' |
  'keybase.1.NotifyPhoneNumber.phoneNumbersChanged' |
  'keybase.1.NotifyRuntimeStats.runtimeStatsUpdate' |
  'keybase.1.NotifyService.HTTPSrvInfoUpdate' |
  'keybase.1.NotifyService.handleKeybaseLink' |
  'keybase.1.NotifyService.shutdown' |
  'keybase.1.NotifySession.clientOutOfDate' |
  'keybase.1.NotifySession.loggedIn' |
  'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged' |
  'keybase.1.NotifyTeam.avatarUpdated' |
  'keybase.1.NotifyTeam.teamChangedByID' |
  'keybase.1.NotifyTeam.teamDeleted' |
  'keybase.1.NotifyTeam.teamExit' |
  'keybase.1.NotifyTeam.teamMetadataUpdate' |
  'keybase.1.NotifyTeam.teamRoleMapChanged' |
  'keybase.1.NotifyTeam.teamTreeMembershipsDone' |
  'keybase.1.NotifyTeam.teamTreeMembershipsPartial' |
  'keybase.1.NotifyTracking.notifyUserBlocked' |
  'keybase.1.NotifyTracking.trackingInfo' |
  'keybase.1.NotifyUsers.identifyUpdate' |
  'keybase.1.NotifyUsers.passwordChanged' |
  'keybase.1.gpgUi.selectKey' |
  'keybase.1.gpgUi.wantToAddGPGKey' |
  'keybase.1.gregorUI.pushState' |
  'keybase.1.homeUI.homeUIRefresh' |
  'keybase.1.identify3Ui.identify3Result' |
  'keybase.1.identify3Ui.identify3ShowTracker' |
  'keybase.1.identify3Ui.identify3Summary' |
  'keybase.1.identify3Ui.identify3UpdateRow' |
  'keybase.1.identify3Ui.identify3UpdateUserCard' |
  'keybase.1.identify3Ui.identify3UserReset' |
  'keybase.1.logUi.log' |
  'keybase.1.loginUi.chooseDeviceToRecoverWith' |
  'keybase.1.loginUi.displayPaperKeyPhrase' |
  'keybase.1.loginUi.displayPrimaryPaperKey' |
  'keybase.1.loginUi.displayResetProgress' |
  'keybase.1.loginUi.explainDeviceRecovery' |
  'keybase.1.loginUi.getEmailOrUsername' |
  'keybase.1.loginUi.promptPassphraseRecovery' |
  'keybase.1.loginUi.promptResetAccount' |
  'keybase.1.loginUi.promptRevokePaperKeys' |
  'keybase.1.logsend.prepareLogsend' |
  'keybase.1.pgpUi.finished' |
  'keybase.1.pgpUi.keyGenerated' |
  'keybase.1.pgpUi.shouldPushPrivate' |
  'keybase.1.proveUi.checking' |
  'keybase.1.proveUi.continueChecking' |
  'keybase.1.proveUi.displayRecheckWarning' |
  'keybase.1.proveUi.okToCheck' |
  'keybase.1.proveUi.outputInstructions' |
  'keybase.1.proveUi.outputPrechecks' |
  'keybase.1.proveUi.preProofWarning' |
  'keybase.1.proveUi.promptOverwrite' |
  'keybase.1.proveUi.promptUsername' |
  'keybase.1.provisionUi.DisplayAndPromptSecret' |
  'keybase.1.provisionUi.DisplaySecretExchanged' |
  'keybase.1.provisionUi.PromptNewDeviceName' |
  'keybase.1.provisionUi.ProvisioneeSuccess' |
  'keybase.1.provisionUi.ProvisionerSuccess' |
  'keybase.1.provisionUi.chooseDevice' |
  'keybase.1.provisionUi.chooseDeviceType' |
  'keybase.1.provisionUi.chooseGPGMethod' |
  'keybase.1.provisionUi.switchToGPGSignOK' |
  'keybase.1.rekeyUI.delegateRekeyUI' |
  'keybase.1.rekeyUI.refresh' |
  'keybase.1.rekeyUI.rekeySendEvent' |
  'keybase.1.secretUi.getPassphrase' |
  'keybase.1.teamsUi.confirmInviteLinkAccept' |
  'keybase.1.teamsUi.confirmRootTeamDelete' |
  'keybase.1.teamsUi.confirmSubteamDelete'

type Keybase1ResponseActionMap<K extends keybase1Types.MessageKey> = {
  [P in K]: {readonly params: keybase1Types.RpcIn<P>; readonly response: keybase1Types.RpcResponse<P>}
}

type ActionSpec =
  Chat1IncomingActionMap<Chat1IncomingAction> &
  Chat1ResponseActionMap<Chat1ResponseAction> &
  Keybase1IncomingActionMap<Keybase1IncomingAction> &
  Keybase1ResponseActionMap<Keybase1ResponseAction>

export type ActionKey = keyof ActionSpec
type EngineActionMap = {
  [K in ActionKey]: {readonly payload: ActionSpec[K]; readonly type: K}
}

export type ActionPayload<K extends ActionKey = ActionKey> = ActionSpec[K]
export type EngineAction<K extends ActionKey = ActionKey> = EngineActionMap[K]
export type EngineActions = EngineAction
export type Actions = EngineActions
export type ActionType = ActionKey
export type ActionOf<T extends ActionType> = Extract<Actions, {readonly type: T}>
export type PayloadOf<T extends ActionType> = ActionOf<T> extends {readonly payload: infer P} ? P : never
export type ParamsOf<T extends ActionType> = PayloadOf<T> extends {readonly params: infer P} ? P : never
export type ResponseOf<T extends ActionType> = PayloadOf<T> extends {readonly response: infer R} ? R : never
