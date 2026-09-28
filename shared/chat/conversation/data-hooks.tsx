import * as C from '@/constants'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as T from '@/constants/types'
import {
  ensureConversationMetaLoaded,
  getInboxConversationMeta,
  unboxRows,
  useInboxMetadataState,
} from '@/chat/inbox/metadata'
import {messagesTriggerConcerns, useReloadTriggers} from '@/chat/notification-registry'
import {ignorePromise} from '@/constants/utils'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import logger from '@/logger'
import {getChatRpc} from './chat-rpc'
import {setConversationOrangeLine} from './orange-line-context'
import {getExplodingModeFromGregorItems} from './thread-load'

const emptyConversationMeta = Meta.makeConversationMeta()
export const emptyParticipantInfo: T.Chat.ParticipantInfo = {
  all: [],
  contactName: new Map(),
  name: [],
}
const emptyMessages: ReadonlyArray<T.Chat.Message> = []

const reloadConversationMetadata = (conversationIDKey: T.Chat.ConversationIDKey) => {
  if (T.Chat.isValidConversationIDKey(conversationIDKey)) {
    unboxRows([conversationIDKey])
  }
}

// Arms the meta/participants reload listeners for a conversation. The conversation
// screen root (ConversationInner) owns this; narrow readers should use the reload-free
// selector hooks below instead of useConversationMetadata.
export const useConversationMetadataReload = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const reload = React.useEffectEvent(() => {
    reloadConversationMetadata(conversationIDKey)
  })

  // loggedIn is a dep so a conv opened before login (push-notification cold start) re-arms
  // the self-heal loop once the unbox can actually run.
  const loggedIn = useConfigState(s => s.loggedIn)
  React.useEffect(() => {
    if (loggedIn) {
      ensureConversationMetaLoaded(conversationIDKey)
    }
  }, [conversationIDKey, loggedIn])

  useReloadTriggers(conversationIDKey, trigger => {
    if (trigger.type === 'metadata') {
      reload()
    }
  })
}

export const useConversationMetadata = (conversationIDKey: T.Chat.ConversationIDKey) => {
  useConversationMetadataReload(conversationIDKey)
  const metadata = useInboxMetadataState(
    C.useShallow(state => ({
      meta: state.metas.get(conversationIDKey),
      participants: state.participants.get(conversationIDKey),
    }))
  )
  return {
    meta: metadata.meta ?? emptyConversationMeta,
    participants: metadata.participants ?? emptyParticipantInfo,
  }
}

export const useConversationMeta = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useConversationMetadata(conversationIDKey).meta

export const useConversationParticipants = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useConversationMetadata(conversationIDKey).participants

// Reload-free narrow reads. Unlike useConversationMetadata these neither subscribe to
// the whole meta/participants objects (whose identity changes on every send) nor arm
// a per-mount copy of the reload listeners. Wrap object results in C.useShallow.
export const useConversationMetaSelector = <TValue,>(
  conversationIDKey: T.Chat.ConversationIDKey,
  selector: (meta: T.Immutable<T.Chat.ConversationMeta>) => TValue
): TValue => useInboxMetadataState(s => selector(s.metas.get(conversationIDKey) ?? emptyConversationMeta))

export const useConversationParticipantsSelector = <TValue,>(
  conversationIDKey: T.Chat.ConversationIDKey,
  selector: (participants: T.Chat.ParticipantInfo) => TValue
): TValue =>
  useInboxMetadataState(s => selector(s.participants.get(conversationIDKey) ?? emptyParticipantInfo))

export const useConversationExplodingMode = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useConfigState(state => getExplodingModeFromGregorItems(conversationIDKey, state.gregorPushState) ?? 0)

const parseThreadMessages = (conversationIDKey: T.Chat.ConversationIDKey, thread: string) => {
  if (!thread) {
    return emptyMessages
  }
  const {username, deviceName} = useCurrentUserState.getState()
  let lastOrdinal = T.Chat.numberToOrdinal(0)
  const getLastOrdinal = () => lastOrdinal
  const {messages} = Message.parseUIMessagesJSON(
    conversationIDKey,
    thread,
    username,
    deviceName,
    getLastOrdinal,
    message => {
      if (T.Chat.ordinalToNumber(message.ordinal) > T.Chat.ordinalToNumber(lastOrdinal)) {
        lastOrdinal = message.ordinal
      }
    }
  )
  return messages
}

const loadConversationMessagesAroundMessageID = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  num = 20
) => {
  if (!T.Chat.isValidConversationIDKey(conversationIDKey) || !T.Chat.messageIDToNumber(messageID)) {
    return emptyMessages
  }

  const messages = new Map<T.Chat.MessageID, T.Chat.Message>()
  const onGotThread = (thread: string) => {
    parseThreadMessages(conversationIDKey, thread).forEach(message => {
      if (message.id) {
        messages.set(message.id, message)
      }
    })
  }
  await getChatRpc().loadThread({
    conversationIDKey,
    messageIDControl: {
      mode: T.RPCChat.MessageIDControlMode.centered,
      num,
      pivot: messageID,
    },
    onCachedThread: onGotThread,
    onFullThread: onGotThread,
    pagination: null,
  })

  return [...messages.values()].sort((l, r) => T.Chat.messageIDToNumber(l.id) - T.Chat.messageIDToNumber(r.id))
}

const useConversationMessagesAroundMessageID = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  num?: number
) => {
  const [loaded, setLoaded] = React.useState<{
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    messages: ReadonlyArray<T.Chat.Message>
  }>()
  const generationRef = React.useRef(0)
  const reload = React.useEffectEvent(() => {
    const generation = ++generationRef.current
    if (!T.Chat.isValidConversationIDKey(conversationIDKey) || !T.Chat.messageIDToNumber(messageID)) {
      setLoaded({conversationIDKey, messageID, messages: emptyMessages})
      return
    }
    const f = async () => {
      try {
        const messages = await loadConversationMessagesAroundMessageID(conversationIDKey, messageID, num)
        if (generationRef.current === generation) {
          setLoaded({conversationIDKey, messageID, messages})
        }
      } catch (error) {
        if (generationRef.current === generation) {
          logger.warn(`useConversationMessagesAroundMessageID: failed for ${conversationIDKey}: ${String(error)}`)
          setLoaded({conversationIDKey, messageID, messages: emptyMessages})
        }
      }
    }
    ignorePromise(f())
  })

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      reload()
    }, 0)
    return () => {
      clearTimeout(timeout)
      generationRef.current += 1
    }
  }, [conversationIDKey, messageID, num])

  const messages =
    loaded?.conversationIDKey === conversationIDKey && loaded.messageID === messageID
      ? loaded.messages
      : emptyMessages

  useReloadTriggers(conversationIDKey, trigger => {
    // the shown message renders the text of the message it replies to
    const shown = messages.find(message => message.id === messageID)
    const replyToID = shown?.type === 'text' ? shown.replyTo?.id : undefined
    if (
      (trigger.type === 'messages' &&
        (messagesTriggerConcerns(trigger, messageID) ||
          (!!replyToID && messagesTriggerConcerns(trigger, replyToID)))) ||
      (trigger.type === 'attachmentDownloaded' && trigger.messageID === messageID)
    ) {
      reload()
    }
  })

  return messages
}

export const useConversationMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID
) => {
  const messages = useConversationMessagesAroundMessageID(conversationIDKey, messageID)
  return messages.find(message => message.id === messageID)
}

export const markConversationAsUnread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  readMsgID?: T.Chat.MessageID | false
) => {
  if (readMsgID === false || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
    return
  }
  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      logger.info('mark unread bail on not logged in')
      return
    }

    const unreadLineID = readMsgID || getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID
    if (!unreadLineID) {
      logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
      return
    }
    setConversationOrangeLine(
      conversationIDKey,
      T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(unreadLineID))
    )

    let msgID = unreadLineID
    try {
      const messages = await loadConversationMessagesAroundMessageID(conversationIDKey, unreadLineID, 3)
      for (let idx = messages.length - 1; idx >= 0; --idx) {
        const message = messages[idx]
        if (message?.id && message.id < unreadLineID) {
          msgID = message.id
          break
        }
      }
    } catch {}

    logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
    await getChatRpc().markRead({conversationIDKey, forceUnread: true, msgID})
  }
  ignorePromise(f())
}

export const useConversationMarkAsUnread = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const markAsUnread = (readMsgID?: T.Chat.MessageID | false) => {
    markConversationAsUnread(conversationIDKey, readMsgID)
  }
  return markAsUnread
}
