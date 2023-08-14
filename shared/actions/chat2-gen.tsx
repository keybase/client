// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import type * as Types from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'chat2:'
export const addUserToChannel = 'chat2:addUserToChannel'
export const addUsersToChannel = 'chat2:addUsersToChannel'
export const dismissBlockButtons = 'chat2:dismissBlockButtons'
export const dismissJourneycard = 'chat2:dismissJourneycard'
export const fetchUserEmoji = 'chat2:fetchUserEmoji'
export const ignorePinnedMessage = 'chat2:ignorePinnedMessage'
export const jumpToRecent = 'chat2:jumpToRecent'
export const pinMessage = 'chat2:pinMessage'
export const replyJump = 'chat2:replyJump'
export const resolveMaybeMention = 'chat2:resolveMaybeMention'
export const sendAudioRecording = 'chat2:sendAudioRecording'
export const tabSelected = 'chat2:tabSelected'
export const unpinMessage = 'chat2:unpinMessage'

// Action Creators
/**
 * Add a list of users to a conversation. Creates a SystemBulkAddToConv message.
 */
export const createAddUsersToChannel = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly usernames: Array<string>
}) => ({payload, type: addUsersToChannel as typeof addUsersToChannel})
/**
 * Add a single user to a conversation. Creates a SystemBulkAddToConv message.
 */
export const createAddUserToChannel = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly username: string
}) => ({payload, type: addUserToChannel as typeof addUserToChannel})
/**
 * Desktop changed tab to chat
 */
export const createTabSelected = (payload?: undefined) => ({payload, type: tabSelected as typeof tabSelected})
/**
 * Dismiss a journeycard
 */
export const createDismissJourneycard = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly cardType: RPCChatTypes.JourneycardType
  readonly ordinal: Types.Ordinal
}) => ({payload, type: dismissJourneycard as typeof dismissJourneycard})
/**
 * Ignore pinned message
 */
export const createIgnorePinnedMessage = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: ignorePinnedMessage as typeof ignorePinnedMessage})
/**
 * Jump to a replied to message
 */
export const createReplyJump = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}) => ({payload, type: replyJump as typeof replyJump})
/**
 * Jump to most recent messages in a conversation
 */
export const createJumpToRecent = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: jumpToRecent as typeof jumpToRecent,
})
/**
 * Pin a message
 */
export const createPinMessage = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}) => ({payload, type: pinMessage as typeof pinMessage})
/**
 * Refresh user emoji and put it in store for picker
 */
export const createFetchUserEmoji = (
  payload: {readonly conversationIDKey?: Types.ConversationIDKey; readonly onlyInTeam?: boolean} = {}
) => ({payload, type: fetchUserEmoji as typeof fetchUserEmoji})
/**
 * Resolve an unknown @ mention
 */
export const createResolveMaybeMention = (payload: {readonly name: string; readonly channel: string}) => ({
  payload,
  type: resolveMaybeMention as typeof resolveMaybeMention,
})
/**
 * Unpin a message
 */
export const createUnpinMessage = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: unpinMessage as typeof unpinMessage,
})
export const createDismissBlockButtons = (payload: {readonly teamID: RPCTypes.TeamID}) => ({
  payload,
  type: dismissBlockButtons as typeof dismissBlockButtons,
})
export const createSendAudioRecording = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly duration: number
  readonly path: string
  readonly amps: Array<number>
}) => ({payload, type: sendAudioRecording as typeof sendAudioRecording})

// Action Payloads
export type AddUserToChannelPayload = ReturnType<typeof createAddUserToChannel>
export type AddUsersToChannelPayload = ReturnType<typeof createAddUsersToChannel>
export type DismissBlockButtonsPayload = ReturnType<typeof createDismissBlockButtons>
export type DismissJourneycardPayload = ReturnType<typeof createDismissJourneycard>
export type FetchUserEmojiPayload = ReturnType<typeof createFetchUserEmoji>
export type IgnorePinnedMessagePayload = ReturnType<typeof createIgnorePinnedMessage>
export type JumpToRecentPayload = ReturnType<typeof createJumpToRecent>
export type PinMessagePayload = ReturnType<typeof createPinMessage>
export type ReplyJumpPayload = ReturnType<typeof createReplyJump>
export type ResolveMaybeMentionPayload = ReturnType<typeof createResolveMaybeMention>
export type SendAudioRecordingPayload = ReturnType<typeof createSendAudioRecording>
export type TabSelectedPayload = ReturnType<typeof createTabSelected>
export type UnpinMessagePayload = ReturnType<typeof createUnpinMessage>

// All Actions
// prettier-ignore
export type Actions =
  | AddUserToChannelPayload
  | AddUsersToChannelPayload
  | DismissBlockButtonsPayload
  | DismissJourneycardPayload
  | FetchUserEmojiPayload
  | IgnorePinnedMessagePayload
  | JumpToRecentPayload
  | PinMessagePayload
  | ReplyJumpPayload
  | ResolveMaybeMentionPayload
  | SendAudioRecordingPayload
  | TabSelectedPayload
  | UnpinMessagePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
