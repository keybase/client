import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as TeamsUtil from '@/constants/teams'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {navigateToInbox, navigateToThread as routerNavigateToThread} from '@/constants/router'
import logger from '@/logger'
import {isMobile} from '@/constants/platform'
import {NotifyPopup} from '@/util/misc'
import {showMain} from '@/util/storeless-actions'
import {ignorePromise} from '@/constants/utils'
import {findLast} from '@/util/arrays'
import {useConfigState} from '@/stores/config'
import {useShellState} from '@/stores/shell'
import {useUsersState} from '@/stores/users'
import {updateInboxRowTyping} from '@/stores/inbox-rows'
import {
  deleteConversationThreadCacheSnapshot,
  getConversationThreadCacheSnapshot,
  putConversationThreadCacheSnapshot,
} from '@/chat/conversation/thread-cache'
import {updateReactionsInThreadState} from '@/chat/conversation/thread-message-state'
import {produce} from 'immer'
import {
  getInboxConversationMeta,
  metaReceivedError,
  metasReceived,
  syncInboxParticipantsFromParticipantMap,
  updateInboxConversationMeta,
  unboxRows,
} from './metadata'

type ConvoEngineIncomingResult = {
  handled: boolean
  inboxUIItem?: T.RPCChat.InboxUIItem
  userReacjis?: T.RPCGen.UserReacjis
}

type NewChatActivity =
  EngineGen.EngineAction<'chat.1.NotifyChat.NewChatActivity'>['payload']['params']['activity']
type ThreadStaleUpdates =
  EngineGen.EngineAction<'chat.1.NotifyChat.ChatThreadsStale'>['payload']['params']['updates']

const handledConvoEngineIncoming = (result: Omit<ConvoEngineIncomingResult, 'handled'> = {}) => ({
  ...result,
  handled: true,
})

const applyReactionUpdateToCachedThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  reactionUpdate: T.RPCChat.ReactionUpdateNotif
) => {
  const snapshot = getConversationThreadCacheSnapshot(conversationIDKey)
  if (!snapshot || !reactionUpdate.reactionUpdates?.length) {
    return
  }
  const updates = reactionUpdate.reactionUpdates.map(ru => ({
    reactions: Message.reactionMapToReactions(ru.reactions),
    targetMsgID: T.Chat.numberToMessageID(ru.targetMsgID),
  }))
  const missingTargetMsgIDs = new Array<T.Chat.MessageID>()
  const next = produce(snapshot, s => {
    missingTargetMsgIDs.push(...updateReactionsInThreadState(T.castDraft(s), updates))
  })
  for (const targetMsgID of missingTargetMsgIDs) {
    logger.info(
      `applyReactionUpdateToCachedThread: couldn't find target ordinal for targetMsgID=${targetMsgID} in convID=${conversationIDKey}`
    )
  }
  if (missingTargetMsgIDs.length) {
    deleteConversationThreadCacheSnapshot(conversationIDKey)
    return
  }
  putConversationThreadCacheSnapshot(conversationIDKey, next)
}

export const markThreadAsRead = (id: T.Chat.ConversationIDKey, force?: boolean) => {
  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      logger.info('mark read bail on not logged in')
      return
    }
    if (!T.Chat.isValidConversationIDKey(id)) {
      logger.info('mark read bail on no selected conversation')
      return
    }
    if (!force && !Common.isUserActivelyLookingAtThisThread(id)) {
      logger.info('mark read bail on not looking at this thread')
      return
    }
    const snapshot = getConversationThreadCacheSnapshot(id)
    if (snapshot?.moreToLoadForward) {
      logger.info('mark read bail on not containing latest message')
      return
    }
    const ordinal = findLast([...(snapshot?.messageOrdinals ?? [])], o => {
      const m = snapshot?.messageMap.get(o)
      return m ? !!m.id : false
    })
    const message = ordinal ? snapshot?.messageMap.get(ordinal) : undefined
    const readMsgID = message?.id
    const meta = snapshot?.meta.conversationIDKey === id ? snapshot.meta : getInboxConversationMeta(id)
    if (meta?.conversationIDKey === id && readMsgID === meta.readMsgID) {
      logger.info(`marking read messages is noop bail: ${id} ${readMsgID}`)
      return
    }
    logger.info(`marking read messages ${id} ${readMsgID}`)
    await T.RPCChat.localMarkAsReadLocalRpcPromise({
      conversationID: T.Chat.keyToConversationID(id),
      forceUnread: false,
      msgID: readMsgID,
    })
  }
  ignorePromise(f())
}

const onChatThreadsStale = (updates: ThreadStaleUpdates) => {
  const keys = ['clear', 'newactivity'] as const
  if (__DEV__) {
    if (keys.length * 2 !== Object.keys(T.RPCChat.StaleUpdateType).length) {
      throw new Error('onChatThreadsStale invalid enum')
    }
  }
  keys.forEach(key => {
    const conversationIDKeys = (updates ?? []).reduce<Array<T.Chat.ConversationIDKey>>((arr, u) => {
      const conversationIDKey = T.Chat.conversationIDToKey(u.convID)
      if (u.updateType === T.RPCChat.StaleUpdateType[key]) {
        arr.push(conversationIDKey)
      }
      return arr
    }, [])
    if (conversationIDKeys.length === 0) {
      return
    }
    logger.info(
      `onChatThreadsStale: dispatching thread reload actions for ${conversationIDKeys.length} convs of type ${key}`
    )
    unboxRows(conversationIDKeys, true)
    if (T.RPCChat.StaleUpdateType[key] === T.RPCChat.StaleUpdateType.clear) {
      conversationIDKeys.forEach(conversationIDKey => {
        deleteConversationThreadCacheSnapshot(conversationIDKey)
      })
    }
  })
}

const maybeShowIncomingMessageDesktopNotification = (incomingMessage: T.RPCChat.IncomingMessage) => {
  if (
    isMobile ||
    !incomingMessage.displayDesktopNotification ||
    !incomingMessage.desktopNotificationSnippet
  ) {
    return
  }

  const {message} = incomingMessage
  if (message.state !== T.RPCChat.MessageUnboxedState.valid) {
    return
  }

  const conversationIDKey = T.Chat.conversationIDToKey(incomingMessage.convID)
  let meta = getInboxConversationMeta(conversationIDKey)
  if (!meta && incomingMessage.conv) {
    meta = Meta.inboxUIItemToConversationMeta(incomingMessage.conv)
  }
  if (Common.isUserActivelyLookingAtThisThread(conversationIDKey) || meta?.isMuted) {
    logger.info('not sending notification')
    return
  }

  logger.info('sending chat notification')
  const {senderUsername} = message.valid
  let title = senderUsername
  if (meta?.teamType === 'small' || meta?.teamType === 'big') {
    title = meta.teamname || senderUsername
  }
  if (meta?.teamType === 'big') {
    title += `#${meta.channelname}`
  }
  const onClick = () => {
    showMain()
    navigateToInbox()
    routerNavigateToThread(conversationIDKey, 'desktopNotification')
  }
  const onClose = () => {}
  logger.info('invoking NotifyPopup for chat notification')
  const sound = useShellState.getState().notifySound
  const cleanBody = incomingMessage.desktopNotificationSnippet.replaceAll(/!>(.*?)<!/g, '•••')
  NotifyPopup(title, {body: cleanBody, sound}, -1, senderUsername, onClick, onClose)
}

const onNewChatActivity = (activity: NewChatActivity): ConvoEngineIncomingResult => {
  switch (activity.activityType) {
    case T.RPCChat.ChatActivityType.incomingMessage: {
      const {incomingMessage} = activity
      const conversationIDKey = T.Chat.conversationIDToKey(incomingMessage.convID)
      maybeShowIncomingMessageDesktopNotification(incomingMessage)
      deleteConversationThreadCacheSnapshot(conversationIDKey)
      return handledConvoEngineIncoming({inboxUIItem: incomingMessage.conv ?? undefined})
    }
    case T.RPCChat.ChatActivityType.setStatus:
      return handledConvoEngineIncoming({inboxUIItem: activity.setStatus.conv ?? undefined})
    case T.RPCChat.ChatActivityType.readMessage:
      return handledConvoEngineIncoming({inboxUIItem: activity.readMessage.conv ?? undefined})
    case T.RPCChat.ChatActivityType.newConversation:
      return handledConvoEngineIncoming({inboxUIItem: activity.newConversation.conv ?? undefined})
    case T.RPCChat.ChatActivityType.failedMessage: {
      const {failedMessage} = activity
      const inboxUIItem = failedMessage.conv ?? undefined
      const {outboxRecords} = failedMessage
      if (!outboxRecords) {
        return handledConvoEngineIncoming({inboxUIItem})
      }
      for (const outboxRecord of outboxRecords) {
        const s = outboxRecord.state
        if (s.state !== T.RPCChat.OutboxStateType.error) {
          return handledConvoEngineIncoming({inboxUIItem})
        }
        const {error} = s
        const conversationIDKey = T.Chat.conversationIDToKey(outboxRecord.convID)
        deleteConversationThreadCacheSnapshot(conversationIDKey)

        if (error.typ === T.RPCChat.OutboxErrorType.identify) {
          const match = error.message.match(/"(.*)"/)
          const tempForceRedBox = match?.[1]
          if (tempForceRedBox) {
            useUsersState.getState().dispatch.updates([{info: {broken: true}, name: tempForceRedBox}])
          }
        }
      }
      return handledConvoEngineIncoming({inboxUIItem})
    }
    case T.RPCChat.ChatActivityType.membersUpdate:
      unboxRows([T.Chat.conversationIDToKey(activity.membersUpdate.convID)], true)
      return handledConvoEngineIncoming()
    case T.RPCChat.ChatActivityType.setAppNotificationSettings: {
      const {setAppNotificationSettings} = activity
      const conversationIDKey = T.Chat.conversationIDToKey(setAppNotificationSettings.convID)
      updateInboxConversationMeta(
        conversationIDKey,
        Meta.parseNotificationSettings(setAppNotificationSettings.settings)
      )
      return handledConvoEngineIncoming()
    }
    case T.RPCChat.ChatActivityType.expunge: {
      const {expunge} = activity
      deleteConversationThreadCacheSnapshot(T.Chat.conversationIDToKey(expunge.convID))
      return handledConvoEngineIncoming()
    }
    case T.RPCChat.ChatActivityType.ephemeralPurge: {
      const {ephemeralPurge} = activity
      deleteConversationThreadCacheSnapshot(T.Chat.conversationIDToKey(ephemeralPurge.convID))
      return handledConvoEngineIncoming()
    }
    case T.RPCChat.ChatActivityType.reactionUpdate: {
      const {reactionUpdate} = activity
      const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
      if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
        logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
        return handledConvoEngineIncoming()
      }
      logger.info(
        `Got ${reactionUpdate.reactionUpdates.length} reaction updates for convID=${conversationIDKey}`
      )
      applyReactionUpdateToCachedThread(conversationIDKey, reactionUpdate)
      return handledConvoEngineIncoming({userReacjis: reactionUpdate.userReacjis})
    }
    case T.RPCChat.ChatActivityType.messagesUpdated: {
      const {messagesUpdated} = activity
      deleteConversationThreadCacheSnapshot(T.Chat.conversationIDToKey(messagesUpdated.convID))
      return handledConvoEngineIncoming()
    }
    default:
      return {handled: false}
  }
}

export const handleConvoEngineIncoming = (action: EngineGen.Actions): ConvoEngineIncomingResult => {
  switch (action.type) {
    case 'chat.1.NotifyChat.ChatConvUpdate': {
      const {conv} = action.payload.params
      if (conv) {
        const meta = Meta.inboxUIItemToConversationMeta(conv)
        if (meta) {
          metasReceived([meta])
        }
      }
      return handledConvoEngineIncoming()
    }
    case 'chat.1.chatUi.chatInboxFailed': {
      const {convID, error} = action.payload.params
      metaReceivedError(T.Chat.conversationIDToKey(convID), error)
      return handledConvoEngineIncoming()
    }
    case 'chat.1.NotifyChat.ChatSetConvSettings': {
      const conversationIDKey = T.Chat.conversationIDToKey(action.payload.params.convID)
      const conv = action.payload.params.conv
      const newRole = conv?.convSettings?.minWriterRoleInfo?.role
      const role = newRole && TeamsUtil.teamRoleByEnum[newRole]
      const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite || false
      if (role) {
        updateInboxConversationMeta(conversationIDKey, {cannotWrite, minWriterRole: role})
      }
      return handledConvoEngineIncoming()
    }
    case 'chat.1.NotifyChat.ChatAttachmentUploadStart':
    case 'chat.1.NotifyChat.ChatAttachmentDownloadProgress':
    case 'chat.1.NotifyChat.ChatAttachmentDownloadComplete':
    case 'chat.1.NotifyChat.ChatAttachmentUploadProgress': {
      deleteConversationThreadCacheSnapshot(T.Chat.conversationIDToKey(action.payload.params.convID))
      return handledConvoEngineIncoming()
    }
    case 'chat.1.NotifyChat.ChatPromptUnfurl':
    case 'chat.1.NotifyChat.ChatPaymentInfo':
    case 'chat.1.NotifyChat.ChatRequestInfo':
    case 'chat.1.chatUi.chatCoinFlipStatus':
      return handledConvoEngineIncoming()
    case 'chat.1.NotifyChat.ChatParticipantsInfo': {
      syncInboxParticipantsFromParticipantMap(action.payload.params.participants)
      return handledConvoEngineIncoming()
    }
    case 'chat.1.NotifyChat.ChatThreadsStale':
      onChatThreadsStale(action.payload.params.updates)
      return handledConvoEngineIncoming()
    case 'chat.1.NotifyChat.ChatSubteamRename':
      unboxRows(
        (action.payload.params.convs ?? []).map(c => T.Chat.stringToConversationIDKey(c.convID)),
        true
      )
      return handledConvoEngineIncoming()
    case 'chat.1.NotifyChat.ChatTLFFinalize':
      unboxRows([T.Chat.conversationIDToKey(action.payload.params.convID)])
      return handledConvoEngineIncoming()
    case 'chat.1.NotifyChat.NewChatActivity':
      return onNewChatActivity(action.payload.params.activity)
    case 'chat.1.NotifyChat.ChatTypingUpdate': {
      updateInboxRowTyping(action.payload.params.typingUpdates)
      return handledConvoEngineIncoming()
    }
    case 'chat.1.NotifyChat.ChatSetConvRetention': {
      const {conv, convID} = action.payload.params
      if (!conv) {
        logger.warn('onChatSetConvRetention: no conv given')
        return handledConvoEngineIncoming()
      }
      const meta = Meta.inboxUIItemToConversationMeta(conv)
      if (!meta) {
        logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
        return handledConvoEngineIncoming()
      }
      metasReceived([meta])
      return handledConvoEngineIncoming()
    }
    case 'chat.1.NotifyChat.ChatSetTeamRetention': {
      const metas = (action.payload.params.convs ?? []).reduce<Array<T.Chat.ConversationMeta>>((l, c) => {
        const meta = Meta.inboxUIItemToConversationMeta(c)
        if (meta) {
          l.push(meta)
        }
        return l
      }, [])
      if (metas.length === 0) {
        logger.error(
          'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
        )
        return handledConvoEngineIncoming()
      }
      metasReceived(metas)
      return handledConvoEngineIncoming()
    }
    default:
      return {handled: false}
  }
}
