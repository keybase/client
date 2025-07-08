// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as chat1Types from '@/constants/types/rpc-chat-gen'
import type * as keybase1Types from '@/constants/types/rpc-gen'
import type * as stellar1Types from '@/constants/types/rpc-stellar-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine-gen but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'engine-gen:'
export const chat1ChatUiChatBotCommandsUpdateStatus = 'engine-gen:chat1ChatUiChatBotCommandsUpdateStatus'
export const chat1ChatUiChatClearWatch = 'engine-gen:chat1ChatUiChatClearWatch'
export const chat1ChatUiChatCoinFlipStatus = 'engine-gen:chat1ChatUiChatCoinFlipStatus'
export const chat1ChatUiChatCommandMarkdown = 'engine-gen:chat1ChatUiChatCommandMarkdown'
export const chat1ChatUiChatCommandStatus = 'engine-gen:chat1ChatUiChatCommandStatus'
export const chat1ChatUiChatConfirmChannelDelete = 'engine-gen:chat1ChatUiChatConfirmChannelDelete'
export const chat1ChatUiChatGiphySearchResults = 'engine-gen:chat1ChatUiChatGiphySearchResults'
export const chat1ChatUiChatGiphyToggleResultWindow = 'engine-gen:chat1ChatUiChatGiphyToggleResultWindow'
export const chat1ChatUiChatInboxConversation = 'engine-gen:chat1ChatUiChatInboxConversation'
export const chat1ChatUiChatInboxFailed = 'engine-gen:chat1ChatUiChatInboxFailed'
export const chat1ChatUiChatInboxLayout = 'engine-gen:chat1ChatUiChatInboxLayout'
export const chat1ChatUiChatInboxUnverified = 'engine-gen:chat1ChatUiChatInboxUnverified'
export const chat1ChatUiChatLoadGalleryHit = 'engine-gen:chat1ChatUiChatLoadGalleryHit'
export const chat1ChatUiChatMaybeMentionUpdate = 'engine-gen:chat1ChatUiChatMaybeMentionUpdate'
export const chat1ChatUiChatSearchBotHits = 'engine-gen:chat1ChatUiChatSearchBotHits'
export const chat1ChatUiChatSearchConvHits = 'engine-gen:chat1ChatUiChatSearchConvHits'
export const chat1ChatUiChatSearchDone = 'engine-gen:chat1ChatUiChatSearchDone'
export const chat1ChatUiChatSearchHit = 'engine-gen:chat1ChatUiChatSearchHit'
export const chat1ChatUiChatSearchInboxDone = 'engine-gen:chat1ChatUiChatSearchInboxDone'
export const chat1ChatUiChatSearchInboxHit = 'engine-gen:chat1ChatUiChatSearchInboxHit'
export const chat1ChatUiChatSearchInboxStart = 'engine-gen:chat1ChatUiChatSearchInboxStart'
export const chat1ChatUiChatSearchIndexStatus = 'engine-gen:chat1ChatUiChatSearchIndexStatus'
export const chat1ChatUiChatSearchTeamHits = 'engine-gen:chat1ChatUiChatSearchTeamHits'
export const chat1ChatUiChatShowManageChannels = 'engine-gen:chat1ChatUiChatShowManageChannels'
export const chat1ChatUiChatStellarDataConfirm = 'engine-gen:chat1ChatUiChatStellarDataConfirm'
export const chat1ChatUiChatStellarDataError = 'engine-gen:chat1ChatUiChatStellarDataError'
export const chat1ChatUiChatStellarDone = 'engine-gen:chat1ChatUiChatStellarDone'
export const chat1ChatUiChatStellarShowConfirm = 'engine-gen:chat1ChatUiChatStellarShowConfirm'
export const chat1ChatUiChatThreadCached = 'engine-gen:chat1ChatUiChatThreadCached'
export const chat1ChatUiChatThreadFull = 'engine-gen:chat1ChatUiChatThreadFull'
export const chat1ChatUiChatThreadStatus = 'engine-gen:chat1ChatUiChatThreadStatus'
export const chat1ChatUiChatWatchPosition = 'engine-gen:chat1ChatUiChatWatchPosition'
export const chat1ChatUiTriggerContactSync = 'engine-gen:chat1ChatUiTriggerContactSync'
export const chat1NotifyChatChatArchiveComplete = 'engine-gen:chat1NotifyChatChatArchiveComplete'
export const chat1NotifyChatChatArchiveProgress = 'engine-gen:chat1NotifyChatChatArchiveProgress'
export const chat1NotifyChatChatAttachmentDownloadComplete =
  'engine-gen:chat1NotifyChatChatAttachmentDownloadComplete'
export const chat1NotifyChatChatAttachmentDownloadProgress =
  'engine-gen:chat1NotifyChatChatAttachmentDownloadProgress'
export const chat1NotifyChatChatAttachmentUploadProgress =
  'engine-gen:chat1NotifyChatChatAttachmentUploadProgress'
export const chat1NotifyChatChatAttachmentUploadStart = 'engine-gen:chat1NotifyChatChatAttachmentUploadStart'
export const chat1NotifyChatChatConvUpdate = 'engine-gen:chat1NotifyChatChatConvUpdate'
export const chat1NotifyChatChatIdentifyUpdate = 'engine-gen:chat1NotifyChatChatIdentifyUpdate'
export const chat1NotifyChatChatInboxStale = 'engine-gen:chat1NotifyChatChatInboxStale'
export const chat1NotifyChatChatInboxSyncStarted = 'engine-gen:chat1NotifyChatChatInboxSyncStarted'
export const chat1NotifyChatChatInboxSynced = 'engine-gen:chat1NotifyChatChatInboxSynced'
export const chat1NotifyChatChatJoinedConversation = 'engine-gen:chat1NotifyChatChatJoinedConversation'
export const chat1NotifyChatChatKBFSToImpteamUpgrade = 'engine-gen:chat1NotifyChatChatKBFSToImpteamUpgrade'
export const chat1NotifyChatChatLeftConversation = 'engine-gen:chat1NotifyChatChatLeftConversation'
export const chat1NotifyChatChatParticipantsInfo = 'engine-gen:chat1NotifyChatChatParticipantsInfo'
export const chat1NotifyChatChatPaymentInfo = 'engine-gen:chat1NotifyChatChatPaymentInfo'
export const chat1NotifyChatChatPromptUnfurl = 'engine-gen:chat1NotifyChatChatPromptUnfurl'
export const chat1NotifyChatChatRequestInfo = 'engine-gen:chat1NotifyChatChatRequestInfo'
export const chat1NotifyChatChatResetConversation = 'engine-gen:chat1NotifyChatChatResetConversation'
export const chat1NotifyChatChatSetConvRetention = 'engine-gen:chat1NotifyChatChatSetConvRetention'
export const chat1NotifyChatChatSetConvSettings = 'engine-gen:chat1NotifyChatChatSetConvSettings'
export const chat1NotifyChatChatSetTeamRetention = 'engine-gen:chat1NotifyChatChatSetTeamRetention'
export const chat1NotifyChatChatSubteamRename = 'engine-gen:chat1NotifyChatChatSubteamRename'
export const chat1NotifyChatChatTLFFinalize = 'engine-gen:chat1NotifyChatChatTLFFinalize'
export const chat1NotifyChatChatTLFResolve = 'engine-gen:chat1NotifyChatChatTLFResolve'
export const chat1NotifyChatChatThreadsStale = 'engine-gen:chat1NotifyChatChatThreadsStale'
export const chat1NotifyChatChatTypingUpdate = 'engine-gen:chat1NotifyChatChatTypingUpdate'
export const chat1NotifyChatChatWelcomeMessageLoaded = 'engine-gen:chat1NotifyChatChatWelcomeMessageLoaded'
export const chat1NotifyChatNewChatActivity = 'engine-gen:chat1NotifyChatNewChatActivity'
export const keybase1GpgUiConfirmDuplicateKeyChosen = 'engine-gen:keybase1GpgUiConfirmDuplicateKeyChosen'
export const keybase1GpgUiConfirmImportSecretToExistingKey =
  'engine-gen:keybase1GpgUiConfirmImportSecretToExistingKey'
export const keybase1GpgUiGetTTY = 'engine-gen:keybase1GpgUiGetTTY'
export const keybase1GpgUiSelectKey = 'engine-gen:keybase1GpgUiSelectKey'
export const keybase1GpgUiSelectKeyAndPushOption = 'engine-gen:keybase1GpgUiSelectKeyAndPushOption'
export const keybase1GpgUiSign = 'engine-gen:keybase1GpgUiSign'
export const keybase1GpgUiWantToAddGPGKey = 'engine-gen:keybase1GpgUiWantToAddGPGKey'
export const keybase1GregorUIPushOutOfBandMessages = 'engine-gen:keybase1GregorUIPushOutOfBandMessages'
export const keybase1GregorUIPushState = 'engine-gen:keybase1GregorUIPushState'
export const keybase1HomeUIHomeUIRefresh = 'engine-gen:keybase1HomeUIHomeUIRefresh'
export const keybase1Identify3UiIdentify3Result = 'engine-gen:keybase1Identify3UiIdentify3Result'
export const keybase1Identify3UiIdentify3ShowTracker = 'engine-gen:keybase1Identify3UiIdentify3ShowTracker'
export const keybase1Identify3UiIdentify3Summary = 'engine-gen:keybase1Identify3UiIdentify3Summary'
export const keybase1Identify3UiIdentify3TrackerTimedOut =
  'engine-gen:keybase1Identify3UiIdentify3TrackerTimedOut'
export const keybase1Identify3UiIdentify3UpdateRow = 'engine-gen:keybase1Identify3UiIdentify3UpdateRow'
export const keybase1Identify3UiIdentify3UpdateUserCard =
  'engine-gen:keybase1Identify3UiIdentify3UpdateUserCard'
export const keybase1Identify3UiIdentify3UserReset = 'engine-gen:keybase1Identify3UiIdentify3UserReset'
export const keybase1IdentifyUiCancel = 'engine-gen:keybase1IdentifyUiCancel'
export const keybase1IdentifyUiConfirm = 'engine-gen:keybase1IdentifyUiConfirm'
export const keybase1IdentifyUiDelegateIdentifyUI = 'engine-gen:keybase1IdentifyUiDelegateIdentifyUI'
export const keybase1IdentifyUiDismiss = 'engine-gen:keybase1IdentifyUiDismiss'
export const keybase1IdentifyUiDisplayCryptocurrency = 'engine-gen:keybase1IdentifyUiDisplayCryptocurrency'
export const keybase1IdentifyUiDisplayKey = 'engine-gen:keybase1IdentifyUiDisplayKey'
export const keybase1IdentifyUiDisplayStellarAccount = 'engine-gen:keybase1IdentifyUiDisplayStellarAccount'
export const keybase1IdentifyUiDisplayTLFCreateWithInvite =
  'engine-gen:keybase1IdentifyUiDisplayTLFCreateWithInvite'
export const keybase1IdentifyUiDisplayTrackStatement = 'engine-gen:keybase1IdentifyUiDisplayTrackStatement'
export const keybase1IdentifyUiDisplayUserCard = 'engine-gen:keybase1IdentifyUiDisplayUserCard'
export const keybase1IdentifyUiFinish = 'engine-gen:keybase1IdentifyUiFinish'
export const keybase1IdentifyUiFinishSocialProofCheck = 'engine-gen:keybase1IdentifyUiFinishSocialProofCheck'
export const keybase1IdentifyUiFinishWebProofCheck = 'engine-gen:keybase1IdentifyUiFinishWebProofCheck'
export const keybase1IdentifyUiLaunchNetworkChecks = 'engine-gen:keybase1IdentifyUiLaunchNetworkChecks'
export const keybase1IdentifyUiReportLastTrack = 'engine-gen:keybase1IdentifyUiReportLastTrack'
export const keybase1IdentifyUiReportTrackToken = 'engine-gen:keybase1IdentifyUiReportTrackToken'
export const keybase1IdentifyUiStart = 'engine-gen:keybase1IdentifyUiStart'
export const keybase1LogUiLog = 'engine-gen:keybase1LogUiLog'
export const keybase1LoginUiChooseDeviceToRecoverWith = 'engine-gen:keybase1LoginUiChooseDeviceToRecoverWith'
export const keybase1LoginUiDisplayPaperKeyPhrase = 'engine-gen:keybase1LoginUiDisplayPaperKeyPhrase'
export const keybase1LoginUiDisplayPrimaryPaperKey = 'engine-gen:keybase1LoginUiDisplayPrimaryPaperKey'
export const keybase1LoginUiDisplayResetMessage = 'engine-gen:keybase1LoginUiDisplayResetMessage'
export const keybase1LoginUiDisplayResetProgress = 'engine-gen:keybase1LoginUiDisplayResetProgress'
export const keybase1LoginUiExplainDeviceRecovery = 'engine-gen:keybase1LoginUiExplainDeviceRecovery'
export const keybase1LoginUiGetEmailOrUsername = 'engine-gen:keybase1LoginUiGetEmailOrUsername'
export const keybase1LoginUiPromptPassphraseRecovery = 'engine-gen:keybase1LoginUiPromptPassphraseRecovery'
export const keybase1LoginUiPromptResetAccount = 'engine-gen:keybase1LoginUiPromptResetAccount'
export const keybase1LoginUiPromptRevokePaperKeys = 'engine-gen:keybase1LoginUiPromptRevokePaperKeys'
export const keybase1LogsendPrepareLogsend = 'engine-gen:keybase1LogsendPrepareLogsend'
export const keybase1NotifyAppExit = 'engine-gen:keybase1NotifyAppExit'
export const keybase1NotifyAuditBoxAuditError = 'engine-gen:keybase1NotifyAuditBoxAuditError'
export const keybase1NotifyAuditRootAuditError = 'engine-gen:keybase1NotifyAuditRootAuditError'
export const keybase1NotifyBadgesBadgeState = 'engine-gen:keybase1NotifyBadgesBadgeState'
export const keybase1NotifyCanUserPerformCanUserPerformChanged =
  'engine-gen:keybase1NotifyCanUserPerformCanUserPerformChanged'
export const keybase1NotifyDeviceCloneDeviceCloneCountChanged =
  'engine-gen:keybase1NotifyDeviceCloneDeviceCloneCountChanged'
export const keybase1NotifyEmailAddressEmailAddressVerified =
  'engine-gen:keybase1NotifyEmailAddressEmailAddressVerified'
export const keybase1NotifyEmailAddressEmailsChanged = 'engine-gen:keybase1NotifyEmailAddressEmailsChanged'
export const keybase1NotifyEphemeralNewTeamEk = 'engine-gen:keybase1NotifyEphemeralNewTeamEk'
export const keybase1NotifyEphemeralNewTeambotEk = 'engine-gen:keybase1NotifyEphemeralNewTeambotEk'
export const keybase1NotifyEphemeralTeambotEkNeeded = 'engine-gen:keybase1NotifyEphemeralTeambotEkNeeded'
export const keybase1NotifyFSFSActivity = 'engine-gen:keybase1NotifyFSFSActivity'
export const keybase1NotifyFSFSEditListResponse = 'engine-gen:keybase1NotifyFSFSEditListResponse'
export const keybase1NotifyFSFSFavoritesChanged = 'engine-gen:keybase1NotifyFSFSFavoritesChanged'
export const keybase1NotifyFSFSOnlineStatusChanged = 'engine-gen:keybase1NotifyFSFSOnlineStatusChanged'
export const keybase1NotifyFSFSOverallSyncStatusChanged =
  'engine-gen:keybase1NotifyFSFSOverallSyncStatusChanged'
export const keybase1NotifyFSFSPathUpdated = 'engine-gen:keybase1NotifyFSFSPathUpdated'
export const keybase1NotifyFSFSSubscriptionNotify = 'engine-gen:keybase1NotifyFSFSSubscriptionNotify'
export const keybase1NotifyFSFSSubscriptionNotifyPath = 'engine-gen:keybase1NotifyFSFSSubscriptionNotifyPath'
export const keybase1NotifyFSFSSyncActivity = 'engine-gen:keybase1NotifyFSFSSyncActivity'
export const keybase1NotifyFSFSSyncStatusResponse = 'engine-gen:keybase1NotifyFSFSSyncStatusResponse'
export const keybase1NotifyFavoritesFavoritesChanged = 'engine-gen:keybase1NotifyFavoritesFavoritesChanged'
export const keybase1NotifyFeaturedBotsFeaturedBotsUpdate =
  'engine-gen:keybase1NotifyFeaturedBotsFeaturedBotsUpdate'
export const keybase1NotifyInviteFriendsUpdateInviteCounts =
  'engine-gen:keybase1NotifyInviteFriendsUpdateInviteCounts'
export const keybase1NotifyKeyfamilyKeyfamilyChanged = 'engine-gen:keybase1NotifyKeyfamilyKeyfamilyChanged'
export const keybase1NotifyPGPPgpKeyInSecretStoreFile = 'engine-gen:keybase1NotifyPGPPgpKeyInSecretStoreFile'
export const keybase1NotifyPaperKeyPaperKeyCached = 'engine-gen:keybase1NotifyPaperKeyPaperKeyCached'
export const keybase1NotifyPhoneNumberPhoneNumbersChanged =
  'engine-gen:keybase1NotifyPhoneNumberPhoneNumbersChanged'
export const keybase1NotifyRuntimeStatsRuntimeStatsUpdate =
  'engine-gen:keybase1NotifyRuntimeStatsRuntimeStatsUpdate'
export const keybase1NotifySaltpackSaltpackOperationDone =
  'engine-gen:keybase1NotifySaltpackSaltpackOperationDone'
export const keybase1NotifySaltpackSaltpackOperationProgress =
  'engine-gen:keybase1NotifySaltpackSaltpackOperationProgress'
export const keybase1NotifySaltpackSaltpackOperationStart =
  'engine-gen:keybase1NotifySaltpackSaltpackOperationStart'
export const keybase1NotifyServiceHTTPSrvInfoUpdate = 'engine-gen:keybase1NotifyServiceHTTPSrvInfoUpdate'
export const keybase1NotifyServiceHandleKeybaseLink = 'engine-gen:keybase1NotifyServiceHandleKeybaseLink'
export const keybase1NotifyServiceShutdown = 'engine-gen:keybase1NotifyServiceShutdown'
export const keybase1NotifySessionClientOutOfDate = 'engine-gen:keybase1NotifySessionClientOutOfDate'
export const keybase1NotifySessionLoggedIn = 'engine-gen:keybase1NotifySessionLoggedIn'
export const keybase1NotifySessionLoggedOut = 'engine-gen:keybase1NotifySessionLoggedOut'
export const keybase1NotifySimpleFSSimpleFSArchiveStatusChanged =
  'engine-gen:keybase1NotifySimpleFSSimpleFSArchiveStatusChanged'
export const keybase1NotifyTeamAvatarUpdated = 'engine-gen:keybase1NotifyTeamAvatarUpdated'
export const keybase1NotifyTeamNewlyAddedToTeam = 'engine-gen:keybase1NotifyTeamNewlyAddedToTeam'
export const keybase1NotifyTeamTeamAbandoned = 'engine-gen:keybase1NotifyTeamTeamAbandoned'
export const keybase1NotifyTeamTeamChangedByID = 'engine-gen:keybase1NotifyTeamTeamChangedByID'
export const keybase1NotifyTeamTeamChangedByName = 'engine-gen:keybase1NotifyTeamTeamChangedByName'
export const keybase1NotifyTeamTeamDeleted = 'engine-gen:keybase1NotifyTeamTeamDeleted'
export const keybase1NotifyTeamTeamExit = 'engine-gen:keybase1NotifyTeamTeamExit'
export const keybase1NotifyTeamTeamMetadataUpdate = 'engine-gen:keybase1NotifyTeamTeamMetadataUpdate'
export const keybase1NotifyTeamTeamRoleMapChanged = 'engine-gen:keybase1NotifyTeamTeamRoleMapChanged'
export const keybase1NotifyTeamTeamTreeMembershipsDone =
  'engine-gen:keybase1NotifyTeamTeamTreeMembershipsDone'
export const keybase1NotifyTeamTeamTreeMembershipsPartial =
  'engine-gen:keybase1NotifyTeamTeamTreeMembershipsPartial'
export const keybase1NotifyTeambotNewTeambotKey = 'engine-gen:keybase1NotifyTeambotNewTeambotKey'
export const keybase1NotifyTeambotTeambotKeyNeeded = 'engine-gen:keybase1NotifyTeambotTeambotKeyNeeded'
export const keybase1NotifyTrackingNotifyUserBlocked = 'engine-gen:keybase1NotifyTrackingNotifyUserBlocked'
export const keybase1NotifyTrackingTrackingChanged = 'engine-gen:keybase1NotifyTrackingTrackingChanged'
export const keybase1NotifyTrackingTrackingInfo = 'engine-gen:keybase1NotifyTrackingTrackingInfo'
export const keybase1NotifyUsersIdentifyUpdate = 'engine-gen:keybase1NotifyUsersIdentifyUpdate'
export const keybase1NotifyUsersPasswordChanged = 'engine-gen:keybase1NotifyUsersPasswordChanged'
export const keybase1NotifyUsersUserChanged = 'engine-gen:keybase1NotifyUsersUserChanged'
export const keybase1NotifyUsersWebOfTrustChanged = 'engine-gen:keybase1NotifyUsersWebOfTrustChanged'
export const keybase1PgpUiFinished = 'engine-gen:keybase1PgpUiFinished'
export const keybase1PgpUiKeyGenerated = 'engine-gen:keybase1PgpUiKeyGenerated'
export const keybase1PgpUiOutputPGPWarning = 'engine-gen:keybase1PgpUiOutputPGPWarning'
export const keybase1PgpUiOutputSignatureNonKeybase = 'engine-gen:keybase1PgpUiOutputSignatureNonKeybase'
export const keybase1PgpUiOutputSignatureSuccess = 'engine-gen:keybase1PgpUiOutputSignatureSuccess'
export const keybase1PgpUiShouldPushPrivate = 'engine-gen:keybase1PgpUiShouldPushPrivate'
export const keybase1ProveUiChecking = 'engine-gen:keybase1ProveUiChecking'
export const keybase1ProveUiContinueChecking = 'engine-gen:keybase1ProveUiContinueChecking'
export const keybase1ProveUiDisplayRecheckWarning = 'engine-gen:keybase1ProveUiDisplayRecheckWarning'
export const keybase1ProveUiOkToCheck = 'engine-gen:keybase1ProveUiOkToCheck'
export const keybase1ProveUiOutputInstructions = 'engine-gen:keybase1ProveUiOutputInstructions'
export const keybase1ProveUiOutputPrechecks = 'engine-gen:keybase1ProveUiOutputPrechecks'
export const keybase1ProveUiPreProofWarning = 'engine-gen:keybase1ProveUiPreProofWarning'
export const keybase1ProveUiPromptOverwrite = 'engine-gen:keybase1ProveUiPromptOverwrite'
export const keybase1ProveUiPromptUsername = 'engine-gen:keybase1ProveUiPromptUsername'
export const keybase1ProvisionUiChooseDevice = 'engine-gen:keybase1ProvisionUiChooseDevice'
export const keybase1ProvisionUiChooseDeviceType = 'engine-gen:keybase1ProvisionUiChooseDeviceType'
export const keybase1ProvisionUiChooseGPGMethod = 'engine-gen:keybase1ProvisionUiChooseGPGMethod'
export const keybase1ProvisionUiChooseProvisioningMethod =
  'engine-gen:keybase1ProvisionUiChooseProvisioningMethod'
export const keybase1ProvisionUiDisplayAndPromptSecret =
  'engine-gen:keybase1ProvisionUiDisplayAndPromptSecret'
export const keybase1ProvisionUiDisplaySecretExchanged =
  'engine-gen:keybase1ProvisionUiDisplaySecretExchanged'
export const keybase1ProvisionUiPromptNewDeviceName = 'engine-gen:keybase1ProvisionUiPromptNewDeviceName'
export const keybase1ProvisionUiProvisioneeSuccess = 'engine-gen:keybase1ProvisionUiProvisioneeSuccess'
export const keybase1ProvisionUiProvisionerSuccess = 'engine-gen:keybase1ProvisionUiProvisionerSuccess'
export const keybase1ProvisionUiSwitchToGPGSignOK = 'engine-gen:keybase1ProvisionUiSwitchToGPGSignOK'
export const keybase1ReachabilityReachabilityChanged = 'engine-gen:keybase1ReachabilityReachabilityChanged'
export const keybase1RekeyUIDelegateRekeyUI = 'engine-gen:keybase1RekeyUIDelegateRekeyUI'
export const keybase1RekeyUIRefresh = 'engine-gen:keybase1RekeyUIRefresh'
export const keybase1RekeyUIRekeySendEvent = 'engine-gen:keybase1RekeyUIRekeySendEvent'
export const keybase1SaltpackUiSaltpackPromptForDecrypt =
  'engine-gen:keybase1SaltpackUiSaltpackPromptForDecrypt'
export const keybase1SaltpackUiSaltpackVerifyBadSender =
  'engine-gen:keybase1SaltpackUiSaltpackVerifyBadSender'
export const keybase1SaltpackUiSaltpackVerifySuccess = 'engine-gen:keybase1SaltpackUiSaltpackVerifySuccess'
export const keybase1SecretUiGetPassphrase = 'engine-gen:keybase1SecretUiGetPassphrase'
export const keybase1StreamUiClose = 'engine-gen:keybase1StreamUiClose'
export const keybase1StreamUiRead = 'engine-gen:keybase1StreamUiRead'
export const keybase1StreamUiReset = 'engine-gen:keybase1StreamUiReset'
export const keybase1StreamUiWrite = 'engine-gen:keybase1StreamUiWrite'
export const keybase1TeamsUiConfirmInviteLinkAccept = 'engine-gen:keybase1TeamsUiConfirmInviteLinkAccept'
export const keybase1TeamsUiConfirmRootTeamDelete = 'engine-gen:keybase1TeamsUiConfirmRootTeamDelete'
export const keybase1TeamsUiConfirmSubteamDelete = 'engine-gen:keybase1TeamsUiConfirmSubteamDelete'
export const keybase1UiPromptYesNo = 'engine-gen:keybase1UiPromptYesNo'
export const stellar1NotifyAccountDetailsUpdate = 'engine-gen:stellar1NotifyAccountDetailsUpdate'
export const stellar1NotifyAccountsUpdate = 'engine-gen:stellar1NotifyAccountsUpdate'
export const stellar1NotifyPaymentNotification = 'engine-gen:stellar1NotifyPaymentNotification'
export const stellar1NotifyPaymentStatusNotification = 'engine-gen:stellar1NotifyPaymentStatusNotification'
export const stellar1NotifyPendingPaymentsUpdate = 'engine-gen:stellar1NotifyPendingPaymentsUpdate'
export const stellar1NotifyRecentPaymentsUpdate = 'engine-gen:stellar1NotifyRecentPaymentsUpdate'
export const stellar1NotifyRequestStatusNotification = 'engine-gen:stellar1NotifyRequestStatusNotification'
export const stellar1UiPaymentReviewed = 'engine-gen:stellar1UiPaymentReviewed'

// Action Creators
type createChat1ChatUiChatBotCommandsUpdateStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatBotCommandsUpdateStatus']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatBotCommandsUpdateStatus']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatBotCommandsUpdateStatus}
type createChat1ChatUiChatClearWatch = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatClearWatch']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatClearWatch']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatClearWatch}
type createChat1ChatUiChatCoinFlipStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCoinFlipStatus']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCoinFlipStatus']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatCoinFlipStatus}
type createChat1ChatUiChatCommandMarkdown = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCommandMarkdown']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCommandMarkdown']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatCommandMarkdown}
type createChat1ChatUiChatCommandStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCommandStatus']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCommandStatus']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatCommandStatus}
type createChat1ChatUiChatConfirmChannelDelete = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatConfirmChannelDelete']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatConfirmChannelDelete']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatConfirmChannelDelete}
type createChat1ChatUiChatGiphySearchResults = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatGiphySearchResults']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatGiphySearchResults']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatGiphySearchResults}
type createChat1ChatUiChatGiphyToggleResultWindow = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatGiphyToggleResultWindow']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatGiphyToggleResultWindow']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatGiphyToggleResultWindow}
type createChat1ChatUiChatInboxConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxConversation']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxConversation']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatInboxConversation}
type createChat1ChatUiChatInboxFailed = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxFailed']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxFailed']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatInboxFailed}
type createChat1ChatUiChatInboxLayout = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxLayout']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxLayout']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatInboxLayout}
type createChat1ChatUiChatInboxUnverified = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxUnverified']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxUnverified']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatInboxUnverified}
type createChat1ChatUiChatLoadGalleryHit = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatLoadGalleryHit}
type createChat1ChatUiChatMaybeMentionUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatMaybeMentionUpdate}
type createChat1ChatUiChatSearchBotHits = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchBotHits']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchBotHits}
type createChat1ChatUiChatSearchConvHits = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchConvHits']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchConvHits}
type createChat1ChatUiChatSearchDone = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchDone']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchDone']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchDone}
type createChat1ChatUiChatSearchHit = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchHit']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchHit']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchHit}
type createChat1ChatUiChatSearchInboxDone = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxDone']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxDone']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchInboxDone}
type createChat1ChatUiChatSearchInboxHit = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchInboxHit}
type createChat1ChatUiChatSearchInboxStart = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxStart']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxStart']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchInboxStart}
type createChat1ChatUiChatSearchIndexStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchIndexStatus}
type createChat1ChatUiChatSearchTeamHits = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatSearchTeamHits}
type createChat1ChatUiChatShowManageChannels = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatShowManageChannels}
type createChat1ChatUiChatStellarDataConfirm = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatStellarDataConfirm}
type createChat1ChatUiChatStellarDataError = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataError']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataError']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatStellarDataError}
type createChat1ChatUiChatStellarDone = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDone']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDone']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatStellarDone}
type createChat1ChatUiChatStellarShowConfirm = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarShowConfirm']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarShowConfirm']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatStellarShowConfirm}
type createChat1ChatUiChatThreadCached = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadCached']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadCached']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatThreadCached}
type createChat1ChatUiChatThreadFull = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadFull']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadFull']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatThreadFull}
type createChat1ChatUiChatThreadStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadStatus']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadStatus']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatThreadStatus}
type createChat1ChatUiChatWatchPosition = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatWatchPosition']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatWatchPosition']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatWatchPosition}
type createChat1ChatUiTriggerContactSync = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.triggerContactSync']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.triggerContactSync']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiTriggerContactSync}
type createChat1NotifyChatChatArchiveComplete = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatArchiveComplete']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatArchiveComplete}
type createChat1NotifyChatChatArchiveProgress = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatArchiveProgress']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatArchiveProgress}
type createChat1NotifyChatChatAttachmentDownloadComplete = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentDownloadComplete']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatAttachmentDownloadComplete}
type createChat1NotifyChatChatAttachmentDownloadProgress = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentDownloadProgress']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatAttachmentDownloadProgress}
type createChat1NotifyChatChatAttachmentUploadProgress = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentUploadProgress']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatAttachmentUploadProgress}
type createChat1NotifyChatChatAttachmentUploadStart = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentUploadStart']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatAttachmentUploadStart}
type createChat1NotifyChatChatConvUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatConvUpdate']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatConvUpdate}
type createChat1NotifyChatChatIdentifyUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatIdentifyUpdate']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatIdentifyUpdate}
type createChat1NotifyChatChatInboxStale = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxStale']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatInboxStale}
type createChat1NotifyChatChatInboxSyncStarted = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxSyncStarted']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatInboxSyncStarted}
type createChat1NotifyChatChatInboxSynced = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxSynced']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatInboxSynced}
type createChat1NotifyChatChatJoinedConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatJoinedConversation']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatJoinedConversation}
type createChat1NotifyChatChatKBFSToImpteamUpgrade = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatKBFSToImpteamUpgrade']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatKBFSToImpteamUpgrade}
type createChat1NotifyChatChatLeftConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatLeftConversation']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatLeftConversation}
type createChat1NotifyChatChatParticipantsInfo = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatParticipantsInfo']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatParticipantsInfo}
type createChat1NotifyChatChatPaymentInfo = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatPaymentInfo']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatPaymentInfo}
type createChat1NotifyChatChatPromptUnfurl = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatPromptUnfurl']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatPromptUnfurl}
type createChat1NotifyChatChatRequestInfo = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatRequestInfo']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatRequestInfo}
type createChat1NotifyChatChatResetConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatResetConversation']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatResetConversation}
type createChat1NotifyChatChatSetConvRetention = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetConvRetention']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatSetConvRetention}
type createChat1NotifyChatChatSetConvSettings = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetConvSettings']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatSetConvSettings}
type createChat1NotifyChatChatSetTeamRetention = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetTeamRetention']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatSetTeamRetention}
type createChat1NotifyChatChatSubteamRename = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSubteamRename']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatSubteamRename}
type createChat1NotifyChatChatTLFFinalize = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTLFFinalize']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatTLFFinalize}
type createChat1NotifyChatChatTLFResolve = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTLFResolve']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatTLFResolve}
type createChat1NotifyChatChatThreadsStale = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatThreadsStale']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatThreadsStale}
type createChat1NotifyChatChatTypingUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTypingUpdate']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatTypingUpdate}
type createChat1NotifyChatChatWelcomeMessageLoaded = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatWelcomeMessageLoaded']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatChatWelcomeMessageLoaded}
type createChat1NotifyChatNewChatActivity = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.NewChatActivity']['inParam']
}) => {payload: typeof payload; type: typeof chat1NotifyChatNewChatActivity}
type createKeybase1GpgUiConfirmDuplicateKeyChosen = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmDuplicateKeyChosen']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmDuplicateKeyChosen']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiConfirmDuplicateKeyChosen}
type createKeybase1GpgUiConfirmImportSecretToExistingKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmImportSecretToExistingKey']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmImportSecretToExistingKey']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiConfirmImportSecretToExistingKey}
type createKeybase1GpgUiGetTTY = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.getTTY']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.getTTY']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiGetTTY}
type createKeybase1GpgUiSelectKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKey']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKey']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiSelectKey}
type createKeybase1GpgUiSelectKeyAndPushOption = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKeyAndPushOption']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKeyAndPushOption']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiSelectKeyAndPushOption}
type createKeybase1GpgUiSign = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.sign']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.sign']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiSign}
type createKeybase1GpgUiWantToAddGPGKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.wantToAddGPGKey']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.wantToAddGPGKey']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GpgUiWantToAddGPGKey}
type createKeybase1GregorUIPushOutOfBandMessages = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gregorUI.pushOutOfBandMessages']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gregorUI.pushOutOfBandMessages']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GregorUIPushOutOfBandMessages}
type createKeybase1GregorUIPushState = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gregorUI.pushState']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gregorUI.pushState']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1GregorUIPushState}
type createKeybase1HomeUIHomeUIRefresh = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.homeUI.homeUIRefresh']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.homeUI.homeUIRefresh']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1HomeUIHomeUIRefresh}
type createKeybase1Identify3UiIdentify3Result = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Result']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Result']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3Result}
type createKeybase1Identify3UiIdentify3ShowTracker = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3ShowTracker']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3ShowTracker']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3ShowTracker}
type createKeybase1Identify3UiIdentify3Summary = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Summary']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Summary']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3Summary}
type createKeybase1Identify3UiIdentify3TrackerTimedOut = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3TrackerTimedOut']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3TrackerTimedOut']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3TrackerTimedOut}
type createKeybase1Identify3UiIdentify3UpdateRow = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateRow']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateRow']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3UpdateRow}
type createKeybase1Identify3UiIdentify3UpdateUserCard = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateUserCard']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateUserCard']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3UpdateUserCard}
type createKeybase1Identify3UiIdentify3UserReset = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UserReset']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UserReset']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1Identify3UiIdentify3UserReset}
type createKeybase1IdentifyUiCancel = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.cancel']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.cancel']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiCancel}
type createKeybase1IdentifyUiConfirm = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.confirm']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.confirm']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiConfirm}
type createKeybase1IdentifyUiDelegateIdentifyUI = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.delegateIdentifyUI']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.delegateIdentifyUI']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDelegateIdentifyUI}
type createKeybase1IdentifyUiDismiss = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.dismiss']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.dismiss']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDismiss}
type createKeybase1IdentifyUiDisplayCryptocurrency = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayCryptocurrency']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayCryptocurrency']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDisplayCryptocurrency}
type createKeybase1IdentifyUiDisplayKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayKey']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayKey']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDisplayKey}
type createKeybase1IdentifyUiDisplayStellarAccount = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayStellarAccount']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayStellarAccount']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDisplayStellarAccount}
type createKeybase1IdentifyUiDisplayTLFCreateWithInvite = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTLFCreateWithInvite']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTLFCreateWithInvite']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDisplayTLFCreateWithInvite}
type createKeybase1IdentifyUiDisplayTrackStatement = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTrackStatement']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTrackStatement']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDisplayTrackStatement}
type createKeybase1IdentifyUiDisplayUserCard = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayUserCard']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayUserCard']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiDisplayUserCard}
type createKeybase1IdentifyUiFinish = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finish']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.finish']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiFinish}
type createKeybase1IdentifyUiFinishSocialProofCheck = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finishSocialProofCheck']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.finishSocialProofCheck']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiFinishSocialProofCheck}
type createKeybase1IdentifyUiFinishWebProofCheck = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finishWebProofCheck']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.finishWebProofCheck']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiFinishWebProofCheck}
type createKeybase1IdentifyUiLaunchNetworkChecks = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.launchNetworkChecks']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.launchNetworkChecks']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiLaunchNetworkChecks}
type createKeybase1IdentifyUiReportLastTrack = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.reportLastTrack']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.reportLastTrack']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiReportLastTrack}
type createKeybase1IdentifyUiReportTrackToken = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.reportTrackToken']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.reportTrackToken']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiReportTrackToken}
type createKeybase1IdentifyUiStart = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.start']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.start']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1IdentifyUiStart}
type createKeybase1LogUiLog = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.logUi.log']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logUi.log']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LogUiLog}
type createKeybase1LoginUiChooseDeviceToRecoverWith = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.chooseDeviceToRecoverWith']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.chooseDeviceToRecoverWith']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiChooseDeviceToRecoverWith}
type createKeybase1LoginUiDisplayPaperKeyPhrase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayPaperKeyPhrase']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayPaperKeyPhrase']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiDisplayPaperKeyPhrase}
type createKeybase1LoginUiDisplayPrimaryPaperKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayPrimaryPaperKey']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.displayPrimaryPaperKey']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiDisplayPrimaryPaperKey}
type createKeybase1LoginUiDisplayResetMessage = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetMessage']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetMessage']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiDisplayResetMessage}
type createKeybase1LoginUiDisplayResetProgress = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetProgress']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetProgress']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiDisplayResetProgress}
type createKeybase1LoginUiExplainDeviceRecovery = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiExplainDeviceRecovery}
type createKeybase1LoginUiGetEmailOrUsername = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.getEmailOrUsername']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.getEmailOrUsername']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiGetEmailOrUsername}
type createKeybase1LoginUiPromptPassphraseRecovery = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptPassphraseRecovery']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.promptPassphraseRecovery']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiPromptPassphraseRecovery}
type createKeybase1LoginUiPromptResetAccount = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiPromptResetAccount}
type createKeybase1LoginUiPromptRevokePaperKeys = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptRevokePaperKeys']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.promptRevokePaperKeys']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LoginUiPromptRevokePaperKeys}
type createKeybase1LogsendPrepareLogsend = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.logsend.prepareLogsend']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logsend.prepareLogsend']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LogsendPrepareLogsend}
type createKeybase1NotifyAppExit = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyApp.exit']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyApp.exit']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyAppExit}
type createKeybase1NotifyAuditBoxAuditError = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyAudit.boxAuditError']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyAuditBoxAuditError}
type createKeybase1NotifyAuditRootAuditError = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyAudit.rootAuditError']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyAuditRootAuditError}
type createKeybase1NotifyBadgesBadgeState = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyBadges.badgeState']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyBadgesBadgeState}
type createKeybase1NotifyCanUserPerformCanUserPerformChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyCanUserPerform.canUserPerformChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyCanUserPerformCanUserPerformChanged}
type createKeybase1NotifyDeviceCloneDeviceCloneCountChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyDeviceClone.deviceCloneCountChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyDeviceCloneDeviceCloneCountChanged}
type createKeybase1NotifyEmailAddressEmailAddressVerified = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailAddressVerified']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailAddressVerified']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyEmailAddressEmailAddressVerified}
type createKeybase1NotifyEmailAddressEmailsChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailsChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailsChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyEmailAddressEmailsChanged}
type createKeybase1NotifyEphemeralNewTeamEk = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeamEk']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyEphemeralNewTeamEk}
type createKeybase1NotifyEphemeralNewTeambotEk = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeambotEk']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeambotEk']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyEphemeralNewTeambotEk}
type createKeybase1NotifyEphemeralTeambotEkNeeded = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.teambotEkNeeded']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.teambotEkNeeded']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyEphemeralTeambotEkNeeded}
type createKeybase1NotifyFSFSActivity = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSActivity']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSActivity}
type createKeybase1NotifyFSFSEditListResponse = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSEditListResponse']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSEditListResponse']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSEditListResponse}
type createKeybase1NotifyFSFSFavoritesChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSFavoritesChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSFavoritesChanged']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSFavoritesChanged}
type createKeybase1NotifyFSFSOnlineStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOnlineStatusChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOnlineStatusChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSOnlineStatusChanged}
type createKeybase1NotifyFSFSOverallSyncStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSOverallSyncStatusChanged}
type createKeybase1NotifyFSFSPathUpdated = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSPathUpdated']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSPathUpdated}
type createKeybase1NotifyFSFSSubscriptionNotify = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotify']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotify']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSSubscriptionNotify}
type createKeybase1NotifyFSFSSubscriptionNotifyPath = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotifyPath']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotifyPath']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSSubscriptionNotifyPath}
type createKeybase1NotifyFSFSSyncActivity = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncActivity']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncActivity']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSSyncActivity}
type createKeybase1NotifyFSFSSyncStatusResponse = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncStatusResponse']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncStatusResponse']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSSyncStatusResponse}
type createKeybase1NotifyFavoritesFavoritesChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFavorites.favoritesChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyFavoritesFavoritesChanged}
type createKeybase1NotifyFeaturedBotsFeaturedBotsUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFeaturedBots.featuredBotsUpdate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFeaturedBots.featuredBotsUpdate']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFeaturedBotsFeaturedBotsUpdate}
type createKeybase1NotifyInviteFriendsUpdateInviteCounts = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyInviteFriends.updateInviteCounts']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyInviteFriends.updateInviteCounts']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyInviteFriendsUpdateInviteCounts}
type createKeybase1NotifyKeyfamilyKeyfamilyChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyKeyfamily.keyfamilyChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyKeyfamily.keyfamilyChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyKeyfamilyKeyfamilyChanged}
type createKeybase1NotifyPGPPgpKeyInSecretStoreFile = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyPGPPgpKeyInSecretStoreFile}
type createKeybase1NotifyPaperKeyPaperKeyCached = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPaperKey.paperKeyCached']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyPaperKey.paperKeyCached']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyPaperKeyPaperKeyCached}
type createKeybase1NotifyPhoneNumberPhoneNumbersChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPhoneNumber.phoneNumbersChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPhoneNumber.phoneNumbersChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyPhoneNumberPhoneNumbersChanged}
type createKeybase1NotifyRuntimeStatsRuntimeStatsUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyRuntimeStats.runtimeStatsUpdate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyRuntimeStats.runtimeStatsUpdate']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyRuntimeStatsRuntimeStatsUpdate}
type createKeybase1NotifySaltpackSaltpackOperationDone = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationDone']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationDone']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifySaltpackSaltpackOperationDone}
type createKeybase1NotifySaltpackSaltpackOperationProgress = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationProgress']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationProgress']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifySaltpackSaltpackOperationProgress}
type createKeybase1NotifySaltpackSaltpackOperationStart = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationStart']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationStart']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifySaltpackSaltpackOperationStart}
type createKeybase1NotifyServiceHTTPSrvInfoUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.HTTPSrvInfoUpdate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyService.HTTPSrvInfoUpdate']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyServiceHTTPSrvInfoUpdate}
type createKeybase1NotifyServiceHandleKeybaseLink = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.handleKeybaseLink']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyService.handleKeybaseLink']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyServiceHandleKeybaseLink}
type createKeybase1NotifyServiceShutdown = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.shutdown']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyService.shutdown']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyServiceShutdown}
type createKeybase1NotifySessionClientOutOfDate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.clientOutOfDate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifySession.clientOutOfDate']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifySessionClientOutOfDate}
type createKeybase1NotifySessionLoggedIn = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedIn']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedIn']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifySessionLoggedIn}
type createKeybase1NotifySessionLoggedOut = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedOut']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifySessionLoggedOut}
type createKeybase1NotifySimpleFSSimpleFSArchiveStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifySimpleFSSimpleFSArchiveStatusChanged}
type createKeybase1NotifyTeamAvatarUpdated = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.avatarUpdated']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.avatarUpdated']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamAvatarUpdated}
type createKeybase1NotifyTeamNewlyAddedToTeam = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.newlyAddedToTeam']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.newlyAddedToTeam']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamNewlyAddedToTeam}
type createKeybase1NotifyTeamTeamAbandoned = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamAbandoned']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamAbandoned']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamAbandoned}
type createKeybase1NotifyTeamTeamChangedByID = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamChangedByID}
type createKeybase1NotifyTeamTeamChangedByName = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByName']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByName']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamChangedByName}
type createKeybase1NotifyTeamTeamDeleted = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamDeleted']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamDeleted']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamDeleted}
type createKeybase1NotifyTeamTeamExit = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamExit']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamExit']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamExit}
type createKeybase1NotifyTeamTeamMetadataUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamMetadataUpdate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamMetadataUpdate']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamMetadataUpdate}
type createKeybase1NotifyTeamTeamRoleMapChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamRoleMapChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamRoleMapChanged']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamRoleMapChanged}
type createKeybase1NotifyTeamTeamTreeMembershipsDone = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsDone']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsDone']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamTreeMembershipsDone}
type createKeybase1NotifyTeamTeamTreeMembershipsPartial = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsPartial']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsPartial']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamTreeMembershipsPartial}
type createKeybase1NotifyTeambotNewTeambotKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeambot.newTeambotKey']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyTeambotNewTeambotKey}
type createKeybase1NotifyTeambotTeambotKeyNeeded = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeambot.teambotKeyNeeded']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTeambot.teambotKeyNeeded']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeambotTeambotKeyNeeded}
type createKeybase1NotifyTrackingNotifyUserBlocked = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.notifyUserBlocked']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTracking.notifyUserBlocked']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTrackingNotifyUserBlocked}
type createKeybase1NotifyTrackingTrackingChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyTrackingTrackingChanged}
type createKeybase1NotifyTrackingTrackingInfo = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingInfo']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingInfo']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTrackingTrackingInfo}
type createKeybase1NotifyUsersIdentifyUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.identifyUpdate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyUsers.identifyUpdate']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyUsersIdentifyUpdate}
type createKeybase1NotifyUsersPasswordChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.passwordChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyUsers.passwordChanged']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyUsersPasswordChanged}
type createKeybase1NotifyUsersUserChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.userChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyUsersUserChanged}
type createKeybase1NotifyUsersWebOfTrustChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.webOfTrustChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyUsersWebOfTrustChanged}
type createKeybase1PgpUiFinished = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.finished']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.finished']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1PgpUiFinished}
type createKeybase1PgpUiKeyGenerated = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.keyGenerated']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.keyGenerated']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1PgpUiKeyGenerated}
type createKeybase1PgpUiOutputPGPWarning = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputPGPWarning']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputPGPWarning']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1PgpUiOutputPGPWarning}
type createKeybase1PgpUiOutputSignatureNonKeybase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureNonKeybase']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureNonKeybase']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1PgpUiOutputSignatureNonKeybase}
type createKeybase1PgpUiOutputSignatureSuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccess']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccess']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1PgpUiOutputSignatureSuccess}
type createKeybase1PgpUiShouldPushPrivate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.shouldPushPrivate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.shouldPushPrivate']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1PgpUiShouldPushPrivate}
type createKeybase1ProveUiChecking = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.checking']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.checking']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiChecking}
type createKeybase1ProveUiContinueChecking = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.continueChecking']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.continueChecking']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiContinueChecking}
type createKeybase1ProveUiDisplayRecheckWarning = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.displayRecheckWarning']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.displayRecheckWarning']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiDisplayRecheckWarning}
type createKeybase1ProveUiOkToCheck = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.okToCheck']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.okToCheck']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiOkToCheck}
type createKeybase1ProveUiOutputInstructions = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.outputInstructions']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.outputInstructions']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiOutputInstructions}
type createKeybase1ProveUiOutputPrechecks = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.outputPrechecks']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.outputPrechecks']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiOutputPrechecks}
type createKeybase1ProveUiPreProofWarning = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.preProofWarning']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.preProofWarning']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiPreProofWarning}
type createKeybase1ProveUiPromptOverwrite = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.promptOverwrite']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.promptOverwrite']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiPromptOverwrite}
type createKeybase1ProveUiPromptUsername = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.promptUsername']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.promptUsername']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProveUiPromptUsername}
type createKeybase1ProvisionUiChooseDevice = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDevice']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDevice']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiChooseDevice}
type createKeybase1ProvisionUiChooseDeviceType = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDeviceType']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDeviceType']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiChooseDeviceType}
type createKeybase1ProvisionUiChooseGPGMethod = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseGPGMethod']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseGPGMethod']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiChooseGPGMethod}
type createKeybase1ProvisionUiChooseProvisioningMethod = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseProvisioningMethod']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseProvisioningMethod']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiChooseProvisioningMethod}
type createKeybase1ProvisionUiDisplayAndPromptSecret = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplayAndPromptSecret']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplayAndPromptSecret']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiDisplayAndPromptSecret}
type createKeybase1ProvisionUiDisplaySecretExchanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplaySecretExchanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplaySecretExchanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiDisplaySecretExchanged}
type createKeybase1ProvisionUiPromptNewDeviceName = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.PromptNewDeviceName']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.PromptNewDeviceName']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiPromptNewDeviceName}
type createKeybase1ProvisionUiProvisioneeSuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisioneeSuccess']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisioneeSuccess']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiProvisioneeSuccess}
type createKeybase1ProvisionUiProvisionerSuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisionerSuccess']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisionerSuccess']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiProvisionerSuccess}
type createKeybase1ProvisionUiSwitchToGPGSignOK = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.switchToGPGSignOK']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.switchToGPGSignOK']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1ProvisionUiSwitchToGPGSignOK}
type createKeybase1ReachabilityReachabilityChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.reachability.reachabilityChanged']['inParam']
}) => {payload: typeof payload; type: typeof keybase1ReachabilityReachabilityChanged}
type createKeybase1RekeyUIDelegateRekeyUI = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.delegateRekeyUI']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.delegateRekeyUI']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1RekeyUIDelegateRekeyUI}
type createKeybase1RekeyUIRefresh = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.refresh']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.refresh']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1RekeyUIRefresh}
type createKeybase1RekeyUIRekeySendEvent = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.rekeySendEvent']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.rekeySendEvent']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1RekeyUIRekeySendEvent}
type createKeybase1SaltpackUiSaltpackPromptForDecrypt = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackPromptForDecrypt']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackPromptForDecrypt']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1SaltpackUiSaltpackPromptForDecrypt}
type createKeybase1SaltpackUiSaltpackVerifyBadSender = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifyBadSender']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifyBadSender']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1SaltpackUiSaltpackVerifyBadSender}
type createKeybase1SaltpackUiSaltpackVerifySuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifySuccess']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifySuccess']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1SaltpackUiSaltpackVerifySuccess}
type createKeybase1SecretUiGetPassphrase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1SecretUiGetPassphrase}
type createKeybase1StreamUiClose = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.close']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.close']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1StreamUiClose}
type createKeybase1StreamUiRead = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.read']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.read']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1StreamUiRead}
type createKeybase1StreamUiReset = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.reset']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.reset']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1StreamUiReset}
type createKeybase1StreamUiWrite = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.write']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.write']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1StreamUiWrite}
type createKeybase1TeamsUiConfirmInviteLinkAccept = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmInviteLinkAccept']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmInviteLinkAccept']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1TeamsUiConfirmInviteLinkAccept}
type createKeybase1TeamsUiConfirmRootTeamDelete = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmRootTeamDelete']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmRootTeamDelete']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1TeamsUiConfirmRootTeamDelete}
type createKeybase1TeamsUiConfirmSubteamDelete = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmSubteamDelete']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmSubteamDelete']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1TeamsUiConfirmSubteamDelete}
type createKeybase1UiPromptYesNo = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.ui.promptYesNo']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.ui.promptYesNo']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1UiPromptYesNo}
type createStellar1NotifyAccountDetailsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.accountDetailsUpdate']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyAccountDetailsUpdate}
type createStellar1NotifyAccountsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.accountsUpdate']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyAccountsUpdate}
type createStellar1NotifyPaymentNotification = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.paymentNotification']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyPaymentNotification}
type createStellar1NotifyPaymentStatusNotification = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.paymentStatusNotification']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyPaymentStatusNotification}
type createStellar1NotifyPendingPaymentsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.pendingPaymentsUpdate']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyPendingPaymentsUpdate}
type createStellar1NotifyRecentPaymentsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.recentPaymentsUpdate']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyRecentPaymentsUpdate}
type createStellar1NotifyRequestStatusNotification = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.requestStatusNotification']['inParam']
}) => {payload: typeof payload; type: typeof stellar1NotifyRequestStatusNotification}
type createStellar1UiPaymentReviewed = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.ui.paymentReviewed']['inParam']
  response: {
    error: stellar1Types.IncomingErrorCallback
    result: (param: stellar1Types.MessageTypes['stellar.1.ui.paymentReviewed']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof stellar1UiPaymentReviewed}

// Action Payloads
export type Chat1ChatUiChatBotCommandsUpdateStatusPayload =
  ReturnType<createChat1ChatUiChatBotCommandsUpdateStatus>
export type Chat1ChatUiChatClearWatchPayload = ReturnType<createChat1ChatUiChatClearWatch>
export type Chat1ChatUiChatCoinFlipStatusPayload = ReturnType<createChat1ChatUiChatCoinFlipStatus>
export type Chat1ChatUiChatCommandMarkdownPayload = ReturnType<createChat1ChatUiChatCommandMarkdown>
export type Chat1ChatUiChatCommandStatusPayload = ReturnType<createChat1ChatUiChatCommandStatus>
export type Chat1ChatUiChatConfirmChannelDeletePayload = ReturnType<createChat1ChatUiChatConfirmChannelDelete>
export type Chat1ChatUiChatGiphySearchResultsPayload = ReturnType<createChat1ChatUiChatGiphySearchResults>
export type Chat1ChatUiChatGiphyToggleResultWindowPayload =
  ReturnType<createChat1ChatUiChatGiphyToggleResultWindow>
export type Chat1ChatUiChatInboxConversationPayload = ReturnType<createChat1ChatUiChatInboxConversation>
export type Chat1ChatUiChatInboxFailedPayload = ReturnType<createChat1ChatUiChatInboxFailed>
export type Chat1ChatUiChatInboxLayoutPayload = ReturnType<createChat1ChatUiChatInboxLayout>
export type Chat1ChatUiChatInboxUnverifiedPayload = ReturnType<createChat1ChatUiChatInboxUnverified>
export type Chat1ChatUiChatLoadGalleryHitPayload = ReturnType<createChat1ChatUiChatLoadGalleryHit>
export type Chat1ChatUiChatMaybeMentionUpdatePayload = ReturnType<createChat1ChatUiChatMaybeMentionUpdate>
export type Chat1ChatUiChatSearchBotHitsPayload = ReturnType<createChat1ChatUiChatSearchBotHits>
export type Chat1ChatUiChatSearchConvHitsPayload = ReturnType<createChat1ChatUiChatSearchConvHits>
export type Chat1ChatUiChatSearchDonePayload = ReturnType<createChat1ChatUiChatSearchDone>
export type Chat1ChatUiChatSearchHitPayload = ReturnType<createChat1ChatUiChatSearchHit>
export type Chat1ChatUiChatSearchInboxDonePayload = ReturnType<createChat1ChatUiChatSearchInboxDone>
export type Chat1ChatUiChatSearchInboxHitPayload = ReturnType<createChat1ChatUiChatSearchInboxHit>
export type Chat1ChatUiChatSearchInboxStartPayload = ReturnType<createChat1ChatUiChatSearchInboxStart>
export type Chat1ChatUiChatSearchIndexStatusPayload = ReturnType<createChat1ChatUiChatSearchIndexStatus>
export type Chat1ChatUiChatSearchTeamHitsPayload = ReturnType<createChat1ChatUiChatSearchTeamHits>
export type Chat1ChatUiChatShowManageChannelsPayload = ReturnType<createChat1ChatUiChatShowManageChannels>
export type Chat1ChatUiChatStellarDataConfirmPayload = ReturnType<createChat1ChatUiChatStellarDataConfirm>
export type Chat1ChatUiChatStellarDataErrorPayload = ReturnType<createChat1ChatUiChatStellarDataError>
export type Chat1ChatUiChatStellarDonePayload = ReturnType<createChat1ChatUiChatStellarDone>
export type Chat1ChatUiChatStellarShowConfirmPayload = ReturnType<createChat1ChatUiChatStellarShowConfirm>
export type Chat1ChatUiChatThreadCachedPayload = ReturnType<createChat1ChatUiChatThreadCached>
export type Chat1ChatUiChatThreadFullPayload = ReturnType<createChat1ChatUiChatThreadFull>
export type Chat1ChatUiChatThreadStatusPayload = ReturnType<createChat1ChatUiChatThreadStatus>
export type Chat1ChatUiChatWatchPositionPayload = ReturnType<createChat1ChatUiChatWatchPosition>
export type Chat1ChatUiTriggerContactSyncPayload = ReturnType<createChat1ChatUiTriggerContactSync>
export type Chat1NotifyChatChatArchiveCompletePayload = ReturnType<createChat1NotifyChatChatArchiveComplete>
export type Chat1NotifyChatChatArchiveProgressPayload = ReturnType<createChat1NotifyChatChatArchiveProgress>
export type Chat1NotifyChatChatAttachmentDownloadCompletePayload =
  ReturnType<createChat1NotifyChatChatAttachmentDownloadComplete>
export type Chat1NotifyChatChatAttachmentDownloadProgressPayload =
  ReturnType<createChat1NotifyChatChatAttachmentDownloadProgress>
export type Chat1NotifyChatChatAttachmentUploadProgressPayload =
  ReturnType<createChat1NotifyChatChatAttachmentUploadProgress>
export type Chat1NotifyChatChatAttachmentUploadStartPayload =
  ReturnType<createChat1NotifyChatChatAttachmentUploadStart>
export type Chat1NotifyChatChatConvUpdatePayload = ReturnType<createChat1NotifyChatChatConvUpdate>
export type Chat1NotifyChatChatIdentifyUpdatePayload = ReturnType<createChat1NotifyChatChatIdentifyUpdate>
export type Chat1NotifyChatChatInboxStalePayload = ReturnType<createChat1NotifyChatChatInboxStale>
export type Chat1NotifyChatChatInboxSyncStartedPayload = ReturnType<createChat1NotifyChatChatInboxSyncStarted>
export type Chat1NotifyChatChatInboxSyncedPayload = ReturnType<createChat1NotifyChatChatInboxSynced>
export type Chat1NotifyChatChatJoinedConversationPayload =
  ReturnType<createChat1NotifyChatChatJoinedConversation>
export type Chat1NotifyChatChatKBFSToImpteamUpgradePayload =
  ReturnType<createChat1NotifyChatChatKBFSToImpteamUpgrade>
export type Chat1NotifyChatChatLeftConversationPayload = ReturnType<createChat1NotifyChatChatLeftConversation>
export type Chat1NotifyChatChatParticipantsInfoPayload = ReturnType<createChat1NotifyChatChatParticipantsInfo>
export type Chat1NotifyChatChatPaymentInfoPayload = ReturnType<createChat1NotifyChatChatPaymentInfo>
export type Chat1NotifyChatChatPromptUnfurlPayload = ReturnType<createChat1NotifyChatChatPromptUnfurl>
export type Chat1NotifyChatChatRequestInfoPayload = ReturnType<createChat1NotifyChatChatRequestInfo>
export type Chat1NotifyChatChatResetConversationPayload =
  ReturnType<createChat1NotifyChatChatResetConversation>
export type Chat1NotifyChatChatSetConvRetentionPayload = ReturnType<createChat1NotifyChatChatSetConvRetention>
export type Chat1NotifyChatChatSetConvSettingsPayload = ReturnType<createChat1NotifyChatChatSetConvSettings>
export type Chat1NotifyChatChatSetTeamRetentionPayload = ReturnType<createChat1NotifyChatChatSetTeamRetention>
export type Chat1NotifyChatChatSubteamRenamePayload = ReturnType<createChat1NotifyChatChatSubteamRename>
export type Chat1NotifyChatChatTLFFinalizePayload = ReturnType<createChat1NotifyChatChatTLFFinalize>
export type Chat1NotifyChatChatTLFResolvePayload = ReturnType<createChat1NotifyChatChatTLFResolve>
export type Chat1NotifyChatChatThreadsStalePayload = ReturnType<createChat1NotifyChatChatThreadsStale>
export type Chat1NotifyChatChatTypingUpdatePayload = ReturnType<createChat1NotifyChatChatTypingUpdate>
export type Chat1NotifyChatChatWelcomeMessageLoadedPayload =
  ReturnType<createChat1NotifyChatChatWelcomeMessageLoaded>
export type Chat1NotifyChatNewChatActivityPayload = ReturnType<createChat1NotifyChatNewChatActivity>
export type Keybase1GpgUiConfirmDuplicateKeyChosenPayload =
  ReturnType<createKeybase1GpgUiConfirmDuplicateKeyChosen>
export type Keybase1GpgUiConfirmImportSecretToExistingKeyPayload =
  ReturnType<createKeybase1GpgUiConfirmImportSecretToExistingKey>
export type Keybase1GpgUiGetTTYPayload = ReturnType<createKeybase1GpgUiGetTTY>
export type Keybase1GpgUiSelectKeyAndPushOptionPayload = ReturnType<createKeybase1GpgUiSelectKeyAndPushOption>
export type Keybase1GpgUiSelectKeyPayload = ReturnType<createKeybase1GpgUiSelectKey>
export type Keybase1GpgUiSignPayload = ReturnType<createKeybase1GpgUiSign>
export type Keybase1GpgUiWantToAddGPGKeyPayload = ReturnType<createKeybase1GpgUiWantToAddGPGKey>
export type Keybase1GregorUIPushOutOfBandMessagesPayload =
  ReturnType<createKeybase1GregorUIPushOutOfBandMessages>
export type Keybase1GregorUIPushStatePayload = ReturnType<createKeybase1GregorUIPushState>
export type Keybase1HomeUIHomeUIRefreshPayload = ReturnType<createKeybase1HomeUIHomeUIRefresh>
export type Keybase1Identify3UiIdentify3ResultPayload = ReturnType<createKeybase1Identify3UiIdentify3Result>
export type Keybase1Identify3UiIdentify3ShowTrackerPayload =
  ReturnType<createKeybase1Identify3UiIdentify3ShowTracker>
export type Keybase1Identify3UiIdentify3SummaryPayload = ReturnType<createKeybase1Identify3UiIdentify3Summary>
export type Keybase1Identify3UiIdentify3TrackerTimedOutPayload =
  ReturnType<createKeybase1Identify3UiIdentify3TrackerTimedOut>
export type Keybase1Identify3UiIdentify3UpdateRowPayload =
  ReturnType<createKeybase1Identify3UiIdentify3UpdateRow>
export type Keybase1Identify3UiIdentify3UpdateUserCardPayload =
  ReturnType<createKeybase1Identify3UiIdentify3UpdateUserCard>
export type Keybase1Identify3UiIdentify3UserResetPayload =
  ReturnType<createKeybase1Identify3UiIdentify3UserReset>
export type Keybase1IdentifyUiCancelPayload = ReturnType<createKeybase1IdentifyUiCancel>
export type Keybase1IdentifyUiConfirmPayload = ReturnType<createKeybase1IdentifyUiConfirm>
export type Keybase1IdentifyUiDelegateIdentifyUIPayload =
  ReturnType<createKeybase1IdentifyUiDelegateIdentifyUI>
export type Keybase1IdentifyUiDismissPayload = ReturnType<createKeybase1IdentifyUiDismiss>
export type Keybase1IdentifyUiDisplayCryptocurrencyPayload =
  ReturnType<createKeybase1IdentifyUiDisplayCryptocurrency>
export type Keybase1IdentifyUiDisplayKeyPayload = ReturnType<createKeybase1IdentifyUiDisplayKey>
export type Keybase1IdentifyUiDisplayStellarAccountPayload =
  ReturnType<createKeybase1IdentifyUiDisplayStellarAccount>
export type Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload =
  ReturnType<createKeybase1IdentifyUiDisplayTLFCreateWithInvite>
export type Keybase1IdentifyUiDisplayTrackStatementPayload =
  ReturnType<createKeybase1IdentifyUiDisplayTrackStatement>
export type Keybase1IdentifyUiDisplayUserCardPayload = ReturnType<createKeybase1IdentifyUiDisplayUserCard>
export type Keybase1IdentifyUiFinishPayload = ReturnType<createKeybase1IdentifyUiFinish>
export type Keybase1IdentifyUiFinishSocialProofCheckPayload =
  ReturnType<createKeybase1IdentifyUiFinishSocialProofCheck>
export type Keybase1IdentifyUiFinishWebProofCheckPayload =
  ReturnType<createKeybase1IdentifyUiFinishWebProofCheck>
export type Keybase1IdentifyUiLaunchNetworkChecksPayload =
  ReturnType<createKeybase1IdentifyUiLaunchNetworkChecks>
export type Keybase1IdentifyUiReportLastTrackPayload = ReturnType<createKeybase1IdentifyUiReportLastTrack>
export type Keybase1IdentifyUiReportTrackTokenPayload = ReturnType<createKeybase1IdentifyUiReportTrackToken>
export type Keybase1IdentifyUiStartPayload = ReturnType<createKeybase1IdentifyUiStart>
export type Keybase1LogUiLogPayload = ReturnType<createKeybase1LogUiLog>
export type Keybase1LoginUiChooseDeviceToRecoverWithPayload =
  ReturnType<createKeybase1LoginUiChooseDeviceToRecoverWith>
export type Keybase1LoginUiDisplayPaperKeyPhrasePayload =
  ReturnType<createKeybase1LoginUiDisplayPaperKeyPhrase>
export type Keybase1LoginUiDisplayPrimaryPaperKeyPayload =
  ReturnType<createKeybase1LoginUiDisplayPrimaryPaperKey>
export type Keybase1LoginUiDisplayResetMessagePayload = ReturnType<createKeybase1LoginUiDisplayResetMessage>
export type Keybase1LoginUiDisplayResetProgressPayload = ReturnType<createKeybase1LoginUiDisplayResetProgress>
export type Keybase1LoginUiExplainDeviceRecoveryPayload =
  ReturnType<createKeybase1LoginUiExplainDeviceRecovery>
export type Keybase1LoginUiGetEmailOrUsernamePayload = ReturnType<createKeybase1LoginUiGetEmailOrUsername>
export type Keybase1LoginUiPromptPassphraseRecoveryPayload =
  ReturnType<createKeybase1LoginUiPromptPassphraseRecovery>
export type Keybase1LoginUiPromptResetAccountPayload = ReturnType<createKeybase1LoginUiPromptResetAccount>
export type Keybase1LoginUiPromptRevokePaperKeysPayload =
  ReturnType<createKeybase1LoginUiPromptRevokePaperKeys>
export type Keybase1LogsendPrepareLogsendPayload = ReturnType<createKeybase1LogsendPrepareLogsend>
export type Keybase1NotifyAppExitPayload = ReturnType<createKeybase1NotifyAppExit>
export type Keybase1NotifyAuditBoxAuditErrorPayload = ReturnType<createKeybase1NotifyAuditBoxAuditError>
export type Keybase1NotifyAuditRootAuditErrorPayload = ReturnType<createKeybase1NotifyAuditRootAuditError>
export type Keybase1NotifyBadgesBadgeStatePayload = ReturnType<createKeybase1NotifyBadgesBadgeState>
export type Keybase1NotifyCanUserPerformCanUserPerformChangedPayload =
  ReturnType<createKeybase1NotifyCanUserPerformCanUserPerformChanged>
export type Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload =
  ReturnType<createKeybase1NotifyDeviceCloneDeviceCloneCountChanged>
export type Keybase1NotifyEmailAddressEmailAddressVerifiedPayload =
  ReturnType<createKeybase1NotifyEmailAddressEmailAddressVerified>
export type Keybase1NotifyEmailAddressEmailsChangedPayload =
  ReturnType<createKeybase1NotifyEmailAddressEmailsChanged>
export type Keybase1NotifyEphemeralNewTeamEkPayload = ReturnType<createKeybase1NotifyEphemeralNewTeamEk>
export type Keybase1NotifyEphemeralNewTeambotEkPayload = ReturnType<createKeybase1NotifyEphemeralNewTeambotEk>
export type Keybase1NotifyEphemeralTeambotEkNeededPayload =
  ReturnType<createKeybase1NotifyEphemeralTeambotEkNeeded>
export type Keybase1NotifyFSFSActivityPayload = ReturnType<createKeybase1NotifyFSFSActivity>
export type Keybase1NotifyFSFSEditListResponsePayload = ReturnType<createKeybase1NotifyFSFSEditListResponse>
export type Keybase1NotifyFSFSFavoritesChangedPayload = ReturnType<createKeybase1NotifyFSFSFavoritesChanged>
export type Keybase1NotifyFSFSOnlineStatusChangedPayload =
  ReturnType<createKeybase1NotifyFSFSOnlineStatusChanged>
export type Keybase1NotifyFSFSOverallSyncStatusChangedPayload =
  ReturnType<createKeybase1NotifyFSFSOverallSyncStatusChanged>
export type Keybase1NotifyFSFSPathUpdatedPayload = ReturnType<createKeybase1NotifyFSFSPathUpdated>
export type Keybase1NotifyFSFSSubscriptionNotifyPathPayload =
  ReturnType<createKeybase1NotifyFSFSSubscriptionNotifyPath>
export type Keybase1NotifyFSFSSubscriptionNotifyPayload =
  ReturnType<createKeybase1NotifyFSFSSubscriptionNotify>
export type Keybase1NotifyFSFSSyncActivityPayload = ReturnType<createKeybase1NotifyFSFSSyncActivity>
export type Keybase1NotifyFSFSSyncStatusResponsePayload =
  ReturnType<createKeybase1NotifyFSFSSyncStatusResponse>
export type Keybase1NotifyFavoritesFavoritesChangedPayload =
  ReturnType<createKeybase1NotifyFavoritesFavoritesChanged>
export type Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload =
  ReturnType<createKeybase1NotifyFeaturedBotsFeaturedBotsUpdate>
export type Keybase1NotifyInviteFriendsUpdateInviteCountsPayload =
  ReturnType<createKeybase1NotifyInviteFriendsUpdateInviteCounts>
export type Keybase1NotifyKeyfamilyKeyfamilyChangedPayload =
  ReturnType<createKeybase1NotifyKeyfamilyKeyfamilyChanged>
export type Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload =
  ReturnType<createKeybase1NotifyPGPPgpKeyInSecretStoreFile>
export type Keybase1NotifyPaperKeyPaperKeyCachedPayload =
  ReturnType<createKeybase1NotifyPaperKeyPaperKeyCached>
export type Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload =
  ReturnType<createKeybase1NotifyPhoneNumberPhoneNumbersChanged>
export type Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload =
  ReturnType<createKeybase1NotifyRuntimeStatsRuntimeStatsUpdate>
export type Keybase1NotifySaltpackSaltpackOperationDonePayload =
  ReturnType<createKeybase1NotifySaltpackSaltpackOperationDone>
export type Keybase1NotifySaltpackSaltpackOperationProgressPayload =
  ReturnType<createKeybase1NotifySaltpackSaltpackOperationProgress>
export type Keybase1NotifySaltpackSaltpackOperationStartPayload =
  ReturnType<createKeybase1NotifySaltpackSaltpackOperationStart>
export type Keybase1NotifyServiceHTTPSrvInfoUpdatePayload =
  ReturnType<createKeybase1NotifyServiceHTTPSrvInfoUpdate>
export type Keybase1NotifyServiceHandleKeybaseLinkPayload =
  ReturnType<createKeybase1NotifyServiceHandleKeybaseLink>
export type Keybase1NotifyServiceShutdownPayload = ReturnType<createKeybase1NotifyServiceShutdown>
export type Keybase1NotifySessionClientOutOfDatePayload =
  ReturnType<createKeybase1NotifySessionClientOutOfDate>
export type Keybase1NotifySessionLoggedInPayload = ReturnType<createKeybase1NotifySessionLoggedIn>
export type Keybase1NotifySessionLoggedOutPayload = ReturnType<createKeybase1NotifySessionLoggedOut>
export type Keybase1NotifySimpleFSSimpleFSArchiveStatusChangedPayload =
  ReturnType<createKeybase1NotifySimpleFSSimpleFSArchiveStatusChanged>
export type Keybase1NotifyTeamAvatarUpdatedPayload = ReturnType<createKeybase1NotifyTeamAvatarUpdated>
export type Keybase1NotifyTeamNewlyAddedToTeamPayload = ReturnType<createKeybase1NotifyTeamNewlyAddedToTeam>
export type Keybase1NotifyTeamTeamAbandonedPayload = ReturnType<createKeybase1NotifyTeamTeamAbandoned>
export type Keybase1NotifyTeamTeamChangedByIDPayload = ReturnType<createKeybase1NotifyTeamTeamChangedByID>
export type Keybase1NotifyTeamTeamChangedByNamePayload = ReturnType<createKeybase1NotifyTeamTeamChangedByName>
export type Keybase1NotifyTeamTeamDeletedPayload = ReturnType<createKeybase1NotifyTeamTeamDeleted>
export type Keybase1NotifyTeamTeamExitPayload = ReturnType<createKeybase1NotifyTeamTeamExit>
export type Keybase1NotifyTeamTeamMetadataUpdatePayload =
  ReturnType<createKeybase1NotifyTeamTeamMetadataUpdate>
export type Keybase1NotifyTeamTeamRoleMapChangedPayload =
  ReturnType<createKeybase1NotifyTeamTeamRoleMapChanged>
export type Keybase1NotifyTeamTeamTreeMembershipsDonePayload =
  ReturnType<createKeybase1NotifyTeamTeamTreeMembershipsDone>
export type Keybase1NotifyTeamTeamTreeMembershipsPartialPayload =
  ReturnType<createKeybase1NotifyTeamTeamTreeMembershipsPartial>
export type Keybase1NotifyTeambotNewTeambotKeyPayload = ReturnType<createKeybase1NotifyTeambotNewTeambotKey>
export type Keybase1NotifyTeambotTeambotKeyNeededPayload =
  ReturnType<createKeybase1NotifyTeambotTeambotKeyNeeded>
export type Keybase1NotifyTrackingNotifyUserBlockedPayload =
  ReturnType<createKeybase1NotifyTrackingNotifyUserBlocked>
export type Keybase1NotifyTrackingTrackingChangedPayload =
  ReturnType<createKeybase1NotifyTrackingTrackingChanged>
export type Keybase1NotifyTrackingTrackingInfoPayload = ReturnType<createKeybase1NotifyTrackingTrackingInfo>
export type Keybase1NotifyUsersIdentifyUpdatePayload = ReturnType<createKeybase1NotifyUsersIdentifyUpdate>
export type Keybase1NotifyUsersPasswordChangedPayload = ReturnType<createKeybase1NotifyUsersPasswordChanged>
export type Keybase1NotifyUsersUserChangedPayload = ReturnType<createKeybase1NotifyUsersUserChanged>
export type Keybase1NotifyUsersWebOfTrustChangedPayload =
  ReturnType<createKeybase1NotifyUsersWebOfTrustChanged>
export type Keybase1PgpUiFinishedPayload = ReturnType<createKeybase1PgpUiFinished>
export type Keybase1PgpUiKeyGeneratedPayload = ReturnType<createKeybase1PgpUiKeyGenerated>
export type Keybase1PgpUiOutputPGPWarningPayload = ReturnType<createKeybase1PgpUiOutputPGPWarning>
export type Keybase1PgpUiOutputSignatureNonKeybasePayload =
  ReturnType<createKeybase1PgpUiOutputSignatureNonKeybase>
export type Keybase1PgpUiOutputSignatureSuccessPayload = ReturnType<createKeybase1PgpUiOutputSignatureSuccess>
export type Keybase1PgpUiShouldPushPrivatePayload = ReturnType<createKeybase1PgpUiShouldPushPrivate>
export type Keybase1ProveUiCheckingPayload = ReturnType<createKeybase1ProveUiChecking>
export type Keybase1ProveUiContinueCheckingPayload = ReturnType<createKeybase1ProveUiContinueChecking>
export type Keybase1ProveUiDisplayRecheckWarningPayload =
  ReturnType<createKeybase1ProveUiDisplayRecheckWarning>
export type Keybase1ProveUiOkToCheckPayload = ReturnType<createKeybase1ProveUiOkToCheck>
export type Keybase1ProveUiOutputInstructionsPayload = ReturnType<createKeybase1ProveUiOutputInstructions>
export type Keybase1ProveUiOutputPrechecksPayload = ReturnType<createKeybase1ProveUiOutputPrechecks>
export type Keybase1ProveUiPreProofWarningPayload = ReturnType<createKeybase1ProveUiPreProofWarning>
export type Keybase1ProveUiPromptOverwritePayload = ReturnType<createKeybase1ProveUiPromptOverwrite>
export type Keybase1ProveUiPromptUsernamePayload = ReturnType<createKeybase1ProveUiPromptUsername>
export type Keybase1ProvisionUiChooseDevicePayload = ReturnType<createKeybase1ProvisionUiChooseDevice>
export type Keybase1ProvisionUiChooseDeviceTypePayload = ReturnType<createKeybase1ProvisionUiChooseDeviceType>
export type Keybase1ProvisionUiChooseGPGMethodPayload = ReturnType<createKeybase1ProvisionUiChooseGPGMethod>
export type Keybase1ProvisionUiChooseProvisioningMethodPayload =
  ReturnType<createKeybase1ProvisionUiChooseProvisioningMethod>
export type Keybase1ProvisionUiDisplayAndPromptSecretPayload =
  ReturnType<createKeybase1ProvisionUiDisplayAndPromptSecret>
export type Keybase1ProvisionUiDisplaySecretExchangedPayload =
  ReturnType<createKeybase1ProvisionUiDisplaySecretExchanged>
export type Keybase1ProvisionUiPromptNewDeviceNamePayload =
  ReturnType<createKeybase1ProvisionUiPromptNewDeviceName>
export type Keybase1ProvisionUiProvisioneeSuccessPayload =
  ReturnType<createKeybase1ProvisionUiProvisioneeSuccess>
export type Keybase1ProvisionUiProvisionerSuccessPayload =
  ReturnType<createKeybase1ProvisionUiProvisionerSuccess>
export type Keybase1ProvisionUiSwitchToGPGSignOKPayload =
  ReturnType<createKeybase1ProvisionUiSwitchToGPGSignOK>
export type Keybase1ReachabilityReachabilityChangedPayload =
  ReturnType<createKeybase1ReachabilityReachabilityChanged>
export type Keybase1RekeyUIDelegateRekeyUIPayload = ReturnType<createKeybase1RekeyUIDelegateRekeyUI>
export type Keybase1RekeyUIRefreshPayload = ReturnType<createKeybase1RekeyUIRefresh>
export type Keybase1RekeyUIRekeySendEventPayload = ReturnType<createKeybase1RekeyUIRekeySendEvent>
export type Keybase1SaltpackUiSaltpackPromptForDecryptPayload =
  ReturnType<createKeybase1SaltpackUiSaltpackPromptForDecrypt>
export type Keybase1SaltpackUiSaltpackVerifyBadSenderPayload =
  ReturnType<createKeybase1SaltpackUiSaltpackVerifyBadSender>
export type Keybase1SaltpackUiSaltpackVerifySuccessPayload =
  ReturnType<createKeybase1SaltpackUiSaltpackVerifySuccess>
export type Keybase1SecretUiGetPassphrasePayload = ReturnType<createKeybase1SecretUiGetPassphrase>
export type Keybase1StreamUiClosePayload = ReturnType<createKeybase1StreamUiClose>
export type Keybase1StreamUiReadPayload = ReturnType<createKeybase1StreamUiRead>
export type Keybase1StreamUiResetPayload = ReturnType<createKeybase1StreamUiReset>
export type Keybase1StreamUiWritePayload = ReturnType<createKeybase1StreamUiWrite>
export type Keybase1TeamsUiConfirmInviteLinkAcceptPayload =
  ReturnType<createKeybase1TeamsUiConfirmInviteLinkAccept>
export type Keybase1TeamsUiConfirmRootTeamDeletePayload =
  ReturnType<createKeybase1TeamsUiConfirmRootTeamDelete>
export type Keybase1TeamsUiConfirmSubteamDeletePayload = ReturnType<createKeybase1TeamsUiConfirmSubteamDelete>
export type Keybase1UiPromptYesNoPayload = ReturnType<createKeybase1UiPromptYesNo>
export type Stellar1NotifyAccountDetailsUpdatePayload = ReturnType<createStellar1NotifyAccountDetailsUpdate>
export type Stellar1NotifyAccountsUpdatePayload = ReturnType<createStellar1NotifyAccountsUpdate>
export type Stellar1NotifyPaymentNotificationPayload = ReturnType<createStellar1NotifyPaymentNotification>
export type Stellar1NotifyPaymentStatusNotificationPayload =
  ReturnType<createStellar1NotifyPaymentStatusNotification>
export type Stellar1NotifyPendingPaymentsUpdatePayload = ReturnType<createStellar1NotifyPendingPaymentsUpdate>
export type Stellar1NotifyRecentPaymentsUpdatePayload = ReturnType<createStellar1NotifyRecentPaymentsUpdate>
export type Stellar1NotifyRequestStatusNotificationPayload =
  ReturnType<createStellar1NotifyRequestStatusNotification>
export type Stellar1UiPaymentReviewedPayload = ReturnType<createStellar1UiPaymentReviewed>

// All Actions
// prettier-ignore
export type Actions =
  | Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | Chat1ChatUiChatClearWatchPayload
  | Chat1ChatUiChatCoinFlipStatusPayload
  | Chat1ChatUiChatCommandMarkdownPayload
  | Chat1ChatUiChatCommandStatusPayload
  | Chat1ChatUiChatConfirmChannelDeletePayload
  | Chat1ChatUiChatGiphySearchResultsPayload
  | Chat1ChatUiChatGiphyToggleResultWindowPayload
  | Chat1ChatUiChatInboxConversationPayload
  | Chat1ChatUiChatInboxFailedPayload
  | Chat1ChatUiChatInboxLayoutPayload
  | Chat1ChatUiChatInboxUnverifiedPayload
  | Chat1ChatUiChatLoadGalleryHitPayload
  | Chat1ChatUiChatMaybeMentionUpdatePayload
  | Chat1ChatUiChatSearchBotHitsPayload
  | Chat1ChatUiChatSearchConvHitsPayload
  | Chat1ChatUiChatSearchDonePayload
  | Chat1ChatUiChatSearchHitPayload
  | Chat1ChatUiChatSearchInboxDonePayload
  | Chat1ChatUiChatSearchInboxHitPayload
  | Chat1ChatUiChatSearchInboxStartPayload
  | Chat1ChatUiChatSearchIndexStatusPayload
  | Chat1ChatUiChatSearchTeamHitsPayload
  | Chat1ChatUiChatShowManageChannelsPayload
  | Chat1ChatUiChatStellarDataConfirmPayload
  | Chat1ChatUiChatStellarDataErrorPayload
  | Chat1ChatUiChatStellarDonePayload
  | Chat1ChatUiChatStellarShowConfirmPayload
  | Chat1ChatUiChatThreadCachedPayload
  | Chat1ChatUiChatThreadFullPayload
  | Chat1ChatUiChatThreadStatusPayload
  | Chat1ChatUiChatWatchPositionPayload
  | Chat1ChatUiTriggerContactSyncPayload
  | Chat1NotifyChatChatArchiveCompletePayload
  | Chat1NotifyChatChatArchiveProgressPayload
  | Chat1NotifyChatChatAttachmentDownloadCompletePayload
  | Chat1NotifyChatChatAttachmentDownloadProgressPayload
  | Chat1NotifyChatChatAttachmentUploadProgressPayload
  | Chat1NotifyChatChatAttachmentUploadStartPayload
  | Chat1NotifyChatChatConvUpdatePayload
  | Chat1NotifyChatChatIdentifyUpdatePayload
  | Chat1NotifyChatChatInboxStalePayload
  | Chat1NotifyChatChatInboxSyncStartedPayload
  | Chat1NotifyChatChatInboxSyncedPayload
  | Chat1NotifyChatChatJoinedConversationPayload
  | Chat1NotifyChatChatKBFSToImpteamUpgradePayload
  | Chat1NotifyChatChatLeftConversationPayload
  | Chat1NotifyChatChatParticipantsInfoPayload
  | Chat1NotifyChatChatPaymentInfoPayload
  | Chat1NotifyChatChatPromptUnfurlPayload
  | Chat1NotifyChatChatRequestInfoPayload
  | Chat1NotifyChatChatResetConversationPayload
  | Chat1NotifyChatChatSetConvRetentionPayload
  | Chat1NotifyChatChatSetConvSettingsPayload
  | Chat1NotifyChatChatSetTeamRetentionPayload
  | Chat1NotifyChatChatSubteamRenamePayload
  | Chat1NotifyChatChatTLFFinalizePayload
  | Chat1NotifyChatChatTLFResolvePayload
  | Chat1NotifyChatChatThreadsStalePayload
  | Chat1NotifyChatChatTypingUpdatePayload
  | Chat1NotifyChatChatWelcomeMessageLoadedPayload
  | Chat1NotifyChatNewChatActivityPayload
  | Keybase1GpgUiConfirmDuplicateKeyChosenPayload
  | Keybase1GpgUiConfirmImportSecretToExistingKeyPayload
  | Keybase1GpgUiGetTTYPayload
  | Keybase1GpgUiSelectKeyAndPushOptionPayload
  | Keybase1GpgUiSelectKeyPayload
  | Keybase1GpgUiSignPayload
  | Keybase1GpgUiWantToAddGPGKeyPayload
  | Keybase1GregorUIPushOutOfBandMessagesPayload
  | Keybase1GregorUIPushStatePayload
  | Keybase1HomeUIHomeUIRefreshPayload
  | Keybase1Identify3UiIdentify3ResultPayload
  | Keybase1Identify3UiIdentify3ShowTrackerPayload
  | Keybase1Identify3UiIdentify3SummaryPayload
  | Keybase1Identify3UiIdentify3TrackerTimedOutPayload
  | Keybase1Identify3UiIdentify3UpdateRowPayload
  | Keybase1Identify3UiIdentify3UpdateUserCardPayload
  | Keybase1Identify3UiIdentify3UserResetPayload
  | Keybase1IdentifyUiCancelPayload
  | Keybase1IdentifyUiConfirmPayload
  | Keybase1IdentifyUiDelegateIdentifyUIPayload
  | Keybase1IdentifyUiDismissPayload
  | Keybase1IdentifyUiDisplayCryptocurrencyPayload
  | Keybase1IdentifyUiDisplayKeyPayload
  | Keybase1IdentifyUiDisplayStellarAccountPayload
  | Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload
  | Keybase1IdentifyUiDisplayTrackStatementPayload
  | Keybase1IdentifyUiDisplayUserCardPayload
  | Keybase1IdentifyUiFinishPayload
  | Keybase1IdentifyUiFinishSocialProofCheckPayload
  | Keybase1IdentifyUiFinishWebProofCheckPayload
  | Keybase1IdentifyUiLaunchNetworkChecksPayload
  | Keybase1IdentifyUiReportLastTrackPayload
  | Keybase1IdentifyUiReportTrackTokenPayload
  | Keybase1IdentifyUiStartPayload
  | Keybase1LogUiLogPayload
  | Keybase1LoginUiChooseDeviceToRecoverWithPayload
  | Keybase1LoginUiDisplayPaperKeyPhrasePayload
  | Keybase1LoginUiDisplayPrimaryPaperKeyPayload
  | Keybase1LoginUiDisplayResetMessagePayload
  | Keybase1LoginUiDisplayResetProgressPayload
  | Keybase1LoginUiExplainDeviceRecoveryPayload
  | Keybase1LoginUiGetEmailOrUsernamePayload
  | Keybase1LoginUiPromptPassphraseRecoveryPayload
  | Keybase1LoginUiPromptResetAccountPayload
  | Keybase1LoginUiPromptRevokePaperKeysPayload
  | Keybase1LogsendPrepareLogsendPayload
  | Keybase1NotifyAppExitPayload
  | Keybase1NotifyAuditBoxAuditErrorPayload
  | Keybase1NotifyAuditRootAuditErrorPayload
  | Keybase1NotifyBadgesBadgeStatePayload
  | Keybase1NotifyCanUserPerformCanUserPerformChangedPayload
  | Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload
  | Keybase1NotifyEmailAddressEmailAddressVerifiedPayload
  | Keybase1NotifyEmailAddressEmailsChangedPayload
  | Keybase1NotifyEphemeralNewTeamEkPayload
  | Keybase1NotifyEphemeralNewTeambotEkPayload
  | Keybase1NotifyEphemeralTeambotEkNeededPayload
  | Keybase1NotifyFSFSActivityPayload
  | Keybase1NotifyFSFSEditListResponsePayload
  | Keybase1NotifyFSFSFavoritesChangedPayload
  | Keybase1NotifyFSFSOnlineStatusChangedPayload
  | Keybase1NotifyFSFSOverallSyncStatusChangedPayload
  | Keybase1NotifyFSFSPathUpdatedPayload
  | Keybase1NotifyFSFSSubscriptionNotifyPathPayload
  | Keybase1NotifyFSFSSubscriptionNotifyPayload
  | Keybase1NotifyFSFSSyncActivityPayload
  | Keybase1NotifyFSFSSyncStatusResponsePayload
  | Keybase1NotifyFavoritesFavoritesChangedPayload
  | Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload
  | Keybase1NotifyInviteFriendsUpdateInviteCountsPayload
  | Keybase1NotifyKeyfamilyKeyfamilyChangedPayload
  | Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload
  | Keybase1NotifyPaperKeyPaperKeyCachedPayload
  | Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload
  | Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload
  | Keybase1NotifySaltpackSaltpackOperationDonePayload
  | Keybase1NotifySaltpackSaltpackOperationProgressPayload
  | Keybase1NotifySaltpackSaltpackOperationStartPayload
  | Keybase1NotifyServiceHTTPSrvInfoUpdatePayload
  | Keybase1NotifyServiceHandleKeybaseLinkPayload
  | Keybase1NotifyServiceShutdownPayload
  | Keybase1NotifySessionClientOutOfDatePayload
  | Keybase1NotifySessionLoggedInPayload
  | Keybase1NotifySessionLoggedOutPayload
  | Keybase1NotifySimpleFSSimpleFSArchiveStatusChangedPayload
  | Keybase1NotifyTeamAvatarUpdatedPayload
  | Keybase1NotifyTeamNewlyAddedToTeamPayload
  | Keybase1NotifyTeamTeamAbandonedPayload
  | Keybase1NotifyTeamTeamChangedByIDPayload
  | Keybase1NotifyTeamTeamChangedByNamePayload
  | Keybase1NotifyTeamTeamDeletedPayload
  | Keybase1NotifyTeamTeamExitPayload
  | Keybase1NotifyTeamTeamMetadataUpdatePayload
  | Keybase1NotifyTeamTeamRoleMapChangedPayload
  | Keybase1NotifyTeamTeamTreeMembershipsDonePayload
  | Keybase1NotifyTeamTeamTreeMembershipsPartialPayload
  | Keybase1NotifyTeambotNewTeambotKeyPayload
  | Keybase1NotifyTeambotTeambotKeyNeededPayload
  | Keybase1NotifyTrackingNotifyUserBlockedPayload
  | Keybase1NotifyTrackingTrackingChangedPayload
  | Keybase1NotifyTrackingTrackingInfoPayload
  | Keybase1NotifyUsersIdentifyUpdatePayload
  | Keybase1NotifyUsersPasswordChangedPayload
  | Keybase1NotifyUsersUserChangedPayload
  | Keybase1NotifyUsersWebOfTrustChangedPayload
  | Keybase1PgpUiFinishedPayload
  | Keybase1PgpUiKeyGeneratedPayload
  | Keybase1PgpUiOutputPGPWarningPayload
  | Keybase1PgpUiOutputSignatureNonKeybasePayload
  | Keybase1PgpUiOutputSignatureSuccessPayload
  | Keybase1PgpUiShouldPushPrivatePayload
  | Keybase1ProveUiCheckingPayload
  | Keybase1ProveUiContinueCheckingPayload
  | Keybase1ProveUiDisplayRecheckWarningPayload
  | Keybase1ProveUiOkToCheckPayload
  | Keybase1ProveUiOutputInstructionsPayload
  | Keybase1ProveUiOutputPrechecksPayload
  | Keybase1ProveUiPreProofWarningPayload
  | Keybase1ProveUiPromptOverwritePayload
  | Keybase1ProveUiPromptUsernamePayload
  | Keybase1ProvisionUiChooseDevicePayload
  | Keybase1ProvisionUiChooseDeviceTypePayload
  | Keybase1ProvisionUiChooseGPGMethodPayload
  | Keybase1ProvisionUiChooseProvisioningMethodPayload
  | Keybase1ProvisionUiDisplayAndPromptSecretPayload
  | Keybase1ProvisionUiDisplaySecretExchangedPayload
  | Keybase1ProvisionUiPromptNewDeviceNamePayload
  | Keybase1ProvisionUiProvisioneeSuccessPayload
  | Keybase1ProvisionUiProvisionerSuccessPayload
  | Keybase1ProvisionUiSwitchToGPGSignOKPayload
  | Keybase1ReachabilityReachabilityChangedPayload
  | Keybase1RekeyUIDelegateRekeyUIPayload
  | Keybase1RekeyUIRefreshPayload
  | Keybase1RekeyUIRekeySendEventPayload
  | Keybase1SaltpackUiSaltpackPromptForDecryptPayload
  | Keybase1SaltpackUiSaltpackVerifyBadSenderPayload
  | Keybase1SaltpackUiSaltpackVerifySuccessPayload
  | Keybase1SecretUiGetPassphrasePayload
  | Keybase1StreamUiClosePayload
  | Keybase1StreamUiReadPayload
  | Keybase1StreamUiResetPayload
  | Keybase1StreamUiWritePayload
  | Keybase1TeamsUiConfirmInviteLinkAcceptPayload
  | Keybase1TeamsUiConfirmRootTeamDeletePayload
  | Keybase1TeamsUiConfirmSubteamDeletePayload
  | Keybase1UiPromptYesNoPayload
  | Stellar1NotifyAccountDetailsUpdatePayload
  | Stellar1NotifyAccountsUpdatePayload
  | Stellar1NotifyPaymentNotificationPayload
  | Stellar1NotifyPaymentStatusNotificationPayload
  | Stellar1NotifyPendingPaymentsUpdatePayload
  | Stellar1NotifyRecentPaymentsUpdatePayload
  | Stellar1NotifyRequestStatusNotificationPayload
  | Stellar1UiPaymentReviewedPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
