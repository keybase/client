// Where a mounted conversation screen registers to hear about its own conversation. The chat
// notification router (notification-router.tsx) is the only caller of the deliver functions:
// it runs every thread handler a notification concerns, then every reload handler.
//
// Screens register from a passive effect, so a screen React has hidden with <Activity> (which
// unmounts passive effects) is unregistered while hidden and misses what arrives meanwhile.
//
// Each registration names the account it was made for, and hears only while that account is
// signed in. Two accounts in one team share its channels' conversation ids, and an account switch
// resets the stores while keeping the logged-in screens mounted, so a screen built for the account
// switched away from must not be handed the new account's notifications. A store reset leaves
// registrations alone: they belong to mounted screens, which unregister themselves.
//
// Keep this a leaf. The router's inbox stage imports reach constants/router, whose route table
// imports these screens, so a screen importing the router would close a require cycle.
import * as React from 'react'
import type * as T from '@/constants/types'
import logger from '@/logger'

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
  // messages in the conversation changed: those listed, and with upTo every message below it
  | {type: 'messages'; messageIDs: ReadonlyArray<T.Chat.MessageID>; upTo?: T.Chat.MessageID}
  | {type: 'attachmentDownloaded'; messageID: T.Chat.MessageID}
  // the service says the thread is out of date
  | {type: 'staleThread'}

export const messagesTriggerConcerns = (
  trigger: Extract<ReloadTrigger, {type: 'messages'}>,
  messageID: T.Chat.MessageID
) => trigger.messageIDs.includes(messageID) || (trigger.upTo !== undefined && messageID < trigger.upTo)

export type Delivery<N> = {conversationIDKey: T.Chat.ConversationIDKey; notification: N}
// One notification for every conversation in a set that can name far more conversations than are
// mounted (a team's channels, an inbox sync), so it is matched against the registrations instead.
export type FanOut<N> = {conversationIDKeys: ReadonlySet<T.Chat.ConversationIDKey>; notification: N}
type Handler<N> = (notification: N) => void
// uid undefined: hears whichever account is signed in
type Entry<N> = {handler: Handler<N>; uid: string | undefined}
type Registry<N> = Map<T.Chat.ConversationIDKey, Set<Entry<N>>>

declare global {
  var __hmr_chatThreadHandlers: Registry<ThreadNotification> | undefined
  var __hmr_chatReloadHandlers: Registry<ReloadTrigger> | undefined
}

const threadHandlers: Registry<ThreadNotification> = __DEV__
  ? (globalThis.__hmr_chatThreadHandlers ??= new Map<T.Chat.ConversationIDKey, Set<Entry<ThreadNotification>>>())
  : new Map<T.Chat.ConversationIDKey, Set<Entry<ThreadNotification>>>()
const reloadHandlers: Registry<ReloadTrigger> = __DEV__
  ? (globalThis.__hmr_chatReloadHandlers ??= new Map<T.Chat.ConversationIDKey, Set<Entry<ReloadTrigger>>>())
  : new Map<T.Chat.ConversationIDKey, Set<Entry<ReloadTrigger>>>()

const register = <N,>(
  registry: Registry<N>,
  id: T.Chat.ConversationIDKey,
  uid: string | undefined,
  handler: Handler<N>
) => {
  let entries = registry.get(id)
  if (!entries) {
    entries = new Set()
    registry.set(id, entries)
  }
  const set = entries
  // each registration is its own entry, so registering one function twice delivers twice and
  // each unregister removes only its own
  const entry: Entry<N> = {handler, uid}
  set.add(entry)
  return () => {
    set.delete(entry)
    // a repeated unregister must not drop a set registered since this one emptied
    if (!set.size && registry.get(id) === set) {
      registry.delete(id)
    }
  }
}

// uid: the account the screen's thread was built for
export const registerThreadHandler = (
  id: T.Chat.ConversationIDKey,
  uid: string,
  handler: Handler<ThreadNotification>
) => register(threadHandlers, id, uid, handler)

// uid: the account the reader's data belongs to, or undefined for a reader that loads for whichever
// account is signed in
export const registerReloadHandler = (
  id: T.Chat.ConversationIDKey,
  uid: string | undefined,
  handler: Handler<ReloadTrigger>
) => register(reloadHandlers, id, uid, handler)

// The account the thread below was built for; the thread provider sets it.
export const ConversationThreadUidContext = React.createContext<string | undefined>(undefined)
ConversationThreadUidContext.displayName = 'ConversationThreadUidContext'

export const useConversationThreadUid = () => {
  const uid = React.useContext(ConversationThreadUidContext)
  if (uid === undefined) {
    throw new Error('Missing ConversationThreadProvider uid in the tree')
  }
  return uid
}

// For a screen inside a thread: hears while the thread's account is signed in.
export const useThreadNotifications = (id: T.Chat.ConversationIDKey, handler: Handler<ThreadNotification>) => {
  const uid = useConversationThreadUid()
  const onNotification = React.useEffectEvent(handler)
  React.useEffect(() => registerThreadHandler(id, uid, n => onNotification(n)), [id, uid])
}

const useReloadRegistration = (
  id: T.Chat.ConversationIDKey,
  uid: string | undefined,
  handler: Handler<ReloadTrigger>
) => {
  const onTrigger = React.useEffectEvent(handler)
  React.useEffect(() => registerReloadHandler(id, uid, r => onTrigger(r)), [id, uid])
}

// For a screen inside a thread: hears while the thread's account is signed in.
export const useReloadTriggers = (id: T.Chat.ConversationIDKey, handler: Handler<ReloadTrigger>) =>
  useReloadRegistration(id, useConversationThreadUid(), handler)

// For a reader that loads for whichever account is signed in (the conversation's meta, a message
// shown outside its thread), inside a thread or not.
export const useSignedInAccountReloadTriggers = (
  id: T.Chat.ConversationIDKey,
  handler: Handler<ReloadTrigger>
) => useReloadRegistration(id, undefined, handler)

// uid: the account signed in now
const runHandlers = <N,>(entries: ReadonlySet<Entry<N>>, notification: N, type: string, uid: string) => {
  for (const entry of [...entries]) {
    if (entry.uid !== undefined && entry.uid !== uid) {
      continue
    }
    try {
      entry.handler(notification)
    } catch (error) {
      logger.error(`Error in chat notification handler for ${type}`, error)
    }
  }
}

const deliver = <N,>(
  registry: Registry<N>,
  deliveries: ReadonlyArray<Delivery<N>>,
  type: string,
  uid: string
) => {
  for (const {conversationIDKey, notification} of deliveries) {
    const entries = registry.get(conversationIDKey)
    if (entries?.size) {
      runHandlers(entries, notification, type, uid)
    }
  }
}

// Walks whichever is smaller, the named conversations or the registrations, and runs only the
// matched entries' handlers.
const deliverToEach = <N,>(
  registry: Registry<N>,
  {conversationIDKeys, notification}: FanOut<N>,
  type: string,
  uid: string
) => {
  const matched: Array<ReadonlySet<Entry<N>>> = []
  if (conversationIDKeys.size < registry.size) {
    for (const conversationIDKey of conversationIDKeys) {
      const entries = registry.get(conversationIDKey)
      if (entries) {
        matched.push(entries)
      }
    }
  } else {
    for (const [conversationIDKey, entries] of registry) {
      if (conversationIDKeys.has(conversationIDKey)) {
        matched.push(entries)
      }
    }
  }
  for (const entries of matched) {
    runHandlers(entries, notification, type, uid)
  }
}

export const hasThreadHandlers = () => threadHandlers.size > 0
export const hasReloadHandlers = () => reloadHandlers.size > 0

export const deliverThreadNotifications = (
  deliveries: ReadonlyArray<Delivery<ThreadNotification>>,
  type: string,
  uid: string
) => deliver(threadHandlers, deliveries, type, uid)

export const deliverReloadTriggers = (
  deliveries: ReadonlyArray<Delivery<ReloadTrigger>>,
  type: string,
  uid: string
) => deliver(reloadHandlers, deliveries, type, uid)

export const deliverReloadTriggerToEach = (fanOut: FanOut<ReloadTrigger>, type: string, uid: string) =>
  deliverToEach(reloadHandlers, fanOut, type, uid)
