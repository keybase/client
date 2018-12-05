// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

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
export const createConversation = 'chat2:createConversation'
export const desktopNotification = 'chat2:desktopNotification'
export const filePickerError = 'chat2:filePickerError'
export const giphyDismiss = 'chat2:giphyDismiss'
export const giphyGotSearchResult = 'chat2:giphyGotSearchResult'
export const giphyRunSearch = 'chat2:giphyRunSearch'
export const giphySend = 'chat2:giphySend'
export const handleSeeingExplodingMessages = 'chat2:handleSeeingExplodingMessages'
export const handleSeeingWallets = 'chat2:handleSeeingWallets'
export const inboxRefresh = 'chat2:inboxRefresh'
export const joinConversation = 'chat2:joinConversation'
export const leaveConversation = 'chat2:leaveConversation'
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
export const setConvExplodingMode = 'chat2:setConvExplodingMode'
export const setConvRetentionPolicy = 'chat2:setConvRetentionPolicy'
export const setConversationOffline = 'chat2:setConversationOffline'
export const setExplodingMessagesNew = 'chat2:setExplodingMessagesNew'
export const setExplodingModeLock = 'chat2:setExplodingModeLock'
export const setInboxFilter = 'chat2:setInboxFilter'
export const setMinWriterRole = 'chat2:setMinWriterRole'
export const setPendingConversationExistingConversationIDKey = 'chat2:setPendingConversationExistingConversationIDKey'
export const setPendingConversationUsers = 'chat2:setPendingConversationUsers'
export const setPendingMode = 'chat2:setPendingMode'
export const setPendingStatus = 'chat2:setPendingStatus'
export const setWalletsOld = 'chat2:setWalletsOld'
export const staticConfigLoaded = 'chat2:staticConfigLoaded'
export const toggleLocalReaction = 'chat2:toggleLocalReaction'
export const toggleMessageReaction = 'chat2:toggleMessageReaction'
export const toggleSmallTeamsExpanded = 'chat2:toggleSmallTeamsExpanded'
export const unfurlRemove = 'chat2:unfurlRemove'
export const unfurlResolvePrompt = 'chat2:unfurlResolvePrompt'
export const unfurlTogglePrompt = 'chat2:unfurlTogglePrompt'
export const updateConvExplodingModes = 'chat2:updateConvExplodingModes'
export const updateConvRetentionPolicy = 'chat2:updateConvRetentionPolicy'
export const updateMessages = 'chat2:updateMessages'
export const updateMoreToLoad = 'chat2:updateMoreToLoad'
export const updateNotificationSettings = 'chat2:updateNotificationSettings'
export const updateReactions = 'chat2:updateReactions'
export const updateTeamRetentionPolicy = 'chat2:updateTeamRetentionPolicy'
export const updateTypers = 'chat2:updateTypers'

// Payload Types
type _AttachmentDownloadPayload = $ReadOnly<{|message: Types.Message|}>
type _AttachmentDownloadedPayload = $ReadOnly<{|message: Types.Message, path?: string|}>
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
type _CreateConversationPayload = $ReadOnly<{|participants: Array<string>|}>
type _DesktopNotificationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, author: string, body: string|}>
type _FilePickerErrorPayload = $ReadOnly<{|error: Error|}>
type _GiphyDismissPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _GiphyGotSearchResultPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, result: Array<RPCChatTypes.GiphySearchResult>|}>
type _GiphyRunSearchPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, query: ?string|}>
type _GiphySendPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, url: HiddenString|}>
type _HandleSeeingExplodingMessagesPayload = void
type _HandleSeeingWalletsPayload = void
type _InboxRefreshPayload = $ReadOnly<{|reason: 'bootstrap' | 'componentNeverLoaded' | 'inboxStale' | 'inboxSyncedClear' | 'inboxSyncedUnknown' | 'joinedAConversation' | 'leftAConversation' | 'teamTypeChanged'|}>
type _JoinConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _LeaveConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, dontNavigateToInbox?: boolean|}>
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
type _MessagesAddPayload = $ReadOnly<{|context: {type: 'sent'} | {type: 'incoming'} | {type: 'threadLoad', conversationIDKey: Types.ConversationIDKey}, messages: Array<Types.Message>, shouldClearOthers?: boolean|}>
type _MessagesExplodedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageIDs: Array<RPCChatTypes.MessageID>, explodedBy?: string|}>
type _MessagesWereDeletedPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageIDs?: Array<RPCChatTypes.MessageID>, upToMessageID?: RPCChatTypes.MessageID, deletableMessageTypes?: I.Set<Types.MessageType>, ordinals?: Array<Types.Ordinal>|}>
type _MetaDeletePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, selectSomethingElse: boolean|}>
type _MetaHandleQueuePayload = void
type _MetaNeedsUpdatingPayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>, reason: string|}>
type _MetaReceivedErrorPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, error: ?RPCChatTypes.InboxUIItemError, username: ?string|}>
type _MetaRequestTrustedPayload = $ReadOnly<{|force?: boolean, conversationIDKeys: Array<Types.ConversationIDKey>|}>
type _MetaRequestingTrustedPayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>|}>
type _MetasReceivedPayload = $ReadOnly<{|metas: Array<Types.ConversationMeta>, neverCreate?: boolean, clearExistingMetas?: boolean, clearExistingMessages?: boolean, fromExpunge?: boolean, fromInboxRefresh?: boolean|}>
type _MuteConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, muted: boolean|}>
type _NavigateToInboxPayload = $ReadOnly<{|findNewConversation: boolean|}>
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
  reason: 'clearSelected' | 'desktopNotification' | 'setPendingMode' | 'sendingToPending' | 'createdMessagePrivately' | 'extension' | 'findNewestConversation' | 'inboxBig' | 'inboxFilterArrow' | 'inboxFilterChanged' | 'inboxSmall' | 'inboxNewConversation' | 'jumpFromReset' | 'jumpToReset' | 'justCreated' | 'manageView' | 'previewResolved' | 'pendingModeChange' | 'push' | 'savedLastState' | 'startFoundExisting' | 'teamChat',
|}>
type _SendTypingPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, typing: boolean|}>
type _SetConvExplodingModePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, seconds: number|}>
type _SetConvRetentionPolicyPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, policy: RetentionPolicy|}>
type _SetConversationOfflinePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, offline: boolean|}>
type _SetExplodingMessagesNewPayload = $ReadOnly<{|new: boolean|}>
type _SetExplodingModeLockPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, unset?: boolean|}>
type _SetInboxFilterPayload = $ReadOnly<{|filter: string|}>
type _SetMinWriterRolePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, role: TeamsTypes.TeamRoleType|}>
type _SetPendingConversationExistingConversationIDKeyPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _SetPendingConversationUsersPayload = $ReadOnly<{|users: Array<string>, fromSearch: boolean|}>
type _SetPendingModePayload = $ReadOnly<{|pendingMode: Types.PendingMode, noneDestination?: 'inbox' | 'thread'|}>
type _SetPendingStatusPayload = $ReadOnly<{|pendingStatus: Types.PendingStatus|}>
type _SetWalletsOldPayload = void
type _StaticConfigLoadedPayload = $ReadOnly<{|staticConfig: Types.StaticConfig|}>
type _ToggleLocalReactionPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, emoji: string, targetOrdinal: Types.Ordinal, username: string|}>
type _ToggleMessageReactionPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, emoji: string, ordinal: Types.Ordinal|}>
type _ToggleSmallTeamsExpandedPayload = void
type _UnfurlRemovePayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID|}>
type _UnfurlResolvePromptPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, domain: string, result: RPCChatTypes.UnfurlPromptResult|}>
type _UnfurlTogglePromptPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, domain: string, show: boolean|}>
type _UpdateConvExplodingModesPayload = $ReadOnly<{|modes: Array<{conversationIDKey: Types.ConversationIDKey, seconds: number}>|}>
type _UpdateConvRetentionPolicyPayload = $ReadOnly<{|conv: RPCChatTypes.InboxUIItem|}>
type _UpdateMessagesPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, messages: Array<{messageID: Types.MessageID, message: Types.Message}>|}>
type _UpdateMoreToLoadPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, moreToLoad: boolean|}>
type _UpdateNotificationSettingsPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, notificationsDesktop: Types.NotificationsType, notificationsMobile: Types.NotificationsType, notificationsGlobalIgnoreMentions: boolean|}>
type _UpdateReactionsPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey, updates: Array<{targetMsgID: RPCChatTypes.MessageID, reactions: Types.Reactions}>|}>
type _UpdateTeamRetentionPolicyPayload = $ReadOnly<{|convs: Array<RPCChatTypes.InboxUIItem>|}>
type _UpdateTypersPayload = $ReadOnly<{|conversationToTypers: I.Map<Types.ConversationIDKey, I.Set<string>>|}>

// Action Creators
/**
 * Actually start a conversation
 */
export const createCreateConversation = (payload: _CreateConversationPayload) => ({payload, type: createConversation})
/**
 * Add an unfurl prompt to a message
 */
export const createUnfurlTogglePrompt = (payload: _UnfurlTogglePromptPayload) => ({payload, type: unfurlTogglePrompt})
/**
 * Consume a service notification that a conversation's retention policy has been updated
 */
export const createUpdateConvRetentionPolicy = (payload: _UpdateConvRetentionPolicyPayload) => ({payload, type: updateConvRetentionPolicy})
/**
 * Consume a service notification that a team retention policy was updated
 */
export const createUpdateTeamRetentionPolicy = (payload: _UpdateTeamRetentionPolicyPayload) => ({payload, type: updateTeamRetentionPolicy})
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
 * Prime data to fulfill this message's request and navigate to the send form.
 */
export const createPrepareFulfillRequestForm = (payload: _PrepareFulfillRequestFormPayload) => ({payload, type: prepareFulfillRequestForm})
/**
 * Remove an unfurl
 */
export const createUnfurlRemove = (payload: _UnfurlRemovePayload) => ({payload, type: unfurlRemove})
/**
 * Response to an unfurl prompt
 */
export const createUnfurlResolvePrompt = (payload: _UnfurlResolvePromptPayload) => ({payload, type: unfurlResolvePrompt})
/**
 * Sent whenever the mobile file picker encounters an error.
 */
export const createFilePickerError = (payload: _FilePickerErrorPayload) => ({payload, type: filePickerError})
/**
 * Set a lock on the exploding mode for a conversation.
 */
export const createSetExplodingModeLock = (payload: _SetExplodingModeLockPayload) => ({payload, type: setExplodingModeLock})
/**
 * Set that wallets in chat is not new.
 */
export const createSetWalletsOld = (payload: _SetWalletsOldPayload) => ({payload, type: setWalletsOld})
/**
 * Set the minimum role required to write into a conversation. Valid only for team conversations.
 */
export const createSetMinWriterRole = (payload: _SetMinWriterRolePayload) => ({payload, type: setMinWriterRole})
/**
 * Set the remote exploding mode for a conversation.
 */
export const createSetConvExplodingMode = (payload: _SetConvExplodingModePayload) => ({payload, type: setConvExplodingMode})
/**
 * Set whether exploding messages are a new feature or not.
 */
export const createSetExplodingMessagesNew = (payload: _SetExplodingMessagesNewPayload) => ({payload, type: setExplodingMessagesNew})
/**
 * Sets the retention policy for a conversation.
 */
export const createSetConvRetentionPolicy = (payload: _SetConvRetentionPolicyPayload) => ({payload, type: setConvRetentionPolicy})
/**
 * Some things need to happen when the user interacts with the exploding messages feature. Trigger the handler that takes care of those things.
 */
export const createHandleSeeingExplodingMessages = (payload: _HandleSeeingExplodingMessagesPayload) => ({payload, type: handleSeeingExplodingMessages})
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
 * Toggle a reaction in the store.
 */
export const createToggleLocalReaction = (payload: _ToggleLocalReactionPayload) => ({payload, type: toggleLocalReaction})
/**
 * Update messages that we might have in the store
 */
export const createUpdateMessages = (payload: _UpdateMessagesPayload) => ({payload, type: updateMessages})
/**
 * Update the minWriterRole stored with the conversation metadata.
 */
export const createSaveMinWriterRole = (payload: _SaveMinWriterRolePayload) => ({payload, type: saveMinWriterRole})
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
 * dismiss Giphy search
 */
export const createGiphyDismiss = (payload: _GiphyDismissPayload) => ({payload, type: giphyDismiss})
/**
 * enable the Giphy search pane
 */
export const createGiphyRunSearch = (payload: _GiphyRunSearchPayload) => ({payload, type: giphyRunSearch})
/**
 * send a message from Giphy search
 */
export const createGiphySend = (payload: _GiphySendPayload) => ({payload, type: giphySend})
export const createAttachmentDownload = (payload: _AttachmentDownloadPayload) => ({payload, type: attachmentDownload})
export const createAttachmentDownloaded = (payload: _AttachmentDownloadedPayload) => ({payload, type: attachmentDownloaded})
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
export const createInboxRefresh = (payload: _InboxRefreshPayload) => ({payload, type: inboxRefresh})
export const createJoinConversation = (payload: _JoinConversationPayload) => ({payload, type: joinConversation})
export const createLeaveConversation = (payload: _LeaveConversationPayload) => ({payload, type: leaveConversation})
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
export const createToggleSmallTeamsExpanded = (payload: _ToggleSmallTeamsExpandedPayload) => ({payload, type: toggleSmallTeamsExpanded})
export const createUpdateMoreToLoad = (payload: _UpdateMoreToLoadPayload) => ({payload, type: updateMoreToLoad})
export const createUpdateNotificationSettings = (payload: _UpdateNotificationSettingsPayload) => ({payload, type: updateNotificationSettings})
export const createUpdateTypers = (payload: _UpdateTypersPayload) => ({payload, type: updateTypers})

// Action Payloads
export type AttachmentDownloadPayload = $Call<typeof createAttachmentDownload, _AttachmentDownloadPayload>
export type AttachmentDownloadedPayload = $Call<typeof createAttachmentDownloaded, _AttachmentDownloadedPayload>
export type AttachmentFullscreenNextPayload = $Call<typeof createAttachmentFullscreenNext, _AttachmentFullscreenNextPayload>
export type AttachmentFullscreenSelectionPayload = $Call<typeof createAttachmentFullscreenSelection, _AttachmentFullscreenSelectionPayload>
export type AttachmentLoadingPayload = $Call<typeof createAttachmentLoading, _AttachmentLoadingPayload>
export type AttachmentMobileSavePayload = $Call<typeof createAttachmentMobileSave, _AttachmentMobileSavePayload>
export type AttachmentMobileSavedPayload = $Call<typeof createAttachmentMobileSaved, _AttachmentMobileSavedPayload>
export type AttachmentPastedPayload = $Call<typeof createAttachmentPasted, _AttachmentPastedPayload>
export type AttachmentPreviewSelectPayload = $Call<typeof createAttachmentPreviewSelect, _AttachmentPreviewSelectPayload>
export type AttachmentUploadedPayload = $Call<typeof createAttachmentUploaded, _AttachmentUploadedPayload>
export type AttachmentUploadingPayload = $Call<typeof createAttachmentUploading, _AttachmentUploadingPayload>
export type AttachmentsUploadPayload = $Call<typeof createAttachmentsUpload, _AttachmentsUploadPayload>
export type BadgesUpdatedPayload = $Call<typeof createBadgesUpdated, _BadgesUpdatedPayload>
export type BlockConversationPayload = $Call<typeof createBlockConversation, _BlockConversationPayload>
export type CreateConversationPayload = $Call<typeof createCreateConversation, _CreateConversationPayload>
export type DesktopNotificationPayload = $Call<typeof createDesktopNotification, _DesktopNotificationPayload>
export type FilePickerErrorPayload = $Call<typeof createFilePickerError, _FilePickerErrorPayload>
export type GiphyDismissPayload = $Call<typeof createGiphyDismiss, _GiphyDismissPayload>
export type GiphyGotSearchResultPayload = $Call<typeof createGiphyGotSearchResult, _GiphyGotSearchResultPayload>
export type GiphyRunSearchPayload = $Call<typeof createGiphyRunSearch, _GiphyRunSearchPayload>
export type GiphySendPayload = $Call<typeof createGiphySend, _GiphySendPayload>
export type HandleSeeingExplodingMessagesPayload = $Call<typeof createHandleSeeingExplodingMessages, _HandleSeeingExplodingMessagesPayload>
export type HandleSeeingWalletsPayload = $Call<typeof createHandleSeeingWallets, _HandleSeeingWalletsPayload>
export type InboxRefreshPayload = $Call<typeof createInboxRefresh, _InboxRefreshPayload>
export type JoinConversationPayload = $Call<typeof createJoinConversation, _JoinConversationPayload>
export type LeaveConversationPayload = $Call<typeof createLeaveConversation, _LeaveConversationPayload>
export type LoadOlderMessagesDueToScrollPayload = $Call<typeof createLoadOlderMessagesDueToScroll, _LoadOlderMessagesDueToScrollPayload>
export type MarkConversationsStalePayload = $Call<typeof createMarkConversationsStale, _MarkConversationsStalePayload>
export type MarkInitiallyLoadedThreadAsReadPayload = $Call<typeof createMarkInitiallyLoadedThreadAsRead, _MarkInitiallyLoadedThreadAsReadPayload>
export type MessageAttachmentNativeSavePayload = $Call<typeof createMessageAttachmentNativeSave, _MessageAttachmentNativeSavePayload>
export type MessageAttachmentNativeSharePayload = $Call<typeof createMessageAttachmentNativeShare, _MessageAttachmentNativeSharePayload>
export type MessageAttachmentUploadedPayload = $Call<typeof createMessageAttachmentUploaded, _MessageAttachmentUploadedPayload>
export type MessageDeleteHistoryPayload = $Call<typeof createMessageDeleteHistory, _MessageDeleteHistoryPayload>
export type MessageDeletePayload = $Call<typeof createMessageDelete, _MessageDeletePayload>
export type MessageEditPayload = $Call<typeof createMessageEdit, _MessageEditPayload>
export type MessageErroredPayload = $Call<typeof createMessageErrored, _MessageErroredPayload>
export type MessageReplyPrivatelyPayload = $Call<typeof createMessageReplyPrivately, _MessageReplyPrivatelyPayload>
export type MessageRetryPayload = $Call<typeof createMessageRetry, _MessageRetryPayload>
export type MessageSendPayload = $Call<typeof createMessageSend, _MessageSendPayload>
export type MessageSetEditingPayload = $Call<typeof createMessageSetEditing, _MessageSetEditingPayload>
export type MessageSetQuotingPayload = $Call<typeof createMessageSetQuoting, _MessageSetQuotingPayload>
export type MessageWasEditedPayload = $Call<typeof createMessageWasEdited, _MessageWasEditedPayload>
export type MessagesAddPayload = $Call<typeof createMessagesAdd, _MessagesAddPayload>
export type MessagesExplodedPayload = $Call<typeof createMessagesExploded, _MessagesExplodedPayload>
export type MessagesWereDeletedPayload = $Call<typeof createMessagesWereDeleted, _MessagesWereDeletedPayload>
export type MetaDeletePayload = $Call<typeof createMetaDelete, _MetaDeletePayload>
export type MetaHandleQueuePayload = $Call<typeof createMetaHandleQueue, _MetaHandleQueuePayload>
export type MetaNeedsUpdatingPayload = $Call<typeof createMetaNeedsUpdating, _MetaNeedsUpdatingPayload>
export type MetaReceivedErrorPayload = $Call<typeof createMetaReceivedError, _MetaReceivedErrorPayload>
export type MetaRequestTrustedPayload = $Call<typeof createMetaRequestTrusted, _MetaRequestTrustedPayload>
export type MetaRequestingTrustedPayload = $Call<typeof createMetaRequestingTrusted, _MetaRequestingTrustedPayload>
export type MetasReceivedPayload = $Call<typeof createMetasReceived, _MetasReceivedPayload>
export type MuteConversationPayload = $Call<typeof createMuteConversation, _MuteConversationPayload>
export type NavigateToInboxPayload = $Call<typeof createNavigateToInbox, _NavigateToInboxPayload>
export type NavigateToThreadPayload = $Call<typeof createNavigateToThread, _NavigateToThreadPayload>
export type NotificationSettingsUpdatedPayload = $Call<typeof createNotificationSettingsUpdated, _NotificationSettingsUpdatedPayload>
export type OpenChatFromWidgetPayload = $Call<typeof createOpenChatFromWidget, _OpenChatFromWidgetPayload>
export type OpenFolderPayload = $Call<typeof createOpenFolder, _OpenFolderPayload>
export type PaymentInfoReceivedPayload = $Call<typeof createPaymentInfoReceived, _PaymentInfoReceivedPayload>
export type PendingMessageWasEditedPayload = $Call<typeof createPendingMessageWasEdited, _PendingMessageWasEditedPayload>
export type PrepareFulfillRequestFormPayload = $Call<typeof createPrepareFulfillRequestForm, _PrepareFulfillRequestFormPayload>
export type PreviewConversationPayload = $Call<typeof createPreviewConversation, _PreviewConversationPayload>
export type RequestInfoReceivedPayload = $Call<typeof createRequestInfoReceived, _RequestInfoReceivedPayload>
export type ResetChatWithoutThemPayload = $Call<typeof createResetChatWithoutThem, _ResetChatWithoutThemPayload>
export type ResetLetThemInPayload = $Call<typeof createResetLetThemIn, _ResetLetThemInPayload>
export type SaveMinWriterRolePayload = $Call<typeof createSaveMinWriterRole, _SaveMinWriterRolePayload>
export type SelectConversationPayload = $Call<typeof createSelectConversation, _SelectConversationPayload>
export type SendTypingPayload = $Call<typeof createSendTyping, _SendTypingPayload>
export type SetConvExplodingModePayload = $Call<typeof createSetConvExplodingMode, _SetConvExplodingModePayload>
export type SetConvRetentionPolicyPayload = $Call<typeof createSetConvRetentionPolicy, _SetConvRetentionPolicyPayload>
export type SetConversationOfflinePayload = $Call<typeof createSetConversationOffline, _SetConversationOfflinePayload>
export type SetExplodingMessagesNewPayload = $Call<typeof createSetExplodingMessagesNew, _SetExplodingMessagesNewPayload>
export type SetExplodingModeLockPayload = $Call<typeof createSetExplodingModeLock, _SetExplodingModeLockPayload>
export type SetInboxFilterPayload = $Call<typeof createSetInboxFilter, _SetInboxFilterPayload>
export type SetMinWriterRolePayload = $Call<typeof createSetMinWriterRole, _SetMinWriterRolePayload>
export type SetPendingConversationExistingConversationIDKeyPayload = $Call<typeof createSetPendingConversationExistingConversationIDKey, _SetPendingConversationExistingConversationIDKeyPayload>
export type SetPendingConversationUsersPayload = $Call<typeof createSetPendingConversationUsers, _SetPendingConversationUsersPayload>
export type SetPendingModePayload = $Call<typeof createSetPendingMode, _SetPendingModePayload>
export type SetPendingStatusPayload = $Call<typeof createSetPendingStatus, _SetPendingStatusPayload>
export type SetWalletsOldPayload = $Call<typeof createSetWalletsOld, _SetWalletsOldPayload>
export type StaticConfigLoadedPayload = $Call<typeof createStaticConfigLoaded, _StaticConfigLoadedPayload>
export type ToggleLocalReactionPayload = $Call<typeof createToggleLocalReaction, _ToggleLocalReactionPayload>
export type ToggleMessageReactionPayload = $Call<typeof createToggleMessageReaction, _ToggleMessageReactionPayload>
export type ToggleSmallTeamsExpandedPayload = $Call<typeof createToggleSmallTeamsExpanded, _ToggleSmallTeamsExpandedPayload>
export type UnfurlRemovePayload = $Call<typeof createUnfurlRemove, _UnfurlRemovePayload>
export type UnfurlResolvePromptPayload = $Call<typeof createUnfurlResolvePrompt, _UnfurlResolvePromptPayload>
export type UnfurlTogglePromptPayload = $Call<typeof createUnfurlTogglePrompt, _UnfurlTogglePromptPayload>
export type UpdateConvExplodingModesPayload = $Call<typeof createUpdateConvExplodingModes, _UpdateConvExplodingModesPayload>
export type UpdateConvRetentionPolicyPayload = $Call<typeof createUpdateConvRetentionPolicy, _UpdateConvRetentionPolicyPayload>
export type UpdateMessagesPayload = $Call<typeof createUpdateMessages, _UpdateMessagesPayload>
export type UpdateMoreToLoadPayload = $Call<typeof createUpdateMoreToLoad, _UpdateMoreToLoadPayload>
export type UpdateNotificationSettingsPayload = $Call<typeof createUpdateNotificationSettings, _UpdateNotificationSettingsPayload>
export type UpdateReactionsPayload = $Call<typeof createUpdateReactions, _UpdateReactionsPayload>
export type UpdateTeamRetentionPolicyPayload = $Call<typeof createUpdateTeamRetentionPolicy, _UpdateTeamRetentionPolicyPayload>
export type UpdateTypersPayload = $Call<typeof createUpdateTypers, _UpdateTypersPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AttachmentDownloadPayload
  | AttachmentDownloadedPayload
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
  | CreateConversationPayload
  | DesktopNotificationPayload
  | FilePickerErrorPayload
  | GiphyDismissPayload
  | GiphyGotSearchResultPayload
  | GiphyRunSearchPayload
  | GiphySendPayload
  | HandleSeeingExplodingMessagesPayload
  | HandleSeeingWalletsPayload
  | InboxRefreshPayload
  | JoinConversationPayload
  | LeaveConversationPayload
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
  | SetConvExplodingModePayload
  | SetConvRetentionPolicyPayload
  | SetConversationOfflinePayload
  | SetExplodingMessagesNewPayload
  | SetExplodingModeLockPayload
  | SetInboxFilterPayload
  | SetMinWriterRolePayload
  | SetPendingConversationExistingConversationIDKeyPayload
  | SetPendingConversationUsersPayload
  | SetPendingModePayload
  | SetPendingStatusPayload
  | SetWalletsOldPayload
  | StaticConfigLoadedPayload
  | ToggleLocalReactionPayload
  | ToggleMessageReactionPayload
  | ToggleSmallTeamsExpandedPayload
  | UnfurlRemovePayload
  | UnfurlResolvePromptPayload
  | UnfurlTogglePromptPayload
  | UpdateConvExplodingModesPayload
  | UpdateConvRetentionPolicyPayload
  | UpdateMessagesPayload
  | UpdateMoreToLoadPayload
  | UpdateNotificationSettingsPayload
  | UpdateReactionsPayload
  | UpdateTeamRetentionPolicyPayload
  | UpdateTypersPayload
  | {type: 'common:resetStore', payload: void}
