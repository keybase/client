// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as chat1Types from '../constants/types/rpc-chat-gen'
import * as keybase1Types from '../constants/types/rpc-gen'
import * as gregor1Types from '../constants/types/rpc-gregor-gen'
import * as stellar1Types from '../constants/types/rpc-stellar-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine-gen but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'engine-gen:'
export const chat1ChatUiChatAttachmentDownloadDone = 'engine-gen:chat1ChatUiChatAttachmentDownloadDone'
export const chat1ChatUiChatAttachmentDownloadProgress =
  'engine-gen:chat1ChatUiChatAttachmentDownloadProgress'
export const chat1ChatUiChatAttachmentDownloadStart = 'engine-gen:chat1ChatUiChatAttachmentDownloadStart'
export const chat1ChatUiChatCoinFlipStatus = 'engine-gen:chat1ChatUiChatCoinFlipStatus'
export const chat1ChatUiChatCommandMarkdown = 'engine-gen:chat1ChatUiChatCommandMarkdown'
export const chat1ChatUiChatConfirmChannelDelete = 'engine-gen:chat1ChatUiChatConfirmChannelDelete'
export const chat1ChatUiChatGiphySearchResults = 'engine-gen:chat1ChatUiChatGiphySearchResults'
export const chat1ChatUiChatGiphyToggleResultWindow = 'engine-gen:chat1ChatUiChatGiphyToggleResultWindow'
export const chat1ChatUiChatInboxConversation = 'engine-gen:chat1ChatUiChatInboxConversation'
export const chat1ChatUiChatInboxFailed = 'engine-gen:chat1ChatUiChatInboxFailed'
export const chat1ChatUiChatInboxUnverified = 'engine-gen:chat1ChatUiChatInboxUnverified'
export const chat1ChatUiChatLoadGalleryHit = 'engine-gen:chat1ChatUiChatLoadGalleryHit'
export const chat1ChatUiChatMaybeMentionUpdate = 'engine-gen:chat1ChatUiChatMaybeMentionUpdate'
export const chat1ChatUiChatSearchConvHits = 'engine-gen:chat1ChatUiChatSearchConvHits'
export const chat1ChatUiChatSearchDone = 'engine-gen:chat1ChatUiChatSearchDone'
export const chat1ChatUiChatSearchHit = 'engine-gen:chat1ChatUiChatSearchHit'
export const chat1ChatUiChatSearchInboxDone = 'engine-gen:chat1ChatUiChatSearchInboxDone'
export const chat1ChatUiChatSearchInboxHit = 'engine-gen:chat1ChatUiChatSearchInboxHit'
export const chat1ChatUiChatSearchInboxStart = 'engine-gen:chat1ChatUiChatSearchInboxStart'
export const chat1ChatUiChatSearchIndexStatus = 'engine-gen:chat1ChatUiChatSearchIndexStatus'
export const chat1ChatUiChatShowManageChannels = 'engine-gen:chat1ChatUiChatShowManageChannels'
export const chat1ChatUiChatStellarDataConfirm = 'engine-gen:chat1ChatUiChatStellarDataConfirm'
export const chat1ChatUiChatStellarDataError = 'engine-gen:chat1ChatUiChatStellarDataError'
export const chat1ChatUiChatStellarDone = 'engine-gen:chat1ChatUiChatStellarDone'
export const chat1ChatUiChatStellarShowConfirm = 'engine-gen:chat1ChatUiChatStellarShowConfirm'
export const chat1ChatUiChatThreadCached = 'engine-gen:chat1ChatUiChatThreadCached'
export const chat1ChatUiChatThreadFull = 'engine-gen:chat1ChatUiChatThreadFull'
export const chat1NotifyChatChatAttachmentUploadProgress =
  'engine-gen:chat1NotifyChatChatAttachmentUploadProgress'
export const chat1NotifyChatChatAttachmentUploadStart = 'engine-gen:chat1NotifyChatChatAttachmentUploadStart'
export const chat1NotifyChatChatIdentifyUpdate = 'engine-gen:chat1NotifyChatChatIdentifyUpdate'
export const chat1NotifyChatChatInboxStale = 'engine-gen:chat1NotifyChatChatInboxStale'
export const chat1NotifyChatChatInboxSyncStarted = 'engine-gen:chat1NotifyChatChatInboxSyncStarted'
export const chat1NotifyChatChatInboxSynced = 'engine-gen:chat1NotifyChatChatInboxSynced'
export const chat1NotifyChatChatJoinedConversation = 'engine-gen:chat1NotifyChatChatJoinedConversation'
export const chat1NotifyChatChatKBFSToImpteamUpgrade = 'engine-gen:chat1NotifyChatChatKBFSToImpteamUpgrade'
export const chat1NotifyChatChatLeftConversation = 'engine-gen:chat1NotifyChatChatLeftConversation'
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
export const chat1NotifyChatNewChatActivity = 'engine-gen:chat1NotifyChatNewChatActivity'
export const connected = 'engine-gen:connected'
export const disconnected = 'engine-gen:disconnected'
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
export const keybase1LoginUiDisplayPaperKeyPhrase = 'engine-gen:keybase1LoginUiDisplayPaperKeyPhrase'
export const keybase1LoginUiDisplayPrimaryPaperKey = 'engine-gen:keybase1LoginUiDisplayPrimaryPaperKey'
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
export const keybase1NotifyFSFSActivity = 'engine-gen:keybase1NotifyFSFSActivity'
export const keybase1NotifyFSFSEditListResponse = 'engine-gen:keybase1NotifyFSFSEditListResponse'
export const keybase1NotifyFSFSFavoritesChanged = 'engine-gen:keybase1NotifyFSFSFavoritesChanged'
export const keybase1NotifyFSFSOnlineStatusChanged = 'engine-gen:keybase1NotifyFSFSOnlineStatusChanged'
export const keybase1NotifyFSFSOverallSyncStatusChanged =
  'engine-gen:keybase1NotifyFSFSOverallSyncStatusChanged'
export const keybase1NotifyFSFSPathUpdated = 'engine-gen:keybase1NotifyFSFSPathUpdated'
export const keybase1NotifyFSFSSyncActivity = 'engine-gen:keybase1NotifyFSFSSyncActivity'
export const keybase1NotifyFSFSSyncStatusResponse = 'engine-gen:keybase1NotifyFSFSSyncStatusResponse'
export const keybase1NotifyFavoritesFavoritesChanged = 'engine-gen:keybase1NotifyFavoritesFavoritesChanged'
export const keybase1NotifyKeyfamilyKeyfamilyChanged = 'engine-gen:keybase1NotifyKeyfamilyKeyfamilyChanged'
export const keybase1NotifyPGPPgpKeyInSecretStoreFile = 'engine-gen:keybase1NotifyPGPPgpKeyInSecretStoreFile'
export const keybase1NotifyPaperKeyPaperKeyCached = 'engine-gen:keybase1NotifyPaperKeyPaperKeyCached'
export const keybase1NotifyPhoneNumberPhoneNumbersChanged =
  'engine-gen:keybase1NotifyPhoneNumberPhoneNumbersChanged'
export const keybase1NotifyServiceShutdown = 'engine-gen:keybase1NotifyServiceShutdown'
export const keybase1NotifySessionClientOutOfDate = 'engine-gen:keybase1NotifySessionClientOutOfDate'
export const keybase1NotifySessionLoggedIn = 'engine-gen:keybase1NotifySessionLoggedIn'
export const keybase1NotifySessionLoggedOut = 'engine-gen:keybase1NotifySessionLoggedOut'
export const keybase1NotifyTeamAvatarUpdated = 'engine-gen:keybase1NotifyTeamAvatarUpdated'
export const keybase1NotifyTeamNewlyAddedToTeam = 'engine-gen:keybase1NotifyTeamNewlyAddedToTeam'
export const keybase1NotifyTeamTeamAbandoned = 'engine-gen:keybase1NotifyTeamTeamAbandoned'
export const keybase1NotifyTeamTeamChangedByID = 'engine-gen:keybase1NotifyTeamTeamChangedByID'
export const keybase1NotifyTeamTeamChangedByName = 'engine-gen:keybase1NotifyTeamTeamChangedByName'
export const keybase1NotifyTeamTeamDeleted = 'engine-gen:keybase1NotifyTeamTeamDeleted'
export const keybase1NotifyTeamTeamExit = 'engine-gen:keybase1NotifyTeamTeamExit'
export const keybase1NotifyTrackingTrackingChanged = 'engine-gen:keybase1NotifyTrackingTrackingChanged'
export const keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged =
  'engine-gen:keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged'
export const keybase1NotifyUsersPasswordChanged = 'engine-gen:keybase1NotifyUsersPasswordChanged'
export const keybase1NotifyUsersUserChanged = 'engine-gen:keybase1NotifyUsersUserChanged'
export const keybase1PgpUiFinished = 'engine-gen:keybase1PgpUiFinished'
export const keybase1PgpUiKeyGenerated = 'engine-gen:keybase1PgpUiKeyGenerated'
export const keybase1PgpUiOutputSignatureSuccess = 'engine-gen:keybase1PgpUiOutputSignatureSuccess'
export const keybase1PgpUiOutputSignatureSuccessNonKeybase =
  'engine-gen:keybase1PgpUiOutputSignatureSuccessNonKeybase'
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

// Payload Types
type _Chat1ChatUiChatAttachmentDownloadDonePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatAttachmentDownloadDone']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatAttachmentDownloadDone']['outParam']) => void
  }
}
type _Chat1ChatUiChatAttachmentDownloadProgressPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatAttachmentDownloadProgress']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (
      param: chat1Types.MessageTypes['chat.1.chatUi.chatAttachmentDownloadProgress']['outParam']
    ) => void
  }
}
type _Chat1ChatUiChatAttachmentDownloadStartPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatAttachmentDownloadStart']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatAttachmentDownloadStart']['outParam']) => void
  }
}
type _Chat1ChatUiChatCoinFlipStatusPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCoinFlipStatus']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCoinFlipStatus']['outParam']) => void
  }
}
type _Chat1ChatUiChatCommandMarkdownPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatCommandMarkdown']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatCommandMarkdown']['outParam']) => void
  }
}
type _Chat1ChatUiChatConfirmChannelDeletePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatConfirmChannelDelete']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatConfirmChannelDelete']['outParam']) => void
  }
}
type _Chat1ChatUiChatGiphySearchResultsPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatGiphySearchResults']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatGiphySearchResults']['outParam']) => void
  }
}
type _Chat1ChatUiChatGiphyToggleResultWindowPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatGiphyToggleResultWindow']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatGiphyToggleResultWindow']['outParam']) => void
  }
}
type _Chat1ChatUiChatInboxConversationPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxConversation']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxConversation']['outParam']) => void
  }
}
type _Chat1ChatUiChatInboxFailedPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxFailed']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxFailed']['outParam']) => void
  }
}
type _Chat1ChatUiChatInboxUnverifiedPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatInboxUnverified']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatInboxUnverified']['outParam']) => void
  }
}
type _Chat1ChatUiChatLoadGalleryHitPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['outParam']) => void
  }
}
type _Chat1ChatUiChatMaybeMentionUpdatePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchConvHitsPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchConvHits']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchDonePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchDone']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchDone']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchHitPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchHit']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchHit']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchInboxDonePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxDone']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxDone']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchInboxHitPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchInboxStartPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxStart']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchInboxStart']['outParam']) => void
  }
}
type _Chat1ChatUiChatSearchIndexStatusPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['outParam']) => void
  }
}
type _Chat1ChatUiChatShowManageChannelsPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['outParam']) => void
  }
}
type _Chat1ChatUiChatStellarDataConfirmPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['outParam']) => void
  }
}
type _Chat1ChatUiChatStellarDataErrorPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataError']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDataError']['outParam']) => void
  }
}
type _Chat1ChatUiChatStellarDonePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDone']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarDone']['outParam']) => void
  }
}
type _Chat1ChatUiChatStellarShowConfirmPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatStellarShowConfirm']['inParam'] & {
    sessionID: number
  }
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatStellarShowConfirm']['outParam']) => void
  }
}
type _Chat1ChatUiChatThreadCachedPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadCached']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadCached']['outParam']) => void
  }
}
type _Chat1ChatUiChatThreadFullPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatThreadFull']['inParam'] & {sessionID: number}
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatThreadFull']['outParam']) => void
  }
}
type _Chat1NotifyChatChatAttachmentUploadProgressPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentUploadProgress']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatAttachmentUploadStartPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatAttachmentUploadStart']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatIdentifyUpdatePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatIdentifyUpdate']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatInboxStalePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxStale']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatInboxSyncStartedPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxSyncStarted']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatInboxSyncedPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatInboxSynced']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatJoinedConversationPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatJoinedConversation']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatKBFSToImpteamUpgradePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatKBFSToImpteamUpgrade']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatLeftConversationPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatLeftConversation']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatPaymentInfoPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatPaymentInfo']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatPromptUnfurlPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatPromptUnfurl']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatRequestInfoPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatRequestInfo']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatResetConversationPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatResetConversation']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatSetConvRetentionPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetConvRetention']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatSetConvSettingsPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetConvSettings']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatSetTeamRetentionPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSetTeamRetention']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatSubteamRenamePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatSubteamRename']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatTLFFinalizePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTLFFinalize']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatTLFResolvePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTLFResolve']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatThreadsStalePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatThreadsStale']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatChatTypingUpdatePayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.ChatTypingUpdate']['inParam'] & {
    sessionID: number
  }
}
type _Chat1NotifyChatNewChatActivityPayload = {
  readonly params: chat1Types.MessageTypes['chat.1.NotifyChat.NewChatActivity']['inParam'] & {
    sessionID: number
  }
}
type _ConnectedPayload = void
type _DisconnectedPayload = void
type _Keybase1GpgUiConfirmDuplicateKeyChosenPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmDuplicateKeyChosen']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmDuplicateKeyChosen']['outParam']
    ) => void
  }
}
type _Keybase1GpgUiConfirmImportSecretToExistingKeyPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmImportSecretToExistingKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gpgUi.confirmImportSecretToExistingKey']['outParam']
    ) => void
  }
}
type _Keybase1GpgUiGetTTYPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.getTTY']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.getTTY']['outParam']) => void
  }
}
type _Keybase1GpgUiSelectKeyAndPushOptionPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKeyAndPushOption']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKeyAndPushOption']['outParam']) => void
  }
}
type _Keybase1GpgUiSelectKeyPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKey']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.selectKey']['outParam']) => void
  }
}
type _Keybase1GpgUiSignPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.sign']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.sign']['outParam']) => void
  }
}
type _Keybase1GpgUiWantToAddGPGKeyPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gpgUi.wantToAddGPGKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gpgUi.wantToAddGPGKey']['outParam']) => void
  }
}
type _Keybase1GregorUIPushOutOfBandMessagesPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gregorUI.pushOutOfBandMessages']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.gregorUI.pushOutOfBandMessages']['outParam']
    ) => void
  }
}
type _Keybase1GregorUIPushStatePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.gregorUI.pushState']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.gregorUI.pushState']['outParam']) => void
  }
}
type _Keybase1HomeUIHomeUIRefreshPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.homeUI.homeUIRefresh']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.homeUI.homeUIRefresh']['outParam']) => void
  }
}
type _Keybase1Identify3UiIdentify3ResultPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Result']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3Result']['outParam']) => void
  }
}
type _Keybase1Identify3UiIdentify3ShowTrackerPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3ShowTracker']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3ShowTracker']['outParam']
    ) => void
  }
}
type _Keybase1Identify3UiIdentify3TrackerTimedOutPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3TrackerTimedOut']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3TrackerTimedOut']['outParam']
    ) => void
  }
}
type _Keybase1Identify3UiIdentify3UpdateRowPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateRow']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateRow']['outParam']
    ) => void
  }
}
type _Keybase1Identify3UiIdentify3UpdateUserCardPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateUserCard']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UpdateUserCard']['outParam']
    ) => void
  }
}
type _Keybase1Identify3UiIdentify3UserResetPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UserReset']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identify3Ui.identify3UserReset']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiCancelPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.cancel']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.cancel']['outParam']) => void
  }
}
type _Keybase1IdentifyUiConfirmPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.confirm']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.confirm']['outParam']) => void
  }
}
type _Keybase1IdentifyUiDelegateIdentifyUIPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.delegateIdentifyUI']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.delegateIdentifyUI']['outParam']) => void
  }
}
type _Keybase1IdentifyUiDismissPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.dismiss']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.dismiss']['outParam']) => void
  }
}
type _Keybase1IdentifyUiDisplayCryptocurrencyPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayCryptocurrency']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayCryptocurrency']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiDisplayKeyPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayKey']['outParam']) => void
  }
}
type _Keybase1IdentifyUiDisplayStellarAccountPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayStellarAccount']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayStellarAccount']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTLFCreateWithInvite']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTLFCreateWithInvite']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiDisplayTrackStatementPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTrackStatement']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayTrackStatement']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiDisplayUserCardPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.displayUserCard']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.displayUserCard']['outParam']) => void
  }
}
type _Keybase1IdentifyUiFinishPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finish']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.finish']['outParam']) => void
  }
}
type _Keybase1IdentifyUiFinishSocialProofCheckPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finishSocialProofCheck']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.finishSocialProofCheck']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiFinishWebProofCheckPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.finishWebProofCheck']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.finishWebProofCheck']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiLaunchNetworkChecksPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.launchNetworkChecks']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.identifyUi.launchNetworkChecks']['outParam']
    ) => void
  }
}
type _Keybase1IdentifyUiReportLastTrackPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.reportLastTrack']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.reportLastTrack']['outParam']) => void
  }
}
type _Keybase1IdentifyUiReportTrackTokenPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.reportTrackToken']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.reportTrackToken']['outParam']) => void
  }
}
type _Keybase1IdentifyUiStartPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.identifyUi.start']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.identifyUi.start']['outParam']) => void
  }
}
type _Keybase1LogUiLogPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.logUi.log']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logUi.log']['outParam']) => void
  }
}
type _Keybase1LoginUiDisplayPaperKeyPhrasePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayPaperKeyPhrase']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayPaperKeyPhrase']['outParam']) => void
  }
}
type _Keybase1LoginUiDisplayPrimaryPaperKeyPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayPrimaryPaperKey']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.displayPrimaryPaperKey']['outParam']
    ) => void
  }
}
type _Keybase1LoginUiDisplayResetProgressPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetProgress']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.displayResetProgress']['outParam']) => void
  }
}
type _Keybase1LoginUiExplainDeviceRecoveryPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['outParam']) => void
  }
}
type _Keybase1LoginUiGetEmailOrUsernamePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.getEmailOrUsername']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.getEmailOrUsername']['outParam']) => void
  }
}
type _Keybase1LoginUiPromptPassphraseRecoveryPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptPassphraseRecovery']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.loginUi.promptPassphraseRecovery']['outParam']
    ) => void
  }
}
type _Keybase1LoginUiPromptResetAccountPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.promptResetAccount']['outParam']) => void
  }
}
type _Keybase1LoginUiPromptRevokePaperKeysPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.loginUi.promptRevokePaperKeys']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.loginUi.promptRevokePaperKeys']['outParam']) => void
  }
}
type _Keybase1LogsendPrepareLogsendPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.logsend.prepareLogsend']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logsend.prepareLogsend']['outParam']) => void
  }
}
type _Keybase1NotifyAppExitPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyApp.exit']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyApp.exit']['outParam']) => void
  }
}
type _Keybase1NotifyAuditBoxAuditErrorPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyAudit.boxAuditError']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyAuditRootAuditErrorPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyAudit.rootAuditError']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyBadgesBadgeStatePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyBadges.badgeState']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyCanUserPerformCanUserPerformChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyCanUserPerform.canUserPerformChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyDeviceClone.deviceCloneCountChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyEmailAddressEmailAddressVerifiedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailAddressVerified']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailAddressVerified']['outParam']
    ) => void
  }
}
type _Keybase1NotifyEmailAddressEmailsChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailsChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyEmailAddress.emailsChanged']['outParam']
    ) => void
  }
}
type _Keybase1NotifyEphemeralNewTeamEkPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyEphemeral.newTeamEk']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyFSFSActivityPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSActivity']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyFSFSEditListResponsePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSEditListResponse']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSEditListResponse']['outParam']) => void
  }
}
type _Keybase1NotifyFSFSFavoritesChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSFavoritesChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSFavoritesChanged']['outParam']) => void
  }
}
type _Keybase1NotifyFSFSOnlineStatusChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOnlineStatusChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOnlineStatusChanged']['outParam']
    ) => void
  }
}
type _Keybase1NotifyFSFSOverallSyncStatusChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['outParam']
    ) => void
  }
}
type _Keybase1NotifyFSFSPathUpdatedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSPathUpdated']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyFSFSSyncActivityPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncActivity']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncActivity']['outParam']) => void
  }
}
type _Keybase1NotifyFSFSSyncStatusResponsePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncStatusResponse']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSSyncStatusResponse']['outParam']) => void
  }
}
type _Keybase1NotifyFavoritesFavoritesChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFavorites.favoritesChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyKeyfamilyKeyfamilyChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyKeyfamily.keyfamilyChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyKeyfamily.keyfamilyChanged']['outParam']
    ) => void
  }
}
type _Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['outParam']
    ) => void
  }
}
type _Keybase1NotifyPaperKeyPaperKeyCachedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPaperKey.paperKeyCached']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyPaperKey.paperKeyCached']['outParam']) => void
  }
}
type _Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPhoneNumber.phoneNumbersChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPhoneNumber.phoneNumbersChanged']['outParam']
    ) => void
  }
}
type _Keybase1NotifyServiceShutdownPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyService.shutdown']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyService.shutdown']['outParam']) => void
  }
}
type _Keybase1NotifySessionClientOutOfDatePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.clientOutOfDate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifySession.clientOutOfDate']['outParam']) => void
  }
}
type _Keybase1NotifySessionLoggedInPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedIn']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedIn']['outParam']) => void
  }
}
type _Keybase1NotifySessionLoggedOutPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifySession.loggedOut']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyTeamAvatarUpdatedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.avatarUpdated']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.avatarUpdated']['outParam']) => void
  }
}
type _Keybase1NotifyTeamNewlyAddedToTeamPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.newlyAddedToTeam']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.newlyAddedToTeam']['outParam']) => void
  }
}
type _Keybase1NotifyTeamTeamAbandonedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamAbandoned']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamAbandoned']['outParam']) => void
  }
}
type _Keybase1NotifyTeamTeamChangedByIDPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['outParam']) => void
  }
}
type _Keybase1NotifyTeamTeamChangedByNamePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByName']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByName']['outParam']) => void
  }
}
type _Keybase1NotifyTeamTeamDeletedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamDeleted']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamDeleted']['outParam']) => void
  }
}
type _Keybase1NotifyTeamTeamExitPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamExit']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamExit']['outParam']) => void
  }
}
type _Keybase1NotifyTrackingTrackingChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTracking.trackingChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUnverifiedTeamList.teamListUnverifiedChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1NotifyUsersPasswordChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.passwordChanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyUsers.passwordChanged']['outParam']) => void
  }
}
type _Keybase1NotifyUsersUserChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyUsers.userChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1PgpUiFinishedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.finished']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.finished']['outParam']) => void
  }
}
type _Keybase1PgpUiKeyGeneratedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.keyGenerated']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.keyGenerated']['outParam']) => void
  }
}
type _Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccessNonKeybase']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccessNonKeybase']['outParam']
    ) => void
  }
}
type _Keybase1PgpUiOutputSignatureSuccessPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.outputSignatureSuccess']['outParam']) => void
  }
}
type _Keybase1PgpUiShouldPushPrivatePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.pgpUi.shouldPushPrivate']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.pgpUi.shouldPushPrivate']['outParam']) => void
  }
}
type _Keybase1ProveUiCheckingPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.checking']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.checking']['outParam']) => void
  }
}
type _Keybase1ProveUiContinueCheckingPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.continueChecking']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.continueChecking']['outParam']) => void
  }
}
type _Keybase1ProveUiDisplayRecheckWarningPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.displayRecheckWarning']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.displayRecheckWarning']['outParam']) => void
  }
}
type _Keybase1ProveUiOkToCheckPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.okToCheck']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.okToCheck']['outParam']) => void
  }
}
type _Keybase1ProveUiOutputInstructionsPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.outputInstructions']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.outputInstructions']['outParam']) => void
  }
}
type _Keybase1ProveUiOutputPrechecksPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.outputPrechecks']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.outputPrechecks']['outParam']) => void
  }
}
type _Keybase1ProveUiPreProofWarningPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.preProofWarning']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.preProofWarning']['outParam']) => void
  }
}
type _Keybase1ProveUiPromptOverwritePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.promptOverwrite']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.promptOverwrite']['outParam']) => void
  }
}
type _Keybase1ProveUiPromptUsernamePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.proveUi.promptUsername']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.proveUi.promptUsername']['outParam']) => void
  }
}
type _Keybase1ProvisionUiChooseDevicePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDevice']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDevice']['outParam']) => void
  }
}
type _Keybase1ProvisionUiChooseDeviceTypePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDeviceType']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseDeviceType']['outParam']) => void
  }
}
type _Keybase1ProvisionUiChooseGPGMethodPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseGPGMethod']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseGPGMethod']['outParam']) => void
  }
}
type _Keybase1ProvisionUiChooseProvisioningMethodPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseProvisioningMethod']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.chooseProvisioningMethod']['outParam']
    ) => void
  }
}
type _Keybase1ProvisionUiDisplayAndPromptSecretPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplayAndPromptSecret']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplayAndPromptSecret']['outParam']
    ) => void
  }
}
type _Keybase1ProvisionUiDisplaySecretExchangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplaySecretExchanged']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.DisplaySecretExchanged']['outParam']
    ) => void
  }
}
type _Keybase1ProvisionUiPromptNewDeviceNamePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.PromptNewDeviceName']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.PromptNewDeviceName']['outParam']
    ) => void
  }
}
type _Keybase1ProvisionUiProvisioneeSuccessPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisioneeSuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisioneeSuccess']['outParam']
    ) => void
  }
}
type _Keybase1ProvisionUiProvisionerSuccessPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisionerSuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.provisionUi.ProvisionerSuccess']['outParam']
    ) => void
  }
}
type _Keybase1ProvisionUiSwitchToGPGSignOKPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.provisionUi.switchToGPGSignOK']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.provisionUi.switchToGPGSignOK']['outParam']) => void
  }
}
type _Keybase1ReachabilityReachabilityChangedPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.reachability.reachabilityChanged']['inParam'] & {
    sessionID: number
  }
}
type _Keybase1RekeyUIDelegateRekeyUIPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.delegateRekeyUI']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.delegateRekeyUI']['outParam']) => void
  }
}
type _Keybase1RekeyUIRefreshPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.refresh']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.refresh']['outParam']) => void
  }
}
type _Keybase1RekeyUIRekeySendEventPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.rekeyUI.rekeySendEvent']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.rekeyUI.rekeySendEvent']['outParam']) => void
  }
}
type _Keybase1SaltpackUiSaltpackPromptForDecryptPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackPromptForDecrypt']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackPromptForDecrypt']['outParam']
    ) => void
  }
}
type _Keybase1SaltpackUiSaltpackVerifyBadSenderPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifyBadSender']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifyBadSender']['outParam']
    ) => void
  }
}
type _Keybase1SaltpackUiSaltpackVerifySuccessPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifySuccess']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.saltpackUi.saltpackVerifySuccess']['outParam']
    ) => void
  }
}
type _Keybase1SecretUiGetPassphrasePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['outParam']) => void
  }
}
type _Keybase1StreamUiClosePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.close']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.close']['outParam']) => void
  }
}
type _Keybase1StreamUiReadPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.read']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.read']['outParam']) => void
  }
}
type _Keybase1StreamUiResetPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.reset']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.reset']['outParam']) => void
  }
}
type _Keybase1StreamUiWritePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.streamUi.write']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.streamUi.write']['outParam']) => void
  }
}
type _Keybase1TeamsUiConfirmRootTeamDeletePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmRootTeamDelete']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmRootTeamDelete']['outParam']) => void
  }
}
type _Keybase1TeamsUiConfirmSubteamDeletePayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmSubteamDelete']['inParam'] & {
    sessionID: number
  }
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.teamsUi.confirmSubteamDelete']['outParam']) => void
  }
}
type _Keybase1UiPromptYesNoPayload = {
  readonly params: keybase1Types.MessageTypes['keybase.1.ui.promptYesNo']['inParam'] & {sessionID: number}
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.ui.promptYesNo']['outParam']) => void
  }
}
type _Stellar1NotifyAccountDetailsUpdatePayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.accountDetailsUpdate']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1NotifyAccountsUpdatePayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.accountsUpdate']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1NotifyPaymentNotificationPayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.paymentNotification']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1NotifyPaymentStatusNotificationPayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.paymentStatusNotification']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1NotifyPendingPaymentsUpdatePayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.pendingPaymentsUpdate']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1NotifyRecentPaymentsUpdatePayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.recentPaymentsUpdate']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1NotifyRequestStatusNotificationPayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.notify.requestStatusNotification']['inParam'] & {
    sessionID: number
  }
}
type _Stellar1UiPaymentReviewedPayload = {
  readonly params: stellar1Types.MessageTypes['stellar.1.ui.paymentReviewed']['inParam'] & {sessionID: number}
  response: {
    error: stellar1Types.IncomingErrorCallback
    result: (param: stellar1Types.MessageTypes['stellar.1.ui.paymentReviewed']['outParam']) => void
  }
}

// Action Creators
export const createChat1ChatUiChatAttachmentDownloadDone = (
  payload: _Chat1ChatUiChatAttachmentDownloadDonePayload
): Chat1ChatUiChatAttachmentDownloadDonePayload => ({payload, type: chat1ChatUiChatAttachmentDownloadDone})
export const createChat1ChatUiChatAttachmentDownloadProgress = (
  payload: _Chat1ChatUiChatAttachmentDownloadProgressPayload
): Chat1ChatUiChatAttachmentDownloadProgressPayload => ({
  payload,
  type: chat1ChatUiChatAttachmentDownloadProgress,
})
export const createChat1ChatUiChatAttachmentDownloadStart = (
  payload: _Chat1ChatUiChatAttachmentDownloadStartPayload
): Chat1ChatUiChatAttachmentDownloadStartPayload => ({payload, type: chat1ChatUiChatAttachmentDownloadStart})
export const createChat1ChatUiChatCoinFlipStatus = (
  payload: _Chat1ChatUiChatCoinFlipStatusPayload
): Chat1ChatUiChatCoinFlipStatusPayload => ({payload, type: chat1ChatUiChatCoinFlipStatus})
export const createChat1ChatUiChatCommandMarkdown = (
  payload: _Chat1ChatUiChatCommandMarkdownPayload
): Chat1ChatUiChatCommandMarkdownPayload => ({payload, type: chat1ChatUiChatCommandMarkdown})
export const createChat1ChatUiChatConfirmChannelDelete = (
  payload: _Chat1ChatUiChatConfirmChannelDeletePayload
): Chat1ChatUiChatConfirmChannelDeletePayload => ({payload, type: chat1ChatUiChatConfirmChannelDelete})
export const createChat1ChatUiChatGiphySearchResults = (
  payload: _Chat1ChatUiChatGiphySearchResultsPayload
): Chat1ChatUiChatGiphySearchResultsPayload => ({payload, type: chat1ChatUiChatGiphySearchResults})
export const createChat1ChatUiChatGiphyToggleResultWindow = (
  payload: _Chat1ChatUiChatGiphyToggleResultWindowPayload
): Chat1ChatUiChatGiphyToggleResultWindowPayload => ({payload, type: chat1ChatUiChatGiphyToggleResultWindow})
export const createChat1ChatUiChatInboxConversation = (
  payload: _Chat1ChatUiChatInboxConversationPayload
): Chat1ChatUiChatInboxConversationPayload => ({payload, type: chat1ChatUiChatInboxConversation})
export const createChat1ChatUiChatInboxFailed = (
  payload: _Chat1ChatUiChatInboxFailedPayload
): Chat1ChatUiChatInboxFailedPayload => ({payload, type: chat1ChatUiChatInboxFailed})
export const createChat1ChatUiChatInboxUnverified = (
  payload: _Chat1ChatUiChatInboxUnverifiedPayload
): Chat1ChatUiChatInboxUnverifiedPayload => ({payload, type: chat1ChatUiChatInboxUnverified})
export const createChat1ChatUiChatLoadGalleryHit = (
  payload: _Chat1ChatUiChatLoadGalleryHitPayload
): Chat1ChatUiChatLoadGalleryHitPayload => ({payload, type: chat1ChatUiChatLoadGalleryHit})
export const createChat1ChatUiChatMaybeMentionUpdate = (
  payload: _Chat1ChatUiChatMaybeMentionUpdatePayload
): Chat1ChatUiChatMaybeMentionUpdatePayload => ({payload, type: chat1ChatUiChatMaybeMentionUpdate})
export const createChat1ChatUiChatSearchConvHits = (
  payload: _Chat1ChatUiChatSearchConvHitsPayload
): Chat1ChatUiChatSearchConvHitsPayload => ({payload, type: chat1ChatUiChatSearchConvHits})
export const createChat1ChatUiChatSearchDone = (
  payload: _Chat1ChatUiChatSearchDonePayload
): Chat1ChatUiChatSearchDonePayload => ({payload, type: chat1ChatUiChatSearchDone})
export const createChat1ChatUiChatSearchHit = (
  payload: _Chat1ChatUiChatSearchHitPayload
): Chat1ChatUiChatSearchHitPayload => ({payload, type: chat1ChatUiChatSearchHit})
export const createChat1ChatUiChatSearchInboxDone = (
  payload: _Chat1ChatUiChatSearchInboxDonePayload
): Chat1ChatUiChatSearchInboxDonePayload => ({payload, type: chat1ChatUiChatSearchInboxDone})
export const createChat1ChatUiChatSearchInboxHit = (
  payload: _Chat1ChatUiChatSearchInboxHitPayload
): Chat1ChatUiChatSearchInboxHitPayload => ({payload, type: chat1ChatUiChatSearchInboxHit})
export const createChat1ChatUiChatSearchInboxStart = (
  payload: _Chat1ChatUiChatSearchInboxStartPayload
): Chat1ChatUiChatSearchInboxStartPayload => ({payload, type: chat1ChatUiChatSearchInboxStart})
export const createChat1ChatUiChatSearchIndexStatus = (
  payload: _Chat1ChatUiChatSearchIndexStatusPayload
): Chat1ChatUiChatSearchIndexStatusPayload => ({payload, type: chat1ChatUiChatSearchIndexStatus})
export const createChat1ChatUiChatShowManageChannels = (
  payload: _Chat1ChatUiChatShowManageChannelsPayload
): Chat1ChatUiChatShowManageChannelsPayload => ({payload, type: chat1ChatUiChatShowManageChannels})
export const createChat1ChatUiChatStellarDataConfirm = (
  payload: _Chat1ChatUiChatStellarDataConfirmPayload
): Chat1ChatUiChatStellarDataConfirmPayload => ({payload, type: chat1ChatUiChatStellarDataConfirm})
export const createChat1ChatUiChatStellarDataError = (
  payload: _Chat1ChatUiChatStellarDataErrorPayload
): Chat1ChatUiChatStellarDataErrorPayload => ({payload, type: chat1ChatUiChatStellarDataError})
export const createChat1ChatUiChatStellarDone = (
  payload: _Chat1ChatUiChatStellarDonePayload
): Chat1ChatUiChatStellarDonePayload => ({payload, type: chat1ChatUiChatStellarDone})
export const createChat1ChatUiChatStellarShowConfirm = (
  payload: _Chat1ChatUiChatStellarShowConfirmPayload
): Chat1ChatUiChatStellarShowConfirmPayload => ({payload, type: chat1ChatUiChatStellarShowConfirm})
export const createChat1ChatUiChatThreadCached = (
  payload: _Chat1ChatUiChatThreadCachedPayload
): Chat1ChatUiChatThreadCachedPayload => ({payload, type: chat1ChatUiChatThreadCached})
export const createChat1ChatUiChatThreadFull = (
  payload: _Chat1ChatUiChatThreadFullPayload
): Chat1ChatUiChatThreadFullPayload => ({payload, type: chat1ChatUiChatThreadFull})
export const createChat1NotifyChatChatAttachmentUploadProgress = (
  payload: _Chat1NotifyChatChatAttachmentUploadProgressPayload
): Chat1NotifyChatChatAttachmentUploadProgressPayload => ({
  payload,
  type: chat1NotifyChatChatAttachmentUploadProgress,
})
export const createChat1NotifyChatChatAttachmentUploadStart = (
  payload: _Chat1NotifyChatChatAttachmentUploadStartPayload
): Chat1NotifyChatChatAttachmentUploadStartPayload => ({
  payload,
  type: chat1NotifyChatChatAttachmentUploadStart,
})
export const createChat1NotifyChatChatIdentifyUpdate = (
  payload: _Chat1NotifyChatChatIdentifyUpdatePayload
): Chat1NotifyChatChatIdentifyUpdatePayload => ({payload, type: chat1NotifyChatChatIdentifyUpdate})
export const createChat1NotifyChatChatInboxStale = (
  payload: _Chat1NotifyChatChatInboxStalePayload
): Chat1NotifyChatChatInboxStalePayload => ({payload, type: chat1NotifyChatChatInboxStale})
export const createChat1NotifyChatChatInboxSyncStarted = (
  payload: _Chat1NotifyChatChatInboxSyncStartedPayload
): Chat1NotifyChatChatInboxSyncStartedPayload => ({payload, type: chat1NotifyChatChatInboxSyncStarted})
export const createChat1NotifyChatChatInboxSynced = (
  payload: _Chat1NotifyChatChatInboxSyncedPayload
): Chat1NotifyChatChatInboxSyncedPayload => ({payload, type: chat1NotifyChatChatInboxSynced})
export const createChat1NotifyChatChatJoinedConversation = (
  payload: _Chat1NotifyChatChatJoinedConversationPayload
): Chat1NotifyChatChatJoinedConversationPayload => ({payload, type: chat1NotifyChatChatJoinedConversation})
export const createChat1NotifyChatChatKBFSToImpteamUpgrade = (
  payload: _Chat1NotifyChatChatKBFSToImpteamUpgradePayload
): Chat1NotifyChatChatKBFSToImpteamUpgradePayload => ({
  payload,
  type: chat1NotifyChatChatKBFSToImpteamUpgrade,
})
export const createChat1NotifyChatChatLeftConversation = (
  payload: _Chat1NotifyChatChatLeftConversationPayload
): Chat1NotifyChatChatLeftConversationPayload => ({payload, type: chat1NotifyChatChatLeftConversation})
export const createChat1NotifyChatChatPaymentInfo = (
  payload: _Chat1NotifyChatChatPaymentInfoPayload
): Chat1NotifyChatChatPaymentInfoPayload => ({payload, type: chat1NotifyChatChatPaymentInfo})
export const createChat1NotifyChatChatPromptUnfurl = (
  payload: _Chat1NotifyChatChatPromptUnfurlPayload
): Chat1NotifyChatChatPromptUnfurlPayload => ({payload, type: chat1NotifyChatChatPromptUnfurl})
export const createChat1NotifyChatChatRequestInfo = (
  payload: _Chat1NotifyChatChatRequestInfoPayload
): Chat1NotifyChatChatRequestInfoPayload => ({payload, type: chat1NotifyChatChatRequestInfo})
export const createChat1NotifyChatChatResetConversation = (
  payload: _Chat1NotifyChatChatResetConversationPayload
): Chat1NotifyChatChatResetConversationPayload => ({payload, type: chat1NotifyChatChatResetConversation})
export const createChat1NotifyChatChatSetConvRetention = (
  payload: _Chat1NotifyChatChatSetConvRetentionPayload
): Chat1NotifyChatChatSetConvRetentionPayload => ({payload, type: chat1NotifyChatChatSetConvRetention})
export const createChat1NotifyChatChatSetConvSettings = (
  payload: _Chat1NotifyChatChatSetConvSettingsPayload
): Chat1NotifyChatChatSetConvSettingsPayload => ({payload, type: chat1NotifyChatChatSetConvSettings})
export const createChat1NotifyChatChatSetTeamRetention = (
  payload: _Chat1NotifyChatChatSetTeamRetentionPayload
): Chat1NotifyChatChatSetTeamRetentionPayload => ({payload, type: chat1NotifyChatChatSetTeamRetention})
export const createChat1NotifyChatChatSubteamRename = (
  payload: _Chat1NotifyChatChatSubteamRenamePayload
): Chat1NotifyChatChatSubteamRenamePayload => ({payload, type: chat1NotifyChatChatSubteamRename})
export const createChat1NotifyChatChatTLFFinalize = (
  payload: _Chat1NotifyChatChatTLFFinalizePayload
): Chat1NotifyChatChatTLFFinalizePayload => ({payload, type: chat1NotifyChatChatTLFFinalize})
export const createChat1NotifyChatChatTLFResolve = (
  payload: _Chat1NotifyChatChatTLFResolvePayload
): Chat1NotifyChatChatTLFResolvePayload => ({payload, type: chat1NotifyChatChatTLFResolve})
export const createChat1NotifyChatChatThreadsStale = (
  payload: _Chat1NotifyChatChatThreadsStalePayload
): Chat1NotifyChatChatThreadsStalePayload => ({payload, type: chat1NotifyChatChatThreadsStale})
export const createChat1NotifyChatChatTypingUpdate = (
  payload: _Chat1NotifyChatChatTypingUpdatePayload
): Chat1NotifyChatChatTypingUpdatePayload => ({payload, type: chat1NotifyChatChatTypingUpdate})
export const createChat1NotifyChatNewChatActivity = (
  payload: _Chat1NotifyChatNewChatActivityPayload
): Chat1NotifyChatNewChatActivityPayload => ({payload, type: chat1NotifyChatNewChatActivity})
export const createConnected = (payload: _ConnectedPayload): ConnectedPayload => ({payload, type: connected})
export const createDisconnected = (payload: _DisconnectedPayload): DisconnectedPayload => ({
  payload,
  type: disconnected,
})
export const createKeybase1GpgUiConfirmDuplicateKeyChosen = (
  payload: _Keybase1GpgUiConfirmDuplicateKeyChosenPayload
): Keybase1GpgUiConfirmDuplicateKeyChosenPayload => ({payload, type: keybase1GpgUiConfirmDuplicateKeyChosen})
export const createKeybase1GpgUiConfirmImportSecretToExistingKey = (
  payload: _Keybase1GpgUiConfirmImportSecretToExistingKeyPayload
): Keybase1GpgUiConfirmImportSecretToExistingKeyPayload => ({
  payload,
  type: keybase1GpgUiConfirmImportSecretToExistingKey,
})
export const createKeybase1GpgUiGetTTY = (
  payload: _Keybase1GpgUiGetTTYPayload
): Keybase1GpgUiGetTTYPayload => ({payload, type: keybase1GpgUiGetTTY})
export const createKeybase1GpgUiSelectKey = (
  payload: _Keybase1GpgUiSelectKeyPayload
): Keybase1GpgUiSelectKeyPayload => ({payload, type: keybase1GpgUiSelectKey})
export const createKeybase1GpgUiSelectKeyAndPushOption = (
  payload: _Keybase1GpgUiSelectKeyAndPushOptionPayload
): Keybase1GpgUiSelectKeyAndPushOptionPayload => ({payload, type: keybase1GpgUiSelectKeyAndPushOption})
export const createKeybase1GpgUiSign = (payload: _Keybase1GpgUiSignPayload): Keybase1GpgUiSignPayload => ({
  payload,
  type: keybase1GpgUiSign,
})
export const createKeybase1GpgUiWantToAddGPGKey = (
  payload: _Keybase1GpgUiWantToAddGPGKeyPayload
): Keybase1GpgUiWantToAddGPGKeyPayload => ({payload, type: keybase1GpgUiWantToAddGPGKey})
export const createKeybase1GregorUIPushOutOfBandMessages = (
  payload: _Keybase1GregorUIPushOutOfBandMessagesPayload
): Keybase1GregorUIPushOutOfBandMessagesPayload => ({payload, type: keybase1GregorUIPushOutOfBandMessages})
export const createKeybase1GregorUIPushState = (
  payload: _Keybase1GregorUIPushStatePayload
): Keybase1GregorUIPushStatePayload => ({payload, type: keybase1GregorUIPushState})
export const createKeybase1HomeUIHomeUIRefresh = (
  payload: _Keybase1HomeUIHomeUIRefreshPayload
): Keybase1HomeUIHomeUIRefreshPayload => ({payload, type: keybase1HomeUIHomeUIRefresh})
export const createKeybase1Identify3UiIdentify3Result = (
  payload: _Keybase1Identify3UiIdentify3ResultPayload
): Keybase1Identify3UiIdentify3ResultPayload => ({payload, type: keybase1Identify3UiIdentify3Result})
export const createKeybase1Identify3UiIdentify3ShowTracker = (
  payload: _Keybase1Identify3UiIdentify3ShowTrackerPayload
): Keybase1Identify3UiIdentify3ShowTrackerPayload => ({
  payload,
  type: keybase1Identify3UiIdentify3ShowTracker,
})
export const createKeybase1Identify3UiIdentify3TrackerTimedOut = (
  payload: _Keybase1Identify3UiIdentify3TrackerTimedOutPayload
): Keybase1Identify3UiIdentify3TrackerTimedOutPayload => ({
  payload,
  type: keybase1Identify3UiIdentify3TrackerTimedOut,
})
export const createKeybase1Identify3UiIdentify3UpdateRow = (
  payload: _Keybase1Identify3UiIdentify3UpdateRowPayload
): Keybase1Identify3UiIdentify3UpdateRowPayload => ({payload, type: keybase1Identify3UiIdentify3UpdateRow})
export const createKeybase1Identify3UiIdentify3UpdateUserCard = (
  payload: _Keybase1Identify3UiIdentify3UpdateUserCardPayload
): Keybase1Identify3UiIdentify3UpdateUserCardPayload => ({
  payload,
  type: keybase1Identify3UiIdentify3UpdateUserCard,
})
export const createKeybase1Identify3UiIdentify3UserReset = (
  payload: _Keybase1Identify3UiIdentify3UserResetPayload
): Keybase1Identify3UiIdentify3UserResetPayload => ({payload, type: keybase1Identify3UiIdentify3UserReset})
export const createKeybase1IdentifyUiCancel = (
  payload: _Keybase1IdentifyUiCancelPayload
): Keybase1IdentifyUiCancelPayload => ({payload, type: keybase1IdentifyUiCancel})
export const createKeybase1IdentifyUiConfirm = (
  payload: _Keybase1IdentifyUiConfirmPayload
): Keybase1IdentifyUiConfirmPayload => ({payload, type: keybase1IdentifyUiConfirm})
export const createKeybase1IdentifyUiDelegateIdentifyUI = (
  payload: _Keybase1IdentifyUiDelegateIdentifyUIPayload
): Keybase1IdentifyUiDelegateIdentifyUIPayload => ({payload, type: keybase1IdentifyUiDelegateIdentifyUI})
export const createKeybase1IdentifyUiDismiss = (
  payload: _Keybase1IdentifyUiDismissPayload
): Keybase1IdentifyUiDismissPayload => ({payload, type: keybase1IdentifyUiDismiss})
export const createKeybase1IdentifyUiDisplayCryptocurrency = (
  payload: _Keybase1IdentifyUiDisplayCryptocurrencyPayload
): Keybase1IdentifyUiDisplayCryptocurrencyPayload => ({
  payload,
  type: keybase1IdentifyUiDisplayCryptocurrency,
})
export const createKeybase1IdentifyUiDisplayKey = (
  payload: _Keybase1IdentifyUiDisplayKeyPayload
): Keybase1IdentifyUiDisplayKeyPayload => ({payload, type: keybase1IdentifyUiDisplayKey})
export const createKeybase1IdentifyUiDisplayStellarAccount = (
  payload: _Keybase1IdentifyUiDisplayStellarAccountPayload
): Keybase1IdentifyUiDisplayStellarAccountPayload => ({
  payload,
  type: keybase1IdentifyUiDisplayStellarAccount,
})
export const createKeybase1IdentifyUiDisplayTLFCreateWithInvite = (
  payload: _Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload
): Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload => ({
  payload,
  type: keybase1IdentifyUiDisplayTLFCreateWithInvite,
})
export const createKeybase1IdentifyUiDisplayTrackStatement = (
  payload: _Keybase1IdentifyUiDisplayTrackStatementPayload
): Keybase1IdentifyUiDisplayTrackStatementPayload => ({
  payload,
  type: keybase1IdentifyUiDisplayTrackStatement,
})
export const createKeybase1IdentifyUiDisplayUserCard = (
  payload: _Keybase1IdentifyUiDisplayUserCardPayload
): Keybase1IdentifyUiDisplayUserCardPayload => ({payload, type: keybase1IdentifyUiDisplayUserCard})
export const createKeybase1IdentifyUiFinish = (
  payload: _Keybase1IdentifyUiFinishPayload
): Keybase1IdentifyUiFinishPayload => ({payload, type: keybase1IdentifyUiFinish})
export const createKeybase1IdentifyUiFinishSocialProofCheck = (
  payload: _Keybase1IdentifyUiFinishSocialProofCheckPayload
): Keybase1IdentifyUiFinishSocialProofCheckPayload => ({
  payload,
  type: keybase1IdentifyUiFinishSocialProofCheck,
})
export const createKeybase1IdentifyUiFinishWebProofCheck = (
  payload: _Keybase1IdentifyUiFinishWebProofCheckPayload
): Keybase1IdentifyUiFinishWebProofCheckPayload => ({payload, type: keybase1IdentifyUiFinishWebProofCheck})
export const createKeybase1IdentifyUiLaunchNetworkChecks = (
  payload: _Keybase1IdentifyUiLaunchNetworkChecksPayload
): Keybase1IdentifyUiLaunchNetworkChecksPayload => ({payload, type: keybase1IdentifyUiLaunchNetworkChecks})
export const createKeybase1IdentifyUiReportLastTrack = (
  payload: _Keybase1IdentifyUiReportLastTrackPayload
): Keybase1IdentifyUiReportLastTrackPayload => ({payload, type: keybase1IdentifyUiReportLastTrack})
export const createKeybase1IdentifyUiReportTrackToken = (
  payload: _Keybase1IdentifyUiReportTrackTokenPayload
): Keybase1IdentifyUiReportTrackTokenPayload => ({payload, type: keybase1IdentifyUiReportTrackToken})
export const createKeybase1IdentifyUiStart = (
  payload: _Keybase1IdentifyUiStartPayload
): Keybase1IdentifyUiStartPayload => ({payload, type: keybase1IdentifyUiStart})
export const createKeybase1LogUiLog = (payload: _Keybase1LogUiLogPayload): Keybase1LogUiLogPayload => ({
  payload,
  type: keybase1LogUiLog,
})
export const createKeybase1LoginUiDisplayPaperKeyPhrase = (
  payload: _Keybase1LoginUiDisplayPaperKeyPhrasePayload
): Keybase1LoginUiDisplayPaperKeyPhrasePayload => ({payload, type: keybase1LoginUiDisplayPaperKeyPhrase})
export const createKeybase1LoginUiDisplayPrimaryPaperKey = (
  payload: _Keybase1LoginUiDisplayPrimaryPaperKeyPayload
): Keybase1LoginUiDisplayPrimaryPaperKeyPayload => ({payload, type: keybase1LoginUiDisplayPrimaryPaperKey})
export const createKeybase1LoginUiDisplayResetProgress = (
  payload: _Keybase1LoginUiDisplayResetProgressPayload
): Keybase1LoginUiDisplayResetProgressPayload => ({payload, type: keybase1LoginUiDisplayResetProgress})
export const createKeybase1LoginUiExplainDeviceRecovery = (
  payload: _Keybase1LoginUiExplainDeviceRecoveryPayload
): Keybase1LoginUiExplainDeviceRecoveryPayload => ({payload, type: keybase1LoginUiExplainDeviceRecovery})
export const createKeybase1LoginUiGetEmailOrUsername = (
  payload: _Keybase1LoginUiGetEmailOrUsernamePayload
): Keybase1LoginUiGetEmailOrUsernamePayload => ({payload, type: keybase1LoginUiGetEmailOrUsername})
export const createKeybase1LoginUiPromptPassphraseRecovery = (
  payload: _Keybase1LoginUiPromptPassphraseRecoveryPayload
): Keybase1LoginUiPromptPassphraseRecoveryPayload => ({
  payload,
  type: keybase1LoginUiPromptPassphraseRecovery,
})
export const createKeybase1LoginUiPromptResetAccount = (
  payload: _Keybase1LoginUiPromptResetAccountPayload
): Keybase1LoginUiPromptResetAccountPayload => ({payload, type: keybase1LoginUiPromptResetAccount})
export const createKeybase1LoginUiPromptRevokePaperKeys = (
  payload: _Keybase1LoginUiPromptRevokePaperKeysPayload
): Keybase1LoginUiPromptRevokePaperKeysPayload => ({payload, type: keybase1LoginUiPromptRevokePaperKeys})
export const createKeybase1LogsendPrepareLogsend = (
  payload: _Keybase1LogsendPrepareLogsendPayload
): Keybase1LogsendPrepareLogsendPayload => ({payload, type: keybase1LogsendPrepareLogsend})
export const createKeybase1NotifyAppExit = (
  payload: _Keybase1NotifyAppExitPayload
): Keybase1NotifyAppExitPayload => ({payload, type: keybase1NotifyAppExit})
export const createKeybase1NotifyAuditBoxAuditError = (
  payload: _Keybase1NotifyAuditBoxAuditErrorPayload
): Keybase1NotifyAuditBoxAuditErrorPayload => ({payload, type: keybase1NotifyAuditBoxAuditError})
export const createKeybase1NotifyAuditRootAuditError = (
  payload: _Keybase1NotifyAuditRootAuditErrorPayload
): Keybase1NotifyAuditRootAuditErrorPayload => ({payload, type: keybase1NotifyAuditRootAuditError})
export const createKeybase1NotifyBadgesBadgeState = (
  payload: _Keybase1NotifyBadgesBadgeStatePayload
): Keybase1NotifyBadgesBadgeStatePayload => ({payload, type: keybase1NotifyBadgesBadgeState})
export const createKeybase1NotifyCanUserPerformCanUserPerformChanged = (
  payload: _Keybase1NotifyCanUserPerformCanUserPerformChangedPayload
): Keybase1NotifyCanUserPerformCanUserPerformChangedPayload => ({
  payload,
  type: keybase1NotifyCanUserPerformCanUserPerformChanged,
})
export const createKeybase1NotifyDeviceCloneDeviceCloneCountChanged = (
  payload: _Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload
): Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload => ({
  payload,
  type: keybase1NotifyDeviceCloneDeviceCloneCountChanged,
})
export const createKeybase1NotifyEmailAddressEmailAddressVerified = (
  payload: _Keybase1NotifyEmailAddressEmailAddressVerifiedPayload
): Keybase1NotifyEmailAddressEmailAddressVerifiedPayload => ({
  payload,
  type: keybase1NotifyEmailAddressEmailAddressVerified,
})
export const createKeybase1NotifyEmailAddressEmailsChanged = (
  payload: _Keybase1NotifyEmailAddressEmailsChangedPayload
): Keybase1NotifyEmailAddressEmailsChangedPayload => ({
  payload,
  type: keybase1NotifyEmailAddressEmailsChanged,
})
export const createKeybase1NotifyEphemeralNewTeamEk = (
  payload: _Keybase1NotifyEphemeralNewTeamEkPayload
): Keybase1NotifyEphemeralNewTeamEkPayload => ({payload, type: keybase1NotifyEphemeralNewTeamEk})
export const createKeybase1NotifyFSFSActivity = (
  payload: _Keybase1NotifyFSFSActivityPayload
): Keybase1NotifyFSFSActivityPayload => ({payload, type: keybase1NotifyFSFSActivity})
export const createKeybase1NotifyFSFSEditListResponse = (
  payload: _Keybase1NotifyFSFSEditListResponsePayload
): Keybase1NotifyFSFSEditListResponsePayload => ({payload, type: keybase1NotifyFSFSEditListResponse})
export const createKeybase1NotifyFSFSFavoritesChanged = (
  payload: _Keybase1NotifyFSFSFavoritesChangedPayload
): Keybase1NotifyFSFSFavoritesChangedPayload => ({payload, type: keybase1NotifyFSFSFavoritesChanged})
export const createKeybase1NotifyFSFSOnlineStatusChanged = (
  payload: _Keybase1NotifyFSFSOnlineStatusChangedPayload
): Keybase1NotifyFSFSOnlineStatusChangedPayload => ({payload, type: keybase1NotifyFSFSOnlineStatusChanged})
export const createKeybase1NotifyFSFSOverallSyncStatusChanged = (
  payload: _Keybase1NotifyFSFSOverallSyncStatusChangedPayload
): Keybase1NotifyFSFSOverallSyncStatusChangedPayload => ({
  payload,
  type: keybase1NotifyFSFSOverallSyncStatusChanged,
})
export const createKeybase1NotifyFSFSPathUpdated = (
  payload: _Keybase1NotifyFSFSPathUpdatedPayload
): Keybase1NotifyFSFSPathUpdatedPayload => ({payload, type: keybase1NotifyFSFSPathUpdated})
export const createKeybase1NotifyFSFSSyncActivity = (
  payload: _Keybase1NotifyFSFSSyncActivityPayload
): Keybase1NotifyFSFSSyncActivityPayload => ({payload, type: keybase1NotifyFSFSSyncActivity})
export const createKeybase1NotifyFSFSSyncStatusResponse = (
  payload: _Keybase1NotifyFSFSSyncStatusResponsePayload
): Keybase1NotifyFSFSSyncStatusResponsePayload => ({payload, type: keybase1NotifyFSFSSyncStatusResponse})
export const createKeybase1NotifyFavoritesFavoritesChanged = (
  payload: _Keybase1NotifyFavoritesFavoritesChangedPayload
): Keybase1NotifyFavoritesFavoritesChangedPayload => ({
  payload,
  type: keybase1NotifyFavoritesFavoritesChanged,
})
export const createKeybase1NotifyKeyfamilyKeyfamilyChanged = (
  payload: _Keybase1NotifyKeyfamilyKeyfamilyChangedPayload
): Keybase1NotifyKeyfamilyKeyfamilyChangedPayload => ({
  payload,
  type: keybase1NotifyKeyfamilyKeyfamilyChanged,
})
export const createKeybase1NotifyPGPPgpKeyInSecretStoreFile = (
  payload: _Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload
): Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload => ({
  payload,
  type: keybase1NotifyPGPPgpKeyInSecretStoreFile,
})
export const createKeybase1NotifyPaperKeyPaperKeyCached = (
  payload: _Keybase1NotifyPaperKeyPaperKeyCachedPayload
): Keybase1NotifyPaperKeyPaperKeyCachedPayload => ({payload, type: keybase1NotifyPaperKeyPaperKeyCached})
export const createKeybase1NotifyPhoneNumberPhoneNumbersChanged = (
  payload: _Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload
): Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload => ({
  payload,
  type: keybase1NotifyPhoneNumberPhoneNumbersChanged,
})
export const createKeybase1NotifyServiceShutdown = (
  payload: _Keybase1NotifyServiceShutdownPayload
): Keybase1NotifyServiceShutdownPayload => ({payload, type: keybase1NotifyServiceShutdown})
export const createKeybase1NotifySessionClientOutOfDate = (
  payload: _Keybase1NotifySessionClientOutOfDatePayload
): Keybase1NotifySessionClientOutOfDatePayload => ({payload, type: keybase1NotifySessionClientOutOfDate})
export const createKeybase1NotifySessionLoggedIn = (
  payload: _Keybase1NotifySessionLoggedInPayload
): Keybase1NotifySessionLoggedInPayload => ({payload, type: keybase1NotifySessionLoggedIn})
export const createKeybase1NotifySessionLoggedOut = (
  payload: _Keybase1NotifySessionLoggedOutPayload
): Keybase1NotifySessionLoggedOutPayload => ({payload, type: keybase1NotifySessionLoggedOut})
export const createKeybase1NotifyTeamAvatarUpdated = (
  payload: _Keybase1NotifyTeamAvatarUpdatedPayload
): Keybase1NotifyTeamAvatarUpdatedPayload => ({payload, type: keybase1NotifyTeamAvatarUpdated})
export const createKeybase1NotifyTeamNewlyAddedToTeam = (
  payload: _Keybase1NotifyTeamNewlyAddedToTeamPayload
): Keybase1NotifyTeamNewlyAddedToTeamPayload => ({payload, type: keybase1NotifyTeamNewlyAddedToTeam})
export const createKeybase1NotifyTeamTeamAbandoned = (
  payload: _Keybase1NotifyTeamTeamAbandonedPayload
): Keybase1NotifyTeamTeamAbandonedPayload => ({payload, type: keybase1NotifyTeamTeamAbandoned})
export const createKeybase1NotifyTeamTeamChangedByID = (
  payload: _Keybase1NotifyTeamTeamChangedByIDPayload
): Keybase1NotifyTeamTeamChangedByIDPayload => ({payload, type: keybase1NotifyTeamTeamChangedByID})
export const createKeybase1NotifyTeamTeamChangedByName = (
  payload: _Keybase1NotifyTeamTeamChangedByNamePayload
): Keybase1NotifyTeamTeamChangedByNamePayload => ({payload, type: keybase1NotifyTeamTeamChangedByName})
export const createKeybase1NotifyTeamTeamDeleted = (
  payload: _Keybase1NotifyTeamTeamDeletedPayload
): Keybase1NotifyTeamTeamDeletedPayload => ({payload, type: keybase1NotifyTeamTeamDeleted})
export const createKeybase1NotifyTeamTeamExit = (
  payload: _Keybase1NotifyTeamTeamExitPayload
): Keybase1NotifyTeamTeamExitPayload => ({payload, type: keybase1NotifyTeamTeamExit})
export const createKeybase1NotifyTrackingTrackingChanged = (
  payload: _Keybase1NotifyTrackingTrackingChangedPayload
): Keybase1NotifyTrackingTrackingChangedPayload => ({payload, type: keybase1NotifyTrackingTrackingChanged})
export const createKeybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged = (
  payload: _Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload
): Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload => ({
  payload,
  type: keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged,
})
export const createKeybase1NotifyUsersPasswordChanged = (
  payload: _Keybase1NotifyUsersPasswordChangedPayload
): Keybase1NotifyUsersPasswordChangedPayload => ({payload, type: keybase1NotifyUsersPasswordChanged})
export const createKeybase1NotifyUsersUserChanged = (
  payload: _Keybase1NotifyUsersUserChangedPayload
): Keybase1NotifyUsersUserChangedPayload => ({payload, type: keybase1NotifyUsersUserChanged})
export const createKeybase1PgpUiFinished = (
  payload: _Keybase1PgpUiFinishedPayload
): Keybase1PgpUiFinishedPayload => ({payload, type: keybase1PgpUiFinished})
export const createKeybase1PgpUiKeyGenerated = (
  payload: _Keybase1PgpUiKeyGeneratedPayload
): Keybase1PgpUiKeyGeneratedPayload => ({payload, type: keybase1PgpUiKeyGenerated})
export const createKeybase1PgpUiOutputSignatureSuccess = (
  payload: _Keybase1PgpUiOutputSignatureSuccessPayload
): Keybase1PgpUiOutputSignatureSuccessPayload => ({payload, type: keybase1PgpUiOutputSignatureSuccess})
export const createKeybase1PgpUiOutputSignatureSuccessNonKeybase = (
  payload: _Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload
): Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload => ({
  payload,
  type: keybase1PgpUiOutputSignatureSuccessNonKeybase,
})
export const createKeybase1PgpUiShouldPushPrivate = (
  payload: _Keybase1PgpUiShouldPushPrivatePayload
): Keybase1PgpUiShouldPushPrivatePayload => ({payload, type: keybase1PgpUiShouldPushPrivate})
export const createKeybase1ProveUiChecking = (
  payload: _Keybase1ProveUiCheckingPayload
): Keybase1ProveUiCheckingPayload => ({payload, type: keybase1ProveUiChecking})
export const createKeybase1ProveUiContinueChecking = (
  payload: _Keybase1ProveUiContinueCheckingPayload
): Keybase1ProveUiContinueCheckingPayload => ({payload, type: keybase1ProveUiContinueChecking})
export const createKeybase1ProveUiDisplayRecheckWarning = (
  payload: _Keybase1ProveUiDisplayRecheckWarningPayload
): Keybase1ProveUiDisplayRecheckWarningPayload => ({payload, type: keybase1ProveUiDisplayRecheckWarning})
export const createKeybase1ProveUiOkToCheck = (
  payload: _Keybase1ProveUiOkToCheckPayload
): Keybase1ProveUiOkToCheckPayload => ({payload, type: keybase1ProveUiOkToCheck})
export const createKeybase1ProveUiOutputInstructions = (
  payload: _Keybase1ProveUiOutputInstructionsPayload
): Keybase1ProveUiOutputInstructionsPayload => ({payload, type: keybase1ProveUiOutputInstructions})
export const createKeybase1ProveUiOutputPrechecks = (
  payload: _Keybase1ProveUiOutputPrechecksPayload
): Keybase1ProveUiOutputPrechecksPayload => ({payload, type: keybase1ProveUiOutputPrechecks})
export const createKeybase1ProveUiPreProofWarning = (
  payload: _Keybase1ProveUiPreProofWarningPayload
): Keybase1ProveUiPreProofWarningPayload => ({payload, type: keybase1ProveUiPreProofWarning})
export const createKeybase1ProveUiPromptOverwrite = (
  payload: _Keybase1ProveUiPromptOverwritePayload
): Keybase1ProveUiPromptOverwritePayload => ({payload, type: keybase1ProveUiPromptOverwrite})
export const createKeybase1ProveUiPromptUsername = (
  payload: _Keybase1ProveUiPromptUsernamePayload
): Keybase1ProveUiPromptUsernamePayload => ({payload, type: keybase1ProveUiPromptUsername})
export const createKeybase1ProvisionUiChooseDevice = (
  payload: _Keybase1ProvisionUiChooseDevicePayload
): Keybase1ProvisionUiChooseDevicePayload => ({payload, type: keybase1ProvisionUiChooseDevice})
export const createKeybase1ProvisionUiChooseDeviceType = (
  payload: _Keybase1ProvisionUiChooseDeviceTypePayload
): Keybase1ProvisionUiChooseDeviceTypePayload => ({payload, type: keybase1ProvisionUiChooseDeviceType})
export const createKeybase1ProvisionUiChooseGPGMethod = (
  payload: _Keybase1ProvisionUiChooseGPGMethodPayload
): Keybase1ProvisionUiChooseGPGMethodPayload => ({payload, type: keybase1ProvisionUiChooseGPGMethod})
export const createKeybase1ProvisionUiChooseProvisioningMethod = (
  payload: _Keybase1ProvisionUiChooseProvisioningMethodPayload
): Keybase1ProvisionUiChooseProvisioningMethodPayload => ({
  payload,
  type: keybase1ProvisionUiChooseProvisioningMethod,
})
export const createKeybase1ProvisionUiDisplayAndPromptSecret = (
  payload: _Keybase1ProvisionUiDisplayAndPromptSecretPayload
): Keybase1ProvisionUiDisplayAndPromptSecretPayload => ({
  payload,
  type: keybase1ProvisionUiDisplayAndPromptSecret,
})
export const createKeybase1ProvisionUiDisplaySecretExchanged = (
  payload: _Keybase1ProvisionUiDisplaySecretExchangedPayload
): Keybase1ProvisionUiDisplaySecretExchangedPayload => ({
  payload,
  type: keybase1ProvisionUiDisplaySecretExchanged,
})
export const createKeybase1ProvisionUiPromptNewDeviceName = (
  payload: _Keybase1ProvisionUiPromptNewDeviceNamePayload
): Keybase1ProvisionUiPromptNewDeviceNamePayload => ({payload, type: keybase1ProvisionUiPromptNewDeviceName})
export const createKeybase1ProvisionUiProvisioneeSuccess = (
  payload: _Keybase1ProvisionUiProvisioneeSuccessPayload
): Keybase1ProvisionUiProvisioneeSuccessPayload => ({payload, type: keybase1ProvisionUiProvisioneeSuccess})
export const createKeybase1ProvisionUiProvisionerSuccess = (
  payload: _Keybase1ProvisionUiProvisionerSuccessPayload
): Keybase1ProvisionUiProvisionerSuccessPayload => ({payload, type: keybase1ProvisionUiProvisionerSuccess})
export const createKeybase1ProvisionUiSwitchToGPGSignOK = (
  payload: _Keybase1ProvisionUiSwitchToGPGSignOKPayload
): Keybase1ProvisionUiSwitchToGPGSignOKPayload => ({payload, type: keybase1ProvisionUiSwitchToGPGSignOK})
export const createKeybase1ReachabilityReachabilityChanged = (
  payload: _Keybase1ReachabilityReachabilityChangedPayload
): Keybase1ReachabilityReachabilityChangedPayload => ({
  payload,
  type: keybase1ReachabilityReachabilityChanged,
})
export const createKeybase1RekeyUIDelegateRekeyUI = (
  payload: _Keybase1RekeyUIDelegateRekeyUIPayload
): Keybase1RekeyUIDelegateRekeyUIPayload => ({payload, type: keybase1RekeyUIDelegateRekeyUI})
export const createKeybase1RekeyUIRefresh = (
  payload: _Keybase1RekeyUIRefreshPayload
): Keybase1RekeyUIRefreshPayload => ({payload, type: keybase1RekeyUIRefresh})
export const createKeybase1RekeyUIRekeySendEvent = (
  payload: _Keybase1RekeyUIRekeySendEventPayload
): Keybase1RekeyUIRekeySendEventPayload => ({payload, type: keybase1RekeyUIRekeySendEvent})
export const createKeybase1SaltpackUiSaltpackPromptForDecrypt = (
  payload: _Keybase1SaltpackUiSaltpackPromptForDecryptPayload
): Keybase1SaltpackUiSaltpackPromptForDecryptPayload => ({
  payload,
  type: keybase1SaltpackUiSaltpackPromptForDecrypt,
})
export const createKeybase1SaltpackUiSaltpackVerifyBadSender = (
  payload: _Keybase1SaltpackUiSaltpackVerifyBadSenderPayload
): Keybase1SaltpackUiSaltpackVerifyBadSenderPayload => ({
  payload,
  type: keybase1SaltpackUiSaltpackVerifyBadSender,
})
export const createKeybase1SaltpackUiSaltpackVerifySuccess = (
  payload: _Keybase1SaltpackUiSaltpackVerifySuccessPayload
): Keybase1SaltpackUiSaltpackVerifySuccessPayload => ({
  payload,
  type: keybase1SaltpackUiSaltpackVerifySuccess,
})
export const createKeybase1SecretUiGetPassphrase = (
  payload: _Keybase1SecretUiGetPassphrasePayload
): Keybase1SecretUiGetPassphrasePayload => ({payload, type: keybase1SecretUiGetPassphrase})
export const createKeybase1StreamUiClose = (
  payload: _Keybase1StreamUiClosePayload
): Keybase1StreamUiClosePayload => ({payload, type: keybase1StreamUiClose})
export const createKeybase1StreamUiRead = (
  payload: _Keybase1StreamUiReadPayload
): Keybase1StreamUiReadPayload => ({payload, type: keybase1StreamUiRead})
export const createKeybase1StreamUiReset = (
  payload: _Keybase1StreamUiResetPayload
): Keybase1StreamUiResetPayload => ({payload, type: keybase1StreamUiReset})
export const createKeybase1StreamUiWrite = (
  payload: _Keybase1StreamUiWritePayload
): Keybase1StreamUiWritePayload => ({payload, type: keybase1StreamUiWrite})
export const createKeybase1TeamsUiConfirmRootTeamDelete = (
  payload: _Keybase1TeamsUiConfirmRootTeamDeletePayload
): Keybase1TeamsUiConfirmRootTeamDeletePayload => ({payload, type: keybase1TeamsUiConfirmRootTeamDelete})
export const createKeybase1TeamsUiConfirmSubteamDelete = (
  payload: _Keybase1TeamsUiConfirmSubteamDeletePayload
): Keybase1TeamsUiConfirmSubteamDeletePayload => ({payload, type: keybase1TeamsUiConfirmSubteamDelete})
export const createKeybase1UiPromptYesNo = (
  payload: _Keybase1UiPromptYesNoPayload
): Keybase1UiPromptYesNoPayload => ({payload, type: keybase1UiPromptYesNo})
export const createStellar1NotifyAccountDetailsUpdate = (
  payload: _Stellar1NotifyAccountDetailsUpdatePayload
): Stellar1NotifyAccountDetailsUpdatePayload => ({payload, type: stellar1NotifyAccountDetailsUpdate})
export const createStellar1NotifyAccountsUpdate = (
  payload: _Stellar1NotifyAccountsUpdatePayload
): Stellar1NotifyAccountsUpdatePayload => ({payload, type: stellar1NotifyAccountsUpdate})
export const createStellar1NotifyPaymentNotification = (
  payload: _Stellar1NotifyPaymentNotificationPayload
): Stellar1NotifyPaymentNotificationPayload => ({payload, type: stellar1NotifyPaymentNotification})
export const createStellar1NotifyPaymentStatusNotification = (
  payload: _Stellar1NotifyPaymentStatusNotificationPayload
): Stellar1NotifyPaymentStatusNotificationPayload => ({
  payload,
  type: stellar1NotifyPaymentStatusNotification,
})
export const createStellar1NotifyPendingPaymentsUpdate = (
  payload: _Stellar1NotifyPendingPaymentsUpdatePayload
): Stellar1NotifyPendingPaymentsUpdatePayload => ({payload, type: stellar1NotifyPendingPaymentsUpdate})
export const createStellar1NotifyRecentPaymentsUpdate = (
  payload: _Stellar1NotifyRecentPaymentsUpdatePayload
): Stellar1NotifyRecentPaymentsUpdatePayload => ({payload, type: stellar1NotifyRecentPaymentsUpdate})
export const createStellar1NotifyRequestStatusNotification = (
  payload: _Stellar1NotifyRequestStatusNotificationPayload
): Stellar1NotifyRequestStatusNotificationPayload => ({
  payload,
  type: stellar1NotifyRequestStatusNotification,
})
export const createStellar1UiPaymentReviewed = (
  payload: _Stellar1UiPaymentReviewedPayload
): Stellar1UiPaymentReviewedPayload => ({payload, type: stellar1UiPaymentReviewed})

// Action Payloads
export type Chat1ChatUiChatAttachmentDownloadDonePayload = {
  readonly payload: _Chat1ChatUiChatAttachmentDownloadDonePayload
  readonly type: 'engine-gen:chat1ChatUiChatAttachmentDownloadDone'
}
export type Chat1ChatUiChatAttachmentDownloadProgressPayload = {
  readonly payload: _Chat1ChatUiChatAttachmentDownloadProgressPayload
  readonly type: 'engine-gen:chat1ChatUiChatAttachmentDownloadProgress'
}
export type Chat1ChatUiChatAttachmentDownloadStartPayload = {
  readonly payload: _Chat1ChatUiChatAttachmentDownloadStartPayload
  readonly type: 'engine-gen:chat1ChatUiChatAttachmentDownloadStart'
}
export type Chat1ChatUiChatCoinFlipStatusPayload = {
  readonly payload: _Chat1ChatUiChatCoinFlipStatusPayload
  readonly type: 'engine-gen:chat1ChatUiChatCoinFlipStatus'
}
export type Chat1ChatUiChatCommandMarkdownPayload = {
  readonly payload: _Chat1ChatUiChatCommandMarkdownPayload
  readonly type: 'engine-gen:chat1ChatUiChatCommandMarkdown'
}
export type Chat1ChatUiChatConfirmChannelDeletePayload = {
  readonly payload: _Chat1ChatUiChatConfirmChannelDeletePayload
  readonly type: 'engine-gen:chat1ChatUiChatConfirmChannelDelete'
}
export type Chat1ChatUiChatGiphySearchResultsPayload = {
  readonly payload: _Chat1ChatUiChatGiphySearchResultsPayload
  readonly type: 'engine-gen:chat1ChatUiChatGiphySearchResults'
}
export type Chat1ChatUiChatGiphyToggleResultWindowPayload = {
  readonly payload: _Chat1ChatUiChatGiphyToggleResultWindowPayload
  readonly type: 'engine-gen:chat1ChatUiChatGiphyToggleResultWindow'
}
export type Chat1ChatUiChatInboxConversationPayload = {
  readonly payload: _Chat1ChatUiChatInboxConversationPayload
  readonly type: 'engine-gen:chat1ChatUiChatInboxConversation'
}
export type Chat1ChatUiChatInboxFailedPayload = {
  readonly payload: _Chat1ChatUiChatInboxFailedPayload
  readonly type: 'engine-gen:chat1ChatUiChatInboxFailed'
}
export type Chat1ChatUiChatInboxUnverifiedPayload = {
  readonly payload: _Chat1ChatUiChatInboxUnverifiedPayload
  readonly type: 'engine-gen:chat1ChatUiChatInboxUnverified'
}
export type Chat1ChatUiChatLoadGalleryHitPayload = {
  readonly payload: _Chat1ChatUiChatLoadGalleryHitPayload
  readonly type: 'engine-gen:chat1ChatUiChatLoadGalleryHit'
}
export type Chat1ChatUiChatMaybeMentionUpdatePayload = {
  readonly payload: _Chat1ChatUiChatMaybeMentionUpdatePayload
  readonly type: 'engine-gen:chat1ChatUiChatMaybeMentionUpdate'
}
export type Chat1ChatUiChatSearchConvHitsPayload = {
  readonly payload: _Chat1ChatUiChatSearchConvHitsPayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchConvHits'
}
export type Chat1ChatUiChatSearchDonePayload = {
  readonly payload: _Chat1ChatUiChatSearchDonePayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchDone'
}
export type Chat1ChatUiChatSearchHitPayload = {
  readonly payload: _Chat1ChatUiChatSearchHitPayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchHit'
}
export type Chat1ChatUiChatSearchInboxDonePayload = {
  readonly payload: _Chat1ChatUiChatSearchInboxDonePayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchInboxDone'
}
export type Chat1ChatUiChatSearchInboxHitPayload = {
  readonly payload: _Chat1ChatUiChatSearchInboxHitPayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchInboxHit'
}
export type Chat1ChatUiChatSearchInboxStartPayload = {
  readonly payload: _Chat1ChatUiChatSearchInboxStartPayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchInboxStart'
}
export type Chat1ChatUiChatSearchIndexStatusPayload = {
  readonly payload: _Chat1ChatUiChatSearchIndexStatusPayload
  readonly type: 'engine-gen:chat1ChatUiChatSearchIndexStatus'
}
export type Chat1ChatUiChatShowManageChannelsPayload = {
  readonly payload: _Chat1ChatUiChatShowManageChannelsPayload
  readonly type: 'engine-gen:chat1ChatUiChatShowManageChannels'
}
export type Chat1ChatUiChatStellarDataConfirmPayload = {
  readonly payload: _Chat1ChatUiChatStellarDataConfirmPayload
  readonly type: 'engine-gen:chat1ChatUiChatStellarDataConfirm'
}
export type Chat1ChatUiChatStellarDataErrorPayload = {
  readonly payload: _Chat1ChatUiChatStellarDataErrorPayload
  readonly type: 'engine-gen:chat1ChatUiChatStellarDataError'
}
export type Chat1ChatUiChatStellarDonePayload = {
  readonly payload: _Chat1ChatUiChatStellarDonePayload
  readonly type: 'engine-gen:chat1ChatUiChatStellarDone'
}
export type Chat1ChatUiChatStellarShowConfirmPayload = {
  readonly payload: _Chat1ChatUiChatStellarShowConfirmPayload
  readonly type: 'engine-gen:chat1ChatUiChatStellarShowConfirm'
}
export type Chat1ChatUiChatThreadCachedPayload = {
  readonly payload: _Chat1ChatUiChatThreadCachedPayload
  readonly type: 'engine-gen:chat1ChatUiChatThreadCached'
}
export type Chat1ChatUiChatThreadFullPayload = {
  readonly payload: _Chat1ChatUiChatThreadFullPayload
  readonly type: 'engine-gen:chat1ChatUiChatThreadFull'
}
export type Chat1NotifyChatChatAttachmentUploadProgressPayload = {
  readonly payload: _Chat1NotifyChatChatAttachmentUploadProgressPayload
  readonly type: 'engine-gen:chat1NotifyChatChatAttachmentUploadProgress'
}
export type Chat1NotifyChatChatAttachmentUploadStartPayload = {
  readonly payload: _Chat1NotifyChatChatAttachmentUploadStartPayload
  readonly type: 'engine-gen:chat1NotifyChatChatAttachmentUploadStart'
}
export type Chat1NotifyChatChatIdentifyUpdatePayload = {
  readonly payload: _Chat1NotifyChatChatIdentifyUpdatePayload
  readonly type: 'engine-gen:chat1NotifyChatChatIdentifyUpdate'
}
export type Chat1NotifyChatChatInboxStalePayload = {
  readonly payload: _Chat1NotifyChatChatInboxStalePayload
  readonly type: 'engine-gen:chat1NotifyChatChatInboxStale'
}
export type Chat1NotifyChatChatInboxSyncStartedPayload = {
  readonly payload: _Chat1NotifyChatChatInboxSyncStartedPayload
  readonly type: 'engine-gen:chat1NotifyChatChatInboxSyncStarted'
}
export type Chat1NotifyChatChatInboxSyncedPayload = {
  readonly payload: _Chat1NotifyChatChatInboxSyncedPayload
  readonly type: 'engine-gen:chat1NotifyChatChatInboxSynced'
}
export type Chat1NotifyChatChatJoinedConversationPayload = {
  readonly payload: _Chat1NotifyChatChatJoinedConversationPayload
  readonly type: 'engine-gen:chat1NotifyChatChatJoinedConversation'
}
export type Chat1NotifyChatChatKBFSToImpteamUpgradePayload = {
  readonly payload: _Chat1NotifyChatChatKBFSToImpteamUpgradePayload
  readonly type: 'engine-gen:chat1NotifyChatChatKBFSToImpteamUpgrade'
}
export type Chat1NotifyChatChatLeftConversationPayload = {
  readonly payload: _Chat1NotifyChatChatLeftConversationPayload
  readonly type: 'engine-gen:chat1NotifyChatChatLeftConversation'
}
export type Chat1NotifyChatChatPaymentInfoPayload = {
  readonly payload: _Chat1NotifyChatChatPaymentInfoPayload
  readonly type: 'engine-gen:chat1NotifyChatChatPaymentInfo'
}
export type Chat1NotifyChatChatPromptUnfurlPayload = {
  readonly payload: _Chat1NotifyChatChatPromptUnfurlPayload
  readonly type: 'engine-gen:chat1NotifyChatChatPromptUnfurl'
}
export type Chat1NotifyChatChatRequestInfoPayload = {
  readonly payload: _Chat1NotifyChatChatRequestInfoPayload
  readonly type: 'engine-gen:chat1NotifyChatChatRequestInfo'
}
export type Chat1NotifyChatChatResetConversationPayload = {
  readonly payload: _Chat1NotifyChatChatResetConversationPayload
  readonly type: 'engine-gen:chat1NotifyChatChatResetConversation'
}
export type Chat1NotifyChatChatSetConvRetentionPayload = {
  readonly payload: _Chat1NotifyChatChatSetConvRetentionPayload
  readonly type: 'engine-gen:chat1NotifyChatChatSetConvRetention'
}
export type Chat1NotifyChatChatSetConvSettingsPayload = {
  readonly payload: _Chat1NotifyChatChatSetConvSettingsPayload
  readonly type: 'engine-gen:chat1NotifyChatChatSetConvSettings'
}
export type Chat1NotifyChatChatSetTeamRetentionPayload = {
  readonly payload: _Chat1NotifyChatChatSetTeamRetentionPayload
  readonly type: 'engine-gen:chat1NotifyChatChatSetTeamRetention'
}
export type Chat1NotifyChatChatSubteamRenamePayload = {
  readonly payload: _Chat1NotifyChatChatSubteamRenamePayload
  readonly type: 'engine-gen:chat1NotifyChatChatSubteamRename'
}
export type Chat1NotifyChatChatTLFFinalizePayload = {
  readonly payload: _Chat1NotifyChatChatTLFFinalizePayload
  readonly type: 'engine-gen:chat1NotifyChatChatTLFFinalize'
}
export type Chat1NotifyChatChatTLFResolvePayload = {
  readonly payload: _Chat1NotifyChatChatTLFResolvePayload
  readonly type: 'engine-gen:chat1NotifyChatChatTLFResolve'
}
export type Chat1NotifyChatChatThreadsStalePayload = {
  readonly payload: _Chat1NotifyChatChatThreadsStalePayload
  readonly type: 'engine-gen:chat1NotifyChatChatThreadsStale'
}
export type Chat1NotifyChatChatTypingUpdatePayload = {
  readonly payload: _Chat1NotifyChatChatTypingUpdatePayload
  readonly type: 'engine-gen:chat1NotifyChatChatTypingUpdate'
}
export type Chat1NotifyChatNewChatActivityPayload = {
  readonly payload: _Chat1NotifyChatNewChatActivityPayload
  readonly type: 'engine-gen:chat1NotifyChatNewChatActivity'
}
export type ConnectedPayload = {readonly payload: _ConnectedPayload; readonly type: 'engine-gen:connected'}
export type DisconnectedPayload = {
  readonly payload: _DisconnectedPayload
  readonly type: 'engine-gen:disconnected'
}
export type Keybase1GpgUiConfirmDuplicateKeyChosenPayload = {
  readonly payload: _Keybase1GpgUiConfirmDuplicateKeyChosenPayload
  readonly type: 'engine-gen:keybase1GpgUiConfirmDuplicateKeyChosen'
}
export type Keybase1GpgUiConfirmImportSecretToExistingKeyPayload = {
  readonly payload: _Keybase1GpgUiConfirmImportSecretToExistingKeyPayload
  readonly type: 'engine-gen:keybase1GpgUiConfirmImportSecretToExistingKey'
}
export type Keybase1GpgUiGetTTYPayload = {
  readonly payload: _Keybase1GpgUiGetTTYPayload
  readonly type: 'engine-gen:keybase1GpgUiGetTTY'
}
export type Keybase1GpgUiSelectKeyAndPushOptionPayload = {
  readonly payload: _Keybase1GpgUiSelectKeyAndPushOptionPayload
  readonly type: 'engine-gen:keybase1GpgUiSelectKeyAndPushOption'
}
export type Keybase1GpgUiSelectKeyPayload = {
  readonly payload: _Keybase1GpgUiSelectKeyPayload
  readonly type: 'engine-gen:keybase1GpgUiSelectKey'
}
export type Keybase1GpgUiSignPayload = {
  readonly payload: _Keybase1GpgUiSignPayload
  readonly type: 'engine-gen:keybase1GpgUiSign'
}
export type Keybase1GpgUiWantToAddGPGKeyPayload = {
  readonly payload: _Keybase1GpgUiWantToAddGPGKeyPayload
  readonly type: 'engine-gen:keybase1GpgUiWantToAddGPGKey'
}
export type Keybase1GregorUIPushOutOfBandMessagesPayload = {
  readonly payload: _Keybase1GregorUIPushOutOfBandMessagesPayload
  readonly type: 'engine-gen:keybase1GregorUIPushOutOfBandMessages'
}
export type Keybase1GregorUIPushStatePayload = {
  readonly payload: _Keybase1GregorUIPushStatePayload
  readonly type: 'engine-gen:keybase1GregorUIPushState'
}
export type Keybase1HomeUIHomeUIRefreshPayload = {
  readonly payload: _Keybase1HomeUIHomeUIRefreshPayload
  readonly type: 'engine-gen:keybase1HomeUIHomeUIRefresh'
}
export type Keybase1Identify3UiIdentify3ResultPayload = {
  readonly payload: _Keybase1Identify3UiIdentify3ResultPayload
  readonly type: 'engine-gen:keybase1Identify3UiIdentify3Result'
}
export type Keybase1Identify3UiIdentify3ShowTrackerPayload = {
  readonly payload: _Keybase1Identify3UiIdentify3ShowTrackerPayload
  readonly type: 'engine-gen:keybase1Identify3UiIdentify3ShowTracker'
}
export type Keybase1Identify3UiIdentify3TrackerTimedOutPayload = {
  readonly payload: _Keybase1Identify3UiIdentify3TrackerTimedOutPayload
  readonly type: 'engine-gen:keybase1Identify3UiIdentify3TrackerTimedOut'
}
export type Keybase1Identify3UiIdentify3UpdateRowPayload = {
  readonly payload: _Keybase1Identify3UiIdentify3UpdateRowPayload
  readonly type: 'engine-gen:keybase1Identify3UiIdentify3UpdateRow'
}
export type Keybase1Identify3UiIdentify3UpdateUserCardPayload = {
  readonly payload: _Keybase1Identify3UiIdentify3UpdateUserCardPayload
  readonly type: 'engine-gen:keybase1Identify3UiIdentify3UpdateUserCard'
}
export type Keybase1Identify3UiIdentify3UserResetPayload = {
  readonly payload: _Keybase1Identify3UiIdentify3UserResetPayload
  readonly type: 'engine-gen:keybase1Identify3UiIdentify3UserReset'
}
export type Keybase1IdentifyUiCancelPayload = {
  readonly payload: _Keybase1IdentifyUiCancelPayload
  readonly type: 'engine-gen:keybase1IdentifyUiCancel'
}
export type Keybase1IdentifyUiConfirmPayload = {
  readonly payload: _Keybase1IdentifyUiConfirmPayload
  readonly type: 'engine-gen:keybase1IdentifyUiConfirm'
}
export type Keybase1IdentifyUiDelegateIdentifyUIPayload = {
  readonly payload: _Keybase1IdentifyUiDelegateIdentifyUIPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDelegateIdentifyUI'
}
export type Keybase1IdentifyUiDismissPayload = {
  readonly payload: _Keybase1IdentifyUiDismissPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDismiss'
}
export type Keybase1IdentifyUiDisplayCryptocurrencyPayload = {
  readonly payload: _Keybase1IdentifyUiDisplayCryptocurrencyPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDisplayCryptocurrency'
}
export type Keybase1IdentifyUiDisplayKeyPayload = {
  readonly payload: _Keybase1IdentifyUiDisplayKeyPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDisplayKey'
}
export type Keybase1IdentifyUiDisplayStellarAccountPayload = {
  readonly payload: _Keybase1IdentifyUiDisplayStellarAccountPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDisplayStellarAccount'
}
export type Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload = {
  readonly payload: _Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload
  readonly type: 'engine-gen:keybase1IdentifyUiDisplayTLFCreateWithInvite'
}
export type Keybase1IdentifyUiDisplayTrackStatementPayload = {
  readonly payload: _Keybase1IdentifyUiDisplayTrackStatementPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDisplayTrackStatement'
}
export type Keybase1IdentifyUiDisplayUserCardPayload = {
  readonly payload: _Keybase1IdentifyUiDisplayUserCardPayload
  readonly type: 'engine-gen:keybase1IdentifyUiDisplayUserCard'
}
export type Keybase1IdentifyUiFinishPayload = {
  readonly payload: _Keybase1IdentifyUiFinishPayload
  readonly type: 'engine-gen:keybase1IdentifyUiFinish'
}
export type Keybase1IdentifyUiFinishSocialProofCheckPayload = {
  readonly payload: _Keybase1IdentifyUiFinishSocialProofCheckPayload
  readonly type: 'engine-gen:keybase1IdentifyUiFinishSocialProofCheck'
}
export type Keybase1IdentifyUiFinishWebProofCheckPayload = {
  readonly payload: _Keybase1IdentifyUiFinishWebProofCheckPayload
  readonly type: 'engine-gen:keybase1IdentifyUiFinishWebProofCheck'
}
export type Keybase1IdentifyUiLaunchNetworkChecksPayload = {
  readonly payload: _Keybase1IdentifyUiLaunchNetworkChecksPayload
  readonly type: 'engine-gen:keybase1IdentifyUiLaunchNetworkChecks'
}
export type Keybase1IdentifyUiReportLastTrackPayload = {
  readonly payload: _Keybase1IdentifyUiReportLastTrackPayload
  readonly type: 'engine-gen:keybase1IdentifyUiReportLastTrack'
}
export type Keybase1IdentifyUiReportTrackTokenPayload = {
  readonly payload: _Keybase1IdentifyUiReportTrackTokenPayload
  readonly type: 'engine-gen:keybase1IdentifyUiReportTrackToken'
}
export type Keybase1IdentifyUiStartPayload = {
  readonly payload: _Keybase1IdentifyUiStartPayload
  readonly type: 'engine-gen:keybase1IdentifyUiStart'
}
export type Keybase1LogUiLogPayload = {
  readonly payload: _Keybase1LogUiLogPayload
  readonly type: 'engine-gen:keybase1LogUiLog'
}
export type Keybase1LoginUiDisplayPaperKeyPhrasePayload = {
  readonly payload: _Keybase1LoginUiDisplayPaperKeyPhrasePayload
  readonly type: 'engine-gen:keybase1LoginUiDisplayPaperKeyPhrase'
}
export type Keybase1LoginUiDisplayPrimaryPaperKeyPayload = {
  readonly payload: _Keybase1LoginUiDisplayPrimaryPaperKeyPayload
  readonly type: 'engine-gen:keybase1LoginUiDisplayPrimaryPaperKey'
}
export type Keybase1LoginUiDisplayResetProgressPayload = {
  readonly payload: _Keybase1LoginUiDisplayResetProgressPayload
  readonly type: 'engine-gen:keybase1LoginUiDisplayResetProgress'
}
export type Keybase1LoginUiExplainDeviceRecoveryPayload = {
  readonly payload: _Keybase1LoginUiExplainDeviceRecoveryPayload
  readonly type: 'engine-gen:keybase1LoginUiExplainDeviceRecovery'
}
export type Keybase1LoginUiGetEmailOrUsernamePayload = {
  readonly payload: _Keybase1LoginUiGetEmailOrUsernamePayload
  readonly type: 'engine-gen:keybase1LoginUiGetEmailOrUsername'
}
export type Keybase1LoginUiPromptPassphraseRecoveryPayload = {
  readonly payload: _Keybase1LoginUiPromptPassphraseRecoveryPayload
  readonly type: 'engine-gen:keybase1LoginUiPromptPassphraseRecovery'
}
export type Keybase1LoginUiPromptResetAccountPayload = {
  readonly payload: _Keybase1LoginUiPromptResetAccountPayload
  readonly type: 'engine-gen:keybase1LoginUiPromptResetAccount'
}
export type Keybase1LoginUiPromptRevokePaperKeysPayload = {
  readonly payload: _Keybase1LoginUiPromptRevokePaperKeysPayload
  readonly type: 'engine-gen:keybase1LoginUiPromptRevokePaperKeys'
}
export type Keybase1LogsendPrepareLogsendPayload = {
  readonly payload: _Keybase1LogsendPrepareLogsendPayload
  readonly type: 'engine-gen:keybase1LogsendPrepareLogsend'
}
export type Keybase1NotifyAppExitPayload = {
  readonly payload: _Keybase1NotifyAppExitPayload
  readonly type: 'engine-gen:keybase1NotifyAppExit'
}
export type Keybase1NotifyAuditBoxAuditErrorPayload = {
  readonly payload: _Keybase1NotifyAuditBoxAuditErrorPayload
  readonly type: 'engine-gen:keybase1NotifyAuditBoxAuditError'
}
export type Keybase1NotifyAuditRootAuditErrorPayload = {
  readonly payload: _Keybase1NotifyAuditRootAuditErrorPayload
  readonly type: 'engine-gen:keybase1NotifyAuditRootAuditError'
}
export type Keybase1NotifyBadgesBadgeStatePayload = {
  readonly payload: _Keybase1NotifyBadgesBadgeStatePayload
  readonly type: 'engine-gen:keybase1NotifyBadgesBadgeState'
}
export type Keybase1NotifyCanUserPerformCanUserPerformChangedPayload = {
  readonly payload: _Keybase1NotifyCanUserPerformCanUserPerformChangedPayload
  readonly type: 'engine-gen:keybase1NotifyCanUserPerformCanUserPerformChanged'
}
export type Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload = {
  readonly payload: _Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload
  readonly type: 'engine-gen:keybase1NotifyDeviceCloneDeviceCloneCountChanged'
}
export type Keybase1NotifyEmailAddressEmailAddressVerifiedPayload = {
  readonly payload: _Keybase1NotifyEmailAddressEmailAddressVerifiedPayload
  readonly type: 'engine-gen:keybase1NotifyEmailAddressEmailAddressVerified'
}
export type Keybase1NotifyEmailAddressEmailsChangedPayload = {
  readonly payload: _Keybase1NotifyEmailAddressEmailsChangedPayload
  readonly type: 'engine-gen:keybase1NotifyEmailAddressEmailsChanged'
}
export type Keybase1NotifyEphemeralNewTeamEkPayload = {
  readonly payload: _Keybase1NotifyEphemeralNewTeamEkPayload
  readonly type: 'engine-gen:keybase1NotifyEphemeralNewTeamEk'
}
export type Keybase1NotifyFSFSActivityPayload = {
  readonly payload: _Keybase1NotifyFSFSActivityPayload
  readonly type: 'engine-gen:keybase1NotifyFSFSActivity'
}
export type Keybase1NotifyFSFSEditListResponsePayload = {
  readonly payload: _Keybase1NotifyFSFSEditListResponsePayload
  readonly type: 'engine-gen:keybase1NotifyFSFSEditListResponse'
}
export type Keybase1NotifyFSFSFavoritesChangedPayload = {
  readonly payload: _Keybase1NotifyFSFSFavoritesChangedPayload
  readonly type: 'engine-gen:keybase1NotifyFSFSFavoritesChanged'
}
export type Keybase1NotifyFSFSOnlineStatusChangedPayload = {
  readonly payload: _Keybase1NotifyFSFSOnlineStatusChangedPayload
  readonly type: 'engine-gen:keybase1NotifyFSFSOnlineStatusChanged'
}
export type Keybase1NotifyFSFSOverallSyncStatusChangedPayload = {
  readonly payload: _Keybase1NotifyFSFSOverallSyncStatusChangedPayload
  readonly type: 'engine-gen:keybase1NotifyFSFSOverallSyncStatusChanged'
}
export type Keybase1NotifyFSFSPathUpdatedPayload = {
  readonly payload: _Keybase1NotifyFSFSPathUpdatedPayload
  readonly type: 'engine-gen:keybase1NotifyFSFSPathUpdated'
}
export type Keybase1NotifyFSFSSyncActivityPayload = {
  readonly payload: _Keybase1NotifyFSFSSyncActivityPayload
  readonly type: 'engine-gen:keybase1NotifyFSFSSyncActivity'
}
export type Keybase1NotifyFSFSSyncStatusResponsePayload = {
  readonly payload: _Keybase1NotifyFSFSSyncStatusResponsePayload
  readonly type: 'engine-gen:keybase1NotifyFSFSSyncStatusResponse'
}
export type Keybase1NotifyFavoritesFavoritesChangedPayload = {
  readonly payload: _Keybase1NotifyFavoritesFavoritesChangedPayload
  readonly type: 'engine-gen:keybase1NotifyFavoritesFavoritesChanged'
}
export type Keybase1NotifyKeyfamilyKeyfamilyChangedPayload = {
  readonly payload: _Keybase1NotifyKeyfamilyKeyfamilyChangedPayload
  readonly type: 'engine-gen:keybase1NotifyKeyfamilyKeyfamilyChanged'
}
export type Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload = {
  readonly payload: _Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload
  readonly type: 'engine-gen:keybase1NotifyPGPPgpKeyInSecretStoreFile'
}
export type Keybase1NotifyPaperKeyPaperKeyCachedPayload = {
  readonly payload: _Keybase1NotifyPaperKeyPaperKeyCachedPayload
  readonly type: 'engine-gen:keybase1NotifyPaperKeyPaperKeyCached'
}
export type Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload = {
  readonly payload: _Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload
  readonly type: 'engine-gen:keybase1NotifyPhoneNumberPhoneNumbersChanged'
}
export type Keybase1NotifyServiceShutdownPayload = {
  readonly payload: _Keybase1NotifyServiceShutdownPayload
  readonly type: 'engine-gen:keybase1NotifyServiceShutdown'
}
export type Keybase1NotifySessionClientOutOfDatePayload = {
  readonly payload: _Keybase1NotifySessionClientOutOfDatePayload
  readonly type: 'engine-gen:keybase1NotifySessionClientOutOfDate'
}
export type Keybase1NotifySessionLoggedInPayload = {
  readonly payload: _Keybase1NotifySessionLoggedInPayload
  readonly type: 'engine-gen:keybase1NotifySessionLoggedIn'
}
export type Keybase1NotifySessionLoggedOutPayload = {
  readonly payload: _Keybase1NotifySessionLoggedOutPayload
  readonly type: 'engine-gen:keybase1NotifySessionLoggedOut'
}
export type Keybase1NotifyTeamAvatarUpdatedPayload = {
  readonly payload: _Keybase1NotifyTeamAvatarUpdatedPayload
  readonly type: 'engine-gen:keybase1NotifyTeamAvatarUpdated'
}
export type Keybase1NotifyTeamNewlyAddedToTeamPayload = {
  readonly payload: _Keybase1NotifyTeamNewlyAddedToTeamPayload
  readonly type: 'engine-gen:keybase1NotifyTeamNewlyAddedToTeam'
}
export type Keybase1NotifyTeamTeamAbandonedPayload = {
  readonly payload: _Keybase1NotifyTeamTeamAbandonedPayload
  readonly type: 'engine-gen:keybase1NotifyTeamTeamAbandoned'
}
export type Keybase1NotifyTeamTeamChangedByIDPayload = {
  readonly payload: _Keybase1NotifyTeamTeamChangedByIDPayload
  readonly type: 'engine-gen:keybase1NotifyTeamTeamChangedByID'
}
export type Keybase1NotifyTeamTeamChangedByNamePayload = {
  readonly payload: _Keybase1NotifyTeamTeamChangedByNamePayload
  readonly type: 'engine-gen:keybase1NotifyTeamTeamChangedByName'
}
export type Keybase1NotifyTeamTeamDeletedPayload = {
  readonly payload: _Keybase1NotifyTeamTeamDeletedPayload
  readonly type: 'engine-gen:keybase1NotifyTeamTeamDeleted'
}
export type Keybase1NotifyTeamTeamExitPayload = {
  readonly payload: _Keybase1NotifyTeamTeamExitPayload
  readonly type: 'engine-gen:keybase1NotifyTeamTeamExit'
}
export type Keybase1NotifyTrackingTrackingChangedPayload = {
  readonly payload: _Keybase1NotifyTrackingTrackingChangedPayload
  readonly type: 'engine-gen:keybase1NotifyTrackingTrackingChanged'
}
export type Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload = {
  readonly payload: _Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload
  readonly type: 'engine-gen:keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged'
}
export type Keybase1NotifyUsersPasswordChangedPayload = {
  readonly payload: _Keybase1NotifyUsersPasswordChangedPayload
  readonly type: 'engine-gen:keybase1NotifyUsersPasswordChanged'
}
export type Keybase1NotifyUsersUserChangedPayload = {
  readonly payload: _Keybase1NotifyUsersUserChangedPayload
  readonly type: 'engine-gen:keybase1NotifyUsersUserChanged'
}
export type Keybase1PgpUiFinishedPayload = {
  readonly payload: _Keybase1PgpUiFinishedPayload
  readonly type: 'engine-gen:keybase1PgpUiFinished'
}
export type Keybase1PgpUiKeyGeneratedPayload = {
  readonly payload: _Keybase1PgpUiKeyGeneratedPayload
  readonly type: 'engine-gen:keybase1PgpUiKeyGenerated'
}
export type Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload = {
  readonly payload: _Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload
  readonly type: 'engine-gen:keybase1PgpUiOutputSignatureSuccessNonKeybase'
}
export type Keybase1PgpUiOutputSignatureSuccessPayload = {
  readonly payload: _Keybase1PgpUiOutputSignatureSuccessPayload
  readonly type: 'engine-gen:keybase1PgpUiOutputSignatureSuccess'
}
export type Keybase1PgpUiShouldPushPrivatePayload = {
  readonly payload: _Keybase1PgpUiShouldPushPrivatePayload
  readonly type: 'engine-gen:keybase1PgpUiShouldPushPrivate'
}
export type Keybase1ProveUiCheckingPayload = {
  readonly payload: _Keybase1ProveUiCheckingPayload
  readonly type: 'engine-gen:keybase1ProveUiChecking'
}
export type Keybase1ProveUiContinueCheckingPayload = {
  readonly payload: _Keybase1ProveUiContinueCheckingPayload
  readonly type: 'engine-gen:keybase1ProveUiContinueChecking'
}
export type Keybase1ProveUiDisplayRecheckWarningPayload = {
  readonly payload: _Keybase1ProveUiDisplayRecheckWarningPayload
  readonly type: 'engine-gen:keybase1ProveUiDisplayRecheckWarning'
}
export type Keybase1ProveUiOkToCheckPayload = {
  readonly payload: _Keybase1ProveUiOkToCheckPayload
  readonly type: 'engine-gen:keybase1ProveUiOkToCheck'
}
export type Keybase1ProveUiOutputInstructionsPayload = {
  readonly payload: _Keybase1ProveUiOutputInstructionsPayload
  readonly type: 'engine-gen:keybase1ProveUiOutputInstructions'
}
export type Keybase1ProveUiOutputPrechecksPayload = {
  readonly payload: _Keybase1ProveUiOutputPrechecksPayload
  readonly type: 'engine-gen:keybase1ProveUiOutputPrechecks'
}
export type Keybase1ProveUiPreProofWarningPayload = {
  readonly payload: _Keybase1ProveUiPreProofWarningPayload
  readonly type: 'engine-gen:keybase1ProveUiPreProofWarning'
}
export type Keybase1ProveUiPromptOverwritePayload = {
  readonly payload: _Keybase1ProveUiPromptOverwritePayload
  readonly type: 'engine-gen:keybase1ProveUiPromptOverwrite'
}
export type Keybase1ProveUiPromptUsernamePayload = {
  readonly payload: _Keybase1ProveUiPromptUsernamePayload
  readonly type: 'engine-gen:keybase1ProveUiPromptUsername'
}
export type Keybase1ProvisionUiChooseDevicePayload = {
  readonly payload: _Keybase1ProvisionUiChooseDevicePayload
  readonly type: 'engine-gen:keybase1ProvisionUiChooseDevice'
}
export type Keybase1ProvisionUiChooseDeviceTypePayload = {
  readonly payload: _Keybase1ProvisionUiChooseDeviceTypePayload
  readonly type: 'engine-gen:keybase1ProvisionUiChooseDeviceType'
}
export type Keybase1ProvisionUiChooseGPGMethodPayload = {
  readonly payload: _Keybase1ProvisionUiChooseGPGMethodPayload
  readonly type: 'engine-gen:keybase1ProvisionUiChooseGPGMethod'
}
export type Keybase1ProvisionUiChooseProvisioningMethodPayload = {
  readonly payload: _Keybase1ProvisionUiChooseProvisioningMethodPayload
  readonly type: 'engine-gen:keybase1ProvisionUiChooseProvisioningMethod'
}
export type Keybase1ProvisionUiDisplayAndPromptSecretPayload = {
  readonly payload: _Keybase1ProvisionUiDisplayAndPromptSecretPayload
  readonly type: 'engine-gen:keybase1ProvisionUiDisplayAndPromptSecret'
}
export type Keybase1ProvisionUiDisplaySecretExchangedPayload = {
  readonly payload: _Keybase1ProvisionUiDisplaySecretExchangedPayload
  readonly type: 'engine-gen:keybase1ProvisionUiDisplaySecretExchanged'
}
export type Keybase1ProvisionUiPromptNewDeviceNamePayload = {
  readonly payload: _Keybase1ProvisionUiPromptNewDeviceNamePayload
  readonly type: 'engine-gen:keybase1ProvisionUiPromptNewDeviceName'
}
export type Keybase1ProvisionUiProvisioneeSuccessPayload = {
  readonly payload: _Keybase1ProvisionUiProvisioneeSuccessPayload
  readonly type: 'engine-gen:keybase1ProvisionUiProvisioneeSuccess'
}
export type Keybase1ProvisionUiProvisionerSuccessPayload = {
  readonly payload: _Keybase1ProvisionUiProvisionerSuccessPayload
  readonly type: 'engine-gen:keybase1ProvisionUiProvisionerSuccess'
}
export type Keybase1ProvisionUiSwitchToGPGSignOKPayload = {
  readonly payload: _Keybase1ProvisionUiSwitchToGPGSignOKPayload
  readonly type: 'engine-gen:keybase1ProvisionUiSwitchToGPGSignOK'
}
export type Keybase1ReachabilityReachabilityChangedPayload = {
  readonly payload: _Keybase1ReachabilityReachabilityChangedPayload
  readonly type: 'engine-gen:keybase1ReachabilityReachabilityChanged'
}
export type Keybase1RekeyUIDelegateRekeyUIPayload = {
  readonly payload: _Keybase1RekeyUIDelegateRekeyUIPayload
  readonly type: 'engine-gen:keybase1RekeyUIDelegateRekeyUI'
}
export type Keybase1RekeyUIRefreshPayload = {
  readonly payload: _Keybase1RekeyUIRefreshPayload
  readonly type: 'engine-gen:keybase1RekeyUIRefresh'
}
export type Keybase1RekeyUIRekeySendEventPayload = {
  readonly payload: _Keybase1RekeyUIRekeySendEventPayload
  readonly type: 'engine-gen:keybase1RekeyUIRekeySendEvent'
}
export type Keybase1SaltpackUiSaltpackPromptForDecryptPayload = {
  readonly payload: _Keybase1SaltpackUiSaltpackPromptForDecryptPayload
  readonly type: 'engine-gen:keybase1SaltpackUiSaltpackPromptForDecrypt'
}
export type Keybase1SaltpackUiSaltpackVerifyBadSenderPayload = {
  readonly payload: _Keybase1SaltpackUiSaltpackVerifyBadSenderPayload
  readonly type: 'engine-gen:keybase1SaltpackUiSaltpackVerifyBadSender'
}
export type Keybase1SaltpackUiSaltpackVerifySuccessPayload = {
  readonly payload: _Keybase1SaltpackUiSaltpackVerifySuccessPayload
  readonly type: 'engine-gen:keybase1SaltpackUiSaltpackVerifySuccess'
}
export type Keybase1SecretUiGetPassphrasePayload = {
  readonly payload: _Keybase1SecretUiGetPassphrasePayload
  readonly type: 'engine-gen:keybase1SecretUiGetPassphrase'
}
export type Keybase1StreamUiClosePayload = {
  readonly payload: _Keybase1StreamUiClosePayload
  readonly type: 'engine-gen:keybase1StreamUiClose'
}
export type Keybase1StreamUiReadPayload = {
  readonly payload: _Keybase1StreamUiReadPayload
  readonly type: 'engine-gen:keybase1StreamUiRead'
}
export type Keybase1StreamUiResetPayload = {
  readonly payload: _Keybase1StreamUiResetPayload
  readonly type: 'engine-gen:keybase1StreamUiReset'
}
export type Keybase1StreamUiWritePayload = {
  readonly payload: _Keybase1StreamUiWritePayload
  readonly type: 'engine-gen:keybase1StreamUiWrite'
}
export type Keybase1TeamsUiConfirmRootTeamDeletePayload = {
  readonly payload: _Keybase1TeamsUiConfirmRootTeamDeletePayload
  readonly type: 'engine-gen:keybase1TeamsUiConfirmRootTeamDelete'
}
export type Keybase1TeamsUiConfirmSubteamDeletePayload = {
  readonly payload: _Keybase1TeamsUiConfirmSubteamDeletePayload
  readonly type: 'engine-gen:keybase1TeamsUiConfirmSubteamDelete'
}
export type Keybase1UiPromptYesNoPayload = {
  readonly payload: _Keybase1UiPromptYesNoPayload
  readonly type: 'engine-gen:keybase1UiPromptYesNo'
}
export type Stellar1NotifyAccountDetailsUpdatePayload = {
  readonly payload: _Stellar1NotifyAccountDetailsUpdatePayload
  readonly type: 'engine-gen:stellar1NotifyAccountDetailsUpdate'
}
export type Stellar1NotifyAccountsUpdatePayload = {
  readonly payload: _Stellar1NotifyAccountsUpdatePayload
  readonly type: 'engine-gen:stellar1NotifyAccountsUpdate'
}
export type Stellar1NotifyPaymentNotificationPayload = {
  readonly payload: _Stellar1NotifyPaymentNotificationPayload
  readonly type: 'engine-gen:stellar1NotifyPaymentNotification'
}
export type Stellar1NotifyPaymentStatusNotificationPayload = {
  readonly payload: _Stellar1NotifyPaymentStatusNotificationPayload
  readonly type: 'engine-gen:stellar1NotifyPaymentStatusNotification'
}
export type Stellar1NotifyPendingPaymentsUpdatePayload = {
  readonly payload: _Stellar1NotifyPendingPaymentsUpdatePayload
  readonly type: 'engine-gen:stellar1NotifyPendingPaymentsUpdate'
}
export type Stellar1NotifyRecentPaymentsUpdatePayload = {
  readonly payload: _Stellar1NotifyRecentPaymentsUpdatePayload
  readonly type: 'engine-gen:stellar1NotifyRecentPaymentsUpdate'
}
export type Stellar1NotifyRequestStatusNotificationPayload = {
  readonly payload: _Stellar1NotifyRequestStatusNotificationPayload
  readonly type: 'engine-gen:stellar1NotifyRequestStatusNotification'
}
export type Stellar1UiPaymentReviewedPayload = {
  readonly payload: _Stellar1UiPaymentReviewedPayload
  readonly type: 'engine-gen:stellar1UiPaymentReviewed'
}

// All Actions
// prettier-ignore
export type Actions =
  | Chat1ChatUiChatAttachmentDownloadDonePayload
  | Chat1ChatUiChatAttachmentDownloadProgressPayload
  | Chat1ChatUiChatAttachmentDownloadStartPayload
  | Chat1ChatUiChatCoinFlipStatusPayload
  | Chat1ChatUiChatCommandMarkdownPayload
  | Chat1ChatUiChatConfirmChannelDeletePayload
  | Chat1ChatUiChatGiphySearchResultsPayload
  | Chat1ChatUiChatGiphyToggleResultWindowPayload
  | Chat1ChatUiChatInboxConversationPayload
  | Chat1ChatUiChatInboxFailedPayload
  | Chat1ChatUiChatInboxUnverifiedPayload
  | Chat1ChatUiChatLoadGalleryHitPayload
  | Chat1ChatUiChatMaybeMentionUpdatePayload
  | Chat1ChatUiChatSearchConvHitsPayload
  | Chat1ChatUiChatSearchDonePayload
  | Chat1ChatUiChatSearchHitPayload
  | Chat1ChatUiChatSearchInboxDonePayload
  | Chat1ChatUiChatSearchInboxHitPayload
  | Chat1ChatUiChatSearchInboxStartPayload
  | Chat1ChatUiChatSearchIndexStatusPayload
  | Chat1ChatUiChatShowManageChannelsPayload
  | Chat1ChatUiChatStellarDataConfirmPayload
  | Chat1ChatUiChatStellarDataErrorPayload
  | Chat1ChatUiChatStellarDonePayload
  | Chat1ChatUiChatStellarShowConfirmPayload
  | Chat1ChatUiChatThreadCachedPayload
  | Chat1ChatUiChatThreadFullPayload
  | Chat1NotifyChatChatAttachmentUploadProgressPayload
  | Chat1NotifyChatChatAttachmentUploadStartPayload
  | Chat1NotifyChatChatIdentifyUpdatePayload
  | Chat1NotifyChatChatInboxStalePayload
  | Chat1NotifyChatChatInboxSyncStartedPayload
  | Chat1NotifyChatChatInboxSyncedPayload
  | Chat1NotifyChatChatJoinedConversationPayload
  | Chat1NotifyChatChatKBFSToImpteamUpgradePayload
  | Chat1NotifyChatChatLeftConversationPayload
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
  | Chat1NotifyChatNewChatActivityPayload
  | ConnectedPayload
  | DisconnectedPayload
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
  | Keybase1LoginUiDisplayPaperKeyPhrasePayload
  | Keybase1LoginUiDisplayPrimaryPaperKeyPayload
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
  | Keybase1NotifyFSFSActivityPayload
  | Keybase1NotifyFSFSEditListResponsePayload
  | Keybase1NotifyFSFSFavoritesChangedPayload
  | Keybase1NotifyFSFSOnlineStatusChangedPayload
  | Keybase1NotifyFSFSOverallSyncStatusChangedPayload
  | Keybase1NotifyFSFSPathUpdatedPayload
  | Keybase1NotifyFSFSSyncActivityPayload
  | Keybase1NotifyFSFSSyncStatusResponsePayload
  | Keybase1NotifyFavoritesFavoritesChangedPayload
  | Keybase1NotifyKeyfamilyKeyfamilyChangedPayload
  | Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload
  | Keybase1NotifyPaperKeyPaperKeyCachedPayload
  | Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload
  | Keybase1NotifyServiceShutdownPayload
  | Keybase1NotifySessionClientOutOfDatePayload
  | Keybase1NotifySessionLoggedInPayload
  | Keybase1NotifySessionLoggedOutPayload
  | Keybase1NotifyTeamAvatarUpdatedPayload
  | Keybase1NotifyTeamNewlyAddedToTeamPayload
  | Keybase1NotifyTeamTeamAbandonedPayload
  | Keybase1NotifyTeamTeamChangedByIDPayload
  | Keybase1NotifyTeamTeamChangedByNamePayload
  | Keybase1NotifyTeamTeamDeletedPayload
  | Keybase1NotifyTeamTeamExitPayload
  | Keybase1NotifyTrackingTrackingChangedPayload
  | Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload
  | Keybase1NotifyUsersPasswordChangedPayload
  | Keybase1NotifyUsersUserChangedPayload
  | Keybase1PgpUiFinishedPayload
  | Keybase1PgpUiKeyGeneratedPayload
  | Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload
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
  | {type: 'common:resetStore', payload: null}
