// What a chat notification does to the inbox, for the notifications that need more than one call.
// The notification router (chat/notification-router.tsx) decodes each notification and calls these.
import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {navigateToThread as routerNavigateToThread} from '@/constants/router'
import logger from '@/logger'
import {NotifyPopup} from '@/util/misc'
import {showMain} from '@/util/storeless-actions'
import {useDaemonState} from '@/stores/daemon'
import {useShellState} from '@/stores/shell'
import {useUsersState} from '@/stores/users'
import {
  forceUnboxRowsForService,
  getInboxConversationMeta,
  metasReceived,
  updateInboxConversationMeta,
} from './metadata'

type Params<Type extends EngineGen.ActionType> = EngineGen.EngineAction<Type>['payload']['params']

export const onChatThreadsStale = (updates: Params<'chat.1.NotifyChat.ChatThreadsStale'>['updates']) => {
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

export const maybeShowIncomingMessageDesktopNotification = (incomingMessage: T.RPCChat.IncomingMessage) => {
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

// Marks each user an identify failure names as broken.
export const markIdentifyFailures = (outboxRecords: T.RPCChat.FailedMessageInfo['outboxRecords']) => {
  for (const outboxRecord of outboxRecords ?? []) {
    const s = outboxRecord.state
    if (s.state !== T.RPCChat.OutboxStateType.error) {
      continue
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
}

export const onReactionUpdate = (reactionUpdate: T.RPCChat.ReactionUpdateNotif) => {
  const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
  if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
    logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
    return
  }
  logger.info(`Got ${reactionUpdate.reactionUpdates.length} reaction updates for convID=${conversationIDKey}`)
  useDaemonState.getState().dispatch.updateUserReacjis(reactionUpdate.userReacjis)
}

export const onConvUpdate = (conv: T.RPCChat.InboxUIItem | null | undefined) => {
  if (conv) {
    const meta = Meta.inboxUIItemToConversationMeta(conv)
    if (meta) {
      metasReceived([meta])
    }
  }
}

// A cleared minimum writer role is a change too: the conversation's settings are applied whatever
// they are.
export const onSetConvSettings = ({conv, convID}: Params<'chat.1.NotifyChat.ChatSetConvSettings'>) => {
  if (!conv) {
    logger.warn('onChatSetConvSettings: no conv given')
    return
  }
  updateInboxConversationMeta(T.Chat.conversationIDToKey(convID), Meta.convSettingsToMeta(conv.convSettings))
}

export const onSetConvRetention = ({conv, convID}: Params<'chat.1.NotifyChat.ChatSetConvRetention'>) => {
  if (!conv) {
    logger.warn('onChatSetConvRetention: no conv given')
    return
  }
  const meta = Meta.inboxUIItemToConversationMeta(conv)
  if (!meta) {
    logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
    return
  }
  metasReceived([meta])
}

export const onSetTeamRetention = (convs: Params<'chat.1.NotifyChat.ChatSetTeamRetention'>['convs']) => {
  const metas = (convs ?? []).reduce<Array<T.Chat.ConversationMeta>>((l, c) => {
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
    return
  }
  metasReceived(metas)
}
