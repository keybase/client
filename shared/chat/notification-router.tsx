// Every chat notification from the service enters here, once. Each one is applied in three
// stages, always in this order:
//   1. inbox: metadata, typing, participants, badges' sources, the unbox queue, desktop
//      notifications, the daemon's reacjis, the users store
//   2. thread: handlers a mounted conversation screen registered for its conversationIDKey (the
//      thread store, the composer, bot command status)
//   3. reload: triggers a mounted reader registered for its conversationIDKey (a meta unbox, a
//      storeless message reload, a stale thread reload)
// Each notification type is decoded in one place (stagesOf) into what it does at each stage. A
// notification about a conversation nobody has mounted stops after stage 1. Stages 2 and 3 reach
// screens through notification-registry.tsx.
import * as Meta from '@/constants/chat/meta'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import * as Message from '@/constants/chat/message'
import type * as EngineGen from '@/constants/rpc'
import {ignorePromise} from '@/constants/utils'
import {
  markIdentifyFailures,
  maybeShowIncomingMessageDesktopNotification,
  onChatThreadsStale,
  onConvUpdate,
  onReactionUpdate,
  onSetConvRetention,
  onSetConvSettings,
  onSetTeamRetention,
} from '@/chat/inbox/engine'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {
  forceUnboxRowsForService,
  metaReceivedError,
  onChatInboxSynced,
  onGetInboxConvsUnboxed,
  onGetInboxUnverifiedConvs,
  onInboxLayoutChanged,
  onIncomingInboxUIItem,
  syncInboxParticipantsFromParticipantMap,
  unboxRows,
  updateInboxConversationMeta,
} from '@/chat/inbox/metadata'
import {updateInboxTyping} from '@/chat/inbox/typing-state'
import {useUsersState} from '@/stores/users'
import {useWaitingState} from '@/stores/waiting'
import {
  deliverReloadTriggerToEach,
  deliverReloadTriggers,
  deliverThreadNotifications,
  hasReloadHandlers,
  hasThreadHandlers,
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

// What one notification does at each stage. The thread and reload parts are built when asked for.
type Stages = {
  inbox?: () => void
  thread?: () => ReadonlyArray<Delivery<ThreadNotification>>
  reloads?: () => ReadonlyArray<Delivery<ReloadTrigger>>
  // delivered after `reloads`, to mounted readers of any of its conversations
  reloadEach?: () => FanOut<ReloadTrigger>
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

const metadataOf = (conversationIDKey: T.Chat.ConversationIDKey) => one(conversationIDKey, metadataReload)
// the conversation's meta, then the messages an activity changed: those listed, and with upTo every
// message below it
const metadataAndMessagesOf = (
  conversationIDKey: T.Chat.ConversationIDKey,
  ids: ReadonlyArray<number | undefined>,
  upTo?: T.Chat.MessageID
): Array<Delivery<ReloadTrigger>> => {
  const messageIDs = [...new Set(ids)].flatMap(id => (id === undefined ? [] : [T.Chat.numberToMessageID(id)]))
  const messages: ReloadTrigger =
    upTo === undefined ? {messageIDs, type: 'messages'} : {messageIDs, type: 'messages', upTo}
  return [
    {conversationIDKey, notification: metadataReload},
    {conversationIDKey, notification: messages},
  ]
}

const uiMessageID = (m: T.RPCChat.UIMessage | null | undefined) =>
  (m ? Message.getMessageID(m) : null) ?? undefined

// The existing messages an incoming message's body changes: the target of an edit, delete,
// reaction, unfurl or finished upload, and with upTo every message below it (a delete-history, which
// the service applies strictly below its line, as an expunge). The other types add a message and
// change none: text, attachment, metadata, tlfname and headline (the conversation's meta), join,
// leave, system, sendpayment, requestpayment, flip and pin (the pinned message is read off the meta).
const bodyTargets = (
  m: T.RPCChat.UIMessage | null | undefined
): {ids: ReadonlyArray<number>; upTo?: T.Chat.MessageID} => {
  if (m?.state !== T.RPCChat.MessageUnboxedState.valid) {
    return {ids: []}
  }
  const body = m.valid.messageBody
  switch (body.messageType) {
    case T.RPCChat.MessageType.edit:
      return {ids: [body.edit.messageID]}
    case T.RPCChat.MessageType.delete:
      return {ids: body.delete.messageIDs ?? []}
    case T.RPCChat.MessageType.deletehistory:
      return {ids: [], upTo: T.Chat.numberToMessageID(body.deletehistory.upto)}
    case T.RPCChat.MessageType.reaction:
      return {ids: [body.reaction.m]}
    case T.RPCChat.MessageType.unfurl:
      return {ids: [body.unfurl.messageID]}
    case T.RPCChat.MessageType.attachmentuploaded:
      return {ids: [body.attachmentuploaded.messageID]}
    default:
      return {ids: []}
  }
}

const inboxUIItemConversationIDKey = (conv: T.RPCChat.InboxUIItem | null | undefined) =>
  conv ? T.Chat.stringToConversationIDKey(conv.convID) : T.Chat.noConversationIDKey

// setStatus, readMessage, newConversation and failedMessage name the conversation whose readers
// they reload only through their inbox item, so without one they reload the no-conversation
// readers, as does an activity type not listed here.
const activityStages = (activity: T.RPCChat.ChatActivity): Stages => {
  switch (activity.activityType) {
    case T.RPCChat.ChatActivityType.incomingMessage: {
      const {incomingMessage} = activity
      const id = T.Chat.conversationIDToKey(incomingMessage.convID)
      return {
        inbox: () => {
          maybeShowIncomingMessageDesktopNotification(incomingMessage)
          onIncomingInboxUIItem(incomingMessage.conv ?? undefined)
        },
        reloads: () => {
          const targets = bodyTargets(incomingMessage.message)
          return metadataAndMessagesOf(
            id,
            [uiMessageID(incomingMessage.message), uiMessageID(incomingMessage.modifiedMessage), ...targets.ids],
            targets.upTo
          )
        },
        thread: () => one(id, {incomingMessage, type: 'incomingMessage'}),
      }
    }
    case T.RPCChat.ChatActivityType.setStatus: {
      const {conv} = activity.setStatus
      return {
        inbox: () => onIncomingInboxUIItem(conv ?? undefined),
        reloads: () => metadataOf(inboxUIItemConversationIDKey(conv)),
      }
    }
    case T.RPCChat.ChatActivityType.readMessage: {
      const {conv, convID} = activity.readMessage
      return {
        inbox: () => {
          if (!conv) {
            forceUnboxRowsForService([T.Chat.conversationIDToKey(convID)])
          }
          onIncomingInboxUIItem(conv ?? undefined)
        },
        reloads: () => metadataOf(inboxUIItemConversationIDKey(conv)),
      }
    }
    case T.RPCChat.ChatActivityType.newConversation: {
      const {conv} = activity.newConversation
      return {
        inbox: () => onIncomingInboxUIItem(conv ?? undefined),
        reloads: () => metadataOf(inboxUIItemConversationIDKey(conv)),
      }
    }
    case T.RPCChat.ChatActivityType.failedMessage: {
      const {failedMessage} = activity
      return {
        inbox: () => {
          markIdentifyFailures(failedMessage.outboxRecords)
          onIncomingInboxUIItem(failedMessage.conv ?? undefined)
        },
        reloads: () => metadataOf(inboxUIItemConversationIDKey(failedMessage.conv)),
        // every record's conversation hears the whole notification once
        thread: () => {
          const ids = new Set(
            (failedMessage.outboxRecords ?? []).map(r => T.Chat.conversationIDToKey(r.convID))
          )
          return [...ids].map(conversationIDKey => ({
            conversationIDKey,
            notification: {failedMessage, type: 'failedMessage'} as const,
          }))
        },
      }
    }
    case T.RPCChat.ChatActivityType.membersUpdate: {
      const id = T.Chat.conversationIDToKey(activity.membersUpdate.convID)
      return {inbox: () => forceUnboxRowsForService([id]), reloads: () => metadataOf(id)}
    }
    case T.RPCChat.ChatActivityType.setAppNotificationSettings: {
      const {convID, settings} = activity.setAppNotificationSettings
      const id = T.Chat.conversationIDToKey(convID)
      return {
        inbox: () => updateInboxConversationMeta(id, Meta.parseNotificationSettings(settings)),
        reloads: () => metadataOf(id),
      }
    }
    case T.RPCChat.ChatActivityType.messagesUpdated: {
      const {messagesUpdated} = activity
      const id = T.Chat.conversationIDToKey(messagesUpdated.convID)
      return {
        reloads: () => metadataAndMessagesOf(id, (messagesUpdated.updates ?? []).map(uiMessageID)),
        thread: () => one(id, {messagesUpdated, type: 'messagesUpdated'}),
      }
    }
    case T.RPCChat.ChatActivityType.reactionUpdate: {
      const {reactionUpdate} = activity
      const id = T.Chat.conversationIDToKey(reactionUpdate.convID)
      return {
        inbox: () => onReactionUpdate(reactionUpdate),
        reloads: () =>
          metadataAndMessagesOf(
            id,
            (reactionUpdate.reactionUpdates ?? []).map(r => r.targetMsgID)
          ),
        thread: () => one(id, {reactionUpdate, type: 'reactionUpdate'}),
      }
    }
    case T.RPCChat.ChatActivityType.expunge: {
      const {expunge} = activity
      const id = T.Chat.conversationIDToKey(expunge.convID)
      return {
        reloads: () => metadataAndMessagesOf(id, [], T.Chat.numberToMessageID(expunge.expunge.upto)),
        thread: () => one(id, {expunge, type: 'expunge'}),
      }
    }
    case T.RPCChat.ChatActivityType.ephemeralPurge: {
      const {ephemeralPurge} = activity
      const id = T.Chat.conversationIDToKey(ephemeralPurge.convID)
      return {
        reloads: () => metadataAndMessagesOf(id, (ephemeralPurge.msgs ?? []).map(uiMessageID)),
        thread: () => one(id, {ephemeralPurge, type: 'ephemeralPurge'}),
      }
    }
    default:
      return {reloads: () => metadataOf(T.Chat.noConversationIDKey)}
  }
}

// The one place each notification is decoded.
const stagesOf = (action: ChatNotification): Stages => {
  switch (action.type) {
    case 'chat.1.NotifyChat.NewChatActivity':
      return activityStages(action.payload.params.activity)
    case 'chat.1.NotifyChat.ChatConvUpdate': {
      const {conv} = action.payload.params
      return {inbox: () => onConvUpdate(conv), reloads: () => metadataOf(inboxUIItemConversationIDKey(conv))}
    }
    case 'chat.1.chatUi.chatInboxFailed': {
      const {convID, error} = action.payload.params
      const id = T.Chat.conversationIDToKey(convID)
      return {inbox: () => metaReceivedError(id, error), reloads: () => metadataOf(id)}
    }
    case 'chat.1.NotifyChat.ChatSetConvSettings': {
      const {params} = action.payload
      return {
        inbox: () => onSetConvSettings(params),
        reloads: () => metadataOf(T.Chat.conversationIDToKey(params.convID)),
      }
    }
    case 'chat.1.NotifyChat.ChatSetConvRetention': {
      const {params} = action.payload
      return {
        inbox: () => onSetConvRetention(params),
        reloads: () => metadataOf(T.Chat.conversationIDToKey(params.convID)),
      }
    }
    case 'chat.1.NotifyChat.ChatSetTeamRetention': {
      const {convs} = action.payload.params
      return {
        inbox: () => onSetTeamRetention(convs),
        reloadEach: () => each((convs ?? []).map(inboxUIItemConversationIDKey), metadataReload),
      }
    }
    case 'chat.1.NotifyChat.ChatParticipantsInfo': {
      const {participants} = action.payload.params
      return {
        inbox: () => syncInboxParticipantsFromParticipantMap(participants),
        reloadEach: () => {
          const map = participants ?? {}
          const ids = Object.keys(map).filter(id => map[id])
          return each(ids.map(T.Chat.stringToConversationIDKey), metadataReload)
        },
      }
    }
    case 'chat.1.NotifyChat.ChatThreadsStale': {
      const {updates} = action.payload.params
      return {
        inbox: () => onChatThreadsStale(updates),
        reloadEach: () => each((updates ?? []).map(u => T.Chat.conversationIDToKey(u.convID)), staleThread),
      }
    }
    case 'chat.1.NotifyChat.ChatSubteamRename': {
      const {convs} = action.payload.params
      return {
        inbox: () => forceUnboxRowsForService((convs ?? []).map(c => T.Chat.stringToConversationIDKey(c.convID))),
      }
    }
    case 'chat.1.NotifyChat.ChatTLFFinalize': {
      const {convID} = action.payload.params
      return {inbox: () => unboxRows([T.Chat.conversationIDToKey(convID)])}
    }
    case 'chat.1.NotifyChat.ChatIdentifyUpdate': {
      const {update} = action.payload.params
      return {
        inbox: () => {
          const usernames = update.CanonicalName.split(',')
          const broken = (update.breaks.breaks || []).map(b => b.user.username)
          useUsersState.getState().dispatch.updates(
            usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
          )
        },
      }
    }
    case 'chat.1.NotifyChat.ChatInboxStale':
      return {inbox: () => ignorePromise(useInboxLayoutState.getState().dispatch.refresh('inboxStale'))}
    case 'chat.1.chatUi.chatInboxUnverified':
      return {inbox: () => onGetInboxUnverifiedConvs(action)}
    case 'chat.1.NotifyChat.ChatInboxSyncStarted':
      return {inbox: () => useWaitingState.getState().dispatch.increment(S.waitingKeyChatInboxSyncStarted)}
    case 'chat.1.NotifyChat.ChatInboxSynced': {
      const {syncRes} = action.payload.params
      return {
        inbox: () => {
          useWaitingState.getState().dispatch.clear(S.waitingKeyChatInboxSyncStarted)
          ignorePromise(
            onChatInboxSynced(action, async reason => useInboxLayoutState.getState().dispatch.refresh(reason))
          )
        },
        reloadEach:
          syncRes.syncType === T.RPCChat.SyncInboxResType.incremental
            ? () =>
                each(
                  (syncRes.incremental.items ?? []).map(item => T.Chat.stringToConversationIDKey(item.conv.convID)),
                  staleThread
                )
            : undefined,
      }
    }
    case 'chat.1.chatUi.chatInboxLayout':
      return {
        inbox: () => {
          const {hasLoaded, dispatch} = useInboxLayoutState.getState()
          dispatch.updateLayout(action.payload.params.layout)
          const {layout} = useInboxLayoutState.getState()
          if (layout) {
            onInboxLayoutChanged(layout, hasLoaded)
          }
        },
      }
    case 'chat.1.chatUi.chatInboxConversation':
      return {inbox: () => onGetInboxConvsUnboxed(action)}
    case 'chat.1.NotifyChat.ChatTypingUpdate': {
      const {typingUpdates} = action.payload.params
      return {
        inbox: () => updateInboxTyping(typingUpdates),
        thread: () =>
          (typingUpdates ?? []).map(update => ({
            conversationIDKey: T.Chat.conversationIDToKey(update.convID),
            notification: {type: 'typing', typers: update.typers} as const,
          })),
      }
    }
    case 'chat.1.NotifyChat.ChatRequestInfo': {
      const {convID, info, msgID} = action.payload.params
      return {thread: () => one(T.Chat.conversationIDToKey(convID), {info, msgID, type: 'requestInfo'})}
    }
    case 'chat.1.NotifyChat.ChatPaymentInfo': {
      const {convID, info, msgID} = action.payload.params
      return {thread: () => one(T.Chat.conversationIDToKey(convID), {info, msgID, type: 'paymentInfo'})}
    }
    case 'chat.1.NotifyChat.ChatPromptUnfurl': {
      const {convID, domain, msgID} = action.payload.params
      return {thread: () => one(T.Chat.conversationIDToKey(convID), {domain, msgID, type: 'promptUnfurl'})}
    }
    case 'chat.1.chatUi.chatCoinFlipStatus': {
      const {statuses} = action.payload.params
      return {
        // grouped per conversation, in arrival order
        thread: () => {
          const byConversation = new Map<T.Chat.ConversationIDKey, Array<T.RPCChat.UICoinFlipStatus>>()
          for (const status of statuses ?? []) {
            const id = T.Chat.stringToConversationIDKey(status.convID)
            const forConversation = byConversation.get(id) ?? []
            forConversation.push(status)
            byConversation.set(id, forConversation)
          }
          return [...byConversation].map(([conversationIDKey, s]) => ({
            conversationIDKey,
            notification: {statuses: s, type: 'coinFlipStatuses'} as const,
          }))
        },
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentDownloadProgress': {
      const {bytesComplete, bytesTotal, convID, msgID} = action.payload.params
      return {
        thread: () =>
          one(T.Chat.conversationIDToKey(convID), {
            bytesComplete,
            bytesTotal,
            msgID,
            type: 'attachmentDownloadProgress',
          }),
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentDownloadComplete': {
      const {convID, msgID} = action.payload.params
      const id = T.Chat.conversationIDToKey(convID)
      return {
        reloads: () => one(id, {messageID: T.Chat.numberToMessageID(msgID), type: 'attachmentDownloaded'}),
        thread: () => one(id, {msgID, type: 'attachmentDownloadComplete'}),
      }
    }
    case 'chat.1.NotifyChat.ChatAttachmentUploadStart': {
      const {convID, outboxID} = action.payload.params
      return {thread: () => one(T.Chat.conversationIDToKey(convID), {outboxID, type: 'attachmentUploadProgress'})}
    }
    case 'chat.1.NotifyChat.ChatAttachmentUploadProgress': {
      const {bytesComplete, bytesTotal, convID, outboxID} = action.payload.params
      return {
        thread: () =>
          one(T.Chat.conversationIDToKey(convID), {
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
        thread: () =>
          one(T.Chat.stringToConversationIDKey(convID), {
            actions,
            displayText,
            displayType: typ,
            type: 'commandStatus',
          }),
      }
    }
    case 'chat.1.chatUi.chatCommandMarkdown': {
      const {convID, md} = action.payload.params
      return {thread: () => one(T.Chat.stringToConversationIDKey(convID), {md, type: 'commandMarkdown'})}
    }
    case 'chat.1.chatUi.chatGiphyToggleResultWindow': {
      const {clearInput, convID, show} = action.payload.params
      return {
        thread: () =>
          one(T.Chat.stringToConversationIDKey(convID), {clearInput, show, type: 'giphyToggleResultWindow'}),
      }
    }
    case 'chat.1.chatUi.chatGiphySearchResults': {
      const {convID, results} = action.payload.params
      return {thread: () => one(T.Chat.stringToConversationIDKey(convID), {results, type: 'giphySearchResults'})}
    }
    case 'chat.1.chatUi.chatBotCommandsUpdateStatus': {
      const {convID, status} = action.payload.params
      return {
        thread: () => one(T.Chat.stringToConversationIDKey(convID), {status, type: 'botCommandsUpdateStatus'}),
      }
    }
  }
}

type Decoded = {
  inbox?: () => void
  reloads: ReadonlyArray<Delivery<ReloadTrigger>>
  reloadEach?: FanOut<ReloadTrigger>
  thread: ReadonlyArray<Delivery<ThreadNotification>>
}

const everyStage = {reload: true, thread: true}

// Which conversations a notification concerns, what each stage-2 and stage-3 handler is told, and
// what stage 1 does to the inbox. A stage not wanted is left empty, unbuilt.
export const decodeChatNotification = (
  action: ChatNotification,
  wanted: {reload: boolean; thread: boolean} = everyStage
): Decoded => {
  const {inbox, reloadEach, reloads, thread} = stagesOf(action)
  return {
    inbox,
    reloadEach: wanted.reload ? reloadEach?.() : undefined,
    reloads: (wanted.reload && reloads?.()) || [],
    thread: (wanted.thread && thread?.()) || [],
  }
}

export const routeChatNotification = (action: ChatNotification) => {
  const {inbox, reloadEach, reloads, thread} = decodeChatNotification(action, {
    reload: hasReloadHandlers(),
    thread: hasThreadHandlers(),
  })
  inbox?.()
  deliverThreadNotifications(thread, action.type)
  deliverReloadTriggers(reloads, action.type)
  if (reloadEach) {
    deliverReloadTriggerToEach(reloadEach, action.type)
  }
}
