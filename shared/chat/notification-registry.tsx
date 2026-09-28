// Where a mounted conversation screen registers to hear about its own conversation. The chat
// notification router (notification-router.tsx) is the only caller of the deliver functions:
// it runs every thread handler a notification concerns, then every reload handler.
//
// Screens register from a passive effect, so a screen React has hidden with <Activity> (which
// unmounts passive effects) is unregistered while hidden and misses what arrives meanwhile.
//
// Keep this a leaf. The router's inbox stage imports reach constants/router, whose route table
// imports these screens, so a screen importing the router would close a require cycle.
import * as React from 'react'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {registerExternalResetter} from '@/util/zustand'

// What a mounted conversation screen is told about its own conversation.
export type ThreadNotification =
  | {type: 'incomingMessage'; incomingMessage: T.RPCChat.IncomingMessage}
  | {type: 'messagesUpdated'; messagesUpdated: T.RPCChat.MessagesUpdated}
  // carries every record; the thread applies the ones for its conversation
  | {type: 'failedMessage'; failedMessage: T.RPCChat.FailedMessageInfo}
  | {type: 'reactionUpdate'; reactionUpdate: T.RPCChat.ReactionUpdateNotif}
  | {type: 'expunge'; expunge: T.RPCChat.ExpungeInfo}
  | {type: 'ephemeralPurge'; ephemeralPurge: T.RPCChat.EphemeralPurgeNotifInfo}
  | {type: 'requestInfo'; info: T.RPCChat.UIRequestInfo; msgID: number}
  | {type: 'paymentInfo'; info: T.RPCChat.UIPaymentInfo; msgID: number}
  | {type: 'promptUnfurl'; domain: string; msgID: number}
  | {type: 'coinFlipStatuses'; statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>}
  | {type: 'typing'; typers: ReadonlyArray<T.RPCChat.TyperInfo> | null | undefined}
  | {type: 'attachmentDownloadProgress'; bytesComplete: number; bytesTotal: number; msgID: number}
  | {type: 'attachmentDownloadComplete'; msgID: number}
  // no bytes: the upload just started
  | {type: 'attachmentUploadProgress'; bytesComplete?: number; bytesTotal?: number; outboxID: Uint8Array}
  | {
      type: 'commandStatus'
      actions: ReadonlyArray<T.RPCChat.UICommandStatusActionTyp> | null | undefined
      displayText: string
      displayType: T.RPCChat.UICommandStatusDisplayTyp
    }
  | {type: 'commandMarkdown'; md: T.RPCChat.UICommandMarkdown | null | undefined}
  | {type: 'giphyToggleResultWindow'; clearInput: boolean; show: boolean}
  | {type: 'giphySearchResults'; results: T.RPCChat.GiphySearchResults}
  | {type: 'botCommandsUpdateStatus'; status: T.RPCChat.UIBotCommandsUpdateStatus}

// What a mounted reader of a conversation is told to reload.
export type ReloadTrigger =
  // the conversation's meta or participants may have changed
  | {type: 'metadata'}
  // messages in the conversation changed
  | {type: 'messages'}
  | {type: 'attachmentDownloaded'; messageID: T.Chat.MessageID}
  // the service says the thread is out of date
  | {type: 'staleThread'}

export type Delivery<N> = {conversationIDKey: T.Chat.ConversationIDKey; notification: N}
type Handler<N> = (notification: N) => void
type Registry<N> = Map<T.Chat.ConversationIDKey, Set<Handler<N>>>

declare global {
  var __hmr_chatThreadHandlers: Registry<ThreadNotification> | undefined
  var __hmr_chatReloadHandlers: Registry<ReloadTrigger> | undefined
}

const threadHandlers: Registry<ThreadNotification> = __DEV__
  ? (globalThis.__hmr_chatThreadHandlers ??= new Map<T.Chat.ConversationIDKey, Set<Handler<ThreadNotification>>>())
  : new Map<T.Chat.ConversationIDKey, Set<Handler<ThreadNotification>>>()
const reloadHandlers: Registry<ReloadTrigger> = __DEV__
  ? (globalThis.__hmr_chatReloadHandlers ??= new Map<T.Chat.ConversationIDKey, Set<Handler<ReloadTrigger>>>())
  : new Map<T.Chat.ConversationIDKey, Set<Handler<ReloadTrigger>>>()

const register = <N,>(registry: Registry<N>, id: T.Chat.ConversationIDKey, handler: Handler<N>) => {
  let handlers = registry.get(id)
  if (!handlers) {
    handlers = new Set()
    registry.set(id, handlers)
  }
  const set = handlers
  // each registration is its own entry, so registering one function twice delivers twice and
  // each unregister removes only its own
  const entry: Handler<N> = notification => handler(notification)
  set.add(entry)
  return () => {
    set.delete(entry)
    // a reset replaces the map, so only drop the entry if it is still this set
    if (!set.size && registry.get(id) === set) {
      registry.delete(id)
    }
  }
}

export const registerThreadHandler = (id: T.Chat.ConversationIDKey, handler: Handler<ThreadNotification>) =>
  register(threadHandlers, id, handler)

export const registerReloadHandler = (id: T.Chat.ConversationIDKey, handler: Handler<ReloadTrigger>) =>
  register(reloadHandlers, id, handler)

export const useThreadNotifications = (id: T.Chat.ConversationIDKey, handler: Handler<ThreadNotification>) => {
  const onNotification = React.useEffectEvent(handler)
  React.useEffect(() => registerThreadHandler(id, n => onNotification(n)), [id])
}

export const useReloadTriggers = (id: T.Chat.ConversationIDKey, handler: Handler<ReloadTrigger>) => {
  const onTrigger = React.useEffectEvent(handler)
  React.useEffect(() => registerReloadHandler(id, r => onTrigger(r)), [id])
}

// Logout resets every store and, with them, drops every registration; a screen that stays
// mounted across it hears nothing until it remounts.
const clearRegistrations = () => {
  threadHandlers.clear()
  reloadHandlers.clear()
}
registerExternalResetter('chat-notification-registry', clearRegistrations)

const deliver = <N,>(registry: Registry<N>, deliveries: ReadonlyArray<Delivery<N>>, type: string) => {
  for (const {conversationIDKey, notification} of deliveries) {
    const handlers = registry.get(conversationIDKey)
    if (!handlers?.size) {
      continue
    }
    for (const handler of [...handlers]) {
      try {
        handler(notification)
      } catch (error) {
        logger.error(`Error in chat notification handler for ${type}`, error)
      }
    }
  }
}

export const deliverThreadNotifications = (
  deliveries: ReadonlyArray<Delivery<ThreadNotification>>,
  type: string
) => deliver(threadHandlers, deliveries, type)

export const deliverReloadTriggers = (deliveries: ReadonlyArray<Delivery<ReloadTrigger>>, type: string) =>
  deliver(reloadHandlers, deliveries, type)
