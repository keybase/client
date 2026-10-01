import * as C from '@/constants'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as T from '@/constants/types'
import {ensureConversationMetaLoaded, unboxRows, useInboxMetadataState} from '@/chat/inbox/metadata'
import {messagesTriggerConcerns, useReloadTriggers} from '@/chat/notification-registry'
import {ignorePromise} from '@/constants/utils'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import logger from '@/logger'
import {getChatRpc} from './chat-rpc'
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

// Which messages to load: those centered on a message, or the conversation's newest.
type MessagesRequest = {around: T.Chat.MessageID; num: number} | {newest: number}

// Each pass's thread JSON is handed to onThread. Nothing is asked for an invalid conversation or a
// pivot that is not a message id (0, or the -1 of a placeholder meta). Rejects when the load does.
const loadThreadPasses = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  request: MessagesRequest,
  onThread: (thread: string) => void
) => {
  if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
    return
  }
  if ('around' in request) {
    if (T.Chat.messageIDToNumber(request.around) <= 0) {
      return
    }
    await getChatRpc().loadThread({
      conversationIDKey,
      messageIDControl: {
        mode: T.RPCChat.MessageIDControlMode.centered,
        num: request.num,
        pivot: request.around,
      },
      onCachedThread: onThread,
      onFullThread: onThread,
      pagination: null,
    })
  } else {
    await getChatRpc().loadThread({
      conversationIDKey,
      onCachedThread: onThread,
      onFullThread: onThread,
      pagination: {last: false, next: '', num: request.newest, previous: ''},
    })
  }
}

const loadConversationMessagesAroundMessageID = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  num = 20
) => {
  const messages = new Map<T.Chat.MessageID, T.Chat.Message>()
  await loadThreadPasses(conversationIDKey, {around: messageID, num}, thread => {
    parseThreadMessages(conversationIDKey, thread).forEach(message => {
      if (message.id) {
        messages.set(message.id, message)
      }
    })
  })
  return messages.size
    ? [...messages.values()].sort((l, r) => T.Chat.messageIDToNumber(l.id) - T.Chat.messageIDToNumber(r.id))
    : emptyMessages
}

const parseThreadMessageIDs = (thread: string) => {
  try {
    const parsed = JSON.parse(thread) as {messages?: ReadonlyArray<T.RPCChat.UIMessage> | null} | null
    return (parsed?.messages ?? []).map(Message.getMessageID)
  } catch {
    return []
  }
}

// The ids a load holds, across both passes, in no order. Every unboxed state counts, not only the
// ones that become thread rows. Rejects when the load does.
export const loadConversationMessageIDs = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  request: MessagesRequest
) => {
  const ids = new Set<T.Chat.MessageID>()
  await loadThreadPasses(conversationIDKey, request, thread => {
    parseThreadMessageIDs(thread).forEach(id => {
      if (id) {
        ids.add(id)
      }
    })
  })
  return [...ids]
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

