// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as TeamConstants from '../constants/teams'
import * as Types from '../constants/types/chat'
import * as RPCChatTypes from '../constants/types/flow-types-chat'
import HiddenString from '../util/hidden-string'
import {type DeviceType} from '../constants/devices'
import {type Path} from '../route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat but is handled by every reducer
export const addPending = 'chat:addPending'
export const appendMessages = 'chat:appendMessages'
export const attachmentLoaded = 'chat:attachmentLoaded'
export const attachmentSaveFailed = 'chat:attachmentSaveFailed'
export const attachmentSaveStart = 'chat:attachmentSaveStart'
export const attachmentSaved = 'chat:attachmentSaved'
export const badgeAppForChat = 'chat:badgeAppForChat'
export const blockConversation = 'chat:blockConversation'
export const clearMessages = 'chat:clearMessages'
export const clearRekey = 'chat:clearRekey'
export const deleteEntity = 'chat:deleteEntity'
export const deleteMessage = 'chat:deleteMessage'
export const downloadProgress = 'chat:downloadProgress'
export const editMessage = 'chat:editMessage'
export const exitSearch = 'chat:exitSearch'
export const getInboxAndUnbox = 'chat:getInboxAndUnbox'
export const inboxStale = 'chat:inboxStale'
export const inboxStoreLoaded = 'chat:inboxStoreLoaded'
export const inboxSynced = 'chat:inboxSynced'
export const incomingMessage = 'chat:incomingMessage'
export const incomingTyping = 'chat:incomingTyping'
export const joinConversation = 'chat:joinConversation'
export const leaveConversation = 'chat:leaveConversation'
export const loadAttachment = 'chat:loadAttachment'
export const loadAttachmentPreview = 'chat:loadAttachmentPreview'
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
export const openTeamConversation = 'chat:openTeamConversation'
export const openTlfInChat = 'chat:openTlfInChat'
export const outboxMessageBecameReal = 'chat:outboxMessageBecameReal'
export const pendingToRealConversation = 'chat:pendingToRealConversation'
export const postMessage = 'chat:postMessage'
export const prependMessages = 'chat:prependMessages'
export const removeOutboxMessage = 'chat:removeOutboxMessage'
export const removeTempPendingConversations = 'chat:removeTempPendingConversations'
export const replaceEntity = 'chat:replaceEntity'
export const retryAttachment = 'chat:retryAttachment'
export const retryMessage = 'chat:retryMessage'
export const saveAttachment = 'chat:saveAttachment'
export const saveAttachmentNative = 'chat:saveAttachmentNative'
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
export const shareAttachment = 'chat:shareAttachment'
export const showEditor = 'chat:showEditor'
export const startConversation = 'chat:startConversation'
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
export const updateTempMessage = 'chat:updateTempMessage'
export const updateThread = 'chat:updateThread'
export const updateTyping = 'chat:updateTyping'
export const updatedMetadata = 'chat:updatedMetadata'
export const updatedNotifications = 'chat:updatedNotifications'
export const uploadProgress = 'chat:uploadProgress'

// Action Creators
export const createAddPending = (payload: {|+participants: Array<string>, +temporary: boolean|}) => ({error: false, payload, type: addPending})
export const createAppendMessages = (payload: {|+conversationIDKey: Types.ConversationIDKey, +isSelected: boolean, +isAppFocused: boolean, +messages: Array<Types.ServerMessage>, +svcShouldDisplayNotification: boolean|}) => ({error: false, payload, type: appendMessages})
export const createAttachmentLoaded = (payload: {|+messageKey: Types.MessageKey, +path: ?string, +isPreview: boolean|}) => ({error: false, payload, type: attachmentLoaded})
export const createAttachmentSaveFailed = (payload: {|+messageKey: Types.MessageKey|}) => ({error: false, payload, type: attachmentSaveFailed})
export const createAttachmentSaveStart = (payload: {|+messageKey: Types.MessageKey|}) => ({error: false, payload, type: attachmentSaveStart})
export const createAttachmentSaved = (payload: {|+messageKey: Types.MessageKey, +path: ?string|}) => ({error: false, payload, type: attachmentSaved})
export const createBadgeAppForChat = (payload: {|+conversations: Array<RPCTypes.BadgeConversationInfo>|}) => ({error: false, payload, type: badgeAppForChat})
export const createBlockConversation = (payload: {|+blocked: boolean, +conversationIDKey: Types.ConversationIDKey, +reportUser: boolean|}) => ({error: false, payload, type: blockConversation})
export const createClearMessages = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: clearMessages})
export const createClearRekey = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: clearRekey})
export const createDeleteEntity = (payload: {|+keyPath: Array<string>, +ids: Iterable<string>|}) => ({error: false, payload, type: deleteEntity})
export const createDeleteMessage = (payload: {|+message: Types.Message|}) => ({error: false, payload, type: deleteMessage})
export const createDownloadProgress = (payload: {|+messageKey: Types.MessageKey, +isPreview: boolean, +progress: ?number|}) => ({error: false, payload, type: downloadProgress})
export const createEditMessage = (payload: {|+message: Types.Message, +text: HiddenString|}) => ({error: false, payload, type: editMessage})
export const createExitSearch = (payload: {|+skipSelectPreviousConversation: boolean|}) => ({error: false, payload, type: exitSearch})
export const createGetInboxAndUnbox = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: getInboxAndUnbox})
export const createInboxStale = (payload: {|+reason: string|}) => ({error: false, payload, type: inboxStale})
export const createInboxStoreLoaded = () => ({error: false, payload: undefined, type: inboxStoreLoaded})
export const createInboxSynced = (payload: {|+convs: Array<RPCChatTypes.UnverifiedInboxUIItem>|}) => ({error: false, payload, type: inboxSynced})
export const createIncomingMessage = (payload: {|+activity: RPCChatTypes.ChatActivity|}) => ({error: false, payload, type: incomingMessage})
export const createIncomingTyping = (payload: {|+activity: RPCChatTypes.TyperInfo|}) => ({error: false, payload, type: incomingTyping})
export const createJoinConversation = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: joinConversation})
export const createLeaveConversation = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: leaveConversation})
export const createLoadAttachment = (payload: {|+messageKey: Types.MessageKey, +loadPreview: boolean|}) => ({error: false, payload, type: loadAttachment})
export const createLoadAttachmentPreview = (payload: {|+messageKey: Types.MessageKey|}) => ({error: false, payload, type: loadAttachmentPreview})
export const createLoadInbox = () => ({error: false, payload: undefined, type: loadInbox})
export const createLoadMoreMessages = (payload: {|+conversationIDKey: Types.ConversationIDKey, +onlyIfUnloaded: boolean, +fromUser?: boolean, +wantNewer?: boolean, +numberOverride?: ?number|}) => ({error: false, payload, type: loadMoreMessages})
export const createLoadingMessages = (payload: {|+conversationIDKey: Types.ConversationIDKey, +isRequesting: boolean|}) => ({error: false, payload, type: loadingMessages})
export const createMarkSeenMessage = (payload: {|+conversationIDKey: Types.ConversationIDKey, +messageKey: Types.MessageKey|}) => ({error: false, payload, type: markSeenMessage})
export const createMarkThreadsStale = (payload: {|+updates: Array<RPCChatTypes.ConversationStaleUpdate>|}) => ({error: false, payload, type: markThreadsStale})
export const createMergeEntity = (payload: {|+keyPath: Array<string>, +entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: mergeEntity})
export const createMuteConversation = (payload: {|+conversationIDKey: Types.ConversationIDKey, +muted: boolean|}) => ({error: false, payload, type: muteConversation})
export const createNewChat = () => ({error: false, payload: undefined, type: newChat})
export const createOpenAttachmentPopup = (payload: {|+message: Types.AttachmentMessage, +currentPath: Path|}) => ({error: false, payload, type: openAttachmentPopup})
export const createOpenConversation = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: openConversation})
export const createOpenFolder = () => ({error: false, payload: undefined, type: openFolder})
export const createOpenTeamConversation = (payload: {|+teamname: TeamConstants.Teamname, +channelname: string|}) => ({error: false, payload, type: openTeamConversation})
export const createOpenTlfInChat = (payload: {|+tlf: string, +isTeam?: boolean|}) => ({error: false, payload, type: openTlfInChat})
export const createOutboxMessageBecameReal = (payload: {|+oldMessageKey: Types.MessageKey, +newMessageKey: Types.MessageKey|}) => ({error: false, payload, type: outboxMessageBecameReal})
export const createPendingToRealConversation = (payload: {|+oldKey: Types.ConversationIDKey, +newKey: Types.ConversationIDKey|}) => ({error: false, payload, type: pendingToRealConversation})
export const createPostMessage = (payload: {|+conversationIDKey: Types.ConversationIDKey, +text: HiddenString|}) => ({error: false, payload, type: postMessage})
export const createPrependMessages = (payload: {|+conversationIDKey: Types.ConversationIDKey, +messages: Array<Types.ServerMessage>, +moreToLoad: boolean|}) => ({error: false, payload, type: prependMessages})
export const createRemoveOutboxMessage = (payload: {|+conversationIDKey: Types.ConversationIDKey, +outboxID: Types.OutboxIDKey|}) => ({error: false, payload, type: removeOutboxMessage})
export const createRemoveTempPendingConversations = () => ({error: false, payload: undefined, type: removeTempPendingConversations})
export const createReplaceEntity = (payload: {|+keyPath: Array<string>, +entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: replaceEntity})
export const createRetryAttachment = (payload: {|+message: Types.AttachmentMessage|}) => ({error: false, payload, type: retryAttachment})
export const createRetryMessage = (payload: {|+conversationIDKey: Types.ConversationIDKey, +outboxIDKey: string|}) => ({error: false, payload, type: retryMessage})
export const createSaveAttachment = (payload: {|+messageKey: Types.MessageKey|}) => ({error: false, payload, type: saveAttachment})
export const createSaveAttachmentNative = (payload: {|+messageKey: Types.MessageKey|}) => ({error: false, payload, type: saveAttachmentNative})
export const createSelectAttachment = (payload: {|+input: Types.AttachmentInput|}) => ({error: false, payload, type: selectAttachment})
export const createSelectConversation = (payload: {|+conversationIDKey: ?Types.ConversationIDKey, +fromUser?: boolean|}) => ({error: false, payload, type: selectConversation})
export const createSelectNext = (payload: {|+rows: Array<any>, +direction: -1 | 1|}) => ({error: false, payload, type: selectNext})
export const createSetInboxFilter = (payload: {|+filter: string|}) => ({error: false, payload, type: setInboxFilter})
export const createSetInboxGlobalUntrustedState = (payload: {|+inboxGlobalUntrustedState: Types.UntrustedState|}) => ({error: false, payload, type: setInboxGlobalUntrustedState})
export const createSetLoaded = (payload: {|+conversationIDKey: Types.ConversationIDKey, +isLoaded: boolean|}) => ({error: false, payload, type: setLoaded})
export const createSetNotifications = (payload: {|+conversationIDKey: Types.ConversationIDKey, +deviceType: DeviceType, +notifyType: Types.NotifyType|}) => ({error: false, payload, type: setNotifications})
export const createSetPreviousConversation = (payload: {|+conversationIDKey: ?Types.ConversationIDKey|}) => ({error: false, payload, type: setPreviousConversation})
export const createSetTypers = (payload: {|+conversationIDKey: Types.ConversationIDKey, +typing: Array<string>|}) => ({error: false, payload, type: setTypers})
export const createSetupChatHandlers = () => ({error: false, payload: undefined, type: setupChatHandlers})
export const createShareAttachment = (payload: {|+messageKey: Types.MessageKey|}) => ({error: false, payload, type: shareAttachment})
export const createShowEditor = (payload: {|+message: ?Types.Message|}) => ({error: false, payload, type: showEditor})
export const createStartConversation = (payload: {|+users: Array<string>, +forceImmediate?: boolean, +temporary?: boolean|}) => ({error: false, payload, type: startConversation})
export const createSubtractEntity = (payload: {|+keyPath: Array<string>, +entities: I.List<any>|}) => ({error: false, payload, type: subtractEntity})
export const createThreadLoadedOffline = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: threadLoadedOffline})
export const createToggleChannelWideNotifications = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: toggleChannelWideNotifications})
export const createUnboxConversations = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>, +reason: string, +force?: boolean, +forInboxSync?: boolean|}) => ({error: false, payload, type: unboxConversations})
export const createUnboxMore = () => ({error: false, payload: undefined, type: unboxMore})
export const createUpdateBadging = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: updateBadging})
export const createUpdateBrokenTracker = (payload: {|+userToBroken: {[username: string]: boolean}|}) => ({error: false, payload, type: updateBrokenTracker})
export const createUpdateFinalizedState = (payload: {|+finalizedState: Types.FinalizedState|}) => ({error: false, payload, type: updateFinalizedState})
export const createUpdateInboxComplete = () => ({error: false, payload: undefined, type: updateInboxComplete})
export const createUpdateInboxRekeyOthers = (payload: {|+conversationIDKey: Types.ConversationIDKey, +rekeyers: Array<string>|}) => ({error: false, payload, type: updateInboxRekeyOthers})
export const createUpdateInboxRekeySelf = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: updateInboxRekeySelf})
export const createUpdateLatestMessage = (payload: {|+conversationIDKey: Types.ConversationIDKey|}) => ({error: false, payload, type: updateLatestMessage})
export const createUpdateMetadata = (payload: {|+users: Array<string>|}) => ({error: false, payload, type: updateMetadata})
export const createUpdateSnippet = (payload: {|+conversationIDKey: Types.ConversationIDKey, +snippet: HiddenString|}) => ({error: false, payload, type: updateSnippet})
export const createUpdateSupersededByState = (payload: {|+supersededByState: Types.SupersededByState|}) => ({error: false, payload, type: updateSupersededByState})
export const createUpdateSupersedesState = (payload: {|+supersedesState: Types.SupersedesState|}) => ({error: false, payload, type: updateSupersedesState})
export const createUpdateTempMessage = (payload: {|+conversationIDKey: Types.ConversationIDKey, +message: $Shape<Types.AttachmentMessage> | $Shape<Types.TextMessage>, +outboxIDKey: Types.OutboxIDKey|}) => ({error: false, payload, type: updateTempMessage})
export const createUpdateThread = (payload: {|+thread: RPCChatTypes.UIMessages, +yourName: string, +yourDeviceName: string, +conversationIDKey: string, +append: boolean|}) => ({error: false, payload, type: updateThread})
export const createUpdateTyping = (payload: {|+conversationIDKey: Types.ConversationIDKey, +typing: boolean|}) => ({error: false, payload, type: updateTyping})
export const createUpdatedMetadata = (payload: {|+updated: {[key: string]: Types.MetaData}|}) => ({error: false, payload, type: updatedMetadata})
export const createUpdatedNotifications = (payload: {|+conversationIDKey: Types.ConversationIDKey, +notifications: Types.NotificationsState|}) => ({error: false, payload, type: updatedNotifications})
export const createUploadProgress = (payload: {|+messageKey: Types.MessageKey, +progress: ?number|}) => ({error: false, payload, type: uploadProgress})

// Action Payloads
export type AddPendingPayload = More.ReturnType<typeof createAddPending>
export type AppendMessagesPayload = More.ReturnType<typeof createAppendMessages>
export type AttachmentLoadedPayload = More.ReturnType<typeof createAttachmentLoaded>
export type AttachmentSaveFailedPayload = More.ReturnType<typeof createAttachmentSaveFailed>
export type AttachmentSaveStartPayload = More.ReturnType<typeof createAttachmentSaveStart>
export type AttachmentSavedPayload = More.ReturnType<typeof createAttachmentSaved>
export type BadgeAppForChatPayload = More.ReturnType<typeof createBadgeAppForChat>
export type BlockConversationPayload = More.ReturnType<typeof createBlockConversation>
export type ClearMessagesPayload = More.ReturnType<typeof createClearMessages>
export type ClearRekeyPayload = More.ReturnType<typeof createClearRekey>
export type DeleteEntityPayload = More.ReturnType<typeof createDeleteEntity>
export type DeleteMessagePayload = More.ReturnType<typeof createDeleteMessage>
export type DownloadProgressPayload = More.ReturnType<typeof createDownloadProgress>
export type EditMessagePayload = More.ReturnType<typeof createEditMessage>
export type ExitSearchPayload = More.ReturnType<typeof createExitSearch>
export type GetInboxAndUnboxPayload = More.ReturnType<typeof createGetInboxAndUnbox>
export type InboxStalePayload = More.ReturnType<typeof createInboxStale>
export type InboxStoreLoadedPayload = More.ReturnType<typeof createInboxStoreLoaded>
export type InboxSyncedPayload = More.ReturnType<typeof createInboxSynced>
export type IncomingMessagePayload = More.ReturnType<typeof createIncomingMessage>
export type IncomingTypingPayload = More.ReturnType<typeof createIncomingTyping>
export type JoinConversationPayload = More.ReturnType<typeof createJoinConversation>
export type LeaveConversationPayload = More.ReturnType<typeof createLeaveConversation>
export type LoadAttachmentPayload = More.ReturnType<typeof createLoadAttachment>
export type LoadAttachmentPreviewPayload = More.ReturnType<typeof createLoadAttachmentPreview>
export type LoadInboxPayload = More.ReturnType<typeof createLoadInbox>
export type LoadMoreMessagesPayload = More.ReturnType<typeof createLoadMoreMessages>
export type LoadingMessagesPayload = More.ReturnType<typeof createLoadingMessages>
export type MarkSeenMessagePayload = More.ReturnType<typeof createMarkSeenMessage>
export type MarkThreadsStalePayload = More.ReturnType<typeof createMarkThreadsStale>
export type MergeEntityPayload = More.ReturnType<typeof createMergeEntity>
export type MuteConversationPayload = More.ReturnType<typeof createMuteConversation>
export type NewChatPayload = More.ReturnType<typeof createNewChat>
export type OpenAttachmentPopupPayload = More.ReturnType<typeof createOpenAttachmentPopup>
export type OpenConversationPayload = More.ReturnType<typeof createOpenConversation>
export type OpenFolderPayload = More.ReturnType<typeof createOpenFolder>
export type OpenTeamConversationPayload = More.ReturnType<typeof createOpenTeamConversation>
export type OpenTlfInChatPayload = More.ReturnType<typeof createOpenTlfInChat>
export type OutboxMessageBecameRealPayload = More.ReturnType<typeof createOutboxMessageBecameReal>
export type PendingToRealConversationPayload = More.ReturnType<typeof createPendingToRealConversation>
export type PostMessagePayload = More.ReturnType<typeof createPostMessage>
export type PrependMessagesPayload = More.ReturnType<typeof createPrependMessages>
export type RemoveOutboxMessagePayload = More.ReturnType<typeof createRemoveOutboxMessage>
export type RemoveTempPendingConversationsPayload = More.ReturnType<typeof createRemoveTempPendingConversations>
export type ReplaceEntityPayload = More.ReturnType<typeof createReplaceEntity>
export type RetryAttachmentPayload = More.ReturnType<typeof createRetryAttachment>
export type RetryMessagePayload = More.ReturnType<typeof createRetryMessage>
export type SaveAttachmentNativePayload = More.ReturnType<typeof createSaveAttachmentNative>
export type SaveAttachmentPayload = More.ReturnType<typeof createSaveAttachment>
export type SelectAttachmentPayload = More.ReturnType<typeof createSelectAttachment>
export type SelectConversationPayload = More.ReturnType<typeof createSelectConversation>
export type SelectNextPayload = More.ReturnType<typeof createSelectNext>
export type SetInboxFilterPayload = More.ReturnType<typeof createSetInboxFilter>
export type SetInboxGlobalUntrustedStatePayload = More.ReturnType<typeof createSetInboxGlobalUntrustedState>
export type SetLoadedPayload = More.ReturnType<typeof createSetLoaded>
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
export type UnboxConversationsPayload = More.ReturnType<typeof createUnboxConversations>
export type UnboxMorePayload = More.ReturnType<typeof createUnboxMore>
export type UpdateBadgingPayload = More.ReturnType<typeof createUpdateBadging>
export type UpdateBrokenTrackerPayload = More.ReturnType<typeof createUpdateBrokenTracker>
export type UpdateFinalizedStatePayload = More.ReturnType<typeof createUpdateFinalizedState>
export type UpdateInboxCompletePayload = More.ReturnType<typeof createUpdateInboxComplete>
export type UpdateInboxRekeyOthersPayload = More.ReturnType<typeof createUpdateInboxRekeyOthers>
export type UpdateInboxRekeySelfPayload = More.ReturnType<typeof createUpdateInboxRekeySelf>
export type UpdateLatestMessagePayload = More.ReturnType<typeof createUpdateLatestMessage>
export type UpdateMetadataPayload = More.ReturnType<typeof createUpdateMetadata>
export type UpdateSnippetPayload = More.ReturnType<typeof createUpdateSnippet>
export type UpdateSupersededByStatePayload = More.ReturnType<typeof createUpdateSupersededByState>
export type UpdateSupersedesStatePayload = More.ReturnType<typeof createUpdateSupersedesState>
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
  | More.ReturnType<typeof createBadgeAppForChat>
  | More.ReturnType<typeof createBlockConversation>
  | More.ReturnType<typeof createClearMessages>
  | More.ReturnType<typeof createClearRekey>
  | More.ReturnType<typeof createDeleteEntity>
  | More.ReturnType<typeof createDeleteMessage>
  | More.ReturnType<typeof createDownloadProgress>
  | More.ReturnType<typeof createEditMessage>
  | More.ReturnType<typeof createExitSearch>
  | More.ReturnType<typeof createGetInboxAndUnbox>
  | More.ReturnType<typeof createInboxStale>
  | More.ReturnType<typeof createInboxStoreLoaded>
  | More.ReturnType<typeof createInboxSynced>
  | More.ReturnType<typeof createIncomingMessage>
  | More.ReturnType<typeof createIncomingTyping>
  | More.ReturnType<typeof createJoinConversation>
  | More.ReturnType<typeof createLeaveConversation>
  | More.ReturnType<typeof createLoadAttachment>
  | More.ReturnType<typeof createLoadAttachmentPreview>
  | More.ReturnType<typeof createLoadInbox>
  | More.ReturnType<typeof createLoadMoreMessages>
  | More.ReturnType<typeof createLoadingMessages>
  | More.ReturnType<typeof createMarkSeenMessage>
  | More.ReturnType<typeof createMarkThreadsStale>
  | More.ReturnType<typeof createMergeEntity>
  | More.ReturnType<typeof createMuteConversation>
  | More.ReturnType<typeof createNewChat>
  | More.ReturnType<typeof createOpenAttachmentPopup>
  | More.ReturnType<typeof createOpenConversation>
  | More.ReturnType<typeof createOpenFolder>
  | More.ReturnType<typeof createOpenTeamConversation>
  | More.ReturnType<typeof createOpenTlfInChat>
  | More.ReturnType<typeof createOutboxMessageBecameReal>
  | More.ReturnType<typeof createPendingToRealConversation>
  | More.ReturnType<typeof createPostMessage>
  | More.ReturnType<typeof createPrependMessages>
  | More.ReturnType<typeof createRemoveOutboxMessage>
  | More.ReturnType<typeof createRemoveTempPendingConversations>
  | More.ReturnType<typeof createReplaceEntity>
  | More.ReturnType<typeof createRetryAttachment>
  | More.ReturnType<typeof createRetryMessage>
  | More.ReturnType<typeof createSaveAttachment>
  | More.ReturnType<typeof createSaveAttachmentNative>
  | More.ReturnType<typeof createSelectAttachment>
  | More.ReturnType<typeof createSelectConversation>
  | More.ReturnType<typeof createSelectNext>
  | More.ReturnType<typeof createSetInboxFilter>
  | More.ReturnType<typeof createSetInboxGlobalUntrustedState>
  | More.ReturnType<typeof createSetLoaded>
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
  | More.ReturnType<typeof createUnboxConversations>
  | More.ReturnType<typeof createUnboxMore>
  | More.ReturnType<typeof createUpdateBadging>
  | More.ReturnType<typeof createUpdateBrokenTracker>
  | More.ReturnType<typeof createUpdateFinalizedState>
  | More.ReturnType<typeof createUpdateInboxComplete>
  | More.ReturnType<typeof createUpdateInboxRekeyOthers>
  | More.ReturnType<typeof createUpdateInboxRekeySelf>
  | More.ReturnType<typeof createUpdateLatestMessage>
  | More.ReturnType<typeof createUpdateMetadata>
  | More.ReturnType<typeof createUpdateSnippet>
  | More.ReturnType<typeof createUpdateSupersededByState>
  | More.ReturnType<typeof createUpdateSupersedesState>
  | More.ReturnType<typeof createUpdateTempMessage>
  | More.ReturnType<typeof createUpdateThread>
  | More.ReturnType<typeof createUpdateTyping>
  | More.ReturnType<typeof createUpdatedMetadata>
  | More.ReturnType<typeof createUpdatedNotifications>
  | More.ReturnType<typeof createUploadProgress>
  | {type: 'common:resetStore', payload: void}
