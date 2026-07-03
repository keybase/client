import * as C from '@/constants'
import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as T from '@/constants/types'
import {getInboxConversationMeta, unboxRows, useInboxMetadataState} from '@/chat/inbox/metadata'
import {useEngineActionListener} from '@/engine/action-listener'
import {ignorePromise} from '@/constants/utils'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {uint8ArrayToString} from '@/util/uint8array'
import logger from '@/logger'
import {loadThreadNonblock, markConversationRead} from './thread-rpc'
import {setConversationOrangeLine} from './orange-line-context'

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

const inboxUIItemConversationIDKey = (conv: T.RPCChat.InboxUIItem | null | undefined) =>
  conv ? T.Chat.stringToConversationIDKey(conv.convID) : T.Chat.noConversationIDKey

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

const useConversationMetadataReload = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const reload = React.useEffectEvent(() => {
    reloadConversationMetadata(conversationIDKey)
  })

  React.useEffect(() => {
    reloadConversationMetadata(conversationIDKey)
  }, [conversationIDKey])

  useEngineActionListener('chat.1.NotifyChat.NewChatActivity', action => {
    if (activityConversationIDKey(action.payload.params.activity) === conversationIDKey) {
      reload()
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatConvUpdate', action => {
    if (inboxUIItemConversationIDKey(action.payload.params.conv) === conversationIDKey) {
      reload()
    }
  })
  useEngineActionListener('chat.1.chatUi.chatInboxFailed', action => {
    if (T.Chat.conversationIDToKey(action.payload.params.convID) === conversationIDKey) {
      reload()
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatSetConvSettings', action => {
    if (T.Chat.conversationIDToKey(action.payload.params.convID) === conversationIDKey) {
      reload()
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatSetConvRetention', action => {
    if (T.Chat.conversationIDToKey(action.payload.params.convID) === conversationIDKey) {
      reload()
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatSetTeamRetention', action => {
    const hasConversation = (action.payload.params.convs ?? []).some(
      conv => inboxUIItemConversationIDKey(conv) === conversationIDKey
    )
    if (hasConversation) {
      reload()
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatParticipantsInfo', action => {
    if (action.payload.params.participants?.[conversationIDKey]) {
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

const getExplodingModeFromGregorItems = (
  conversationIDKey: T.Chat.ConversationIDKey,
  items: ReadonlyArray<{item: T.RPCGen.Gregor1.Item}>
) => {
  const explodingItems = items.filter(i => i.item.category.startsWith(Common.explodingModeGregorKeyPrefix))
  if (!explodingItems.length) {
    return 0
  }
  const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
  const item = explodingItems.find(i => i.item.category === category)
  if (!item) {
    return undefined
  }
  const secondsString = uint8ArrayToString(item.item.body)
  const seconds = parseInt(secondsString, 10)
  if (isNaN(seconds)) {
    logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
    return undefined
  }
  return seconds
}

export const useConversationExplodingMode = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useConfigState(state => getExplodingModeFromGregorItems(conversationIDKey, state.gregorPushState) ?? 0)

export const getConversationClientPrev = (conversationIDKey: T.Chat.ConversationIDKey) =>
  getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID ?? T.Chat.numberToMessageID(0)

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
  await loadThreadNonblock({
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

  useEngineActionListener('chat.1.NotifyChat.NewChatActivity', action => {
    const activity = action.payload.params.activity
    if (activityConversationIDKey(activity) !== conversationIDKey) {
      return
    }
    switch (activity.activityType) {
      case T.RPCChat.ChatActivityType.incomingMessage:
      case T.RPCChat.ChatActivityType.messagesUpdated:
      case T.RPCChat.ChatActivityType.reactionUpdate:
      case T.RPCChat.ChatActivityType.expunge:
      case T.RPCChat.ChatActivityType.ephemeralPurge:
        reload()
        break
      default:
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentDownloadComplete', action => {
    const {convID, msgID} = action.payload.params
    if (
      T.Chat.conversationIDToKey(convID) === conversationIDKey &&
      T.Chat.numberToMessageID(msgID) === messageID
    ) {
      reload()
    }
  })

  return loaded?.conversationIDKey === conversationIDKey && loaded.messageID === messageID
    ? loaded.messages
    : emptyMessages
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
    await markConversationRead({conversationIDKey, forceUnread: true, msgID})
  }
  ignorePromise(f())
}

export const useConversationMarkAsUnread = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const markAsUnread = (readMsgID?: T.Chat.MessageID | false) => {
    markConversationAsUnread(conversationIDKey, readMsgID)
  }
  return markAsUnread
}
