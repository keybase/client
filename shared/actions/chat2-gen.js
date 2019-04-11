// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import * as TeamsTypes from '../constants/types/teams'
import HiddenString from '../util/hidden-string'
import type {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'chat2:'
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
export const clearPaymentConfirmInfo = 'chat2:clearPaymentConfirmInfo'
export const confirmScreenResponse = 'chat2:confirmScreenResponse'
export const createConversation = 'chat2:createConversation'
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
export const joinConversation = 'chat2:joinConversation'
export const jumpToRecent = 'chat2:jumpToRecent'
export const leaveConversation = 'chat2:leaveConversation'
export const loadMessagesFromSearchHit = 'chat2:loadMessagesFromSearchHit'
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
export const requestInfoReceived = 'chat2:requestInfoReceived'
export const resetChatWithoutThem = 'chat2:resetChatWithoutThem'
export const resetLetThemIn = 'chat2:resetLetThemIn'
export const saveMinWriterRole = 'chat2:saveMinWriterRole'
export const selectConversation = 'chat2:selectConversation'
export const sendTyping = 'chat2:sendTyping'
export const setCommandMarkdown = 'chat2:setCommandMarkdown'
export const setContainsLastMessage = 'chat2:setContainsLastMessage'
export const setConvExplodingMode = 'chat2:setConvExplodingMode'
export const setConvRetentionPolicy = 'chat2:setConvRetentionPolicy'
export const setConversationOffline = 'chat2:setConversationOffline'
export const setExplodingModeLock = 'chat2:setExplodingModeLock'
export const setInboxFilter = 'chat2:setInboxFilter'
export const setMinWriterRole = 'chat2:setMinWriterRole'
export const setPaymentConfirmInfo = 'chat2:setPaymentConfirmInfo'
export const setPendingConversationExistingConversationIDKey = 'chat2:setPendingConversationExistingConversationIDKey'
export const setPendingConversationUsers = 'chat2:setPendingConversationUsers'
export const setPendingMode = 'chat2:setPendingMode'
export const setPendingStatus = 'chat2:setPendingStatus'
export const setThreadSearchStatus = 'chat2:setThreadSearchStatus'
export const setUnsentText = 'chat2:setUnsentText'
export const setWalletsOld = 'chat2:setWalletsOld'
export const staticConfigLoaded = 'chat2:staticConfigLoaded'
export const threadSearch = 'chat2:threadSearch'
export const threadSearchResult = 'chat2:threadSearchResult'
export const toggleInboxSearch = 'chat2:toggleInboxSearch'
export const toggleInfoPanel = 'chat2:toggleInfoPanel'
export const toggleLocalReaction = 'chat2:toggleLocalReaction'
export const toggleMessageCollapse = 'chat2:toggleMessageCollapse'
export const toggleMessageReaction = 'chat2:toggleMessageReaction'
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

// Payload Types
type _AddUsersToChannelPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, usernames: Array<string>|}>
type _AttachmentDownloadPayload = $ReadOnly<{|message: Types.Message|}>
type _AttachmentDownloadedPayload = $ReadOnly<{|message: Types.Message, path?: string|}>
type _AttachmentDownloadedPayloadError = $ReadOnly<{|error: string, message: Types.Message|}>
type _AttachmentFullscreenNextPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, backInTime: boolean|}>
type _AttachmentFullscreenSelectionPayload = $ReadOnly<{|message: Types.Message|}>
type _AttachmentLoadingPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, ratio: number, isPreview: boolean|}>
type _AttachmentMobileSavePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _AttachmentMobileSavedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _AttachmentPastedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, data: Buffer|}>
type _AttachmentPreviewSelectPayload = $ReadOnly<{|message: Types.MessageAttachment|}>
type _AttachmentUploadedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _AttachmentUploadingPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID, ratio: number|}>
type _AttachmentsUploadPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, paths: Array<Types.PathAndOutboxID>, titles: Array<string>|}>
type _BadgesUpdatedPayload = $ReadOnly<{|conversations: Array<RPCTypes.BadgeConversationInfo>|}>
type _BlockConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, reportUser: boolean|}>
type _ChangeFocusPayload = $ReadOnly<{|nextFocus: Types.Focus|}>
type _ClearPaymentConfirmInfoPayload = void
type _ConfirmScreenResponsePayload = $ReadOnly<{|accept: boolean|}>
type _CreateConversationPayload = $ReadOnly<{|participants: Array<string>|}>
type _DesktopNotificationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, author: string, body: string|}>
type _GiphyGotSearchResultPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, results: RPCChatTypes.GiphySearchResults|}>
type _GiphySendPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, url: HiddenString|}>
type _GiphyToggleWindowPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, show: boolean, clearInput: boolean|}>
type _HandleSeeingWalletsPayload = void
type _HideConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _InboxRefreshPayload = $ReadOnly<{|reason: 'bootstrap' | 'componentNeverLoaded' | 'inboxStale' | 'inboxSyncedClear' | 'inboxSyncedUnknown' | 'joinedAConversation' | 'leftAConversation' | 'teamTypeChanged'|}>
type _InboxSearchMoveSelectedIndexPayload = $ReadOnly<{|increment: boolean|}>
type _InboxSearchNameResultsPayload = $ReadOnly<{|results: I.List<Types.InboxSearchConvHit>|}>
type _InboxSearchPayload = $ReadOnly<{|query: HiddenString|}>
type _InboxSearchSelectPayload = void
type _JoinConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _JumpToRecentPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _LeaveConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, dontNavigateToInbox?: boolean|}>
type _LoadMessagesFromSearchHitPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID|}>
type _LoadNewerMessagesDueToScrollPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _LoadOlderMessagesDueToScrollPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _MarkConversationsStalePayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>, updateType: RPCChatTypes.StaleUpdateType|}>
type _MarkInitiallyLoadedThreadAsReadPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _MessageAttachmentNativeSavePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _MessageAttachmentNativeSharePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _MessageAttachmentUploadedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, placeholderID: RPCChatTypes.MessageID, message: Types.MessageAttachment|}>
type _MessageDeleteHistoryPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _MessageDeletePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _MessageEditPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, text: HiddenString|}>
type _MessageErroredPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, reason: string, outboxID: Types.OutboxID|}>
type _MessageReplyPrivatelyPayload = $ReadOnly<{|sourceConversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _MessageRetryPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID|}>
type _MessageSendPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, text: HiddenString|}>
type _MessageSetEditingPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: ?Types.Ordinal, editLastUser?: string|}>
type _MessageSetQuotingPayload = $ReadOnly<{|sourceConversationIDKey: Types.ConversationIDKey, targetConversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _MessageWasEditedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: RPCChatTypes.MessageID, text: HiddenString, mentionsAt: I.Set<string>, mentionsChannel: 'none' | 'all' | 'here', mentionsChannelName: I.Map<string, Types.ConversationIDKey>|}>
type _MessagesAddPayload = $ReadOnly<{|context: {type: 'sent'} | {type: 'incoming'} | {type: 'threadLoad', conversationIDKey: Types.ConversationIDKey}, messages: Array<Types.Message>, shouldClearOthers?: boolean, centeredMessageIDs?: Array<{conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID}>, forceContainsLatestCalc?: boolean|}>
type _MessagesExplodedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageIDs: Array<RPCChatTypes.MessageID>, explodedBy?: string|}>
type _MessagesWereDeletedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageIDs?: Array<RPCChatTypes.MessageID>, upToMessageID?: RPCChatTypes.MessageID, deletableMessageTypes?: I.Set<Types.MessageType>, ordinals?: Array<Types.Ordinal>|}>
type _MetaDeletePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, selectSomethingElse: boolean|}>
type _MetaHandleQueuePayload = void
type _MetaNeedsUpdatingPayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>, reason: string|}>
type _MetaReceivedErrorPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, error: ?RPCChatTypes.InboxUIItemError, username: ?string|}>
type _MetaRequestTrustedPayload = $ReadOnly<{|force?: boolean, conversationIDKeys: Array<Types.ConversationIDKey>|}>
type _MetaRequestingTrustedPayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>|}>
type _MetasReceivedPayload = $ReadOnly<{|metas: Array<Types.ConversationMeta>, removals?: Array<Types.ConversationIDKey>, neverCreate?: boolean, clearExistingMetas?: boolean, clearExistingMessages?: boolean, fromExpunge?: boolean, fromInboxRefresh?: boolean, initialTrustedLoad?: boolean|}>
type _MuteConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, muted: boolean|}>
type _NavigateToInboxPayload = $ReadOnly<{|avoidConversationID?: Types.ConversationIDKey, findNewConversation: boolean|}>
type _NavigateToThreadPayload = void
type _NotificationSettingsUpdatedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, settings: RPCChatTypes.ConversationNotificationInfo|}>
type _OpenChatFromWidgetPayload = $ReadOnly<{|conversationIDKey?: Types.ConversationIDKey|}>
type _OpenFolderPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _PaymentInfoReceivedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo|}>
type _PendingMessageWasEditedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, text: HiddenString|}>
type _PrepareFulfillRequestFormPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal|}>
type _PreviewConversationPayload = $ReadOnly<{|participants?: Array<string>, teamname?: string, channelname?: string, conversationIDKey?: Types.ConversationIDKey, reason: 'manageView' | 'messageLink' | 'resetChatWithoutThem' | 'tracker' | 'teamHeader' | 'files' | 'teamInvite' | 'fromAReset' | 'profile' | 'teamMember' | 'teamHeader' | 'convertAdHoc' | 'memberView' | 'newChannel' | 'transaction' | 'requestedPayment'|}>
type _RequestInfoReceivedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo|}>
type _ResetChatWithoutThemPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _ResetLetThemInPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, username: string|}>
type _SaveMinWriterRolePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, role: TeamsTypes.TeamRoleType|}>
type _SelectConversationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  reason: 'clearSelected' | 'desktopNotification' | 'setPendingMode' | 'sendingToPending' | 'createdMessagePrivately' | 'extension' | 'files' | 'findNewestConversation' | 'inboxBig' | 'inboxFilterArrow' | 'inboxFilterChanged' | 'inboxSmall' | 'inboxNewConversation' | 'jumpFromReset' | 'jumpToReset' | 'justCreated' | 'manageView' | 'previewResolved' | 'pendingModeChange' | 'push' | 'savedLastState' | 'startFoundExisting' | 'teamChat' | 'addedToChannel',
|}>
type _SendTypingPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, typing: boolean|}>
type _SetCommandMarkdownPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, md: ?RPCChatTypes.UICommandMarkdown|}>
type _SetContainsLastMessagePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, contains: boolean|}>
type _SetConvExplodingModePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, seconds: number|}>
type _SetConvRetentionPolicyPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, policy: RetentionPolicy|}>
type _SetConversationOfflinePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, offline: boolean|}>
type _SetExplodingModeLockPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, unset?: boolean|}>
type _SetInboxFilterPayload = $ReadOnly<{|filter: string|}>
type _SetMinWriterRolePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, role: TeamsTypes.TeamRoleType|}>
type _SetPaymentConfirmInfoPayload = $ReadOnly<{|summary: RPCChatTypes.UIChatPaymentSummary|}>
type _SetPaymentConfirmInfoPayloadError = $ReadOnly<{|error: RPCTypes.Status|}>
type _SetPendingConversationExistingConversationIDKeyPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _SetPendingConversationUsersPayload = $ReadOnly<{|users: Array<string>, fromSearch: boolean|}>
type _SetPendingModePayload = $ReadOnly<{|pendingMode: Types.PendingMode, noneDestination?: 'inbox' | 'thread'|}>
type _SetPendingStatusPayload = $ReadOnly<{|pendingStatus: Types.PendingStatus|}>
type _SetThreadSearchStatusPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, status: Types.ThreadSearchStatus|}>
type _SetUnsentTextPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, text: ?HiddenString|}>
type _SetWalletsOldPayload = void
type _StaticConfigLoadedPayload = $ReadOnly<{|staticConfig: Types.StaticConfig|}>
type _ThreadSearchPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, query: HiddenString|}>
type _ThreadSearchResultPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, message: Types.Message|}>
type _ToggleInboxSearchPayload = $ReadOnly<{|enabled: boolean|}>
type _ToggleInfoPanelPayload = void
type _ToggleLocalReactionPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, emoji: string, targetOrdinal: Types.Ordinal, username: string|}>
type _ToggleMessageCollapsePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, collapse: boolean|}>
type _ToggleMessageReactionPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, emoji: string, ordinal: Types.Ordinal|}>
type _ToggleSmallTeamsExpandedPayload = void
type _ToggleThreadSearchPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _UnfurlRemovePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID|}>
type _UnfurlResolvePromptPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, domain: string, result: RPCChatTypes.UnfurlPromptResult|}>
type _UnfurlTogglePromptPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, domain: string, show: boolean|}>
type _UnhideConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _UnsentTextChangedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, text: HiddenString|}>
type _UpdateCoinFlipStatusPayload = $ReadOnly<{|statuses: Array<RPCChatTypes.UICoinFlipStatus>|}>
type _UpdateConvExplodingModesPayload = $ReadOnly<{|modes: Array<{conversationIDKey: Types.ConversationIDKey, seconds: number}>|}>
type _UpdateConvRetentionPolicyPayload = $ReadOnly<{|conv: RPCChatTypes.InboxUIItem|}>
type _UpdateMessagesPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messages: Array<{messageID: Types.MessageID, message: Types.Message}>|}>
type _UpdateMoreToLoadPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, moreToLoad: boolean|}>
type _UpdateNotificationSettingsPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, notificationsDesktop: Types.NotificationsType, notificationsMobile: Types.NotificationsType, notificationsGlobalIgnoreMentions: boolean|}>
type _UpdateReactionsPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, updates: Array<{targetMsgID: RPCChatTypes.MessageID, reactions: Types.Reactions}>|}>
type _UpdateTeamRetentionPolicyPayload = $ReadOnly<{|convs: Array<RPCChatTypes.InboxUIItem>|}>
type _UpdateUnreadlinePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID|}>

// Action Creators
/**
 * Actually start a conversation
 */
export const createCreateConversation = (payload: _CreateConversationPayload) => ({payload, type: createConversation})
/**
 * Add a list of users to a conversation. Creates a SystemBulkAddToConv message.
 */
export const createAddUsersToChannel = (payload: _AddUsersToChannelPayload) => ({payload, type: addUsersToChannel})
/**
 * Add an unfurl prompt to a message
 */
export const createUnfurlTogglePrompt = (payload: _UnfurlTogglePromptPayload) => ({payload, type: unfurlTogglePrompt})
/**
 * Change selected index of inbox search
 */
export const createInboxSearchMoveSelectedIndex = (payload: _InboxSearchMoveSelectedIndexPayload) => ({payload, type: inboxSearchMoveSelectedIndex})
/**
 * Clear data for payment confirm modal
 */
export const createClearPaymentConfirmInfo = (payload: _ClearPaymentConfirmInfoPayload) => ({payload, type: clearPaymentConfirmInfo})
/**
 * Consume a service notification that a conversation's retention policy has been updated
 */
export const createUpdateConvRetentionPolicy = (payload: _UpdateConvRetentionPolicyPayload) => ({payload, type: updateConvRetentionPolicy})
/**
 * Consume a service notification that a team retention policy was updated
 */
export const createUpdateTeamRetentionPolicy = (payload: _UpdateTeamRetentionPolicyPayload) => ({payload, type: updateTeamRetentionPolicy})
/**
 * Explicitly set whether a thread is loaded to the most recent message
 */
export const createSetContainsLastMessage = (payload: _SetContainsLastMessagePayload) => ({payload, type: setContainsLastMessage})
/**
 * Exploding messages expired or were manually detonated.
 */
export const createMessagesExploded = (payload: _MessagesExplodedPayload) => ({payload, type: messagesExploded})
/**
 * Giphy search results obtained
 */
export const createGiphyGotSearchResult = (payload: _GiphyGotSearchResultPayload) => ({payload, type: giphyGotSearchResult})
/**
 * Handle an update to our conversation exploding modes.
 */
export const createUpdateConvExplodingModes = (payload: _UpdateConvExplodingModesPayload) => ({payload, type: updateConvExplodingModes})
/**
 * Inbox search name results received
 */
export const createInboxSearchNameResults = (payload: _InboxSearchNameResultsPayload) => ({payload, type: inboxSearchNameResults})
/**
 * Jump to most recent messages in a conversation
 */
export const createJumpToRecent = (payload: _JumpToRecentPayload) => ({payload, type: jumpToRecent})
/**
 * Perform a search in a thread
 */
export const createThreadSearch = (payload: _ThreadSearchPayload) => ({payload, type: threadSearch})
/**
 * Perform an inbox search
 */
export const createInboxSearch = (payload: _InboxSearchPayload) => ({payload, type: inboxSearch})
/**
 * Prime data to fulfill this message's request and navigate to the send form.
 */
export const createPrepareFulfillRequestForm = (payload: _PrepareFulfillRequestFormPayload) => ({payload, type: prepareFulfillRequestForm})
/**
 * Record a new thread search result
 */
export const createThreadSearchResult = (payload: _ThreadSearchResultPayload) => ({payload, type: threadSearchResult})
/**
 * Remove an unfurl
 */
export const createUnfurlRemove = (payload: _UnfurlRemovePayload) => ({payload, type: unfurlRemove})
/**
 * Response to an unfurl prompt
 */
export const createUnfurlResolvePrompt = (payload: _UnfurlResolvePromptPayload) => ({payload, type: unfurlResolvePrompt})
/**
 * Select an inbox search item
 */
export const createInboxSearchSelect = (payload: _InboxSearchSelectPayload) => ({payload, type: inboxSearchSelect})
/**
 * Set a lock on the exploding mode for a conversation.
 */
export const createSetExplodingModeLock = (payload: _SetExplodingModeLockPayload) => ({payload, type: setExplodingModeLock})
/**
 * Set command markdown for a conversation
 */
export const createSetCommandMarkdown = (payload: _SetCommandMarkdownPayload) => ({payload, type: setCommandMarkdown})
/**
 * Set that wallets in chat is not new.
 */
export const createSetWalletsOld = (payload: _SetWalletsOldPayload) => ({payload, type: setWalletsOld})
/**
 * Set the collapse status of a message
 */
export const createToggleMessageCollapse = (payload: _ToggleMessageCollapsePayload) => ({payload, type: toggleMessageCollapse})
/**
 * Set the minimum role required to write into a conversation. Valid only for team conversations.
 */
export const createSetMinWriterRole = (payload: _SetMinWriterRolePayload) => ({payload, type: setMinWriterRole})
/**
 * Set the payment confirm modal payment data
 */
export const createSetPaymentConfirmInfo = (payload: _SetPaymentConfirmInfoPayload) => ({payload, type: setPaymentConfirmInfo})
export const createSetPaymentConfirmInfoError = (payload: _SetPaymentConfirmInfoPayloadError) => ({error: true, payload, type: setPaymentConfirmInfo})
/**
 * Set the remote exploding mode for a conversation.
 */
export const createSetConvExplodingMode = (payload: _SetConvExplodingModePayload) => ({payload, type: setConvExplodingMode})
/**
 * Set the status of a thread search
 */
export const createSetThreadSearchStatus = (payload: _SetThreadSearchStatusPayload) => ({payload, type: setThreadSearchStatus})
/**
 * Set unsent text for a conversation
 */
export const createSetUnsentText = (payload: _SetUnsentTextPayload) => ({payload, type: setUnsentText})
/**
 * Sets the retention policy for a conversation.
 */
export const createSetConvRetentionPolicy = (payload: _SetConvRetentionPolicyPayload) => ({payload, type: setConvRetentionPolicy})
/**
 * Static configuration info was loaded from the service.
 */
export const createStaticConfigLoaded = (payload: _StaticConfigLoadedPayload) => ({payload, type: staticConfigLoaded})
/**
 * Tell the service to toggle a reaction on a message.
 */
export const createToggleMessageReaction = (payload: _ToggleMessageReactionPayload) => ({payload, type: toggleMessageReaction})
/**
 * The service sent us an update for the reaction map of a message.
 */
export const createUpdateReactions = (payload: _UpdateReactionsPayload) => ({payload, type: updateReactions})
/**
 * The user has interacted with wallets in chat.
 */
export const createHandleSeeingWallets = (payload: _HandleSeeingWalletsPayload) => ({payload, type: handleSeeingWallets})
/**
 * Toggle Giphy search preview window
 */
export const createGiphyToggleWindow = (payload: _GiphyToggleWindowPayload) => ({payload, type: giphyToggleWindow})
/**
 * Toggle a reaction in the store.
 */
export const createToggleLocalReaction = (payload: _ToggleLocalReactionPayload) => ({payload, type: toggleLocalReaction})
/**
 * Toggle inbox search view
 */
export const createToggleInboxSearch = (payload: _ToggleInboxSearchPayload) => ({payload, type: toggleInboxSearch})
/**
 * Toggle the display of the thread search window
 */
export const createToggleThreadSearch = (payload: _ToggleThreadSearchPayload) => ({payload, type: toggleThreadSearch})
/**
 * Unsent text changed
 */
export const createUnsentTextChanged = (payload: _UnsentTextChangedPayload) => ({payload, type: unsentTextChanged})
/**
 * Update messages that we might have in the store
 */
export const createUpdateMessages = (payload: _UpdateMessagesPayload) => ({payload, type: updateMessages})
/**
 * Update status of a coin flip game
 */
export const createUpdateCoinFlipStatus = (payload: _UpdateCoinFlipStatusPayload) => ({payload, type: updateCoinFlipStatus})
/**
 * Update the minWriterRole stored with the conversation metadata.
 */
export const createSaveMinWriterRole = (payload: _SaveMinWriterRolePayload) => ({payload, type: saveMinWriterRole})
/**
 * Update the unreadline line position for a conversation
 */
export const createUpdateUnreadline = (payload: _UpdateUnreadlinePayload) => ({payload, type: updateUnreadline})
/**
 * User responded to the chat Stellar confirm screen
 */
export const createConfirmScreenResponse = (payload: _ConfirmScreenResponsePayload) => ({payload, type: confirmScreenResponse})
/**
 * We received payment info for a sendPayment message
 */
export const createPaymentInfoReceived = (payload: _PaymentInfoReceivedPayload) => ({payload, type: paymentInfoReceived})
/**
 * We received request info for a requestPayment message
 */
export const createRequestInfoReceived = (payload: _RequestInfoReceivedPayload) => ({payload, type: requestInfoReceived})
/**
 * When the search changes we need to find any existing conversations to stash into the metaMap
 */
export const createSetPendingConversationExistingConversationIDKey = (payload: _SetPendingConversationExistingConversationIDKeyPayload) => ({payload, type: setPendingConversationExistingConversationIDKey})
/**
 * Where we want our focus for keypresses
 */
export const createChangeFocus = (payload: _ChangeFocusPayload) => ({payload, type: changeFocus})
/**
 * send a message from Giphy search
 */
export const createGiphySend = (payload: _GiphySendPayload) => ({payload, type: giphySend})
export const createAttachmentDownload = (payload: _AttachmentDownloadPayload) => ({payload, type: attachmentDownload})
export const createAttachmentDownloaded = (payload: _AttachmentDownloadedPayload) => ({payload, type: attachmentDownloaded})
export const createAttachmentDownloadedError = (payload: _AttachmentDownloadedPayloadError) => ({error: true, payload, type: attachmentDownloaded})
export const createAttachmentFullscreenNext = (payload: _AttachmentFullscreenNextPayload) => ({payload, type: attachmentFullscreenNext})
export const createAttachmentFullscreenSelection = (payload: _AttachmentFullscreenSelectionPayload) => ({payload, type: attachmentFullscreenSelection})
export const createAttachmentLoading = (payload: _AttachmentLoadingPayload) => ({payload, type: attachmentLoading})
export const createAttachmentMobileSave = (payload: _AttachmentMobileSavePayload) => ({payload, type: attachmentMobileSave})
export const createAttachmentMobileSaved = (payload: _AttachmentMobileSavedPayload) => ({payload, type: attachmentMobileSaved})
export const createAttachmentPasted = (payload: _AttachmentPastedPayload) => ({payload, type: attachmentPasted})
export const createAttachmentPreviewSelect = (payload: _AttachmentPreviewSelectPayload) => ({payload, type: attachmentPreviewSelect})
export const createAttachmentUploaded = (payload: _AttachmentUploadedPayload) => ({payload, type: attachmentUploaded})
export const createAttachmentUploading = (payload: _AttachmentUploadingPayload) => ({payload, type: attachmentUploading})
export const createAttachmentsUpload = (payload: _AttachmentsUploadPayload) => ({payload, type: attachmentsUpload})
export const createBadgesUpdated = (payload: _BadgesUpdatedPayload) => ({payload, type: badgesUpdated})
export const createBlockConversation = (payload: _BlockConversationPayload) => ({payload, type: blockConversation})
export const createDesktopNotification = (payload: _DesktopNotificationPayload) => ({payload, type: desktopNotification})
export const createHideConversation = (payload: _HideConversationPayload) => ({payload, type: hideConversation})
export const createInboxRefresh = (payload: _InboxRefreshPayload) => ({payload, type: inboxRefresh})
export const createJoinConversation = (payload: _JoinConversationPayload) => ({payload, type: joinConversation})
export const createLeaveConversation = (payload: _LeaveConversationPayload) => ({payload, type: leaveConversation})
export const createLoadMessagesFromSearchHit = (payload: _LoadMessagesFromSearchHitPayload) => ({payload, type: loadMessagesFromSearchHit})
export const createLoadNewerMessagesDueToScroll = (payload: _LoadNewerMessagesDueToScrollPayload) => ({payload, type: loadNewerMessagesDueToScroll})
export const createLoadOlderMessagesDueToScroll = (payload: _LoadOlderMessagesDueToScrollPayload) => ({payload, type: loadOlderMessagesDueToScroll})
export const createMarkConversationsStale = (payload: _MarkConversationsStalePayload) => ({payload, type: markConversationsStale})
export const createMarkInitiallyLoadedThreadAsRead = (payload: _MarkInitiallyLoadedThreadAsReadPayload) => ({payload, type: markInitiallyLoadedThreadAsRead})
export const createMessageAttachmentNativeSave = (payload: _MessageAttachmentNativeSavePayload) => ({payload, type: messageAttachmentNativeSave})
export const createMessageAttachmentNativeShare = (payload: _MessageAttachmentNativeSharePayload) => ({payload, type: messageAttachmentNativeShare})
export const createMessageAttachmentUploaded = (payload: _MessageAttachmentUploadedPayload) => ({payload, type: messageAttachmentUploaded})
export const createMessageDelete = (payload: _MessageDeletePayload) => ({payload, type: messageDelete})
export const createMessageDeleteHistory = (payload: _MessageDeleteHistoryPayload) => ({payload, type: messageDeleteHistory})
export const createMessageEdit = (payload: _MessageEditPayload) => ({payload, type: messageEdit})
export const createMessageErrored = (payload: _MessageErroredPayload) => ({payload, type: messageErrored})
export const createMessageReplyPrivately = (payload: _MessageReplyPrivatelyPayload) => ({payload, type: messageReplyPrivately})
export const createMessageRetry = (payload: _MessageRetryPayload) => ({payload, type: messageRetry})
export const createMessageSend = (payload: _MessageSendPayload) => ({payload, type: messageSend})
export const createMessageSetEditing = (payload: _MessageSetEditingPayload) => ({payload, type: messageSetEditing})
export const createMessageSetQuoting = (payload: _MessageSetQuotingPayload) => ({payload, type: messageSetQuoting})
export const createMessageWasEdited = (payload: _MessageWasEditedPayload) => ({payload, type: messageWasEdited})
export const createMessagesAdd = (payload: _MessagesAddPayload) => ({payload, type: messagesAdd})
export const createMessagesWereDeleted = (payload: _MessagesWereDeletedPayload) => ({payload, type: messagesWereDeleted})
export const createMetaDelete = (payload: _MetaDeletePayload) => ({payload, type: metaDelete})
export const createMetaHandleQueue = (payload: _MetaHandleQueuePayload) => ({payload, type: metaHandleQueue})
export const createMetaNeedsUpdating = (payload: _MetaNeedsUpdatingPayload) => ({payload, type: metaNeedsUpdating})
export const createMetaReceivedError = (payload: _MetaReceivedErrorPayload) => ({payload, type: metaReceivedError})
export const createMetaRequestTrusted = (payload: _MetaRequestTrustedPayload) => ({payload, type: metaRequestTrusted})
export const createMetaRequestingTrusted = (payload: _MetaRequestingTrustedPayload) => ({payload, type: metaRequestingTrusted})
export const createMetasReceived = (payload: _MetasReceivedPayload) => ({payload, type: metasReceived})
export const createMuteConversation = (payload: _MuteConversationPayload) => ({payload, type: muteConversation})
export const createNavigateToInbox = (payload: _NavigateToInboxPayload) => ({payload, type: navigateToInbox})
export const createNavigateToThread = (payload: _NavigateToThreadPayload) => ({payload, type: navigateToThread})
export const createNotificationSettingsUpdated = (payload: _NotificationSettingsUpdatedPayload) => ({payload, type: notificationSettingsUpdated})
export const createOpenChatFromWidget = (payload: _OpenChatFromWidgetPayload) => ({payload, type: openChatFromWidget})
export const createOpenFolder = (payload: _OpenFolderPayload) => ({payload, type: openFolder})
export const createPendingMessageWasEdited = (payload: _PendingMessageWasEditedPayload) => ({payload, type: pendingMessageWasEdited})
export const createPreviewConversation = (payload: _PreviewConversationPayload) => ({payload, type: previewConversation})
export const createResetChatWithoutThem = (payload: _ResetChatWithoutThemPayload) => ({payload, type: resetChatWithoutThem})
export const createResetLetThemIn = (payload: _ResetLetThemInPayload) => ({payload, type: resetLetThemIn})
export const createSelectConversation = (payload: _SelectConversationPayload) => ({payload, type: selectConversation})
export const createSendTyping = (payload: _SendTypingPayload) => ({payload, type: sendTyping})
export const createSetConversationOffline = (payload: _SetConversationOfflinePayload) => ({payload, type: setConversationOffline})
export const createSetInboxFilter = (payload: _SetInboxFilterPayload) => ({payload, type: setInboxFilter})
export const createSetPendingConversationUsers = (payload: _SetPendingConversationUsersPayload) => ({payload, type: setPendingConversationUsers})
export const createSetPendingMode = (payload: _SetPendingModePayload) => ({payload, type: setPendingMode})
export const createSetPendingStatus = (payload: _SetPendingStatusPayload) => ({payload, type: setPendingStatus})
export const createToggleInfoPanel = (payload: _ToggleInfoPanelPayload) => ({payload, type: toggleInfoPanel})
export const createToggleSmallTeamsExpanded = (payload: _ToggleSmallTeamsExpandedPayload) => ({payload, type: toggleSmallTeamsExpanded})
export const createUnhideConversation = (payload: _UnhideConversationPayload) => ({payload, type: unhideConversation})
export const createUpdateMoreToLoad = (payload: _UpdateMoreToLoadPayload) => ({payload, type: updateMoreToLoad})
export const createUpdateNotificationSettings = (payload: _UpdateNotificationSettingsPayload) => ({payload, type: updateNotificationSettings})

// Action Payloads
export type AddUsersToChannelPayload = {|+payload: _AddUsersToChannelPayload, +type: 'chat2:addUsersToChannel'|}
export type AttachmentDownloadPayload = {|+payload: _AttachmentDownloadPayload, +type: 'chat2:attachmentDownload'|}
export type AttachmentDownloadedPayload = {|+payload: _AttachmentDownloadedPayload, +type: 'chat2:attachmentDownloaded'|}
export type AttachmentDownloadedPayloadError = {|+error: true, +payload: _AttachmentDownloadedPayloadError, +type: 'chat2:attachmentDownloaded'|}
export type AttachmentFullscreenNextPayload = {|+payload: _AttachmentFullscreenNextPayload, +type: 'chat2:attachmentFullscreenNext'|}
export type AttachmentFullscreenSelectionPayload = {|+payload: _AttachmentFullscreenSelectionPayload, +type: 'chat2:attachmentFullscreenSelection'|}
export type AttachmentLoadingPayload = {|+payload: _AttachmentLoadingPayload, +type: 'chat2:attachmentLoading'|}
export type AttachmentMobileSavePayload = {|+payload: _AttachmentMobileSavePayload, +type: 'chat2:attachmentMobileSave'|}
export type AttachmentMobileSavedPayload = {|+payload: _AttachmentMobileSavedPayload, +type: 'chat2:attachmentMobileSaved'|}
export type AttachmentPastedPayload = {|+payload: _AttachmentPastedPayload, +type: 'chat2:attachmentPasted'|}
export type AttachmentPreviewSelectPayload = {|+payload: _AttachmentPreviewSelectPayload, +type: 'chat2:attachmentPreviewSelect'|}
export type AttachmentUploadedPayload = {|+payload: _AttachmentUploadedPayload, +type: 'chat2:attachmentUploaded'|}
export type AttachmentUploadingPayload = {|+payload: _AttachmentUploadingPayload, +type: 'chat2:attachmentUploading'|}
export type AttachmentsUploadPayload = {|+payload: _AttachmentsUploadPayload, +type: 'chat2:attachmentsUpload'|}
export type BadgesUpdatedPayload = {|+payload: _BadgesUpdatedPayload, +type: 'chat2:badgesUpdated'|}
export type BlockConversationPayload = {|+payload: _BlockConversationPayload, +type: 'chat2:blockConversation'|}
export type ChangeFocusPayload = {|+payload: _ChangeFocusPayload, +type: 'chat2:changeFocus'|}
export type ClearPaymentConfirmInfoPayload = {|+payload: _ClearPaymentConfirmInfoPayload, +type: 'chat2:clearPaymentConfirmInfo'|}
export type ConfirmScreenResponsePayload = {|+payload: _ConfirmScreenResponsePayload, +type: 'chat2:confirmScreenResponse'|}
export type CreateConversationPayload = {|+payload: _CreateConversationPayload, +type: 'chat2:createConversation'|}
export type DesktopNotificationPayload = {|+payload: _DesktopNotificationPayload, +type: 'chat2:desktopNotification'|}
export type GiphyGotSearchResultPayload = {|+payload: _GiphyGotSearchResultPayload, +type: 'chat2:giphyGotSearchResult'|}
export type GiphySendPayload = {|+payload: _GiphySendPayload, +type: 'chat2:giphySend'|}
export type GiphyToggleWindowPayload = {|+payload: _GiphyToggleWindowPayload, +type: 'chat2:giphyToggleWindow'|}
export type HandleSeeingWalletsPayload = {|+payload: _HandleSeeingWalletsPayload, +type: 'chat2:handleSeeingWallets'|}
export type HideConversationPayload = {|+payload: _HideConversationPayload, +type: 'chat2:hideConversation'|}
export type InboxRefreshPayload = {|+payload: _InboxRefreshPayload, +type: 'chat2:inboxRefresh'|}
export type InboxSearchMoveSelectedIndexPayload = {|+payload: _InboxSearchMoveSelectedIndexPayload, +type: 'chat2:inboxSearchMoveSelectedIndex'|}
export type InboxSearchNameResultsPayload = {|+payload: _InboxSearchNameResultsPayload, +type: 'chat2:inboxSearchNameResults'|}
export type InboxSearchPayload = {|+payload: _InboxSearchPayload, +type: 'chat2:inboxSearch'|}
export type InboxSearchSelectPayload = {|+payload: _InboxSearchSelectPayload, +type: 'chat2:inboxSearchSelect'|}
export type JoinConversationPayload = {|+payload: _JoinConversationPayload, +type: 'chat2:joinConversation'|}
export type JumpToRecentPayload = {|+payload: _JumpToRecentPayload, +type: 'chat2:jumpToRecent'|}
export type LeaveConversationPayload = {|+payload: _LeaveConversationPayload, +type: 'chat2:leaveConversation'|}
export type LoadMessagesFromSearchHitPayload = {|+payload: _LoadMessagesFromSearchHitPayload, +type: 'chat2:loadMessagesFromSearchHit'|}
export type LoadNewerMessagesDueToScrollPayload = {|+payload: _LoadNewerMessagesDueToScrollPayload, +type: 'chat2:loadNewerMessagesDueToScroll'|}
export type LoadOlderMessagesDueToScrollPayload = {|+payload: _LoadOlderMessagesDueToScrollPayload, +type: 'chat2:loadOlderMessagesDueToScroll'|}
export type MarkConversationsStalePayload = {|+payload: _MarkConversationsStalePayload, +type: 'chat2:markConversationsStale'|}
export type MarkInitiallyLoadedThreadAsReadPayload = {|+payload: _MarkInitiallyLoadedThreadAsReadPayload, +type: 'chat2:markInitiallyLoadedThreadAsRead'|}
export type MessageAttachmentNativeSavePayload = {|+payload: _MessageAttachmentNativeSavePayload, +type: 'chat2:messageAttachmentNativeSave'|}
export type MessageAttachmentNativeSharePayload = {|+payload: _MessageAttachmentNativeSharePayload, +type: 'chat2:messageAttachmentNativeShare'|}
export type MessageAttachmentUploadedPayload = {|+payload: _MessageAttachmentUploadedPayload, +type: 'chat2:messageAttachmentUploaded'|}
export type MessageDeleteHistoryPayload = {|+payload: _MessageDeleteHistoryPayload, +type: 'chat2:messageDeleteHistory'|}
export type MessageDeletePayload = {|+payload: _MessageDeletePayload, +type: 'chat2:messageDelete'|}
export type MessageEditPayload = {|+payload: _MessageEditPayload, +type: 'chat2:messageEdit'|}
export type MessageErroredPayload = {|+payload: _MessageErroredPayload, +type: 'chat2:messageErrored'|}
export type MessageReplyPrivatelyPayload = {|+payload: _MessageReplyPrivatelyPayload, +type: 'chat2:messageReplyPrivately'|}
export type MessageRetryPayload = {|+payload: _MessageRetryPayload, +type: 'chat2:messageRetry'|}
export type MessageSendPayload = {|+payload: _MessageSendPayload, +type: 'chat2:messageSend'|}
export type MessageSetEditingPayload = {|+payload: _MessageSetEditingPayload, +type: 'chat2:messageSetEditing'|}
export type MessageSetQuotingPayload = {|+payload: _MessageSetQuotingPayload, +type: 'chat2:messageSetQuoting'|}
export type MessageWasEditedPayload = {|+payload: _MessageWasEditedPayload, +type: 'chat2:messageWasEdited'|}
export type MessagesAddPayload = {|+payload: _MessagesAddPayload, +type: 'chat2:messagesAdd'|}
export type MessagesExplodedPayload = {|+payload: _MessagesExplodedPayload, +type: 'chat2:messagesExploded'|}
export type MessagesWereDeletedPayload = {|+payload: _MessagesWereDeletedPayload, +type: 'chat2:messagesWereDeleted'|}
export type MetaDeletePayload = {|+payload: _MetaDeletePayload, +type: 'chat2:metaDelete'|}
export type MetaHandleQueuePayload = {|+payload: _MetaHandleQueuePayload, +type: 'chat2:metaHandleQueue'|}
export type MetaNeedsUpdatingPayload = {|+payload: _MetaNeedsUpdatingPayload, +type: 'chat2:metaNeedsUpdating'|}
export type MetaReceivedErrorPayload = {|+payload: _MetaReceivedErrorPayload, +type: 'chat2:metaReceivedError'|}
export type MetaRequestTrustedPayload = {|+payload: _MetaRequestTrustedPayload, +type: 'chat2:metaRequestTrusted'|}
export type MetaRequestingTrustedPayload = {|+payload: _MetaRequestingTrustedPayload, +type: 'chat2:metaRequestingTrusted'|}
export type MetasReceivedPayload = {|+payload: _MetasReceivedPayload, +type: 'chat2:metasReceived'|}
export type MuteConversationPayload = {|+payload: _MuteConversationPayload, +type: 'chat2:muteConversation'|}
export type NavigateToInboxPayload = {|+payload: _NavigateToInboxPayload, +type: 'chat2:navigateToInbox'|}
export type NavigateToThreadPayload = {|+payload: _NavigateToThreadPayload, +type: 'chat2:navigateToThread'|}
export type NotificationSettingsUpdatedPayload = {|+payload: _NotificationSettingsUpdatedPayload, +type: 'chat2:notificationSettingsUpdated'|}
export type OpenChatFromWidgetPayload = {|+payload: _OpenChatFromWidgetPayload, +type: 'chat2:openChatFromWidget'|}
export type OpenFolderPayload = {|+payload: _OpenFolderPayload, +type: 'chat2:openFolder'|}
export type PaymentInfoReceivedPayload = {|+payload: _PaymentInfoReceivedPayload, +type: 'chat2:paymentInfoReceived'|}
export type PendingMessageWasEditedPayload = {|+payload: _PendingMessageWasEditedPayload, +type: 'chat2:pendingMessageWasEdited'|}
export type PrepareFulfillRequestFormPayload = {|+payload: _PrepareFulfillRequestFormPayload, +type: 'chat2:prepareFulfillRequestForm'|}
export type PreviewConversationPayload = {|+payload: _PreviewConversationPayload, +type: 'chat2:previewConversation'|}
export type RequestInfoReceivedPayload = {|+payload: _RequestInfoReceivedPayload, +type: 'chat2:requestInfoReceived'|}
export type ResetChatWithoutThemPayload = {|+payload: _ResetChatWithoutThemPayload, +type: 'chat2:resetChatWithoutThem'|}
export type ResetLetThemInPayload = {|+payload: _ResetLetThemInPayload, +type: 'chat2:resetLetThemIn'|}
export type SaveMinWriterRolePayload = {|+payload: _SaveMinWriterRolePayload, +type: 'chat2:saveMinWriterRole'|}
export type SelectConversationPayload = {|+payload: _SelectConversationPayload, +type: 'chat2:selectConversation'|}
export type SendTypingPayload = {|+payload: _SendTypingPayload, +type: 'chat2:sendTyping'|}
export type SetCommandMarkdownPayload = {|+payload: _SetCommandMarkdownPayload, +type: 'chat2:setCommandMarkdown'|}
export type SetContainsLastMessagePayload = {|+payload: _SetContainsLastMessagePayload, +type: 'chat2:setContainsLastMessage'|}
export type SetConvExplodingModePayload = {|+payload: _SetConvExplodingModePayload, +type: 'chat2:setConvExplodingMode'|}
export type SetConvRetentionPolicyPayload = {|+payload: _SetConvRetentionPolicyPayload, +type: 'chat2:setConvRetentionPolicy'|}
export type SetConversationOfflinePayload = {|+payload: _SetConversationOfflinePayload, +type: 'chat2:setConversationOffline'|}
export type SetExplodingModeLockPayload = {|+payload: _SetExplodingModeLockPayload, +type: 'chat2:setExplodingModeLock'|}
export type SetInboxFilterPayload = {|+payload: _SetInboxFilterPayload, +type: 'chat2:setInboxFilter'|}
export type SetMinWriterRolePayload = {|+payload: _SetMinWriterRolePayload, +type: 'chat2:setMinWriterRole'|}
export type SetPaymentConfirmInfoPayload = {|+payload: _SetPaymentConfirmInfoPayload, +type: 'chat2:setPaymentConfirmInfo'|}
export type SetPaymentConfirmInfoPayloadError = {|+error: true, +payload: _SetPaymentConfirmInfoPayloadError, +type: 'chat2:setPaymentConfirmInfo'|}
export type SetPendingConversationExistingConversationIDKeyPayload = {|+payload: _SetPendingConversationExistingConversationIDKeyPayload, +type: 'chat2:setPendingConversationExistingConversationIDKey'|}
export type SetPendingConversationUsersPayload = {|+payload: _SetPendingConversationUsersPayload, +type: 'chat2:setPendingConversationUsers'|}
export type SetPendingModePayload = {|+payload: _SetPendingModePayload, +type: 'chat2:setPendingMode'|}
export type SetPendingStatusPayload = {|+payload: _SetPendingStatusPayload, +type: 'chat2:setPendingStatus'|}
export type SetThreadSearchStatusPayload = {|+payload: _SetThreadSearchStatusPayload, +type: 'chat2:setThreadSearchStatus'|}
export type SetUnsentTextPayload = {|+payload: _SetUnsentTextPayload, +type: 'chat2:setUnsentText'|}
export type SetWalletsOldPayload = {|+payload: _SetWalletsOldPayload, +type: 'chat2:setWalletsOld'|}
export type StaticConfigLoadedPayload = {|+payload: _StaticConfigLoadedPayload, +type: 'chat2:staticConfigLoaded'|}
export type ThreadSearchPayload = {|+payload: _ThreadSearchPayload, +type: 'chat2:threadSearch'|}
export type ThreadSearchResultPayload = {|+payload: _ThreadSearchResultPayload, +type: 'chat2:threadSearchResult'|}
export type ToggleInboxSearchPayload = {|+payload: _ToggleInboxSearchPayload, +type: 'chat2:toggleInboxSearch'|}
export type ToggleInfoPanelPayload = {|+payload: _ToggleInfoPanelPayload, +type: 'chat2:toggleInfoPanel'|}
export type ToggleLocalReactionPayload = {|+payload: _ToggleLocalReactionPayload, +type: 'chat2:toggleLocalReaction'|}
export type ToggleMessageCollapsePayload = {|+payload: _ToggleMessageCollapsePayload, +type: 'chat2:toggleMessageCollapse'|}
export type ToggleMessageReactionPayload = {|+payload: _ToggleMessageReactionPayload, +type: 'chat2:toggleMessageReaction'|}
export type ToggleSmallTeamsExpandedPayload = {|+payload: _ToggleSmallTeamsExpandedPayload, +type: 'chat2:toggleSmallTeamsExpanded'|}
export type ToggleThreadSearchPayload = {|+payload: _ToggleThreadSearchPayload, +type: 'chat2:toggleThreadSearch'|}
export type UnfurlRemovePayload = {|+payload: _UnfurlRemovePayload, +type: 'chat2:unfurlRemove'|}
export type UnfurlResolvePromptPayload = {|+payload: _UnfurlResolvePromptPayload, +type: 'chat2:unfurlResolvePrompt'|}
export type UnfurlTogglePromptPayload = {|+payload: _UnfurlTogglePromptPayload, +type: 'chat2:unfurlTogglePrompt'|}
export type UnhideConversationPayload = {|+payload: _UnhideConversationPayload, +type: 'chat2:unhideConversation'|}
export type UnsentTextChangedPayload = {|+payload: _UnsentTextChangedPayload, +type: 'chat2:unsentTextChanged'|}
export type UpdateCoinFlipStatusPayload = {|+payload: _UpdateCoinFlipStatusPayload, +type: 'chat2:updateCoinFlipStatus'|}
export type UpdateConvExplodingModesPayload = {|+payload: _UpdateConvExplodingModesPayload, +type: 'chat2:updateConvExplodingModes'|}
export type UpdateConvRetentionPolicyPayload = {|+payload: _UpdateConvRetentionPolicyPayload, +type: 'chat2:updateConvRetentionPolicy'|}
export type UpdateMessagesPayload = {|+payload: _UpdateMessagesPayload, +type: 'chat2:updateMessages'|}
export type UpdateMoreToLoadPayload = {|+payload: _UpdateMoreToLoadPayload, +type: 'chat2:updateMoreToLoad'|}
export type UpdateNotificationSettingsPayload = {|+payload: _UpdateNotificationSettingsPayload, +type: 'chat2:updateNotificationSettings'|}
export type UpdateReactionsPayload = {|+payload: _UpdateReactionsPayload, +type: 'chat2:updateReactions'|}
export type UpdateTeamRetentionPolicyPayload = {|+payload: _UpdateTeamRetentionPolicyPayload, +type: 'chat2:updateTeamRetentionPolicy'|}
export type UpdateUnreadlinePayload = {|+payload: _UpdateUnreadlinePayload, +type: 'chat2:updateUnreadline'|}

// All Actions
// prettier-ignore
export type Actions =
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
  | ClearPaymentConfirmInfoPayload
  | ConfirmScreenResponsePayload
  | CreateConversationPayload
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
  | JoinConversationPayload
  | JumpToRecentPayload
  | LeaveConversationPayload
  | LoadMessagesFromSearchHitPayload
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
  | RequestInfoReceivedPayload
  | ResetChatWithoutThemPayload
  | ResetLetThemInPayload
  | SaveMinWriterRolePayload
  | SelectConversationPayload
  | SendTypingPayload
  | SetCommandMarkdownPayload
  | SetContainsLastMessagePayload
  | SetConvExplodingModePayload
  | SetConvRetentionPolicyPayload
  | SetConversationOfflinePayload
  | SetExplodingModeLockPayload
  | SetInboxFilterPayload
  | SetMinWriterRolePayload
  | SetPaymentConfirmInfoPayload
  | SetPaymentConfirmInfoPayloadError
  | SetPendingConversationExistingConversationIDKeyPayload
  | SetPendingConversationUsersPayload
  | SetPendingModePayload
  | SetPendingStatusPayload
  | SetThreadSearchStatusPayload
  | SetUnsentTextPayload
  | SetWalletsOldPayload
  | StaticConfigLoadedPayload
  | ThreadSearchPayload
  | ThreadSearchResultPayload
  | ToggleInboxSearchPayload
  | ToggleInfoPanelPayload
  | ToggleLocalReactionPayload
  | ToggleMessageCollapsePayload
  | ToggleMessageReactionPayload
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
  | {type: 'common:resetStore', payload: null}
