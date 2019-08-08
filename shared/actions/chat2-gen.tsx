// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import * as TeamsTypes from '../constants/types/teams'
import HiddenString from '../util/hidden-string'
import {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'chat2:'
export const addAttachmentViewMessage = 'chat2:addAttachmentViewMessage'
export const addUsersToChannel = 'chat2:addUsersToChannel'
export const attachmentDownload = 'chat2:attachmentDownload'
export const attachmentDownloaded = 'chat2:attachmentDownloaded'
export const attachmentFullscreenNext = 'chat2:attachmentFullscreenNext'
export const attachmentFullscreenSelection = 'chat2:attachmentFullscreenSelection'
export const attachmentLoading = 'chat2:attachmentLoading'
export const attachmentMobileSave = 'chat2:attachmentMobileSave'
export const attachmentMobileSaved = 'chat2:attachmentMobileSaved'
export const attachmentPasted = 'chat2:attachmentPasted'
export const attachmentPreviewSelect = 'chat2:attachmentPreviewSelect'
export const attachmentUploaded = 'chat2:attachmentUploaded'
export const attachmentUploading = 'chat2:attachmentUploading'
export const attachmentsUpload = 'chat2:attachmentsUpload'
export const badgesUpdated = 'chat2:badgesUpdated'
export const blockConversation = 'chat2:blockConversation'
export const changeFocus = 'chat2:changeFocus'
export const clearAttachmentView = 'chat2:clearAttachmentView'
export const clearCommandStatusInfo = 'chat2:clearCommandStatusInfo'
export const clearPaymentConfirmInfo = 'chat2:clearPaymentConfirmInfo'
export const confirmScreenResponse = 'chat2:confirmScreenResponse'
export const conversationErrored = 'chat2:conversationErrored'
export const createConversation = 'chat2:createConversation'
export const deselectConversation = 'chat2:deselectConversation'
export const desktopNotification = 'chat2:desktopNotification'
export const giphyGotSearchResult = 'chat2:giphyGotSearchResult'
export const giphySend = 'chat2:giphySend'
export const giphyToggleWindow = 'chat2:giphyToggleWindow'
export const handleSeeingWallets = 'chat2:handleSeeingWallets'
export const hideConversation = 'chat2:hideConversation'
export const inboxRefresh = 'chat2:inboxRefresh'
export const inboxSearch = 'chat2:inboxSearch'
export const inboxSearchMoveSelectedIndex = 'chat2:inboxSearchMoveSelectedIndex'
export const inboxSearchNameResults = 'chat2:inboxSearchNameResults'
export const inboxSearchSelect = 'chat2:inboxSearchSelect'
export const inboxSearchSetIndexPercent = 'chat2:inboxSearchSetIndexPercent'
export const inboxSearchSetTextStatus = 'chat2:inboxSearchSetTextStatus'
export const inboxSearchStarted = 'chat2:inboxSearchStarted'
export const inboxSearchTextResult = 'chat2:inboxSearchTextResult'
export const joinConversation = 'chat2:joinConversation'
export const jumpToRecent = 'chat2:jumpToRecent'
export const leaveConversation = 'chat2:leaveConversation'
export const loadAttachmentView = 'chat2:loadAttachmentView'
export const loadMessagesCentered = 'chat2:loadMessagesCentered'
export const loadNewerMessagesDueToScroll = 'chat2:loadNewerMessagesDueToScroll'
export const loadOlderMessagesDueToScroll = 'chat2:loadOlderMessagesDueToScroll'
export const markConversationsStale = 'chat2:markConversationsStale'
export const markInitiallyLoadedThreadAsRead = 'chat2:markInitiallyLoadedThreadAsRead'
export const messageAttachmentNativeSave = 'chat2:messageAttachmentNativeSave'
export const messageAttachmentNativeShare = 'chat2:messageAttachmentNativeShare'
export const messageAttachmentUploaded = 'chat2:messageAttachmentUploaded'
export const messageDelete = 'chat2:messageDelete'
export const messageDeleteHistory = 'chat2:messageDeleteHistory'
export const messageEdit = 'chat2:messageEdit'
export const messageErrored = 'chat2:messageErrored'
export const messageReplyPrivately = 'chat2:messageReplyPrivately'
export const messageRetry = 'chat2:messageRetry'
export const messageSend = 'chat2:messageSend'
export const messageSetEditing = 'chat2:messageSetEditing'
export const messageSetQuoting = 'chat2:messageSetQuoting'
export const messageWasEdited = 'chat2:messageWasEdited'
export const messagesAdd = 'chat2:messagesAdd'
export const messagesExploded = 'chat2:messagesExploded'
export const messagesWereDeleted = 'chat2:messagesWereDeleted'
export const metaDelete = 'chat2:metaDelete'
export const metaHandleQueue = 'chat2:metaHandleQueue'
export const metaNeedsUpdating = 'chat2:metaNeedsUpdating'
export const metaReceivedError = 'chat2:metaReceivedError'
export const metaRequestTrusted = 'chat2:metaRequestTrusted'
export const metaRequestingTrusted = 'chat2:metaRequestingTrusted'
export const metasReceived = 'chat2:metasReceived'
export const muteConversation = 'chat2:muteConversation'
export const navigateToInbox = 'chat2:navigateToInbox'
export const navigateToThread = 'chat2:navigateToThread'
export const notificationSettingsUpdated = 'chat2:notificationSettingsUpdated'
export const openChatFromWidget = 'chat2:openChatFromWidget'
export const openFolder = 'chat2:openFolder'
export const paymentInfoReceived = 'chat2:paymentInfoReceived'
export const pendingMessageWasEdited = 'chat2:pendingMessageWasEdited'
export const prepareFulfillRequestForm = 'chat2:prepareFulfillRequestForm'
export const previewConversation = 'chat2:previewConversation'
export const replyJump = 'chat2:replyJump'
export const requestInfoReceived = 'chat2:requestInfoReceived'
export const resetChatWithoutThem = 'chat2:resetChatWithoutThem'
export const resetLetThemIn = 'chat2:resetLetThemIn'
export const resolveMaybeMention = 'chat2:resolveMaybeMention'
export const saveMinWriterRole = 'chat2:saveMinWriterRole'
export const selectConversation = 'chat2:selectConversation'
export const sendTyping = 'chat2:sendTyping'
export const setAttachmentViewStatus = 'chat2:setAttachmentViewStatus'
export const setCommandMarkdown = 'chat2:setCommandMarkdown'
export const setCommandStatusInfo = 'chat2:setCommandStatusInfo'
export const setContainsLastMessage = 'chat2:setContainsLastMessage'
export const setConvExplodingMode = 'chat2:setConvExplodingMode'
export const setConvRetentionPolicy = 'chat2:setConvRetentionPolicy'
export const setConversationOffline = 'chat2:setConversationOffline'
export const setExplodingModeLock = 'chat2:setExplodingModeLock'
export const setInboxShowIsNew = 'chat2:setInboxShowIsNew'
export const setMaybeMentionInfo = 'chat2:setMaybeMentionInfo'
export const setMinWriterRole = 'chat2:setMinWriterRole'
export const setPaymentConfirmInfo = 'chat2:setPaymentConfirmInfo'
export const setPrependText = 'chat2:setPrependText'
export const setThreadLoadStatus = 'chat2:setThreadLoadStatus'
export const setThreadSearchQuery = 'chat2:setThreadSearchQuery'
export const setThreadSearchStatus = 'chat2:setThreadSearchStatus'
export const setUnsentText = 'chat2:setUnsentText'
export const setWalletsOld = 'chat2:setWalletsOld'
export const staticConfigLoaded = 'chat2:staticConfigLoaded'
export const tabSelected = 'chat2:tabSelected'
export const threadSearch = 'chat2:threadSearch'
export const threadSearchResults = 'chat2:threadSearchResults'
export const toggleInboxSearch = 'chat2:toggleInboxSearch'
export const toggleInfoPanel = 'chat2:toggleInfoPanel'
export const toggleLocalReaction = 'chat2:toggleLocalReaction'
export const toggleMessageCollapse = 'chat2:toggleMessageCollapse'
export const toggleMessageReaction = 'chat2:toggleMessageReaction'
export const toggleReplyToMessage = 'chat2:toggleReplyToMessage'
export const toggleSmallTeamsExpanded = 'chat2:toggleSmallTeamsExpanded'
export const toggleThreadSearch = 'chat2:toggleThreadSearch'
export const unfurlRemove = 'chat2:unfurlRemove'
export const unfurlResolvePrompt = 'chat2:unfurlResolvePrompt'
export const unfurlTogglePrompt = 'chat2:unfurlTogglePrompt'
export const unhideConversation = 'chat2:unhideConversation'
export const unsentTextChanged = 'chat2:unsentTextChanged'
export const updateCoinFlipStatus = 'chat2:updateCoinFlipStatus'
export const updateConvExplodingModes = 'chat2:updateConvExplodingModes'
export const updateConvRetentionPolicy = 'chat2:updateConvRetentionPolicy'
export const updateMessages = 'chat2:updateMessages'
export const updateMoreToLoad = 'chat2:updateMoreToLoad'
export const updateNotificationSettings = 'chat2:updateNotificationSettings'
export const updateReactions = 'chat2:updateReactions'
export const updateTeamRetentionPolicy = 'chat2:updateTeamRetentionPolicy'
export const updateUnreadline = 'chat2:updateUnreadline'
export const updateUserReacjis = 'chat2:updateUserReacjis'

// Payload Types
type _AddAttachmentViewMessagePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly viewType: RPCChatTypes.GalleryItemTyp
  readonly message: Types.Message
}
type _AddUsersToChannelPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly usernames: Array<string>
}
type _AttachmentDownloadPayload = {readonly message: Types.Message}
type _AttachmentDownloadedPayload = {readonly message: Types.Message; readonly path?: string}
type _AttachmentDownloadedPayloadError = {readonly error: string; readonly message: Types.Message}
type _AttachmentFullscreenNextPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly backInTime: boolean
}
type _AttachmentFullscreenSelectionPayload = {readonly autoPlay: boolean; readonly message: Types.Message}
type _AttachmentLoadingPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly message: Types.Message
  readonly ratio: number
  readonly isPreview: boolean
}
type _AttachmentMobileSavePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _AttachmentMobileSavedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _AttachmentPastedPayload = {readonly conversationIDKey: Types.ConversationIDKey; readonly data: Buffer}
type _AttachmentPreviewSelectPayload = {readonly message: Types.MessageAttachment}
type _AttachmentUploadedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _AttachmentUploadingPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly outboxID: Types.OutboxID
  readonly ratio: number
}
type _AttachmentsUploadPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly paths: Array<Types.PathAndOutboxID>
  readonly titles: Array<string>
}
type _BadgesUpdatedPayload = {readonly conversations: Array<RPCTypes.BadgeConversationInfo>}
type _BlockConversationPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly reportUser: boolean
}
type _ChangeFocusPayload = {readonly nextFocus: Types.Focus}
type _ClearAttachmentViewPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _ClearCommandStatusInfoPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _ClearPaymentConfirmInfoPayload = void
type _ConfirmScreenResponsePayload = {readonly accept: boolean}
type _ConversationErroredPayload = {readonly message: string}
type _CreateConversationPayload = {readonly participants: Array<string>}
type _DeselectConversationPayload = {readonly ifConversationIDKey: Types.ConversationIDKey}
type _DesktopNotificationPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly author: string
  readonly body: string
}
type _GiphyGotSearchResultPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly results: RPCChatTypes.GiphySearchResults
}
type _GiphySendPayload = {readonly conversationIDKey: Types.ConversationIDKey; readonly url: HiddenString}
type _GiphyToggleWindowPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly show: boolean
  readonly clearInput: boolean
}
type _HandleSeeingWalletsPayload = void
type _HideConversationPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _InboxRefreshPayload = {
  readonly reason:
    | 'bootstrap'
    | 'componentNeverLoaded'
    | 'inboxStale'
    | 'inboxSyncedClear'
    | 'inboxSyncedUnknown'
    | 'joinedAConversation'
    | 'leftAConversation'
    | 'teamTypeChanged'
}
type _InboxSearchMoveSelectedIndexPayload = {readonly increment: boolean}
type _InboxSearchNameResultsPayload = {
  readonly results: I.List<Types.InboxSearchConvHit>
  readonly unread: boolean
}
type _InboxSearchPayload = {readonly query: HiddenString}
type _InboxSearchSelectPayload = {
  readonly conversationIDKey?: Types.ConversationIDKey
  readonly query?: HiddenString
  readonly selectedIndex?: number
}
type _InboxSearchSetIndexPercentPayload = {readonly percent: number}
type _InboxSearchSetTextStatusPayload = {readonly status: Types.InboxSearchStatus}
type _InboxSearchStartedPayload = void
type _InboxSearchTextResultPayload = {readonly result: Types.InboxSearchTextHit}
type _JoinConversationPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _JumpToRecentPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _LeaveConversationPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly dontNavigateToInbox?: boolean
}
type _LoadAttachmentViewPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly viewType: RPCChatTypes.GalleryItemTyp
  readonly fromMsgID?: Types.MessageID
}
type _LoadMessagesCenteredPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly highlightMode: Types.CenterOrdinalHighlightMode
}
type _LoadNewerMessagesDueToScrollPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _LoadOlderMessagesDueToScrollPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _MarkConversationsStalePayload = {
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
  readonly updateType: RPCChatTypes.StaleUpdateType
}
type _MarkInitiallyLoadedThreadAsReadPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _MessageAttachmentNativeSavePayload = {readonly message: Types.Message}
type _MessageAttachmentNativeSharePayload = {readonly message: Types.Message}
type _MessageAttachmentUploadedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly placeholderID: RPCChatTypes.MessageID
  readonly message: Types.MessageAttachment
}
type _MessageDeleteHistoryPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _MessageDeletePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _MessageEditPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
  readonly text: HiddenString
}
type _MessageErroredPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly reason: string
  readonly outboxID: Types.OutboxID
}
type _MessageReplyPrivatelyPayload = {
  readonly sourceConversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _MessageRetryPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly outboxID: Types.OutboxID
}
type _MessageSendPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly text: HiddenString
  readonly replyTo?: Types.MessageID
}
type _MessageSetEditingPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal | null
  readonly editLastUser?: string
}
type _MessageSetQuotingPayload = {
  readonly sourceConversationIDKey: Types.ConversationIDKey
  readonly targetConversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _MessageWasEditedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: RPCChatTypes.MessageID
  readonly text: HiddenString
  readonly mentionsAt: I.Set<string>
  readonly mentionsChannel: 'none' | 'all' | 'here'
  readonly mentionsChannelName: I.Map<string, Types.ConversationIDKey>
}
type _MessagesAddPayload = {
  readonly context:
    | {type: 'sent'}
    | {type: 'incoming'}
    | {type: 'threadLoad'; conversationIDKey: Types.ConversationIDKey}
  readonly messages: Array<Types.Message>
  readonly shouldClearOthers?: boolean
  readonly centeredMessageIDs?: Array<{
    conversationIDKey: Types.ConversationIDKey
    messageID: Types.MessageID
    highlightMode: Types.CenterOrdinalHighlightMode
  }>
  readonly forceContainsLatestCalc?: boolean
}
type _MessagesExplodedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageIDs: Array<RPCChatTypes.MessageID>
  readonly explodedBy?: string
}
type _MessagesWereDeletedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageIDs?: Array<RPCChatTypes.MessageID>
  readonly upToMessageID?: RPCChatTypes.MessageID
  readonly deletableMessageTypes?: I.Set<Types.MessageType>
  readonly ordinals?: Array<Types.Ordinal>
}
type _MetaDeletePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly selectSomethingElse: boolean
}
type _MetaHandleQueuePayload = void
type _MetaNeedsUpdatingPayload = {
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
  readonly reason: string
}
type _MetaReceivedErrorPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly error: RPCChatTypes.InboxUIItemError | null
  readonly username: string | null
}
type _MetaRequestTrustedPayload = {
  readonly force?: boolean
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
}
type _MetaRequestingTrustedPayload = {readonly conversationIDKeys: Array<Types.ConversationIDKey>}
type _MetasReceivedPayload = {
  readonly metas: Array<Types.ConversationMeta>
  readonly removals?: Array<Types.ConversationIDKey>
  readonly neverCreate?: boolean
  readonly clearExistingMetas?: boolean
  readonly clearExistingMessages?: boolean
  readonly fromExpunge?: boolean
  readonly fromInboxRefresh?: boolean
  readonly initialTrustedLoad?: boolean
}
type _MuteConversationPayload = {readonly conversationIDKey: Types.ConversationIDKey; readonly muted: boolean}
type _NavigateToInboxPayload = {
  readonly avoidConversationID?: Types.ConversationIDKey
  readonly findNewConversation: boolean
}
type _NavigateToThreadPayload = void
type _NotificationSettingsUpdatedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly settings: RPCChatTypes.ConversationNotificationInfo
}
type _OpenChatFromWidgetPayload = {readonly conversationIDKey?: Types.ConversationIDKey}
type _OpenFolderPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _PaymentInfoReceivedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: RPCChatTypes.MessageID
  readonly paymentInfo: Types.ChatPaymentInfo
}
type _PendingMessageWasEditedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
  readonly text: HiddenString
}
type _PrepareFulfillRequestFormPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}
type _PreviewConversationPayload = {
  readonly participants?: Array<string>
  readonly teamname?: string
  readonly channelname?: string
  readonly conversationIDKey?: Types.ConversationIDKey
  readonly reason:
    | 'manageView'
    | 'messageLink'
    | 'resetChatWithoutThem'
    | 'tracker'
    | 'teamHeader'
    | 'files'
    | 'teamInvite'
    | 'fromAReset'
    | 'profile'
    | 'teamMember'
    | 'teamHeader'
    | 'convertAdHoc'
    | 'memberView'
    | 'newChannel'
    | 'transaction'
    | 'sentPayment'
    | 'requestedPayment'
    | 'teamMention'
    | 'appLink'
}
type _ReplyJumpPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}
type _RequestInfoReceivedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: RPCChatTypes.MessageID
  readonly requestInfo: Types.ChatRequestInfo
}
type _ResetChatWithoutThemPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _ResetLetThemInPayload = {readonly conversationIDKey: Types.ConversationIDKey; readonly username: string}
type _ResolveMaybeMentionPayload = {readonly name: string; readonly channel: string}
type _SaveMinWriterRolePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly role: TeamsTypes.TeamRoleType
  readonly cannotWrite: boolean
}
type _SelectConversationPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly reason:
    | 'focused'
    | 'clearSelected'
    | 'desktopNotification'
    | 'createdMessagePrivately'
    | 'extension'
    | 'files'
    | 'findNewestConversation'
    | 'inboxBig'
    | 'inboxFilterArrow'
    | 'inboxFilterChanged'
    | 'inboxSmall'
    | 'inboxNewConversation'
    | 'inboxSearch'
    | 'jumpFromReset'
    | 'jumpToReset'
    | 'justCreated'
    | 'manageView'
    | 'previewResolved'
    | 'push'
    | 'savedLastState'
    | 'startFoundExisting'
    | 'teamChat'
    | 'addedToChannel'
    | 'teamMention'
}
type _SendTypingPayload = {readonly conversationIDKey: Types.ConversationIDKey; readonly typing: boolean}
type _SetAttachmentViewStatusPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly viewType: RPCChatTypes.GalleryItemTyp
  readonly status: Types.AttachmentViewStatus
  readonly last?: boolean
}
type _SetCommandMarkdownPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly md: RPCChatTypes.UICommandMarkdown | null
}
type _SetCommandStatusInfoPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly info: Types.CommandStatusInfo
}
type _SetContainsLastMessagePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly contains: boolean
}
type _SetConvExplodingModePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly seconds: number
}
type _SetConvRetentionPolicyPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly policy: RetentionPolicy
}
type _SetConversationOfflinePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly offline: boolean
}
type _SetExplodingModeLockPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly unset?: boolean
}
type _SetInboxShowIsNewPayload = {readonly isNew: boolean}
type _SetMaybeMentionInfoPayload = {readonly name: string; readonly info: RPCChatTypes.UIMaybeMentionInfo}
type _SetMinWriterRolePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly role: TeamsTypes.TeamRoleType
}
type _SetPaymentConfirmInfoPayload = {readonly summary: RPCChatTypes.UIChatPaymentSummary}
type _SetPaymentConfirmInfoPayloadError = {readonly error: RPCTypes.Status}
type _SetPrependTextPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly text: HiddenString | null
}
type _SetThreadLoadStatusPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly status: RPCChatTypes.UIChatThreadStatus
}
type _SetThreadSearchQueryPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly query: HiddenString
}
type _SetThreadSearchStatusPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly status: Types.ThreadSearchStatus
}
type _SetUnsentTextPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly text: HiddenString | null
}
type _SetWalletsOldPayload = void
type _StaticConfigLoadedPayload = {readonly staticConfig: Types.StaticConfig}
type _TabSelectedPayload = void
type _ThreadSearchPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly query: HiddenString
}
type _ThreadSearchResultsPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messages: Array<Types.Message>
  readonly clear: boolean
}
type _ToggleInboxSearchPayload = {readonly enabled: boolean}
type _ToggleInfoPanelPayload = void
type _ToggleLocalReactionPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly emoji: string
  readonly targetOrdinal: Types.Ordinal
  readonly username: string
}
type _ToggleMessageCollapsePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly collapse: boolean
}
type _ToggleMessageReactionPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly emoji: string
  readonly ordinal: Types.Ordinal
}
type _ToggleReplyToMessagePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal?: Types.Ordinal
}
type _ToggleSmallTeamsExpandedPayload = void
type _ToggleThreadSearchPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _UnfurlRemovePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}
type _UnfurlResolvePromptPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly domain: string
  readonly result: RPCChatTypes.UnfurlPromptResult
}
type _UnfurlTogglePromptPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly domain: string
  readonly show: boolean
}
type _UnhideConversationPayload = {readonly conversationIDKey: Types.ConversationIDKey}
type _UnsentTextChangedPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly text: HiddenString
}
type _UpdateCoinFlipStatusPayload = {readonly statuses: Array<RPCChatTypes.UICoinFlipStatus>}
type _UpdateConvExplodingModesPayload = {
  readonly modes: Array<{conversationIDKey: Types.ConversationIDKey; seconds: number}>
}
type _UpdateConvRetentionPolicyPayload = {readonly conv: RPCChatTypes.InboxUIItem}
type _UpdateMessagesPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messages: Array<{messageID: Types.MessageID; message: Types.Message}>
}
type _UpdateMoreToLoadPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly moreToLoad: boolean
}
type _UpdateNotificationSettingsPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly notificationsDesktop: Types.NotificationsType
  readonly notificationsMobile: Types.NotificationsType
  readonly notificationsGlobalIgnoreMentions: boolean
}
type _UpdateReactionsPayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly updates: Array<{targetMsgID: RPCChatTypes.MessageID; reactions: Types.Reactions}>
}
type _UpdateTeamRetentionPolicyPayload = {readonly convs: Array<RPCChatTypes.InboxUIItem>}
type _UpdateUnreadlinePayload = {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}
type _UpdateUserReacjisPayload = {readonly userReacjis: RPCTypes.UserReacjis}

// Action Creators
/**
 * Actually start a conversation
 */
export const createCreateConversation = (payload: _CreateConversationPayload): CreateConversationPayload => ({
  payload,
  type: createConversation,
})
/**
 * Add a list of users to a conversation. Creates a SystemBulkAddToConv message.
 */
export const createAddUsersToChannel = (payload: _AddUsersToChannelPayload): AddUsersToChannelPayload => ({
  payload,
  type: addUsersToChannel,
})
/**
 * Add an unfurl prompt to a message
 */
export const createUnfurlTogglePrompt = (payload: _UnfurlTogglePromptPayload): UnfurlTogglePromptPayload => ({
  payload,
  type: unfurlTogglePrompt,
})
/**
 * Add result for attachment view
 */
export const createAddAttachmentViewMessage = (
  payload: _AddAttachmentViewMessagePayload
): AddAttachmentViewMessagePayload => ({payload, type: addAttachmentViewMessage})
/**
 * Change selected index of inbox search
 */
export const createInboxSearchMoveSelectedIndex = (
  payload: _InboxSearchMoveSelectedIndexPayload
): InboxSearchMoveSelectedIndexPayload => ({payload, type: inboxSearchMoveSelectedIndex})
/**
 * Clear attachment views
 */
export const createClearAttachmentView = (
  payload: _ClearAttachmentViewPayload
): ClearAttachmentViewPayload => ({payload, type: clearAttachmentView})
/**
 * Clear command status info
 */
export const createClearCommandStatusInfo = (
  payload: _ClearCommandStatusInfoPayload
): ClearCommandStatusInfoPayload => ({payload, type: clearCommandStatusInfo})
/**
 * Clear data for payment confirm modal
 */
export const createClearPaymentConfirmInfo = (
  payload: _ClearPaymentConfirmInfoPayload
): ClearPaymentConfirmInfoPayload => ({payload, type: clearPaymentConfirmInfo})
/**
 * Consume a service notification that a conversation's retention policy has been updated
 */
export const createUpdateConvRetentionPolicy = (
  payload: _UpdateConvRetentionPolicyPayload
): UpdateConvRetentionPolicyPayload => ({payload, type: updateConvRetentionPolicy})
/**
 * Consume a service notification that a team retention policy was updated
 */
export const createUpdateTeamRetentionPolicy = (
  payload: _UpdateTeamRetentionPolicyPayload
): UpdateTeamRetentionPolicyPayload => ({payload, type: updateTeamRetentionPolicy})
/**
 * Desktop changed tab to chat
 */
export const createTabSelected = (payload: _TabSelectedPayload): TabSelectedPayload => ({
  payload,
  type: tabSelected,
})
/**
 * Explicitly set whether a thread is loaded to the most recent message
 */
export const createSetContainsLastMessage = (
  payload: _SetContainsLastMessagePayload
): SetContainsLastMessagePayload => ({payload, type: setContainsLastMessage})
/**
 * Exploding messages expired or were manually detonated.
 */
export const createMessagesExploded = (payload: _MessagesExplodedPayload): MessagesExplodedPayload => ({
  payload,
  type: messagesExploded,
})
/**
 * Giphy search results obtained
 */
export const createGiphyGotSearchResult = (
  payload: _GiphyGotSearchResultPayload
): GiphyGotSearchResultPayload => ({payload, type: giphyGotSearchResult})
/**
 * Handle an update to our conversation exploding modes.
 */
export const createUpdateConvExplodingModes = (
  payload: _UpdateConvExplodingModesPayload
): UpdateConvExplodingModesPayload => ({payload, type: updateConvExplodingModes})
/**
 * Inbox search has started
 */
export const createInboxSearchStarted = (payload: _InboxSearchStartedPayload): InboxSearchStartedPayload => ({
  payload,
  type: inboxSearchStarted,
})
/**
 * Inbox search name results received
 */
export const createInboxSearchNameResults = (
  payload: _InboxSearchNameResultsPayload
): InboxSearchNameResultsPayload => ({payload, type: inboxSearchNameResults})
/**
 * Inbox text result has arrived
 */
export const createInboxSearchTextResult = (
  payload: _InboxSearchTextResultPayload
): InboxSearchTextResultPayload => ({payload, type: inboxSearchTextResult})
/**
 * Jump to a replied to message
 */
export const createReplyJump = (payload: _ReplyJumpPayload): ReplyJumpPayload => ({payload, type: replyJump})
/**
 * Jump to most recent messages in a conversation
 */
export const createJumpToRecent = (payload: _JumpToRecentPayload): JumpToRecentPayload => ({
  payload,
  type: jumpToRecent,
})
/**
 * Load attachment view pane
 */
export const createLoadAttachmentView = (payload: _LoadAttachmentViewPayload): LoadAttachmentViewPayload => ({
  payload,
  type: loadAttachmentView,
})
/**
 * Perform a search in a thread
 */
export const createThreadSearch = (payload: _ThreadSearchPayload): ThreadSearchPayload => ({
  payload,
  type: threadSearch,
})
/**
 * Perform an inbox search
 */
export const createInboxSearch = (payload: _InboxSearchPayload): InboxSearchPayload => ({
  payload,
  type: inboxSearch,
})
/**
 * Prime data to fulfill this message's request and navigate to the send form.
 */
export const createPrepareFulfillRequestForm = (
  payload: _PrepareFulfillRequestFormPayload
): PrepareFulfillRequestFormPayload => ({payload, type: prepareFulfillRequestForm})
/**
 * Record a new thread search result
 */
export const createThreadSearchResults = (
  payload: _ThreadSearchResultsPayload
): ThreadSearchResultsPayload => ({payload, type: threadSearchResults})
/**
 * Remove an unfurl
 */
export const createUnfurlRemove = (payload: _UnfurlRemovePayload): UnfurlRemovePayload => ({
  payload,
  type: unfurlRemove,
})
/**
 * Reply to a message publicly
 */
export const createToggleReplyToMessage = (
  payload: _ToggleReplyToMessagePayload
): ToggleReplyToMessagePayload => ({payload, type: toggleReplyToMessage})
/**
 * Resolve an unknown @ mention
 */
export const createResolveMaybeMention = (
  payload: _ResolveMaybeMentionPayload
): ResolveMaybeMentionPayload => ({payload, type: resolveMaybeMention})
/**
 * Response to an unfurl prompt
 */
export const createUnfurlResolvePrompt = (
  payload: _UnfurlResolvePromptPayload
): UnfurlResolvePromptPayload => ({payload, type: unfurlResolvePrompt})
/**
 * Select an inbox search item
 */
export const createInboxSearchSelect = (
  payload: _InboxSearchSelectPayload = Object.freeze({})
): InboxSearchSelectPayload => ({payload, type: inboxSearchSelect})
/**
 * Set a lock on the exploding mode for a conversation.
 */
export const createSetExplodingModeLock = (
  payload: _SetExplodingModeLockPayload
): SetExplodingModeLockPayload => ({payload, type: setExplodingModeLock})
/**
 * Set attachment view status
 */
export const createSetAttachmentViewStatus = (
  payload: _SetAttachmentViewStatusPayload
): SetAttachmentViewStatusPayload => ({payload, type: setAttachmentViewStatus})
/**
 * Set command markdown for a conversation
 */
export const createSetCommandMarkdown = (payload: _SetCommandMarkdownPayload): SetCommandMarkdownPayload => ({
  payload,
  type: setCommandMarkdown,
})
/**
 * Set command status info
 */
export const createSetCommandStatusInfo = (
  payload: _SetCommandStatusInfoPayload
): SetCommandStatusInfoPayload => ({payload, type: setCommandStatusInfo})
/**
 * Set index percent complete
 */
export const createInboxSearchSetIndexPercent = (
  payload: _InboxSearchSetIndexPercentPayload
): InboxSearchSetIndexPercentPayload => ({payload, type: inboxSearchSetIndexPercent})
/**
 * Set prepend text for a conversation
 */
export const createSetPrependText = (payload: _SetPrependTextPayload): SetPrependTextPayload => ({
  payload,
  type: setPrependText,
})
/**
 * Set team mention info
 */
export const createSetMaybeMentionInfo = (
  payload: _SetMaybeMentionInfoPayload
): SetMaybeMentionInfoPayload => ({payload, type: setMaybeMentionInfo})
/**
 * Set that wallets in chat is not new.
 */
export const createSetWalletsOld = (payload: _SetWalletsOldPayload): SetWalletsOldPayload => ({
  payload,
  type: setWalletsOld,
})
/**
 * Set the collapse status of a message
 */
export const createToggleMessageCollapse = (
  payload: _ToggleMessageCollapsePayload
): ToggleMessageCollapsePayload => ({payload, type: toggleMessageCollapse})
/**
 * Set the minimum role required to write into a conversation. Valid only for team conversations.
 */
export const createSetMinWriterRole = (payload: _SetMinWriterRolePayload): SetMinWriterRolePayload => ({
  payload,
  type: setMinWriterRole,
})
/**
 * Set the payment confirm modal payment data
 */
export const createSetPaymentConfirmInfo = (
  payload: _SetPaymentConfirmInfoPayload
): SetPaymentConfirmInfoPayload => ({payload, type: setPaymentConfirmInfo})
export const createSetPaymentConfirmInfoError = (
  payload: _SetPaymentConfirmInfoPayloadError
): SetPaymentConfirmInfoPayloadError => ({error: true, payload, type: setPaymentConfirmInfo})
/**
 * Set the remote exploding mode for a conversation.
 */
export const createSetConvExplodingMode = (
  payload: _SetConvExplodingModePayload
): SetConvExplodingModePayload => ({payload, type: setConvExplodingMode})
/**
 * Set the status of a thread search
 */
export const createSetThreadSearchStatus = (
  payload: _SetThreadSearchStatusPayload
): SetThreadSearchStatusPayload => ({payload, type: setThreadSearchStatus})
/**
 * Set the status of the inbox text search
 */
export const createInboxSearchSetTextStatus = (
  payload: _InboxSearchSetTextStatusPayload
): InboxSearchSetTextStatusPayload => ({payload, type: inboxSearchSetTextStatus})
/**
 * Set thread load status
 */
export const createSetThreadLoadStatus = (
  payload: _SetThreadLoadStatusPayload
): SetThreadLoadStatusPayload => ({payload, type: setThreadLoadStatus})
/**
 * Set thread search query (used from inbox search to initialize it)
 */
export const createSetThreadSearchQuery = (
  payload: _SetThreadSearchQueryPayload
): SetThreadSearchQueryPayload => ({payload, type: setThreadSearchQuery})
/**
 * Set unsent text for a conversation
 */
export const createSetUnsentText = (payload: _SetUnsentTextPayload): SetUnsentTextPayload => ({
  payload,
  type: setUnsentText,
})
/**
 * Sets the retention policy for a conversation.
 */
export const createSetConvRetentionPolicy = (
  payload: _SetConvRetentionPolicyPayload
): SetConvRetentionPolicyPayload => ({payload, type: setConvRetentionPolicy})
/**
 * Static configuration info was loaded from the service.
 */
export const createStaticConfigLoaded = (payload: _StaticConfigLoadedPayload): StaticConfigLoadedPayload => ({
  payload,
  type: staticConfigLoaded,
})
/**
 * Tell the service to toggle a reaction on a message.
 */
export const createToggleMessageReaction = (
  payload: _ToggleMessageReactionPayload
): ToggleMessageReactionPayload => ({payload, type: toggleMessageReaction})
/**
 * The service sent us an update for the reaction map of a message.
 */
export const createUpdateReactions = (payload: _UpdateReactionsPayload): UpdateReactionsPayload => ({
  payload,
  type: updateReactions,
})
/**
 * The user has interacted with wallets in chat.
 */
export const createHandleSeeingWallets = (
  payload: _HandleSeeingWalletsPayload
): HandleSeeingWalletsPayload => ({payload, type: handleSeeingWallets})
/**
 * Toggle Giphy search preview window
 */
export const createGiphyToggleWindow = (payload: _GiphyToggleWindowPayload): GiphyToggleWindowPayload => ({
  payload,
  type: giphyToggleWindow,
})
/**
 * Toggle a reaction in the store.
 */
export const createToggleLocalReaction = (
  payload: _ToggleLocalReactionPayload
): ToggleLocalReactionPayload => ({payload, type: toggleLocalReaction})
/**
 * Toggle inbox search view
 */
export const createToggleInboxSearch = (payload: _ToggleInboxSearchPayload): ToggleInboxSearchPayload => ({
  payload,
  type: toggleInboxSearch,
})
/**
 * Toggle the display of the thread search window
 */
export const createToggleThreadSearch = (payload: _ToggleThreadSearchPayload): ToggleThreadSearchPayload => ({
  payload,
  type: toggleThreadSearch,
})
/**
 * Unsent text changed
 */
export const createUnsentTextChanged = (payload: _UnsentTextChangedPayload): UnsentTextChangedPayload => ({
  payload,
  type: unsentTextChanged,
})
/**
 * Update messages that we might have in the store
 */
export const createUpdateMessages = (payload: _UpdateMessagesPayload): UpdateMessagesPayload => ({
  payload,
  type: updateMessages,
})
/**
 * Update status of a coin flip game
 */
export const createUpdateCoinFlipStatus = (
  payload: _UpdateCoinFlipStatusPayload
): UpdateCoinFlipStatusPayload => ({payload, type: updateCoinFlipStatus})
/**
 * Update the minWriterRole stored with the conversation metadata.
 */
export const createSaveMinWriterRole = (payload: _SaveMinWriterRolePayload): SaveMinWriterRolePayload => ({
  payload,
  type: saveMinWriterRole,
})
/**
 * Update the unreadline line position for a conversation
 */
export const createUpdateUnreadline = (payload: _UpdateUnreadlinePayload): UpdateUnreadlinePayload => ({
  payload,
  type: updateUnreadline,
})
/**
 * User responded to the chat Stellar confirm screen
 */
export const createConfirmScreenResponse = (
  payload: _ConfirmScreenResponsePayload
): ConfirmScreenResponsePayload => ({payload, type: confirmScreenResponse})
/**
 * We received payment info for a sendPayment message
 */
export const createPaymentInfoReceived = (
  payload: _PaymentInfoReceivedPayload
): PaymentInfoReceivedPayload => ({payload, type: paymentInfoReceived})
/**
 * We received request info for a requestPayment message
 */
export const createRequestInfoReceived = (
  payload: _RequestInfoReceivedPayload
): RequestInfoReceivedPayload => ({payload, type: requestInfoReceived})
/**
 * We've seen chat search before
 */
export const createSetInboxShowIsNew = (payload: _SetInboxShowIsNewPayload): SetInboxShowIsNewPayload => ({
  payload,
  type: setInboxShowIsNew,
})
/**
 * Where we want our focus for keypresses
 */
export const createChangeFocus = (payload: _ChangeFocusPayload): ChangeFocusPayload => ({
  payload,
  type: changeFocus,
})
/**
 * send a message from Giphy search
 */
export const createGiphySend = (payload: _GiphySendPayload): GiphySendPayload => ({payload, type: giphySend})
export const createAttachmentDownload = (payload: _AttachmentDownloadPayload): AttachmentDownloadPayload => ({
  payload,
  type: attachmentDownload,
})
export const createAttachmentDownloaded = (
  payload: _AttachmentDownloadedPayload
): AttachmentDownloadedPayload => ({payload, type: attachmentDownloaded})
export const createAttachmentDownloadedError = (
  payload: _AttachmentDownloadedPayloadError
): AttachmentDownloadedPayloadError => ({error: true, payload, type: attachmentDownloaded})
export const createAttachmentFullscreenNext = (
  payload: _AttachmentFullscreenNextPayload
): AttachmentFullscreenNextPayload => ({payload, type: attachmentFullscreenNext})
export const createAttachmentFullscreenSelection = (
  payload: _AttachmentFullscreenSelectionPayload
): AttachmentFullscreenSelectionPayload => ({payload, type: attachmentFullscreenSelection})
export const createAttachmentLoading = (payload: _AttachmentLoadingPayload): AttachmentLoadingPayload => ({
  payload,
  type: attachmentLoading,
})
export const createAttachmentMobileSave = (
  payload: _AttachmentMobileSavePayload
): AttachmentMobileSavePayload => ({payload, type: attachmentMobileSave})
export const createAttachmentMobileSaved = (
  payload: _AttachmentMobileSavedPayload
): AttachmentMobileSavedPayload => ({payload, type: attachmentMobileSaved})
export const createAttachmentPasted = (payload: _AttachmentPastedPayload): AttachmentPastedPayload => ({
  payload,
  type: attachmentPasted,
})
export const createAttachmentPreviewSelect = (
  payload: _AttachmentPreviewSelectPayload
): AttachmentPreviewSelectPayload => ({payload, type: attachmentPreviewSelect})
export const createAttachmentUploaded = (payload: _AttachmentUploadedPayload): AttachmentUploadedPayload => ({
  payload,
  type: attachmentUploaded,
})
export const createAttachmentUploading = (
  payload: _AttachmentUploadingPayload
): AttachmentUploadingPayload => ({payload, type: attachmentUploading})
export const createAttachmentsUpload = (payload: _AttachmentsUploadPayload): AttachmentsUploadPayload => ({
  payload,
  type: attachmentsUpload,
})
export const createBadgesUpdated = (payload: _BadgesUpdatedPayload): BadgesUpdatedPayload => ({
  payload,
  type: badgesUpdated,
})
export const createBlockConversation = (payload: _BlockConversationPayload): BlockConversationPayload => ({
  payload,
  type: blockConversation,
})
export const createConversationErrored = (
  payload: _ConversationErroredPayload
): ConversationErroredPayload => ({payload, type: conversationErrored})
export const createDeselectConversation = (
  payload: _DeselectConversationPayload
): DeselectConversationPayload => ({payload, type: deselectConversation})
export const createDesktopNotification = (
  payload: _DesktopNotificationPayload
): DesktopNotificationPayload => ({payload, type: desktopNotification})
export const createHideConversation = (payload: _HideConversationPayload): HideConversationPayload => ({
  payload,
  type: hideConversation,
})
export const createInboxRefresh = (payload: _InboxRefreshPayload): InboxRefreshPayload => ({
  payload,
  type: inboxRefresh,
})
export const createJoinConversation = (payload: _JoinConversationPayload): JoinConversationPayload => ({
  payload,
  type: joinConversation,
})
export const createLeaveConversation = (payload: _LeaveConversationPayload): LeaveConversationPayload => ({
  payload,
  type: leaveConversation,
})
export const createLoadMessagesCentered = (
  payload: _LoadMessagesCenteredPayload
): LoadMessagesCenteredPayload => ({payload, type: loadMessagesCentered})
export const createLoadNewerMessagesDueToScroll = (
  payload: _LoadNewerMessagesDueToScrollPayload
): LoadNewerMessagesDueToScrollPayload => ({payload, type: loadNewerMessagesDueToScroll})
export const createLoadOlderMessagesDueToScroll = (
  payload: _LoadOlderMessagesDueToScrollPayload
): LoadOlderMessagesDueToScrollPayload => ({payload, type: loadOlderMessagesDueToScroll})
export const createMarkConversationsStale = (
  payload: _MarkConversationsStalePayload
): MarkConversationsStalePayload => ({payload, type: markConversationsStale})
export const createMarkInitiallyLoadedThreadAsRead = (
  payload: _MarkInitiallyLoadedThreadAsReadPayload
): MarkInitiallyLoadedThreadAsReadPayload => ({payload, type: markInitiallyLoadedThreadAsRead})
export const createMessageAttachmentNativeSave = (
  payload: _MessageAttachmentNativeSavePayload
): MessageAttachmentNativeSavePayload => ({payload, type: messageAttachmentNativeSave})
export const createMessageAttachmentNativeShare = (
  payload: _MessageAttachmentNativeSharePayload
): MessageAttachmentNativeSharePayload => ({payload, type: messageAttachmentNativeShare})
export const createMessageAttachmentUploaded = (
  payload: _MessageAttachmentUploadedPayload
): MessageAttachmentUploadedPayload => ({payload, type: messageAttachmentUploaded})
export const createMessageDelete = (payload: _MessageDeletePayload): MessageDeletePayload => ({
  payload,
  type: messageDelete,
})
export const createMessageDeleteHistory = (
  payload: _MessageDeleteHistoryPayload
): MessageDeleteHistoryPayload => ({payload, type: messageDeleteHistory})
export const createMessageEdit = (payload: _MessageEditPayload): MessageEditPayload => ({
  payload,
  type: messageEdit,
})
export const createMessageErrored = (payload: _MessageErroredPayload): MessageErroredPayload => ({
  payload,
  type: messageErrored,
})
export const createMessageReplyPrivately = (
  payload: _MessageReplyPrivatelyPayload
): MessageReplyPrivatelyPayload => ({payload, type: messageReplyPrivately})
export const createMessageRetry = (payload: _MessageRetryPayload): MessageRetryPayload => ({
  payload,
  type: messageRetry,
})
export const createMessageSend = (payload: _MessageSendPayload): MessageSendPayload => ({
  payload,
  type: messageSend,
})
export const createMessageSetEditing = (payload: _MessageSetEditingPayload): MessageSetEditingPayload => ({
  payload,
  type: messageSetEditing,
})
export const createMessageSetQuoting = (payload: _MessageSetQuotingPayload): MessageSetQuotingPayload => ({
  payload,
  type: messageSetQuoting,
})
export const createMessageWasEdited = (payload: _MessageWasEditedPayload): MessageWasEditedPayload => ({
  payload,
  type: messageWasEdited,
})
export const createMessagesAdd = (payload: _MessagesAddPayload): MessagesAddPayload => ({
  payload,
  type: messagesAdd,
})
export const createMessagesWereDeleted = (
  payload: _MessagesWereDeletedPayload
): MessagesWereDeletedPayload => ({payload, type: messagesWereDeleted})
export const createMetaDelete = (payload: _MetaDeletePayload): MetaDeletePayload => ({
  payload,
  type: metaDelete,
})
export const createMetaHandleQueue = (payload: _MetaHandleQueuePayload): MetaHandleQueuePayload => ({
  payload,
  type: metaHandleQueue,
})
export const createMetaNeedsUpdating = (payload: _MetaNeedsUpdatingPayload): MetaNeedsUpdatingPayload => ({
  payload,
  type: metaNeedsUpdating,
})
export const createMetaReceivedError = (payload: _MetaReceivedErrorPayload): MetaReceivedErrorPayload => ({
  payload,
  type: metaReceivedError,
})
export const createMetaRequestTrusted = (payload: _MetaRequestTrustedPayload): MetaRequestTrustedPayload => ({
  payload,
  type: metaRequestTrusted,
})
export const createMetaRequestingTrusted = (
  payload: _MetaRequestingTrustedPayload
): MetaRequestingTrustedPayload => ({payload, type: metaRequestingTrusted})
export const createMetasReceived = (payload: _MetasReceivedPayload): MetasReceivedPayload => ({
  payload,
  type: metasReceived,
})
export const createMuteConversation = (payload: _MuteConversationPayload): MuteConversationPayload => ({
  payload,
  type: muteConversation,
})
export const createNavigateToInbox = (payload: _NavigateToInboxPayload): NavigateToInboxPayload => ({
  payload,
  type: navigateToInbox,
})
export const createNavigateToThread = (payload: _NavigateToThreadPayload): NavigateToThreadPayload => ({
  payload,
  type: navigateToThread,
})
export const createNotificationSettingsUpdated = (
  payload: _NotificationSettingsUpdatedPayload
): NotificationSettingsUpdatedPayload => ({payload, type: notificationSettingsUpdated})
export const createOpenChatFromWidget = (
  payload: _OpenChatFromWidgetPayload = Object.freeze({})
): OpenChatFromWidgetPayload => ({payload, type: openChatFromWidget})
export const createOpenFolder = (payload: _OpenFolderPayload): OpenFolderPayload => ({
  payload,
  type: openFolder,
})
export const createPendingMessageWasEdited = (
  payload: _PendingMessageWasEditedPayload
): PendingMessageWasEditedPayload => ({payload, type: pendingMessageWasEdited})
export const createPreviewConversation = (
  payload: _PreviewConversationPayload
): PreviewConversationPayload => ({payload, type: previewConversation})
export const createResetChatWithoutThem = (
  payload: _ResetChatWithoutThemPayload
): ResetChatWithoutThemPayload => ({payload, type: resetChatWithoutThem})
export const createResetLetThemIn = (payload: _ResetLetThemInPayload): ResetLetThemInPayload => ({
  payload,
  type: resetLetThemIn,
})
export const createSelectConversation = (payload: _SelectConversationPayload): SelectConversationPayload => ({
  payload,
  type: selectConversation,
})
export const createSendTyping = (payload: _SendTypingPayload): SendTypingPayload => ({
  payload,
  type: sendTyping,
})
export const createSetConversationOffline = (
  payload: _SetConversationOfflinePayload
): SetConversationOfflinePayload => ({payload, type: setConversationOffline})
export const createToggleInfoPanel = (payload: _ToggleInfoPanelPayload): ToggleInfoPanelPayload => ({
  payload,
  type: toggleInfoPanel,
})
export const createToggleSmallTeamsExpanded = (
  payload: _ToggleSmallTeamsExpandedPayload
): ToggleSmallTeamsExpandedPayload => ({payload, type: toggleSmallTeamsExpanded})
export const createUnhideConversation = (payload: _UnhideConversationPayload): UnhideConversationPayload => ({
  payload,
  type: unhideConversation,
})
export const createUpdateMoreToLoad = (payload: _UpdateMoreToLoadPayload): UpdateMoreToLoadPayload => ({
  payload,
  type: updateMoreToLoad,
})
export const createUpdateNotificationSettings = (
  payload: _UpdateNotificationSettingsPayload
): UpdateNotificationSettingsPayload => ({payload, type: updateNotificationSettings})
export const createUpdateUserReacjis = (payload: _UpdateUserReacjisPayload): UpdateUserReacjisPayload => ({
  payload,
  type: updateUserReacjis,
})

// Action Payloads
export type AddAttachmentViewMessagePayload = {
  readonly payload: _AddAttachmentViewMessagePayload
  readonly type: typeof addAttachmentViewMessage
}
export type AddUsersToChannelPayload = {
  readonly payload: _AddUsersToChannelPayload
  readonly type: typeof addUsersToChannel
}
export type AttachmentDownloadPayload = {
  readonly payload: _AttachmentDownloadPayload
  readonly type: typeof attachmentDownload
}
export type AttachmentDownloadedPayload = {
  readonly payload: _AttachmentDownloadedPayload
  readonly type: typeof attachmentDownloaded
}
export type AttachmentDownloadedPayloadError = {
  readonly error: true
  readonly payload: _AttachmentDownloadedPayloadError
  readonly type: typeof attachmentDownloaded
}
export type AttachmentFullscreenNextPayload = {
  readonly payload: _AttachmentFullscreenNextPayload
  readonly type: typeof attachmentFullscreenNext
}
export type AttachmentFullscreenSelectionPayload = {
  readonly payload: _AttachmentFullscreenSelectionPayload
  readonly type: typeof attachmentFullscreenSelection
}
export type AttachmentLoadingPayload = {
  readonly payload: _AttachmentLoadingPayload
  readonly type: typeof attachmentLoading
}
export type AttachmentMobileSavePayload = {
  readonly payload: _AttachmentMobileSavePayload
  readonly type: typeof attachmentMobileSave
}
export type AttachmentMobileSavedPayload = {
  readonly payload: _AttachmentMobileSavedPayload
  readonly type: typeof attachmentMobileSaved
}
export type AttachmentPastedPayload = {
  readonly payload: _AttachmentPastedPayload
  readonly type: typeof attachmentPasted
}
export type AttachmentPreviewSelectPayload = {
  readonly payload: _AttachmentPreviewSelectPayload
  readonly type: typeof attachmentPreviewSelect
}
export type AttachmentUploadedPayload = {
  readonly payload: _AttachmentUploadedPayload
  readonly type: typeof attachmentUploaded
}
export type AttachmentUploadingPayload = {
  readonly payload: _AttachmentUploadingPayload
  readonly type: typeof attachmentUploading
}
export type AttachmentsUploadPayload = {
  readonly payload: _AttachmentsUploadPayload
  readonly type: typeof attachmentsUpload
}
export type BadgesUpdatedPayload = {
  readonly payload: _BadgesUpdatedPayload
  readonly type: typeof badgesUpdated
}
export type BlockConversationPayload = {
  readonly payload: _BlockConversationPayload
  readonly type: typeof blockConversation
}
export type ChangeFocusPayload = {readonly payload: _ChangeFocusPayload; readonly type: typeof changeFocus}
export type ClearAttachmentViewPayload = {
  readonly payload: _ClearAttachmentViewPayload
  readonly type: typeof clearAttachmentView
}
export type ClearCommandStatusInfoPayload = {
  readonly payload: _ClearCommandStatusInfoPayload
  readonly type: typeof clearCommandStatusInfo
}
export type ClearPaymentConfirmInfoPayload = {
  readonly payload: _ClearPaymentConfirmInfoPayload
  readonly type: typeof clearPaymentConfirmInfo
}
export type ConfirmScreenResponsePayload = {
  readonly payload: _ConfirmScreenResponsePayload
  readonly type: typeof confirmScreenResponse
}
export type ConversationErroredPayload = {
  readonly payload: _ConversationErroredPayload
  readonly type: typeof conversationErrored
}
export type CreateConversationPayload = {
  readonly payload: _CreateConversationPayload
  readonly type: typeof createConversation
}
export type DeselectConversationPayload = {
  readonly payload: _DeselectConversationPayload
  readonly type: typeof deselectConversation
}
export type DesktopNotificationPayload = {
  readonly payload: _DesktopNotificationPayload
  readonly type: typeof desktopNotification
}
export type GiphyGotSearchResultPayload = {
  readonly payload: _GiphyGotSearchResultPayload
  readonly type: typeof giphyGotSearchResult
}
export type GiphySendPayload = {readonly payload: _GiphySendPayload; readonly type: typeof giphySend}
export type GiphyToggleWindowPayload = {
  readonly payload: _GiphyToggleWindowPayload
  readonly type: typeof giphyToggleWindow
}
export type HandleSeeingWalletsPayload = {
  readonly payload: _HandleSeeingWalletsPayload
  readonly type: typeof handleSeeingWallets
}
export type HideConversationPayload = {
  readonly payload: _HideConversationPayload
  readonly type: typeof hideConversation
}
export type InboxRefreshPayload = {readonly payload: _InboxRefreshPayload; readonly type: typeof inboxRefresh}
export type InboxSearchMoveSelectedIndexPayload = {
  readonly payload: _InboxSearchMoveSelectedIndexPayload
  readonly type: typeof inboxSearchMoveSelectedIndex
}
export type InboxSearchNameResultsPayload = {
  readonly payload: _InboxSearchNameResultsPayload
  readonly type: typeof inboxSearchNameResults
}
export type InboxSearchPayload = {readonly payload: _InboxSearchPayload; readonly type: typeof inboxSearch}
export type InboxSearchSelectPayload = {
  readonly payload: _InboxSearchSelectPayload
  readonly type: typeof inboxSearchSelect
}
export type InboxSearchSetIndexPercentPayload = {
  readonly payload: _InboxSearchSetIndexPercentPayload
  readonly type: typeof inboxSearchSetIndexPercent
}
export type InboxSearchSetTextStatusPayload = {
  readonly payload: _InboxSearchSetTextStatusPayload
  readonly type: typeof inboxSearchSetTextStatus
}
export type InboxSearchStartedPayload = {
  readonly payload: _InboxSearchStartedPayload
  readonly type: typeof inboxSearchStarted
}
export type InboxSearchTextResultPayload = {
  readonly payload: _InboxSearchTextResultPayload
  readonly type: typeof inboxSearchTextResult
}
export type JoinConversationPayload = {
  readonly payload: _JoinConversationPayload
  readonly type: typeof joinConversation
}
export type JumpToRecentPayload = {readonly payload: _JumpToRecentPayload; readonly type: typeof jumpToRecent}
export type LeaveConversationPayload = {
  readonly payload: _LeaveConversationPayload
  readonly type: typeof leaveConversation
}
export type LoadAttachmentViewPayload = {
  readonly payload: _LoadAttachmentViewPayload
  readonly type: typeof loadAttachmentView
}
export type LoadMessagesCenteredPayload = {
  readonly payload: _LoadMessagesCenteredPayload
  readonly type: typeof loadMessagesCentered
}
export type LoadNewerMessagesDueToScrollPayload = {
  readonly payload: _LoadNewerMessagesDueToScrollPayload
  readonly type: typeof loadNewerMessagesDueToScroll
}
export type LoadOlderMessagesDueToScrollPayload = {
  readonly payload: _LoadOlderMessagesDueToScrollPayload
  readonly type: typeof loadOlderMessagesDueToScroll
}
export type MarkConversationsStalePayload = {
  readonly payload: _MarkConversationsStalePayload
  readonly type: typeof markConversationsStale
}
export type MarkInitiallyLoadedThreadAsReadPayload = {
  readonly payload: _MarkInitiallyLoadedThreadAsReadPayload
  readonly type: typeof markInitiallyLoadedThreadAsRead
}
export type MessageAttachmentNativeSavePayload = {
  readonly payload: _MessageAttachmentNativeSavePayload
  readonly type: typeof messageAttachmentNativeSave
}
export type MessageAttachmentNativeSharePayload = {
  readonly payload: _MessageAttachmentNativeSharePayload
  readonly type: typeof messageAttachmentNativeShare
}
export type MessageAttachmentUploadedPayload = {
  readonly payload: _MessageAttachmentUploadedPayload
  readonly type: typeof messageAttachmentUploaded
}
export type MessageDeleteHistoryPayload = {
  readonly payload: _MessageDeleteHistoryPayload
  readonly type: typeof messageDeleteHistory
}
export type MessageDeletePayload = {
  readonly payload: _MessageDeletePayload
  readonly type: typeof messageDelete
}
export type MessageEditPayload = {readonly payload: _MessageEditPayload; readonly type: typeof messageEdit}
export type MessageErroredPayload = {
  readonly payload: _MessageErroredPayload
  readonly type: typeof messageErrored
}
export type MessageReplyPrivatelyPayload = {
  readonly payload: _MessageReplyPrivatelyPayload
  readonly type: typeof messageReplyPrivately
}
export type MessageRetryPayload = {readonly payload: _MessageRetryPayload; readonly type: typeof messageRetry}
export type MessageSendPayload = {readonly payload: _MessageSendPayload; readonly type: typeof messageSend}
export type MessageSetEditingPayload = {
  readonly payload: _MessageSetEditingPayload
  readonly type: typeof messageSetEditing
}
export type MessageSetQuotingPayload = {
  readonly payload: _MessageSetQuotingPayload
  readonly type: typeof messageSetQuoting
}
export type MessageWasEditedPayload = {
  readonly payload: _MessageWasEditedPayload
  readonly type: typeof messageWasEdited
}
export type MessagesAddPayload = {readonly payload: _MessagesAddPayload; readonly type: typeof messagesAdd}
export type MessagesExplodedPayload = {
  readonly payload: _MessagesExplodedPayload
  readonly type: typeof messagesExploded
}
export type MessagesWereDeletedPayload = {
  readonly payload: _MessagesWereDeletedPayload
  readonly type: typeof messagesWereDeleted
}
export type MetaDeletePayload = {readonly payload: _MetaDeletePayload; readonly type: typeof metaDelete}
export type MetaHandleQueuePayload = {
  readonly payload: _MetaHandleQueuePayload
  readonly type: typeof metaHandleQueue
}
export type MetaNeedsUpdatingPayload = {
  readonly payload: _MetaNeedsUpdatingPayload
  readonly type: typeof metaNeedsUpdating
}
export type MetaReceivedErrorPayload = {
  readonly payload: _MetaReceivedErrorPayload
  readonly type: typeof metaReceivedError
}
export type MetaRequestTrustedPayload = {
  readonly payload: _MetaRequestTrustedPayload
  readonly type: typeof metaRequestTrusted
}
export type MetaRequestingTrustedPayload = {
  readonly payload: _MetaRequestingTrustedPayload
  readonly type: typeof metaRequestingTrusted
}
export type MetasReceivedPayload = {
  readonly payload: _MetasReceivedPayload
  readonly type: typeof metasReceived
}
export type MuteConversationPayload = {
  readonly payload: _MuteConversationPayload
  readonly type: typeof muteConversation
}
export type NavigateToInboxPayload = {
  readonly payload: _NavigateToInboxPayload
  readonly type: typeof navigateToInbox
}
export type NavigateToThreadPayload = {
  readonly payload: _NavigateToThreadPayload
  readonly type: typeof navigateToThread
}
export type NotificationSettingsUpdatedPayload = {
  readonly payload: _NotificationSettingsUpdatedPayload
  readonly type: typeof notificationSettingsUpdated
}
export type OpenChatFromWidgetPayload = {
  readonly payload: _OpenChatFromWidgetPayload
  readonly type: typeof openChatFromWidget
}
export type OpenFolderPayload = {readonly payload: _OpenFolderPayload; readonly type: typeof openFolder}
export type PaymentInfoReceivedPayload = {
  readonly payload: _PaymentInfoReceivedPayload
  readonly type: typeof paymentInfoReceived
}
export type PendingMessageWasEditedPayload = {
  readonly payload: _PendingMessageWasEditedPayload
  readonly type: typeof pendingMessageWasEdited
}
export type PrepareFulfillRequestFormPayload = {
  readonly payload: _PrepareFulfillRequestFormPayload
  readonly type: typeof prepareFulfillRequestForm
}
export type PreviewConversationPayload = {
  readonly payload: _PreviewConversationPayload
  readonly type: typeof previewConversation
}
export type ReplyJumpPayload = {readonly payload: _ReplyJumpPayload; readonly type: typeof replyJump}
export type RequestInfoReceivedPayload = {
  readonly payload: _RequestInfoReceivedPayload
  readonly type: typeof requestInfoReceived
}
export type ResetChatWithoutThemPayload = {
  readonly payload: _ResetChatWithoutThemPayload
  readonly type: typeof resetChatWithoutThem
}
export type ResetLetThemInPayload = {
  readonly payload: _ResetLetThemInPayload
  readonly type: typeof resetLetThemIn
}
export type ResolveMaybeMentionPayload = {
  readonly payload: _ResolveMaybeMentionPayload
  readonly type: typeof resolveMaybeMention
}
export type SaveMinWriterRolePayload = {
  readonly payload: _SaveMinWriterRolePayload
  readonly type: typeof saveMinWriterRole
}
export type SelectConversationPayload = {
  readonly payload: _SelectConversationPayload
  readonly type: typeof selectConversation
}
export type SendTypingPayload = {readonly payload: _SendTypingPayload; readonly type: typeof sendTyping}
export type SetAttachmentViewStatusPayload = {
  readonly payload: _SetAttachmentViewStatusPayload
  readonly type: typeof setAttachmentViewStatus
}
export type SetCommandMarkdownPayload = {
  readonly payload: _SetCommandMarkdownPayload
  readonly type: typeof setCommandMarkdown
}
export type SetCommandStatusInfoPayload = {
  readonly payload: _SetCommandStatusInfoPayload
  readonly type: typeof setCommandStatusInfo
}
export type SetContainsLastMessagePayload = {
  readonly payload: _SetContainsLastMessagePayload
  readonly type: typeof setContainsLastMessage
}
export type SetConvExplodingModePayload = {
  readonly payload: _SetConvExplodingModePayload
  readonly type: typeof setConvExplodingMode
}
export type SetConvRetentionPolicyPayload = {
  readonly payload: _SetConvRetentionPolicyPayload
  readonly type: typeof setConvRetentionPolicy
}
export type SetConversationOfflinePayload = {
  readonly payload: _SetConversationOfflinePayload
  readonly type: typeof setConversationOffline
}
export type SetExplodingModeLockPayload = {
  readonly payload: _SetExplodingModeLockPayload
  readonly type: typeof setExplodingModeLock
}
export type SetInboxShowIsNewPayload = {
  readonly payload: _SetInboxShowIsNewPayload
  readonly type: typeof setInboxShowIsNew
}
export type SetMaybeMentionInfoPayload = {
  readonly payload: _SetMaybeMentionInfoPayload
  readonly type: typeof setMaybeMentionInfo
}
export type SetMinWriterRolePayload = {
  readonly payload: _SetMinWriterRolePayload
  readonly type: typeof setMinWriterRole
}
export type SetPaymentConfirmInfoPayload = {
  readonly payload: _SetPaymentConfirmInfoPayload
  readonly type: typeof setPaymentConfirmInfo
}
export type SetPaymentConfirmInfoPayloadError = {
  readonly error: true
  readonly payload: _SetPaymentConfirmInfoPayloadError
  readonly type: typeof setPaymentConfirmInfo
}
export type SetPrependTextPayload = {
  readonly payload: _SetPrependTextPayload
  readonly type: typeof setPrependText
}
export type SetThreadLoadStatusPayload = {
  readonly payload: _SetThreadLoadStatusPayload
  readonly type: typeof setThreadLoadStatus
}
export type SetThreadSearchQueryPayload = {
  readonly payload: _SetThreadSearchQueryPayload
  readonly type: typeof setThreadSearchQuery
}
export type SetThreadSearchStatusPayload = {
  readonly payload: _SetThreadSearchStatusPayload
  readonly type: typeof setThreadSearchStatus
}
export type SetUnsentTextPayload = {
  readonly payload: _SetUnsentTextPayload
  readonly type: typeof setUnsentText
}
export type SetWalletsOldPayload = {
  readonly payload: _SetWalletsOldPayload
  readonly type: typeof setWalletsOld
}
export type StaticConfigLoadedPayload = {
  readonly payload: _StaticConfigLoadedPayload
  readonly type: typeof staticConfigLoaded
}
export type TabSelectedPayload = {readonly payload: _TabSelectedPayload; readonly type: typeof tabSelected}
export type ThreadSearchPayload = {readonly payload: _ThreadSearchPayload; readonly type: typeof threadSearch}
export type ThreadSearchResultsPayload = {
  readonly payload: _ThreadSearchResultsPayload
  readonly type: typeof threadSearchResults
}
export type ToggleInboxSearchPayload = {
  readonly payload: _ToggleInboxSearchPayload
  readonly type: typeof toggleInboxSearch
}
export type ToggleInfoPanelPayload = {
  readonly payload: _ToggleInfoPanelPayload
  readonly type: typeof toggleInfoPanel
}
export type ToggleLocalReactionPayload = {
  readonly payload: _ToggleLocalReactionPayload
  readonly type: typeof toggleLocalReaction
}
export type ToggleMessageCollapsePayload = {
  readonly payload: _ToggleMessageCollapsePayload
  readonly type: typeof toggleMessageCollapse
}
export type ToggleMessageReactionPayload = {
  readonly payload: _ToggleMessageReactionPayload
  readonly type: typeof toggleMessageReaction
}
export type ToggleReplyToMessagePayload = {
  readonly payload: _ToggleReplyToMessagePayload
  readonly type: typeof toggleReplyToMessage
}
export type ToggleSmallTeamsExpandedPayload = {
  readonly payload: _ToggleSmallTeamsExpandedPayload
  readonly type: typeof toggleSmallTeamsExpanded
}
export type ToggleThreadSearchPayload = {
  readonly payload: _ToggleThreadSearchPayload
  readonly type: typeof toggleThreadSearch
}
export type UnfurlRemovePayload = {readonly payload: _UnfurlRemovePayload; readonly type: typeof unfurlRemove}
export type UnfurlResolvePromptPayload = {
  readonly payload: _UnfurlResolvePromptPayload
  readonly type: typeof unfurlResolvePrompt
}
export type UnfurlTogglePromptPayload = {
  readonly payload: _UnfurlTogglePromptPayload
  readonly type: typeof unfurlTogglePrompt
}
export type UnhideConversationPayload = {
  readonly payload: _UnhideConversationPayload
  readonly type: typeof unhideConversation
}
export type UnsentTextChangedPayload = {
  readonly payload: _UnsentTextChangedPayload
  readonly type: typeof unsentTextChanged
}
export type UpdateCoinFlipStatusPayload = {
  readonly payload: _UpdateCoinFlipStatusPayload
  readonly type: typeof updateCoinFlipStatus
}
export type UpdateConvExplodingModesPayload = {
  readonly payload: _UpdateConvExplodingModesPayload
  readonly type: typeof updateConvExplodingModes
}
export type UpdateConvRetentionPolicyPayload = {
  readonly payload: _UpdateConvRetentionPolicyPayload
  readonly type: typeof updateConvRetentionPolicy
}
export type UpdateMessagesPayload = {
  readonly payload: _UpdateMessagesPayload
  readonly type: typeof updateMessages
}
export type UpdateMoreToLoadPayload = {
  readonly payload: _UpdateMoreToLoadPayload
  readonly type: typeof updateMoreToLoad
}
export type UpdateNotificationSettingsPayload = {
  readonly payload: _UpdateNotificationSettingsPayload
  readonly type: typeof updateNotificationSettings
}
export type UpdateReactionsPayload = {
  readonly payload: _UpdateReactionsPayload
  readonly type: typeof updateReactions
}
export type UpdateTeamRetentionPolicyPayload = {
  readonly payload: _UpdateTeamRetentionPolicyPayload
  readonly type: typeof updateTeamRetentionPolicy
}
export type UpdateUnreadlinePayload = {
  readonly payload: _UpdateUnreadlinePayload
  readonly type: typeof updateUnreadline
}
export type UpdateUserReacjisPayload = {
  readonly payload: _UpdateUserReacjisPayload
  readonly type: typeof updateUserReacjis
}

// All Actions
// prettier-ignore
export type Actions =
  | AddAttachmentViewMessagePayload
  | AddUsersToChannelPayload
  | AttachmentDownloadPayload
  | AttachmentDownloadedPayload
  | AttachmentDownloadedPayloadError
  | AttachmentFullscreenNextPayload
  | AttachmentFullscreenSelectionPayload
  | AttachmentLoadingPayload
  | AttachmentMobileSavePayload
  | AttachmentMobileSavedPayload
  | AttachmentPastedPayload
  | AttachmentPreviewSelectPayload
  | AttachmentUploadedPayload
  | AttachmentUploadingPayload
  | AttachmentsUploadPayload
  | BadgesUpdatedPayload
  | BlockConversationPayload
  | ChangeFocusPayload
  | ClearAttachmentViewPayload
  | ClearCommandStatusInfoPayload
  | ClearPaymentConfirmInfoPayload
  | ConfirmScreenResponsePayload
  | ConversationErroredPayload
  | CreateConversationPayload
  | DeselectConversationPayload
  | DesktopNotificationPayload
  | GiphyGotSearchResultPayload
  | GiphySendPayload
  | GiphyToggleWindowPayload
  | HandleSeeingWalletsPayload
  | HideConversationPayload
  | InboxRefreshPayload
  | InboxSearchMoveSelectedIndexPayload
  | InboxSearchNameResultsPayload
  | InboxSearchPayload
  | InboxSearchSelectPayload
  | InboxSearchSetIndexPercentPayload
  | InboxSearchSetTextStatusPayload
  | InboxSearchStartedPayload
  | InboxSearchTextResultPayload
  | JoinConversationPayload
  | JumpToRecentPayload
  | LeaveConversationPayload
  | LoadAttachmentViewPayload
  | LoadMessagesCenteredPayload
  | LoadNewerMessagesDueToScrollPayload
  | LoadOlderMessagesDueToScrollPayload
  | MarkConversationsStalePayload
  | MarkInitiallyLoadedThreadAsReadPayload
  | MessageAttachmentNativeSavePayload
  | MessageAttachmentNativeSharePayload
  | MessageAttachmentUploadedPayload
  | MessageDeleteHistoryPayload
  | MessageDeletePayload
  | MessageEditPayload
  | MessageErroredPayload
  | MessageReplyPrivatelyPayload
  | MessageRetryPayload
  | MessageSendPayload
  | MessageSetEditingPayload
  | MessageSetQuotingPayload
  | MessageWasEditedPayload
  | MessagesAddPayload
  | MessagesExplodedPayload
  | MessagesWereDeletedPayload
  | MetaDeletePayload
  | MetaHandleQueuePayload
  | MetaNeedsUpdatingPayload
  | MetaReceivedErrorPayload
  | MetaRequestTrustedPayload
  | MetaRequestingTrustedPayload
  | MetasReceivedPayload
  | MuteConversationPayload
  | NavigateToInboxPayload
  | NavigateToThreadPayload
  | NotificationSettingsUpdatedPayload
  | OpenChatFromWidgetPayload
  | OpenFolderPayload
  | PaymentInfoReceivedPayload
  | PendingMessageWasEditedPayload
  | PrepareFulfillRequestFormPayload
  | PreviewConversationPayload
  | ReplyJumpPayload
  | RequestInfoReceivedPayload
  | ResetChatWithoutThemPayload
  | ResetLetThemInPayload
  | ResolveMaybeMentionPayload
  | SaveMinWriterRolePayload
  | SelectConversationPayload
  | SendTypingPayload
  | SetAttachmentViewStatusPayload
  | SetCommandMarkdownPayload
  | SetCommandStatusInfoPayload
  | SetContainsLastMessagePayload
  | SetConvExplodingModePayload
  | SetConvRetentionPolicyPayload
  | SetConversationOfflinePayload
  | SetExplodingModeLockPayload
  | SetInboxShowIsNewPayload
  | SetMaybeMentionInfoPayload
  | SetMinWriterRolePayload
  | SetPaymentConfirmInfoPayload
  | SetPaymentConfirmInfoPayloadError
  | SetPrependTextPayload
  | SetThreadLoadStatusPayload
  | SetThreadSearchQueryPayload
  | SetThreadSearchStatusPayload
  | SetUnsentTextPayload
  | SetWalletsOldPayload
  | StaticConfigLoadedPayload
  | TabSelectedPayload
  | ThreadSearchPayload
  | ThreadSearchResultsPayload
  | ToggleInboxSearchPayload
  | ToggleInfoPanelPayload
  | ToggleLocalReactionPayload
  | ToggleMessageCollapsePayload
  | ToggleMessageReactionPayload
  | ToggleReplyToMessagePayload
  | ToggleSmallTeamsExpandedPayload
  | ToggleThreadSearchPayload
  | UnfurlRemovePayload
  | UnfurlResolvePromptPayload
  | UnfurlTogglePromptPayload
  | UnhideConversationPayload
  | UnsentTextChangedPayload
  | UpdateCoinFlipStatusPayload
  | UpdateConvExplodingModesPayload
  | UpdateConvRetentionPolicyPayload
  | UpdateMessagesPayload
  | UpdateMoreToLoadPayload
  | UpdateNotificationSettingsPayload
  | UpdateReactionsPayload
  | UpdateTeamRetentionPolicyPayload
  | UpdateUnreadlinePayload
  | UpdateUserReacjisPayload
  | {type: 'common:resetStore', payload: {}}
