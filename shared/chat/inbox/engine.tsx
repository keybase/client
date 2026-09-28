import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import * as TeamsUtil from '@/constants/teams'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {navigateToThread as routerNavigateToThread} from '@/constants/router'
import logger from '@/logger'
import {NotifyPopup} from '@/util/misc'
import {showMain} from '@/util/storeless-actions'
import {useShellState} from '@/stores/shell'
import {useUsersState} from '@/stores/users'
import {updateInboxTyping} from '@/chat/inbox/typing-state'
import {
  forceUnboxRowsForService,
  getInboxConversationMeta,
  metaReceivedError,
  metasReceived,
  syncInboxParticipantsFromParticipantMap,
  updateInboxConversationMeta,
  unboxRows,
} from './metadata'

// what the caller applies once this returns: an inbox item to hydrate, the daemon's new reacjis
type ConvoEngineIncomingResult = {
  inboxUIItem?: T.RPCChat.InboxUIItem
  userReacjis?: T.RPCGen.UserReacjis
}

type NewChatActivity =
  EngineGen.EngineAction<'chat.1.NotifyChat.NewChatActivity'>['payload']['params']['activity']
type ThreadStaleUpdates =
  EngineGen.EngineAction<'chat.1.NotifyChat.ChatThreadsStale'>['payload']['params']['updates']

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
    forceUnboxRowsForService(conversationIDKeys)
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
    // No navigateToInbox here: its deferred navUpToScreen('chatRoot') pops to chatRoot with no
    // params, wiping the conversationIDKey we just set and auto-selecting the first inbox row.
    // navigateToThread alone switches to the chat tab and selects the conversation.
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
      maybeShowIncomingMessageDesktopNotification(incomingMessage)
      return {inboxUIItem: incomingMessage.conv ?? undefined}
    }
    case T.RPCChat.ChatActivityType.setStatus:
      return {inboxUIItem: activity.setStatus.conv ?? undefined}
    case T.RPCChat.ChatActivityType.readMessage: {
      const {readMessage} = activity
      if (!readMessage.conv) {
        forceUnboxRowsForService([T.Chat.conversationIDToKey(readMessage.convID)])
      }
      return {inboxUIItem: readMessage.conv ?? undefined}
    }
    case T.RPCChat.ChatActivityType.newConversation:
      return {inboxUIItem: activity.newConversation.conv ?? undefined}
    case T.RPCChat.ChatActivityType.failedMessage: {
      const {failedMessage} = activity
      const inboxUIItem = failedMessage.conv ?? undefined
      const {outboxRecords} = failedMessage
      if (!outboxRecords) {
        return {inboxUIItem}
      }
      for (const outboxRecord of outboxRecords) {
        const s = outboxRecord.state
        if (s.state !== T.RPCChat.OutboxStateType.error) {
          return {inboxUIItem}
        }
        const {error} = s

        if (error.typ === T.RPCChat.OutboxErrorType.identify) {
          const match = error.message.match(/"(.*)"/)
          const tempForceRedBox = match?.[1]
          if (tempForceRedBox) {
            useUsersState.getState().dispatch.updates([{info: {broken: true}, name: tempForceRedBox}])
          }
        }
      }
      return {inboxUIItem}
    }
    case T.RPCChat.ChatActivityType.membersUpdate:
      forceUnboxRowsForService([T.Chat.conversationIDToKey(activity.membersUpdate.convID)])
      return {}
    case T.RPCChat.ChatActivityType.setAppNotificationSettings: {
      const {setAppNotificationSettings} = activity
      const conversationIDKey = T.Chat.conversationIDToKey(setAppNotificationSettings.convID)
      updateInboxConversationMeta(
        conversationIDKey,
        Meta.parseNotificationSettings(setAppNotificationSettings.settings)
      )
      return {}
    }
    case T.RPCChat.ChatActivityType.reactionUpdate: {
      const {reactionUpdate} = activity
      const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
      if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
        logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
        return {}
      }
      logger.info(
        `Got ${reactionUpdate.reactionUpdates.length} reaction updates for convID=${conversationIDKey}`
      )
      return {userReacjis: reactionUpdate.userReacjis}
    }
    default:
      return {}
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
      return {}
    }
    case 'chat.1.chatUi.chatInboxFailed': {
      const {convID, error} = action.payload.params
      metaReceivedError(T.Chat.conversationIDToKey(convID), error)
      return {}
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
      return {}
    }
    case 'chat.1.NotifyChat.ChatParticipantsInfo': {
      syncInboxParticipantsFromParticipantMap(action.payload.params.participants)
      return {}
    }
    case 'chat.1.NotifyChat.ChatThreadsStale':
      onChatThreadsStale(action.payload.params.updates)
      return {}
    case 'chat.1.NotifyChat.ChatSubteamRename':
      forceUnboxRowsForService(
        (action.payload.params.convs ?? []).map(c => T.Chat.stringToConversationIDKey(c.convID))
      )
      return {}
    case 'chat.1.NotifyChat.ChatTLFFinalize':
      unboxRows([T.Chat.conversationIDToKey(action.payload.params.convID)])
      return {}
    case 'chat.1.NotifyChat.NewChatActivity':
      return onNewChatActivity(action.payload.params.activity)
    case 'chat.1.NotifyChat.ChatTypingUpdate': {
      updateInboxTyping(action.payload.params.typingUpdates)
      return {}
    }
    case 'chat.1.NotifyChat.ChatSetConvRetention': {
      const {conv, convID} = action.payload.params
      if (!conv) {
        logger.warn('onChatSetConvRetention: no conv given')
        return {}
      }
      const meta = Meta.inboxUIItemToConversationMeta(conv)
      if (!meta) {
        logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
        return {}
      }
      metasReceived([meta])
      return {}
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
        return {}
      }
      metasReceived(metas)
      return {}
    }
    default:
      return {}
  }
}
