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
const createChat1ChatUiChatBotCommandsUpdateStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatBotCommandsUpdateStatus']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatBotCommandsUpdateStatus']['outParam']) => void
  }
}) => ({
  payload,
  type: chat1ChatUiChatBotCommandsUpdateStatus as typeof chat1ChatUiChatBotCommandsUpdateStatus,
})
const createChat1ChatUiChatClearWatch = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatClearWatch']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatClearWatch']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatClearWatch as typeof chat1ChatUiChatClearWatch})
const createChat1ChatUiChatCoinFlipStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCoinFlipStatus']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCoinFlipStatus']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatCoinFlipStatus as typeof chat1ChatUiChatCoinFlipStatus})
const createChat1ChatUiChatCommandMarkdown = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCommandMarkdown']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCommandMarkdown']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatCommandMarkdown as typeof chat1ChatUiChatCommandMarkdown})
const createChat1ChatUiChatCommandStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCommandStatus']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCommandStatus']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatCommandStatus as typeof chat1ChatUiChatCommandStatus})
const createChat1ChatUiChatConfirmChannelDelete = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatConfirmChannelDelete']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatConfirmChannelDelete']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatConfirmChannelDelete as typeof chat1ChatUiChatConfirmChannelDelete})
const createChat1ChatUiChatGiphySearchResults = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatGiphySearchResults']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatGiphySearchResults']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatGiphySearchResults as typeof chat1ChatUiChatGiphySearchResults})
const createChat1ChatUiChatGiphyToggleResultWindow = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatGiphyToggleResultWindow']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatGiphyToggleResultWindow']['outParam']) => void
  }
}) => ({
  payload,
  type: chat1ChatUiChatGiphyToggleResultWindow as typeof chat1ChatUiChatGiphyToggleResultWindow,
})
const createChat1ChatUiChatInboxConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxConversation']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxConversation']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatInboxConversation as typeof chat1ChatUiChatInboxConversation})
const createChat1ChatUiChatInboxFailed = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxFailed']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxFailed']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatInboxFailed as typeof chat1ChatUiChatInboxFailed})
const createChat1ChatUiChatInboxLayout = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxLayout']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxLayout']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatInboxLayout as typeof chat1ChatUiChatInboxLayout})
const createChat1ChatUiChatInboxUnverified = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxUnverified']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxUnverified']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatInboxUnverified as typeof chat1ChatUiChatInboxUnverified})
const createChat1ChatUiChatLoadGalleryHit = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatLoadGalleryHit as typeof chat1ChatUiChatLoadGalleryHit})
const createChat1ChatUiChatMaybeMentionUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatMaybeMentionUpdate as typeof chat1ChatUiChatMaybeMentionUpdate})
const createChat1ChatUiChatSearchBotHits = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchBotHits']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchBotHits as typeof chat1ChatUiChatSearchBotHits})
const createChat1ChatUiChatSearchConvHits = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchConvHits']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchConvHits as typeof chat1ChatUiChatSearchConvHits})
const createChat1ChatUiChatSearchDone = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchDone']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchDone']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchDone as typeof chat1ChatUiChatSearchDone})
const createChat1ChatUiChatSearchHit = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchHit']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchHit']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchHit as typeof chat1ChatUiChatSearchHit})
const createChat1ChatUiChatSearchInboxDone = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxDone']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxDone']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchInboxDone as typeof chat1ChatUiChatSearchInboxDone})
const createChat1ChatUiChatSearchInboxHit = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchInboxHit as typeof chat1ChatUiChatSearchInboxHit})
const createChat1ChatUiChatSearchInboxStart = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxStart']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxStart']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchInboxStart as typeof chat1ChatUiChatSearchInboxStart})
const createChat1ChatUiChatSearchIndexStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchIndexStatus as typeof chat1ChatUiChatSearchIndexStatus})
const createChat1ChatUiChatSearchTeamHits = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatSearchTeamHits as typeof chat1ChatUiChatSearchTeamHits})
const createChat1ChatUiChatShowManageChannels = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatShowManageChannels as typeof chat1ChatUiChatShowManageChannels})
const createChat1ChatUiChatStellarDataConfirm = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatStellarDataConfirm as typeof chat1ChatUiChatStellarDataConfirm})
const createChat1ChatUiChatStellarDataError = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataError']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataError']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatStellarDataError as typeof chat1ChatUiChatStellarDataError})
const createChat1ChatUiChatStellarDone = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDone']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDone']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatStellarDone as typeof chat1ChatUiChatStellarDone})
const createChat1ChatUiChatStellarShowConfirm = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarShowConfirm']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarShowConfirm']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatStellarShowConfirm as typeof chat1ChatUiChatStellarShowConfirm})
const createChat1ChatUiChatThreadCached = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadCached']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadCached']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatThreadCached as typeof chat1ChatUiChatThreadCached})
const createChat1ChatUiChatThreadFull = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadFull']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadFull']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatThreadFull as typeof chat1ChatUiChatThreadFull})
const createChat1ChatUiChatThreadStatus = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadStatus']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadStatus']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatThreadStatus as typeof chat1ChatUiChatThreadStatus})
const createChat1ChatUiChatWatchPosition = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatWatchPosition']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatWatchPosition']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiChatWatchPosition as typeof chat1ChatUiChatWatchPosition})
const createChat1ChatUiTriggerContactSync = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.triggerContactSync']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.triggerContactSync']['outParam']) => void
  }
}) => ({payload, type: chat1ChatUiTriggerContactSync as typeof chat1ChatUiTriggerContactSync})
const createChat1NotifyChatChatArchiveComplete = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatArchiveComplete']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatArchiveComplete as typeof chat1NotifyChatChatArchiveComplete})
const createChat1NotifyChatChatArchiveProgress = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatArchiveProgress']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatArchiveProgress as typeof chat1NotifyChatChatArchiveProgress})
const createChat1NotifyChatChatAttachmentDownloadComplete = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentDownloadComplete']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: chat1NotifyChatChatAttachmentDownloadComplete as typeof chat1NotifyChatChatAttachmentDownloadComplete,
})
const createChat1NotifyChatChatAttachmentDownloadProgress = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentDownloadProgress']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: chat1NotifyChatChatAttachmentDownloadProgress as typeof chat1NotifyChatChatAttachmentDownloadProgress,
})
const createChat1NotifyChatChatAttachmentUploadProgress = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentUploadProgress']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: chat1NotifyChatChatAttachmentUploadProgress as typeof chat1NotifyChatChatAttachmentUploadProgress,
})
const createChat1NotifyChatChatAttachmentUploadStart = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentUploadStart']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: chat1NotifyChatChatAttachmentUploadStart as typeof chat1NotifyChatChatAttachmentUploadStart,
})
const createChat1NotifyChatChatConvUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatConvUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatConvUpdate as typeof chat1NotifyChatChatConvUpdate})
const createChat1NotifyChatChatIdentifyUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatIdentifyUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatIdentifyUpdate as typeof chat1NotifyChatChatIdentifyUpdate})
const createChat1NotifyChatChatInboxStale = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxStale']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatInboxStale as typeof chat1NotifyChatChatInboxStale})
const createChat1NotifyChatChatInboxSyncStarted = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxSyncStarted']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatInboxSyncStarted as typeof chat1NotifyChatChatInboxSyncStarted})
const createChat1NotifyChatChatInboxSynced = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxSynced']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatInboxSynced as typeof chat1NotifyChatChatInboxSynced})
const createChat1NotifyChatChatJoinedConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatJoinedConversation']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatJoinedConversation as typeof chat1NotifyChatChatJoinedConversation})
const createChat1NotifyChatChatKBFSToImpteamUpgrade = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatKBFSToImpteamUpgrade']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: chat1NotifyChatChatKBFSToImpteamUpgrade as typeof chat1NotifyChatChatKBFSToImpteamUpgrade,
})
const createChat1NotifyChatChatLeftConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatLeftConversation']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatLeftConversation as typeof chat1NotifyChatChatLeftConversation})
const createChat1NotifyChatChatParticipantsInfo = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatParticipantsInfo']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatParticipantsInfo as typeof chat1NotifyChatChatParticipantsInfo})
const createChat1NotifyChatChatPaymentInfo = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatPaymentInfo']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatPaymentInfo as typeof chat1NotifyChatChatPaymentInfo})
const createChat1NotifyChatChatPromptUnfurl = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatPromptUnfurl']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatPromptUnfurl as typeof chat1NotifyChatChatPromptUnfurl})
const createChat1NotifyChatChatRequestInfo = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatRequestInfo']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatRequestInfo as typeof chat1NotifyChatChatRequestInfo})
const createChat1NotifyChatChatResetConversation = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatResetConversation']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatResetConversation as typeof chat1NotifyChatChatResetConversation})
const createChat1NotifyChatChatSetConvRetention = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetConvRetention']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatSetConvRetention as typeof chat1NotifyChatChatSetConvRetention})
const createChat1NotifyChatChatSetConvSettings = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetConvSettings']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatSetConvSettings as typeof chat1NotifyChatChatSetConvSettings})
const createChat1NotifyChatChatSetTeamRetention = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetTeamRetention']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatSetTeamRetention as typeof chat1NotifyChatChatSetTeamRetention})
const createChat1NotifyChatChatSubteamRename = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSubteamRename']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatSubteamRename as typeof chat1NotifyChatChatSubteamRename})
const createChat1NotifyChatChatTLFFinalize = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTLFFinalize']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatTLFFinalize as typeof chat1NotifyChatChatTLFFinalize})
const createChat1NotifyChatChatTLFResolve = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTLFResolve']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatTLFResolve as typeof chat1NotifyChatChatTLFResolve})
const createChat1NotifyChatChatThreadsStale = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatThreadsStale']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatThreadsStale as typeof chat1NotifyChatChatThreadsStale})
const createChat1NotifyChatChatTypingUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTypingUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatChatTypingUpdate as typeof chat1NotifyChatChatTypingUpdate})
const createChat1NotifyChatChatWelcomeMessageLoaded = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatWelcomeMessageLoaded']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: chat1NotifyChatChatWelcomeMessageLoaded as typeof chat1NotifyChatChatWelcomeMessageLoaded,
})
const createChat1NotifyChatNewChatActivity = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.NewChatActivity']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: chat1NotifyChatNewChatActivity as typeof chat1NotifyChatNewChatActivity})
const createKeybase1GpgUiConfirmDuplicateKeyChosen = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmDuplicateKeyChosen']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmDuplicateKeyChosen']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1GpgUiConfirmDuplicateKeyChosen as typeof keybase1GpgUiConfirmDuplicateKeyChosen,
})
const createKeybase1GpgUiConfirmImportSecretToExistingKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmImportSecretToExistingKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmImportSecretToExistingKey']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1GpgUiConfirmImportSecretToExistingKey as typeof keybase1GpgUiConfirmImportSecretToExistingKey,
})
const createKeybase1GpgUiGetTTY = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.getTTY']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.getTTY']['outParam']) => void
  }
}) => ({payload, type: keybase1GpgUiGetTTY as typeof keybase1GpgUiGetTTY})
const createKeybase1GpgUiSelectKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKey']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKey']['outParam']) => void
  }
}) => ({payload, type: keybase1GpgUiSelectKey as typeof keybase1GpgUiSelectKey})
const createKeybase1GpgUiSelectKeyAndPushOption = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKeyAndPushOption']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKeyAndPushOption']['outParam']) => void
  }
}) => ({payload, type: keybase1GpgUiSelectKeyAndPushOption as typeof keybase1GpgUiSelectKeyAndPushOption})
const createKeybase1GpgUiSign = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.sign']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.sign']['outParam']) => void
  }
}) => ({payload, type: keybase1GpgUiSign as typeof keybase1GpgUiSign})
const createKeybase1GpgUiWantToAddGPGKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.wantToAddGPGKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.wantToAddGPGKey']['outParam']) => void
  }
}) => ({payload, type: keybase1GpgUiWantToAddGPGKey as typeof keybase1GpgUiWantToAddGPGKey})
const createKeybase1GregorUIPushOutOfBandMessages = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gregorUI.pushOutOfBandMessages']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gregorUI.pushOutOfBandMessages']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1GregorUIPushOutOfBandMessages as typeof keybase1GregorUIPushOutOfBandMessages})
const createKeybase1GregorUIPushState = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.gregorUI.pushState']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gregorUI.pushState']['outParam']) => void
  }
}) => ({payload, type: keybase1GregorUIPushState as typeof keybase1GregorUIPushState})
const createKeybase1HomeUIHomeUIRefresh = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.homeUI.homeUIRefresh']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.homeUI.homeUIRefresh']['outParam']) => void
  }
}) => ({payload, type: keybase1HomeUIHomeUIRefresh as typeof keybase1HomeUIHomeUIRefresh})
const createKeybase1Identify3UiIdentify3Result = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Result']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Result']['outParam']) => void
  }
}) => ({payload, type: keybase1Identify3UiIdentify3Result as typeof keybase1Identify3UiIdentify3Result})
const createKeybase1Identify3UiIdentify3ShowTracker = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3ShowTracker']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3ShowTracker']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1Identify3UiIdentify3ShowTracker as typeof keybase1Identify3UiIdentify3ShowTracker,
})
const createKeybase1Identify3UiIdentify3Summary = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Summary']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Summary']['outParam']) => void
  }
}) => ({payload, type: keybase1Identify3UiIdentify3Summary as typeof keybase1Identify3UiIdentify3Summary})
const createKeybase1Identify3UiIdentify3TrackerTimedOut = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3TrackerTimedOut']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3TrackerTimedOut']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1Identify3UiIdentify3TrackerTimedOut as typeof keybase1Identify3UiIdentify3TrackerTimedOut,
})
const createKeybase1Identify3UiIdentify3UpdateRow = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateRow']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateRow']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1Identify3UiIdentify3UpdateRow as typeof keybase1Identify3UiIdentify3UpdateRow})
const createKeybase1Identify3UiIdentify3UpdateUserCard = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateUserCard']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateUserCard']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1Identify3UiIdentify3UpdateUserCard as typeof keybase1Identify3UiIdentify3UpdateUserCard,
})
const createKeybase1Identify3UiIdentify3UserReset = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UserReset']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UserReset']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1Identify3UiIdentify3UserReset as typeof keybase1Identify3UiIdentify3UserReset})
const createKeybase1IdentifyUiCancel = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.cancel']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.cancel']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiCancel as typeof keybase1IdentifyUiCancel})
const createKeybase1IdentifyUiConfirm = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.confirm']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.confirm']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiConfirm as typeof keybase1IdentifyUiConfirm})
const createKeybase1IdentifyUiDelegateIdentifyUI = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.delegateIdentifyUI']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.delegateIdentifyUI']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiDelegateIdentifyUI as typeof keybase1IdentifyUiDelegateIdentifyUI})
const createKeybase1IdentifyUiDismiss = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.dismiss']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.dismiss']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiDismiss as typeof keybase1IdentifyUiDismiss})
const createKeybase1IdentifyUiDisplayCryptocurrency = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayCryptocurrency']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayCryptocurrency']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1IdentifyUiDisplayCryptocurrency as typeof keybase1IdentifyUiDisplayCryptocurrency,
})
const createKeybase1IdentifyUiDisplayKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayKey']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiDisplayKey as typeof keybase1IdentifyUiDisplayKey})
const createKeybase1IdentifyUiDisplayStellarAccount = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayStellarAccount']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayStellarAccount']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1IdentifyUiDisplayStellarAccount as typeof keybase1IdentifyUiDisplayStellarAccount,
})
const createKeybase1IdentifyUiDisplayTLFCreateWithInvite = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTLFCreateWithInvite']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTLFCreateWithInvite']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1IdentifyUiDisplayTLFCreateWithInvite as typeof keybase1IdentifyUiDisplayTLFCreateWithInvite,
})
const createKeybase1IdentifyUiDisplayTrackStatement = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTrackStatement']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTrackStatement']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1IdentifyUiDisplayTrackStatement as typeof keybase1IdentifyUiDisplayTrackStatement,
})
const createKeybase1IdentifyUiDisplayUserCard = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayUserCard']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayUserCard']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiDisplayUserCard as typeof keybase1IdentifyUiDisplayUserCard})
const createKeybase1IdentifyUiFinish = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finish']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.finish']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiFinish as typeof keybase1IdentifyUiFinish})
const createKeybase1IdentifyUiFinishSocialProofCheck = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finishSocialProofCheck']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.finishSocialProofCheck']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1IdentifyUiFinishSocialProofCheck as typeof keybase1IdentifyUiFinishSocialProofCheck,
})
const createKeybase1IdentifyUiFinishWebProofCheck = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finishWebProofCheck']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.finishWebProofCheck']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1IdentifyUiFinishWebProofCheck as typeof keybase1IdentifyUiFinishWebProofCheck})
const createKeybase1IdentifyUiLaunchNetworkChecks = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.launchNetworkChecks']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.launchNetworkChecks']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1IdentifyUiLaunchNetworkChecks as typeof keybase1IdentifyUiLaunchNetworkChecks})
const createKeybase1IdentifyUiReportLastTrack = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.reportLastTrack']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.reportLastTrack']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiReportLastTrack as typeof keybase1IdentifyUiReportLastTrack})
const createKeybase1IdentifyUiReportTrackToken = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.reportTrackToken']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.reportTrackToken']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiReportTrackToken as typeof keybase1IdentifyUiReportTrackToken})
const createKeybase1IdentifyUiStart = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.start']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.start']['outParam']) => void
  }
}) => ({payload, type: keybase1IdentifyUiStart as typeof keybase1IdentifyUiStart})
const createKeybase1LogUiLog = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.logUi.log']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logUi.log']['outParam']) => void
  }
}) => ({payload, type: keybase1LogUiLog as typeof keybase1LogUiLog})
const createKeybase1LoginUiChooseDeviceToRecoverWith = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.chooseDeviceToRecoverWith']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.chooseDeviceToRecoverWith']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1LoginUiChooseDeviceToRecoverWith as typeof keybase1LoginUiChooseDeviceToRecoverWith,
})
const createKeybase1LoginUiDisplayPaperKeyPhrase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayPaperKeyPhrase']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayPaperKeyPhrase']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiDisplayPaperKeyPhrase as typeof keybase1LoginUiDisplayPaperKeyPhrase})
const createKeybase1LoginUiDisplayPrimaryPaperKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayPrimaryPaperKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.displayPrimaryPaperKey']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1LoginUiDisplayPrimaryPaperKey as typeof keybase1LoginUiDisplayPrimaryPaperKey})
const createKeybase1LoginUiDisplayResetMessage = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetMessage']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetMessage']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiDisplayResetMessage as typeof keybase1LoginUiDisplayResetMessage})
const createKeybase1LoginUiDisplayResetProgress = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetProgress']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetProgress']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiDisplayResetProgress as typeof keybase1LoginUiDisplayResetProgress})
const createKeybase1LoginUiExplainDeviceRecovery = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiExplainDeviceRecovery as typeof keybase1LoginUiExplainDeviceRecovery})
const createKeybase1LoginUiGetEmailOrUsername = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.getEmailOrUsername']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.getEmailOrUsername']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiGetEmailOrUsername as typeof keybase1LoginUiGetEmailOrUsername})
const createKeybase1LoginUiPromptPassphraseRecovery = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptPassphraseRecovery']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.promptPassphraseRecovery']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1LoginUiPromptPassphraseRecovery as typeof keybase1LoginUiPromptPassphraseRecovery,
})
const createKeybase1LoginUiPromptResetAccount = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiPromptResetAccount as typeof keybase1LoginUiPromptResetAccount})
const createKeybase1LoginUiPromptRevokePaperKeys = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptRevokePaperKeys']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.promptRevokePaperKeys']['outParam']) => void
  }
}) => ({payload, type: keybase1LoginUiPromptRevokePaperKeys as typeof keybase1LoginUiPromptRevokePaperKeys})
const createKeybase1LogsendPrepareLogsend = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.logsend.prepareLogsend']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logsend.prepareLogsend']['outParam']) => void
  }
}) => ({payload, type: keybase1LogsendPrepareLogsend as typeof keybase1LogsendPrepareLogsend})
const createKeybase1NotifyAppExit = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyApp.exit']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyApp.exit']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyAppExit as typeof keybase1NotifyAppExit})
const createKeybase1NotifyAuditBoxAuditError = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyAudit.boxAuditError']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyAuditBoxAuditError as typeof keybase1NotifyAuditBoxAuditError})
const createKeybase1NotifyAuditRootAuditError = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyAudit.rootAuditError']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyAuditRootAuditError as typeof keybase1NotifyAuditRootAuditError})
const createKeybase1NotifyBadgesBadgeState = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyBadges.badgeState']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyBadgesBadgeState as typeof keybase1NotifyBadgesBadgeState})
const createKeybase1NotifyCanUserPerformCanUserPerformChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyCanUserPerform.canUserPerformChanged']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: keybase1NotifyCanUserPerformCanUserPerformChanged as typeof keybase1NotifyCanUserPerformCanUserPerformChanged,
})
const createKeybase1NotifyDeviceCloneDeviceCloneCountChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyDeviceClone.deviceCloneCountChanged']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: keybase1NotifyDeviceCloneDeviceCloneCountChanged as typeof keybase1NotifyDeviceCloneDeviceCloneCountChanged,
})
const createKeybase1NotifyEmailAddressEmailAddressVerified = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailAddressVerified']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailAddressVerified']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyEmailAddressEmailAddressVerified as typeof keybase1NotifyEmailAddressEmailAddressVerified,
})
const createKeybase1NotifyEmailAddressEmailsChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailsChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailsChanged']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyEmailAddressEmailsChanged as typeof keybase1NotifyEmailAddressEmailsChanged,
})
const createKeybase1NotifyEphemeralNewTeamEk = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeamEk']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyEphemeralNewTeamEk as typeof keybase1NotifyEphemeralNewTeamEk})
const createKeybase1NotifyEphemeralNewTeambotEk = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeambotEk']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeambotEk']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyEphemeralNewTeambotEk as typeof keybase1NotifyEphemeralNewTeambotEk})
const createKeybase1NotifyEphemeralTeambotEkNeeded = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.teambotEkNeeded']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.teambotEkNeeded']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyEphemeralTeambotEkNeeded as typeof keybase1NotifyEphemeralTeambotEkNeeded,
})
const createKeybase1NotifyFSFSActivity = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSActivity']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyFSFSActivity as typeof keybase1NotifyFSFSActivity})
const createKeybase1NotifyFSFSEditListResponse = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSEditListResponse']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSEditListResponse']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyFSFSEditListResponse as typeof keybase1NotifyFSFSEditListResponse})
const createKeybase1NotifyFSFSFavoritesChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSFavoritesChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSFavoritesChanged']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyFSFSFavoritesChanged as typeof keybase1NotifyFSFSFavoritesChanged})
const createKeybase1NotifyFSFSOnlineStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOnlineStatusChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOnlineStatusChanged']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1NotifyFSFSOnlineStatusChanged as typeof keybase1NotifyFSFSOnlineStatusChanged})
const createKeybase1NotifyFSFSOverallSyncStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyFSFSOverallSyncStatusChanged as typeof keybase1NotifyFSFSOverallSyncStatusChanged,
})
const createKeybase1NotifyFSFSPathUpdated = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSPathUpdated']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyFSFSPathUpdated as typeof keybase1NotifyFSFSPathUpdated})
const createKeybase1NotifyFSFSSubscriptionNotify = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotify']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotify']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyFSFSSubscriptionNotify as typeof keybase1NotifyFSFSSubscriptionNotify})
const createKeybase1NotifyFSFSSubscriptionNotifyPath = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotifyPath']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSubscriptionNotifyPath']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyFSFSSubscriptionNotifyPath as typeof keybase1NotifyFSFSSubscriptionNotifyPath,
})
const createKeybase1NotifyFSFSSyncActivity = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncActivity']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncActivity']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyFSFSSyncActivity as typeof keybase1NotifyFSFSSyncActivity})
const createKeybase1NotifyFSFSSyncStatusResponse = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncStatusResponse']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncStatusResponse']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyFSFSSyncStatusResponse as typeof keybase1NotifyFSFSSyncStatusResponse})
const createKeybase1NotifyFavoritesFavoritesChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFavorites.favoritesChanged']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: keybase1NotifyFavoritesFavoritesChanged as typeof keybase1NotifyFavoritesFavoritesChanged,
})
const createKeybase1NotifyFeaturedBotsFeaturedBotsUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFeaturedBots.featuredBotsUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFeaturedBots.featuredBotsUpdate']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyFeaturedBotsFeaturedBotsUpdate as typeof keybase1NotifyFeaturedBotsFeaturedBotsUpdate,
})
const createKeybase1NotifyInviteFriendsUpdateInviteCounts = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyInviteFriends.updateInviteCounts']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyInviteFriends.updateInviteCounts']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyInviteFriendsUpdateInviteCounts as typeof keybase1NotifyInviteFriendsUpdateInviteCounts,
})
const createKeybase1NotifyKeyfamilyKeyfamilyChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyKeyfamily.keyfamilyChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyKeyfamily.keyfamilyChanged']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyKeyfamilyKeyfamilyChanged as typeof keybase1NotifyKeyfamilyKeyfamilyChanged,
})
const createKeybase1NotifyPGPPgpKeyInSecretStoreFile = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyPGPPgpKeyInSecretStoreFile as typeof keybase1NotifyPGPPgpKeyInSecretStoreFile,
})
const createKeybase1NotifyPaperKeyPaperKeyCached = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPaperKey.paperKeyCached']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyPaperKey.paperKeyCached']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyPaperKeyPaperKeyCached as typeof keybase1NotifyPaperKeyPaperKeyCached})
const createKeybase1NotifyPhoneNumberPhoneNumbersChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPhoneNumber.phoneNumbersChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPhoneNumber.phoneNumbersChanged']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyPhoneNumberPhoneNumbersChanged as typeof keybase1NotifyPhoneNumberPhoneNumbersChanged,
})
const createKeybase1NotifyRuntimeStatsRuntimeStatsUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyRuntimeStats.runtimeStatsUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyRuntimeStats.runtimeStatsUpdate']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyRuntimeStatsRuntimeStatsUpdate as typeof keybase1NotifyRuntimeStatsRuntimeStatsUpdate,
})
const createKeybase1NotifySaltpackSaltpackOperationDone = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationDone']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationDone']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifySaltpackSaltpackOperationDone as typeof keybase1NotifySaltpackSaltpackOperationDone,
})
const createKeybase1NotifySaltpackSaltpackOperationProgress = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationProgress']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationProgress']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifySaltpackSaltpackOperationProgress as typeof keybase1NotifySaltpackSaltpackOperationProgress,
})
const createKeybase1NotifySaltpackSaltpackOperationStart = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationStart']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySaltpack.saltpackOperationStart']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifySaltpackSaltpackOperationStart as typeof keybase1NotifySaltpackSaltpackOperationStart,
})
const createKeybase1NotifyServiceHTTPSrvInfoUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.HTTPSrvInfoUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyService.HTTPSrvInfoUpdate']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyServiceHTTPSrvInfoUpdate as typeof keybase1NotifyServiceHTTPSrvInfoUpdate,
})
const createKeybase1NotifyServiceHandleKeybaseLink = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.handleKeybaseLink']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyService.handleKeybaseLink']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyServiceHandleKeybaseLink as typeof keybase1NotifyServiceHandleKeybaseLink,
})
const createKeybase1NotifyServiceShutdown = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.shutdown']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyService.shutdown']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyServiceShutdown as typeof keybase1NotifyServiceShutdown})
const createKeybase1NotifySessionClientOutOfDate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.clientOutOfDate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifySession.clientOutOfDate']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifySessionClientOutOfDate as typeof keybase1NotifySessionClientOutOfDate})
const createKeybase1NotifySessionLoggedIn = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedIn']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedIn']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifySessionLoggedIn as typeof keybase1NotifySessionLoggedIn})
const createKeybase1NotifySessionLoggedOut = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedOut']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifySessionLoggedOut as typeof keybase1NotifySessionLoggedOut})
const createKeybase1NotifySimpleFSSimpleFSArchiveStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifySimpleFSSimpleFSArchiveStatusChanged as typeof keybase1NotifySimpleFSSimpleFSArchiveStatusChanged,
})
const createKeybase1NotifyTeamAvatarUpdated = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.avatarUpdated']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.avatarUpdated']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamAvatarUpdated as typeof keybase1NotifyTeamAvatarUpdated})
const createKeybase1NotifyTeamNewlyAddedToTeam = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.newlyAddedToTeam']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.newlyAddedToTeam']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamNewlyAddedToTeam as typeof keybase1NotifyTeamNewlyAddedToTeam})
const createKeybase1NotifyTeamTeamAbandoned = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamAbandoned']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamAbandoned']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamAbandoned as typeof keybase1NotifyTeamTeamAbandoned})
const createKeybase1NotifyTeamTeamChangedByID = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamChangedByID as typeof keybase1NotifyTeamTeamChangedByID})
const createKeybase1NotifyTeamTeamChangedByName = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByName']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByName']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamChangedByName as typeof keybase1NotifyTeamTeamChangedByName})
const createKeybase1NotifyTeamTeamDeleted = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamDeleted']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamDeleted']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamDeleted as typeof keybase1NotifyTeamTeamDeleted})
const createKeybase1NotifyTeamTeamExit = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamExit']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamExit']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamExit as typeof keybase1NotifyTeamTeamExit})
const createKeybase1NotifyTeamTeamMetadataUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamMetadataUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamMetadataUpdate']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamMetadataUpdate as typeof keybase1NotifyTeamTeamMetadataUpdate})
const createKeybase1NotifyTeamTeamRoleMapChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamRoleMapChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamRoleMapChanged']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTeamTeamRoleMapChanged as typeof keybase1NotifyTeamTeamRoleMapChanged})
const createKeybase1NotifyTeamTeamTreeMembershipsDone = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsDone']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsDone']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyTeamTeamTreeMembershipsDone as typeof keybase1NotifyTeamTeamTreeMembershipsDone,
})
const createKeybase1NotifyTeamTeamTreeMembershipsPartial = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsPartial']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamTreeMembershipsPartial']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyTeamTeamTreeMembershipsPartial as typeof keybase1NotifyTeamTeamTreeMembershipsPartial,
})
const createKeybase1NotifyTeambotNewTeambotKey = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeambot.newTeambotKey']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyTeambotNewTeambotKey as typeof keybase1NotifyTeambotNewTeambotKey})
const createKeybase1NotifyTeambotTeambotKeyNeeded = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeambot.teambotKeyNeeded']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTeambot.teambotKeyNeeded']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1NotifyTeambotTeambotKeyNeeded as typeof keybase1NotifyTeambotTeambotKeyNeeded})
const createKeybase1NotifyTrackingNotifyUserBlocked = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.notifyUserBlocked']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyTracking.notifyUserBlocked']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1NotifyTrackingNotifyUserBlocked as typeof keybase1NotifyTrackingNotifyUserBlocked,
})
const createKeybase1NotifyTrackingTrackingChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingChanged']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyTrackingTrackingChanged as typeof keybase1NotifyTrackingTrackingChanged})
const createKeybase1NotifyTrackingTrackingInfo = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingInfo']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingInfo']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyTrackingTrackingInfo as typeof keybase1NotifyTrackingTrackingInfo})
const createKeybase1NotifyUsersIdentifyUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.identifyUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyUsers.identifyUpdate']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyUsersIdentifyUpdate as typeof keybase1NotifyUsersIdentifyUpdate})
const createKeybase1NotifyUsersPasswordChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.passwordChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyUsers.passwordChanged']['outParam']) => void
  }
}) => ({payload, type: keybase1NotifyUsersPasswordChanged as typeof keybase1NotifyUsersPasswordChanged})
const createKeybase1NotifyUsersUserChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.userChanged']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyUsersUserChanged as typeof keybase1NotifyUsersUserChanged})
const createKeybase1NotifyUsersWebOfTrustChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.webOfTrustChanged']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: keybase1NotifyUsersWebOfTrustChanged as typeof keybase1NotifyUsersWebOfTrustChanged})
const createKeybase1PgpUiFinished = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.finished']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.finished']['outParam']) => void
  }
}) => ({payload, type: keybase1PgpUiFinished as typeof keybase1PgpUiFinished})
const createKeybase1PgpUiKeyGenerated = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.keyGenerated']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.keyGenerated']['outParam']) => void
  }
}) => ({payload, type: keybase1PgpUiKeyGenerated as typeof keybase1PgpUiKeyGenerated})
const createKeybase1PgpUiOutputPGPWarning = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputPGPWarning']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputPGPWarning']['outParam']) => void
  }
}) => ({payload, type: keybase1PgpUiOutputPGPWarning as typeof keybase1PgpUiOutputPGPWarning})
const createKeybase1PgpUiOutputSignatureNonKeybase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureNonKeybase']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureNonKeybase']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1PgpUiOutputSignatureNonKeybase as typeof keybase1PgpUiOutputSignatureNonKeybase,
})
const createKeybase1PgpUiOutputSignatureSuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccess']['outParam']) => void
  }
}) => ({payload, type: keybase1PgpUiOutputSignatureSuccess as typeof keybase1PgpUiOutputSignatureSuccess})
const createKeybase1PgpUiShouldPushPrivate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.shouldPushPrivate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.shouldPushPrivate']['outParam']) => void
  }
}) => ({payload, type: keybase1PgpUiShouldPushPrivate as typeof keybase1PgpUiShouldPushPrivate})
const createKeybase1ProveUiChecking = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.checking']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.checking']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiChecking as typeof keybase1ProveUiChecking})
const createKeybase1ProveUiContinueChecking = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.continueChecking']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.continueChecking']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiContinueChecking as typeof keybase1ProveUiContinueChecking})
const createKeybase1ProveUiDisplayRecheckWarning = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.displayRecheckWarning']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.displayRecheckWarning']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiDisplayRecheckWarning as typeof keybase1ProveUiDisplayRecheckWarning})
const createKeybase1ProveUiOkToCheck = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.okToCheck']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.okToCheck']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiOkToCheck as typeof keybase1ProveUiOkToCheck})
const createKeybase1ProveUiOutputInstructions = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.outputInstructions']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.outputInstructions']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiOutputInstructions as typeof keybase1ProveUiOutputInstructions})
const createKeybase1ProveUiOutputPrechecks = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.outputPrechecks']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.outputPrechecks']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiOutputPrechecks as typeof keybase1ProveUiOutputPrechecks})
const createKeybase1ProveUiPreProofWarning = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.preProofWarning']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.preProofWarning']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiPreProofWarning as typeof keybase1ProveUiPreProofWarning})
const createKeybase1ProveUiPromptOverwrite = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.promptOverwrite']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.promptOverwrite']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiPromptOverwrite as typeof keybase1ProveUiPromptOverwrite})
const createKeybase1ProveUiPromptUsername = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.promptUsername']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.promptUsername']['outParam']) => void
  }
}) => ({payload, type: keybase1ProveUiPromptUsername as typeof keybase1ProveUiPromptUsername})
const createKeybase1ProvisionUiChooseDevice = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDevice']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDevice']['outParam']) => void
  }
}) => ({payload, type: keybase1ProvisionUiChooseDevice as typeof keybase1ProvisionUiChooseDevice})
const createKeybase1ProvisionUiChooseDeviceType = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDeviceType']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDeviceType']['outParam']) => void
  }
}) => ({payload, type: keybase1ProvisionUiChooseDeviceType as typeof keybase1ProvisionUiChooseDeviceType})
const createKeybase1ProvisionUiChooseGPGMethod = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseGPGMethod']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseGPGMethod']['outParam']) => void
  }
}) => ({payload, type: keybase1ProvisionUiChooseGPGMethod as typeof keybase1ProvisionUiChooseGPGMethod})
const createKeybase1ProvisionUiChooseProvisioningMethod = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseProvisioningMethod']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseProvisioningMethod']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1ProvisionUiChooseProvisioningMethod as typeof keybase1ProvisionUiChooseProvisioningMethod,
})
const createKeybase1ProvisionUiDisplayAndPromptSecret = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplayAndPromptSecret']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplayAndPromptSecret']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1ProvisionUiDisplayAndPromptSecret as typeof keybase1ProvisionUiDisplayAndPromptSecret,
})
const createKeybase1ProvisionUiDisplaySecretExchanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplaySecretExchanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplaySecretExchanged']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1ProvisionUiDisplaySecretExchanged as typeof keybase1ProvisionUiDisplaySecretExchanged,
})
const createKeybase1ProvisionUiPromptNewDeviceName = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.PromptNewDeviceName']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.PromptNewDeviceName']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1ProvisionUiPromptNewDeviceName as typeof keybase1ProvisionUiPromptNewDeviceName,
})
const createKeybase1ProvisionUiProvisioneeSuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisioneeSuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisioneeSuccess']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1ProvisionUiProvisioneeSuccess as typeof keybase1ProvisionUiProvisioneeSuccess})
const createKeybase1ProvisionUiProvisionerSuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisionerSuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisionerSuccess']['outParam']
    ) => void
  }
}) => ({payload, type: keybase1ProvisionUiProvisionerSuccess as typeof keybase1ProvisionUiProvisionerSuccess})
const createKeybase1ProvisionUiSwitchToGPGSignOK = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.switchToGPGSignOK']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.switchToGPGSignOK']['outParam']) => void
  }
}) => ({payload, type: keybase1ProvisionUiSwitchToGPGSignOK as typeof keybase1ProvisionUiSwitchToGPGSignOK})
const createKeybase1ReachabilityReachabilityChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.reachability.reachabilityChanged']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: keybase1ReachabilityReachabilityChanged as typeof keybase1ReachabilityReachabilityChanged,
})
const createKeybase1RekeyUIDelegateRekeyUI = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.delegateRekeyUI']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.delegateRekeyUI']['outParam']) => void
  }
}) => ({payload, type: keybase1RekeyUIDelegateRekeyUI as typeof keybase1RekeyUIDelegateRekeyUI})
const createKeybase1RekeyUIRefresh = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.refresh']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.refresh']['outParam']) => void
  }
}) => ({payload, type: keybase1RekeyUIRefresh as typeof keybase1RekeyUIRefresh})
const createKeybase1RekeyUIRekeySendEvent = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.rekeySendEvent']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.rekeySendEvent']['outParam']) => void
  }
}) => ({payload, type: keybase1RekeyUIRekeySendEvent as typeof keybase1RekeyUIRekeySendEvent})
const createKeybase1SaltpackUiSaltpackPromptForDecrypt = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackPromptForDecrypt']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackPromptForDecrypt']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1SaltpackUiSaltpackPromptForDecrypt as typeof keybase1SaltpackUiSaltpackPromptForDecrypt,
})
const createKeybase1SaltpackUiSaltpackVerifyBadSender = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifyBadSender']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifyBadSender']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1SaltpackUiSaltpackVerifyBadSender as typeof keybase1SaltpackUiSaltpackVerifyBadSender,
})
const createKeybase1SaltpackUiSaltpackVerifySuccess = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifySuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifySuccess']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1SaltpackUiSaltpackVerifySuccess as typeof keybase1SaltpackUiSaltpackVerifySuccess,
})
const createKeybase1SecretUiGetPassphrase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['outParam']) => void
  }
}) => ({payload, type: keybase1SecretUiGetPassphrase as typeof keybase1SecretUiGetPassphrase})
const createKeybase1StreamUiClose = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.close']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.close']['outParam']) => void
  }
}) => ({payload, type: keybase1StreamUiClose as typeof keybase1StreamUiClose})
const createKeybase1StreamUiRead = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.read']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.read']['outParam']) => void
  }
}) => ({payload, type: keybase1StreamUiRead as typeof keybase1StreamUiRead})
const createKeybase1StreamUiReset = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.reset']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.reset']['outParam']) => void
  }
}) => ({payload, type: keybase1StreamUiReset as typeof keybase1StreamUiReset})
const createKeybase1StreamUiWrite = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.write']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.write']['outParam']) => void
  }
}) => ({payload, type: keybase1StreamUiWrite as typeof keybase1StreamUiWrite})
const createKeybase1TeamsUiConfirmInviteLinkAccept = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmInviteLinkAccept']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmInviteLinkAccept']['outParam']
    ) => void
  }
}) => ({
  payload,
  type: keybase1TeamsUiConfirmInviteLinkAccept as typeof keybase1TeamsUiConfirmInviteLinkAccept,
})
const createKeybase1TeamsUiConfirmRootTeamDelete = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmRootTeamDelete']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmRootTeamDelete']['outParam']) => void
  }
}) => ({payload, type: keybase1TeamsUiConfirmRootTeamDelete as typeof keybase1TeamsUiConfirmRootTeamDelete})
const createKeybase1TeamsUiConfirmSubteamDelete = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmSubteamDelete']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmSubteamDelete']['outParam']) => void
  }
}) => ({payload, type: keybase1TeamsUiConfirmSubteamDelete as typeof keybase1TeamsUiConfirmSubteamDelete})
const createKeybase1UiPromptYesNo = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.ui.promptYesNo']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.ui.promptYesNo']['outParam']) => void
  }
}) => ({payload, type: keybase1UiPromptYesNo as typeof keybase1UiPromptYesNo})
const createStellar1NotifyAccountDetailsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.accountDetailsUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: stellar1NotifyAccountDetailsUpdate as typeof stellar1NotifyAccountDetailsUpdate})
const createStellar1NotifyAccountsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.accountsUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: stellar1NotifyAccountsUpdate as typeof stellar1NotifyAccountsUpdate})
const createStellar1NotifyPaymentNotification = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.paymentNotification']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: stellar1NotifyPaymentNotification as typeof stellar1NotifyPaymentNotification})
const createStellar1NotifyPaymentStatusNotification = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.paymentStatusNotification']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: stellar1NotifyPaymentStatusNotification as typeof stellar1NotifyPaymentStatusNotification,
})
const createStellar1NotifyPendingPaymentsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.pendingPaymentsUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: stellar1NotifyPendingPaymentsUpdate as typeof stellar1NotifyPendingPaymentsUpdate})
const createStellar1NotifyRecentPaymentsUpdate = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.recentPaymentsUpdate']['inParam'] & {
    sessionID: number
  }
}) => ({payload, type: stellar1NotifyRecentPaymentsUpdate as typeof stellar1NotifyRecentPaymentsUpdate})
const createStellar1NotifyRequestStatusNotification = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.requestStatusNotification']['inParam'] & {
    sessionID: number
  }
}) => ({
  payload,
  type: stellar1NotifyRequestStatusNotification as typeof stellar1NotifyRequestStatusNotification,
})
const createStellar1UiPaymentReviewed = (payload: {
  readonly params: stellar1Types.MessageTypes['stellar.1.ui.paymentReviewed']['inParam'] & {sessionID: number}
  response: {
    error: stellar1Types.IncomingErrorCallback
    result: (param: stellar1Types.MessageTypes['stellar.1.ui.paymentReviewed']['outParam']) => void
  }
}) => ({payload, type: stellar1UiPaymentReviewed as typeof stellar1UiPaymentReviewed})

// Action Payloads
export type Chat1ChatUiChatBotCommandsUpdateStatusPayload = ReturnType<
  typeof createChat1ChatUiChatBotCommandsUpdateStatus
>
export type Chat1ChatUiChatClearWatchPayload = ReturnType<typeof createChat1ChatUiChatClearWatch>
export type Chat1ChatUiChatCoinFlipStatusPayload = ReturnType<typeof createChat1ChatUiChatCoinFlipStatus>
export type Chat1ChatUiChatCommandMarkdownPayload = ReturnType<typeof createChat1ChatUiChatCommandMarkdown>
export type Chat1ChatUiChatCommandStatusPayload = ReturnType<typeof createChat1ChatUiChatCommandStatus>
export type Chat1ChatUiChatConfirmChannelDeletePayload = ReturnType<
  typeof createChat1ChatUiChatConfirmChannelDelete
>
export type Chat1ChatUiChatGiphySearchResultsPayload = ReturnType<
  typeof createChat1ChatUiChatGiphySearchResults
>
export type Chat1ChatUiChatGiphyToggleResultWindowPayload = ReturnType<
  typeof createChat1ChatUiChatGiphyToggleResultWindow
>
export type Chat1ChatUiChatInboxConversationPayload = ReturnType<
  typeof createChat1ChatUiChatInboxConversation
>
export type Chat1ChatUiChatInboxFailedPayload = ReturnType<typeof createChat1ChatUiChatInboxFailed>
export type Chat1ChatUiChatInboxLayoutPayload = ReturnType<typeof createChat1ChatUiChatInboxLayout>
export type Chat1ChatUiChatInboxUnverifiedPayload = ReturnType<typeof createChat1ChatUiChatInboxUnverified>
export type Chat1ChatUiChatLoadGalleryHitPayload = ReturnType<typeof createChat1ChatUiChatLoadGalleryHit>
export type Chat1ChatUiChatMaybeMentionUpdatePayload = ReturnType<
  typeof createChat1ChatUiChatMaybeMentionUpdate
>
export type Chat1ChatUiChatSearchBotHitsPayload = ReturnType<typeof createChat1ChatUiChatSearchBotHits>
export type Chat1ChatUiChatSearchConvHitsPayload = ReturnType<typeof createChat1ChatUiChatSearchConvHits>
export type Chat1ChatUiChatSearchDonePayload = ReturnType<typeof createChat1ChatUiChatSearchDone>
export type Chat1ChatUiChatSearchHitPayload = ReturnType<typeof createChat1ChatUiChatSearchHit>
export type Chat1ChatUiChatSearchInboxDonePayload = ReturnType<typeof createChat1ChatUiChatSearchInboxDone>
export type Chat1ChatUiChatSearchInboxHitPayload = ReturnType<typeof createChat1ChatUiChatSearchInboxHit>
export type Chat1ChatUiChatSearchInboxStartPayload = ReturnType<typeof createChat1ChatUiChatSearchInboxStart>
export type Chat1ChatUiChatSearchIndexStatusPayload = ReturnType<
  typeof createChat1ChatUiChatSearchIndexStatus
>
export type Chat1ChatUiChatSearchTeamHitsPayload = ReturnType<typeof createChat1ChatUiChatSearchTeamHits>
export type Chat1ChatUiChatShowManageChannelsPayload = ReturnType<
  typeof createChat1ChatUiChatShowManageChannels
>
export type Chat1ChatUiChatStellarDataConfirmPayload = ReturnType<
  typeof createChat1ChatUiChatStellarDataConfirm
>
export type Chat1ChatUiChatStellarDataErrorPayload = ReturnType<typeof createChat1ChatUiChatStellarDataError>
export type Chat1ChatUiChatStellarDonePayload = ReturnType<typeof createChat1ChatUiChatStellarDone>
export type Chat1ChatUiChatStellarShowConfirmPayload = ReturnType<
  typeof createChat1ChatUiChatStellarShowConfirm
>
export type Chat1ChatUiChatThreadCachedPayload = ReturnType<typeof createChat1ChatUiChatThreadCached>
export type Chat1ChatUiChatThreadFullPayload = ReturnType<typeof createChat1ChatUiChatThreadFull>
export type Chat1ChatUiChatThreadStatusPayload = ReturnType<typeof createChat1ChatUiChatThreadStatus>
export type Chat1ChatUiChatWatchPositionPayload = ReturnType<typeof createChat1ChatUiChatWatchPosition>
export type Chat1ChatUiTriggerContactSyncPayload = ReturnType<typeof createChat1ChatUiTriggerContactSync>
export type Chat1NotifyChatChatArchiveCompletePayload = ReturnType<
  typeof createChat1NotifyChatChatArchiveComplete
>
export type Chat1NotifyChatChatArchiveProgressPayload = ReturnType<
  typeof createChat1NotifyChatChatArchiveProgress
>
export type Chat1NotifyChatChatAttachmentDownloadCompletePayload = ReturnType<
  typeof createChat1NotifyChatChatAttachmentDownloadComplete
>
export type Chat1NotifyChatChatAttachmentDownloadProgressPayload = ReturnType<
  typeof createChat1NotifyChatChatAttachmentDownloadProgress
>
export type Chat1NotifyChatChatAttachmentUploadProgressPayload = ReturnType<
  typeof createChat1NotifyChatChatAttachmentUploadProgress
>
export type Chat1NotifyChatChatAttachmentUploadStartPayload = ReturnType<
  typeof createChat1NotifyChatChatAttachmentUploadStart
>
export type Chat1NotifyChatChatConvUpdatePayload = ReturnType<typeof createChat1NotifyChatChatConvUpdate>
export type Chat1NotifyChatChatIdentifyUpdatePayload = ReturnType<
  typeof createChat1NotifyChatChatIdentifyUpdate
>
export type Chat1NotifyChatChatInboxStalePayload = ReturnType<typeof createChat1NotifyChatChatInboxStale>
export type Chat1NotifyChatChatInboxSyncStartedPayload = ReturnType<
  typeof createChat1NotifyChatChatInboxSyncStarted
>
export type Chat1NotifyChatChatInboxSyncedPayload = ReturnType<typeof createChat1NotifyChatChatInboxSynced>
export type Chat1NotifyChatChatJoinedConversationPayload = ReturnType<
  typeof createChat1NotifyChatChatJoinedConversation
>
export type Chat1NotifyChatChatKBFSToImpteamUpgradePayload = ReturnType<
  typeof createChat1NotifyChatChatKBFSToImpteamUpgrade
>
export type Chat1NotifyChatChatLeftConversationPayload = ReturnType<
  typeof createChat1NotifyChatChatLeftConversation
>
export type Chat1NotifyChatChatParticipantsInfoPayload = ReturnType<
  typeof createChat1NotifyChatChatParticipantsInfo
>
export type Chat1NotifyChatChatPaymentInfoPayload = ReturnType<typeof createChat1NotifyChatChatPaymentInfo>
export type Chat1NotifyChatChatPromptUnfurlPayload = ReturnType<typeof createChat1NotifyChatChatPromptUnfurl>
export type Chat1NotifyChatChatRequestInfoPayload = ReturnType<typeof createChat1NotifyChatChatRequestInfo>
export type Chat1NotifyChatChatResetConversationPayload = ReturnType<
  typeof createChat1NotifyChatChatResetConversation
>
export type Chat1NotifyChatChatSetConvRetentionPayload = ReturnType<
  typeof createChat1NotifyChatChatSetConvRetention
>
export type Chat1NotifyChatChatSetConvSettingsPayload = ReturnType<
  typeof createChat1NotifyChatChatSetConvSettings
>
export type Chat1NotifyChatChatSetTeamRetentionPayload = ReturnType<
  typeof createChat1NotifyChatChatSetTeamRetention
>
export type Chat1NotifyChatChatSubteamRenamePayload = ReturnType<
  typeof createChat1NotifyChatChatSubteamRename
>
export type Chat1NotifyChatChatTLFFinalizePayload = ReturnType<typeof createChat1NotifyChatChatTLFFinalize>
export type Chat1NotifyChatChatTLFResolvePayload = ReturnType<typeof createChat1NotifyChatChatTLFResolve>
export type Chat1NotifyChatChatThreadsStalePayload = ReturnType<typeof createChat1NotifyChatChatThreadsStale>
export type Chat1NotifyChatChatTypingUpdatePayload = ReturnType<typeof createChat1NotifyChatChatTypingUpdate>
export type Chat1NotifyChatChatWelcomeMessageLoadedPayload = ReturnType<
  typeof createChat1NotifyChatChatWelcomeMessageLoaded
>
export type Chat1NotifyChatNewChatActivityPayload = ReturnType<typeof createChat1NotifyChatNewChatActivity>
export type Keybase1GpgUiConfirmDuplicateKeyChosenPayload = ReturnType<
  typeof createKeybase1GpgUiConfirmDuplicateKeyChosen
>
export type Keybase1GpgUiConfirmImportSecretToExistingKeyPayload = ReturnType<
  typeof createKeybase1GpgUiConfirmImportSecretToExistingKey
>
export type Keybase1GpgUiGetTTYPayload = ReturnType<typeof createKeybase1GpgUiGetTTY>
export type Keybase1GpgUiSelectKeyAndPushOptionPayload = ReturnType<
  typeof createKeybase1GpgUiSelectKeyAndPushOption
>
export type Keybase1GpgUiSelectKeyPayload = ReturnType<typeof createKeybase1GpgUiSelectKey>
export type Keybase1GpgUiSignPayload = ReturnType<typeof createKeybase1GpgUiSign>
export type Keybase1GpgUiWantToAddGPGKeyPayload = ReturnType<typeof createKeybase1GpgUiWantToAddGPGKey>
export type Keybase1GregorUIPushOutOfBandMessagesPayload = ReturnType<
  typeof createKeybase1GregorUIPushOutOfBandMessages
>
export type Keybase1GregorUIPushStatePayload = ReturnType<typeof createKeybase1GregorUIPushState>
export type Keybase1HomeUIHomeUIRefreshPayload = ReturnType<typeof createKeybase1HomeUIHomeUIRefresh>
export type Keybase1Identify3UiIdentify3ResultPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3Result
>
export type Keybase1Identify3UiIdentify3ShowTrackerPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3ShowTracker
>
export type Keybase1Identify3UiIdentify3SummaryPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3Summary
>
export type Keybase1Identify3UiIdentify3TrackerTimedOutPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3TrackerTimedOut
>
export type Keybase1Identify3UiIdentify3UpdateRowPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3UpdateRow
>
export type Keybase1Identify3UiIdentify3UpdateUserCardPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3UpdateUserCard
>
export type Keybase1Identify3UiIdentify3UserResetPayload = ReturnType<
  typeof createKeybase1Identify3UiIdentify3UserReset
>
export type Keybase1IdentifyUiCancelPayload = ReturnType<typeof createKeybase1IdentifyUiCancel>
export type Keybase1IdentifyUiConfirmPayload = ReturnType<typeof createKeybase1IdentifyUiConfirm>
export type Keybase1IdentifyUiDelegateIdentifyUIPayload = ReturnType<
  typeof createKeybase1IdentifyUiDelegateIdentifyUI
>
export type Keybase1IdentifyUiDismissPayload = ReturnType<typeof createKeybase1IdentifyUiDismiss>
export type Keybase1IdentifyUiDisplayCryptocurrencyPayload = ReturnType<
  typeof createKeybase1IdentifyUiDisplayCryptocurrency
>
export type Keybase1IdentifyUiDisplayKeyPayload = ReturnType<typeof createKeybase1IdentifyUiDisplayKey>
export type Keybase1IdentifyUiDisplayStellarAccountPayload = ReturnType<
  typeof createKeybase1IdentifyUiDisplayStellarAccount
>
export type Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload = ReturnType<
  typeof createKeybase1IdentifyUiDisplayTLFCreateWithInvite
>
export type Keybase1IdentifyUiDisplayTrackStatementPayload = ReturnType<
  typeof createKeybase1IdentifyUiDisplayTrackStatement
>
export type Keybase1IdentifyUiDisplayUserCardPayload = ReturnType<
  typeof createKeybase1IdentifyUiDisplayUserCard
>
export type Keybase1IdentifyUiFinishPayload = ReturnType<typeof createKeybase1IdentifyUiFinish>
export type Keybase1IdentifyUiFinishSocialProofCheckPayload = ReturnType<
  typeof createKeybase1IdentifyUiFinishSocialProofCheck
>
export type Keybase1IdentifyUiFinishWebProofCheckPayload = ReturnType<
  typeof createKeybase1IdentifyUiFinishWebProofCheck
>
export type Keybase1IdentifyUiLaunchNetworkChecksPayload = ReturnType<
  typeof createKeybase1IdentifyUiLaunchNetworkChecks
>
export type Keybase1IdentifyUiReportLastTrackPayload = ReturnType<
  typeof createKeybase1IdentifyUiReportLastTrack
>
export type Keybase1IdentifyUiReportTrackTokenPayload = ReturnType<
  typeof createKeybase1IdentifyUiReportTrackToken
>
export type Keybase1IdentifyUiStartPayload = ReturnType<typeof createKeybase1IdentifyUiStart>
export type Keybase1LogUiLogPayload = ReturnType<typeof createKeybase1LogUiLog>
export type Keybase1LoginUiChooseDeviceToRecoverWithPayload = ReturnType<
  typeof createKeybase1LoginUiChooseDeviceToRecoverWith
>
export type Keybase1LoginUiDisplayPaperKeyPhrasePayload = ReturnType<
  typeof createKeybase1LoginUiDisplayPaperKeyPhrase
>
export type Keybase1LoginUiDisplayPrimaryPaperKeyPayload = ReturnType<
  typeof createKeybase1LoginUiDisplayPrimaryPaperKey
>
export type Keybase1LoginUiDisplayResetMessagePayload = ReturnType<
  typeof createKeybase1LoginUiDisplayResetMessage
>
export type Keybase1LoginUiDisplayResetProgressPayload = ReturnType<
  typeof createKeybase1LoginUiDisplayResetProgress
>
export type Keybase1LoginUiExplainDeviceRecoveryPayload = ReturnType<
  typeof createKeybase1LoginUiExplainDeviceRecovery
>
export type Keybase1LoginUiGetEmailOrUsernamePayload = ReturnType<
  typeof createKeybase1LoginUiGetEmailOrUsername
>
export type Keybase1LoginUiPromptPassphraseRecoveryPayload = ReturnType<
  typeof createKeybase1LoginUiPromptPassphraseRecovery
>
export type Keybase1LoginUiPromptResetAccountPayload = ReturnType<
  typeof createKeybase1LoginUiPromptResetAccount
>
export type Keybase1LoginUiPromptRevokePaperKeysPayload = ReturnType<
  typeof createKeybase1LoginUiPromptRevokePaperKeys
>
export type Keybase1LogsendPrepareLogsendPayload = ReturnType<typeof createKeybase1LogsendPrepareLogsend>
export type Keybase1NotifyAppExitPayload = ReturnType<typeof createKeybase1NotifyAppExit>
export type Keybase1NotifyAuditBoxAuditErrorPayload = ReturnType<
  typeof createKeybase1NotifyAuditBoxAuditError
>
export type Keybase1NotifyAuditRootAuditErrorPayload = ReturnType<
  typeof createKeybase1NotifyAuditRootAuditError
>
export type Keybase1NotifyBadgesBadgeStatePayload = ReturnType<typeof createKeybase1NotifyBadgesBadgeState>
export type Keybase1NotifyCanUserPerformCanUserPerformChangedPayload = ReturnType<
  typeof createKeybase1NotifyCanUserPerformCanUserPerformChanged
>
export type Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload = ReturnType<
  typeof createKeybase1NotifyDeviceCloneDeviceCloneCountChanged
>
export type Keybase1NotifyEmailAddressEmailAddressVerifiedPayload = ReturnType<
  typeof createKeybase1NotifyEmailAddressEmailAddressVerified
>
export type Keybase1NotifyEmailAddressEmailsChangedPayload = ReturnType<
  typeof createKeybase1NotifyEmailAddressEmailsChanged
>
export type Keybase1NotifyEphemeralNewTeamEkPayload = ReturnType<
  typeof createKeybase1NotifyEphemeralNewTeamEk
>
export type Keybase1NotifyEphemeralNewTeambotEkPayload = ReturnType<
  typeof createKeybase1NotifyEphemeralNewTeambotEk
>
export type Keybase1NotifyEphemeralTeambotEkNeededPayload = ReturnType<
  typeof createKeybase1NotifyEphemeralTeambotEkNeeded
>
export type Keybase1NotifyFSFSActivityPayload = ReturnType<typeof createKeybase1NotifyFSFSActivity>
export type Keybase1NotifyFSFSEditListResponsePayload = ReturnType<
  typeof createKeybase1NotifyFSFSEditListResponse
>
export type Keybase1NotifyFSFSFavoritesChangedPayload = ReturnType<
  typeof createKeybase1NotifyFSFSFavoritesChanged
>
export type Keybase1NotifyFSFSOnlineStatusChangedPayload = ReturnType<
  typeof createKeybase1NotifyFSFSOnlineStatusChanged
>
export type Keybase1NotifyFSFSOverallSyncStatusChangedPayload = ReturnType<
  typeof createKeybase1NotifyFSFSOverallSyncStatusChanged
>
export type Keybase1NotifyFSFSPathUpdatedPayload = ReturnType<typeof createKeybase1NotifyFSFSPathUpdated>
export type Keybase1NotifyFSFSSubscriptionNotifyPathPayload = ReturnType<
  typeof createKeybase1NotifyFSFSSubscriptionNotifyPath
>
export type Keybase1NotifyFSFSSubscriptionNotifyPayload = ReturnType<
  typeof createKeybase1NotifyFSFSSubscriptionNotify
>
export type Keybase1NotifyFSFSSyncActivityPayload = ReturnType<typeof createKeybase1NotifyFSFSSyncActivity>
export type Keybase1NotifyFSFSSyncStatusResponsePayload = ReturnType<
  typeof createKeybase1NotifyFSFSSyncStatusResponse
>
export type Keybase1NotifyFavoritesFavoritesChangedPayload = ReturnType<
  typeof createKeybase1NotifyFavoritesFavoritesChanged
>
export type Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload = ReturnType<
  typeof createKeybase1NotifyFeaturedBotsFeaturedBotsUpdate
>
export type Keybase1NotifyInviteFriendsUpdateInviteCountsPayload = ReturnType<
  typeof createKeybase1NotifyInviteFriendsUpdateInviteCounts
>
export type Keybase1NotifyKeyfamilyKeyfamilyChangedPayload = ReturnType<
  typeof createKeybase1NotifyKeyfamilyKeyfamilyChanged
>
export type Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload = ReturnType<
  typeof createKeybase1NotifyPGPPgpKeyInSecretStoreFile
>
export type Keybase1NotifyPaperKeyPaperKeyCachedPayload = ReturnType<
  typeof createKeybase1NotifyPaperKeyPaperKeyCached
>
export type Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload = ReturnType<
  typeof createKeybase1NotifyPhoneNumberPhoneNumbersChanged
>
export type Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload = ReturnType<
  typeof createKeybase1NotifyRuntimeStatsRuntimeStatsUpdate
>
export type Keybase1NotifySaltpackSaltpackOperationDonePayload = ReturnType<
  typeof createKeybase1NotifySaltpackSaltpackOperationDone
>
export type Keybase1NotifySaltpackSaltpackOperationProgressPayload = ReturnType<
  typeof createKeybase1NotifySaltpackSaltpackOperationProgress
>
export type Keybase1NotifySaltpackSaltpackOperationStartPayload = ReturnType<
  typeof createKeybase1NotifySaltpackSaltpackOperationStart
>
export type Keybase1NotifyServiceHTTPSrvInfoUpdatePayload = ReturnType<
  typeof createKeybase1NotifyServiceHTTPSrvInfoUpdate
>
export type Keybase1NotifyServiceHandleKeybaseLinkPayload = ReturnType<
  typeof createKeybase1NotifyServiceHandleKeybaseLink
>
export type Keybase1NotifyServiceShutdownPayload = ReturnType<typeof createKeybase1NotifyServiceShutdown>
export type Keybase1NotifySessionClientOutOfDatePayload = ReturnType<
  typeof createKeybase1NotifySessionClientOutOfDate
>
export type Keybase1NotifySessionLoggedInPayload = ReturnType<typeof createKeybase1NotifySessionLoggedIn>
export type Keybase1NotifySessionLoggedOutPayload = ReturnType<typeof createKeybase1NotifySessionLoggedOut>
export type Keybase1NotifySimpleFSSimpleFSArchiveStatusChangedPayload = ReturnType<
  typeof createKeybase1NotifySimpleFSSimpleFSArchiveStatusChanged
>
export type Keybase1NotifyTeamAvatarUpdatedPayload = ReturnType<typeof createKeybase1NotifyTeamAvatarUpdated>
export type Keybase1NotifyTeamNewlyAddedToTeamPayload = ReturnType<
  typeof createKeybase1NotifyTeamNewlyAddedToTeam
>
export type Keybase1NotifyTeamTeamAbandonedPayload = ReturnType<typeof createKeybase1NotifyTeamTeamAbandoned>
export type Keybase1NotifyTeamTeamChangedByIDPayload = ReturnType<
  typeof createKeybase1NotifyTeamTeamChangedByID
>
export type Keybase1NotifyTeamTeamChangedByNamePayload = ReturnType<
  typeof createKeybase1NotifyTeamTeamChangedByName
>
export type Keybase1NotifyTeamTeamDeletedPayload = ReturnType<typeof createKeybase1NotifyTeamTeamDeleted>
export type Keybase1NotifyTeamTeamExitPayload = ReturnType<typeof createKeybase1NotifyTeamTeamExit>
export type Keybase1NotifyTeamTeamMetadataUpdatePayload = ReturnType<
  typeof createKeybase1NotifyTeamTeamMetadataUpdate
>
export type Keybase1NotifyTeamTeamRoleMapChangedPayload = ReturnType<
  typeof createKeybase1NotifyTeamTeamRoleMapChanged
>
export type Keybase1NotifyTeamTeamTreeMembershipsDonePayload = ReturnType<
  typeof createKeybase1NotifyTeamTeamTreeMembershipsDone
>
export type Keybase1NotifyTeamTeamTreeMembershipsPartialPayload = ReturnType<
  typeof createKeybase1NotifyTeamTeamTreeMembershipsPartial
>
export type Keybase1NotifyTeambotNewTeambotKeyPayload = ReturnType<
  typeof createKeybase1NotifyTeambotNewTeambotKey
>
export type Keybase1NotifyTeambotTeambotKeyNeededPayload = ReturnType<
  typeof createKeybase1NotifyTeambotTeambotKeyNeeded
>
export type Keybase1NotifyTrackingNotifyUserBlockedPayload = ReturnType<
  typeof createKeybase1NotifyTrackingNotifyUserBlocked
>
export type Keybase1NotifyTrackingTrackingChangedPayload = ReturnType<
  typeof createKeybase1NotifyTrackingTrackingChanged
>
export type Keybase1NotifyTrackingTrackingInfoPayload = ReturnType<
  typeof createKeybase1NotifyTrackingTrackingInfo
>
export type Keybase1NotifyUsersIdentifyUpdatePayload = ReturnType<
  typeof createKeybase1NotifyUsersIdentifyUpdate
>
export type Keybase1NotifyUsersPasswordChangedPayload = ReturnType<
  typeof createKeybase1NotifyUsersPasswordChanged
>
export type Keybase1NotifyUsersUserChangedPayload = ReturnType<typeof createKeybase1NotifyUsersUserChanged>
export type Keybase1NotifyUsersWebOfTrustChangedPayload = ReturnType<
  typeof createKeybase1NotifyUsersWebOfTrustChanged
>
export type Keybase1PgpUiFinishedPayload = ReturnType<typeof createKeybase1PgpUiFinished>
export type Keybase1PgpUiKeyGeneratedPayload = ReturnType<typeof createKeybase1PgpUiKeyGenerated>
export type Keybase1PgpUiOutputPGPWarningPayload = ReturnType<typeof createKeybase1PgpUiOutputPGPWarning>
export type Keybase1PgpUiOutputSignatureNonKeybasePayload = ReturnType<
  typeof createKeybase1PgpUiOutputSignatureNonKeybase
>
export type Keybase1PgpUiOutputSignatureSuccessPayload = ReturnType<
  typeof createKeybase1PgpUiOutputSignatureSuccess
>
export type Keybase1PgpUiShouldPushPrivatePayload = ReturnType<typeof createKeybase1PgpUiShouldPushPrivate>
export type Keybase1ProveUiCheckingPayload = ReturnType<typeof createKeybase1ProveUiChecking>
export type Keybase1ProveUiContinueCheckingPayload = ReturnType<typeof createKeybase1ProveUiContinueChecking>
export type Keybase1ProveUiDisplayRecheckWarningPayload = ReturnType<
  typeof createKeybase1ProveUiDisplayRecheckWarning
>
export type Keybase1ProveUiOkToCheckPayload = ReturnType<typeof createKeybase1ProveUiOkToCheck>
export type Keybase1ProveUiOutputInstructionsPayload = ReturnType<
  typeof createKeybase1ProveUiOutputInstructions
>
export type Keybase1ProveUiOutputPrechecksPayload = ReturnType<typeof createKeybase1ProveUiOutputPrechecks>
export type Keybase1ProveUiPreProofWarningPayload = ReturnType<typeof createKeybase1ProveUiPreProofWarning>
export type Keybase1ProveUiPromptOverwritePayload = ReturnType<typeof createKeybase1ProveUiPromptOverwrite>
export type Keybase1ProveUiPromptUsernamePayload = ReturnType<typeof createKeybase1ProveUiPromptUsername>
export type Keybase1ProvisionUiChooseDevicePayload = ReturnType<typeof createKeybase1ProvisionUiChooseDevice>
export type Keybase1ProvisionUiChooseDeviceTypePayload = ReturnType<
  typeof createKeybase1ProvisionUiChooseDeviceType
>
export type Keybase1ProvisionUiChooseGPGMethodPayload = ReturnType<
  typeof createKeybase1ProvisionUiChooseGPGMethod
>
export type Keybase1ProvisionUiChooseProvisioningMethodPayload = ReturnType<
  typeof createKeybase1ProvisionUiChooseProvisioningMethod
>
export type Keybase1ProvisionUiDisplayAndPromptSecretPayload = ReturnType<
  typeof createKeybase1ProvisionUiDisplayAndPromptSecret
>
export type Keybase1ProvisionUiDisplaySecretExchangedPayload = ReturnType<
  typeof createKeybase1ProvisionUiDisplaySecretExchanged
>
export type Keybase1ProvisionUiPromptNewDeviceNamePayload = ReturnType<
  typeof createKeybase1ProvisionUiPromptNewDeviceName
>
export type Keybase1ProvisionUiProvisioneeSuccessPayload = ReturnType<
  typeof createKeybase1ProvisionUiProvisioneeSuccess
>
export type Keybase1ProvisionUiProvisionerSuccessPayload = ReturnType<
  typeof createKeybase1ProvisionUiProvisionerSuccess
>
export type Keybase1ProvisionUiSwitchToGPGSignOKPayload = ReturnType<
  typeof createKeybase1ProvisionUiSwitchToGPGSignOK
>
export type Keybase1ReachabilityReachabilityChangedPayload = ReturnType<
  typeof createKeybase1ReachabilityReachabilityChanged
>
export type Keybase1RekeyUIDelegateRekeyUIPayload = ReturnType<typeof createKeybase1RekeyUIDelegateRekeyUI>
export type Keybase1RekeyUIRefreshPayload = ReturnType<typeof createKeybase1RekeyUIRefresh>
export type Keybase1RekeyUIRekeySendEventPayload = ReturnType<typeof createKeybase1RekeyUIRekeySendEvent>
export type Keybase1SaltpackUiSaltpackPromptForDecryptPayload = ReturnType<
  typeof createKeybase1SaltpackUiSaltpackPromptForDecrypt
>
export type Keybase1SaltpackUiSaltpackVerifyBadSenderPayload = ReturnType<
  typeof createKeybase1SaltpackUiSaltpackVerifyBadSender
>
export type Keybase1SaltpackUiSaltpackVerifySuccessPayload = ReturnType<
  typeof createKeybase1SaltpackUiSaltpackVerifySuccess
>
export type Keybase1SecretUiGetPassphrasePayload = ReturnType<typeof createKeybase1SecretUiGetPassphrase>
export type Keybase1StreamUiClosePayload = ReturnType<typeof createKeybase1StreamUiClose>
export type Keybase1StreamUiReadPayload = ReturnType<typeof createKeybase1StreamUiRead>
export type Keybase1StreamUiResetPayload = ReturnType<typeof createKeybase1StreamUiReset>
export type Keybase1StreamUiWritePayload = ReturnType<typeof createKeybase1StreamUiWrite>
export type Keybase1TeamsUiConfirmInviteLinkAcceptPayload = ReturnType<
  typeof createKeybase1TeamsUiConfirmInviteLinkAccept
>
export type Keybase1TeamsUiConfirmRootTeamDeletePayload = ReturnType<
  typeof createKeybase1TeamsUiConfirmRootTeamDelete
>
export type Keybase1TeamsUiConfirmSubteamDeletePayload = ReturnType<
  typeof createKeybase1TeamsUiConfirmSubteamDelete
>
export type Keybase1UiPromptYesNoPayload = ReturnType<typeof createKeybase1UiPromptYesNo>
export type Stellar1NotifyAccountDetailsUpdatePayload = ReturnType<
  typeof createStellar1NotifyAccountDetailsUpdate
>
export type Stellar1NotifyAccountsUpdatePayload = ReturnType<typeof createStellar1NotifyAccountsUpdate>
export type Stellar1NotifyPaymentNotificationPayload = ReturnType<
  typeof createStellar1NotifyPaymentNotification
>
export type Stellar1NotifyPaymentStatusNotificationPayload = ReturnType<
  typeof createStellar1NotifyPaymentStatusNotification
>
export type Stellar1NotifyPendingPaymentsUpdatePayload = ReturnType<
  typeof createStellar1NotifyPendingPaymentsUpdate
>
export type Stellar1NotifyRecentPaymentsUpdatePayload = ReturnType<
  typeof createStellar1NotifyRecentPaymentsUpdate
>
export type Stellar1NotifyRequestStatusNotificationPayload = ReturnType<
  typeof createStellar1NotifyRequestStatusNotification
>
export type Stellar1UiPaymentReviewedPayload = ReturnType<typeof createStellar1UiPaymentReviewed>

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
