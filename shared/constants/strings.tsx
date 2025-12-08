import * as Platforms from './platform'
import * as T from './types'
import {conversationIDKeyToString} from './types/chat2/common'

export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const addEmailWaitingKey = 'settings:addEmail'
export const importContactsWaitingKey = 'settings:importContacts'

export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

export const waitingKeyChatJoinConversation = 'chat:joinConversation'
export const waitingKeyChatLeaveConversation = 'chat:leaveConversation'
export const waitingKeyChatDeleteHistory = 'chat:deleteHistory'
export const waitingKeyChatPost = 'chat:post'
export const waitingKeyChatRetryPost = 'chat:retryPost'
export const waitingKeyChatEditPost = 'chat:editPost'
export const waitingKeyChatDeletePost = 'chat:deletePost'
export const waitingKeyChatCancelPost = 'chat:cancelPost'
export const waitingKeyChatInboxRefresh = 'chat:inboxRefresh'
export const waitingKeyChatCreating = 'chat:creatingConvo'
export const waitingKeyChatInboxSyncStarted = 'chat:inboxSyncStarted'
export const waitingKeyChatBotAdd = 'chat:botAdd'
export const waitingKeyChatBotRemove = 'chat:botRemove'
export const waitingKeyChatLoadingEmoji = 'chat:loadingEmoji'
export const waitingKeyChatPushLoad = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:pushLoad:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyChatThreadLoad = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:loadingThread:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyChatAddUsersToChannel = 'chat:addUsersToConversation'
export const waitingKeyChatAddUserToChannel = (username: string, conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:addUserToConversation:${username}:${conversationIDKey}`
export const waitingKeyChatConvStatusChange = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:convStatusChange:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyChatUnpin = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:unpin:${conversationIDKeyToString(conversationIDKey)}`
export const waitingKeyChatMutualTeams = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `chat:mutualTeams:${conversationIDKeyToString(conversationIDKey)}`

export const defaultDevicename =
  (Platforms.isAndroid ? 'Android Device' : undefined) ||
  (Platforms.isIOS ? 'iOS Device' : undefined) ||
  (Platforms.isDarwin ? 'Mac Device' : undefined) ||
  (Platforms.isWindows ? 'Windows Device' : undefined) ||
  (Platforms.isLinux ? 'Linux Device' : undefined) ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')
