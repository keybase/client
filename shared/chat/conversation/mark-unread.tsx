// Marking a conversation unread from one message on, for every caller: the thread's message popup
// (through the thread store), the message popup outside a thread, the info panel and the inbox
// swipe.
//
// The rule: the unread line is the message given, else the conversation's newest visible message.
// Everything strictly older than the line is marked read, which the service takes as a read
// position: the newest message id strictly older than the line. A thread's window answers when it
// holds the line and a message below it; otherwise the service is asked for the messages around
// the line. With no older message known (the line is the first message, or the load failed)
// nothing is marked, since marking the line itself read would leave it read.
import * as T from '@/constants/types'
import logger from '@/logger'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import {getChatRpc} from './chat-rpc'
import {loadConversationMessageIDsAroundMessageID} from './data-hooks'
import {setConversationOrangeLine} from './orange-line-context'

type ThreadWindow = {
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
}

// What a mounted thread lends: its window, and whether its account has left. A thread draws its
// own orange line, at the row's ordinal, so none is drawn for it here.
export type MarkUnreadThread = {
  getWindow: () => ThreadWindow
  isRetired: () => boolean
}

const newestIDBefore = (ids: Iterable<T.Chat.MessageID | null | undefined>, line: T.Chat.MessageID) => {
  let before: T.Chat.MessageID | undefined
  for (const id of ids) {
    if (id && id < line && (!before || id > before)) {
      before = id
    }
  }
  return before
}

// Undefined when the window cannot say: it does not reach the line, or holds nothing below it.
const idBeforeLineInWindow = (window: ThreadWindow, line: T.Chat.MessageID) => {
  const ids = (window.messageOrdinals ?? []).map(o => window.messageMap.get(o)?.id)
  return ids.some(id => !!id && id >= line) ? newestIDBefore(ids, line) : undefined
}

// Never rejects: a failed load knows of nothing older.
const loadIDBeforeLine = async (conversationIDKey: T.Chat.ConversationIDKey, line: T.Chat.MessageID) => {
  try {
    return newestIDBefore(await loadConversationMessageIDsAroundMessageID(conversationIDKey, line, 3), line)
  } catch {
    return undefined
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
    const line = readMsgID || getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID
    if (!line) {
      logger.info(`marking unread messages ${conversationIDKey} failed due to no line`)
      return
    }
    if (!thread) {
      setConversationOrangeLine(conversationIDKey, T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(line)))
    }
    const msgID =
      (thread && idBeforeLineInWindow(thread.getWindow(), line)) ??
      (await loadIDBeforeLine(conversationIDKey, line))
    if (thread?.isRetired()) {
      return
    }
    if (!msgID) {
      logger.info(`marking unread messages ${conversationIDKey} failed: nothing older than ${line}`)
      return
    }
    logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
    await getChatRpc().markRead({conversationIDKey, forceUnread: true, msgID})
  }
  ignorePromise(f())
}
