// @flow
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
export const chat1ChatUiChatAttachmentDownloadProgress = 'engine-gen:chat1ChatUiChatAttachmentDownloadProgress'
export const chat1ChatUiChatAttachmentDownloadStart = 'engine-gen:chat1ChatUiChatAttachmentDownloadStart'
export const chat1ChatUiChatConfirmChannelDelete = 'engine-gen:chat1ChatUiChatConfirmChannelDelete'
export const chat1ChatUiChatInboxConversation = 'engine-gen:chat1ChatUiChatInboxConversation'
export const chat1ChatUiChatInboxFailed = 'engine-gen:chat1ChatUiChatInboxFailed'
export const chat1ChatUiChatInboxUnverified = 'engine-gen:chat1ChatUiChatInboxUnverified'
export const chat1ChatUiChatSearchDone = 'engine-gen:chat1ChatUiChatSearchDone'
export const chat1ChatUiChatSearchHit = 'engine-gen:chat1ChatUiChatSearchHit'
export const chat1ChatUiChatSearchInboxDone = 'engine-gen:chat1ChatUiChatSearchInboxDone'
export const chat1ChatUiChatSearchInboxHit = 'engine-gen:chat1ChatUiChatSearchInboxHit'
export const chat1ChatUiChatSearchIndexStatus = 'engine-gen:chat1ChatUiChatSearchIndexStatus'
export const chat1ChatUiChatShowManageChannels = 'engine-gen:chat1ChatUiChatShowManageChannels'
export const chat1ChatUiChatStellarDataConfirm = 'engine-gen:chat1ChatUiChatStellarDataConfirm'
export const chat1ChatUiChatStellarDataError = 'engine-gen:chat1ChatUiChatStellarDataError'
export const chat1ChatUiChatStellarDone = 'engine-gen:chat1ChatUiChatStellarDone'
export const chat1ChatUiChatStellarShowConfirm = 'engine-gen:chat1ChatUiChatStellarShowConfirm'
export const chat1ChatUiChatThreadCached = 'engine-gen:chat1ChatUiChatThreadCached'
export const chat1ChatUiChatThreadFull = 'engine-gen:chat1ChatUiChatThreadFull'
export const chat1NotifyChatChatAttachmentUploadProgress = 'engine-gen:chat1NotifyChatChatAttachmentUploadProgress'
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
export const keybase1GpgUiConfirmDuplicateKeyChosen = 'engine-gen:keybase1GpgUiConfirmDuplicateKeyChosen'
export const keybase1GpgUiConfirmImportSecretToExistingKey = 'engine-gen:keybase1GpgUiConfirmImportSecretToExistingKey'
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
export const keybase1Identify3UiIdentify3TrackerTimedOut = 'engine-gen:keybase1Identify3UiIdentify3TrackerTimedOut'
export const keybase1Identify3UiIdentify3UpdateRow = 'engine-gen:keybase1Identify3UiIdentify3UpdateRow'
export const keybase1Identify3UiIdentify3UpdateUserCard = 'engine-gen:keybase1Identify3UiIdentify3UpdateUserCard'
export const keybase1Identify3UiIdentify3UserReset = 'engine-gen:keybase1Identify3UiIdentify3UserReset'
export const keybase1IdentifyUiCancel = 'engine-gen:keybase1IdentifyUiCancel'
export const keybase1IdentifyUiConfirm = 'engine-gen:keybase1IdentifyUiConfirm'
export const keybase1IdentifyUiDelegateIdentifyUI = 'engine-gen:keybase1IdentifyUiDelegateIdentifyUI'
export const keybase1IdentifyUiDismiss = 'engine-gen:keybase1IdentifyUiDismiss'
export const keybase1IdentifyUiDisplayCryptocurrency = 'engine-gen:keybase1IdentifyUiDisplayCryptocurrency'
export const keybase1IdentifyUiDisplayKey = 'engine-gen:keybase1IdentifyUiDisplayKey'
export const keybase1IdentifyUiDisplayStellarAccount = 'engine-gen:keybase1IdentifyUiDisplayStellarAccount'
export const keybase1IdentifyUiDisplayTLFCreateWithInvite = 'engine-gen:keybase1IdentifyUiDisplayTLFCreateWithInvite'
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
export const keybase1LoginUiGetEmailOrUsername = 'engine-gen:keybase1LoginUiGetEmailOrUsername'
export const keybase1LoginUiPromptRevokePaperKeys = 'engine-gen:keybase1LoginUiPromptRevokePaperKeys'
export const keybase1LogsendPrepareLogsend = 'engine-gen:keybase1LogsendPrepareLogsend'
export const keybase1NotifyAppExit = 'engine-gen:keybase1NotifyAppExit'
export const keybase1NotifyBadgesBadgeState = 'engine-gen:keybase1NotifyBadgesBadgeState'
export const keybase1NotifyCanUserPerformCanUserPerformChanged = 'engine-gen:keybase1NotifyCanUserPerformCanUserPerformChanged'
export const keybase1NotifyDeviceCloneDeviceCloneCountChanged = 'engine-gen:keybase1NotifyDeviceCloneDeviceCloneCountChanged'
export const keybase1NotifyEphemeralNewTeamEk = 'engine-gen:keybase1NotifyEphemeralNewTeamEk'
export const keybase1NotifyFSFSActivity = 'engine-gen:keybase1NotifyFSFSActivity'
export const keybase1NotifyFSFSEditListResponse = 'engine-gen:keybase1NotifyFSFSEditListResponse'
export const keybase1NotifyFSFSPathUpdated = 'engine-gen:keybase1NotifyFSFSPathUpdated'
export const keybase1NotifyFSFSSyncActivity = 'engine-gen:keybase1NotifyFSFSSyncActivity'
export const keybase1NotifyFSFSSyncStatusResponse = 'engine-gen:keybase1NotifyFSFSSyncStatusResponse'
export const keybase1NotifyFavoritesFavoritesChanged = 'engine-gen:keybase1NotifyFavoritesFavoritesChanged'
export const keybase1NotifyKeyfamilyKeyfamilyChanged = 'engine-gen:keybase1NotifyKeyfamilyKeyfamilyChanged'
export const keybase1NotifyPGPPgpKeyInSecretStoreFile = 'engine-gen:keybase1NotifyPGPPgpKeyInSecretStoreFile'
export const keybase1NotifyPaperKeyPaperKeyCached = 'engine-gen:keybase1NotifyPaperKeyPaperKeyCached'
export const keybase1NotifyPhoneNumberPhoneNumberAdded = 'engine-gen:keybase1NotifyPhoneNumberPhoneNumberAdded'
export const keybase1NotifyPhoneNumberPhoneNumberSuperseded = 'engine-gen:keybase1NotifyPhoneNumberPhoneNumberSuperseded'
export const keybase1NotifyPhoneNumberPhoneNumberVerified = 'engine-gen:keybase1NotifyPhoneNumberPhoneNumberVerified'
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
export const keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged = 'engine-gen:keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged'
export const keybase1NotifyUsersPasswordChanged = 'engine-gen:keybase1NotifyUsersPasswordChanged'
export const keybase1NotifyUsersUserChanged = 'engine-gen:keybase1NotifyUsersUserChanged'
export const keybase1PgpUiFinished = 'engine-gen:keybase1PgpUiFinished'
export const keybase1PgpUiKeyGenerated = 'engine-gen:keybase1PgpUiKeyGenerated'
export const keybase1PgpUiOutputSignatureSuccess = 'engine-gen:keybase1PgpUiOutputSignatureSuccess'
export const keybase1PgpUiOutputSignatureSuccessNonKeybase = 'engine-gen:keybase1PgpUiOutputSignatureSuccessNonKeybase'
export const keybase1PgpUiShouldPushPrivate = 'engine-gen:keybase1PgpUiShouldPushPrivate'
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
export const keybase1ProvisionUiChooseProvisioningMethod = 'engine-gen:keybase1ProvisionUiChooseProvisioningMethod'
export const keybase1ProvisionUiDisplayAndPromptSecret = 'engine-gen:keybase1ProvisionUiDisplayAndPromptSecret'
export const keybase1ProvisionUiDisplaySecretExchanged = 'engine-gen:keybase1ProvisionUiDisplaySecretExchanged'
export const keybase1ProvisionUiPromptNewDeviceName = 'engine-gen:keybase1ProvisionUiPromptNewDeviceName'
export const keybase1ProvisionUiProvisioneeSuccess = 'engine-gen:keybase1ProvisionUiProvisioneeSuccess'
export const keybase1ProvisionUiProvisionerSuccess = 'engine-gen:keybase1ProvisionUiProvisionerSuccess'
export const keybase1ProvisionUiSwitchToGPGSignOK = 'engine-gen:keybase1ProvisionUiSwitchToGPGSignOK'
export const keybase1ReachabilityReachabilityChanged = 'engine-gen:keybase1ReachabilityReachabilityChanged'
export const keybase1RekeyUIDelegateRekeyUI = 'engine-gen:keybase1RekeyUIDelegateRekeyUI'
export const keybase1RekeyUIRefresh = 'engine-gen:keybase1RekeyUIRefresh'
export const keybase1RekeyUIRekeySendEvent = 'engine-gen:keybase1RekeyUIRekeySendEvent'
export const keybase1SaltpackUiSaltpackPromptForDecrypt = 'engine-gen:keybase1SaltpackUiSaltpackPromptForDecrypt'
export const keybase1SaltpackUiSaltpackVerifyBadSender = 'engine-gen:keybase1SaltpackUiSaltpackVerifyBadSender'
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
type _Chat1ChatUiChatAttachmentDownloadDonePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatAttachmentDownloadDone'>, 'inParam'>>|}>
type _Chat1ChatUiChatAttachmentDownloadProgressPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatAttachmentDownloadProgress'>, 'inParam'>>|}>
type _Chat1ChatUiChatAttachmentDownloadStartPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatAttachmentDownloadStart'>, 'inParam'>>|}>
type _Chat1ChatUiChatConfirmChannelDeletePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatConfirmChannelDelete'>, 'inParam'>>|}>
type _Chat1ChatUiChatInboxConversationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatInboxConversation'>, 'inParam'>>|}>
type _Chat1ChatUiChatInboxFailedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatInboxFailed'>, 'inParam'>>|}>
type _Chat1ChatUiChatInboxUnverifiedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatInboxUnverified'>, 'inParam'>>|}>
type _Chat1ChatUiChatSearchDonePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatSearchDone'>, 'inParam'>>|}>
type _Chat1ChatUiChatSearchHitPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatSearchHit'>, 'inParam'>>|}>
type _Chat1ChatUiChatSearchInboxDonePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatSearchInboxDone'>, 'inParam'>>|}>
type _Chat1ChatUiChatSearchInboxHitPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatSearchInboxHit'>, 'inParam'>>|}>
type _Chat1ChatUiChatSearchIndexStatusPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatSearchIndexStatus'>, 'inParam'>>|}>
type _Chat1ChatUiChatShowManageChannelsPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatShowManageChannels'>, 'inParam'>>|}>
type _Chat1ChatUiChatStellarDataConfirmPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatStellarDataConfirm'>, 'inParam'>>|}>
type _Chat1ChatUiChatStellarDataErrorPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatStellarDataError'>, 'inParam'>>|}>
type _Chat1ChatUiChatStellarDonePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatStellarDone'>, 'inParam'>>|}>
type _Chat1ChatUiChatStellarShowConfirmPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatStellarShowConfirm'>, 'inParam'>>|}>
type _Chat1ChatUiChatThreadCachedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatThreadCached'>, 'inParam'>>|}>
type _Chat1ChatUiChatThreadFullPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.chatUi.chatThreadFull'>, 'inParam'>>|}>
type _Chat1NotifyChatChatAttachmentUploadProgressPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatAttachmentUploadProgress'>, 'inParam'>>|}>
type _Chat1NotifyChatChatAttachmentUploadStartPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatAttachmentUploadStart'>, 'inParam'>>|}>
type _Chat1NotifyChatChatIdentifyUpdatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatIdentifyUpdate'>, 'inParam'>>|}>
type _Chat1NotifyChatChatInboxStalePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatInboxStale'>, 'inParam'>>|}>
type _Chat1NotifyChatChatInboxSyncStartedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatInboxSyncStarted'>, 'inParam'>>|}>
type _Chat1NotifyChatChatInboxSyncedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatInboxSynced'>, 'inParam'>>|}>
type _Chat1NotifyChatChatJoinedConversationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatJoinedConversation'>, 'inParam'>>|}>
type _Chat1NotifyChatChatKBFSToImpteamUpgradePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatKBFSToImpteamUpgrade'>, 'inParam'>>|}>
type _Chat1NotifyChatChatLeftConversationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatLeftConversation'>, 'inParam'>>|}>
type _Chat1NotifyChatChatPaymentInfoPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatPaymentInfo'>, 'inParam'>>|}>
type _Chat1NotifyChatChatPromptUnfurlPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatPromptUnfurl'>, 'inParam'>>|}>
type _Chat1NotifyChatChatRequestInfoPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatRequestInfo'>, 'inParam'>>|}>
type _Chat1NotifyChatChatResetConversationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatResetConversation'>, 'inParam'>>|}>
type _Chat1NotifyChatChatSetConvRetentionPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatSetConvRetention'>, 'inParam'>>|}>
type _Chat1NotifyChatChatSetConvSettingsPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatSetConvSettings'>, 'inParam'>>|}>
type _Chat1NotifyChatChatSetTeamRetentionPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatSetTeamRetention'>, 'inParam'>>|}>
type _Chat1NotifyChatChatSubteamRenamePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatSubteamRename'>, 'inParam'>>|}>
type _Chat1NotifyChatChatTLFFinalizePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatTLFFinalize'>, 'inParam'>>|}>
type _Chat1NotifyChatChatTLFResolvePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatTLFResolve'>, 'inParam'>>|}>
type _Chat1NotifyChatChatThreadsStalePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatThreadsStale'>, 'inParam'>>|}>
type _Chat1NotifyChatChatTypingUpdatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.ChatTypingUpdate'>, 'inParam'>>|}>
type _Chat1NotifyChatNewChatActivityPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<chat1Types.MessageTypes, 'chat.1.NotifyChat.NewChatActivity'>, 'inParam'>>|}>
type _Keybase1GpgUiConfirmDuplicateKeyChosenPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.confirmDuplicateKeyChosen'>, 'inParam'>>|}>
type _Keybase1GpgUiConfirmImportSecretToExistingKeyPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.confirmImportSecretToExistingKey'>, 'inParam'>>|}>
type _Keybase1GpgUiGetTTYPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.getTTY'>, 'inParam'>>|}>
type _Keybase1GpgUiSelectKeyAndPushOptionPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.selectKeyAndPushOption'>, 'inParam'>>|}>
type _Keybase1GpgUiSelectKeyPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.selectKey'>, 'inParam'>>|}>
type _Keybase1GpgUiSignPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.sign'>, 'inParam'>>|}>
type _Keybase1GpgUiWantToAddGPGKeyPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gpgUi.wantToAddGPGKey'>, 'inParam'>>|}>
type _Keybase1GregorUIPushOutOfBandMessagesPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gregorUI.pushOutOfBandMessages'>, 'inParam'>>|}>
type _Keybase1GregorUIPushStatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.gregorUI.pushState'>, 'inParam'>>|}>
type _Keybase1HomeUIHomeUIRefreshPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.homeUI.homeUIRefresh'>, 'inParam'>>|}>
type _Keybase1Identify3UiIdentify3ResultPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identify3Ui.identify3Result'>, 'inParam'>>|}>
type _Keybase1Identify3UiIdentify3ShowTrackerPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identify3Ui.identify3ShowTracker'>, 'inParam'>>|}>
type _Keybase1Identify3UiIdentify3TrackerTimedOutPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identify3Ui.identify3TrackerTimedOut'>, 'inParam'>>|}>
type _Keybase1Identify3UiIdentify3UpdateRowPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identify3Ui.identify3UpdateRow'>, 'inParam'>>|}>
type _Keybase1Identify3UiIdentify3UpdateUserCardPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identify3Ui.identify3UpdateUserCard'>, 'inParam'>>|}>
type _Keybase1Identify3UiIdentify3UserResetPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identify3Ui.identify3UserReset'>, 'inParam'>>|}>
type _Keybase1IdentifyUiCancelPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.cancel'>, 'inParam'>>|}>
type _Keybase1IdentifyUiConfirmPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.confirm'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDelegateIdentifyUIPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.delegateIdentifyUI'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDismissPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.dismiss'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDisplayCryptocurrencyPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.displayCryptocurrency'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDisplayKeyPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.displayKey'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDisplayStellarAccountPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.displayStellarAccount'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.displayTLFCreateWithInvite'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDisplayTrackStatementPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.displayTrackStatement'>, 'inParam'>>|}>
type _Keybase1IdentifyUiDisplayUserCardPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.displayUserCard'>, 'inParam'>>|}>
type _Keybase1IdentifyUiFinishPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.finish'>, 'inParam'>>|}>
type _Keybase1IdentifyUiFinishSocialProofCheckPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.finishSocialProofCheck'>, 'inParam'>>|}>
type _Keybase1IdentifyUiFinishWebProofCheckPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.finishWebProofCheck'>, 'inParam'>>|}>
type _Keybase1IdentifyUiLaunchNetworkChecksPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.launchNetworkChecks'>, 'inParam'>>|}>
type _Keybase1IdentifyUiReportLastTrackPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.reportLastTrack'>, 'inParam'>>|}>
type _Keybase1IdentifyUiReportTrackTokenPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.reportTrackToken'>, 'inParam'>>|}>
type _Keybase1IdentifyUiStartPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.identifyUi.start'>, 'inParam'>>|}>
type _Keybase1LogUiLogPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.logUi.log'>, 'inParam'>>|}>
type _Keybase1LoginUiDisplayPaperKeyPhrasePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.loginUi.displayPaperKeyPhrase'>, 'inParam'>>|}>
type _Keybase1LoginUiDisplayPrimaryPaperKeyPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.loginUi.displayPrimaryPaperKey'>, 'inParam'>>|}>
type _Keybase1LoginUiGetEmailOrUsernamePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.loginUi.getEmailOrUsername'>, 'inParam'>>|}>
type _Keybase1LoginUiPromptRevokePaperKeysPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.loginUi.promptRevokePaperKeys'>, 'inParam'>>|}>
type _Keybase1LogsendPrepareLogsendPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.logsend.prepareLogsend'>, 'inParam'>>|}>
type _Keybase1NotifyAppExitPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyApp.exit'>, 'inParam'>>|}>
type _Keybase1NotifyBadgesBadgeStatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyBadges.badgeState'>, 'inParam'>>|}>
type _Keybase1NotifyCanUserPerformCanUserPerformChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyCanUserPerform.canUserPerformChanged'>, 'inParam'>>|}>
type _Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyDeviceClone.deviceCloneCountChanged'>, 'inParam'>>|}>
type _Keybase1NotifyEphemeralNewTeamEkPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyEphemeral.newTeamEk'>, 'inParam'>>|}>
type _Keybase1NotifyFSFSActivityPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyFS.FSActivity'>, 'inParam'>>|}>
type _Keybase1NotifyFSFSEditListResponsePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyFS.FSEditListResponse'>, 'inParam'>>|}>
type _Keybase1NotifyFSFSPathUpdatedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyFS.FSPathUpdated'>, 'inParam'>>|}>
type _Keybase1NotifyFSFSSyncActivityPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyFS.FSSyncActivity'>, 'inParam'>>|}>
type _Keybase1NotifyFSFSSyncStatusResponsePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyFS.FSSyncStatusResponse'>, 'inParam'>>|}>
type _Keybase1NotifyFavoritesFavoritesChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyFavorites.favoritesChanged'>, 'inParam'>>|}>
type _Keybase1NotifyKeyfamilyKeyfamilyChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyKeyfamily.keyfamilyChanged'>, 'inParam'>>|}>
type _Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile'>, 'inParam'>>|}>
type _Keybase1NotifyPaperKeyPaperKeyCachedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyPaperKey.paperKeyCached'>, 'inParam'>>|}>
type _Keybase1NotifyPhoneNumberPhoneNumberAddedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyPhoneNumber.phoneNumberAdded'>, 'inParam'>>|}>
type _Keybase1NotifyPhoneNumberPhoneNumberSupersededPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyPhoneNumber.phoneNumberSuperseded'>, 'inParam'>>|}>
type _Keybase1NotifyPhoneNumberPhoneNumberVerifiedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyPhoneNumber.phoneNumberVerified'>, 'inParam'>>|}>
type _Keybase1NotifyServiceShutdownPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyService.shutdown'>, 'inParam'>>|}>
type _Keybase1NotifySessionClientOutOfDatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifySession.clientOutOfDate'>, 'inParam'>>|}>
type _Keybase1NotifySessionLoggedInPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifySession.loggedIn'>, 'inParam'>>|}>
type _Keybase1NotifySessionLoggedOutPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifySession.loggedOut'>, 'inParam'>>|}>
type _Keybase1NotifyTeamAvatarUpdatedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.avatarUpdated'>, 'inParam'>>|}>
type _Keybase1NotifyTeamNewlyAddedToTeamPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.newlyAddedToTeam'>, 'inParam'>>|}>
type _Keybase1NotifyTeamTeamAbandonedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.teamAbandoned'>, 'inParam'>>|}>
type _Keybase1NotifyTeamTeamChangedByIDPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.teamChangedByID'>, 'inParam'>>|}>
type _Keybase1NotifyTeamTeamChangedByNamePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.teamChangedByName'>, 'inParam'>>|}>
type _Keybase1NotifyTeamTeamDeletedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.teamDeleted'>, 'inParam'>>|}>
type _Keybase1NotifyTeamTeamExitPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTeam.teamExit'>, 'inParam'>>|}>
type _Keybase1NotifyTrackingTrackingChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyTracking.trackingChanged'>, 'inParam'>>|}>
type _Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyUnverifiedTeamList.teamListUnverifiedChanged'>, 'inParam'>>|}>
type _Keybase1NotifyUsersPasswordChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyUsers.passwordChanged'>, 'inParam'>>|}>
type _Keybase1NotifyUsersUserChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.NotifyUsers.userChanged'>, 'inParam'>>|}>
type _Keybase1PgpUiFinishedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.pgpUi.finished'>, 'inParam'>>|}>
type _Keybase1PgpUiKeyGeneratedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.pgpUi.keyGenerated'>, 'inParam'>>|}>
type _Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.pgpUi.outputSignatureSuccessNonKeybase'>, 'inParam'>>|}>
type _Keybase1PgpUiOutputSignatureSuccessPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.pgpUi.outputSignatureSuccess'>, 'inParam'>>|}>
type _Keybase1PgpUiShouldPushPrivatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.pgpUi.shouldPushPrivate'>, 'inParam'>>|}>
type _Keybase1ProveUiDisplayRecheckWarningPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.displayRecheckWarning'>, 'inParam'>>|}>
type _Keybase1ProveUiOkToCheckPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.okToCheck'>, 'inParam'>>|}>
type _Keybase1ProveUiOutputInstructionsPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.outputInstructions'>, 'inParam'>>|}>
type _Keybase1ProveUiOutputPrechecksPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.outputPrechecks'>, 'inParam'>>|}>
type _Keybase1ProveUiPreProofWarningPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.preProofWarning'>, 'inParam'>>|}>
type _Keybase1ProveUiPromptOverwritePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.promptOverwrite'>, 'inParam'>>|}>
type _Keybase1ProveUiPromptUsernamePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.proveUi.promptUsername'>, 'inParam'>>|}>
type _Keybase1ProvisionUiChooseDevicePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.chooseDevice'>, 'inParam'>>|}>
type _Keybase1ProvisionUiChooseDeviceTypePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.chooseDeviceType'>, 'inParam'>>|}>
type _Keybase1ProvisionUiChooseGPGMethodPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.chooseGPGMethod'>, 'inParam'>>|}>
type _Keybase1ProvisionUiChooseProvisioningMethodPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.chooseProvisioningMethod'>, 'inParam'>>|}>
type _Keybase1ProvisionUiDisplayAndPromptSecretPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.DisplayAndPromptSecret'>, 'inParam'>>|}>
type _Keybase1ProvisionUiDisplaySecretExchangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.DisplaySecretExchanged'>, 'inParam'>>|}>
type _Keybase1ProvisionUiPromptNewDeviceNamePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.PromptNewDeviceName'>, 'inParam'>>|}>
type _Keybase1ProvisionUiProvisioneeSuccessPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.ProvisioneeSuccess'>, 'inParam'>>|}>
type _Keybase1ProvisionUiProvisionerSuccessPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.ProvisionerSuccess'>, 'inParam'>>|}>
type _Keybase1ProvisionUiSwitchToGPGSignOKPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.provisionUi.switchToGPGSignOK'>, 'inParam'>>|}>
type _Keybase1ReachabilityReachabilityChangedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.reachability.reachabilityChanged'>, 'inParam'>>|}>
type _Keybase1RekeyUIDelegateRekeyUIPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.rekeyUI.delegateRekeyUI'>, 'inParam'>>|}>
type _Keybase1RekeyUIRefreshPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.rekeyUI.refresh'>, 'inParam'>>|}>
type _Keybase1RekeyUIRekeySendEventPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.rekeyUI.rekeySendEvent'>, 'inParam'>>|}>
type _Keybase1SaltpackUiSaltpackPromptForDecryptPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.saltpackUi.saltpackPromptForDecrypt'>, 'inParam'>>|}>
type _Keybase1SaltpackUiSaltpackVerifyBadSenderPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.saltpackUi.saltpackVerifyBadSender'>, 'inParam'>>|}>
type _Keybase1SaltpackUiSaltpackVerifySuccessPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.saltpackUi.saltpackVerifySuccess'>, 'inParam'>>|}>
type _Keybase1SecretUiGetPassphrasePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.secretUi.getPassphrase'>, 'inParam'>>|}>
type _Keybase1StreamUiClosePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.streamUi.close'>, 'inParam'>>|}>
type _Keybase1StreamUiReadPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.streamUi.read'>, 'inParam'>>|}>
type _Keybase1StreamUiResetPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.streamUi.reset'>, 'inParam'>>|}>
type _Keybase1StreamUiWritePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.streamUi.write'>, 'inParam'>>|}>
type _Keybase1TeamsUiConfirmRootTeamDeletePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.teamsUi.confirmRootTeamDelete'>, 'inParam'>>|}>
type _Keybase1TeamsUiConfirmSubteamDeletePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.teamsUi.confirmSubteamDelete'>, 'inParam'>>|}>
type _Keybase1UiPromptYesNoPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<keybase1Types.MessageTypes, 'keybase.1.ui.promptYesNo'>, 'inParam'>>|}>
type _Stellar1NotifyAccountDetailsUpdatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.accountDetailsUpdate'>, 'inParam'>>|}>
type _Stellar1NotifyAccountsUpdatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.accountsUpdate'>, 'inParam'>>|}>
type _Stellar1NotifyPaymentNotificationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.paymentNotification'>, 'inParam'>>|}>
type _Stellar1NotifyPaymentStatusNotificationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.paymentStatusNotification'>, 'inParam'>>|}>
type _Stellar1NotifyPendingPaymentsUpdatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.pendingPaymentsUpdate'>, 'inParam'>>|}>
type _Stellar1NotifyRecentPaymentsUpdatePayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.recentPaymentsUpdate'>, 'inParam'>>|}>
type _Stellar1NotifyRequestStatusNotificationPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.notify.requestStatusNotification'>, 'inParam'>>|}>
type _Stellar1UiPaymentReviewedPayload = $ReadOnly<{|params: $Exact<$PropertyType<$PropertyType<stellar1Types.MessageTypes, 'stellar.1.ui.paymentReviewed'>, 'inParam'>>|}>

// Action Creators
export const createChat1ChatUiChatAttachmentDownloadDone = (payload: _Chat1ChatUiChatAttachmentDownloadDonePayload) => ({payload, type: chat1ChatUiChatAttachmentDownloadDone})
export const createChat1ChatUiChatAttachmentDownloadProgress = (payload: _Chat1ChatUiChatAttachmentDownloadProgressPayload) => ({payload, type: chat1ChatUiChatAttachmentDownloadProgress})
export const createChat1ChatUiChatAttachmentDownloadStart = (payload: _Chat1ChatUiChatAttachmentDownloadStartPayload) => ({payload, type: chat1ChatUiChatAttachmentDownloadStart})
export const createChat1ChatUiChatConfirmChannelDelete = (payload: _Chat1ChatUiChatConfirmChannelDeletePayload) => ({payload, type: chat1ChatUiChatConfirmChannelDelete})
export const createChat1ChatUiChatInboxConversation = (payload: _Chat1ChatUiChatInboxConversationPayload) => ({payload, type: chat1ChatUiChatInboxConversation})
export const createChat1ChatUiChatInboxFailed = (payload: _Chat1ChatUiChatInboxFailedPayload) => ({payload, type: chat1ChatUiChatInboxFailed})
export const createChat1ChatUiChatInboxUnverified = (payload: _Chat1ChatUiChatInboxUnverifiedPayload) => ({payload, type: chat1ChatUiChatInboxUnverified})
export const createChat1ChatUiChatSearchDone = (payload: _Chat1ChatUiChatSearchDonePayload) => ({payload, type: chat1ChatUiChatSearchDone})
export const createChat1ChatUiChatSearchHit = (payload: _Chat1ChatUiChatSearchHitPayload) => ({payload, type: chat1ChatUiChatSearchHit})
export const createChat1ChatUiChatSearchInboxDone = (payload: _Chat1ChatUiChatSearchInboxDonePayload) => ({payload, type: chat1ChatUiChatSearchInboxDone})
export const createChat1ChatUiChatSearchInboxHit = (payload: _Chat1ChatUiChatSearchInboxHitPayload) => ({payload, type: chat1ChatUiChatSearchInboxHit})
export const createChat1ChatUiChatSearchIndexStatus = (payload: _Chat1ChatUiChatSearchIndexStatusPayload) => ({payload, type: chat1ChatUiChatSearchIndexStatus})
export const createChat1ChatUiChatShowManageChannels = (payload: _Chat1ChatUiChatShowManageChannelsPayload) => ({payload, type: chat1ChatUiChatShowManageChannels})
export const createChat1ChatUiChatStellarDataConfirm = (payload: _Chat1ChatUiChatStellarDataConfirmPayload) => ({payload, type: chat1ChatUiChatStellarDataConfirm})
export const createChat1ChatUiChatStellarDataError = (payload: _Chat1ChatUiChatStellarDataErrorPayload) => ({payload, type: chat1ChatUiChatStellarDataError})
export const createChat1ChatUiChatStellarDone = (payload: _Chat1ChatUiChatStellarDonePayload) => ({payload, type: chat1ChatUiChatStellarDone})
export const createChat1ChatUiChatStellarShowConfirm = (payload: _Chat1ChatUiChatStellarShowConfirmPayload) => ({payload, type: chat1ChatUiChatStellarShowConfirm})
export const createChat1ChatUiChatThreadCached = (payload: _Chat1ChatUiChatThreadCachedPayload) => ({payload, type: chat1ChatUiChatThreadCached})
export const createChat1ChatUiChatThreadFull = (payload: _Chat1ChatUiChatThreadFullPayload) => ({payload, type: chat1ChatUiChatThreadFull})
export const createChat1NotifyChatChatAttachmentUploadProgress = (payload: _Chat1NotifyChatChatAttachmentUploadProgressPayload) => ({payload, type: chat1NotifyChatChatAttachmentUploadProgress})
export const createChat1NotifyChatChatAttachmentUploadStart = (payload: _Chat1NotifyChatChatAttachmentUploadStartPayload) => ({payload, type: chat1NotifyChatChatAttachmentUploadStart})
export const createChat1NotifyChatChatIdentifyUpdate = (payload: _Chat1NotifyChatChatIdentifyUpdatePayload) => ({payload, type: chat1NotifyChatChatIdentifyUpdate})
export const createChat1NotifyChatChatInboxStale = (payload: _Chat1NotifyChatChatInboxStalePayload) => ({payload, type: chat1NotifyChatChatInboxStale})
export const createChat1NotifyChatChatInboxSyncStarted = (payload: _Chat1NotifyChatChatInboxSyncStartedPayload) => ({payload, type: chat1NotifyChatChatInboxSyncStarted})
export const createChat1NotifyChatChatInboxSynced = (payload: _Chat1NotifyChatChatInboxSyncedPayload) => ({payload, type: chat1NotifyChatChatInboxSynced})
export const createChat1NotifyChatChatJoinedConversation = (payload: _Chat1NotifyChatChatJoinedConversationPayload) => ({payload, type: chat1NotifyChatChatJoinedConversation})
export const createChat1NotifyChatChatKBFSToImpteamUpgrade = (payload: _Chat1NotifyChatChatKBFSToImpteamUpgradePayload) => ({payload, type: chat1NotifyChatChatKBFSToImpteamUpgrade})
export const createChat1NotifyChatChatLeftConversation = (payload: _Chat1NotifyChatChatLeftConversationPayload) => ({payload, type: chat1NotifyChatChatLeftConversation})
export const createChat1NotifyChatChatPaymentInfo = (payload: _Chat1NotifyChatChatPaymentInfoPayload) => ({payload, type: chat1NotifyChatChatPaymentInfo})
export const createChat1NotifyChatChatPromptUnfurl = (payload: _Chat1NotifyChatChatPromptUnfurlPayload) => ({payload, type: chat1NotifyChatChatPromptUnfurl})
export const createChat1NotifyChatChatRequestInfo = (payload: _Chat1NotifyChatChatRequestInfoPayload) => ({payload, type: chat1NotifyChatChatRequestInfo})
export const createChat1NotifyChatChatResetConversation = (payload: _Chat1NotifyChatChatResetConversationPayload) => ({payload, type: chat1NotifyChatChatResetConversation})
export const createChat1NotifyChatChatSetConvRetention = (payload: _Chat1NotifyChatChatSetConvRetentionPayload) => ({payload, type: chat1NotifyChatChatSetConvRetention})
export const createChat1NotifyChatChatSetConvSettings = (payload: _Chat1NotifyChatChatSetConvSettingsPayload) => ({payload, type: chat1NotifyChatChatSetConvSettings})
export const createChat1NotifyChatChatSetTeamRetention = (payload: _Chat1NotifyChatChatSetTeamRetentionPayload) => ({payload, type: chat1NotifyChatChatSetTeamRetention})
export const createChat1NotifyChatChatSubteamRename = (payload: _Chat1NotifyChatChatSubteamRenamePayload) => ({payload, type: chat1NotifyChatChatSubteamRename})
export const createChat1NotifyChatChatTLFFinalize = (payload: _Chat1NotifyChatChatTLFFinalizePayload) => ({payload, type: chat1NotifyChatChatTLFFinalize})
export const createChat1NotifyChatChatTLFResolve = (payload: _Chat1NotifyChatChatTLFResolvePayload) => ({payload, type: chat1NotifyChatChatTLFResolve})
export const createChat1NotifyChatChatThreadsStale = (payload: _Chat1NotifyChatChatThreadsStalePayload) => ({payload, type: chat1NotifyChatChatThreadsStale})
export const createChat1NotifyChatChatTypingUpdate = (payload: _Chat1NotifyChatChatTypingUpdatePayload) => ({payload, type: chat1NotifyChatChatTypingUpdate})
export const createChat1NotifyChatNewChatActivity = (payload: _Chat1NotifyChatNewChatActivityPayload) => ({payload, type: chat1NotifyChatNewChatActivity})
export const createKeybase1GpgUiConfirmDuplicateKeyChosen = (payload: _Keybase1GpgUiConfirmDuplicateKeyChosenPayload) => ({payload, type: keybase1GpgUiConfirmDuplicateKeyChosen})
export const createKeybase1GpgUiConfirmImportSecretToExistingKey = (payload: _Keybase1GpgUiConfirmImportSecretToExistingKeyPayload) => ({payload, type: keybase1GpgUiConfirmImportSecretToExistingKey})
export const createKeybase1GpgUiGetTTY = (payload: _Keybase1GpgUiGetTTYPayload) => ({payload, type: keybase1GpgUiGetTTY})
export const createKeybase1GpgUiSelectKey = (payload: _Keybase1GpgUiSelectKeyPayload) => ({payload, type: keybase1GpgUiSelectKey})
export const createKeybase1GpgUiSelectKeyAndPushOption = (payload: _Keybase1GpgUiSelectKeyAndPushOptionPayload) => ({payload, type: keybase1GpgUiSelectKeyAndPushOption})
export const createKeybase1GpgUiSign = (payload: _Keybase1GpgUiSignPayload) => ({payload, type: keybase1GpgUiSign})
export const createKeybase1GpgUiWantToAddGPGKey = (payload: _Keybase1GpgUiWantToAddGPGKeyPayload) => ({payload, type: keybase1GpgUiWantToAddGPGKey})
export const createKeybase1GregorUIPushOutOfBandMessages = (payload: _Keybase1GregorUIPushOutOfBandMessagesPayload) => ({payload, type: keybase1GregorUIPushOutOfBandMessages})
export const createKeybase1GregorUIPushState = (payload: _Keybase1GregorUIPushStatePayload) => ({payload, type: keybase1GregorUIPushState})
export const createKeybase1HomeUIHomeUIRefresh = (payload: _Keybase1HomeUIHomeUIRefreshPayload) => ({payload, type: keybase1HomeUIHomeUIRefresh})
export const createKeybase1Identify3UiIdentify3Result = (payload: _Keybase1Identify3UiIdentify3ResultPayload) => ({payload, type: keybase1Identify3UiIdentify3Result})
export const createKeybase1Identify3UiIdentify3ShowTracker = (payload: _Keybase1Identify3UiIdentify3ShowTrackerPayload) => ({payload, type: keybase1Identify3UiIdentify3ShowTracker})
export const createKeybase1Identify3UiIdentify3TrackerTimedOut = (payload: _Keybase1Identify3UiIdentify3TrackerTimedOutPayload) => ({payload, type: keybase1Identify3UiIdentify3TrackerTimedOut})
export const createKeybase1Identify3UiIdentify3UpdateRow = (payload: _Keybase1Identify3UiIdentify3UpdateRowPayload) => ({payload, type: keybase1Identify3UiIdentify3UpdateRow})
export const createKeybase1Identify3UiIdentify3UpdateUserCard = (payload: _Keybase1Identify3UiIdentify3UpdateUserCardPayload) => ({payload, type: keybase1Identify3UiIdentify3UpdateUserCard})
export const createKeybase1Identify3UiIdentify3UserReset = (payload: _Keybase1Identify3UiIdentify3UserResetPayload) => ({payload, type: keybase1Identify3UiIdentify3UserReset})
export const createKeybase1IdentifyUiCancel = (payload: _Keybase1IdentifyUiCancelPayload) => ({payload, type: keybase1IdentifyUiCancel})
export const createKeybase1IdentifyUiConfirm = (payload: _Keybase1IdentifyUiConfirmPayload) => ({payload, type: keybase1IdentifyUiConfirm})
export const createKeybase1IdentifyUiDelegateIdentifyUI = (payload: _Keybase1IdentifyUiDelegateIdentifyUIPayload) => ({payload, type: keybase1IdentifyUiDelegateIdentifyUI})
export const createKeybase1IdentifyUiDismiss = (payload: _Keybase1IdentifyUiDismissPayload) => ({payload, type: keybase1IdentifyUiDismiss})
export const createKeybase1IdentifyUiDisplayCryptocurrency = (payload: _Keybase1IdentifyUiDisplayCryptocurrencyPayload) => ({payload, type: keybase1IdentifyUiDisplayCryptocurrency})
export const createKeybase1IdentifyUiDisplayKey = (payload: _Keybase1IdentifyUiDisplayKeyPayload) => ({payload, type: keybase1IdentifyUiDisplayKey})
export const createKeybase1IdentifyUiDisplayStellarAccount = (payload: _Keybase1IdentifyUiDisplayStellarAccountPayload) => ({payload, type: keybase1IdentifyUiDisplayStellarAccount})
export const createKeybase1IdentifyUiDisplayTLFCreateWithInvite = (payload: _Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload) => ({payload, type: keybase1IdentifyUiDisplayTLFCreateWithInvite})
export const createKeybase1IdentifyUiDisplayTrackStatement = (payload: _Keybase1IdentifyUiDisplayTrackStatementPayload) => ({payload, type: keybase1IdentifyUiDisplayTrackStatement})
export const createKeybase1IdentifyUiDisplayUserCard = (payload: _Keybase1IdentifyUiDisplayUserCardPayload) => ({payload, type: keybase1IdentifyUiDisplayUserCard})
export const createKeybase1IdentifyUiFinish = (payload: _Keybase1IdentifyUiFinishPayload) => ({payload, type: keybase1IdentifyUiFinish})
export const createKeybase1IdentifyUiFinishSocialProofCheck = (payload: _Keybase1IdentifyUiFinishSocialProofCheckPayload) => ({payload, type: keybase1IdentifyUiFinishSocialProofCheck})
export const createKeybase1IdentifyUiFinishWebProofCheck = (payload: _Keybase1IdentifyUiFinishWebProofCheckPayload) => ({payload, type: keybase1IdentifyUiFinishWebProofCheck})
export const createKeybase1IdentifyUiLaunchNetworkChecks = (payload: _Keybase1IdentifyUiLaunchNetworkChecksPayload) => ({payload, type: keybase1IdentifyUiLaunchNetworkChecks})
export const createKeybase1IdentifyUiReportLastTrack = (payload: _Keybase1IdentifyUiReportLastTrackPayload) => ({payload, type: keybase1IdentifyUiReportLastTrack})
export const createKeybase1IdentifyUiReportTrackToken = (payload: _Keybase1IdentifyUiReportTrackTokenPayload) => ({payload, type: keybase1IdentifyUiReportTrackToken})
export const createKeybase1IdentifyUiStart = (payload: _Keybase1IdentifyUiStartPayload) => ({payload, type: keybase1IdentifyUiStart})
export const createKeybase1LogUiLog = (payload: _Keybase1LogUiLogPayload) => ({payload, type: keybase1LogUiLog})
export const createKeybase1LoginUiDisplayPaperKeyPhrase = (payload: _Keybase1LoginUiDisplayPaperKeyPhrasePayload) => ({payload, type: keybase1LoginUiDisplayPaperKeyPhrase})
export const createKeybase1LoginUiDisplayPrimaryPaperKey = (payload: _Keybase1LoginUiDisplayPrimaryPaperKeyPayload) => ({payload, type: keybase1LoginUiDisplayPrimaryPaperKey})
export const createKeybase1LoginUiGetEmailOrUsername = (payload: _Keybase1LoginUiGetEmailOrUsernamePayload) => ({payload, type: keybase1LoginUiGetEmailOrUsername})
export const createKeybase1LoginUiPromptRevokePaperKeys = (payload: _Keybase1LoginUiPromptRevokePaperKeysPayload) => ({payload, type: keybase1LoginUiPromptRevokePaperKeys})
export const createKeybase1LogsendPrepareLogsend = (payload: _Keybase1LogsendPrepareLogsendPayload) => ({payload, type: keybase1LogsendPrepareLogsend})
export const createKeybase1NotifyAppExit = (payload: _Keybase1NotifyAppExitPayload) => ({payload, type: keybase1NotifyAppExit})
export const createKeybase1NotifyBadgesBadgeState = (payload: _Keybase1NotifyBadgesBadgeStatePayload) => ({payload, type: keybase1NotifyBadgesBadgeState})
export const createKeybase1NotifyCanUserPerformCanUserPerformChanged = (payload: _Keybase1NotifyCanUserPerformCanUserPerformChangedPayload) => ({payload, type: keybase1NotifyCanUserPerformCanUserPerformChanged})
export const createKeybase1NotifyDeviceCloneDeviceCloneCountChanged = (payload: _Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload) => ({payload, type: keybase1NotifyDeviceCloneDeviceCloneCountChanged})
export const createKeybase1NotifyEphemeralNewTeamEk = (payload: _Keybase1NotifyEphemeralNewTeamEkPayload) => ({payload, type: keybase1NotifyEphemeralNewTeamEk})
export const createKeybase1NotifyFSFSActivity = (payload: _Keybase1NotifyFSFSActivityPayload) => ({payload, type: keybase1NotifyFSFSActivity})
export const createKeybase1NotifyFSFSEditListResponse = (payload: _Keybase1NotifyFSFSEditListResponsePayload) => ({payload, type: keybase1NotifyFSFSEditListResponse})
export const createKeybase1NotifyFSFSPathUpdated = (payload: _Keybase1NotifyFSFSPathUpdatedPayload) => ({payload, type: keybase1NotifyFSFSPathUpdated})
export const createKeybase1NotifyFSFSSyncActivity = (payload: _Keybase1NotifyFSFSSyncActivityPayload) => ({payload, type: keybase1NotifyFSFSSyncActivity})
export const createKeybase1NotifyFSFSSyncStatusResponse = (payload: _Keybase1NotifyFSFSSyncStatusResponsePayload) => ({payload, type: keybase1NotifyFSFSSyncStatusResponse})
export const createKeybase1NotifyFavoritesFavoritesChanged = (payload: _Keybase1NotifyFavoritesFavoritesChangedPayload) => ({payload, type: keybase1NotifyFavoritesFavoritesChanged})
export const createKeybase1NotifyKeyfamilyKeyfamilyChanged = (payload: _Keybase1NotifyKeyfamilyKeyfamilyChangedPayload) => ({payload, type: keybase1NotifyKeyfamilyKeyfamilyChanged})
export const createKeybase1NotifyPGPPgpKeyInSecretStoreFile = (payload: _Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload) => ({payload, type: keybase1NotifyPGPPgpKeyInSecretStoreFile})
export const createKeybase1NotifyPaperKeyPaperKeyCached = (payload: _Keybase1NotifyPaperKeyPaperKeyCachedPayload) => ({payload, type: keybase1NotifyPaperKeyPaperKeyCached})
export const createKeybase1NotifyPhoneNumberPhoneNumberAdded = (payload: _Keybase1NotifyPhoneNumberPhoneNumberAddedPayload) => ({payload, type: keybase1NotifyPhoneNumberPhoneNumberAdded})
export const createKeybase1NotifyPhoneNumberPhoneNumberSuperseded = (payload: _Keybase1NotifyPhoneNumberPhoneNumberSupersededPayload) => ({payload, type: keybase1NotifyPhoneNumberPhoneNumberSuperseded})
export const createKeybase1NotifyPhoneNumberPhoneNumberVerified = (payload: _Keybase1NotifyPhoneNumberPhoneNumberVerifiedPayload) => ({payload, type: keybase1NotifyPhoneNumberPhoneNumberVerified})
export const createKeybase1NotifyServiceShutdown = (payload: _Keybase1NotifyServiceShutdownPayload) => ({payload, type: keybase1NotifyServiceShutdown})
export const createKeybase1NotifySessionClientOutOfDate = (payload: _Keybase1NotifySessionClientOutOfDatePayload) => ({payload, type: keybase1NotifySessionClientOutOfDate})
export const createKeybase1NotifySessionLoggedIn = (payload: _Keybase1NotifySessionLoggedInPayload) => ({payload, type: keybase1NotifySessionLoggedIn})
export const createKeybase1NotifySessionLoggedOut = (payload: _Keybase1NotifySessionLoggedOutPayload) => ({payload, type: keybase1NotifySessionLoggedOut})
export const createKeybase1NotifyTeamAvatarUpdated = (payload: _Keybase1NotifyTeamAvatarUpdatedPayload) => ({payload, type: keybase1NotifyTeamAvatarUpdated})
export const createKeybase1NotifyTeamNewlyAddedToTeam = (payload: _Keybase1NotifyTeamNewlyAddedToTeamPayload) => ({payload, type: keybase1NotifyTeamNewlyAddedToTeam})
export const createKeybase1NotifyTeamTeamAbandoned = (payload: _Keybase1NotifyTeamTeamAbandonedPayload) => ({payload, type: keybase1NotifyTeamTeamAbandoned})
export const createKeybase1NotifyTeamTeamChangedByID = (payload: _Keybase1NotifyTeamTeamChangedByIDPayload) => ({payload, type: keybase1NotifyTeamTeamChangedByID})
export const createKeybase1NotifyTeamTeamChangedByName = (payload: _Keybase1NotifyTeamTeamChangedByNamePayload) => ({payload, type: keybase1NotifyTeamTeamChangedByName})
export const createKeybase1NotifyTeamTeamDeleted = (payload: _Keybase1NotifyTeamTeamDeletedPayload) => ({payload, type: keybase1NotifyTeamTeamDeleted})
export const createKeybase1NotifyTeamTeamExit = (payload: _Keybase1NotifyTeamTeamExitPayload) => ({payload, type: keybase1NotifyTeamTeamExit})
export const createKeybase1NotifyTrackingTrackingChanged = (payload: _Keybase1NotifyTrackingTrackingChangedPayload) => ({payload, type: keybase1NotifyTrackingTrackingChanged})
export const createKeybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged = (payload: _Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload) => ({payload, type: keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged})
export const createKeybase1NotifyUsersPasswordChanged = (payload: _Keybase1NotifyUsersPasswordChangedPayload) => ({payload, type: keybase1NotifyUsersPasswordChanged})
export const createKeybase1NotifyUsersUserChanged = (payload: _Keybase1NotifyUsersUserChangedPayload) => ({payload, type: keybase1NotifyUsersUserChanged})
export const createKeybase1PgpUiFinished = (payload: _Keybase1PgpUiFinishedPayload) => ({payload, type: keybase1PgpUiFinished})
export const createKeybase1PgpUiKeyGenerated = (payload: _Keybase1PgpUiKeyGeneratedPayload) => ({payload, type: keybase1PgpUiKeyGenerated})
export const createKeybase1PgpUiOutputSignatureSuccess = (payload: _Keybase1PgpUiOutputSignatureSuccessPayload) => ({payload, type: keybase1PgpUiOutputSignatureSuccess})
export const createKeybase1PgpUiOutputSignatureSuccessNonKeybase = (payload: _Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload) => ({payload, type: keybase1PgpUiOutputSignatureSuccessNonKeybase})
export const createKeybase1PgpUiShouldPushPrivate = (payload: _Keybase1PgpUiShouldPushPrivatePayload) => ({payload, type: keybase1PgpUiShouldPushPrivate})
export const createKeybase1ProveUiDisplayRecheckWarning = (payload: _Keybase1ProveUiDisplayRecheckWarningPayload) => ({payload, type: keybase1ProveUiDisplayRecheckWarning})
export const createKeybase1ProveUiOkToCheck = (payload: _Keybase1ProveUiOkToCheckPayload) => ({payload, type: keybase1ProveUiOkToCheck})
export const createKeybase1ProveUiOutputInstructions = (payload: _Keybase1ProveUiOutputInstructionsPayload) => ({payload, type: keybase1ProveUiOutputInstructions})
export const createKeybase1ProveUiOutputPrechecks = (payload: _Keybase1ProveUiOutputPrechecksPayload) => ({payload, type: keybase1ProveUiOutputPrechecks})
export const createKeybase1ProveUiPreProofWarning = (payload: _Keybase1ProveUiPreProofWarningPayload) => ({payload, type: keybase1ProveUiPreProofWarning})
export const createKeybase1ProveUiPromptOverwrite = (payload: _Keybase1ProveUiPromptOverwritePayload) => ({payload, type: keybase1ProveUiPromptOverwrite})
export const createKeybase1ProveUiPromptUsername = (payload: _Keybase1ProveUiPromptUsernamePayload) => ({payload, type: keybase1ProveUiPromptUsername})
export const createKeybase1ProvisionUiChooseDevice = (payload: _Keybase1ProvisionUiChooseDevicePayload) => ({payload, type: keybase1ProvisionUiChooseDevice})
export const createKeybase1ProvisionUiChooseDeviceType = (payload: _Keybase1ProvisionUiChooseDeviceTypePayload) => ({payload, type: keybase1ProvisionUiChooseDeviceType})
export const createKeybase1ProvisionUiChooseGPGMethod = (payload: _Keybase1ProvisionUiChooseGPGMethodPayload) => ({payload, type: keybase1ProvisionUiChooseGPGMethod})
export const createKeybase1ProvisionUiChooseProvisioningMethod = (payload: _Keybase1ProvisionUiChooseProvisioningMethodPayload) => ({payload, type: keybase1ProvisionUiChooseProvisioningMethod})
export const createKeybase1ProvisionUiDisplayAndPromptSecret = (payload: _Keybase1ProvisionUiDisplayAndPromptSecretPayload) => ({payload, type: keybase1ProvisionUiDisplayAndPromptSecret})
export const createKeybase1ProvisionUiDisplaySecretExchanged = (payload: _Keybase1ProvisionUiDisplaySecretExchangedPayload) => ({payload, type: keybase1ProvisionUiDisplaySecretExchanged})
export const createKeybase1ProvisionUiPromptNewDeviceName = (payload: _Keybase1ProvisionUiPromptNewDeviceNamePayload) => ({payload, type: keybase1ProvisionUiPromptNewDeviceName})
export const createKeybase1ProvisionUiProvisioneeSuccess = (payload: _Keybase1ProvisionUiProvisioneeSuccessPayload) => ({payload, type: keybase1ProvisionUiProvisioneeSuccess})
export const createKeybase1ProvisionUiProvisionerSuccess = (payload: _Keybase1ProvisionUiProvisionerSuccessPayload) => ({payload, type: keybase1ProvisionUiProvisionerSuccess})
export const createKeybase1ProvisionUiSwitchToGPGSignOK = (payload: _Keybase1ProvisionUiSwitchToGPGSignOKPayload) => ({payload, type: keybase1ProvisionUiSwitchToGPGSignOK})
export const createKeybase1ReachabilityReachabilityChanged = (payload: _Keybase1ReachabilityReachabilityChangedPayload) => ({payload, type: keybase1ReachabilityReachabilityChanged})
export const createKeybase1RekeyUIDelegateRekeyUI = (payload: _Keybase1RekeyUIDelegateRekeyUIPayload) => ({payload, type: keybase1RekeyUIDelegateRekeyUI})
export const createKeybase1RekeyUIRefresh = (payload: _Keybase1RekeyUIRefreshPayload) => ({payload, type: keybase1RekeyUIRefresh})
export const createKeybase1RekeyUIRekeySendEvent = (payload: _Keybase1RekeyUIRekeySendEventPayload) => ({payload, type: keybase1RekeyUIRekeySendEvent})
export const createKeybase1SaltpackUiSaltpackPromptForDecrypt = (payload: _Keybase1SaltpackUiSaltpackPromptForDecryptPayload) => ({payload, type: keybase1SaltpackUiSaltpackPromptForDecrypt})
export const createKeybase1SaltpackUiSaltpackVerifyBadSender = (payload: _Keybase1SaltpackUiSaltpackVerifyBadSenderPayload) => ({payload, type: keybase1SaltpackUiSaltpackVerifyBadSender})
export const createKeybase1SaltpackUiSaltpackVerifySuccess = (payload: _Keybase1SaltpackUiSaltpackVerifySuccessPayload) => ({payload, type: keybase1SaltpackUiSaltpackVerifySuccess})
export const createKeybase1SecretUiGetPassphrase = (payload: _Keybase1SecretUiGetPassphrasePayload) => ({payload, type: keybase1SecretUiGetPassphrase})
export const createKeybase1StreamUiClose = (payload: _Keybase1StreamUiClosePayload) => ({payload, type: keybase1StreamUiClose})
export const createKeybase1StreamUiRead = (payload: _Keybase1StreamUiReadPayload) => ({payload, type: keybase1StreamUiRead})
export const createKeybase1StreamUiReset = (payload: _Keybase1StreamUiResetPayload) => ({payload, type: keybase1StreamUiReset})
export const createKeybase1StreamUiWrite = (payload: _Keybase1StreamUiWritePayload) => ({payload, type: keybase1StreamUiWrite})
export const createKeybase1TeamsUiConfirmRootTeamDelete = (payload: _Keybase1TeamsUiConfirmRootTeamDeletePayload) => ({payload, type: keybase1TeamsUiConfirmRootTeamDelete})
export const createKeybase1TeamsUiConfirmSubteamDelete = (payload: _Keybase1TeamsUiConfirmSubteamDeletePayload) => ({payload, type: keybase1TeamsUiConfirmSubteamDelete})
export const createKeybase1UiPromptYesNo = (payload: _Keybase1UiPromptYesNoPayload) => ({payload, type: keybase1UiPromptYesNo})
export const createStellar1NotifyAccountDetailsUpdate = (payload: _Stellar1NotifyAccountDetailsUpdatePayload) => ({payload, type: stellar1NotifyAccountDetailsUpdate})
export const createStellar1NotifyAccountsUpdate = (payload: _Stellar1NotifyAccountsUpdatePayload) => ({payload, type: stellar1NotifyAccountsUpdate})
export const createStellar1NotifyPaymentNotification = (payload: _Stellar1NotifyPaymentNotificationPayload) => ({payload, type: stellar1NotifyPaymentNotification})
export const createStellar1NotifyPaymentStatusNotification = (payload: _Stellar1NotifyPaymentStatusNotificationPayload) => ({payload, type: stellar1NotifyPaymentStatusNotification})
export const createStellar1NotifyPendingPaymentsUpdate = (payload: _Stellar1NotifyPendingPaymentsUpdatePayload) => ({payload, type: stellar1NotifyPendingPaymentsUpdate})
export const createStellar1NotifyRecentPaymentsUpdate = (payload: _Stellar1NotifyRecentPaymentsUpdatePayload) => ({payload, type: stellar1NotifyRecentPaymentsUpdate})
export const createStellar1NotifyRequestStatusNotification = (payload: _Stellar1NotifyRequestStatusNotificationPayload) => ({payload, type: stellar1NotifyRequestStatusNotification})
export const createStellar1UiPaymentReviewed = (payload: _Stellar1UiPaymentReviewedPayload) => ({payload, type: stellar1UiPaymentReviewed})

// Action Payloads
export type Chat1ChatUiChatAttachmentDownloadDonePayload = {|+payload: _Chat1ChatUiChatAttachmentDownloadDonePayload, +type: 'engine-gen:chat1ChatUiChatAttachmentDownloadDone'|}
export type Chat1ChatUiChatAttachmentDownloadProgressPayload = {|+payload: _Chat1ChatUiChatAttachmentDownloadProgressPayload, +type: 'engine-gen:chat1ChatUiChatAttachmentDownloadProgress'|}
export type Chat1ChatUiChatAttachmentDownloadStartPayload = {|+payload: _Chat1ChatUiChatAttachmentDownloadStartPayload, +type: 'engine-gen:chat1ChatUiChatAttachmentDownloadStart'|}
export type Chat1ChatUiChatConfirmChannelDeletePayload = {|+payload: _Chat1ChatUiChatConfirmChannelDeletePayload, +type: 'engine-gen:chat1ChatUiChatConfirmChannelDelete'|}
export type Chat1ChatUiChatInboxConversationPayload = {|+payload: _Chat1ChatUiChatInboxConversationPayload, +type: 'engine-gen:chat1ChatUiChatInboxConversation'|}
export type Chat1ChatUiChatInboxFailedPayload = {|+payload: _Chat1ChatUiChatInboxFailedPayload, +type: 'engine-gen:chat1ChatUiChatInboxFailed'|}
export type Chat1ChatUiChatInboxUnverifiedPayload = {|+payload: _Chat1ChatUiChatInboxUnverifiedPayload, +type: 'engine-gen:chat1ChatUiChatInboxUnverified'|}
export type Chat1ChatUiChatSearchDonePayload = {|+payload: _Chat1ChatUiChatSearchDonePayload, +type: 'engine-gen:chat1ChatUiChatSearchDone'|}
export type Chat1ChatUiChatSearchHitPayload = {|+payload: _Chat1ChatUiChatSearchHitPayload, +type: 'engine-gen:chat1ChatUiChatSearchHit'|}
export type Chat1ChatUiChatSearchInboxDonePayload = {|+payload: _Chat1ChatUiChatSearchInboxDonePayload, +type: 'engine-gen:chat1ChatUiChatSearchInboxDone'|}
export type Chat1ChatUiChatSearchInboxHitPayload = {|+payload: _Chat1ChatUiChatSearchInboxHitPayload, +type: 'engine-gen:chat1ChatUiChatSearchInboxHit'|}
export type Chat1ChatUiChatSearchIndexStatusPayload = {|+payload: _Chat1ChatUiChatSearchIndexStatusPayload, +type: 'engine-gen:chat1ChatUiChatSearchIndexStatus'|}
export type Chat1ChatUiChatShowManageChannelsPayload = {|+payload: _Chat1ChatUiChatShowManageChannelsPayload, +type: 'engine-gen:chat1ChatUiChatShowManageChannels'|}
export type Chat1ChatUiChatStellarDataConfirmPayload = {|+payload: _Chat1ChatUiChatStellarDataConfirmPayload, +type: 'engine-gen:chat1ChatUiChatStellarDataConfirm'|}
export type Chat1ChatUiChatStellarDataErrorPayload = {|+payload: _Chat1ChatUiChatStellarDataErrorPayload, +type: 'engine-gen:chat1ChatUiChatStellarDataError'|}
export type Chat1ChatUiChatStellarDonePayload = {|+payload: _Chat1ChatUiChatStellarDonePayload, +type: 'engine-gen:chat1ChatUiChatStellarDone'|}
export type Chat1ChatUiChatStellarShowConfirmPayload = {|+payload: _Chat1ChatUiChatStellarShowConfirmPayload, +type: 'engine-gen:chat1ChatUiChatStellarShowConfirm'|}
export type Chat1ChatUiChatThreadCachedPayload = {|+payload: _Chat1ChatUiChatThreadCachedPayload, +type: 'engine-gen:chat1ChatUiChatThreadCached'|}
export type Chat1ChatUiChatThreadFullPayload = {|+payload: _Chat1ChatUiChatThreadFullPayload, +type: 'engine-gen:chat1ChatUiChatThreadFull'|}
export type Chat1NotifyChatChatAttachmentUploadProgressPayload = {|+payload: _Chat1NotifyChatChatAttachmentUploadProgressPayload, +type: 'engine-gen:chat1NotifyChatChatAttachmentUploadProgress'|}
export type Chat1NotifyChatChatAttachmentUploadStartPayload = {|+payload: _Chat1NotifyChatChatAttachmentUploadStartPayload, +type: 'engine-gen:chat1NotifyChatChatAttachmentUploadStart'|}
export type Chat1NotifyChatChatIdentifyUpdatePayload = {|+payload: _Chat1NotifyChatChatIdentifyUpdatePayload, +type: 'engine-gen:chat1NotifyChatChatIdentifyUpdate'|}
export type Chat1NotifyChatChatInboxStalePayload = {|+payload: _Chat1NotifyChatChatInboxStalePayload, +type: 'engine-gen:chat1NotifyChatChatInboxStale'|}
export type Chat1NotifyChatChatInboxSyncStartedPayload = {|+payload: _Chat1NotifyChatChatInboxSyncStartedPayload, +type: 'engine-gen:chat1NotifyChatChatInboxSyncStarted'|}
export type Chat1NotifyChatChatInboxSyncedPayload = {|+payload: _Chat1NotifyChatChatInboxSyncedPayload, +type: 'engine-gen:chat1NotifyChatChatInboxSynced'|}
export type Chat1NotifyChatChatJoinedConversationPayload = {|+payload: _Chat1NotifyChatChatJoinedConversationPayload, +type: 'engine-gen:chat1NotifyChatChatJoinedConversation'|}
export type Chat1NotifyChatChatKBFSToImpteamUpgradePayload = {|+payload: _Chat1NotifyChatChatKBFSToImpteamUpgradePayload, +type: 'engine-gen:chat1NotifyChatChatKBFSToImpteamUpgrade'|}
export type Chat1NotifyChatChatLeftConversationPayload = {|+payload: _Chat1NotifyChatChatLeftConversationPayload, +type: 'engine-gen:chat1NotifyChatChatLeftConversation'|}
export type Chat1NotifyChatChatPaymentInfoPayload = {|+payload: _Chat1NotifyChatChatPaymentInfoPayload, +type: 'engine-gen:chat1NotifyChatChatPaymentInfo'|}
export type Chat1NotifyChatChatPromptUnfurlPayload = {|+payload: _Chat1NotifyChatChatPromptUnfurlPayload, +type: 'engine-gen:chat1NotifyChatChatPromptUnfurl'|}
export type Chat1NotifyChatChatRequestInfoPayload = {|+payload: _Chat1NotifyChatChatRequestInfoPayload, +type: 'engine-gen:chat1NotifyChatChatRequestInfo'|}
export type Chat1NotifyChatChatResetConversationPayload = {|+payload: _Chat1NotifyChatChatResetConversationPayload, +type: 'engine-gen:chat1NotifyChatChatResetConversation'|}
export type Chat1NotifyChatChatSetConvRetentionPayload = {|+payload: _Chat1NotifyChatChatSetConvRetentionPayload, +type: 'engine-gen:chat1NotifyChatChatSetConvRetention'|}
export type Chat1NotifyChatChatSetConvSettingsPayload = {|+payload: _Chat1NotifyChatChatSetConvSettingsPayload, +type: 'engine-gen:chat1NotifyChatChatSetConvSettings'|}
export type Chat1NotifyChatChatSetTeamRetentionPayload = {|+payload: _Chat1NotifyChatChatSetTeamRetentionPayload, +type: 'engine-gen:chat1NotifyChatChatSetTeamRetention'|}
export type Chat1NotifyChatChatSubteamRenamePayload = {|+payload: _Chat1NotifyChatChatSubteamRenamePayload, +type: 'engine-gen:chat1NotifyChatChatSubteamRename'|}
export type Chat1NotifyChatChatTLFFinalizePayload = {|+payload: _Chat1NotifyChatChatTLFFinalizePayload, +type: 'engine-gen:chat1NotifyChatChatTLFFinalize'|}
export type Chat1NotifyChatChatTLFResolvePayload = {|+payload: _Chat1NotifyChatChatTLFResolvePayload, +type: 'engine-gen:chat1NotifyChatChatTLFResolve'|}
export type Chat1NotifyChatChatThreadsStalePayload = {|+payload: _Chat1NotifyChatChatThreadsStalePayload, +type: 'engine-gen:chat1NotifyChatChatThreadsStale'|}
export type Chat1NotifyChatChatTypingUpdatePayload = {|+payload: _Chat1NotifyChatChatTypingUpdatePayload, +type: 'engine-gen:chat1NotifyChatChatTypingUpdate'|}
export type Chat1NotifyChatNewChatActivityPayload = {|+payload: _Chat1NotifyChatNewChatActivityPayload, +type: 'engine-gen:chat1NotifyChatNewChatActivity'|}
export type Keybase1GpgUiConfirmDuplicateKeyChosenPayload = {|+payload: _Keybase1GpgUiConfirmDuplicateKeyChosenPayload, +type: 'engine-gen:keybase1GpgUiConfirmDuplicateKeyChosen'|}
export type Keybase1GpgUiConfirmImportSecretToExistingKeyPayload = {|+payload: _Keybase1GpgUiConfirmImportSecretToExistingKeyPayload, +type: 'engine-gen:keybase1GpgUiConfirmImportSecretToExistingKey'|}
export type Keybase1GpgUiGetTTYPayload = {|+payload: _Keybase1GpgUiGetTTYPayload, +type: 'engine-gen:keybase1GpgUiGetTTY'|}
export type Keybase1GpgUiSelectKeyAndPushOptionPayload = {|+payload: _Keybase1GpgUiSelectKeyAndPushOptionPayload, +type: 'engine-gen:keybase1GpgUiSelectKeyAndPushOption'|}
export type Keybase1GpgUiSelectKeyPayload = {|+payload: _Keybase1GpgUiSelectKeyPayload, +type: 'engine-gen:keybase1GpgUiSelectKey'|}
export type Keybase1GpgUiSignPayload = {|+payload: _Keybase1GpgUiSignPayload, +type: 'engine-gen:keybase1GpgUiSign'|}
export type Keybase1GpgUiWantToAddGPGKeyPayload = {|+payload: _Keybase1GpgUiWantToAddGPGKeyPayload, +type: 'engine-gen:keybase1GpgUiWantToAddGPGKey'|}
export type Keybase1GregorUIPushOutOfBandMessagesPayload = {|+payload: _Keybase1GregorUIPushOutOfBandMessagesPayload, +type: 'engine-gen:keybase1GregorUIPushOutOfBandMessages'|}
export type Keybase1GregorUIPushStatePayload = {|+payload: _Keybase1GregorUIPushStatePayload, +type: 'engine-gen:keybase1GregorUIPushState'|}
export type Keybase1HomeUIHomeUIRefreshPayload = {|+payload: _Keybase1HomeUIHomeUIRefreshPayload, +type: 'engine-gen:keybase1HomeUIHomeUIRefresh'|}
export type Keybase1Identify3UiIdentify3ResultPayload = {|+payload: _Keybase1Identify3UiIdentify3ResultPayload, +type: 'engine-gen:keybase1Identify3UiIdentify3Result'|}
export type Keybase1Identify3UiIdentify3ShowTrackerPayload = {|+payload: _Keybase1Identify3UiIdentify3ShowTrackerPayload, +type: 'engine-gen:keybase1Identify3UiIdentify3ShowTracker'|}
export type Keybase1Identify3UiIdentify3TrackerTimedOutPayload = {|+payload: _Keybase1Identify3UiIdentify3TrackerTimedOutPayload, +type: 'engine-gen:keybase1Identify3UiIdentify3TrackerTimedOut'|}
export type Keybase1Identify3UiIdentify3UpdateRowPayload = {|+payload: _Keybase1Identify3UiIdentify3UpdateRowPayload, +type: 'engine-gen:keybase1Identify3UiIdentify3UpdateRow'|}
export type Keybase1Identify3UiIdentify3UpdateUserCardPayload = {|+payload: _Keybase1Identify3UiIdentify3UpdateUserCardPayload, +type: 'engine-gen:keybase1Identify3UiIdentify3UpdateUserCard'|}
export type Keybase1Identify3UiIdentify3UserResetPayload = {|+payload: _Keybase1Identify3UiIdentify3UserResetPayload, +type: 'engine-gen:keybase1Identify3UiIdentify3UserReset'|}
export type Keybase1IdentifyUiCancelPayload = {|+payload: _Keybase1IdentifyUiCancelPayload, +type: 'engine-gen:keybase1IdentifyUiCancel'|}
export type Keybase1IdentifyUiConfirmPayload = {|+payload: _Keybase1IdentifyUiConfirmPayload, +type: 'engine-gen:keybase1IdentifyUiConfirm'|}
export type Keybase1IdentifyUiDelegateIdentifyUIPayload = {|+payload: _Keybase1IdentifyUiDelegateIdentifyUIPayload, +type: 'engine-gen:keybase1IdentifyUiDelegateIdentifyUI'|}
export type Keybase1IdentifyUiDismissPayload = {|+payload: _Keybase1IdentifyUiDismissPayload, +type: 'engine-gen:keybase1IdentifyUiDismiss'|}
export type Keybase1IdentifyUiDisplayCryptocurrencyPayload = {|+payload: _Keybase1IdentifyUiDisplayCryptocurrencyPayload, +type: 'engine-gen:keybase1IdentifyUiDisplayCryptocurrency'|}
export type Keybase1IdentifyUiDisplayKeyPayload = {|+payload: _Keybase1IdentifyUiDisplayKeyPayload, +type: 'engine-gen:keybase1IdentifyUiDisplayKey'|}
export type Keybase1IdentifyUiDisplayStellarAccountPayload = {|+payload: _Keybase1IdentifyUiDisplayStellarAccountPayload, +type: 'engine-gen:keybase1IdentifyUiDisplayStellarAccount'|}
export type Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload = {|+payload: _Keybase1IdentifyUiDisplayTLFCreateWithInvitePayload, +type: 'engine-gen:keybase1IdentifyUiDisplayTLFCreateWithInvite'|}
export type Keybase1IdentifyUiDisplayTrackStatementPayload = {|+payload: _Keybase1IdentifyUiDisplayTrackStatementPayload, +type: 'engine-gen:keybase1IdentifyUiDisplayTrackStatement'|}
export type Keybase1IdentifyUiDisplayUserCardPayload = {|+payload: _Keybase1IdentifyUiDisplayUserCardPayload, +type: 'engine-gen:keybase1IdentifyUiDisplayUserCard'|}
export type Keybase1IdentifyUiFinishPayload = {|+payload: _Keybase1IdentifyUiFinishPayload, +type: 'engine-gen:keybase1IdentifyUiFinish'|}
export type Keybase1IdentifyUiFinishSocialProofCheckPayload = {|+payload: _Keybase1IdentifyUiFinishSocialProofCheckPayload, +type: 'engine-gen:keybase1IdentifyUiFinishSocialProofCheck'|}
export type Keybase1IdentifyUiFinishWebProofCheckPayload = {|+payload: _Keybase1IdentifyUiFinishWebProofCheckPayload, +type: 'engine-gen:keybase1IdentifyUiFinishWebProofCheck'|}
export type Keybase1IdentifyUiLaunchNetworkChecksPayload = {|+payload: _Keybase1IdentifyUiLaunchNetworkChecksPayload, +type: 'engine-gen:keybase1IdentifyUiLaunchNetworkChecks'|}
export type Keybase1IdentifyUiReportLastTrackPayload = {|+payload: _Keybase1IdentifyUiReportLastTrackPayload, +type: 'engine-gen:keybase1IdentifyUiReportLastTrack'|}
export type Keybase1IdentifyUiReportTrackTokenPayload = {|+payload: _Keybase1IdentifyUiReportTrackTokenPayload, +type: 'engine-gen:keybase1IdentifyUiReportTrackToken'|}
export type Keybase1IdentifyUiStartPayload = {|+payload: _Keybase1IdentifyUiStartPayload, +type: 'engine-gen:keybase1IdentifyUiStart'|}
export type Keybase1LogUiLogPayload = {|+payload: _Keybase1LogUiLogPayload, +type: 'engine-gen:keybase1LogUiLog'|}
export type Keybase1LoginUiDisplayPaperKeyPhrasePayload = {|+payload: _Keybase1LoginUiDisplayPaperKeyPhrasePayload, +type: 'engine-gen:keybase1LoginUiDisplayPaperKeyPhrase'|}
export type Keybase1LoginUiDisplayPrimaryPaperKeyPayload = {|+payload: _Keybase1LoginUiDisplayPrimaryPaperKeyPayload, +type: 'engine-gen:keybase1LoginUiDisplayPrimaryPaperKey'|}
export type Keybase1LoginUiGetEmailOrUsernamePayload = {|+payload: _Keybase1LoginUiGetEmailOrUsernamePayload, +type: 'engine-gen:keybase1LoginUiGetEmailOrUsername'|}
export type Keybase1LoginUiPromptRevokePaperKeysPayload = {|+payload: _Keybase1LoginUiPromptRevokePaperKeysPayload, +type: 'engine-gen:keybase1LoginUiPromptRevokePaperKeys'|}
export type Keybase1LogsendPrepareLogsendPayload = {|+payload: _Keybase1LogsendPrepareLogsendPayload, +type: 'engine-gen:keybase1LogsendPrepareLogsend'|}
export type Keybase1NotifyAppExitPayload = {|+payload: _Keybase1NotifyAppExitPayload, +type: 'engine-gen:keybase1NotifyAppExit'|}
export type Keybase1NotifyBadgesBadgeStatePayload = {|+payload: _Keybase1NotifyBadgesBadgeStatePayload, +type: 'engine-gen:keybase1NotifyBadgesBadgeState'|}
export type Keybase1NotifyCanUserPerformCanUserPerformChangedPayload = {|+payload: _Keybase1NotifyCanUserPerformCanUserPerformChangedPayload, +type: 'engine-gen:keybase1NotifyCanUserPerformCanUserPerformChanged'|}
export type Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload = {|+payload: _Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload, +type: 'engine-gen:keybase1NotifyDeviceCloneDeviceCloneCountChanged'|}
export type Keybase1NotifyEphemeralNewTeamEkPayload = {|+payload: _Keybase1NotifyEphemeralNewTeamEkPayload, +type: 'engine-gen:keybase1NotifyEphemeralNewTeamEk'|}
export type Keybase1NotifyFSFSActivityPayload = {|+payload: _Keybase1NotifyFSFSActivityPayload, +type: 'engine-gen:keybase1NotifyFSFSActivity'|}
export type Keybase1NotifyFSFSEditListResponsePayload = {|+payload: _Keybase1NotifyFSFSEditListResponsePayload, +type: 'engine-gen:keybase1NotifyFSFSEditListResponse'|}
export type Keybase1NotifyFSFSPathUpdatedPayload = {|+payload: _Keybase1NotifyFSFSPathUpdatedPayload, +type: 'engine-gen:keybase1NotifyFSFSPathUpdated'|}
export type Keybase1NotifyFSFSSyncActivityPayload = {|+payload: _Keybase1NotifyFSFSSyncActivityPayload, +type: 'engine-gen:keybase1NotifyFSFSSyncActivity'|}
export type Keybase1NotifyFSFSSyncStatusResponsePayload = {|+payload: _Keybase1NotifyFSFSSyncStatusResponsePayload, +type: 'engine-gen:keybase1NotifyFSFSSyncStatusResponse'|}
export type Keybase1NotifyFavoritesFavoritesChangedPayload = {|+payload: _Keybase1NotifyFavoritesFavoritesChangedPayload, +type: 'engine-gen:keybase1NotifyFavoritesFavoritesChanged'|}
export type Keybase1NotifyKeyfamilyKeyfamilyChangedPayload = {|+payload: _Keybase1NotifyKeyfamilyKeyfamilyChangedPayload, +type: 'engine-gen:keybase1NotifyKeyfamilyKeyfamilyChanged'|}
export type Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload = {|+payload: _Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload, +type: 'engine-gen:keybase1NotifyPGPPgpKeyInSecretStoreFile'|}
export type Keybase1NotifyPaperKeyPaperKeyCachedPayload = {|+payload: _Keybase1NotifyPaperKeyPaperKeyCachedPayload, +type: 'engine-gen:keybase1NotifyPaperKeyPaperKeyCached'|}
export type Keybase1NotifyPhoneNumberPhoneNumberAddedPayload = {|+payload: _Keybase1NotifyPhoneNumberPhoneNumberAddedPayload, +type: 'engine-gen:keybase1NotifyPhoneNumberPhoneNumberAdded'|}
export type Keybase1NotifyPhoneNumberPhoneNumberSupersededPayload = {|+payload: _Keybase1NotifyPhoneNumberPhoneNumberSupersededPayload, +type: 'engine-gen:keybase1NotifyPhoneNumberPhoneNumberSuperseded'|}
export type Keybase1NotifyPhoneNumberPhoneNumberVerifiedPayload = {|+payload: _Keybase1NotifyPhoneNumberPhoneNumberVerifiedPayload, +type: 'engine-gen:keybase1NotifyPhoneNumberPhoneNumberVerified'|}
export type Keybase1NotifyServiceShutdownPayload = {|+payload: _Keybase1NotifyServiceShutdownPayload, +type: 'engine-gen:keybase1NotifyServiceShutdown'|}
export type Keybase1NotifySessionClientOutOfDatePayload = {|+payload: _Keybase1NotifySessionClientOutOfDatePayload, +type: 'engine-gen:keybase1NotifySessionClientOutOfDate'|}
export type Keybase1NotifySessionLoggedInPayload = {|+payload: _Keybase1NotifySessionLoggedInPayload, +type: 'engine-gen:keybase1NotifySessionLoggedIn'|}
export type Keybase1NotifySessionLoggedOutPayload = {|+payload: _Keybase1NotifySessionLoggedOutPayload, +type: 'engine-gen:keybase1NotifySessionLoggedOut'|}
export type Keybase1NotifyTeamAvatarUpdatedPayload = {|+payload: _Keybase1NotifyTeamAvatarUpdatedPayload, +type: 'engine-gen:keybase1NotifyTeamAvatarUpdated'|}
export type Keybase1NotifyTeamNewlyAddedToTeamPayload = {|+payload: _Keybase1NotifyTeamNewlyAddedToTeamPayload, +type: 'engine-gen:keybase1NotifyTeamNewlyAddedToTeam'|}
export type Keybase1NotifyTeamTeamAbandonedPayload = {|+payload: _Keybase1NotifyTeamTeamAbandonedPayload, +type: 'engine-gen:keybase1NotifyTeamTeamAbandoned'|}
export type Keybase1NotifyTeamTeamChangedByIDPayload = {|+payload: _Keybase1NotifyTeamTeamChangedByIDPayload, +type: 'engine-gen:keybase1NotifyTeamTeamChangedByID'|}
export type Keybase1NotifyTeamTeamChangedByNamePayload = {|+payload: _Keybase1NotifyTeamTeamChangedByNamePayload, +type: 'engine-gen:keybase1NotifyTeamTeamChangedByName'|}
export type Keybase1NotifyTeamTeamDeletedPayload = {|+payload: _Keybase1NotifyTeamTeamDeletedPayload, +type: 'engine-gen:keybase1NotifyTeamTeamDeleted'|}
export type Keybase1NotifyTeamTeamExitPayload = {|+payload: _Keybase1NotifyTeamTeamExitPayload, +type: 'engine-gen:keybase1NotifyTeamTeamExit'|}
export type Keybase1NotifyTrackingTrackingChangedPayload = {|+payload: _Keybase1NotifyTrackingTrackingChangedPayload, +type: 'engine-gen:keybase1NotifyTrackingTrackingChanged'|}
export type Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload = {|+payload: _Keybase1NotifyUnverifiedTeamListTeamListUnverifiedChangedPayload, +type: 'engine-gen:keybase1NotifyUnverifiedTeamListTeamListUnverifiedChanged'|}
export type Keybase1NotifyUsersPasswordChangedPayload = {|+payload: _Keybase1NotifyUsersPasswordChangedPayload, +type: 'engine-gen:keybase1NotifyUsersPasswordChanged'|}
export type Keybase1NotifyUsersUserChangedPayload = {|+payload: _Keybase1NotifyUsersUserChangedPayload, +type: 'engine-gen:keybase1NotifyUsersUserChanged'|}
export type Keybase1PgpUiFinishedPayload = {|+payload: _Keybase1PgpUiFinishedPayload, +type: 'engine-gen:keybase1PgpUiFinished'|}
export type Keybase1PgpUiKeyGeneratedPayload = {|+payload: _Keybase1PgpUiKeyGeneratedPayload, +type: 'engine-gen:keybase1PgpUiKeyGenerated'|}
export type Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload = {|+payload: _Keybase1PgpUiOutputSignatureSuccessNonKeybasePayload, +type: 'engine-gen:keybase1PgpUiOutputSignatureSuccessNonKeybase'|}
export type Keybase1PgpUiOutputSignatureSuccessPayload = {|+payload: _Keybase1PgpUiOutputSignatureSuccessPayload, +type: 'engine-gen:keybase1PgpUiOutputSignatureSuccess'|}
export type Keybase1PgpUiShouldPushPrivatePayload = {|+payload: _Keybase1PgpUiShouldPushPrivatePayload, +type: 'engine-gen:keybase1PgpUiShouldPushPrivate'|}
export type Keybase1ProveUiDisplayRecheckWarningPayload = {|+payload: _Keybase1ProveUiDisplayRecheckWarningPayload, +type: 'engine-gen:keybase1ProveUiDisplayRecheckWarning'|}
export type Keybase1ProveUiOkToCheckPayload = {|+payload: _Keybase1ProveUiOkToCheckPayload, +type: 'engine-gen:keybase1ProveUiOkToCheck'|}
export type Keybase1ProveUiOutputInstructionsPayload = {|+payload: _Keybase1ProveUiOutputInstructionsPayload, +type: 'engine-gen:keybase1ProveUiOutputInstructions'|}
export type Keybase1ProveUiOutputPrechecksPayload = {|+payload: _Keybase1ProveUiOutputPrechecksPayload, +type: 'engine-gen:keybase1ProveUiOutputPrechecks'|}
export type Keybase1ProveUiPreProofWarningPayload = {|+payload: _Keybase1ProveUiPreProofWarningPayload, +type: 'engine-gen:keybase1ProveUiPreProofWarning'|}
export type Keybase1ProveUiPromptOverwritePayload = {|+payload: _Keybase1ProveUiPromptOverwritePayload, +type: 'engine-gen:keybase1ProveUiPromptOverwrite'|}
export type Keybase1ProveUiPromptUsernamePayload = {|+payload: _Keybase1ProveUiPromptUsernamePayload, +type: 'engine-gen:keybase1ProveUiPromptUsername'|}
export type Keybase1ProvisionUiChooseDevicePayload = {|+payload: _Keybase1ProvisionUiChooseDevicePayload, +type: 'engine-gen:keybase1ProvisionUiChooseDevice'|}
export type Keybase1ProvisionUiChooseDeviceTypePayload = {|+payload: _Keybase1ProvisionUiChooseDeviceTypePayload, +type: 'engine-gen:keybase1ProvisionUiChooseDeviceType'|}
export type Keybase1ProvisionUiChooseGPGMethodPayload = {|+payload: _Keybase1ProvisionUiChooseGPGMethodPayload, +type: 'engine-gen:keybase1ProvisionUiChooseGPGMethod'|}
export type Keybase1ProvisionUiChooseProvisioningMethodPayload = {|+payload: _Keybase1ProvisionUiChooseProvisioningMethodPayload, +type: 'engine-gen:keybase1ProvisionUiChooseProvisioningMethod'|}
export type Keybase1ProvisionUiDisplayAndPromptSecretPayload = {|+payload: _Keybase1ProvisionUiDisplayAndPromptSecretPayload, +type: 'engine-gen:keybase1ProvisionUiDisplayAndPromptSecret'|}
export type Keybase1ProvisionUiDisplaySecretExchangedPayload = {|+payload: _Keybase1ProvisionUiDisplaySecretExchangedPayload, +type: 'engine-gen:keybase1ProvisionUiDisplaySecretExchanged'|}
export type Keybase1ProvisionUiPromptNewDeviceNamePayload = {|+payload: _Keybase1ProvisionUiPromptNewDeviceNamePayload, +type: 'engine-gen:keybase1ProvisionUiPromptNewDeviceName'|}
export type Keybase1ProvisionUiProvisioneeSuccessPayload = {|+payload: _Keybase1ProvisionUiProvisioneeSuccessPayload, +type: 'engine-gen:keybase1ProvisionUiProvisioneeSuccess'|}
export type Keybase1ProvisionUiProvisionerSuccessPayload = {|+payload: _Keybase1ProvisionUiProvisionerSuccessPayload, +type: 'engine-gen:keybase1ProvisionUiProvisionerSuccess'|}
export type Keybase1ProvisionUiSwitchToGPGSignOKPayload = {|+payload: _Keybase1ProvisionUiSwitchToGPGSignOKPayload, +type: 'engine-gen:keybase1ProvisionUiSwitchToGPGSignOK'|}
export type Keybase1ReachabilityReachabilityChangedPayload = {|+payload: _Keybase1ReachabilityReachabilityChangedPayload, +type: 'engine-gen:keybase1ReachabilityReachabilityChanged'|}
export type Keybase1RekeyUIDelegateRekeyUIPayload = {|+payload: _Keybase1RekeyUIDelegateRekeyUIPayload, +type: 'engine-gen:keybase1RekeyUIDelegateRekeyUI'|}
export type Keybase1RekeyUIRefreshPayload = {|+payload: _Keybase1RekeyUIRefreshPayload, +type: 'engine-gen:keybase1RekeyUIRefresh'|}
export type Keybase1RekeyUIRekeySendEventPayload = {|+payload: _Keybase1RekeyUIRekeySendEventPayload, +type: 'engine-gen:keybase1RekeyUIRekeySendEvent'|}
export type Keybase1SaltpackUiSaltpackPromptForDecryptPayload = {|+payload: _Keybase1SaltpackUiSaltpackPromptForDecryptPayload, +type: 'engine-gen:keybase1SaltpackUiSaltpackPromptForDecrypt'|}
export type Keybase1SaltpackUiSaltpackVerifyBadSenderPayload = {|+payload: _Keybase1SaltpackUiSaltpackVerifyBadSenderPayload, +type: 'engine-gen:keybase1SaltpackUiSaltpackVerifyBadSender'|}
export type Keybase1SaltpackUiSaltpackVerifySuccessPayload = {|+payload: _Keybase1SaltpackUiSaltpackVerifySuccessPayload, +type: 'engine-gen:keybase1SaltpackUiSaltpackVerifySuccess'|}
export type Keybase1SecretUiGetPassphrasePayload = {|+payload: _Keybase1SecretUiGetPassphrasePayload, +type: 'engine-gen:keybase1SecretUiGetPassphrase'|}
export type Keybase1StreamUiClosePayload = {|+payload: _Keybase1StreamUiClosePayload, +type: 'engine-gen:keybase1StreamUiClose'|}
export type Keybase1StreamUiReadPayload = {|+payload: _Keybase1StreamUiReadPayload, +type: 'engine-gen:keybase1StreamUiRead'|}
export type Keybase1StreamUiResetPayload = {|+payload: _Keybase1StreamUiResetPayload, +type: 'engine-gen:keybase1StreamUiReset'|}
export type Keybase1StreamUiWritePayload = {|+payload: _Keybase1StreamUiWritePayload, +type: 'engine-gen:keybase1StreamUiWrite'|}
export type Keybase1TeamsUiConfirmRootTeamDeletePayload = {|+payload: _Keybase1TeamsUiConfirmRootTeamDeletePayload, +type: 'engine-gen:keybase1TeamsUiConfirmRootTeamDelete'|}
export type Keybase1TeamsUiConfirmSubteamDeletePayload = {|+payload: _Keybase1TeamsUiConfirmSubteamDeletePayload, +type: 'engine-gen:keybase1TeamsUiConfirmSubteamDelete'|}
export type Keybase1UiPromptYesNoPayload = {|+payload: _Keybase1UiPromptYesNoPayload, +type: 'engine-gen:keybase1UiPromptYesNo'|}
export type Stellar1NotifyAccountDetailsUpdatePayload = {|+payload: _Stellar1NotifyAccountDetailsUpdatePayload, +type: 'engine-gen:stellar1NotifyAccountDetailsUpdate'|}
export type Stellar1NotifyAccountsUpdatePayload = {|+payload: _Stellar1NotifyAccountsUpdatePayload, +type: 'engine-gen:stellar1NotifyAccountsUpdate'|}
export type Stellar1NotifyPaymentNotificationPayload = {|+payload: _Stellar1NotifyPaymentNotificationPayload, +type: 'engine-gen:stellar1NotifyPaymentNotification'|}
export type Stellar1NotifyPaymentStatusNotificationPayload = {|+payload: _Stellar1NotifyPaymentStatusNotificationPayload, +type: 'engine-gen:stellar1NotifyPaymentStatusNotification'|}
export type Stellar1NotifyPendingPaymentsUpdatePayload = {|+payload: _Stellar1NotifyPendingPaymentsUpdatePayload, +type: 'engine-gen:stellar1NotifyPendingPaymentsUpdate'|}
export type Stellar1NotifyRecentPaymentsUpdatePayload = {|+payload: _Stellar1NotifyRecentPaymentsUpdatePayload, +type: 'engine-gen:stellar1NotifyRecentPaymentsUpdate'|}
export type Stellar1NotifyRequestStatusNotificationPayload = {|+payload: _Stellar1NotifyRequestStatusNotificationPayload, +type: 'engine-gen:stellar1NotifyRequestStatusNotification'|}
export type Stellar1UiPaymentReviewedPayload = {|+payload: _Stellar1UiPaymentReviewedPayload, +type: 'engine-gen:stellar1UiPaymentReviewed'|}

// All Actions
// prettier-ignore
export type Actions =
  | Chat1ChatUiChatAttachmentDownloadDonePayload
  | Chat1ChatUiChatAttachmentDownloadProgressPayload
  | Chat1ChatUiChatAttachmentDownloadStartPayload
  | Chat1ChatUiChatConfirmChannelDeletePayload
  | Chat1ChatUiChatInboxConversationPayload
  | Chat1ChatUiChatInboxFailedPayload
  | Chat1ChatUiChatInboxUnverifiedPayload
  | Chat1ChatUiChatSearchDonePayload
  | Chat1ChatUiChatSearchHitPayload
  | Chat1ChatUiChatSearchInboxDonePayload
  | Chat1ChatUiChatSearchInboxHitPayload
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
  | Keybase1LoginUiGetEmailOrUsernamePayload
  | Keybase1LoginUiPromptRevokePaperKeysPayload
  | Keybase1LogsendPrepareLogsendPayload
  | Keybase1NotifyAppExitPayload
  | Keybase1NotifyBadgesBadgeStatePayload
  | Keybase1NotifyCanUserPerformCanUserPerformChangedPayload
  | Keybase1NotifyDeviceCloneDeviceCloneCountChangedPayload
  | Keybase1NotifyEphemeralNewTeamEkPayload
  | Keybase1NotifyFSFSActivityPayload
  | Keybase1NotifyFSFSEditListResponsePayload
  | Keybase1NotifyFSFSPathUpdatedPayload
  | Keybase1NotifyFSFSSyncActivityPayload
  | Keybase1NotifyFSFSSyncStatusResponsePayload
  | Keybase1NotifyFavoritesFavoritesChangedPayload
  | Keybase1NotifyKeyfamilyKeyfamilyChangedPayload
  | Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload
  | Keybase1NotifyPaperKeyPaperKeyCachedPayload
  | Keybase1NotifyPhoneNumberPhoneNumberAddedPayload
  | Keybase1NotifyPhoneNumberPhoneNumberSupersededPayload
  | Keybase1NotifyPhoneNumberPhoneNumberVerifiedPayload
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
