// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as chat1Types from '@/constants/types/rpc-chat-gen'
import type * as keybase1Types from '@/constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine-gen but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'engine-gen:'
export const chat1ChatUiChatBotCommandsUpdateStatus = 'engine-gen:chat1ChatUiChatBotCommandsUpdateStatus'
export const chat1ChatUiChatClearWatch = 'engine-gen:chat1ChatUiChatClearWatch'
export const chat1ChatUiChatCoinFlipStatus = 'engine-gen:chat1ChatUiChatCoinFlipStatus'
export const chat1ChatUiChatCommandMarkdown = 'engine-gen:chat1ChatUiChatCommandMarkdown'
export const chat1ChatUiChatCommandStatus = 'engine-gen:chat1ChatUiChatCommandStatus'
export const chat1ChatUiChatGiphySearchResults = 'engine-gen:chat1ChatUiChatGiphySearchResults'
export const chat1ChatUiChatGiphyToggleResultWindow = 'engine-gen:chat1ChatUiChatGiphyToggleResultWindow'
export const chat1ChatUiChatInboxConversation = 'engine-gen:chat1ChatUiChatInboxConversation'
export const chat1ChatUiChatInboxFailed = 'engine-gen:chat1ChatUiChatInboxFailed'
export const chat1ChatUiChatInboxLayout = 'engine-gen:chat1ChatUiChatInboxLayout'
export const chat1ChatUiChatInboxUnverified = 'engine-gen:chat1ChatUiChatInboxUnverified'
export const chat1ChatUiChatMaybeMentionUpdate = 'engine-gen:chat1ChatUiChatMaybeMentionUpdate'
export const chat1ChatUiChatShowManageChannels = 'engine-gen:chat1ChatUiChatShowManageChannels'
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
export const chat1NotifyChatChatParticipantsInfo = 'engine-gen:chat1NotifyChatChatParticipantsInfo'
export const chat1NotifyChatChatPaymentInfo = 'engine-gen:chat1NotifyChatChatPaymentInfo'
export const chat1NotifyChatChatPromptUnfurl = 'engine-gen:chat1NotifyChatChatPromptUnfurl'
export const chat1NotifyChatChatRequestInfo = 'engine-gen:chat1NotifyChatChatRequestInfo'
export const chat1NotifyChatChatSetConvRetention = 'engine-gen:chat1NotifyChatChatSetConvRetention'
export const chat1NotifyChatChatSetConvSettings = 'engine-gen:chat1NotifyChatChatSetConvSettings'
export const chat1NotifyChatChatSetTeamRetention = 'engine-gen:chat1NotifyChatChatSetTeamRetention'
export const chat1NotifyChatChatSubteamRename = 'engine-gen:chat1NotifyChatChatSubteamRename'
export const chat1NotifyChatChatTLFFinalize = 'engine-gen:chat1NotifyChatChatTLFFinalize'
export const chat1NotifyChatChatThreadsStale = 'engine-gen:chat1NotifyChatChatThreadsStale'
export const chat1NotifyChatChatTypingUpdate = 'engine-gen:chat1NotifyChatChatTypingUpdate'
export const chat1NotifyChatChatWelcomeMessageLoaded = 'engine-gen:chat1NotifyChatChatWelcomeMessageLoaded'
export const chat1NotifyChatNewChatActivity = 'engine-gen:chat1NotifyChatNewChatActivity'
export const keybase1GregorUIPushState = 'engine-gen:keybase1GregorUIPushState'
export const keybase1HomeUIHomeUIRefresh = 'engine-gen:keybase1HomeUIHomeUIRefresh'
export const keybase1Identify3UiIdentify3Result = 'engine-gen:keybase1Identify3UiIdentify3Result'
export const keybase1Identify3UiIdentify3ShowTracker = 'engine-gen:keybase1Identify3UiIdentify3ShowTracker'
export const keybase1Identify3UiIdentify3Summary = 'engine-gen:keybase1Identify3UiIdentify3Summary'
export const keybase1Identify3UiIdentify3UpdateRow = 'engine-gen:keybase1Identify3UiIdentify3UpdateRow'
export const keybase1Identify3UiIdentify3UpdateUserCard =
  'engine-gen:keybase1Identify3UiIdentify3UpdateUserCard'
export const keybase1Identify3UiIdentify3UserReset = 'engine-gen:keybase1Identify3UiIdentify3UserReset'
export const keybase1LogUiLog = 'engine-gen:keybase1LogUiLog'
export const keybase1LogsendPrepareLogsend = 'engine-gen:keybase1LogsendPrepareLogsend'
export const keybase1NotifyAppExit = 'engine-gen:keybase1NotifyAppExit'
export const keybase1NotifyAuditBoxAuditError = 'engine-gen:keybase1NotifyAuditBoxAuditError'
export const keybase1NotifyAuditRootAuditError = 'engine-gen:keybase1NotifyAuditRootAuditError'
export const keybase1NotifyBadgesBadgeState = 'engine-gen:keybase1NotifyBadgesBadgeState'
export const keybase1NotifyEmailAddressEmailAddressVerified =
  'engine-gen:keybase1NotifyEmailAddressEmailAddressVerified'
export const keybase1NotifyEmailAddressEmailsChanged = 'engine-gen:keybase1NotifyEmailAddressEmailsChanged'
export const keybase1NotifyFSFSActivity = 'engine-gen:keybase1NotifyFSFSActivity'
export const keybase1NotifyFSFSOverallSyncStatusChanged =
  'engine-gen:keybase1NotifyFSFSOverallSyncStatusChanged'
export const keybase1NotifyFSFSSubscriptionNotify = 'engine-gen:keybase1NotifyFSFSSubscriptionNotify'
export const keybase1NotifyFSFSSubscriptionNotifyPath = 'engine-gen:keybase1NotifyFSFSSubscriptionNotifyPath'
export const keybase1NotifyFeaturedBotsFeaturedBotsUpdate =
  'engine-gen:keybase1NotifyFeaturedBotsFeaturedBotsUpdate'
export const keybase1NotifyPGPPgpKeyInSecretStoreFile = 'engine-gen:keybase1NotifyPGPPgpKeyInSecretStoreFile'
export const keybase1NotifyPhoneNumberPhoneNumbersChanged =
  'engine-gen:keybase1NotifyPhoneNumberPhoneNumbersChanged'
export const keybase1NotifyRuntimeStatsRuntimeStatsUpdate =
  'engine-gen:keybase1NotifyRuntimeStatsRuntimeStatsUpdate'
export const keybase1NotifyServiceHTTPSrvInfoUpdate = 'engine-gen:keybase1NotifyServiceHTTPSrvInfoUpdate'
export const keybase1NotifyServiceHandleKeybaseLink = 'engine-gen:keybase1NotifyServiceHandleKeybaseLink'
export const keybase1NotifyServiceShutdown = 'engine-gen:keybase1NotifyServiceShutdown'
export const keybase1NotifySessionClientOutOfDate = 'engine-gen:keybase1NotifySessionClientOutOfDate'
export const keybase1NotifySessionLoggedIn = 'engine-gen:keybase1NotifySessionLoggedIn'
export const keybase1NotifySessionLoggedOut = 'engine-gen:keybase1NotifySessionLoggedOut'
export const keybase1NotifySimpleFSSimpleFSArchiveStatusChanged =
  'engine-gen:keybase1NotifySimpleFSSimpleFSArchiveStatusChanged'
export const keybase1NotifyTeamAvatarUpdated = 'engine-gen:keybase1NotifyTeamAvatarUpdated'
export const keybase1NotifyTeamTeamChangedByID = 'engine-gen:keybase1NotifyTeamTeamChangedByID'
export const keybase1NotifyTeamTeamDeleted = 'engine-gen:keybase1NotifyTeamTeamDeleted'
export const keybase1NotifyTeamTeamExit = 'engine-gen:keybase1NotifyTeamTeamExit'
export const keybase1NotifyTeamTeamMetadataUpdate = 'engine-gen:keybase1NotifyTeamTeamMetadataUpdate'
export const keybase1NotifyTeamTeamRoleMapChanged = 'engine-gen:keybase1NotifyTeamTeamRoleMapChanged'
export const keybase1NotifyTeamTeamTreeMembershipsDone =
  'engine-gen:keybase1NotifyTeamTeamTreeMembershipsDone'
export const keybase1NotifyTeamTeamTreeMembershipsPartial =
  'engine-gen:keybase1NotifyTeamTeamTreeMembershipsPartial'
export const keybase1NotifyTrackingNotifyUserBlocked = 'engine-gen:keybase1NotifyTrackingNotifyUserBlocked'
export const keybase1NotifyTrackingTrackingChanged = 'engine-gen:keybase1NotifyTrackingTrackingChanged'
export const keybase1NotifyTrackingTrackingInfo = 'engine-gen:keybase1NotifyTrackingTrackingInfo'
export const keybase1NotifyUsersIdentifyUpdate = 'engine-gen:keybase1NotifyUsersIdentifyUpdate'
export const keybase1NotifyUsersPasswordChanged = 'engine-gen:keybase1NotifyUsersPasswordChanged'
export const keybase1NotifyUsersUserChanged = 'engine-gen:keybase1NotifyUsersUserChanged'
export const keybase1ReachabilityReachabilityChanged = 'engine-gen:keybase1ReachabilityReachabilityChanged'
export const keybase1RekeyUIDelegateRekeyUI = 'engine-gen:keybase1RekeyUIDelegateRekeyUI'
export const keybase1RekeyUIRefresh = 'engine-gen:keybase1RekeyUIRefresh'
export const keybase1SecretUiGetPassphrase = 'engine-gen:keybase1SecretUiGetPassphrase'

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
type createChat1ChatUiChatMaybeMentionUpdate = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatMaybeMentionUpdate']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatMaybeMentionUpdate}
type createChat1ChatUiChatShowManageChannels = (payload: {
  readonly params: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['inParam']
  response: {
    error: chat1Types.IncomingErrorCallback
    result: (param: chat1Types.MessageTypes['chat.1.chatUi.chatShowManageChannels']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof chat1ChatUiChatShowManageChannels}
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
type createKeybase1LogUiLog = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.logUi.log']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.logUi.log']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1LogUiLog}
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
type createKeybase1NotifyFSFSActivity = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSActivity']['inParam']
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSActivity}
type createKeybase1NotifyFSFSOverallSyncStatusChanged = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFS.FSOverallSyncStatusChanged']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFSFSOverallSyncStatusChanged}
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
type createKeybase1NotifyFeaturedBotsFeaturedBotsUpdate = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyFeaturedBots.featuredBotsUpdate']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyFeaturedBots.featuredBotsUpdate']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyFeaturedBotsFeaturedBotsUpdate}
type createKeybase1NotifyPGPPgpKeyInSecretStoreFile = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (
      param: keybase1Types.MessageTypes['keybase.1.NotifyPGP.pgpKeyInSecretStoreFile']['outParam']
    ) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyPGPPgpKeyInSecretStoreFile}
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
type createKeybase1NotifyTeamTeamChangedByID = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.NotifyTeam.teamChangedByID']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1NotifyTeamTeamChangedByID}
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
type createKeybase1SecretUiGetPassphrase = (payload: {
  readonly params: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['inParam']
  response: {
    error: keybase1Types.IncomingErrorCallback
    result: (param: keybase1Types.MessageTypes['keybase.1.secretUi.getPassphrase']['outParam']) => void
  }
}) => {payload: typeof payload; type: typeof keybase1SecretUiGetPassphrase}

// Action Payloads
export type Chat1ChatUiChatBotCommandsUpdateStatusPayload =
  ReturnType<createChat1ChatUiChatBotCommandsUpdateStatus>
export type Chat1ChatUiChatClearWatchPayload = ReturnType<createChat1ChatUiChatClearWatch>
export type Chat1ChatUiChatCoinFlipStatusPayload = ReturnType<createChat1ChatUiChatCoinFlipStatus>
export type Chat1ChatUiChatCommandMarkdownPayload = ReturnType<createChat1ChatUiChatCommandMarkdown>
export type Chat1ChatUiChatCommandStatusPayload = ReturnType<createChat1ChatUiChatCommandStatus>
export type Chat1ChatUiChatGiphySearchResultsPayload = ReturnType<createChat1ChatUiChatGiphySearchResults>
export type Chat1ChatUiChatGiphyToggleResultWindowPayload =
  ReturnType<createChat1ChatUiChatGiphyToggleResultWindow>
export type Chat1ChatUiChatInboxConversationPayload = ReturnType<createChat1ChatUiChatInboxConversation>
export type Chat1ChatUiChatInboxFailedPayload = ReturnType<createChat1ChatUiChatInboxFailed>
export type Chat1ChatUiChatInboxLayoutPayload = ReturnType<createChat1ChatUiChatInboxLayout>
export type Chat1ChatUiChatInboxUnverifiedPayload = ReturnType<createChat1ChatUiChatInboxUnverified>
export type Chat1ChatUiChatMaybeMentionUpdatePayload = ReturnType<createChat1ChatUiChatMaybeMentionUpdate>
export type Chat1ChatUiChatShowManageChannelsPayload = ReturnType<createChat1ChatUiChatShowManageChannels>
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
export type Chat1NotifyChatChatParticipantsInfoPayload = ReturnType<createChat1NotifyChatChatParticipantsInfo>
export type Chat1NotifyChatChatPaymentInfoPayload = ReturnType<createChat1NotifyChatChatPaymentInfo>
export type Chat1NotifyChatChatPromptUnfurlPayload = ReturnType<createChat1NotifyChatChatPromptUnfurl>
export type Chat1NotifyChatChatRequestInfoPayload = ReturnType<createChat1NotifyChatChatRequestInfo>
export type Chat1NotifyChatChatSetConvRetentionPayload = ReturnType<createChat1NotifyChatChatSetConvRetention>
export type Chat1NotifyChatChatSetConvSettingsPayload = ReturnType<createChat1NotifyChatChatSetConvSettings>
export type Chat1NotifyChatChatSetTeamRetentionPayload = ReturnType<createChat1NotifyChatChatSetTeamRetention>
export type Chat1NotifyChatChatSubteamRenamePayload = ReturnType<createChat1NotifyChatChatSubteamRename>
export type Chat1NotifyChatChatTLFFinalizePayload = ReturnType<createChat1NotifyChatChatTLFFinalize>
export type Chat1NotifyChatChatThreadsStalePayload = ReturnType<createChat1NotifyChatChatThreadsStale>
export type Chat1NotifyChatChatTypingUpdatePayload = ReturnType<createChat1NotifyChatChatTypingUpdate>
export type Chat1NotifyChatChatWelcomeMessageLoadedPayload =
  ReturnType<createChat1NotifyChatChatWelcomeMessageLoaded>
export type Chat1NotifyChatNewChatActivityPayload = ReturnType<createChat1NotifyChatNewChatActivity>
export type Keybase1GregorUIPushStatePayload = ReturnType<createKeybase1GregorUIPushState>
export type Keybase1HomeUIHomeUIRefreshPayload = ReturnType<createKeybase1HomeUIHomeUIRefresh>
export type Keybase1Identify3UiIdentify3ResultPayload = ReturnType<createKeybase1Identify3UiIdentify3Result>
export type Keybase1Identify3UiIdentify3ShowTrackerPayload =
  ReturnType<createKeybase1Identify3UiIdentify3ShowTracker>
export type Keybase1Identify3UiIdentify3SummaryPayload = ReturnType<createKeybase1Identify3UiIdentify3Summary>
export type Keybase1Identify3UiIdentify3UpdateRowPayload =
  ReturnType<createKeybase1Identify3UiIdentify3UpdateRow>
export type Keybase1Identify3UiIdentify3UpdateUserCardPayload =
  ReturnType<createKeybase1Identify3UiIdentify3UpdateUserCard>
export type Keybase1Identify3UiIdentify3UserResetPayload =
  ReturnType<createKeybase1Identify3UiIdentify3UserReset>
export type Keybase1LogUiLogPayload = ReturnType<createKeybase1LogUiLog>
export type Keybase1LogsendPrepareLogsendPayload = ReturnType<createKeybase1LogsendPrepareLogsend>
export type Keybase1NotifyAppExitPayload = ReturnType<createKeybase1NotifyAppExit>
export type Keybase1NotifyAuditBoxAuditErrorPayload = ReturnType<createKeybase1NotifyAuditBoxAuditError>
export type Keybase1NotifyAuditRootAuditErrorPayload = ReturnType<createKeybase1NotifyAuditRootAuditError>
export type Keybase1NotifyBadgesBadgeStatePayload = ReturnType<createKeybase1NotifyBadgesBadgeState>
export type Keybase1NotifyEmailAddressEmailAddressVerifiedPayload =
  ReturnType<createKeybase1NotifyEmailAddressEmailAddressVerified>
export type Keybase1NotifyEmailAddressEmailsChangedPayload =
  ReturnType<createKeybase1NotifyEmailAddressEmailsChanged>
export type Keybase1NotifyFSFSActivityPayload = ReturnType<createKeybase1NotifyFSFSActivity>
export type Keybase1NotifyFSFSOverallSyncStatusChangedPayload =
  ReturnType<createKeybase1NotifyFSFSOverallSyncStatusChanged>
export type Keybase1NotifyFSFSSubscriptionNotifyPathPayload =
  ReturnType<createKeybase1NotifyFSFSSubscriptionNotifyPath>
export type Keybase1NotifyFSFSSubscriptionNotifyPayload =
  ReturnType<createKeybase1NotifyFSFSSubscriptionNotify>
export type Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload =
  ReturnType<createKeybase1NotifyFeaturedBotsFeaturedBotsUpdate>
export type Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload =
  ReturnType<createKeybase1NotifyPGPPgpKeyInSecretStoreFile>
export type Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload =
  ReturnType<createKeybase1NotifyPhoneNumberPhoneNumbersChanged>
export type Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload =
  ReturnType<createKeybase1NotifyRuntimeStatsRuntimeStatsUpdate>
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
export type Keybase1NotifyTeamTeamChangedByIDPayload = ReturnType<createKeybase1NotifyTeamTeamChangedByID>
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
export type Keybase1NotifyTrackingNotifyUserBlockedPayload =
  ReturnType<createKeybase1NotifyTrackingNotifyUserBlocked>
export type Keybase1NotifyTrackingTrackingChangedPayload =
  ReturnType<createKeybase1NotifyTrackingTrackingChanged>
export type Keybase1NotifyTrackingTrackingInfoPayload = ReturnType<createKeybase1NotifyTrackingTrackingInfo>
export type Keybase1NotifyUsersIdentifyUpdatePayload = ReturnType<createKeybase1NotifyUsersIdentifyUpdate>
export type Keybase1NotifyUsersPasswordChangedPayload = ReturnType<createKeybase1NotifyUsersPasswordChanged>
export type Keybase1NotifyUsersUserChangedPayload = ReturnType<createKeybase1NotifyUsersUserChanged>
export type Keybase1ReachabilityReachabilityChangedPayload =
  ReturnType<createKeybase1ReachabilityReachabilityChanged>
export type Keybase1RekeyUIDelegateRekeyUIPayload = ReturnType<createKeybase1RekeyUIDelegateRekeyUI>
export type Keybase1RekeyUIRefreshPayload = ReturnType<createKeybase1RekeyUIRefresh>
export type Keybase1SecretUiGetPassphrasePayload = ReturnType<createKeybase1SecretUiGetPassphrase>

// All Actions
// prettier-ignore
export type Actions =
  | Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | Chat1ChatUiChatClearWatchPayload
  | Chat1ChatUiChatCoinFlipStatusPayload
  | Chat1ChatUiChatCommandMarkdownPayload
  | Chat1ChatUiChatCommandStatusPayload
  | Chat1ChatUiChatGiphySearchResultsPayload
  | Chat1ChatUiChatGiphyToggleResultWindowPayload
  | Chat1ChatUiChatInboxConversationPayload
  | Chat1ChatUiChatInboxFailedPayload
  | Chat1ChatUiChatInboxLayoutPayload
  | Chat1ChatUiChatInboxUnverifiedPayload
  | Chat1ChatUiChatMaybeMentionUpdatePayload
  | Chat1ChatUiChatShowManageChannelsPayload
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
  | Chat1NotifyChatChatParticipantsInfoPayload
  | Chat1NotifyChatChatPaymentInfoPayload
  | Chat1NotifyChatChatPromptUnfurlPayload
  | Chat1NotifyChatChatRequestInfoPayload
  | Chat1NotifyChatChatSetConvRetentionPayload
  | Chat1NotifyChatChatSetConvSettingsPayload
  | Chat1NotifyChatChatSetTeamRetentionPayload
  | Chat1NotifyChatChatSubteamRenamePayload
  | Chat1NotifyChatChatTLFFinalizePayload
  | Chat1NotifyChatChatThreadsStalePayload
  | Chat1NotifyChatChatTypingUpdatePayload
  | Chat1NotifyChatChatWelcomeMessageLoadedPayload
  | Chat1NotifyChatNewChatActivityPayload
  | Keybase1GregorUIPushStatePayload
  | Keybase1HomeUIHomeUIRefreshPayload
  | Keybase1Identify3UiIdentify3ResultPayload
  | Keybase1Identify3UiIdentify3ShowTrackerPayload
  | Keybase1Identify3UiIdentify3SummaryPayload
  | Keybase1Identify3UiIdentify3UpdateRowPayload
  | Keybase1Identify3UiIdentify3UpdateUserCardPayload
  | Keybase1Identify3UiIdentify3UserResetPayload
  | Keybase1LogUiLogPayload
  | Keybase1LogsendPrepareLogsendPayload
  | Keybase1NotifyAppExitPayload
  | Keybase1NotifyAuditBoxAuditErrorPayload
  | Keybase1NotifyAuditRootAuditErrorPayload
  | Keybase1NotifyBadgesBadgeStatePayload
  | Keybase1NotifyEmailAddressEmailAddressVerifiedPayload
  | Keybase1NotifyEmailAddressEmailsChangedPayload
  | Keybase1NotifyFSFSActivityPayload
  | Keybase1NotifyFSFSOverallSyncStatusChangedPayload
  | Keybase1NotifyFSFSSubscriptionNotifyPathPayload
  | Keybase1NotifyFSFSSubscriptionNotifyPayload
  | Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload
  | Keybase1NotifyPGPPgpKeyInSecretStoreFilePayload
  | Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload
  | Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload
  | Keybase1NotifyServiceHTTPSrvInfoUpdatePayload
  | Keybase1NotifyServiceHandleKeybaseLinkPayload
  | Keybase1NotifyServiceShutdownPayload
  | Keybase1NotifySessionClientOutOfDatePayload
  | Keybase1NotifySessionLoggedInPayload
  | Keybase1NotifySessionLoggedOutPayload
  | Keybase1NotifySimpleFSSimpleFSArchiveStatusChangedPayload
  | Keybase1NotifyTeamAvatarUpdatedPayload
  | Keybase1NotifyTeamTeamChangedByIDPayload
  | Keybase1NotifyTeamTeamDeletedPayload
  | Keybase1NotifyTeamTeamExitPayload
  | Keybase1NotifyTeamTeamMetadataUpdatePayload
  | Keybase1NotifyTeamTeamRoleMapChangedPayload
  | Keybase1NotifyTeamTeamTreeMembershipsDonePayload
  | Keybase1NotifyTeamTeamTreeMembershipsPartialPayload
  | Keybase1NotifyTrackingNotifyUserBlockedPayload
  | Keybase1NotifyTrackingTrackingChangedPayload
  | Keybase1NotifyTrackingTrackingInfoPayload
  | Keybase1NotifyUsersIdentifyUpdatePayload
  | Keybase1NotifyUsersPasswordChangedPayload
  | Keybase1NotifyUsersUserChangedPayload
  | Keybase1ReachabilityReachabilityChangedPayload
  | Keybase1RekeyUIDelegateRekeyUIPayload
  | Keybase1RekeyUIRefreshPayload
  | Keybase1SecretUiGetPassphrasePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
