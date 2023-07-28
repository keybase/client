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
export const addAttachmentViewMessage = 'chat2:addAttachmentViewMessage'
export const addBotMember = 'chat2:addBotMember'
export const addUserToChannel = 'chat2:addUserToChannel'
export const addUsersToChannel = 'chat2:addUsersToChannel'
export const attachFromDragAndDrop = 'chat2:attachFromDragAndDrop'
export const attachmentDownload = 'chat2:attachmentDownload'
export const attachmentDownloaded = 'chat2:attachmentDownloaded'
export const attachmentMobileSave = 'chat2:attachmentMobileSave'
export const attachmentMobileSaved = 'chat2:attachmentMobileSaved'
export const attachmentPasted = 'chat2:attachmentPasted'
export const attachmentPreviewSelect = 'chat2:attachmentPreviewSelect'
export const attachmentUploadCanceled = 'chat2:attachmentUploadCanceled'
export const attachmentUploaded = 'chat2:attachmentUploaded'
export const attachmentUploading = 'chat2:attachmentUploading'
export const attachmentsUpload = 'chat2:attachmentsUpload'
export const blockConversation = 'chat2:blockConversation'
export const channelSuggestionsTriggered = 'chat2:channelSuggestionsTriggered'
export const clearAttachmentView = 'chat2:clearAttachmentView'
export const clearCommandStatusInfo = 'chat2:clearCommandStatusInfo'
export const clearMarkAsUnread = 'chat2:clearMarkAsUnread'
export const clearMessages = 'chat2:clearMessages'
export const clearMetas = 'chat2:clearMetas'
export const confirmScreenResponse = 'chat2:confirmScreenResponse'
export const createConversation = 'chat2:createConversation'
export const deselectedConversation = 'chat2:deselectedConversation'
export const desktopNotification = 'chat2:desktopNotification'
export const dismissBlockButtons = 'chat2:dismissBlockButtons'
export const dismissJourneycard = 'chat2:dismissJourneycard'
export const fetchUserEmoji = 'chat2:fetchUserEmoji'
export const hideConversation = 'chat2:hideConversation'
export const ignorePinnedMessage = 'chat2:ignorePinnedMessage'
export const joinConversation = 'chat2:joinConversation'
export const jumpToRecent = 'chat2:jumpToRecent'
export const leaveConversation = 'chat2:leaveConversation'
export const loadAttachmentView = 'chat2:loadAttachmentView'
export const loadMessagesCentered = 'chat2:loadMessagesCentered'
export const loadNewerMessagesDueToScroll = 'chat2:loadNewerMessagesDueToScroll'
export const loadOlderMessagesDueToScroll = 'chat2:loadOlderMessagesDueToScroll'
export const markAsUnread = 'chat2:markAsUnread'
export const markConversationsStale = 'chat2:markConversationsStale'
export const markInitiallyLoadedThreadAsRead = 'chat2:markInitiallyLoadedThreadAsRead'
export const markTeamAsRead = 'chat2:markTeamAsRead'
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
export const messageSendByUsernames = 'chat2:messageSendByUsernames'
export const messageSetEditing = 'chat2:messageSetEditing'
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
export const navigateToInbox = 'chat2:navigateToInbox'
export const navigateToThread = 'chat2:navigateToThread'
export const notificationSettingsUpdated = 'chat2:notificationSettingsUpdated'
export const openChatFromWidget = 'chat2:openChatFromWidget'
export const openFolder = 'chat2:openFolder'
export const pendingMessageWasEdited = 'chat2:pendingMessageWasEdited'
export const pinMessage = 'chat2:pinMessage'
export const previewConversation = 'chat2:previewConversation'
export const removeBotMember = 'chat2:removeBotMember'
export const replyJump = 'chat2:replyJump'
export const resetChatWithoutThem = 'chat2:resetChatWithoutThem'
export const resetLetThemIn = 'chat2:resetLetThemIn'
export const resolveMaybeMention = 'chat2:resolveMaybeMention'
export const saveMinWriterRole = 'chat2:saveMinWriterRole'
export const selectedConversation = 'chat2:selectedConversation'
export const sendAudioRecording = 'chat2:sendAudioRecording'
export const sendTyping = 'chat2:sendTyping'
export const setAttachmentViewStatus = 'chat2:setAttachmentViewStatus'
export const setCommandMarkdown = 'chat2:setCommandMarkdown'
export const setCommandStatusInfo = 'chat2:setCommandStatusInfo'
export const setContainsLastMessage = 'chat2:setContainsLastMessage'
export const setConvExplodingMode = 'chat2:setConvExplodingMode'
export const setConvRetentionPolicy = 'chat2:setConvRetentionPolicy'
export const setConversationOffline = 'chat2:setConversationOffline'
export const setExplodingModeLock = 'chat2:setExplodingModeLock'
export const setMinWriterRole = 'chat2:setMinWriterRole'
export const setParticipants = 'chat2:setParticipants'
export const setThreadLoadStatus = 'chat2:setThreadLoadStatus'
export const tabSelected = 'chat2:tabSelected'
export const toggleGiphyPrefill = 'chat2:toggleGiphyPrefill'
export const toggleLocalReaction = 'chat2:toggleLocalReaction'
export const toggleMessageCollapse = 'chat2:toggleMessageCollapse'
export const toggleMessageReaction = 'chat2:toggleMessageReaction'
export const unfurlRemove = 'chat2:unfurlRemove'
export const unfurlResolvePrompt = 'chat2:unfurlResolvePrompt'
export const unhideConversation = 'chat2:unhideConversation'
export const unpinMessage = 'chat2:unpinMessage'
export const unsentTextChanged = 'chat2:unsentTextChanged'
export const updateConvExplodingModes = 'chat2:updateConvExplodingModes'
export const updateConvRetentionPolicy = 'chat2:updateConvRetentionPolicy'
export const updateMessages = 'chat2:updateMessages'
export const updateMoreToLoad = 'chat2:updateMoreToLoad'
export const updateNotificationSettings = 'chat2:updateNotificationSettings'
export const updateReactions = 'chat2:updateReactions'
export const updateTeamRetentionPolicy = 'chat2:updateTeamRetentionPolicy'
export const updateUnreadline = 'chat2:updateUnreadline'

// Action Creators
/**
 * About to try and unbox some inbox rows
 */
export const createMetaRequestingTrusted = (payload: {
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
}) => ({payload, type: metaRequestingTrusted as typeof metaRequestingTrusted})
/**
 * Actually start a conversation
 */
export const createCreateConversation = (payload: {
  readonly highlightMessageID?: number
  readonly participants: Array<string>
}) => ({payload, type: createConversation as typeof createConversation})
/**
 * Actually unboxing
 */
export const createMetaRequestTrusted = (payload: {
  readonly force?: boolean
  readonly noWaiting?: boolean
  readonly reason:
    | 'refreshPreviousSelected'
    | 'requestTeamsUnboxing'
    | 'inboxSynced'
    | 'setConvRetention'
    | 'subTeamRename'
    | 'tlfFinalize'
    | 'threadStale'
    | 'membersUpdate'
    | 'scroll'
    | 'ensureSelectedMeta'
    | 'ensureWidgetMetas'
    | 'ensureChannelMeta'
    | 'inboxSearchResults'
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
}) => ({payload, type: metaRequestTrusted as typeof metaRequestTrusted})
/**
 * Add a list of users to a conversation. Creates a SystemBulkAddToConv message.
 */
export const createAddUsersToChannel = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly usernames: Array<string>
}) => ({payload, type: addUsersToChannel as typeof addUsersToChannel})
/**
 * Add a new message
 *
 * Context types:
 * - sent = we sent it
 * - incoming = a streaming message
 * - threadLoad = we're loading more messages on select / scroll
 */
export const createMessagesAdd = (payload: {
  readonly context:
    | {type: 'sent'}
    | {type: 'incoming'}
    | {type: 'threadLoad'; conversationIDKey: Types.ConversationIDKey}
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messages: Array<Types.Message>
  readonly shouldClearOthers?: boolean
  readonly centeredMessageIDs?: Array<{
    conversationIDKey: Types.ConversationIDKey
    messageID: Types.MessageID
    highlightMode: Types.CenterOrdinalHighlightMode
  }>
  readonly forceContainsLatestCalc?: boolean
}) => ({payload, type: messagesAdd as typeof messagesAdd})
/**
 * Add a single user to a conversation. Creates a SystemBulkAddToConv message.
 */
export const createAddUserToChannel = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly username: string
}) => ({payload, type: addUserToChannel as typeof addUserToChannel})
/**
 * Add result for attachment view
 */
export const createAddAttachmentViewMessage = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly viewType: RPCChatTypes.GalleryItemTyp
  readonly message: Types.Message
}) => ({payload, type: addAttachmentViewMessage as typeof addAttachmentViewMessage})
/**
 * Block a conversation
 */
export const createBlockConversation = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly reportUser: boolean
}) => ({payload, type: blockConversation as typeof blockConversation})
/**
 * Clear attachment views
 */
export const createClearAttachmentView = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: clearAttachmentView as typeof clearAttachmentView})
/**
 * Clear command status info
 */
export const createClearCommandStatusInfo = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: clearCommandStatusInfo as typeof clearCommandStatusInfo})
/**
 * Consume a service notification that a conversation's retention policy has been updated
 */
export const createUpdateConvRetentionPolicy = (payload: {readonly meta: Types.ConversationMeta}) => ({
  payload,
  type: updateConvRetentionPolicy as typeof updateConvRetentionPolicy,
})
/**
 * Consume a service notification that a team retention policy was updated
 */
export const createUpdateTeamRetentionPolicy = (payload: {
  readonly metas: Array<Types.ConversationMeta>
}) => ({payload, type: updateTeamRetentionPolicy as typeof updateTeamRetentionPolicy})
/**
 * Conversation was loaded and is offline
 */
export const createSetConversationOffline = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly offline: boolean
}) => ({payload, type: setConversationOffline as typeof setConversationOffline})
/**
 * Delete a message
 */
export const createMessageDelete = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: messageDelete as typeof messageDelete})
/**
 * Deletes all messages
 */
export const createMessageDeleteHistory = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: messageDeleteHistory as typeof messageDeleteHistory})
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
 * Explicitly set whether a thread is loaded to the most recent message
 */
export const createSetContainsLastMessage = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly contains: boolean
}) => ({payload, type: setContainsLastMessage as typeof setContainsLastMessage})
/**
 * Exploding messages expired or were manually detonated.
 */
export const createMessagesExploded = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageIDs: Array<RPCChatTypes.MessageID>
  readonly explodedBy?: string
}) => ({payload, type: messagesExploded as typeof messagesExploded})
/**
 * Got an error sending a message
 */
export const createMessageErrored = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly reason: string
  readonly errorTyp?: number
  readonly outboxID: Types.OutboxID
}) => ({payload, type: messageErrored as typeof messageErrored})
/**
 * Got some inbox errors
 */
export const createMetaReceivedError = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly error?: RPCChatTypes.InboxUIItemError
  readonly username?: string
}) => ({payload, type: metaReceivedError as typeof metaReceivedError})
/**
 * Got some new inbox rows
 */
export const createMetasReceived = (payload: {
  readonly metas: Array<Types.ConversationMeta>
  readonly removals?: Array<Types.ConversationIDKey>
  readonly fromInboxRefresh?: boolean
}) => ({payload, type: metasReceived as typeof metasReceived})
/**
 * Handle an update to our conversation exploding modes.
 */
export const createUpdateConvExplodingModes = (payload: {
  readonly modes: Array<{conversationIDKey: Types.ConversationIDKey; seconds: number}>
}) => ({payload, type: updateConvExplodingModes as typeof updateConvExplodingModes})
/**
 * Hide a conversation until future activity
 */
export const createHideConversation = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: hideConversation as typeof hideConversation,
})
/**
 * If an implied team chat member resets you can add them back in
 */
export const createResetLetThemIn = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly username: string
}) => ({payload, type: resetLetThemIn as typeof resetLetThemIn})
/**
 * If an implied team chat member resets you can start a new chat w/o any reset people
 */
export const createResetChatWithoutThem = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: resetChatWithoutThem as typeof resetChatWithoutThem})
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
 * Internal action: pull more metas from the queue to request
 */
export const createMetaHandleQueue = (payload?: undefined) => ({
  payload,
  type: metaHandleQueue as typeof metaHandleQueue,
})
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
 * Load attachment view pane
 */
export const createLoadAttachmentView = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly viewType: RPCChatTypes.GalleryItemTyp
  readonly fromMsgID?: Types.MessageID
}) => ({payload, type: loadAttachmentView as typeof loadAttachmentView})
/**
 * Load some more messages for a conversation
 */
export const createLoadOlderMessagesDueToScroll = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: loadOlderMessagesDueToScroll as typeof loadOlderMessagesDueToScroll})
/**
 * Mark a message as deleted
 */
export const createMessagesWereDeleted = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageIDs?: Array<RPCChatTypes.MessageID>
  readonly upToMessageID?: RPCChatTypes.MessageID
  readonly deletableMessageTypes?: Set<Types.MessageType>
  readonly ordinals?: Array<Types.Ordinal>
}) => ({payload, type: messagesWereDeleted as typeof messagesWereDeleted})
/**
 * Mark all conversations in a team as read
 */
export const createMarkTeamAsRead = (payload: {readonly teamID: TeamsTypes.TeamID}) => ({
  payload,
  type: markTeamAsRead as typeof markTeamAsRead,
})
/**
 * Mark the converstation as unread to the given message ID
 */
export const createMarkAsUnread = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly readMsgID?: RPCChatTypes.MessageID
}) => ({payload, type: markAsUnread as typeof markAsUnread})
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
 * Reply privately to a message with quoting
 */
export const createMessageReplyPrivately = (payload: {
  readonly sourceConversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: messageReplyPrivately as typeof messageReplyPrivately})
/**
 * Resend a message
 */
export const createMessageRetry = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly outboxID: Types.OutboxID
}) => ({payload, type: messageRetry as typeof messageRetry})
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
 * Save on mobile (camera roll)
 */
export const createMessageAttachmentNativeSave = (payload: {readonly message: Types.Message}) => ({
  payload,
  type: messageAttachmentNativeSave as typeof messageAttachmentNativeSave,
})
/**
 * Saving an attachment to mobile storage
 */
export const createAttachmentMobileSave = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: attachmentMobileSave as typeof attachmentMobileSave})
/**
 * Saving an attachment to mobile storage has finished
 */
export const createAttachmentMobileSaved = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: attachmentMobileSaved as typeof attachmentMobileSaved})
/**
 * Select an existing conversation or setup an empty one. Can either be adhoc or a tlf (adhoc or team)
 * fromAReset means you were in a reset kbfs convo and you want to make a new one
 * Chatting from external places in the app should usually call this
 * if you want to preview a team chat (and add it to the inbox use selectConversation instead)
 */
export const createPreviewConversation = (payload: {
  readonly participants?: Array<string>
  readonly teamname?: string
  readonly channelname?: string
  readonly conversationIDKey?: Types.ConversationIDKey
  readonly highlightMessageID?: number
  readonly reason:
    | 'appLink'
    | 'channelHeader'
    | 'convertAdHoc'
    | 'files'
    | 'forward'
    | 'fromAReset'
    | 'journeyCardPopular'
    | 'manageView'
    | 'memberView'
    | 'messageLink'
    | 'newChannel'
    | 'profile'
    | 'requestedPayment'
    | 'resetChatWithoutThem'
    | 'search'
    | 'sentPayment'
    | 'teamHeader'
    | 'teamInvite'
    | 'teamMember'
    | 'teamMention'
    | 'teamRow'
    | 'tracker'
    | 'transaction'
}) => ({payload, type: previewConversation as typeof previewConversation})
/**
 * Selected a conversation (used by nav only)
 */
export const createSelectedConversation = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: selectedConversation as typeof selectedConversation})
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
 * Server told us a conversation is out of date
 */
export const createMarkConversationsStale = (payload: {
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
  readonly updateType: RPCChatTypes.StaleUpdateType
}) => ({payload, type: markConversationsStale as typeof markConversationsStale})
/**
 * Set a lock on the exploding mode for a conversation.
 */
export const createSetExplodingModeLock = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly unset?: boolean
}) => ({payload, type: setExplodingModeLock as typeof setExplodingModeLock})
/**
 * Set attachment view status
 */
export const createSetAttachmentViewStatus = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly viewType: RPCChatTypes.GalleryItemTyp
  readonly status: Types.AttachmentViewStatus
  readonly last?: boolean
}) => ({payload, type: setAttachmentViewStatus as typeof setAttachmentViewStatus})
/**
 * Set command markdown for a conversation
 */
export const createSetCommandMarkdown = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly md?: RPCChatTypes.UICommandMarkdown
}) => ({payload, type: setCommandMarkdown as typeof setCommandMarkdown})
/**
 * Set command status info
 */
export const createSetCommandStatusInfo = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly info: Types.CommandStatusInfo
}) => ({payload, type: setCommandStatusInfo as typeof setCommandStatusInfo})
/**
 * Set conversation participant info
 */
export const createSetParticipants = (payload: {
  readonly participants: Array<{
    conversationIDKey: Types.ConversationIDKey
    participants: Types.ParticipantInfo
  }>
}) => ({payload, type: setParticipants as typeof setParticipants})
/**
 * Set the minimum role required to write into a conversation. Valid only for team conversations.
 */
export const createSetMinWriterRole = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly role: TeamsTypes.TeamRoleType
}) => ({payload, type: setMinWriterRole as typeof setMinWriterRole})
/**
 * Set the remote exploding mode for a conversation.
 */
export const createSetConvExplodingMode = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly seconds: number
}) => ({payload, type: setConvExplodingMode as typeof setConvExplodingMode})
/**
 * Set thread load status
 */
export const createSetThreadLoadStatus = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly status: RPCChatTypes.UIChatThreadStatus
}) => ({payload, type: setThreadLoadStatus as typeof setThreadLoadStatus})
/**
 * Sets the retention policy for a conversation.
 */
export const createSetConvRetentionPolicy = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly policy: RetentionPolicy
}) => ({payload, type: setConvRetentionPolicy as typeof setConvRetentionPolicy})
/**
 * Share to external app on mobile
 */
export const createMessageAttachmentNativeShare = (payload: {readonly message: Types.Message}) => ({
  payload,
  type: messageAttachmentNativeShare as typeof messageAttachmentNativeShare,
})
/**
 * Show a desktop notification
 */
export const createDesktopNotification = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly author: string
  readonly body: string
}) => ({payload, type: desktopNotification as typeof desktopNotification})
/**
 * Start editing a message / or edit the last message / or clear editing
 */
export const createMessageSetEditing = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal?: Types.Ordinal
  readonly editLastUser?: string
}) => ({payload, type: messageSetEditing as typeof messageSetEditing})
/**
 * Submit an edit to the daemon
 */
export const createMessageEdit = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
  readonly text: HiddenString
}) => ({payload, type: messageEdit as typeof messageEdit})
/**
 * Tell server we're typing
 */
export const createSendTyping = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly typing: boolean
}) => ({payload, type: sendTyping as typeof sendTyping})
/**
 * Tell the service to toggle a reaction on a message.
 */
export const createToggleMessageReaction = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly emoji: string
  readonly ordinal: Types.Ordinal
}) => ({payload, type: toggleMessageReaction as typeof toggleMessageReaction})
/**
 * The attachment upload modal was canceled
 */
export const createAttachmentUploadCanceled = (payload: {
  readonly outboxIDs: Array<RPCChatTypes.OutboxID>
}) => ({payload, type: attachmentUploadCanceled as typeof attachmentUploadCanceled})
/**
 * The service sent us an update for the reaction map of a message.
 */
export const createUpdateReactions = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly updates: Array<{targetMsgID: RPCChatTypes.MessageID; reactions: Types.Reactions}>
}) => ({payload, type: updateReactions as typeof updateReactions})
/**
 * The user has selected an attachment with a preview
 */
export const createAttachmentPreviewSelect = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: attachmentPreviewSelect as typeof attachmentPreviewSelect})
/**
 * Toggle /giphy text to trigger preview window
 */
export const createToggleGiphyPrefill = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: toggleGiphyPrefill as typeof toggleGiphyPrefill,
})
/**
 * Toggle a reaction in the store.
 */
export const createToggleLocalReaction = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly decorated: string
  readonly emoji: string
  readonly targetOrdinal: Types.Ordinal
  readonly username: string
}) => ({payload, type: toggleLocalReaction as typeof toggleLocalReaction})
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
 * Unsent text changed
 */
export const createUnsentTextChanged = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly text: HiddenString
}) => ({payload, type: unsentTextChanged as typeof unsentTextChanged})
/**
 * Update a message which changed
 */
export const createMessageWasEdited = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: RPCChatTypes.MessageID
  readonly text: HiddenString
  readonly mentionsAt: Set<string>
  readonly mentionsChannel: 'none' | 'all' | 'here'
  readonly mentionsChannelName: Map<string, Types.ConversationIDKey>
}) => ({payload, type: messageWasEdited as typeof messageWasEdited})
/**
 * Update messages that we might have in the store
 */
export const createUpdateMessages = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messages: Array<{messageID: Types.MessageID; message: Types.Message}>
}) => ({payload, type: updateMessages as typeof updateMessages})
/**
 * Update progress on an upload
 */
export const createAttachmentUploading = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly outboxID: Types.OutboxID
  readonly ratio: number
}) => ({payload, type: attachmentUploading as typeof attachmentUploading})
/**
 * Update the minWriterRole stored with the conversation metadata.
 */
export const createSaveMinWriterRole = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly role: TeamsTypes.TeamRoleType
  readonly cannotWrite: boolean
}) => ({payload, type: saveMinWriterRole as typeof saveMinWriterRole})
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
 * We get new notification settings
 */
export const createNotificationSettingsUpdated = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly settings: RPCChatTypes.ConversationNotificationInfo
}) => ({payload, type: notificationSettingsUpdated as typeof notificationSettingsUpdated})
/**
 * We got a status update saying it was blocked or ignored
 */
export const createMetaDelete = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly selectSomethingElse: boolean
}) => ({payload, type: metaDelete as typeof metaDelete})
/**
 * We got an uploaded attachment.
 * While online this is like an edit of the placeholder
 */
export const createMessageAttachmentUploaded = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly placeholderID: RPCChatTypes.MessageID
  readonly message: Types.MessageAttachment
}) => ({payload, type: messageAttachmentUploaded as typeof messageAttachmentUploaded})
/**
 * We saved an attachment to the local disk
 */
export const createAttachmentDownloaded = (payload: {
  readonly message: Types.Message
  readonly error?: string
  readonly path?: string
}) => ({payload, type: attachmentDownloaded as typeof attachmentDownloaded})
/**
 * We updated our view of a thread
 */
export const createUpdateMoreToLoad = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly moreToLoad: boolean
}) => ({payload, type: updateMoreToLoad as typeof updateMoreToLoad})
/**
 * We want to save an attachment to the local disk
 */
export const createAttachmentDownload = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: attachmentDownload as typeof attachmentDownload})
/**
 * We want to unbox an inbox row
 */
export const createMetaNeedsUpdating = (payload: {
  readonly conversationIDKeys: Array<Types.ConversationIDKey>
  readonly reason: string
}) => ({payload, type: metaNeedsUpdating as typeof metaNeedsUpdating})
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
/**
 * We're done uploading
 */
export const createAttachmentUploaded = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
}) => ({payload, type: attachmentUploaded as typeof attachmentUploaded})
/**
 * When leaving a thread view, clear the force mark as unread bit
 */
export const createClearMarkAsUnread = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: clearMarkAsUnread as typeof clearMarkAsUnread,
})
/**
 * add bot member to channel
 */
export const createAddBotMember = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly convs?: Array<string>
  readonly allowCommands: boolean
  readonly allowMentions: boolean
  readonly username: string
  readonly restricted: boolean
}) => ({payload, type: addBotMember as typeof addBotMember})
/**
 * remove a bot member
 */
export const createRemoveBotMember = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly username: string
}) => ({payload, type: removeBotMember as typeof removeBotMember})
export const createAttachFromDragAndDrop = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly paths: Array<Types.PathAndOutboxID>
  readonly titles: Array<string>
}) => ({payload, type: attachFromDragAndDrop as typeof attachFromDragAndDrop})
export const createChannelSuggestionsTriggered = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: channelSuggestionsTriggered as typeof channelSuggestionsTriggered})
export const createClearMessages = (payload?: undefined) => ({
  payload,
  type: clearMessages as typeof clearMessages,
})
export const createClearMetas = (payload?: undefined) => ({payload, type: clearMetas as typeof clearMetas})
export const createDeselectedConversation = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: deselectedConversation as typeof deselectedConversation})
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
export const createLoadMessagesCentered = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly messageID: Types.MessageID
  readonly highlightMode: Types.CenterOrdinalHighlightMode
}) => ({payload, type: loadMessagesCentered as typeof loadMessagesCentered})
export const createLoadNewerMessagesDueToScroll = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
}) => ({payload, type: loadNewerMessagesDueToScroll as typeof loadNewerMessagesDueToScroll})
export const createMessageSendByUsernames = (payload: {
  readonly usernames: string
  readonly text: HiddenString
  readonly waitingKey?: string
}) => ({payload, type: messageSendByUsernames as typeof messageSendByUsernames})
export const createOpenChatFromWidget = (
  payload: {readonly conversationIDKey?: Types.ConversationIDKey} = {}
) => ({payload, type: openChatFromWidget as typeof openChatFromWidget})
export const createOpenFolder = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: openFolder as typeof openFolder,
})
export const createPendingMessageWasEdited = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly ordinal: Types.Ordinal
  readonly text: HiddenString
}) => ({payload, type: pendingMessageWasEdited as typeof pendingMessageWasEdited})
export const createSendAudioRecording = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly duration: number
  readonly path: string
  readonly amps: Array<number>
}) => ({payload, type: sendAudioRecording as typeof sendAudioRecording})
export const createUnhideConversation = (payload: {readonly conversationIDKey: Types.ConversationIDKey}) => ({
  payload,
  type: unhideConversation as typeof unhideConversation,
})

// Action Payloads
export type AddAttachmentViewMessagePayload = ReturnType<typeof createAddAttachmentViewMessage>
export type AddBotMemberPayload = ReturnType<typeof createAddBotMember>
export type AddUserToChannelPayload = ReturnType<typeof createAddUserToChannel>
export type AddUsersToChannelPayload = ReturnType<typeof createAddUsersToChannel>
export type AttachFromDragAndDropPayload = ReturnType<typeof createAttachFromDragAndDrop>
export type AttachmentDownloadPayload = ReturnType<typeof createAttachmentDownload>
export type AttachmentDownloadedPayload = ReturnType<typeof createAttachmentDownloaded>
export type AttachmentMobileSavePayload = ReturnType<typeof createAttachmentMobileSave>
export type AttachmentMobileSavedPayload = ReturnType<typeof createAttachmentMobileSaved>
export type AttachmentPastedPayload = ReturnType<typeof createAttachmentPasted>
export type AttachmentPreviewSelectPayload = ReturnType<typeof createAttachmentPreviewSelect>
export type AttachmentUploadCanceledPayload = ReturnType<typeof createAttachmentUploadCanceled>
export type AttachmentUploadedPayload = ReturnType<typeof createAttachmentUploaded>
export type AttachmentUploadingPayload = ReturnType<typeof createAttachmentUploading>
export type AttachmentsUploadPayload = ReturnType<typeof createAttachmentsUpload>
export type BlockConversationPayload = ReturnType<typeof createBlockConversation>
export type ChannelSuggestionsTriggeredPayload = ReturnType<typeof createChannelSuggestionsTriggered>
export type ClearAttachmentViewPayload = ReturnType<typeof createClearAttachmentView>
export type ClearCommandStatusInfoPayload = ReturnType<typeof createClearCommandStatusInfo>
export type ClearMarkAsUnreadPayload = ReturnType<typeof createClearMarkAsUnread>
export type ClearMessagesPayload = ReturnType<typeof createClearMessages>
export type ClearMetasPayload = ReturnType<typeof createClearMetas>
export type ConfirmScreenResponsePayload = ReturnType<typeof createConfirmScreenResponse>
export type CreateConversationPayload = ReturnType<typeof createCreateConversation>
export type DeselectedConversationPayload = ReturnType<typeof createDeselectedConversation>
export type DesktopNotificationPayload = ReturnType<typeof createDesktopNotification>
export type DismissBlockButtonsPayload = ReturnType<typeof createDismissBlockButtons>
export type DismissJourneycardPayload = ReturnType<typeof createDismissJourneycard>
export type FetchUserEmojiPayload = ReturnType<typeof createFetchUserEmoji>
export type HideConversationPayload = ReturnType<typeof createHideConversation>
export type IgnorePinnedMessagePayload = ReturnType<typeof createIgnorePinnedMessage>
export type JoinConversationPayload = ReturnType<typeof createJoinConversation>
export type JumpToRecentPayload = ReturnType<typeof createJumpToRecent>
export type LeaveConversationPayload = ReturnType<typeof createLeaveConversation>
export type LoadAttachmentViewPayload = ReturnType<typeof createLoadAttachmentView>
export type LoadMessagesCenteredPayload = ReturnType<typeof createLoadMessagesCentered>
export type LoadNewerMessagesDueToScrollPayload = ReturnType<typeof createLoadNewerMessagesDueToScroll>
export type LoadOlderMessagesDueToScrollPayload = ReturnType<typeof createLoadOlderMessagesDueToScroll>
export type MarkAsUnreadPayload = ReturnType<typeof createMarkAsUnread>
export type MarkConversationsStalePayload = ReturnType<typeof createMarkConversationsStale>
export type MarkInitiallyLoadedThreadAsReadPayload = ReturnType<typeof createMarkInitiallyLoadedThreadAsRead>
export type MarkTeamAsReadPayload = ReturnType<typeof createMarkTeamAsRead>
export type MessageAttachmentNativeSavePayload = ReturnType<typeof createMessageAttachmentNativeSave>
export type MessageAttachmentNativeSharePayload = ReturnType<typeof createMessageAttachmentNativeShare>
export type MessageAttachmentUploadedPayload = ReturnType<typeof createMessageAttachmentUploaded>
export type MessageDeleteHistoryPayload = ReturnType<typeof createMessageDeleteHistory>
export type MessageDeletePayload = ReturnType<typeof createMessageDelete>
export type MessageEditPayload = ReturnType<typeof createMessageEdit>
export type MessageErroredPayload = ReturnType<typeof createMessageErrored>
export type MessageReplyPrivatelyPayload = ReturnType<typeof createMessageReplyPrivately>
export type MessageRetryPayload = ReturnType<typeof createMessageRetry>
export type MessageSendByUsernamesPayload = ReturnType<typeof createMessageSendByUsernames>
export type MessageSendPayload = ReturnType<typeof createMessageSend>
export type MessageSetEditingPayload = ReturnType<typeof createMessageSetEditing>
export type MessageWasEditedPayload = ReturnType<typeof createMessageWasEdited>
export type MessagesAddPayload = ReturnType<typeof createMessagesAdd>
export type MessagesExplodedPayload = ReturnType<typeof createMessagesExploded>
export type MessagesWereDeletedPayload = ReturnType<typeof createMessagesWereDeleted>
export type MetaDeletePayload = ReturnType<typeof createMetaDelete>
export type MetaHandleQueuePayload = ReturnType<typeof createMetaHandleQueue>
export type MetaNeedsUpdatingPayload = ReturnType<typeof createMetaNeedsUpdating>
export type MetaReceivedErrorPayload = ReturnType<typeof createMetaReceivedError>
export type MetaRequestTrustedPayload = ReturnType<typeof createMetaRequestTrusted>
export type MetaRequestingTrustedPayload = ReturnType<typeof createMetaRequestingTrusted>
export type MetasReceivedPayload = ReturnType<typeof createMetasReceived>
export type NavigateToInboxPayload = ReturnType<typeof createNavigateToInbox>
export type NavigateToThreadPayload = ReturnType<typeof createNavigateToThread>
export type NotificationSettingsUpdatedPayload = ReturnType<typeof createNotificationSettingsUpdated>
export type OpenChatFromWidgetPayload = ReturnType<typeof createOpenChatFromWidget>
export type OpenFolderPayload = ReturnType<typeof createOpenFolder>
export type PendingMessageWasEditedPayload = ReturnType<typeof createPendingMessageWasEdited>
export type PinMessagePayload = ReturnType<typeof createPinMessage>
export type PreviewConversationPayload = ReturnType<typeof createPreviewConversation>
export type RemoveBotMemberPayload = ReturnType<typeof createRemoveBotMember>
export type ReplyJumpPayload = ReturnType<typeof createReplyJump>
export type ResetChatWithoutThemPayload = ReturnType<typeof createResetChatWithoutThem>
export type ResetLetThemInPayload = ReturnType<typeof createResetLetThemIn>
export type ResolveMaybeMentionPayload = ReturnType<typeof createResolveMaybeMention>
export type SaveMinWriterRolePayload = ReturnType<typeof createSaveMinWriterRole>
export type SelectedConversationPayload = ReturnType<typeof createSelectedConversation>
export type SendAudioRecordingPayload = ReturnType<typeof createSendAudioRecording>
export type SendTypingPayload = ReturnType<typeof createSendTyping>
export type SetAttachmentViewStatusPayload = ReturnType<typeof createSetAttachmentViewStatus>
export type SetCommandMarkdownPayload = ReturnType<typeof createSetCommandMarkdown>
export type SetCommandStatusInfoPayload = ReturnType<typeof createSetCommandStatusInfo>
export type SetContainsLastMessagePayload = ReturnType<typeof createSetContainsLastMessage>
export type SetConvExplodingModePayload = ReturnType<typeof createSetConvExplodingMode>
export type SetConvRetentionPolicyPayload = ReturnType<typeof createSetConvRetentionPolicy>
export type SetConversationOfflinePayload = ReturnType<typeof createSetConversationOffline>
export type SetExplodingModeLockPayload = ReturnType<typeof createSetExplodingModeLock>
export type SetMinWriterRolePayload = ReturnType<typeof createSetMinWriterRole>
export type SetParticipantsPayload = ReturnType<typeof createSetParticipants>
export type SetThreadLoadStatusPayload = ReturnType<typeof createSetThreadLoadStatus>
export type TabSelectedPayload = ReturnType<typeof createTabSelected>
export type ToggleGiphyPrefillPayload = ReturnType<typeof createToggleGiphyPrefill>
export type ToggleLocalReactionPayload = ReturnType<typeof createToggleLocalReaction>
export type ToggleMessageCollapsePayload = ReturnType<typeof createToggleMessageCollapse>
export type ToggleMessageReactionPayload = ReturnType<typeof createToggleMessageReaction>
export type UnfurlRemovePayload = ReturnType<typeof createUnfurlRemove>
export type UnfurlResolvePromptPayload = ReturnType<typeof createUnfurlResolvePrompt>
export type UnhideConversationPayload = ReturnType<typeof createUnhideConversation>
export type UnpinMessagePayload = ReturnType<typeof createUnpinMessage>
export type UnsentTextChangedPayload = ReturnType<typeof createUnsentTextChanged>
export type UpdateConvExplodingModesPayload = ReturnType<typeof createUpdateConvExplodingModes>
export type UpdateConvRetentionPolicyPayload = ReturnType<typeof createUpdateConvRetentionPolicy>
export type UpdateMessagesPayload = ReturnType<typeof createUpdateMessages>
export type UpdateMoreToLoadPayload = ReturnType<typeof createUpdateMoreToLoad>
export type UpdateNotificationSettingsPayload = ReturnType<typeof createUpdateNotificationSettings>
export type UpdateReactionsPayload = ReturnType<typeof createUpdateReactions>
export type UpdateTeamRetentionPolicyPayload = ReturnType<typeof createUpdateTeamRetentionPolicy>
export type UpdateUnreadlinePayload = ReturnType<typeof createUpdateUnreadline>

// All Actions
// prettier-ignore
export type Actions =
  | AddAttachmentViewMessagePayload
  | AddBotMemberPayload
  | AddUserToChannelPayload
  | AddUsersToChannelPayload
  | AttachFromDragAndDropPayload
  | AttachmentDownloadPayload
  | AttachmentDownloadedPayload
  | AttachmentMobileSavePayload
  | AttachmentMobileSavedPayload
  | AttachmentPastedPayload
  | AttachmentPreviewSelectPayload
  | AttachmentUploadCanceledPayload
  | AttachmentUploadedPayload
  | AttachmentUploadingPayload
  | AttachmentsUploadPayload
  | BlockConversationPayload
  | ChannelSuggestionsTriggeredPayload
  | ClearAttachmentViewPayload
  | ClearCommandStatusInfoPayload
  | ClearMarkAsUnreadPayload
  | ClearMessagesPayload
  | ClearMetasPayload
  | ConfirmScreenResponsePayload
  | CreateConversationPayload
  | DeselectedConversationPayload
  | DesktopNotificationPayload
  | DismissBlockButtonsPayload
  | DismissJourneycardPayload
  | FetchUserEmojiPayload
  | HideConversationPayload
  | IgnorePinnedMessagePayload
  | JoinConversationPayload
  | JumpToRecentPayload
  | LeaveConversationPayload
  | LoadAttachmentViewPayload
  | LoadMessagesCenteredPayload
  | LoadNewerMessagesDueToScrollPayload
  | LoadOlderMessagesDueToScrollPayload
  | MarkAsUnreadPayload
  | MarkConversationsStalePayload
  | MarkInitiallyLoadedThreadAsReadPayload
  | MarkTeamAsReadPayload
  | MessageAttachmentNativeSavePayload
  | MessageAttachmentNativeSharePayload
  | MessageAttachmentUploadedPayload
  | MessageDeleteHistoryPayload
  | MessageDeletePayload
  | MessageEditPayload
  | MessageErroredPayload
  | MessageReplyPrivatelyPayload
  | MessageRetryPayload
  | MessageSendByUsernamesPayload
  | MessageSendPayload
  | MessageSetEditingPayload
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
  | NavigateToInboxPayload
  | NavigateToThreadPayload
  | NotificationSettingsUpdatedPayload
  | OpenChatFromWidgetPayload
  | OpenFolderPayload
  | PendingMessageWasEditedPayload
  | PinMessagePayload
  | PreviewConversationPayload
  | RemoveBotMemberPayload
  | ReplyJumpPayload
  | ResetChatWithoutThemPayload
  | ResetLetThemInPayload
  | ResolveMaybeMentionPayload
  | SaveMinWriterRolePayload
  | SelectedConversationPayload
  | SendAudioRecordingPayload
  | SendTypingPayload
  | SetAttachmentViewStatusPayload
  | SetCommandMarkdownPayload
  | SetCommandStatusInfoPayload
  | SetContainsLastMessagePayload
  | SetConvExplodingModePayload
  | SetConvRetentionPolicyPayload
  | SetConversationOfflinePayload
  | SetExplodingModeLockPayload
  | SetMinWriterRolePayload
  | SetParticipantsPayload
  | SetThreadLoadStatusPayload
  | TabSelectedPayload
  | ToggleGiphyPrefillPayload
  | ToggleLocalReactionPayload
  | ToggleMessageCollapsePayload
  | ToggleMessageReactionPayload
  | UnfurlRemovePayload
  | UnfurlResolvePromptPayload
  | UnhideConversationPayload
  | UnpinMessagePayload
  | UnsentTextChangedPayload
  | UpdateConvExplodingModesPayload
  | UpdateConvRetentionPolicyPayload
  | UpdateMessagesPayload
  | UpdateMoreToLoadPayload
  | UpdateNotificationSettingsPayload
  | UpdateReactionsPayload
  | UpdateTeamRetentionPolicyPayload
  | UpdateUnreadlinePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
