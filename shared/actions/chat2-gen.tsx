// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import type * as Types from '../constants/types/chat2'
import type * as TeamsTypes from '../constants/types/teams'
import type HiddenString from '../util/hidden-string'
import type {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'chat2:'
export const addUserToChannel = 'chat2:addUserToChannel'
export const addUsersToChannel = 'chat2:addUsersToChannel'
export const attachFromDragAndDrop = 'chat2:attachFromDragAndDrop'
export const attachmentPasted = 'chat2:attachmentPasted'
export const attachmentPreviewSelect = 'chat2:attachmentPreviewSelect'
export const attachmentUploadCanceled = 'chat2:attachmentUploadCanceled'
export const attachmentsUpload = 'chat2:attachmentsUpload'
export const blockConversation = 'chat2:blockConversation'
export const confirmScreenResponse = 'chat2:confirmScreenResponse'
export const dismissBlockButtons = 'chat2:dismissBlockButtons'
export const dismissJourneycard = 'chat2:dismissJourneycard'
export const fetchUserEmoji = 'chat2:fetchUserEmoji'
export const ignorePinnedMessage = 'chat2:ignorePinnedMessage'
export const joinConversation = 'chat2:joinConversation'
export const jumpToRecent = 'chat2:jumpToRecent'
export const leaveConversation = 'chat2:leaveConversation'
export const markInitiallyLoadedThreadAsRead = 'chat2:markInitiallyLoadedThreadAsRead'
export const markTeamAsRead = 'chat2:markTeamAsRead'
export const messageSend = 'chat2:messageSend'
export const messageSendByUsernames = 'chat2:messageSendByUsernames'
export const navigateToInbox = 'chat2:navigateToInbox'
export const navigateToThread = 'chat2:navigateToThread'
export const openChatFromWidget = 'chat2:openChatFromWidget'
export const pinMessage = 'chat2:pinMessage'
export const replyJump = 'chat2:replyJump'
export const resolveMaybeMention = 'chat2:resolveMaybeMention'
export const sendAudioRecording = 'chat2:sendAudioRecording'
export const setConvRetentionPolicy = 'chat2:setConvRetentionPolicy'
export const setMinWriterRole = 'chat2:setMinWriterRole'
export const tabSelected = 'chat2:tabSelected'
export const toggleMessageCollapse = 'chat2:toggleMessageCollapse'
export const unfurlRemove = 'chat2:unfurlRemove'
export const unfurlResolvePrompt = 'chat2:unfurlResolvePrompt'
export const unpinMessage = 'chat2:unpinMessage'
export const updateNotificationSettings = 'chat2:updateNotificationSettings'
export const updateUnreadline = 'chat2:updateUnreadline'

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
 * Block a conversation
 */
export const createBlockConversation = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly reportUser: boolean
}) => ({payload, type: blockConversation as typeof blockConversation})
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
 * Image data pasted into a conversation
 */
export const createAttachmentPasted = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly data: Buffer
}) => ({payload, type: attachmentPasted as typeof attachmentPasted})
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
 * Mark all conversations in a team as read
 */
export const createMarkTeamAsRead = (payload: {readonly teamID: TeamsTypes.TeamID}) => ({
  payload,
  type: markTeamAsRead as typeof markTeamAsRead,
})
/**
 * Navigation helper. Nav is slightly different on mobile / desktop.
 */
export const createNavigateToInbox = (payload?: undefined) => ({
  payload,
  type: navigateToInbox as typeof navigateToInbox,
})
/**
 * Navigation helper. Nav is slightly different on mobile / desktop.
 */
export const createNavigateToThread = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly highlightMessageID?: number
  readonly reason:
    | 'focused'
    | 'clearSelected'
    | 'desktopNotification'
    | 'createdMessagePrivately'
    | 'extension'
    | 'files'
    | 'findNewestConversation'
    | 'findNewestConversationFromLayout'
    | 'inboxBig'
    | 'inboxFilterArrow'
    | 'inboxFilterChanged'
    | 'inboxSmall'
    | 'inboxNewConversation'
    | 'inboxSearch'
    | 'jumpFromReset'
    | 'jumpToReset'
    | 'justCreated'
    | 'manageView'
    | 'previewResolved'
    | 'push'
    | 'savedLastState'
    | 'startFoundExisting'
    | 'teamChat'
    | 'addedToChannel'
    | 'navChanged'
    | 'misc'
    | 'teamMention'
  readonly pushBody?: string
}) => ({payload, type: navigateToThread as typeof navigateToThread})
/**
 * On startup we're automatically loading a thread sometimes.
 * When we first view it we should go through our marking as read logic
 */
export const createMarkInitiallyLoadedThreadAsRead = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: markInitiallyLoadedThreadAsRead as typeof markInitiallyLoadedThreadAsRead})
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
 * Remove an unfurl
 */
export const createUnfurlRemove = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}) => ({payload, type: unfurlRemove as typeof unfurlRemove})
/**
 * Resolve an unknown @ mention
 */
export const createResolveMaybeMention = (payload: {readonly name: string; readonly channel: string}) => ({
  payload,
  type: resolveMaybeMention as typeof resolveMaybeMention,
})
/**
 * Response to an unfurl prompt
 */
export const createUnfurlResolvePrompt = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly domain: string
  readonly result: RPCChatTypes.UnfurlPromptResult
}) => ({payload, type: unfurlResolvePrompt as typeof unfurlResolvePrompt})
/**
 * Send a text message
 */
export const createMessageSend = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly text: HiddenString
  readonly replyTo?: Types.MessageID
  readonly waitingKey?: string
}) => ({payload, type: messageSend as typeof messageSend})
/**
 * Set the minimum role required to write into a conversation. Valid only for team conversations.
 */
export const createSetMinWriterRole = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly role: TeamsTypes.TeamRoleType
}) => ({payload, type: setMinWriterRole as typeof setMinWriterRole})
/**
 * Sets the retention policy for a conversation.
 */
export const createSetConvRetentionPolicy = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly policy: RetentionPolicy
}) => ({payload, type: setConvRetentionPolicy as typeof setConvRetentionPolicy})
/**
 * The attachment upload modal was canceled
 */
export const createAttachmentUploadCanceled = (payload: {
  readonly outboxIDs: Array<RPCChatTypes.OutboxID>
}) => ({payload, type: attachmentUploadCanceled as typeof attachmentUploadCanceled})
/**
 * The user has selected an attachment with a preview
 */
export const createAttachmentPreviewSelect = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: attachmentPreviewSelect as typeof attachmentPreviewSelect})
/**
 * Toggle the collapse status of a message
 */
export const createToggleMessageCollapse = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly ordinal: Types.Ordinal
}) => ({payload, type: toggleMessageCollapse as typeof toggleMessageCollapse})
/**
 * Unpin a message
 */
export const createUnpinMessage = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: unpinMessage as typeof unpinMessage,
})
/**
 * Update the unreadline line position for a conversation
 */
export const createUpdateUnreadline = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
}) => ({payload, type: updateUnreadline as typeof updateUnreadline})
/**
 * User responded to the chat Stellar confirm screen
 */
export const createConfirmScreenResponse = (payload: {readonly accept: boolean}) => ({
  payload,
  type: confirmScreenResponse as typeof confirmScreenResponse,
})
/**
 * We want to upload some attachments
 */
export const createAttachmentsUpload = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly paths: Array<Types.PathAndOutboxID>
  readonly titles: Array<string>
  readonly tlfName?: string
}) => ({payload, type: attachmentsUpload as typeof attachmentsUpload})
/**
 * We're changing the notification settings
 */
export const createUpdateNotificationSettings = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly notificationsDesktop: Types.NotificationsType
  readonly notificationsMobile: Types.NotificationsType
  readonly notificationsGlobalIgnoreMentions: boolean
}) => ({payload, type: updateNotificationSettings as typeof updateNotificationSettings})
export const createAttachFromDragAndDrop = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly paths: Array<Types.PathAndOutboxID>
  readonly titles: Array<string>
}) => ({payload, type: attachFromDragAndDrop as typeof attachFromDragAndDrop})
export const createDismissBlockButtons = (payload: {readonly teamID: RPCTypes.TeamID}) => ({
  payload,
  type: dismissBlockButtons as typeof dismissBlockButtons,
})
export const createJoinConversation = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: joinConversation as typeof joinConversation,
})
export const createLeaveConversation = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly dontNavigateToInbox?: boolean
}) => ({payload, type: leaveConversation as typeof leaveConversation})
export const createMessageSendByUsernames = (payload: {
  readonly usernames: string
  readonly text: HiddenString
  readonly waitingKey?: string
}) => ({payload, type: messageSendByUsernames as typeof messageSendByUsernames})
export const createOpenChatFromWidget = (
  payload: {readonly conversationIDKey?: Types.ConversationIDKey} = {}
) => ({payload, type: openChatFromWidget as typeof openChatFromWidget})
export const createSendAudioRecording = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly duration: number
  readonly path: string
  readonly amps: Array<number>
}) => ({payload, type: sendAudioRecording as typeof sendAudioRecording})

// Action Payloads
export type AddUserToChannelPayload = ReturnType<typeof createAddUserToChannel>
export type AddUsersToChannelPayload = ReturnType<typeof createAddUsersToChannel>
export type AttachFromDragAndDropPayload = ReturnType<typeof createAttachFromDragAndDrop>
export type AttachmentPastedPayload = ReturnType<typeof createAttachmentPasted>
export type AttachmentPreviewSelectPayload = ReturnType<typeof createAttachmentPreviewSelect>
export type AttachmentUploadCanceledPayload = ReturnType<typeof createAttachmentUploadCanceled>
export type AttachmentsUploadPayload = ReturnType<typeof createAttachmentsUpload>
export type BlockConversationPayload = ReturnType<typeof createBlockConversation>
export type ConfirmScreenResponsePayload = ReturnType<typeof createConfirmScreenResponse>
export type DismissBlockButtonsPayload = ReturnType<typeof createDismissBlockButtons>
export type DismissJourneycardPayload = ReturnType<typeof createDismissJourneycard>
export type FetchUserEmojiPayload = ReturnType<typeof createFetchUserEmoji>
export type IgnorePinnedMessagePayload = ReturnType<typeof createIgnorePinnedMessage>
export type JoinConversationPayload = ReturnType<typeof createJoinConversation>
export type JumpToRecentPayload = ReturnType<typeof createJumpToRecent>
export type LeaveConversationPayload = ReturnType<typeof createLeaveConversation>
export type MarkInitiallyLoadedThreadAsReadPayload = ReturnType<typeof createMarkInitiallyLoadedThreadAsRead>
export type MarkTeamAsReadPayload = ReturnType<typeof createMarkTeamAsRead>
export type MessageSendByUsernamesPayload = ReturnType<typeof createMessageSendByUsernames>
export type MessageSendPayload = ReturnType<typeof createMessageSend>
export type NavigateToInboxPayload = ReturnType<typeof createNavigateToInbox>
export type NavigateToThreadPayload = ReturnType<typeof createNavigateToThread>
export type OpenChatFromWidgetPayload = ReturnType<typeof createOpenChatFromWidget>
export type PinMessagePayload = ReturnType<typeof createPinMessage>
export type ReplyJumpPayload = ReturnType<typeof createReplyJump>
export type ResolveMaybeMentionPayload = ReturnType<typeof createResolveMaybeMention>
export type SendAudioRecordingPayload = ReturnType<typeof createSendAudioRecording>
export type SetConvRetentionPolicyPayload = ReturnType<typeof createSetConvRetentionPolicy>
export type SetMinWriterRolePayload = ReturnType<typeof createSetMinWriterRole>
export type TabSelectedPayload = ReturnType<typeof createTabSelected>
export type ToggleMessageCollapsePayload = ReturnType<typeof createToggleMessageCollapse>
export type UnfurlRemovePayload = ReturnType<typeof createUnfurlRemove>
export type UnfurlResolvePromptPayload = ReturnType<typeof createUnfurlResolvePrompt>
export type UnpinMessagePayload = ReturnType<typeof createUnpinMessage>
export type UpdateNotificationSettingsPayload = ReturnType<typeof createUpdateNotificationSettings>
export type UpdateUnreadlinePayload = ReturnType<typeof createUpdateUnreadline>

// All Actions
// prettier-ignore
export type Actions =
  | AddUserToChannelPayload
  | AddUsersToChannelPayload
  | AttachFromDragAndDropPayload
  | AttachmentPastedPayload
  | AttachmentPreviewSelectPayload
  | AttachmentUploadCanceledPayload
  | AttachmentsUploadPayload
  | BlockConversationPayload
  | ConfirmScreenResponsePayload
  | DismissBlockButtonsPayload
  | DismissJourneycardPayload
  | FetchUserEmojiPayload
  | IgnorePinnedMessagePayload
  | JoinConversationPayload
  | JumpToRecentPayload
  | LeaveConversationPayload
  | MarkInitiallyLoadedThreadAsReadPayload
  | MarkTeamAsReadPayload
  | MessageSendByUsernamesPayload
  | MessageSendPayload
  | NavigateToInboxPayload
  | NavigateToThreadPayload
  | OpenChatFromWidgetPayload
  | PinMessagePayload
  | ReplyJumpPayload
  | ResolveMaybeMentionPayload
  | SendAudioRecordingPayload
  | SetConvRetentionPolicyPayload
  | SetMinWriterRolePayload
  | TabSelectedPayload
  | ToggleMessageCollapsePayload
  | UnfurlRemovePayload
  | UnfurlResolvePromptPayload
  | UnpinMessagePayload
  | UpdateNotificationSettingsPayload
  | UpdateUnreadlinePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
