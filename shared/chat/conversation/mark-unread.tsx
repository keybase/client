// Marking a conversation unread from one message on, for every caller: the thread's message popup
// (through the thread store), the message popup outside a thread, the info panel and the inbox
// swipe.
//
// The rule: the unread line is the message given, else the conversation's newest visible message,
// else (no meta yet) the newest message loaded.
// Everything strictly older than the line is marked read, which the service takes as a read
// position: the newest message id strictly older than the line. A thread's window answers when it
// holds the line and a message below it; otherwise the service is asked for the messages around
// the line. With no older message known (the line is the first message, or the load failed)
// nothing is marked, since marking the line itself read would leave it read. The orange line is
// drawn only once the service has taken the new read position.
import * as T from '@/constants/types'
import logger from '@/logger'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import {getChatRpc, type ChatThreadRpc} from './chat-rpc'
import {loadConversationMessageIDs} from './data-hooks'
import {setConversationOrangeLine} from './orange-line-context'

type ThreadWindow = {
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
}

// What a mounted thread lends: its window, its rpc, and whether its account has left.
export type MarkUnreadThread = {
  getWindow: () => ThreadWindow
  isRetired: () => boolean
  rpc: ChatThreadRpc
}

const validID = (id?: T.Chat.MessageID) => (id && T.Chat.messageIDToNumber(id) > 0 ? id : undefined)

// The newest id, or with a line the newest strictly older than it.
const newestID = (ids: Iterable<T.Chat.MessageID | null | undefined>, line?: T.Chat.MessageID) => {
  let newest: T.Chat.MessageID | undefined
  for (const id of ids) {
    if (id && (!line || id < line) && (!newest || id > newest)) {
      newest = id
    }
  }
  return newest
}

// Undefined when the window cannot say: it does not reach the line, or holds nothing below it.
const idBeforeLineInWindow = (window: ThreadWindow, line: T.Chat.MessageID) => {
  const ids = (window.messageOrdinals ?? []).map(o => window.messageMap.get(o)?.id)
  return ids.some(id => !!id && id >= line) ? newestID(ids, line) : undefined
}

// The line's row in the window (a message this client sent keeps the ordinal it was placed at),
// else the ordinal its id gives.
const lineOrdinal = (line: T.Chat.MessageID, window?: ThreadWindow) =>
  window?.messageOrdinals?.find(o => window.messageMap.get(o)?.id === line) ??
  T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(line))

// Never rejects: a failed load knows of no message.
const loadIDs = async (
  rpc: ChatThreadRpc,
  conversationIDKey: T.Chat.ConversationIDKey,
  request: Parameters<typeof loadConversationMessageIDs>[1]
) => {
  try {
    return await loadConversationMessageIDs(conversationIDKey, request, rpc)
  } catch {
    return []
  }
}

export const markConversationUnread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  readMsgID?: T.Chat.MessageID,
  thread?: MarkUnreadThread
) => {
  const f = async () => {
    if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
      return
    }
    if (!useConfigState.getState().loggedIn) {
      logger.info('mark unread bail on not logged in')
      return
    }
    const rpc = thread?.rpc ?? getChatRpc()
    // With no line known (no meta for the conversation yet, or a placeholder one) the newest
    // messages give both the line and the message before it.
    const knownLine =
      validID(readMsgID) ?? validID(getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID)
    const newest = knownLine ? undefined : await loadIDs(rpc, conversationIDKey, {newest: 2})
    const line = knownLine ?? newestID(newest ?? [])
    if (!line) {
      logger.info(`marking unread messages ${conversationIDKey} failed due to no line`)
      return
    }
    const msgID = newest
      ? newestID(newest, line)
      : ((thread && idBeforeLineInWindow(thread.getWindow(), line)) ??
        newestID(await loadIDs(rpc, conversationIDKey, {around: line, num: 3}), line))
    if (!msgID) {
      logger.info(`marking unread messages ${conversationIDKey} failed: nothing older than ${line}`)
      return
    }
    logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
    await rpc.markRead({conversationIDKey, forceUnread: true, msgID})
    if (thread?.isRetired()) {
      return
    }
    setConversationOrangeLine(conversationIDKey, lineOrdinal(line, thread?.getWindow()))
  }
  ignorePromise(f())
}
