// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as ChatTypes from '../constants/types/flow-types-chat'
import * as I from 'immutable'
import HiddenString from '../util/hidden-string'
import {type DeviceType} from '../constants/types/more'
import {type Path} from '../route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat but is handled by every reducer
export const addPending = 'chat:addPending'
export const attachmentSaveFailed = 'chat:attachmentSaveFailed'
export const attachmentSaveStart = 'chat:attachmentSaveStart'
export const attachmentSaved = 'chat:attachmentSaved'
export const blockConversation = 'chat:blockConversation'
export const clearMessages = 'chat:clearMessages'
export const clearRekey = 'chat:clearRekey'
export const deleteEntity = 'chat:deleteEntity'
export const deleteMessage = 'chat:deleteMessage'
export const editMessage = 'chat:editMessage'
export const exitSearch = 'chat:exitSearch'
export const getInboxAndUnbox = 'chat:getInboxAndUnbox'
export const inboxStale = 'chat:inboxStale'
export const inboxSynced = 'chat:inboxSynced'
export const incomingMessage = 'chat:incomingMessage'
export const incomingTyping = 'chat:incomingTyping'
export const leaveConversation = 'chat:leaveConversation'
export const loadAttachment = 'chat:loadAttachment'
export const loadInbox = 'chat:loadInbox'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const loadingMessages = 'chat:loadingMessages'
export const markSeenMessage = 'chat:markSeenMessage'
export const markThreadsStale = 'chat:markThreadsStale'
export const mergeEntity = 'chat:mergeEntity'
export const muteConversation = 'chat:muteConversation'
export const newChat = 'chat:newChat'
export const openAttachmentPopup = 'chat:openAttachmentPopup'
export const openConversation = 'chat:openConversation'
export const openFolder = 'chat:openFolder'
export const openTlfInChat = 'chat:openTlfInChat'
export const outboxMessageBecameReal = 'chat:outboxMessageBecameReal'
export const pendingToRealConversation = 'chat:pendingToRealConversation'
export const removeOutboxMessage = 'chat:removeOutboxMessage'
export const removeTempPendingConversations = 'chat:removeTempPendingConversations'
export const replaceEntity = 'chat:replaceEntity'
export const saveAttachment = 'chat:saveAttachment'
export const selectAttachment = 'chat:selectAttachment'
export const selectConversation = 'chat:selectConversation'
export const selectNext = 'chat:selectNext'
export const setInboxFilter = 'chat:setInboxFilter'
export const setInboxGlobalUntrustedState = 'chat:setInboxGlobalUntrustedState'
export const setLoaded = 'chat:setLoaded'
export const setNotifications = 'chat:setNotifications'
export const setPreviousConversation = 'chat:setPreviousConversation'
export const setTypers = 'chat:setTypers'
export const setupChatHandlers = 'chat:setupChatHandlers'
export const showEditor = 'chat:showEditor'
export const subtractEntity = 'chat:subtractEntity'
export const threadLoadedOffline = 'chat:threadLoadedOffline'
export const toggleChannelWideNotifications = 'chat:toggleChannelWideNotifications'
export const unboxConversations = 'chat:unboxConversations'
export const unboxMore = 'chat:unboxMore'
export const updateBadging = 'chat:updateBadging'
export const updateBrokenTracker = 'chat:updateBrokenTracker'
export const updateFinalizedState = 'chat:updateFinalizedState'
export const updateInboxComplete = 'chat:updateInboxComplete'
export const updateInboxRekeyOthers = 'chat:updateInboxRekeyOthers'
export const updateInboxRekeySelf = 'chat:updateInboxRekeySelf'
export const updateLatestMessage = 'chat:updateLatestMessage'
export const updateMetadata = 'chat:updateMetadata'
export const updateSnippet = 'chat:updateSnippet'
export const updateSupersededByState = 'chat:updateSupersededByState'
export const updateSupersedesState = 'chat:updateSupersedesState'
export const updateThread = 'chat:updateThread'
export const updateTyping = 'chat:updateTyping'
export const updatedMetadata = 'chat:updatedMetadata'
export const updatedNotifications = 'chat:updatedNotifications'
export const uploadProgress = 'chat:uploadProgress'

// Action Creators
export const createAddPending = (payload: {|participants: Array<string>, temporary: boolean|}) => ({error: false, payload, type: addPending})
export const createAttachmentSaveFailed = (payload: {|messageKey: Constants.MessageKey|}) => ({error: false, payload, type: attachmentSaveFailed})
export const createAttachmentSaveStart = (payload: {|messageKey: Constants.MessageKey|}) => ({error: false, payload, type: attachmentSaveStart})
export const createAttachmentSaved = (payload: {|messageKey: Constants.MessageKey, path: ?string|}) => ({error: false, payload, type: attachmentSaved})
export const createBlockConversation = (payload: {|blocked: boolean, conversationIDKey: Constants.ConversationIDKey, reportUser: boolean|}) => ({error: false, payload, type: blockConversation})
export const createClearMessages = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: clearMessages})
export const createClearRekey = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: clearRekey})
export const createDeleteEntity = (payload: {|keyPath: Array<string>, ids: Iterable<string>|}) => ({error: false, payload, type: deleteEntity})
export const createDeleteMessage = (payload: {|message: Constants.Message|}) => ({error: false, payload, type: deleteMessage})
export const createEditMessage = (payload: {|message: Constants.Message, text: HiddenString|}) => ({error: false, payload, type: editMessage})
export const createExitSearch = (payload: {|skipSelectPreviousConversation: boolean|}) => ({error: false, payload, type: exitSearch})
export const createGetInboxAndUnbox = (payload: {|conversationIDKeys: Array<Constants.ConversationIDKey>|}) => ({error: false, payload, type: getInboxAndUnbox})
export const createInboxStale = (payload: {|reason: string|}) => ({error: false, payload, type: inboxStale})
export const createInboxSynced = (payload: {|convs: Array<ChatTypes.UnverifiedInboxUIItem>|}) => ({error: false, payload, type: inboxSynced})
export const createIncomingMessage = (payload: {|activity: ChatTypes.ChatActivity|}) => ({error: false, payload, type: incomingMessage})
export const createIncomingTyping = (payload: {|activity: ChatTypes.TyperInfo|}) => ({error: false, payload, type: incomingTyping})
export const createLeaveConversation = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: leaveConversation})
export const createLoadAttachment = (payload: {|messageKey: Constants.MessageKey, loadPreview: boolean|}) => ({error: false, payload, type: loadAttachment})
export const createLoadInbox = () => ({error: false, payload: undefined, type: loadInbox})
export const createLoadMoreMessages = (payload: {|conversationIDKey: Constants.ConversationIDKey, onlyIfUnloaded: boolean, fromUser?: boolean, wantNewer?: boolean, numberOverride?: ?number|}) => ({error: false, payload, type: loadMoreMessages})
export const createLoadingMessages = (payload: {|conversationIDKey: Constants.ConversationIDKey, isRequesting: boolean|}) => ({error: false, payload, type: loadingMessages})
export const createMarkSeenMessage = (payload: {|conversationIDKey: Constants.ConversationIDKey, messageKey: Constants.MessageKey|}) => ({error: false, payload, type: markSeenMessage})
export const createMarkThreadsStale = (payload: {|updates: Array<ChatTypes.ConversationStaleUpdate>|}) => ({error: false, payload, type: markThreadsStale})
export const createMergeEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: mergeEntity})
export const createMuteConversation = (payload: {|conversationIDKey: Constants.ConversationIDKey, muted: boolean|}) => ({error: false, payload, type: muteConversation})
export const createNewChat = () => ({error: false, payload: undefined, type: newChat})
export const createOpenAttachmentPopup = (payload: {|message: Constants.AttachmentMessage, currentPath: Path|}) => ({error: false, payload, type: openAttachmentPopup})
export const createOpenConversation = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: openConversation})
export const createOpenFolder = () => ({error: false, payload: undefined, type: openFolder})
export const createOpenTlfInChat = (payload: {|tlf: string|}) => ({error: false, payload, type: openTlfInChat})
export const createOutboxMessageBecameReal = (payload: {|oldMessageKey: Constants.MessageKey, newMessageKey: Constants.MessageKey|}) => ({error: false, payload, type: outboxMessageBecameReal})
export const createPendingToRealConversation = (payload: {|oldKey: Constants.ConversationIDKey, newKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: pendingToRealConversation})
export const createRemoveOutboxMessage = (payload: {|conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey|}) => ({error: false, payload, type: removeOutboxMessage})
export const createRemoveTempPendingConversations = () => ({error: false, payload: undefined, type: removeTempPendingConversations})
export const createReplaceEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: replaceEntity})
export const createSaveAttachment = (payload: {|messageKey: Constants.MessageKey|}) => ({error: false, payload, type: saveAttachment})
export const createSelectAttachment = (payload: {|input: Constants.AttachmentInput|}) => ({error: false, payload, type: selectAttachment})
export const createSelectConversation = (payload: {|conversationIDKey: ?Constants.ConversationIDKey, fromUser?: boolean|}) => ({error: false, payload, type: selectConversation})
export const createSelectNext = (payload: {|rows: Array<any>, direction: -1 | 1|}) => ({error: false, payload, type: selectNext})
export const createSetInboxFilter = (payload: {|filter: string|}) => ({error: false, payload, type: setInboxFilter})
export const createSetInboxGlobalUntrustedState = (payload: {|inboxGlobalUntrustedState: Constants.UntrustedState|}) => ({error: false, payload, type: setInboxGlobalUntrustedState})
export const createSetLoaded = (payload: {|conversationIDKey: Constants.ConversationIDKey, isLoaded: boolean|}) => ({error: false, payload, type: setLoaded})
export const createSetNotifications = (payload: {|conversationIDKey: Constants.ConversationIDKey, deviceType: DeviceType, notifyType: Constants.NotifyType|}) => ({error: false, payload, type: setNotifications})
export const createSetPreviousConversation = (payload: {|conversationIDKey: ?Constants.ConversationIDKey|}) => ({error: false, payload, type: setPreviousConversation})
export const createSetTypers = (payload: {|conversationIDKey: Constants.ConversationIDKey, typing: Array<string>|}) => ({error: false, payload, type: setTypers})
export const createSetupChatHandlers = () => ({error: false, payload: undefined, type: setupChatHandlers})
export const createShowEditor = (payload: {|message: ?Constants.Message|}) => ({error: false, payload, type: showEditor})
export const createSubtractEntity = (payload: {|keyPath: Array<string>, entities: I.List<any>|}) => ({error: false, payload, type: subtractEntity})
export const createThreadLoadedOffline = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: threadLoadedOffline})
export const createToggleChannelWideNotifications = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: toggleChannelWideNotifications})
export const createUnboxConversations = (payload: {|conversationIDKeys: Array<Constants.ConversationIDKey>, reason: string, force?: boolean, forInboxSync?: boolean|}) => ({error: false, payload, type: unboxConversations})
export const createUnboxMore = () => ({error: false, payload: undefined, type: unboxMore})
export const createUpdateBadging = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: updateBadging})
export const createUpdateBrokenTracker = (payload: {|userToBroken: {[username: string]: boolean}|}) => ({error: false, payload, type: updateBrokenTracker})
export const createUpdateFinalizedState = (payload: {|finalizedState: Constants.FinalizedState|}) => ({error: false, payload, type: updateFinalizedState})
export const createUpdateInboxComplete = () => ({error: false, payload: undefined, type: updateInboxComplete})
export const createUpdateInboxRekeyOthers = (payload: {|conversationIDKey: Constants.ConversationIDKey, rekeyers: Array<string>|}) => ({error: false, payload, type: updateInboxRekeyOthers})
export const createUpdateInboxRekeySelf = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: updateInboxRekeySelf})
export const createUpdateLatestMessage = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: updateLatestMessage})
export const createUpdateMetadata = (payload: {|users: Array<string>|}) => ({error: false, payload, type: updateMetadata})
export const createUpdateSnippet = (payload: {|conversationIDKey: Constants.ConversationIDKey, snippet: HiddenString|}) => ({error: false, payload, type: updateSnippet})
export const createUpdateSupersededByState = (payload: {|supersededByState: Constants.SupersededByState|}) => ({error: false, payload, type: updateSupersededByState})
export const createUpdateSupersedesState = (payload: {|supersedesState: Constants.SupersedesState|}) => ({error: false, payload, type: updateSupersedesState})
export const createUpdateThread = (payload: {|thread: ChatTypes.UIMessages, yourName: string, yourDeviceName: string, conversationIDKey: string, append: boolean|}) => ({error: false, payload, type: updateThread})
export const createUpdateTyping = (payload: {|conversationIDKey: Constants.ConversationIDKey, typing: boolean|}) => ({error: false, payload, type: updateTyping})
export const createUpdatedMetadata = (payload: {|updated: {[key: string]: Constants.MetaData}|}) => ({error: false, payload, type: updatedMetadata})
export const createUpdatedNotifications = (payload: {|conversationIDKey: Constants.ConversationIDKey, notifications: Constants.NotificationsState|}) => ({error: false, payload, type: updatedNotifications})
export const createUploadProgress = (payload: {|messageKey: Constants.MessageKey, progress: ?number|}) => ({error: false, payload, type: uploadProgress})

// Action Payloads
export type AddPendingPayload = ReturnType<typeof createAddPending>
export type AttachmentSaveFailedPayload = ReturnType<typeof createAttachmentSaveFailed>
export type AttachmentSaveStartPayload = ReturnType<typeof createAttachmentSaveStart>
export type AttachmentSavedPayload = ReturnType<typeof createAttachmentSaved>
export type BlockConversationPayload = ReturnType<typeof createBlockConversation>
export type ClearMessagesPayload = ReturnType<typeof createClearMessages>
export type ClearRekeyPayload = ReturnType<typeof createClearRekey>
export type DeleteEntityPayload = ReturnType<typeof createDeleteEntity>
export type DeleteMessagePayload = ReturnType<typeof createDeleteMessage>
export type EditMessagePayload = ReturnType<typeof createEditMessage>
export type ExitSearchPayload = ReturnType<typeof createExitSearch>
export type GetInboxAndUnboxPayload = ReturnType<typeof createGetInboxAndUnbox>
export type InboxStalePayload = ReturnType<typeof createInboxStale>
export type InboxSyncedPayload = ReturnType<typeof createInboxSynced>
export type IncomingMessagePayload = ReturnType<typeof createIncomingMessage>
export type IncomingTypingPayload = ReturnType<typeof createIncomingTyping>
export type LeaveConversationPayload = ReturnType<typeof createLeaveConversation>
export type LoadAttachmentPayload = ReturnType<typeof createLoadAttachment>
export type LoadInboxPayload = ReturnType<typeof createLoadInbox>
export type LoadMoreMessagesPayload = ReturnType<typeof createLoadMoreMessages>
export type LoadingMessagesPayload = ReturnType<typeof createLoadingMessages>
export type MarkSeenMessagePayload = ReturnType<typeof createMarkSeenMessage>
export type MarkThreadsStalePayload = ReturnType<typeof createMarkThreadsStale>
export type MergeEntityPayload = ReturnType<typeof createMergeEntity>
export type MuteConversationPayload = ReturnType<typeof createMuteConversation>
export type NewChatPayload = ReturnType<typeof createNewChat>
export type OpenAttachmentPopupPayload = ReturnType<typeof createOpenAttachmentPopup>
export type OpenConversationPayload = ReturnType<typeof createOpenConversation>
export type OpenFolderPayload = ReturnType<typeof createOpenFolder>
export type OpenTlfInChatPayload = ReturnType<typeof createOpenTlfInChat>
export type OutboxMessageBecameRealPayload = ReturnType<typeof createOutboxMessageBecameReal>
export type PendingToRealConversationPayload = ReturnType<typeof createPendingToRealConversation>
export type RemoveOutboxMessagePayload = ReturnType<typeof createRemoveOutboxMessage>
export type RemoveTempPendingConversationsPayload = ReturnType<typeof createRemoveTempPendingConversations>
export type ReplaceEntityPayload = ReturnType<typeof createReplaceEntity>
export type SaveAttachmentPayload = ReturnType<typeof createSaveAttachment>
export type SelectAttachmentPayload = ReturnType<typeof createSelectAttachment>
export type SelectConversationPayload = ReturnType<typeof createSelectConversation>
export type SelectNextPayload = ReturnType<typeof createSelectNext>
export type SetInboxFilterPayload = ReturnType<typeof createSetInboxFilter>
export type SetInboxGlobalUntrustedStatePayload = ReturnType<typeof createSetInboxGlobalUntrustedState>
export type SetLoadedPayload = ReturnType<typeof createSetLoaded>
export type SetNotificationsPayload = ReturnType<typeof createSetNotifications>
export type SetPreviousConversationPayload = ReturnType<typeof createSetPreviousConversation>
export type SetTypersPayload = ReturnType<typeof createSetTypers>
export type SetupChatHandlersPayload = ReturnType<typeof createSetupChatHandlers>
export type ShowEditorPayload = ReturnType<typeof createShowEditor>
export type SubtractEntityPayload = ReturnType<typeof createSubtractEntity>
export type ThreadLoadedOfflinePayload = ReturnType<typeof createThreadLoadedOffline>
export type ToggleChannelWideNotificationsPayload = ReturnType<typeof createToggleChannelWideNotifications>
export type UnboxConversationsPayload = ReturnType<typeof createUnboxConversations>
export type UnboxMorePayload = ReturnType<typeof createUnboxMore>
export type UpdateBadgingPayload = ReturnType<typeof createUpdateBadging>
export type UpdateBrokenTrackerPayload = ReturnType<typeof createUpdateBrokenTracker>
export type UpdateFinalizedStatePayload = ReturnType<typeof createUpdateFinalizedState>
export type UpdateInboxCompletePayload = ReturnType<typeof createUpdateInboxComplete>
export type UpdateInboxRekeyOthersPayload = ReturnType<typeof createUpdateInboxRekeyOthers>
export type UpdateInboxRekeySelfPayload = ReturnType<typeof createUpdateInboxRekeySelf>
export type UpdateLatestMessagePayload = ReturnType<typeof createUpdateLatestMessage>
export type UpdateMetadataPayload = ReturnType<typeof createUpdateMetadata>
export type UpdateSnippetPayload = ReturnType<typeof createUpdateSnippet>
export type UpdateSupersededByStatePayload = ReturnType<typeof createUpdateSupersededByState>
export type UpdateSupersedesStatePayload = ReturnType<typeof createUpdateSupersedesState>
export type UpdateThreadPayload = ReturnType<typeof createUpdateThread>
export type UpdateTypingPayload = ReturnType<typeof createUpdateTyping>
export type UpdatedMetadataPayload = ReturnType<typeof createUpdatedMetadata>
export type UpdatedNotificationsPayload = ReturnType<typeof createUpdatedNotifications>
export type UploadProgressPayload = ReturnType<typeof createUploadProgress>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createAddPending>
  | ReturnType<typeof createAttachmentSaveFailed>
  | ReturnType<typeof createAttachmentSaveStart>
  | ReturnType<typeof createAttachmentSaved>
  | ReturnType<typeof createBlockConversation>
  | ReturnType<typeof createClearMessages>
  | ReturnType<typeof createClearRekey>
  | ReturnType<typeof createDeleteEntity>
  | ReturnType<typeof createDeleteMessage>
  | ReturnType<typeof createEditMessage>
  | ReturnType<typeof createExitSearch>
  | ReturnType<typeof createGetInboxAndUnbox>
  | ReturnType<typeof createInboxStale>
  | ReturnType<typeof createInboxSynced>
  | ReturnType<typeof createIncomingMessage>
  | ReturnType<typeof createIncomingTyping>
  | ReturnType<typeof createLeaveConversation>
  | ReturnType<typeof createLoadAttachment>
  | ReturnType<typeof createLoadInbox>
  | ReturnType<typeof createLoadMoreMessages>
  | ReturnType<typeof createLoadingMessages>
  | ReturnType<typeof createMarkSeenMessage>
  | ReturnType<typeof createMarkThreadsStale>
  | ReturnType<typeof createMergeEntity>
  | ReturnType<typeof createMuteConversation>
  | ReturnType<typeof createNewChat>
  | ReturnType<typeof createOpenAttachmentPopup>
  | ReturnType<typeof createOpenConversation>
  | ReturnType<typeof createOpenFolder>
  | ReturnType<typeof createOpenTlfInChat>
  | ReturnType<typeof createOutboxMessageBecameReal>
  | ReturnType<typeof createPendingToRealConversation>
  | ReturnType<typeof createRemoveOutboxMessage>
  | ReturnType<typeof createRemoveTempPendingConversations>
  | ReturnType<typeof createReplaceEntity>
  | ReturnType<typeof createSaveAttachment>
  | ReturnType<typeof createSelectAttachment>
  | ReturnType<typeof createSelectConversation>
  | ReturnType<typeof createSelectNext>
  | ReturnType<typeof createSetInboxFilter>
  | ReturnType<typeof createSetInboxGlobalUntrustedState>
  | ReturnType<typeof createSetLoaded>
  | ReturnType<typeof createSetNotifications>
  | ReturnType<typeof createSetPreviousConversation>
  | ReturnType<typeof createSetTypers>
  | ReturnType<typeof createSetupChatHandlers>
  | ReturnType<typeof createShowEditor>
  | ReturnType<typeof createSubtractEntity>
  | ReturnType<typeof createThreadLoadedOffline>
  | ReturnType<typeof createToggleChannelWideNotifications>
  | ReturnType<typeof createUnboxConversations>
  | ReturnType<typeof createUnboxMore>
  | ReturnType<typeof createUpdateBadging>
  | ReturnType<typeof createUpdateBrokenTracker>
  | ReturnType<typeof createUpdateFinalizedState>
  | ReturnType<typeof createUpdateInboxComplete>
  | ReturnType<typeof createUpdateInboxRekeyOthers>
  | ReturnType<typeof createUpdateInboxRekeySelf>
  | ReturnType<typeof createUpdateLatestMessage>
  | ReturnType<typeof createUpdateMetadata>
  | ReturnType<typeof createUpdateSnippet>
  | ReturnType<typeof createUpdateSupersededByState>
  | ReturnType<typeof createUpdateSupersedesState>
  | ReturnType<typeof createUpdateThread>
  | ReturnType<typeof createUpdateTyping>
  | ReturnType<typeof createUpdatedMetadata>
  | ReturnType<typeof createUpdatedNotifications>
  | ReturnType<typeof createUploadProgress>
  | {type: 'common:resetStore', payload: void}
