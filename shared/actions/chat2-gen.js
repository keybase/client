// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer
export const attachmentDownload = 'chat2:attachmentDownload'
export const attachmentDownloaded = 'chat2:attachmentDownloaded'
export const attachmentHandleQueue = 'chat2:attachmentHandleQueue'
export const attachmentLoad = 'chat2:attachmentLoad'
export const attachmentLoaded = 'chat2:attachmentLoaded'
export const attachmentLoading = 'chat2:attachmentLoading'
export const attachmentNeedsUpdating = 'chat2:attachmentNeedsUpdating'
export const attachmentUpload = 'chat2:attachmentUpload'
export const attachmentUploaded = 'chat2:attachmentUploaded'
export const attachmentUploading = 'chat2:attachmentUploading'
export const badgesUpdated = 'chat2:badgesUpdated'
export const blockConversation = 'chat2:blockConversation'
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
export const messageRetry = 'chat2:messageRetry'
export const messageSend = 'chat2:messageSend'
export const messageSetEditing = 'chat2:messageSetEditing'
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
export const selectConversation = 'chat2:selectConversation'
export const selectConversationDueToPush = 'chat2:selectConversationDueToPush'
export const sendToPendingConversation = 'chat2:sendToPendingConversation'
export const sendTyping = 'chat2:sendTyping'
export const setInboxFilter = 'chat2:setInboxFilter'
export const setLoading = 'chat2:setLoading'
export const setPendingConversationUsers = 'chat2:setPendingConversationUsers'
export const setPendingMode = 'chat2:setPendingMode'
export const setPendingSelected = 'chat2:setPendingSelected'
export const setupChatHandlers = 'chat2:setupChatHandlers'
export const startConversation = 'chat2:startConversation'
export const updateNotificationSettings = 'chat2:updateNotificationSettings'
export const updateTypers = 'chat2:updateTypers'

// Action Creators
export const createAttachmentDownload = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: attachmentDownload})
export const createAttachmentDownloaded = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    path: string,
  }>
) => ({error: false, payload, type: attachmentDownloaded})
export const createAttachmentHandleQueue = () => ({error: false, payload: undefined, type: attachmentHandleQueue})
export const createAttachmentLoad = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    isPreview: boolean,
  }>
) => ({error: false, payload, type: attachmentLoad})
export const createAttachmentLoaded = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    path: string,
    isPreview: boolean,
  }>
) => ({error: false, payload, type: attachmentLoaded})
export const createAttachmentLoadedError = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    isPreview: boolean,
  }>
) => ({error: true, payload, type: attachmentLoaded})
export const createAttachmentLoading = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    ratio: number,
    isPreview: boolean,
  }>
) => ({error: false, payload, type: attachmentLoading})
export const createAttachmentNeedsUpdating = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    isPreview: boolean,
  }>
) => ({error: false, payload, type: attachmentNeedsUpdating})
export const createAttachmentUpload = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    path: string,
    title: string,
  }>
) => ({error: false, payload, type: attachmentUpload})
export const createAttachmentUploaded = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: attachmentUploaded})
export const createAttachmentUploading = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    ratio: number,
  }>
) => ({error: false, payload, type: attachmentUploading})
export const createBadgesUpdated = (payload: $ReadOnly<{conversations: Array<RPCTypes.BadgeConversationInfo>}>) => ({error: false, payload, type: badgesUpdated})
export const createBlockConversation = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    reportUser: boolean,
  }>
) => ({error: false, payload, type: blockConversation})
export const createClearLoading = (payload: $ReadOnly<{key: string}>) => ({error: false, payload, type: clearLoading})
export const createClearOrdinals = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: clearOrdinals})
export const createClearPendingConversation = () => ({error: false, payload: undefined, type: clearPendingConversation})
export const createDesktopNotification = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    author: string,
    body: string,
  }>
) => ({error: false, payload, type: desktopNotification})
export const createExitSearch = () => ({error: false, payload: undefined, type: exitSearch})
export const createInboxRefresh = (payload: $ReadOnly<{reason: 'bootstrap' | 'teamTypeChanged' | 'inboxSyncedClear' | 'inboxSyncedUnknown' | 'inboxStale' | 'joinedAConversation' | 'leftAConversation' | 'componentNeverLoaded'}>) => ({error: false, payload, type: inboxRefresh})
export const createJoinConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: joinConversation})
export const createLeaveConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: leaveConversation})
export const createLoadOlderMessagesDueToScroll = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: loadOlderMessagesDueToScroll})
export const createMarkConversationsStale = (payload: $ReadOnly<{conversationIDKeys: Array<Types.ConversationIDKey>}>) => ({error: false, payload, type: markConversationsStale})
export const createMarkInitiallyLoadedThreadAsRead = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: markInitiallyLoadedThreadAsRead})
export const createMessageAttachmentNativeSave = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: messageAttachmentNativeSave})
export const createMessageAttachmentNativeShare = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: messageAttachmentNativeShare})
export const createMessageAttachmentUploaded = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    placeholderID: RPCChatTypes.MessageID,
    message: Types.MessageAttachment,
  }>
) => ({error: false, payload, type: messageAttachmentUploaded})
export const createMessageDelete = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: messageDelete})
export const createMessageDeleteHistory = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: messageDeleteHistory})
export const createMessageEdit = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    text: HiddenString,
  }>
) => ({error: false, payload, type: messageEdit})
export const createMessageErrored = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    reason: string,
    outboxID: Types.OutboxID,
  }>
) => ({error: false, payload, type: messageErrored})
export const createMessageRetry = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    outboxID: Types.OutboxID,
  }>
) => ({error: false, payload, type: messageRetry})
export const createMessageSend = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    text: HiddenString,
  }>
) => ({error: false, payload, type: messageSend})
export const createMessageSetEditing = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: ?Types.Ordinal,
    editLastUser?: string,
  }>
) => ({error: false, payload, type: messageSetEditing})
export const createMessageWasEdited = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    messageID: RPCChatTypes.MessageID,
    text: HiddenString,
  }>
) => ({error: false, payload, type: messageWasEdited})
export const createMessagesAdd = (
  payload: $ReadOnly<{
    context: {type: 'sent'} | {type: 'incoming'} | {type: 'threadLoad', conversationIDKey: Types.ConversationIDKey},
    messages: Array<Types.Message>,
  }>
) => ({error: false, payload, type: messagesAdd})
export const createMessagesWereDeleted = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    messageIDs?: Array<RPCChatTypes.MessageID>,
    ordinals?: Array<Types.Ordinal>,
  }>
) => ({error: false, payload, type: messagesWereDeleted})
export const createMetaDelete = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: metaDelete})
export const createMetaHandleQueue = () => ({error: false, payload: undefined, type: metaHandleQueue})
export const createMetaNeedsUpdating = (
  payload: $ReadOnly<{
    conversationIDKeys: Array<Types.ConversationIDKey>,
    reason: string,
  }>
) => ({error: false, payload, type: metaNeedsUpdating})
export const createMetaReceivedError = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    error: ?RPCChatTypes.InboxUIItemError,
    username: ?string,
  }>
) => ({error: false, payload, type: metaReceivedError})
export const createMetaRequestTrusted = (
  payload: $ReadOnly<{
    force?: boolean,
    conversationIDKeys: Array<Types.ConversationIDKey>,
  }>
) => ({error: false, payload, type: metaRequestTrusted})
export const createMetaRequestingTrusted = (payload: $ReadOnly<{conversationIDKeys: Array<Types.ConversationIDKey>}>) => ({error: false, payload, type: metaRequestingTrusted})
export const createMetaUpdatePagination = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    paginationKey: Types.PaginationKey,
    paginationMoreToLoad: boolean,
  }>
) => ({error: false, payload, type: metaUpdatePagination})
export const createMetasReceived = (payload: $ReadOnly<{metas: Array<Types.ConversationMeta>}>) => ({error: false, payload, type: metasReceived})
export const createMuteConversation = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    muted: boolean,
  }>
) => ({error: false, payload, type: muteConversation})
export const createNavigateToInbox = () => ({error: false, payload: undefined, type: navigateToInbox})
export const createNavigateToThread = () => ({error: false, payload: undefined, type: navigateToThread})
export const createNotificationSettingsUpdated = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    settings: RPCChatTypes.ConversationNotificationInfo,
  }>
) => ({error: false, payload, type: notificationSettingsUpdated})
export const createOpenFolder = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: openFolder})
export const createResetChatWithoutThem = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: resetChatWithoutThem})
export const createResetLetThemIn = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    username: string,
  }>
) => ({error: false, payload, type: resetLetThemIn})
export const createSelectConversation = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    fromUser?: boolean,
    asAPreview?: boolean,
  }>
) => ({error: false, payload, type: selectConversation})
export const createSelectConversationDueToPush = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    phase: 'showImmediately' | 'loadNewContent',
  }>
) => ({error: false, payload, type: selectConversationDueToPush})
export const createSendToPendingConversation = (
  payload: $ReadOnly<{
    users: Array<string>,
    sendingAction: More.ReturnType<typeof createMessageSend> | More.ReturnType<typeof createAttachmentUpload>,
  }>
) => ({error: false, payload, type: sendToPendingConversation})
export const createSendTyping = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    typing: boolean,
  }>
) => ({error: false, payload, type: sendTyping})
export const createSetInboxFilter = (payload: $ReadOnly<{filter: string}>) => ({error: false, payload, type: setInboxFilter})
export const createSetLoading = (
  payload: $ReadOnly<{
    key: string,
    loading: boolean,
  }>
) => ({error: false, payload, type: setLoading})
export const createSetPendingConversationUsers = (
  payload: $ReadOnly<{
    users: Array<string>,
    fromSearch: boolean,
  }>
) => ({error: false, payload, type: setPendingConversationUsers})
export const createSetPendingMode = (payload: $ReadOnly<{pendingMode: Types.PendingMode}>) => ({error: false, payload, type: setPendingMode})
export const createSetPendingSelected = (payload: $ReadOnly<{selected: boolean}>) => ({error: false, payload, type: setPendingSelected})
export const createSetupChatHandlers = () => ({error: false, payload: undefined, type: setupChatHandlers})
export const createStartConversation = (
  payload: $ReadOnly<{
    participants?: ?Array<string>,
    tlf?: ?string,
    forceImmediate?: boolean,
  }>
) => ({error: false, payload, type: startConversation})
export const createUpdateNotificationSettings = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    notificationsDesktop: Types.NotificationsType,
    notificationsMobile: Types.NotificationsType,
    notificationsGlobalIgnoreMentions: boolean,
  }>
) => ({error: false, payload, type: updateNotificationSettings})
export const createUpdateTypers = (payload: $ReadOnly<{conversationToTypers: I.Map<Types.ConversationIDKey, I.Set<string>>}>) => ({error: false, payload, type: updateTypers})

// Action Payloads
export type AttachmentDownloadPayload = More.ReturnType<typeof createAttachmentDownload>
export type AttachmentDownloadedPayload = More.ReturnType<typeof createAttachmentDownloaded>
export type AttachmentHandleQueuePayload = More.ReturnType<typeof createAttachmentHandleQueue>
export type AttachmentLoadPayload = More.ReturnType<typeof createAttachmentLoad>
export type AttachmentLoadedPayload = More.ReturnType<typeof createAttachmentLoaded>
export type AttachmentLoadingPayload = More.ReturnType<typeof createAttachmentLoading>
export type AttachmentNeedsUpdatingPayload = More.ReturnType<typeof createAttachmentNeedsUpdating>
export type AttachmentUploadPayload = More.ReturnType<typeof createAttachmentUpload>
export type AttachmentUploadedPayload = More.ReturnType<typeof createAttachmentUploaded>
export type AttachmentUploadingPayload = More.ReturnType<typeof createAttachmentUploading>
export type BadgesUpdatedPayload = More.ReturnType<typeof createBadgesUpdated>
export type BlockConversationPayload = More.ReturnType<typeof createBlockConversation>
export type ClearLoadingPayload = More.ReturnType<typeof createClearLoading>
export type ClearOrdinalsPayload = More.ReturnType<typeof createClearOrdinals>
export type ClearPendingConversationPayload = More.ReturnType<typeof createClearPendingConversation>
export type DesktopNotificationPayload = More.ReturnType<typeof createDesktopNotification>
export type ExitSearchPayload = More.ReturnType<typeof createExitSearch>
export type InboxRefreshPayload = More.ReturnType<typeof createInboxRefresh>
export type JoinConversationPayload = More.ReturnType<typeof createJoinConversation>
export type LeaveConversationPayload = More.ReturnType<typeof createLeaveConversation>
export type LoadOlderMessagesDueToScrollPayload = More.ReturnType<typeof createLoadOlderMessagesDueToScroll>
export type MarkConversationsStalePayload = More.ReturnType<typeof createMarkConversationsStale>
export type MarkInitiallyLoadedThreadAsReadPayload = More.ReturnType<typeof createMarkInitiallyLoadedThreadAsRead>
export type MessageAttachmentNativeSavePayload = More.ReturnType<typeof createMessageAttachmentNativeSave>
export type MessageAttachmentNativeSharePayload = More.ReturnType<typeof createMessageAttachmentNativeShare>
export type MessageAttachmentUploadedPayload = More.ReturnType<typeof createMessageAttachmentUploaded>
export type MessageDeleteHistoryPayload = More.ReturnType<typeof createMessageDeleteHistory>
export type MessageDeletePayload = More.ReturnType<typeof createMessageDelete>
export type MessageEditPayload = More.ReturnType<typeof createMessageEdit>
export type MessageErroredPayload = More.ReturnType<typeof createMessageErrored>
export type MessageRetryPayload = More.ReturnType<typeof createMessageRetry>
export type MessageSendPayload = More.ReturnType<typeof createMessageSend>
export type MessageSetEditingPayload = More.ReturnType<typeof createMessageSetEditing>
export type MessageWasEditedPayload = More.ReturnType<typeof createMessageWasEdited>
export type MessagesAddPayload = More.ReturnType<typeof createMessagesAdd>
export type MessagesWereDeletedPayload = More.ReturnType<typeof createMessagesWereDeleted>
export type MetaDeletePayload = More.ReturnType<typeof createMetaDelete>
export type MetaHandleQueuePayload = More.ReturnType<typeof createMetaHandleQueue>
export type MetaNeedsUpdatingPayload = More.ReturnType<typeof createMetaNeedsUpdating>
export type MetaReceivedErrorPayload = More.ReturnType<typeof createMetaReceivedError>
export type MetaRequestTrustedPayload = More.ReturnType<typeof createMetaRequestTrusted>
export type MetaRequestingTrustedPayload = More.ReturnType<typeof createMetaRequestingTrusted>
export type MetaUpdatePaginationPayload = More.ReturnType<typeof createMetaUpdatePagination>
export type MetasReceivedPayload = More.ReturnType<typeof createMetasReceived>
export type MuteConversationPayload = More.ReturnType<typeof createMuteConversation>
export type NavigateToInboxPayload = More.ReturnType<typeof createNavigateToInbox>
export type NavigateToThreadPayload = More.ReturnType<typeof createNavigateToThread>
export type NotificationSettingsUpdatedPayload = More.ReturnType<typeof createNotificationSettingsUpdated>
export type OpenFolderPayload = More.ReturnType<typeof createOpenFolder>
export type ResetChatWithoutThemPayload = More.ReturnType<typeof createResetChatWithoutThem>
export type ResetLetThemInPayload = More.ReturnType<typeof createResetLetThemIn>
export type SelectConversationDueToPushPayload = More.ReturnType<typeof createSelectConversationDueToPush>
export type SelectConversationPayload = More.ReturnType<typeof createSelectConversation>
export type SendToPendingConversationPayload = More.ReturnType<typeof createSendToPendingConversation>
export type SendTypingPayload = More.ReturnType<typeof createSendTyping>
export type SetInboxFilterPayload = More.ReturnType<typeof createSetInboxFilter>
export type SetLoadingPayload = More.ReturnType<typeof createSetLoading>
export type SetPendingConversationUsersPayload = More.ReturnType<typeof createSetPendingConversationUsers>
export type SetPendingModePayload = More.ReturnType<typeof createSetPendingMode>
export type SetPendingSelectedPayload = More.ReturnType<typeof createSetPendingSelected>
export type SetupChatHandlersPayload = More.ReturnType<typeof createSetupChatHandlers>
export type StartConversationPayload = More.ReturnType<typeof createStartConversation>
export type UpdateNotificationSettingsPayload = More.ReturnType<typeof createUpdateNotificationSettings>
export type UpdateTypersPayload = More.ReturnType<typeof createUpdateTypers>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAttachmentDownload>
  | More.ReturnType<typeof createAttachmentDownloaded>
  | More.ReturnType<typeof createAttachmentHandleQueue>
  | More.ReturnType<typeof createAttachmentLoad>
  | More.ReturnType<typeof createAttachmentLoaded>
  | More.ReturnType<typeof createAttachmentLoadedError>
  | More.ReturnType<typeof createAttachmentLoading>
  | More.ReturnType<typeof createAttachmentNeedsUpdating>
  | More.ReturnType<typeof createAttachmentUpload>
  | More.ReturnType<typeof createAttachmentUploaded>
  | More.ReturnType<typeof createAttachmentUploading>
  | More.ReturnType<typeof createBadgesUpdated>
  | More.ReturnType<typeof createBlockConversation>
  | More.ReturnType<typeof createClearLoading>
  | More.ReturnType<typeof createClearOrdinals>
  | More.ReturnType<typeof createClearPendingConversation>
  | More.ReturnType<typeof createDesktopNotification>
  | More.ReturnType<typeof createExitSearch>
  | More.ReturnType<typeof createInboxRefresh>
  | More.ReturnType<typeof createJoinConversation>
  | More.ReturnType<typeof createLeaveConversation>
  | More.ReturnType<typeof createLoadOlderMessagesDueToScroll>
  | More.ReturnType<typeof createMarkConversationsStale>
  | More.ReturnType<typeof createMarkInitiallyLoadedThreadAsRead>
  | More.ReturnType<typeof createMessageAttachmentNativeSave>
  | More.ReturnType<typeof createMessageAttachmentNativeShare>
  | More.ReturnType<typeof createMessageAttachmentUploaded>
  | More.ReturnType<typeof createMessageDelete>
  | More.ReturnType<typeof createMessageDeleteHistory>
  | More.ReturnType<typeof createMessageEdit>
  | More.ReturnType<typeof createMessageErrored>
  | More.ReturnType<typeof createMessageRetry>
  | More.ReturnType<typeof createMessageSend>
  | More.ReturnType<typeof createMessageSetEditing>
  | More.ReturnType<typeof createMessageWasEdited>
  | More.ReturnType<typeof createMessagesAdd>
  | More.ReturnType<typeof createMessagesWereDeleted>
  | More.ReturnType<typeof createMetaDelete>
  | More.ReturnType<typeof createMetaHandleQueue>
  | More.ReturnType<typeof createMetaNeedsUpdating>
  | More.ReturnType<typeof createMetaReceivedError>
  | More.ReturnType<typeof createMetaRequestTrusted>
  | More.ReturnType<typeof createMetaRequestingTrusted>
  | More.ReturnType<typeof createMetaUpdatePagination>
  | More.ReturnType<typeof createMetasReceived>
  | More.ReturnType<typeof createMuteConversation>
  | More.ReturnType<typeof createNavigateToInbox>
  | More.ReturnType<typeof createNavigateToThread>
  | More.ReturnType<typeof createNotificationSettingsUpdated>
  | More.ReturnType<typeof createOpenFolder>
  | More.ReturnType<typeof createResetChatWithoutThem>
  | More.ReturnType<typeof createResetLetThemIn>
  | More.ReturnType<typeof createSelectConversation>
  | More.ReturnType<typeof createSelectConversationDueToPush>
  | More.ReturnType<typeof createSendToPendingConversation>
  | More.ReturnType<typeof createSendTyping>
  | More.ReturnType<typeof createSetInboxFilter>
  | More.ReturnType<typeof createSetLoading>
  | More.ReturnType<typeof createSetPendingConversationUsers>
  | More.ReturnType<typeof createSetPendingMode>
  | More.ReturnType<typeof createSetPendingSelected>
  | More.ReturnType<typeof createSetupChatHandlers>
  | More.ReturnType<typeof createStartConversation>
  | More.ReturnType<typeof createUpdateNotificationSettings>
  | More.ReturnType<typeof createUpdateTypers>
  | {type: 'common:resetStore', payload: void}
