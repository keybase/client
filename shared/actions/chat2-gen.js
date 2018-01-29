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
export const attachmentSend = 'chat2:attachmentSend'
export const attachmentWithPreviewSend = 'chat2:attachmentWithPreviewSend'
export const badgesUpdated = 'chat2:badgesUpdated'
export const clearOrdinals = 'chat2:clearOrdinals'
export const clearPendingConversation = 'chat2:clearPendingConversation'
export const desktopNotification = 'chat2:desktopNotification'
export const exitSearch = 'chat2:exitSearch'
export const inboxRefresh = 'chat2:inboxRefresh'
export const joinConversation = 'chat2:joinConversation'
export const leaveConversation = 'chat2:leaveConversation'
export const loadMoreMessages = 'chat2:loadMoreMessages'
export const messageDelete = 'chat2:messageDelete'
export const messageEdit = 'chat2:messageEdit'
export const messageSend = 'chat2:messageSend'
export const messageSetEditing = 'chat2:messageSetEditing'
export const messageWasEdited = 'chat2:messageWasEdited'
export const messagesAdd = 'chat2:messagesAdd'
export const messagesWereDeleted = 'chat2:messagesWereDeleted'
export const metaHandleQueue = 'chat2:metaHandleQueue'
export const metaNeedsUpdating = 'chat2:metaNeedsUpdating'
export const metaReceivedError = 'chat2:metaReceivedError'
export const metaRequestTrusted = 'chat2:metaRequestTrusted'
export const metaRequestingTrusted = 'chat2:metaRequestingTrusted'
export const metasReceived = 'chat2:metasReceived'
export const muteConversation = 'chat2:muteConversation'
export const openFolder = 'chat2:openFolder'
export const resetChatWithoutThem = 'chat2:resetChatWithoutThem'
export const resetLetThemIn = 'chat2:resetLetThemIn'
export const selectConversation = 'chat2:selectConversation'
export const sendToPendingConversation = 'chat2:sendToPendingConversation'
export const setInboxFilter = 'chat2:setInboxFilter'
export const setLoading = 'chat2:setLoading'
export const setPendingConversationUsers = 'chat2:setPendingConversationUsers'
export const setPendingMode = 'chat2:setPendingMode'
export const setPendingSelected = 'chat2:setPendingSelected'
export const setupChatHandlers = 'chat2:setupChatHandlers'
export const startConversation = 'chat2:startConversation'

// Action Creators
export const createAttachmentSend = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    filename: string,
    title: string,
  }>
) => ({error: false, payload, type: attachmentSend})
export const createAttachmentWithPreviewSend = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    filename: string,
    title: string,
    preview: RPCChatTypes.MakePreviewRes,
  }>
) => ({error: false, payload, type: attachmentWithPreviewSend})
export const createBadgesUpdated = (payload: $ReadOnly<{conversations: Array<RPCTypes.BadgeConversationInfo>}>) => ({error: false, payload, type: badgesUpdated})
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
export const createInboxRefresh = (
  payload: $ReadOnly<{
    reason: string,
    clearAllData?: boolean,
  }>
) => ({error: false, payload, type: inboxRefresh})
export const createJoinConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: joinConversation})
export const createLeaveConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: leaveConversation})
export const createLoadMoreMessages = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: loadMoreMessages})
export const createMessageDelete = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
  }>
) => ({error: false, payload, type: messageDelete})
export const createMessageEdit = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    ordinal: Types.Ordinal,
    text: HiddenString,
  }>
) => ({error: false, payload, type: messageEdit})
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
    ordinal: Types.Ordinal,
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
    ordinals: Array<Types.Ordinal>,
  }>
) => ({error: false, payload, type: messagesWereDeleted})
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
    error: ?RPCChatTypes.ConversationErrorLocal,
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
export const createMetasReceived = (payload: $ReadOnly<{metas: Array<Types.ConversationMeta>}>) => ({error: false, payload, type: metasReceived})
export const createMuteConversation = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    muted: boolean,
  }>
) => ({error: false, payload, type: muteConversation})
export const createOpenFolder = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: openFolder})
export const createResetChatWithoutThem = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    username: string,
  }>
) => ({error: false, payload, type: resetChatWithoutThem})
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
  }>
) => ({error: false, payload, type: selectConversation})
export const createSendToPendingConversation = (
  payload: $ReadOnly<{
    users: Array<string>,
    sendingAction: More.ReturnType<typeof createAttachmentSend> | More.ReturnType<typeof createMessageSend>,
  }>
) => ({error: false, payload, type: sendToPendingConversation})
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

// Action Payloads
export type AttachmentSendPayload = More.ReturnType<typeof createAttachmentSend>
export type AttachmentWithPreviewSendPayload = More.ReturnType<typeof createAttachmentWithPreviewSend>
export type BadgesUpdatedPayload = More.ReturnType<typeof createBadgesUpdated>
export type ClearOrdinalsPayload = More.ReturnType<typeof createClearOrdinals>
export type ClearPendingConversationPayload = More.ReturnType<typeof createClearPendingConversation>
export type DesktopNotificationPayload = More.ReturnType<typeof createDesktopNotification>
export type ExitSearchPayload = More.ReturnType<typeof createExitSearch>
export type InboxRefreshPayload = More.ReturnType<typeof createInboxRefresh>
export type JoinConversationPayload = More.ReturnType<typeof createJoinConversation>
export type LeaveConversationPayload = More.ReturnType<typeof createLeaveConversation>
export type LoadMoreMessagesPayload = More.ReturnType<typeof createLoadMoreMessages>
export type MessageDeletePayload = More.ReturnType<typeof createMessageDelete>
export type MessageEditPayload = More.ReturnType<typeof createMessageEdit>
export type MessageSendPayload = More.ReturnType<typeof createMessageSend>
export type MessageSetEditingPayload = More.ReturnType<typeof createMessageSetEditing>
export type MessageWasEditedPayload = More.ReturnType<typeof createMessageWasEdited>
export type MessagesAddPayload = More.ReturnType<typeof createMessagesAdd>
export type MessagesWereDeletedPayload = More.ReturnType<typeof createMessagesWereDeleted>
export type MetaHandleQueuePayload = More.ReturnType<typeof createMetaHandleQueue>
export type MetaNeedsUpdatingPayload = More.ReturnType<typeof createMetaNeedsUpdating>
export type MetaReceivedErrorPayload = More.ReturnType<typeof createMetaReceivedError>
export type MetaRequestTrustedPayload = More.ReturnType<typeof createMetaRequestTrusted>
export type MetaRequestingTrustedPayload = More.ReturnType<typeof createMetaRequestingTrusted>
export type MetasReceivedPayload = More.ReturnType<typeof createMetasReceived>
export type MuteConversationPayload = More.ReturnType<typeof createMuteConversation>
export type OpenFolderPayload = More.ReturnType<typeof createOpenFolder>
export type ResetChatWithoutThemPayload = More.ReturnType<typeof createResetChatWithoutThem>
export type ResetLetThemInPayload = More.ReturnType<typeof createResetLetThemIn>
export type SelectConversationPayload = More.ReturnType<typeof createSelectConversation>
export type SendToPendingConversationPayload = More.ReturnType<typeof createSendToPendingConversation>
export type SetInboxFilterPayload = More.ReturnType<typeof createSetInboxFilter>
export type SetLoadingPayload = More.ReturnType<typeof createSetLoading>
export type SetPendingConversationUsersPayload = More.ReturnType<typeof createSetPendingConversationUsers>
export type SetPendingModePayload = More.ReturnType<typeof createSetPendingMode>
export type SetPendingSelectedPayload = More.ReturnType<typeof createSetPendingSelected>
export type SetupChatHandlersPayload = More.ReturnType<typeof createSetupChatHandlers>
export type StartConversationPayload = More.ReturnType<typeof createStartConversation>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAttachmentSend>
  | More.ReturnType<typeof createAttachmentWithPreviewSend>
  | More.ReturnType<typeof createBadgesUpdated>
  | More.ReturnType<typeof createClearOrdinals>
  | More.ReturnType<typeof createClearPendingConversation>
  | More.ReturnType<typeof createDesktopNotification>
  | More.ReturnType<typeof createExitSearch>
  | More.ReturnType<typeof createInboxRefresh>
  | More.ReturnType<typeof createJoinConversation>
  | More.ReturnType<typeof createLeaveConversation>
  | More.ReturnType<typeof createLoadMoreMessages>
  | More.ReturnType<typeof createMessageDelete>
  | More.ReturnType<typeof createMessageEdit>
  | More.ReturnType<typeof createMessageSend>
  | More.ReturnType<typeof createMessageSetEditing>
  | More.ReturnType<typeof createMessageWasEdited>
  | More.ReturnType<typeof createMessagesAdd>
  | More.ReturnType<typeof createMessagesWereDeleted>
  | More.ReturnType<typeof createMetaHandleQueue>
  | More.ReturnType<typeof createMetaNeedsUpdating>
  | More.ReturnType<typeof createMetaReceivedError>
  | More.ReturnType<typeof createMetaRequestTrusted>
  | More.ReturnType<typeof createMetaRequestingTrusted>
  | More.ReturnType<typeof createMetasReceived>
  | More.ReturnType<typeof createMuteConversation>
  | More.ReturnType<typeof createOpenFolder>
  | More.ReturnType<typeof createResetChatWithoutThem>
  | More.ReturnType<typeof createResetLetThemIn>
  | More.ReturnType<typeof createSelectConversation>
  | More.ReturnType<typeof createSendToPendingConversation>
  | More.ReturnType<typeof createSetInboxFilter>
  | More.ReturnType<typeof createSetLoading>
  | More.ReturnType<typeof createSetPendingConversationUsers>
  | More.ReturnType<typeof createSetPendingMode>
  | More.ReturnType<typeof createSetPendingSelected>
  | More.ReturnType<typeof createSetupChatHandlers>
  | More.ReturnType<typeof createStartConversation>
  | {type: 'common:resetStore', payload: void}
