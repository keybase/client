// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import HiddenString from '../util/hidden-string'
import type {RetentionPolicy} from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer
export const attachmentDownload = 'chat2:attachmentDownload'
export const attachmentDownloaded = 'chat2:attachmentDownloaded'
export const attachmentLoading = 'chat2:attachmentLoading'
export const attachmentUpload = 'chat2:attachmentUpload'
export const attachmentUploaded = 'chat2:attachmentUploaded'
export const attachmentUploading = 'chat2:attachmentUploading'
export const badgesUpdated = 'chat2:badgesUpdated'
export const blockConversation = 'chat2:blockConversation'
export const cancelPendingConversation = 'chat2:cancelPendingConversation'
export const clearLoading = 'chat2:clearLoading'
export const clearOrdinals = 'chat2:clearOrdinals'
export const clearPendingConversation = 'chat2:clearPendingConversation'
export const desktopNotification = 'chat2:desktopNotification'
export const exitSearch = 'chat2:exitSearch'
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
export const messagesWereDeleted = 'chat2:messagesWereDeleted'
export const metaDelete = 'chat2:metaDelete'
export const metaHandleQueue = 'chat2:metaHandleQueue'
export const metaNeedsUpdating = 'chat2:metaNeedsUpdating'
export const metaReceivedError = 'chat2:metaReceivedError'
export const metaRequestTrusted = 'chat2:metaRequestTrusted'
export const metaRequestingTrusted = 'chat2:metaRequestingTrusted'
export const metaUpdatePagination = 'chat2:metaUpdatePagination'
export const metasReceived = 'chat2:metasReceived'
export const muteConversation = 'chat2:muteConversation'
export const navigateToInbox = 'chat2:navigateToInbox'
export const navigateToThread = 'chat2:navigateToThread'
export const notificationSettingsUpdated = 'chat2:notificationSettingsUpdated'
export const openFolder = 'chat2:openFolder'
export const resetChatWithoutThem = 'chat2:resetChatWithoutThem'
export const resetLetThemIn = 'chat2:resetLetThemIn'
export const retryPendingConversation = 'chat2:retryPendingConversation'
export const selectConversation = 'chat2:selectConversation'
export const sendToPendingConversation = 'chat2:sendToPendingConversation'
export const sendTyping = 'chat2:sendTyping'
export const setConvRetentionPolicy = 'chat2:setConvRetentionPolicy'
export const setConversationOffline = 'chat2:setConversationOffline'
export const setInboxFilter = 'chat2:setInboxFilter'
export const setLoading = 'chat2:setLoading'
export const setPendingConversationUsers = 'chat2:setPendingConversationUsers'
export const setPendingMessageSubmitState = 'chat2:setPendingMessageSubmitState'
export const setPendingMode = 'chat2:setPendingMode'
export const setPendingSelected = 'chat2:setPendingSelected'
export const setPendingStatus = 'chat2:setPendingStatus'
export const setupChatHandlers = 'chat2:setupChatHandlers'
export const startConversation = 'chat2:startConversation'
export const updateConvRetentionPolicy = 'chat2:updateConvRetentionPolicy'
export const updateNotificationSettings = 'chat2:updateNotificationSettings'
export const updateTeamRetentionPolicy = 'chat2:updateTeamRetentionPolicy'
export const updateTypers = 'chat2:updateTypers'

// Payload Types
type _AttachmentDownloadPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  forShare?: boolean,
|}>
type _AttachmentDownloadedPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  path?: string,
  forShare?: boolean,
|}>
type _AttachmentLoadingPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  ratio: number,
  isPreview: boolean,
|}>
type _AttachmentUploadPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  path: string,
  title: string,
|}>
type _AttachmentUploadedPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}>
type _AttachmentUploadingPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  ratio: number,
|}>
type _BadgesUpdatedPayload = $ReadOnly<{|conversations: Array<RPCTypes.BadgeConversationInfo>|}>
type _BlockConversationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  reportUser: boolean,
|}>
type _CancelPendingConversationPayload = void
type _ClearLoadingPayload = $ReadOnly<{|key: string|}>
type _ClearOrdinalsPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _ClearPendingConversationPayload = void
type _DesktopNotificationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  author: string,
  body: string,
|}>
type _ExitSearchPayload = $ReadOnly<{|canceled: boolean|}>
type _InboxRefreshPayload = $ReadOnly<{|reason: 'bootstrap' | 'componentNeverLoaded' | 'inboxStale' | 'inboxSyncedClear' | 'inboxSyncedUnknown' | 'joinedAConversation' | 'leftAConversation' | 'teamTypeChanged'|}>
type _JoinConversationPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _LeaveConversationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  dontNavigateToInbox?: boolean,
|}>
type _LoadOlderMessagesDueToScrollPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _MarkConversationsStalePayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>|}>
type _MarkInitiallyLoadedThreadAsReadPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _MessageAttachmentNativeSavePayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}>
type _MessageAttachmentNativeSharePayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}>
type _MessageAttachmentUploadedPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  placeholderID: RPCChatTypes.MessageID,
  message: Types.MessageAttachment,
|}>
type _MessageDeleteHistoryPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}>
type _MessageDeletePayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}>
type _MessageEditPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  text: HiddenString,
|}>
type _MessageErroredPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  reason: string,
  outboxID: Types.OutboxID,
|}>
type _MessageReplyPrivatelyPayload = $ReadOnly<{|
  sourceConversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}>
type _MessageRetryPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  outboxID: Types.OutboxID,
|}>
type _MessageSendPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  text: HiddenString,
|}>
type _MessageSetEditingPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  ordinal: ?Types.Ordinal,
  editLastUser?: string,
|}>
type _MessageSetQuotingPayload = $ReadOnly<{|
  sourceConversationIDKey: Types.ConversationIDKey,
  targetConversationIDKey: string,
  ordinal: ?Types.Ordinal,
|}>
type _MessageWasEditedPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  messageID: RPCChatTypes.MessageID,
  text: HiddenString,
  mentionsAt: I.Set<string>,
  mentionsChannel: 'none' | 'all' | 'here',
  mentionsChannelName: I.Map<string, Types.ConversationIDKey>,
|}>
type _MessagesAddPayload = $ReadOnly<{|
  context: {type: 'sent'} | {type: 'incoming'} | {type: 'threadLoad', conversationIDKey: Types.ConversationIDKey},
  messages: Array<Types.Message>,
|}>
type _MessagesWereDeletedPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  messageIDs?: Array<RPCChatTypes.MessageID>,
  upToMessageID?: RPCChatTypes.MessageID,
  ordinals?: Array<Types.Ordinal>,
|}>
type _MetaDeletePayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  selectSomethingElse: boolean,
|}>
type _MetaHandleQueuePayload = void
type _MetaNeedsUpdatingPayload = $ReadOnly<{|
  conversationIDKeys: Array<Types.ConversationIDKey>,
  reason: string,
|}>
type _MetaReceivedErrorPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  error: ?RPCChatTypes.InboxUIItemError,
  username: ?string,
|}>
type _MetaRequestTrustedPayload = $ReadOnly<{|
  force?: boolean,
  conversationIDKeys: Array<Types.ConversationIDKey>,
|}>
type _MetaRequestingTrustedPayload = $ReadOnly<{|conversationIDKeys: Array<Types.ConversationIDKey>|}>
type _MetaUpdatePaginationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  paginationKey: ?Types.PaginationKey,
|}>
type _MetasReceivedPayload = $ReadOnly<{|
  metas: Array<Types.ConversationMeta>,
  neverCreate?: boolean,
  clearExistingMetas?: boolean,
  clearExistingMessages?: boolean,
|}>
type _MuteConversationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  muted: boolean,
|}>
type _NavigateToInboxPayload = void
type _NavigateToThreadPayload = void
type _NotificationSettingsUpdatedPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  settings: RPCChatTypes.ConversationNotificationInfo,
|}>
type _OpenFolderPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _ResetChatWithoutThemPayload = $ReadOnly<{|conversationIDKey: Types.ConversationIDKey|}>
type _ResetLetThemInPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  username: string,
|}>
type _RetryPendingConversationPayload = void
type _SelectConversationPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  reason: 'clearSelected' | 'desktopNotification' | 'existingSearch' | 'findNewestConversation' | 'inboxBig' | 'inboxFilterArrow' | 'inboxFilterChanged' | 'inboxSmall' | 'jumpFromReset' | 'jumpToReset' | 'justCreated' | 'manageView' | 'messageLink' | 'preview' | 'push' | 'savedLastState' | 'startFoundExisting' | 'teamChat',
|}>
type _SendToPendingConversationPayload = $ReadOnly<{|
  users: Array<string>,
  sendingAction: MessageSendPayload | AttachmentUploadPayload,
|}>
type _SendTypingPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  typing: boolean,
|}>
type _SetConvRetentionPolicyPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  policy: RetentionPolicy,
|}>
type _SetConversationOfflinePayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  offline: boolean,
|}>
type _SetInboxFilterPayload = $ReadOnly<{|filter: string|}>
type _SetLoadingPayload = $ReadOnly<{|
  key: string,
  loading: boolean,
|}>
type _SetPendingConversationUsersPayload = $ReadOnly<{|
  users: Array<string>,
  fromSearch: boolean,
|}>
type _SetPendingMessageSubmitStatePayload = $ReadOnly<{|
  reason: string,
  submitState: 'failed' | 'pending',
|}>
type _SetPendingModePayload = $ReadOnly<{|pendingMode: Types.PendingMode|}>
type _SetPendingSelectedPayload = $ReadOnly<{|selected: boolean|}>
type _SetPendingStatusPayload = $ReadOnly<{|pendingStatus: Types.PendingStatus|}>
type _SetupChatHandlersPayload = void
type _StartConversationPayload = $ReadOnly<{|
  participants?: ?Array<string>,
  tlf?: ?string,
  fromAReset?: boolean,
|}>
type _UpdateConvRetentionPolicyPayload = $ReadOnly<{|conv: RPCChatTypes.InboxUIItem|}>
type _UpdateNotificationSettingsPayload = $ReadOnly<{|
  conversationIDKey: Types.ConversationIDKey,
  notificationsDesktop: Types.NotificationsType,
  notificationsMobile: Types.NotificationsType,
  notificationsGlobalIgnoreMentions: boolean,
|}>
type _UpdateTeamRetentionPolicyPayload = $ReadOnly<{|convs: Array<RPCChatTypes.InboxUIItem>|}>
type _UpdateTypersPayload = $ReadOnly<{|conversationToTypers: I.Map<Types.ConversationIDKey, I.Set<string>>|}>

// Action Creators
/**
 * Cancels the pending conversation, clears out all pending data from the store, and navigates to the inbox
 */
export const createCancelPendingConversation = (payload: _CancelPendingConversationPayload) => ({error: false, payload, type: cancelPendingConversation})
/**
 * Consume a service notification that a conversation's retention policy has been updated
 */
export const createUpdateConvRetentionPolicy = (payload: _UpdateConvRetentionPolicyPayload) => ({error: false, payload, type: updateConvRetentionPolicy})
/**
 * Consume a service notification that a team retention policy was updated
 */
export const createUpdateTeamRetentionPolicy = (payload: _UpdateTeamRetentionPolicyPayload) => ({error: false, payload, type: updateTeamRetentionPolicy})
/**
 * Retries sending the pending message that is currently stored in the metaMap
 */
export const createRetryPendingConversation = (payload: _RetryPendingConversationPayload) => ({error: false, payload, type: retryPendingConversation})
/**
 * Sets pending messages in the store to the supplied state and logs the reason
 */
export const createSetPendingMessageSubmitState = (payload: _SetPendingMessageSubmitStatePayload) => ({error: false, payload, type: setPendingMessageSubmitState})
/**
 * Sets the `pendingStatus` of the currently pending conversation. This controls how the input box behaves in a pending conversation.
 */
export const createSetPendingStatus = (payload: _SetPendingStatusPayload) => ({error: false, payload, type: setPendingStatus})
/**
 * Sets the retention policy for a conversation.
 */
export const createSetConvRetentionPolicy = (payload: _SetConvRetentionPolicyPayload) => ({error: false, payload, type: setConvRetentionPolicy})
export const createAttachmentDownload = (payload: _AttachmentDownloadPayload) => ({error: false, payload, type: attachmentDownload})
export const createAttachmentDownloaded = (payload: _AttachmentDownloadedPayload) => ({error: false, payload, type: attachmentDownloaded})
export const createAttachmentLoading = (payload: _AttachmentLoadingPayload) => ({error: false, payload, type: attachmentLoading})
export const createAttachmentUpload = (payload: _AttachmentUploadPayload) => ({error: false, payload, type: attachmentUpload})
export const createAttachmentUploaded = (payload: _AttachmentUploadedPayload) => ({error: false, payload, type: attachmentUploaded})
export const createAttachmentUploading = (payload: _AttachmentUploadingPayload) => ({error: false, payload, type: attachmentUploading})
export const createBadgesUpdated = (payload: _BadgesUpdatedPayload) => ({error: false, payload, type: badgesUpdated})
export const createBlockConversation = (payload: _BlockConversationPayload) => ({error: false, payload, type: blockConversation})
export const createClearLoading = (payload: _ClearLoadingPayload) => ({error: false, payload, type: clearLoading})
export const createClearOrdinals = (payload: _ClearOrdinalsPayload) => ({error: false, payload, type: clearOrdinals})
export const createClearPendingConversation = (payload: _ClearPendingConversationPayload) => ({error: false, payload, type: clearPendingConversation})
export const createDesktopNotification = (payload: _DesktopNotificationPayload) => ({error: false, payload, type: desktopNotification})
export const createExitSearch = (payload: _ExitSearchPayload) => ({error: false, payload, type: exitSearch})
export const createInboxRefresh = (payload: _InboxRefreshPayload) => ({error: false, payload, type: inboxRefresh})
export const createJoinConversation = (payload: _JoinConversationPayload) => ({error: false, payload, type: joinConversation})
export const createLeaveConversation = (payload: _LeaveConversationPayload) => ({error: false, payload, type: leaveConversation})
export const createLoadOlderMessagesDueToScroll = (payload: _LoadOlderMessagesDueToScrollPayload) => ({error: false, payload, type: loadOlderMessagesDueToScroll})
export const createMarkConversationsStale = (payload: _MarkConversationsStalePayload) => ({error: false, payload, type: markConversationsStale})
export const createMarkInitiallyLoadedThreadAsRead = (payload: _MarkInitiallyLoadedThreadAsReadPayload) => ({error: false, payload, type: markInitiallyLoadedThreadAsRead})
export const createMessageAttachmentNativeSave = (payload: _MessageAttachmentNativeSavePayload) => ({error: false, payload, type: messageAttachmentNativeSave})
export const createMessageAttachmentNativeShare = (payload: _MessageAttachmentNativeSharePayload) => ({error: false, payload, type: messageAttachmentNativeShare})
export const createMessageAttachmentUploaded = (payload: _MessageAttachmentUploadedPayload) => ({error: false, payload, type: messageAttachmentUploaded})
export const createMessageDelete = (payload: _MessageDeletePayload) => ({error: false, payload, type: messageDelete})
export const createMessageDeleteHistory = (payload: _MessageDeleteHistoryPayload) => ({error: false, payload, type: messageDeleteHistory})
export const createMessageEdit = (payload: _MessageEditPayload) => ({error: false, payload, type: messageEdit})
export const createMessageErrored = (payload: _MessageErroredPayload) => ({error: false, payload, type: messageErrored})
export const createMessageReplyPrivately = (payload: _MessageReplyPrivatelyPayload) => ({error: false, payload, type: messageReplyPrivately})
export const createMessageRetry = (payload: _MessageRetryPayload) => ({error: false, payload, type: messageRetry})
export const createMessageSend = (payload: _MessageSendPayload) => ({error: false, payload, type: messageSend})
export const createMessageSetEditing = (payload: _MessageSetEditingPayload) => ({error: false, payload, type: messageSetEditing})
export const createMessageSetQuoting = (payload: _MessageSetQuotingPayload) => ({error: false, payload, type: messageSetQuoting})
export const createMessageWasEdited = (payload: _MessageWasEditedPayload) => ({error: false, payload, type: messageWasEdited})
export const createMessagesAdd = (payload: _MessagesAddPayload) => ({error: false, payload, type: messagesAdd})
export const createMessagesWereDeleted = (payload: _MessagesWereDeletedPayload) => ({error: false, payload, type: messagesWereDeleted})
export const createMetaDelete = (payload: _MetaDeletePayload) => ({error: false, payload, type: metaDelete})
export const createMetaHandleQueue = (payload: _MetaHandleQueuePayload) => ({error: false, payload, type: metaHandleQueue})
export const createMetaNeedsUpdating = (payload: _MetaNeedsUpdatingPayload) => ({error: false, payload, type: metaNeedsUpdating})
export const createMetaReceivedError = (payload: _MetaReceivedErrorPayload) => ({error: false, payload, type: metaReceivedError})
export const createMetaRequestTrusted = (payload: _MetaRequestTrustedPayload) => ({error: false, payload, type: metaRequestTrusted})
export const createMetaRequestingTrusted = (payload: _MetaRequestingTrustedPayload) => ({error: false, payload, type: metaRequestingTrusted})
export const createMetaUpdatePagination = (payload: _MetaUpdatePaginationPayload) => ({error: false, payload, type: metaUpdatePagination})
export const createMetasReceived = (payload: _MetasReceivedPayload) => ({error: false, payload, type: metasReceived})
export const createMuteConversation = (payload: _MuteConversationPayload) => ({error: false, payload, type: muteConversation})
export const createNavigateToInbox = (payload: _NavigateToInboxPayload) => ({error: false, payload, type: navigateToInbox})
export const createNavigateToThread = (payload: _NavigateToThreadPayload) => ({error: false, payload, type: navigateToThread})
export const createNotificationSettingsUpdated = (payload: _NotificationSettingsUpdatedPayload) => ({error: false, payload, type: notificationSettingsUpdated})
export const createOpenFolder = (payload: _OpenFolderPayload) => ({error: false, payload, type: openFolder})
export const createResetChatWithoutThem = (payload: _ResetChatWithoutThemPayload) => ({error: false, payload, type: resetChatWithoutThem})
export const createResetLetThemIn = (payload: _ResetLetThemInPayload) => ({error: false, payload, type: resetLetThemIn})
export const createSelectConversation = (payload: _SelectConversationPayload) => ({error: false, payload, type: selectConversation})
export const createSendToPendingConversation = (payload: _SendToPendingConversationPayload) => ({error: false, payload, type: sendToPendingConversation})
export const createSendTyping = (payload: _SendTypingPayload) => ({error: false, payload, type: sendTyping})
export const createSetConversationOffline = (payload: _SetConversationOfflinePayload) => ({error: false, payload, type: setConversationOffline})
export const createSetInboxFilter = (payload: _SetInboxFilterPayload) => ({error: false, payload, type: setInboxFilter})
export const createSetLoading = (payload: _SetLoadingPayload) => ({error: false, payload, type: setLoading})
export const createSetPendingConversationUsers = (payload: _SetPendingConversationUsersPayload) => ({error: false, payload, type: setPendingConversationUsers})
export const createSetPendingMode = (payload: _SetPendingModePayload) => ({error: false, payload, type: setPendingMode})
export const createSetPendingSelected = (payload: _SetPendingSelectedPayload) => ({error: false, payload, type: setPendingSelected})
export const createSetupChatHandlers = (payload: _SetupChatHandlersPayload) => ({error: false, payload, type: setupChatHandlers})
export const createStartConversation = (payload: _StartConversationPayload) => ({error: false, payload, type: startConversation})
export const createUpdateNotificationSettings = (payload: _UpdateNotificationSettingsPayload) => ({error: false, payload, type: updateNotificationSettings})
export const createUpdateTypers = (payload: _UpdateTypersPayload) => ({error: false, payload, type: updateTypers})

// Action Payloads
export type AttachmentDownloadPayload = $Call<typeof createAttachmentDownload, _AttachmentDownloadPayload>
export type AttachmentDownloadedPayload = $Call<typeof createAttachmentDownloaded, _AttachmentDownloadedPayload>
export type AttachmentLoadingPayload = $Call<typeof createAttachmentLoading, _AttachmentLoadingPayload>
export type AttachmentUploadPayload = $Call<typeof createAttachmentUpload, _AttachmentUploadPayload>
export type AttachmentUploadedPayload = $Call<typeof createAttachmentUploaded, _AttachmentUploadedPayload>
export type AttachmentUploadingPayload = $Call<typeof createAttachmentUploading, _AttachmentUploadingPayload>
export type BadgesUpdatedPayload = $Call<typeof createBadgesUpdated, _BadgesUpdatedPayload>
export type BlockConversationPayload = $Call<typeof createBlockConversation, _BlockConversationPayload>
export type CancelPendingConversationPayload = $Call<typeof createCancelPendingConversation, _CancelPendingConversationPayload>
export type ClearLoadingPayload = $Call<typeof createClearLoading, _ClearLoadingPayload>
export type ClearOrdinalsPayload = $Call<typeof createClearOrdinals, _ClearOrdinalsPayload>
export type ClearPendingConversationPayload = $Call<typeof createClearPendingConversation, _ClearPendingConversationPayload>
export type DesktopNotificationPayload = $Call<typeof createDesktopNotification, _DesktopNotificationPayload>
export type ExitSearchPayload = $Call<typeof createExitSearch, _ExitSearchPayload>
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
export type MessagesWereDeletedPayload = $Call<typeof createMessagesWereDeleted, _MessagesWereDeletedPayload>
export type MetaDeletePayload = $Call<typeof createMetaDelete, _MetaDeletePayload>
export type MetaHandleQueuePayload = $Call<typeof createMetaHandleQueue, _MetaHandleQueuePayload>
export type MetaNeedsUpdatingPayload = $Call<typeof createMetaNeedsUpdating, _MetaNeedsUpdatingPayload>
export type MetaReceivedErrorPayload = $Call<typeof createMetaReceivedError, _MetaReceivedErrorPayload>
export type MetaRequestTrustedPayload = $Call<typeof createMetaRequestTrusted, _MetaRequestTrustedPayload>
export type MetaRequestingTrustedPayload = $Call<typeof createMetaRequestingTrusted, _MetaRequestingTrustedPayload>
export type MetaUpdatePaginationPayload = $Call<typeof createMetaUpdatePagination, _MetaUpdatePaginationPayload>
export type MetasReceivedPayload = $Call<typeof createMetasReceived, _MetasReceivedPayload>
export type MuteConversationPayload = $Call<typeof createMuteConversation, _MuteConversationPayload>
export type NavigateToInboxPayload = $Call<typeof createNavigateToInbox, _NavigateToInboxPayload>
export type NavigateToThreadPayload = $Call<typeof createNavigateToThread, _NavigateToThreadPayload>
export type NotificationSettingsUpdatedPayload = $Call<typeof createNotificationSettingsUpdated, _NotificationSettingsUpdatedPayload>
export type OpenFolderPayload = $Call<typeof createOpenFolder, _OpenFolderPayload>
export type ResetChatWithoutThemPayload = $Call<typeof createResetChatWithoutThem, _ResetChatWithoutThemPayload>
export type ResetLetThemInPayload = $Call<typeof createResetLetThemIn, _ResetLetThemInPayload>
export type RetryPendingConversationPayload = $Call<typeof createRetryPendingConversation, _RetryPendingConversationPayload>
export type SelectConversationPayload = $Call<typeof createSelectConversation, _SelectConversationPayload>
export type SendToPendingConversationPayload = $Call<typeof createSendToPendingConversation, _SendToPendingConversationPayload>
export type SendTypingPayload = $Call<typeof createSendTyping, _SendTypingPayload>
export type SetConvRetentionPolicyPayload = $Call<typeof createSetConvRetentionPolicy, _SetConvRetentionPolicyPayload>
export type SetConversationOfflinePayload = $Call<typeof createSetConversationOffline, _SetConversationOfflinePayload>
export type SetInboxFilterPayload = $Call<typeof createSetInboxFilter, _SetInboxFilterPayload>
export type SetLoadingPayload = $Call<typeof createSetLoading, _SetLoadingPayload>
export type SetPendingConversationUsersPayload = $Call<typeof createSetPendingConversationUsers, _SetPendingConversationUsersPayload>
export type SetPendingMessageSubmitStatePayload = $Call<typeof createSetPendingMessageSubmitState, _SetPendingMessageSubmitStatePayload>
export type SetPendingModePayload = $Call<typeof createSetPendingMode, _SetPendingModePayload>
export type SetPendingSelectedPayload = $Call<typeof createSetPendingSelected, _SetPendingSelectedPayload>
export type SetPendingStatusPayload = $Call<typeof createSetPendingStatus, _SetPendingStatusPayload>
export type SetupChatHandlersPayload = $Call<typeof createSetupChatHandlers, _SetupChatHandlersPayload>
export type StartConversationPayload = $Call<typeof createStartConversation, _StartConversationPayload>
export type UpdateConvRetentionPolicyPayload = $Call<typeof createUpdateConvRetentionPolicy, _UpdateConvRetentionPolicyPayload>
export type UpdateNotificationSettingsPayload = $Call<typeof createUpdateNotificationSettings, _UpdateNotificationSettingsPayload>
export type UpdateTeamRetentionPolicyPayload = $Call<typeof createUpdateTeamRetentionPolicy, _UpdateTeamRetentionPolicyPayload>
export type UpdateTypersPayload = $Call<typeof createUpdateTypers, _UpdateTypersPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AttachmentDownloadPayload
  | AttachmentDownloadedPayload
  | AttachmentLoadingPayload
  | AttachmentUploadPayload
  | AttachmentUploadedPayload
  | AttachmentUploadingPayload
  | BadgesUpdatedPayload
  | BlockConversationPayload
  | CancelPendingConversationPayload
  | ClearLoadingPayload
  | ClearOrdinalsPayload
  | ClearPendingConversationPayload
  | DesktopNotificationPayload
  | ExitSearchPayload
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
  | MessagesWereDeletedPayload
  | MetaDeletePayload
  | MetaHandleQueuePayload
  | MetaNeedsUpdatingPayload
  | MetaReceivedErrorPayload
  | MetaRequestTrustedPayload
  | MetaRequestingTrustedPayload
  | MetaUpdatePaginationPayload
  | MetasReceivedPayload
  | MuteConversationPayload
  | NavigateToInboxPayload
  | NavigateToThreadPayload
  | NotificationSettingsUpdatedPayload
  | OpenFolderPayload
  | ResetChatWithoutThemPayload
  | ResetLetThemInPayload
  | RetryPendingConversationPayload
  | SelectConversationPayload
  | SendToPendingConversationPayload
  | SendTypingPayload
  | SetConvRetentionPolicyPayload
  | SetConversationOfflinePayload
  | SetInboxFilterPayload
  | SetLoadingPayload
  | SetPendingConversationUsersPayload
  | SetPendingMessageSubmitStatePayload
  | SetPendingModePayload
  | SetPendingSelectedPayload
  | SetPendingStatusPayload
  | SetupChatHandlersPayload
  | StartConversationPayload
  | UpdateConvRetentionPolicyPayload
  | UpdateNotificationSettingsPayload
  | UpdateTeamRetentionPolicyPayload
  | UpdateTypersPayload
  | {type: 'common:resetStore', payload: void}
