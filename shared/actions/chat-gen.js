// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as TeamTypes from '../constants/types/teams'
import * as Types from '../constants/types/chat'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import HiddenString from '../util/hidden-string'
import {type DeviceType} from '../constants/types/devices'
import {type Path} from '../route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat but is handled by every reducer
export const addPending = 'chat:addPending'
export const appendMessages = 'chat:appendMessages'
export const attachmentLoaded = 'chat:attachmentLoaded'
export const attachmentSaveFailed = 'chat:attachmentSaveFailed'
export const attachmentSaveStart = 'chat:attachmentSaveStart'
export const attachmentSaved = 'chat:attachmentSaved'
export const blockConversation = 'chat:blockConversation'
export const clearMessages = 'chat:clearMessages'
export const deleteEntity = 'chat:deleteEntity'
export const deleteMessage = 'chat:deleteMessage'
export const downloadProgress = 'chat:downloadProgress'
export const editMessage = 'chat:editMessage'
export const incomingTyping = 'chat:incomingTyping'
export const joinConversation = 'chat:joinConversation'
export const leaveConversation = 'chat:leaveConversation'
export const loadAttachment = 'chat:loadAttachment'
export const loadAttachmentPreview = 'chat:loadAttachmentPreview'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const loadingMessages = 'chat:loadingMessages'
export const markSeenMessage = 'chat:markSeenMessage'
export const mergeEntity = 'chat:mergeEntity'
export const muteConversation = 'chat:muteConversation'
export const openAttachmentPopup = 'chat:openAttachmentPopup'
export const openConversation = 'chat:openConversation'
export const openFolder = 'chat:openFolder'
export const openTeamConversation = 'chat:openTeamConversation'
export const openTlfInChat = 'chat:openTlfInChat'
export const outboxMessageBecameReal = 'chat:outboxMessageBecameReal'
export const pendingToRealConversation = 'chat:pendingToRealConversation'
export const postMessage = 'chat:postMessage'
export const prependMessages = 'chat:prependMessages'
export const previewChannel = 'chat:previewChannel'
export const removeOutboxMessage = 'chat:removeOutboxMessage'
export const removeTempPendingConversations = 'chat:removeTempPendingConversations'
export const replaceEntity = 'chat:replaceEntity'
export const resetChatWithoutThem = 'chat:resetChatWithoutThem'
export const resetLetThemIn = 'chat:resetLetThemIn'
export const retryAttachment = 'chat:retryAttachment'
export const retryMessage = 'chat:retryMessage'
export const saveAttachment = 'chat:saveAttachment'
export const saveAttachmentNative = 'chat:saveAttachmentNative'
export const selectAttachment = 'chat:selectAttachment'
export const selectOrPreviewConversation = 'chat:selectOrPreviewConversation'
export const setLoaded = 'chat:setLoaded'
export const setNotificationSaveState = 'chat:setNotificationSaveState'
export const setNotifications = 'chat:setNotifications'
export const setPreviousConversation = 'chat:setPreviousConversation'
export const setTypers = 'chat:setTypers'
export const setupChatHandlers = 'chat:setupChatHandlers'
export const shareAttachment = 'chat:shareAttachment'
export const showEditor = 'chat:showEditor'
export const startConversation = 'chat:startConversation'
export const subtractEntity = 'chat:subtractEntity'
export const threadLoadedOffline = 'chat:threadLoadedOffline'
export const toggleChannelWideNotifications = 'chat:toggleChannelWideNotifications'
export const updateBadging = 'chat:updateBadging'
export const updateBrokenTracker = 'chat:updateBrokenTracker'
export const updateLatestMessage = 'chat:updateLatestMessage'
export const updateMetadata = 'chat:updateMetadata'
export const updateResetParticipants = 'chat:updateResetParticipants'
export const updateTempMessage = 'chat:updateTempMessage'
export const updateThread = 'chat:updateThread'
export const updateTyping = 'chat:updateTyping'
export const updatedMetadata = 'chat:updatedMetadata'
export const updatedNotifications = 'chat:updatedNotifications'
export const uploadProgress = 'chat:uploadProgress'

// Action Creators
export const createAddPending = (
  payload: $ReadOnly<{
    participants: Array<string>,
    temporary: boolean,
  }>
) => ({error: false, payload, type: addPending})
export const createAppendMessages = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    isSelected: boolean,
    isAppFocused: boolean,
    messages: Array<Types.ServerMessage>,
    svcShouldDisplayNotification: boolean,
  }>
) => ({error: false, payload, type: appendMessages})
export const createAttachmentLoaded = (
  payload: $ReadOnly<{
    messageKey: Types.MessageKey,
    path: ?string,
    isPreview: boolean,
  }>
) => ({error: false, payload, type: attachmentLoaded})
export const createAttachmentSaveFailed = (payload: $ReadOnly<{messageKey: Types.MessageKey}>) => ({error: false, payload, type: attachmentSaveFailed})
export const createAttachmentSaveStart = (payload: $ReadOnly<{messageKey: Types.MessageKey}>) => ({error: false, payload, type: attachmentSaveStart})
export const createAttachmentSaved = (
  payload: $ReadOnly<{
    messageKey: Types.MessageKey,
    path: ?string,
  }>
) => ({error: false, payload, type: attachmentSaved})
export const createBlockConversation = (
  payload: $ReadOnly<{
    blocked: boolean,
    conversationIDKey: Types.ConversationIDKey,
    reportUser: boolean,
  }>
) => ({error: false, payload, type: blockConversation})
export const createClearMessages = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: clearMessages})
export const createDeleteEntity = (
  payload: $ReadOnly<{
    keyPath: Array<string>,
    ids: Iterable<string>,
  }>
) => ({error: false, payload, type: deleteEntity})
export const createDeleteMessage = (payload: $ReadOnly<{message: Types.Message}>) => ({error: false, payload, type: deleteMessage})
export const createDownloadProgress = (
  payload: $ReadOnly<{
    messageKey: Types.MessageKey,
    isPreview: boolean,
    progress: ?number,
  }>
) => ({error: false, payload, type: downloadProgress})
export const createEditMessage = (
  payload: $ReadOnly<{
    message: Types.Message,
    text: HiddenString,
  }>
) => ({error: false, payload, type: editMessage})
export const createIncomingTyping = (payload: $ReadOnly<{activity: RPCChatTypes.TyperInfo}>) => ({error: false, payload, type: incomingTyping})
export const createJoinConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: joinConversation})
export const createLeaveConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: leaveConversation})
export const createLoadAttachment = (
  payload: $ReadOnly<{
    messageKey: Types.MessageKey,
    loadPreview: boolean,
  }>
) => ({error: false, payload, type: loadAttachment})
export const createLoadAttachmentPreview = (payload: $ReadOnly<{messageKey: Types.MessageKey}>) => ({error: false, payload, type: loadAttachmentPreview})
export const createLoadMoreMessages = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    onlyIfUnloaded: boolean,
    fromUser?: boolean,
    wantNewer?: boolean,
    numberOverride?: ?number,
  }>
) => ({error: false, payload, type: loadMoreMessages})
export const createLoadingMessages = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    isRequesting: boolean,
  }>
) => ({error: false, payload, type: loadingMessages})
export const createMarkSeenMessage = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    messageKey: Types.MessageKey,
  }>
) => ({error: false, payload, type: markSeenMessage})
export const createMergeEntity = (
  payload: $ReadOnly<{
    keyPath: Array<string>,
    entities: I.Map<any, any> | I.List<any>,
  }>
) => ({error: false, payload, type: mergeEntity})
export const createMuteConversation = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    muted: boolean,
  }>
) => ({error: false, payload, type: muteConversation})
export const createOpenAttachmentPopup = (
  payload: $ReadOnly<{
    message: Types.AttachmentMessage,
    currentPath: Path,
  }>
) => ({error: false, payload, type: openAttachmentPopup})
export const createOpenConversation = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: openConversation})
export const createOpenFolder = () => ({error: false, payload: undefined, type: openFolder})
export const createOpenTeamConversation = (
  payload: $ReadOnly<{
    teamname: TeamTypes.Teamname,
    channelname: string,
  }>
) => ({error: false, payload, type: openTeamConversation})
export const createOpenTlfInChat = (
  payload: $ReadOnly<{
    tlf: string,
    isTeam?: boolean,
  }>
) => ({error: false, payload, type: openTlfInChat})
export const createOutboxMessageBecameReal = (
  payload: $ReadOnly<{
    oldMessageKey: Types.MessageKey,
    newMessageKey: Types.MessageKey,
  }>
) => ({error: false, payload, type: outboxMessageBecameReal})
export const createPendingToRealConversation = (
  payload: $ReadOnly<{
    oldKey: Types.ConversationIDKey,
    newKey: Types.ConversationIDKey,
  }>
) => ({error: false, payload, type: pendingToRealConversation})
export const createPostMessage = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    text: HiddenString,
  }>
) => ({error: false, payload, type: postMessage})
export const createPrependMessages = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    messages: Array<Types.ServerMessage>,
    moreToLoad: boolean,
  }>
) => ({error: false, payload, type: prependMessages})
export const createPreviewChannel = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: previewChannel})
export const createRemoveOutboxMessage = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    outboxID: Types.OutboxIDKey,
  }>
) => ({error: false, payload, type: removeOutboxMessage})
export const createRemoveTempPendingConversations = () => ({error: false, payload: undefined, type: removeTempPendingConversations})
export const createReplaceEntity = (
  payload: $ReadOnly<{
    keyPath: Array<string>,
    entities: I.Map<any, any> | I.List<any>,
  }>
) => ({error: false, payload, type: replaceEntity})
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
export const createRetryAttachment = (payload: $ReadOnly<{message: Types.AttachmentMessage}>) => ({error: false, payload, type: retryAttachment})
export const createRetryMessage = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    outboxIDKey: string,
  }>
) => ({error: false, payload, type: retryMessage})
export const createSaveAttachment = (payload: $ReadOnly<{messageKey: Types.MessageKey}>) => ({error: false, payload, type: saveAttachment})
export const createSaveAttachmentNative = (payload: $ReadOnly<{messageKey: Types.MessageKey}>) => ({error: false, payload, type: saveAttachmentNative})
export const createSelectAttachment = (payload: $ReadOnly<{input: Types.AttachmentInput}>) => ({error: false, payload, type: selectAttachment})
export const createSelectOrPreviewConversation = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    previousPath: Array<string>,
  }>
) => ({error: false, payload, type: selectOrPreviewConversation})
export const createSetLoaded = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    isLoaded: boolean,
  }>
) => ({error: false, payload, type: setLoaded})
export const createSetNotificationSaveState = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    saveState: Types.NotificationSaveState,
  }>
) => ({error: false, payload, type: setNotificationSaveState})
export const createSetNotifications = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Types.NotifyType,
  }>
) => ({error: false, payload, type: setNotifications})
export const createSetPreviousConversation = (payload: $ReadOnly<{conversationIDKey: ?Types.ConversationIDKey}>) => ({error: false, payload, type: setPreviousConversation})
export const createSetTypers = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    typing: Array<string>,
  }>
) => ({error: false, payload, type: setTypers})
export const createSetupChatHandlers = () => ({error: false, payload: undefined, type: setupChatHandlers})
export const createShareAttachment = (payload: $ReadOnly<{messageKey: Types.MessageKey}>) => ({error: false, payload, type: shareAttachment})
export const createShowEditor = (payload: $ReadOnly<{message: ?Types.Message}>) => ({error: false, payload, type: showEditor})
export const createStartConversation = (
  payload: $ReadOnly<{
    users: Array<string>,
    forceImmediate?: boolean,
    temporary?: boolean,
    forSearch?: boolean,
  }>
) => ({error: false, payload, type: startConversation})
export const createSubtractEntity = (
  payload: $ReadOnly<{
    keyPath: Array<string>,
    entities: I.List<any>,
  }>
) => ({error: false, payload, type: subtractEntity})
export const createThreadLoadedOffline = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: threadLoadedOffline})
export const createToggleChannelWideNotifications = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: toggleChannelWideNotifications})
export const createUpdateBadging = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: updateBadging})
export const createUpdateBrokenTracker = (payload: $ReadOnly<{userToBroken: {[username: string]: boolean}}>) => ({error: false, payload, type: updateBrokenTracker})
export const createUpdateLatestMessage = (payload: $ReadOnly<{conversationIDKey: Types.ConversationIDKey}>) => ({error: false, payload, type: updateLatestMessage})
export const createUpdateMetadata = (payload: $ReadOnly<{users: Array<string>}>) => ({error: false, payload, type: updateMetadata})
export const createUpdateResetParticipants = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    participants: Array<string>,
  }>
) => ({error: false, payload, type: updateResetParticipants})
export const createUpdateTempMessage = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    message: $Shape<Types.AttachmentMessage> | $Shape<Types.TextMessage>,
    outboxIDKey: Types.OutboxIDKey,
  }>
) => ({error: false, payload, type: updateTempMessage})
export const createUpdateThread = (
  payload: $ReadOnly<{
    thread: RPCChatTypes.UIMessages,
    yourName: string,
    yourDeviceName: string,
    conversationIDKey: string,
    append: boolean,
  }>
) => ({error: false, payload, type: updateThread})
export const createUpdateTyping = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    typing: boolean,
  }>
) => ({error: false, payload, type: updateTyping})
export const createUpdatedMetadata = (payload: $ReadOnly<{updated: {[key: string]: Types.MetaData}}>) => ({error: false, payload, type: updatedMetadata})
export const createUpdatedNotifications = (
  payload: $ReadOnly<{
    conversationIDKey: Types.ConversationIDKey,
    notifications: Types.NotificationsState,
  }>
) => ({error: false, payload, type: updatedNotifications})
export const createUploadProgress = (
  payload: $ReadOnly<{
    messageKey: Types.MessageKey,
    progress: ?number,
  }>
) => ({error: false, payload, type: uploadProgress})

// Action Payloads
export type AddPendingPayload = More.ReturnType<typeof createAddPending>
export type AppendMessagesPayload = More.ReturnType<typeof createAppendMessages>
export type AttachmentLoadedPayload = More.ReturnType<typeof createAttachmentLoaded>
export type AttachmentSaveFailedPayload = More.ReturnType<typeof createAttachmentSaveFailed>
export type AttachmentSaveStartPayload = More.ReturnType<typeof createAttachmentSaveStart>
export type AttachmentSavedPayload = More.ReturnType<typeof createAttachmentSaved>
export type BlockConversationPayload = More.ReturnType<typeof createBlockConversation>
export type ClearMessagesPayload = More.ReturnType<typeof createClearMessages>
export type DeleteEntityPayload = More.ReturnType<typeof createDeleteEntity>
export type DeleteMessagePayload = More.ReturnType<typeof createDeleteMessage>
export type DownloadProgressPayload = More.ReturnType<typeof createDownloadProgress>
export type EditMessagePayload = More.ReturnType<typeof createEditMessage>
export type IncomingTypingPayload = More.ReturnType<typeof createIncomingTyping>
export type JoinConversationPayload = More.ReturnType<typeof createJoinConversation>
export type LeaveConversationPayload = More.ReturnType<typeof createLeaveConversation>
export type LoadAttachmentPayload = More.ReturnType<typeof createLoadAttachment>
export type LoadAttachmentPreviewPayload = More.ReturnType<typeof createLoadAttachmentPreview>
export type LoadMoreMessagesPayload = More.ReturnType<typeof createLoadMoreMessages>
export type LoadingMessagesPayload = More.ReturnType<typeof createLoadingMessages>
export type MarkSeenMessagePayload = More.ReturnType<typeof createMarkSeenMessage>
export type MergeEntityPayload = More.ReturnType<typeof createMergeEntity>
export type MuteConversationPayload = More.ReturnType<typeof createMuteConversation>
export type OpenAttachmentPopupPayload = More.ReturnType<typeof createOpenAttachmentPopup>
export type OpenConversationPayload = More.ReturnType<typeof createOpenConversation>
export type OpenFolderPayload = More.ReturnType<typeof createOpenFolder>
export type OpenTeamConversationPayload = More.ReturnType<typeof createOpenTeamConversation>
export type OpenTlfInChatPayload = More.ReturnType<typeof createOpenTlfInChat>
export type OutboxMessageBecameRealPayload = More.ReturnType<typeof createOutboxMessageBecameReal>
export type PendingToRealConversationPayload = More.ReturnType<typeof createPendingToRealConversation>
export type PostMessagePayload = More.ReturnType<typeof createPostMessage>
export type PrependMessagesPayload = More.ReturnType<typeof createPrependMessages>
export type PreviewChannelPayload = More.ReturnType<typeof createPreviewChannel>
export type RemoveOutboxMessagePayload = More.ReturnType<typeof createRemoveOutboxMessage>
export type RemoveTempPendingConversationsPayload = More.ReturnType<typeof createRemoveTempPendingConversations>
export type ReplaceEntityPayload = More.ReturnType<typeof createReplaceEntity>
export type ResetChatWithoutThemPayload = More.ReturnType<typeof createResetChatWithoutThem>
export type ResetLetThemInPayload = More.ReturnType<typeof createResetLetThemIn>
export type RetryAttachmentPayload = More.ReturnType<typeof createRetryAttachment>
export type RetryMessagePayload = More.ReturnType<typeof createRetryMessage>
export type SaveAttachmentNativePayload = More.ReturnType<typeof createSaveAttachmentNative>
export type SaveAttachmentPayload = More.ReturnType<typeof createSaveAttachment>
export type SelectAttachmentPayload = More.ReturnType<typeof createSelectAttachment>
export type SelectOrPreviewConversationPayload = More.ReturnType<typeof createSelectOrPreviewConversation>
export type SetLoadedPayload = More.ReturnType<typeof createSetLoaded>
export type SetNotificationSaveStatePayload = More.ReturnType<typeof createSetNotificationSaveState>
export type SetNotificationsPayload = More.ReturnType<typeof createSetNotifications>
export type SetPreviousConversationPayload = More.ReturnType<typeof createSetPreviousConversation>
export type SetTypersPayload = More.ReturnType<typeof createSetTypers>
export type SetupChatHandlersPayload = More.ReturnType<typeof createSetupChatHandlers>
export type ShareAttachmentPayload = More.ReturnType<typeof createShareAttachment>
export type ShowEditorPayload = More.ReturnType<typeof createShowEditor>
export type StartConversationPayload = More.ReturnType<typeof createStartConversation>
export type SubtractEntityPayload = More.ReturnType<typeof createSubtractEntity>
export type ThreadLoadedOfflinePayload = More.ReturnType<typeof createThreadLoadedOffline>
export type ToggleChannelWideNotificationsPayload = More.ReturnType<typeof createToggleChannelWideNotifications>
export type UpdateBadgingPayload = More.ReturnType<typeof createUpdateBadging>
export type UpdateBrokenTrackerPayload = More.ReturnType<typeof createUpdateBrokenTracker>
export type UpdateLatestMessagePayload = More.ReturnType<typeof createUpdateLatestMessage>
export type UpdateMetadataPayload = More.ReturnType<typeof createUpdateMetadata>
export type UpdateResetParticipantsPayload = More.ReturnType<typeof createUpdateResetParticipants>
export type UpdateTempMessagePayload = More.ReturnType<typeof createUpdateTempMessage>
export type UpdateThreadPayload = More.ReturnType<typeof createUpdateThread>
export type UpdateTypingPayload = More.ReturnType<typeof createUpdateTyping>
export type UpdatedMetadataPayload = More.ReturnType<typeof createUpdatedMetadata>
export type UpdatedNotificationsPayload = More.ReturnType<typeof createUpdatedNotifications>
export type UploadProgressPayload = More.ReturnType<typeof createUploadProgress>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAddPending>
  | More.ReturnType<typeof createAppendMessages>
  | More.ReturnType<typeof createAttachmentLoaded>
  | More.ReturnType<typeof createAttachmentSaveFailed>
  | More.ReturnType<typeof createAttachmentSaveStart>
  | More.ReturnType<typeof createAttachmentSaved>
  | More.ReturnType<typeof createBlockConversation>
  | More.ReturnType<typeof createClearMessages>
  | More.ReturnType<typeof createDeleteEntity>
  | More.ReturnType<typeof createDeleteMessage>
  | More.ReturnType<typeof createDownloadProgress>
  | More.ReturnType<typeof createEditMessage>
  | More.ReturnType<typeof createIncomingTyping>
  | More.ReturnType<typeof createJoinConversation>
  | More.ReturnType<typeof createLeaveConversation>
  | More.ReturnType<typeof createLoadAttachment>
  | More.ReturnType<typeof createLoadAttachmentPreview>
  | More.ReturnType<typeof createLoadMoreMessages>
  | More.ReturnType<typeof createLoadingMessages>
  | More.ReturnType<typeof createMarkSeenMessage>
  | More.ReturnType<typeof createMergeEntity>
  | More.ReturnType<typeof createMuteConversation>
  | More.ReturnType<typeof createOpenAttachmentPopup>
  | More.ReturnType<typeof createOpenConversation>
  | More.ReturnType<typeof createOpenFolder>
  | More.ReturnType<typeof createOpenTeamConversation>
  | More.ReturnType<typeof createOpenTlfInChat>
  | More.ReturnType<typeof createOutboxMessageBecameReal>
  | More.ReturnType<typeof createPendingToRealConversation>
  | More.ReturnType<typeof createPostMessage>
  | More.ReturnType<typeof createPrependMessages>
  | More.ReturnType<typeof createPreviewChannel>
  | More.ReturnType<typeof createRemoveOutboxMessage>
  | More.ReturnType<typeof createRemoveTempPendingConversations>
  | More.ReturnType<typeof createReplaceEntity>
  | More.ReturnType<typeof createResetChatWithoutThem>
  | More.ReturnType<typeof createResetLetThemIn>
  | More.ReturnType<typeof createRetryAttachment>
  | More.ReturnType<typeof createRetryMessage>
  | More.ReturnType<typeof createSaveAttachment>
  | More.ReturnType<typeof createSaveAttachmentNative>
  | More.ReturnType<typeof createSelectAttachment>
  | More.ReturnType<typeof createSelectOrPreviewConversation>
  | More.ReturnType<typeof createSetLoaded>
  | More.ReturnType<typeof createSetNotificationSaveState>
  | More.ReturnType<typeof createSetNotifications>
  | More.ReturnType<typeof createSetPreviousConversation>
  | More.ReturnType<typeof createSetTypers>
  | More.ReturnType<typeof createSetupChatHandlers>
  | More.ReturnType<typeof createShareAttachment>
  | More.ReturnType<typeof createShowEditor>
  | More.ReturnType<typeof createStartConversation>
  | More.ReturnType<typeof createSubtractEntity>
  | More.ReturnType<typeof createThreadLoadedOffline>
  | More.ReturnType<typeof createToggleChannelWideNotifications>
  | More.ReturnType<typeof createUpdateBadging>
  | More.ReturnType<typeof createUpdateBrokenTracker>
  | More.ReturnType<typeof createUpdateLatestMessage>
  | More.ReturnType<typeof createUpdateMetadata>
  | More.ReturnType<typeof createUpdateResetParticipants>
  | More.ReturnType<typeof createUpdateTempMessage>
  | More.ReturnType<typeof createUpdateThread>
  | More.ReturnType<typeof createUpdateTyping>
  | More.ReturnType<typeof createUpdatedMetadata>
  | More.ReturnType<typeof createUpdatedNotifications>
  | More.ReturnType<typeof createUploadProgress>
  | {type: 'common:resetStore', payload: void}
