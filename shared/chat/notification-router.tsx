// Every chat notification from the service enters here, once. Each one is applied in three
// stages, always in this order:
//   1. inbox: metadata, typing, participants, badges' sources, the unbox queue, desktop
//      notifications, the daemon's reacjis, the users store
//   2. thread: handlers a mounted conversation screen registered for its conversationIDKey (the
//      thread store, the composer, bot command status)
//   3. reload: triggers a mounted reader registered for its conversationIDKey (a meta unbox, a
//      storeless message reload, a stale thread reload)
// A notification about a conversation nobody has mounted stops after stage 1. Stages 2 and 3
// reach screens through notification-registry.tsx.
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {ignorePromise} from '@/constants/utils'
import {handleConvoEngineIncoming} from '@/chat/inbox/engine'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {
  onChatInboxSynced,
  onGetInboxConvsUnboxed,
  onGetInboxUnverifiedConvs,
  onInboxLayoutChanged,
  onIncomingInboxUIItem,
} from '@/chat/inbox/metadata'
import {useDaemonState} from '@/stores/daemon'
import {useUsersState} from '@/stores/users'
import {useWaitingState} from '@/stores/waiting'
import {
  deliverReloadTriggerToEach,
  deliverReloadTriggers,
  deliverThreadNotifications,
  type Delivery,
  type FanOut,
  type ReloadTrigger,
  type ThreadNotification,
} from './notification-registry'

const chatNotificationTypes = [
  'chat.1.NotifyChat.NewChatActivity',
  'chat.1.NotifyChat.ChatAttachmentDownloadComplete',
  'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
  'chat.1.NotifyChat.ChatAttachmentUploadProgress',
  'chat.1.NotifyChat.ChatAttachmentUploadStart',
  'chat.1.NotifyChat.ChatConvUpdate',
  'chat.1.NotifyChat.ChatIdentifyUpdate',
  'chat.1.NotifyChat.ChatInboxStale',
  'chat.1.NotifyChat.ChatInboxSyncStarted',
  'chat.1.NotifyChat.ChatInboxSynced',
  'chat.1.NotifyChat.ChatParticipantsInfo',
  'chat.1.NotifyChat.ChatPaymentInfo',
  'chat.1.NotifyChat.ChatPromptUnfurl',
  'chat.1.NotifyChat.ChatRequestInfo',
  'chat.1.NotifyChat.ChatSetConvRetention',
  'chat.1.NotifyChat.ChatSetConvSettings',
  'chat.1.NotifyChat.ChatSetTeamRetention',
  'chat.1.NotifyChat.ChatSubteamRename',
  'chat.1.NotifyChat.ChatTLFFinalize',
  'chat.1.NotifyChat.ChatThreadsStale',
  'chat.1.NotifyChat.ChatTypingUpdate',
  'chat.1.chatUi.chatBotCommandsUpdateStatus',
  'chat.1.chatUi.chatCoinFlipStatus',
  'chat.1.chatUi.chatCommandMarkdown',
  'chat.1.chatUi.chatCommandStatus',
  'chat.1.chatUi.chatGiphySearchResults',
  'chat.1.chatUi.chatGiphyToggleResultWindow',
  'chat.1.chatUi.chatInboxConversation',
  'chat.1.chatUi.chatInboxFailed',
  'chat.1.chatUi.chatInboxLayout',
  'chat.1.chatUi.chatInboxUnverified',
] as const satisfies ReadonlyArray<EngineGen.ActionType>

export type ChatNotification = EngineGen.ActionOf<(typeof chatNotificationTypes)[number]>

const chatNotificationTypeSet: ReadonlySet<string> = new Set(chatNotificationTypes)

export const isChatNotification = (action: EngineGen.Actions): action is ChatNotification =>
  chatNotificationTypeSet.has(action.type)

type Decoded = {
  reloads: Array<Delivery<ReloadTrigger>>
  // delivered after `reloads`, to mounted readers of any of its conversations
  reloadEach?: FanOut<ReloadTrigger>
  thread: Array<Delivery<ThreadNotification>>
}

const inboxUIItemConversationIDKey = (conv: T.RPCChat.InboxUIItem | null | undefined) =>
  conv ? T.Chat.stringToConversationIDKey(conv.convID) : T.Chat.noConversationIDKey

// The conversation an activity reloads its readers for. setStatus, readMessage, newConversation
// and failedMessage name it only through their inbox item, so without one they reload the
// no-conversation readers.
const activityConversationIDKey = (activity: T.RPCChat.ChatActivity) => {
  switch (activity.activityType) {
    case T.RPCChat.ChatActivityType.incomingMessage:
      return T.Chat.conversationIDToKey(activity.incomingMessage.convID)
    case T.RPCChat.ChatActivityType.setStatus:
      return inboxUIItemConversationIDKey(activity.setStatus.conv)
    case T.RPCChat.ChatActivityType.readMessage:
      return inboxUIItemConversationIDKey(activity.readMessage.conv)
    case T.RPCChat.ChatActivityType.newConversation:
      return inboxUIItemConversationIDKey(activity.newConversation.conv)
    case T.RPCChat.ChatActivityType.failedMessage:
      return inboxUIItemConversationIDKey(activity.failedMessage.conv)
    case T.RPCChat.ChatActivityType.membersUpdate:
      return T.Chat.conversationIDToKey(activity.membersUpdate.convID)
    case T.RPCChat.ChatActivityType.setAppNotificationSettings:
      return T.Chat.conversationIDToKey(activity.setAppNotificationSettings.convID)
    case T.RPCChat.ChatActivityType.messagesUpdated:
      return T.Chat.conversationIDToKey(activity.messagesUpdated.convID)
    case T.RPCChat.ChatActivityType.reactionUpdate:
      return T.Chat.conversationIDToKey(activity.reactionUpdate.convID)
    case T.RPCChat.ChatActivityType.expunge:
      return T.Chat.conversationIDToKey(activity.expunge.convID)
    case T.RPCChat.ChatActivityType.ephemeralPurge:
      return T.Chat.conversationIDToKey(activity.ephemeralPurge.convID)
    default:
      return T.Chat.noConversationIDKey
  }
}

const threadNotificationForActivity = (
  activity: T.RPCChat.ChatActivity
): Array<Delivery<ThreadNotification>> => {
  switch (activity.activityType) {
    case T.RPCChat.ChatActivityType.incomingMessage: {
      const {incomingMessage} = activity
      return [
        {
          conversationIDKey: T.Chat.conversationIDToKey(incomingMessage.convID),
          notification: {incomingMessage, type: 'incomingMessage'},
        },
      ]
    }
    case T.RPCChat.ChatActivityType.messagesUpdated: {
      const {messagesUpdated} = activity
      return [
        {
          conversationIDKey: T.Chat.conversationIDToKey(messagesUpdated.convID),
          notification: {messagesUpdated, type: 'messagesUpdated'},
        },
      ]
    }
    case T.RPCChat.ChatActivityType.failedMessage: {
      const {failedMessage} = activity
      const ids = new Set((failedMessage.outboxRecords ?? []).map(r => T.Chat.conversationIDToKey(r.convID)))
      return [...ids].map(conversationIDKey => ({
        conversationIDKey,
        notification: {failedMessage, type: 'failedMessage'},
      }))
    }
    case T.RPCChat.ChatActivityType.reactionUpdate: {
      const {reactionUpdate} = activity
      return [
        {
          conversationIDKey: T.Chat.conversationIDToKey(reactionUpdate.convID),
          notification: {reactionUpdate, type: 'reactionUpdate'},
        },
      ]
    }
    case T.RPCChat.ChatActivityType.expunge: {
      const {expunge} = activity
      return [
        {
          conversationIDKey: T.Chat.conversationIDToKey(expunge.convID),
          notification: {expunge, type: 'expunge'},
        },
      ]
    }
    case T.RPCChat.ChatActivityType.ephemeralPurge: {
      const {ephemeralPurge} = activity
      return [
        {
          conversationIDKey: T.Chat.conversationIDToKey(ephemeralPurge.convID),
          notification: {ephemeralPurge, type: 'ephemeralPurge'},
        },
      ]
    }
    default:
      return []
  }
}

const reloadsForActivity = (activity: T.RPCChat.ChatActivity): Array<Delivery<ReloadTrigger>> => {
  const conversationIDKey = activityConversationIDKey(activity)
  const reloads: Array<Delivery<ReloadTrigger>> = [{conversationIDKey, notification: {type: 'metadata'}}]
  switch (activity.activityType) {
    case T.RPCChat.ChatActivityType.incomingMessage:
    case T.RPCChat.ChatActivityType.messagesUpdated:
    case T.RPCChat.ChatActivityType.reactionUpdate:
    case T.RPCChat.ChatActivityType.expunge:
    case T.RPCChat.ChatActivityType.ephemeralPurge:
      reloads.push({conversationIDKey, notification: {type: 'messages'}})
      break
    default:
  }
  return reloads
}

const one = <N,>(conversationIDKey: T.Chat.ConversationIDKey, notification: N): Array<Delivery<N>> => [
  {conversationIDKey, notification},
]

const each = <N,>(ids: Iterable<T.Chat.ConversationIDKey>, notification: N): FanOut<N> => ({
  conversationIDKeys: new Set(ids),
  notification,
})

const metadataReload: ReloadTrigger = {type: 'metadata'}
const staleThread: ReloadTrigger = {type: 'staleThread'}

// Which conversations a notification concerns, and what each stage-2 and stage-3 handler is told.
export const decodeChatNotification = (action: ChatNotification): Decoded => {
  switch (action.type) {
    case 'chat.1.NotifyChat.NewChatActivity': {
      const {activity} = action.payload.params
      return {reloads: reloadsForActivity(activity), thread: threadNotificationForActivity(activity)}
    }
    case 'chat.1.NotifyChat.ChatConvUpdate':
      return {reloads: one(inboxUIItemConversationIDKey(action.payload.params.conv), metadataReload), thread: []}
    case 'chat.1.chatUi.chatInboxFailed':
    case 'chat.1.NotifyChat.ChatSetConvSettings':
    case 'chat.1.NotifyChat.ChatSetConvRetention':
      return {reloads: one(T.Chat.conversationIDToKey(action.payload.params.convID), metadataReload), thread: []}
    case 'chat.1.NotifyChat.ChatSetTeamRetention':
      return {
        reloadEach: each((action.payload.params.convs ?? []).map(inboxUIItemConversationIDKey), metadataReload),
        reloads: [],
        thread: [],
      }
    case 'chat.1.NotifyChat.ChatParticipantsInfo': {
      const participants = action.payload.params.participants ?? {}
      const ids = Object.keys(participants).filter(id => participants[id])
      return {reloadEach: each(ids.map(T.Chat.stringToConversationIDKey), metadataReload), reloads: [], thread: []}
    }
    case 'chat.1.NotifyChat.ChatThreadsStale':
      return {
        reloadEach: each(
          (action.payload.params.updates ?? []).map(u => T.Chat.conversationIDToKey(u.convID)),
          staleThread
        ),
        reloads: [],
        thread: [],
      }
    case 'chat.1.NotifyChat.ChatInboxSynced': {
      const {syncRes} = action.payload.params
      if (syncRes.syncType !== T.RPCChat.SyncInboxResType.incremental) {
        return {reloads: [], thread: []}
      }
      return {
        reloadEach: each(
          (syncRes.incremental.items ?? []).map(item => T.Chat.stringToConversationIDKey(item.conv.convID)),
          staleThread
        ),
        reloads: [],
        thread: [],
      }
    }
    case 'chat.1.NotifyChat.ChatTypingUpdate':
      return {
        reloads: [],
        thread: (action.payload.params.typingUpdates ?? []).map(update => ({
          conversationIDKey: T.Chat.conversationIDToKey(update.convID),
          notification: {type: 'typing', typers: update.typers},
        })),
      }
    case 'chat.1.NotifyChat.ChatRequestInfo': {
      const {convID, info, msgID} = action.payload.params
      return {reloads: [], thread: one(T.Chat.conversationIDToKey(convID), {info, msgID, type: 'requestInfo'})}
    }
    case 'chat.1.NotifyChat.ChatPaymentInfo': {
      const {convID, info, msgID} = action.payload.params
      return {reloads: [], thread: one(T.Chat.conversationIDToKey(convID), {info, msgID, type: 'paymentInfo'})}
    }
    case 'chat.1.NotifyChat.ChatPromptUnfurl': {
      const {convID, domain, msgID} = action.payload.params
      return {reloads: [], thread: one(T.Chat.conversationIDToKey(convID), {domain, msgID, type: 'promptUnfurl'})}
    }
    case 'chat.1.chatUi.chatCoinFlipStatus': {
      const byConversation = new Map<T.Chat.ConversationIDKey, Array<T.RPCChat.UICoinFlipStatus>>()
      for (const status of action.payload.params.statuses ?? []) {
        const id = T.Chat.stringToConversationIDKey(status.convID)
        const statuses = byConversation.get(id) ?? []
        statuses.push(status)
        byConversation.set(id, statuses)
      }
      return {
        reloads: [],
        thread: [...byConversation].map(([conversationIDKey, statuses]) => ({
          conversationIDKey,
          notification: {statuses, type: 'coinFlipStatuses'},
        })),
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentDownloadProgress': {
      const {bytesComplete, bytesTotal, convID, msgID} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.conversationIDToKey(convID), {
          bytesComplete,
          bytesTotal,
          msgID,
          type: 'attachmentDownloadProgress',
        }),
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentDownloadComplete': {
      const {convID, msgID} = action.payload.params
      const conversationIDKey = T.Chat.conversationIDToKey(convID)
      return {
        reloads: one(conversationIDKey, {messageID: T.Chat.numberToMessageID(msgID), type: 'attachmentDownloaded'}),
        thread: one(conversationIDKey, {msgID, type: 'attachmentDownloadComplete'}),
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentUploadStart': {
      const {convID, outboxID} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.conversationIDToKey(convID), {outboxID, type: 'attachmentUploadProgress'}),
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentUploadProgress': {
      const {bytesComplete, bytesTotal, convID, outboxID} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.conversationIDToKey(convID), {
          bytesComplete,
          bytesTotal,
          outboxID,
          type: 'attachmentUploadProgress',
        }),
      }
    }
    case 'chat.1.chatUi.chatCommandStatus': {
      const {actions, convID, displayText, typ} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.stringToConversationIDKey(convID), {
          actions,
          displayText,
          displayType: typ,
          type: 'commandStatus',
        }),
      }
    }
    case 'chat.1.chatUi.chatCommandMarkdown': {
      const {convID, md} = action.payload.params
      return {reloads: [], thread: one(T.Chat.stringToConversationIDKey(convID), {md, type: 'commandMarkdown'})}
    }
    case 'chat.1.chatUi.chatGiphyToggleResultWindow': {
      const {clearInput, convID, show} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.stringToConversationIDKey(convID), {
          clearInput,
          show,
          type: 'giphyToggleResultWindow',
        }),
      }
    }
    case 'chat.1.chatUi.chatGiphySearchResults': {
      const {convID, results} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.stringToConversationIDKey(convID), {results, type: 'giphySearchResults'}),
      }
    }
    case 'chat.1.chatUi.chatBotCommandsUpdateStatus': {
      const {convID, status} = action.payload.params
      return {
        reloads: [],
        thread: one(T.Chat.stringToConversationIDKey(convID), {status, type: 'botCommandsUpdateStatus'}),
      }
    }
    default:
      return {reloads: [], thread: []}
  }
}

const applyToInbox = (action: ChatNotification) => {
  switch (action.type) {
    case 'chat.1.NotifyChat.ChatIdentifyUpdate': {
      const {update} = action.payload.params
      const usernames = update.CanonicalName.split(',')
      const broken = (update.breaks.breaks || []).map(b => b.user.username)
      useUsersState.getState().dispatch.updates(
        usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
      )
      return
    }
    case 'chat.1.NotifyChat.ChatInboxStale':
      ignorePromise(useInboxLayoutState.getState().dispatch.refresh('inboxStale'))
      return
    case 'chat.1.chatUi.chatInboxUnverified':
      onGetInboxUnverifiedConvs(action)
      return
    case 'chat.1.NotifyChat.ChatInboxSyncStarted':
      useWaitingState.getState().dispatch.increment(S.waitingKeyChatInboxSyncStarted)
      return
    case 'chat.1.NotifyChat.ChatInboxSynced':
      useWaitingState.getState().dispatch.clear(S.waitingKeyChatInboxSyncStarted)
      ignorePromise(
        onChatInboxSynced(action, async reason => useInboxLayoutState.getState().dispatch.refresh(reason))
      )
      return
    case 'chat.1.chatUi.chatInboxLayout': {
      const {hasLoaded, dispatch} = useInboxLayoutState.getState()
      dispatch.updateLayout(action.payload.params.layout)
      const {layout} = useInboxLayoutState.getState()
      if (layout) {
        onInboxLayoutChanged(layout, hasLoaded)
      }
      return
    }
    case 'chat.1.chatUi.chatInboxConversation':
      onGetInboxConvsUnboxed(action)
      return
    default: {
      const {inboxUIItem, userReacjis} = handleConvoEngineIncoming(action)
      if (inboxUIItem) {
        onIncomingInboxUIItem(inboxUIItem)
      }
      if (userReacjis) {
        useDaemonState.getState().dispatch.updateUserReacjis(userReacjis)
      }
    }
  }
}

export const routeChatNotification = (action: ChatNotification) => {
  applyToInbox(action)
  const {reloadEach, reloads, thread} = decodeChatNotification(action)
  deliverThreadNotifications(thread, action.type)
  deliverReloadTriggers(reloads, action.type)
  if (reloadEach) {
    deliverReloadTriggerToEach(reloadEach, action.type)
  }
}
