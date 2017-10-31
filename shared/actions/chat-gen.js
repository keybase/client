// @flow
/* eslint-disable */
import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as I from 'immutable'
import HiddenString from '../util/hidden-string'

// Constants
export const addPending = 'chat:addPending'
export const blockConversation = 'chat:blockConversation'
export const deleteEntity = 'chat:deleteEntity'
export const deleteMessage = 'chat:deleteMessage'
export const editMessage = 'chat:editMessage'
export const exitSearch = 'chat:exitSearch'
export const leaveConversation = 'chat:leaveConversation'
export const loadInbox = 'chat:loadInbox'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const mergeEntity = 'chat:mergeEntity'
export const muteConversation = 'chat:muteConversation'
export const newChat = 'chat:newChat'
export const openFolder = 'chat:openFolder'
export const openTlfInChat = 'chat:openTlfInChat'
export const pendingToRealConversation = 'chat:pendingToRealConversation'
export const removeTempPendingConversations = 'chat:removeTempPendingConversations'
export const replaceEntity = 'chat:replaceEntity'
export const setupChatHandlers = 'chat:setupChatHandlers'
export const showEditor = 'chat:showEditor'
export const subtractEntity = 'chat:subtractEntity'
export const unboxMore = 'chat:unboxMore'
export const updateBadging = 'chat:updateBadging'
export const updateFinalizedState = 'chat:updateFinalizedState'
export const updateLatestMessage = 'chat:updateLatestMessage'
export const updateSupersedesState = 'chat:updateSupersedesState'

// Action Creators
export const createAddPending = (payload: {|participants: Array<string>, temporary: boolean|}) => ({error: false, payload, type: addPending})
export const createBlockConversation = (payload: {|blocked: boolean, conversationIDKey: Constants.ConversationIDKey, reportUser: boolean|}) => ({error: false, payload, type: blockConversation})
export const createDeleteEntity = (payload: {|keyPath: Array<string>, ids: I.List<string>|}) => ({error: false, payload, type: deleteEntity})
export const createDeleteMessage = (payload: {|message: Constants.Message|}) => ({error: false, payload, type: deleteMessage})
export const createEditMessage = (payload: {|message: Constants.Message, text: HiddenString|}) => ({error: false, payload, type: editMessage})
export const createExitSearch = (payload: {|skipSelectPreviousConversation: boolean|}) => ({error: false, payload, type: exitSearch})
export const createLeaveConversation = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: leaveConversation})
export const createLoadInbox = () => ({error: false, payload: undefined, type: loadInbox})
export const createLoadMoreMessages = (payload: {|conversationIDKey: Constants.ConversationIDKey, onlyIfUnloaded: boolean, fromUser?: boolean, wantNewer?: boolean, numberOverride?: ?number|}) => ({error: false, payload, type: loadMoreMessages})
export const createMergeEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: mergeEntity})
export const createMuteConversation = (payload: {|conversationIDKey: Constants.ConversationIDKey, muted: boolean|}) => ({error: false, payload, type: muteConversation})
export const createNewChat = () => ({error: false, payload: undefined, type: newChat})
export const createOpenFolder = () => ({error: false, payload: undefined, type: openFolder})
export const createOpenTlfInChat = (payload: {|tlf: string|}) => ({error: false, payload, type: openTlfInChat})
export const createPendingToRealConversation = (payload: {|oldKey: Constants.ConversationIDKey, newKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: pendingToRealConversation})
export const createRemoveTempPendingConversations = () => ({error: false, payload: undefined, type: removeTempPendingConversations})
export const createReplaceEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: replaceEntity})
export const createSetupChatHandlers = () => ({error: false, payload: undefined, type: setupChatHandlers})
export const createShowEditor = (payload: {|message: ?Constants.Message|}) => ({error: false, payload, type: showEditor})
export const createSubtractEntity = (payload: {|keyPath: Array<string>, entities: I.List<any>|}) => ({error: false, payload, type: subtractEntity})
export const createUnboxMore = () => ({error: false, payload: undefined, type: unboxMore})
export const createUpdateBadging = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: updateBadging})
export const createUpdateFinalizedState = (payload: {|finalizedState: Constants.FinalizedState|}) => ({error: false, payload, type: updateFinalizedState})
export const createUpdateLatestMessage = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({error: false, payload, type: updateLatestMessage})
export const createUpdateSupersedesState = (payload: {|supersedesState: Constants.SupersedesState|}) => ({error: false, payload, type: updateSupersedesState})

// Action Payloads
export type AddPendingPayload = ReturnType<typeof createAddPending>
export type BlockConversationPayload = ReturnType<typeof createBlockConversation>
export type DeleteEntityPayload = ReturnType<typeof createDeleteEntity>
export type DeleteMessagePayload = ReturnType<typeof createDeleteMessage>
export type EditMessagePayload = ReturnType<typeof createEditMessage>
export type ExitSearchPayload = ReturnType<typeof createExitSearch>
export type LeaveConversationPayload = ReturnType<typeof createLeaveConversation>
export type LoadInboxPayload = ReturnType<typeof createLoadInbox>
export type LoadMoreMessagesPayload = ReturnType<typeof createLoadMoreMessages>
export type MergeEntityPayload = ReturnType<typeof createMergeEntity>
export type MuteConversationPayload = ReturnType<typeof createMuteConversation>
export type NewChatPayload = ReturnType<typeof createNewChat>
export type OpenFolderPayload = ReturnType<typeof createOpenFolder>
export type OpenTlfInChatPayload = ReturnType<typeof createOpenTlfInChat>
export type PendingToRealConversationPayload = ReturnType<typeof createPendingToRealConversation>
export type RemoveTempPendingConversationsPayload = ReturnType<typeof createRemoveTempPendingConversations>
export type ReplaceEntityPayload = ReturnType<typeof createReplaceEntity>
export type SetupChatHandlersPayload = ReturnType<typeof createSetupChatHandlers>
export type ShowEditorPayload = ReturnType<typeof createShowEditor>
export type SubtractEntityPayload = ReturnType<typeof createSubtractEntity>
export type UnboxMorePayload = ReturnType<typeof createUnboxMore>
export type UpdateBadgingPayload = ReturnType<typeof createUpdateBadging>
export type UpdateFinalizedStatePayload = ReturnType<typeof createUpdateFinalizedState>
export type UpdateLatestMessagePayload = ReturnType<typeof createUpdateLatestMessage>
export type UpdateSupersedesStatePayload = ReturnType<typeof createUpdateSupersedesState>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createAddPending>
  | ReturnType<typeof createBlockConversation>
  | ReturnType<typeof createDeleteEntity>
  | ReturnType<typeof createDeleteMessage>
  | ReturnType<typeof createEditMessage>
  | ReturnType<typeof createExitSearch>
  | ReturnType<typeof createLeaveConversation>
  | ReturnType<typeof createLoadInbox>
  | ReturnType<typeof createLoadMoreMessages>
  | ReturnType<typeof createMergeEntity>
  | ReturnType<typeof createMuteConversation>
  | ReturnType<typeof createNewChat>
  | ReturnType<typeof createOpenFolder>
  | ReturnType<typeof createOpenTlfInChat>
  | ReturnType<typeof createPendingToRealConversation>
  | ReturnType<typeof createRemoveTempPendingConversations>
  | ReturnType<typeof createReplaceEntity>
  | ReturnType<typeof createSetupChatHandlers>
  | ReturnType<typeof createShowEditor>
  | ReturnType<typeof createSubtractEntity>
  | ReturnType<typeof createUnboxMore>
  | ReturnType<typeof createUpdateBadging>
  | ReturnType<typeof createUpdateFinalizedState>
  | ReturnType<typeof createUpdateLatestMessage>
  | ReturnType<typeof createUpdateSupersedesState>
