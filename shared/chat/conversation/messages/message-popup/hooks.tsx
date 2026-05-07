import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as React from 'react'
import * as T from '@/constants/types'
import {copyToClipboard} from '@/util/storeless-actions'
import {
  deleteConversationMessage,
  pinConversationMessage,
  toggleConversationMessageReaction,
} from '../../message-actions'
import {formatTimeForPopup, formatTimeForRevoked} from '@/util/timestamp'
import {linkFromConvAndMessage} from '@/constants/deeplinks'
import {markConversationAsUnread} from '../../data-hooks'
import {showForwardMessagePicker} from '../../fwd-msg'
import {navToProfile, setThreadInputEditing, setThreadInputReplyTo} from '@/constants/router'
import {SetOrangeLineContext} from '../../orange-line-context'
import {useChatTeam, useChatTeamMembers} from '../../team-hooks'
import {useCurrentUserState} from '@/stores/current-user'
import {
  useConversationThreadID,
  useConversationThreadMessage,
  useConversationThreadMessageActions,
  useConversationThreadSelector,
  useConversationThreadSetMarkAsUnread,
} from '../../thread-context'
import ExplodingPopupHeader from './exploding-header'
import MessagePopupHeader from './header'
import ReactionItem from './reactionitem'

const emptyText = Chat.makeMessageText({})

const getConversationLabel = (
  participantInfo: T.Chat.ParticipantInfo,
  conv: T.Chat.ConversationMeta,
  alwaysIncludeChannelName: boolean
): string => {
  if (conv.teamType === 'big') {
    return conv.teamname + '#' + conv.channelname
  }
  if (conv.teamType === 'small') {
    return alwaysIncludeChannelName ? conv.teamname + '#' + conv.channelname : conv.teamname
  }
  return Chat.getRowParticipants(participantInfo, '').join(',')
}

type ItemActions = {
  deleteMessage: () => void
  markAsUnread: (id: T.Chat.MessageID) => void
  toggleReaction: (emoji: string) => void
}

const useItemsForMessage = (p: {
  actions: ItemActions
  conversationIDKey: T.Chat.ConversationIDKey
  message: T.Chat.Message
  meta: T.Chat.ConversationMeta
  onHidden: () => void
  participantInfo: T.Chat.ParticipantInfo
}) => {
  const {actions, conversationIDKey, message, meta, onHidden, participantInfo} = p
  const ordinal = message.ordinal
  const isAttach = message.type === 'attachment'
  const {author, id, deviceName, timestamp, deviceRevokedAt} = message
  const hasMessageID = !!T.Chat.messageIDToNumber(id)
  const {teamID, teamname} = meta
  const onReact = (emoji: string) => {
    actions.toggleReaction(emoji)
  }
  const _onAddReaction = () => {
    if (!hasMessageID) {
      return
    }
    C.Router2.navigateAppend({
      name: 'chatChooseEmoji',
      params: {
        conversationIDKey,
        onPickAddToMessageID: id,
        pickKey: 'reaction',
      },
    })
  }
  const onAddReaction = C.isMobile ? _onAddReaction : undefined

  const {members: teamMembers} = useChatTeamMembers(teamID)
  const {yourOperations} = useChatTeam(teamID, teamname)
  const authorRoleInTeam = teamMembers.get(author)?.type
  const authorIsBot =
    teamname && teamMembers.size
      ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
      : meta.teamType === 'adhoc' && participantInfo.name.length > 0
        ? !participantInfo.name.includes(author)
        : false
  const _onInstallBot = () => {
    C.Router2.navigateAppend({name: 'chatInstallBotPick', params: {botUsername: author}})
  }
  const onInstallBot = authorIsBot ? _onInstallBot : undefined

  const itemReaction = onAddReaction && hasMessageID
    ? ([
        {
          title: '',
          unWrapped: true,
          view: <ReactionItem onHidden={onHidden} onReact={onReact} showPicker={onAddReaction} />,
        },
        'Divider',
      ] as const)
    : []

  const itemBot = onInstallBot
    ? ([
        {
          icon: 'iconfont-nav-2-robot',
          onClick: onInstallBot,
          title: 'Install bot in another team or chat',
        },
      ] as const)
    : []

  const convLabel = getConversationLabel(participantInfo, meta, true)
  const onCopyLink = () => {
    copyToClipboard(linkFromConvAndMessage(convLabel, id))
  }
  const itemCopyLink = hasMessageID
    ? ([{icon: 'iconfont-link', onClick: onCopyLink, title: 'Copy a link to this message'}] as const)
    : []

  const setOrangeLine = React.useContext(SetOrangeLineContext)
  const onReply = () => {
    setThreadInputReplyTo(conversationIDKey, ordinal)
  }
  const itemReply = message.exploded
    ? []
    : hasMessageID
      ? ([{icon: 'iconfont-reply', onClick: onReply, title: 'Reply'}] as const)
      : []

  const _onEdit = () => {
    setThreadInputEditing(conversationIDKey, ordinal)
  }

  const you = useCurrentUserState(s => s.username)
  const yourMessage = author === you
  const onEdit = yourMessage ? _onEdit : undefined
  const isEditable = hasMessageID && message.isEditable && yourMessage && !message.exploded
  const itemEdit =
    onEdit && isEditable
      ? ([
          {
            icon: 'iconfont-edit',
            onClick: onEdit,
            title: 'Edit',
          },
        ] as const)
      : []

  const _onForward = () => {
    showForwardMessagePicker(conversationIDKey, message)
  }
  const onForward = hasMessageID && (isAttach || (message.unfurls?.size ?? 0) > 0) ? _onForward : undefined
  const itemForward = onForward
    ? ([{icon: 'iconfont-forward', onClick: onForward, title: 'Forward'}] as const)
    : []

  const isTeam = !!teamname
  const canPinMessage = (!isTeam || yourOperations.pinMessage) && !message.exploded
  const _onPinMessage = () => {
    if (id) {
      pinConversationMessage(conversationIDKey, id)
    }
  }
  const onPinMessage = canPinMessage && hasMessageID ? _onPinMessage : undefined
  const itemPin = onPinMessage
    ? ([{icon: 'iconfont-pin', onClick: onPinMessage, title: 'Pin message'}] as const)
    : []

  const onMarkAsUnread = () => {
    if (id) {
      setOrangeLine(ordinal)
      actions.markAsUnread(id)
    }
  }
  const itemUnread = hasMessageID
    ? ([{icon: 'iconfont-envelope-solid', onClick: onMarkAsUnread, title: 'Mark as unread'}] as const)
    : []

  const clearModals = C.Router2.clearModals
  const _onDelete = () => {
    actions.deleteMessage()
    clearModals()
  }

  const canDeleteHistory = meta.teamType === 'adhoc' || yourOperations.deleteChatHistory
  const canExplodeNow =
    message.exploding && (yourMessage || canDeleteHistory) && message.isDeleteable && !message.exploded
  const _onExplodeNow = () => {
    actions.deleteMessage()
  }
  const onExplodeNow = canExplodeNow ? _onExplodeNow : undefined
  const canAdminDelete = yourOperations.deleteOtherMessages
  const isDeleteable = yourMessage || canAdminDelete
  const onDelete = isDeleteable && !onExplodeNow ? _onDelete : undefined
  const itemDelete =
    onDelete && !onExplodeNow && !message.exploded
      ? ([
          {
            danger: true,
            disabled: !onDelete,
            icon: 'iconfont-trash',
            onClick: onDelete,
            rightTitle: 'for everyone',
            title: 'Delete',
          },
        ] as const)
      : []
  const itemExplode = onExplodeNow
    ? ([
        {
          danger: true,
          icon: 'iconfont-bomb',
          onClick: onExplodeNow,
          title: 'Explode now',
        },
      ] as const)
    : []

  const _onKick = () => {
    C.Router2.navigateAppend({name: 'teamReallyRemoveMember', params: {members: [author], teamID}})
  }
  const authorInTeam = teamMembers.size ? teamMembers.has(author) : true
  const onKick = isDeleteable && !!teamID && !yourMessage && authorInTeam ? _onKick : undefined
  const itemKick = onKick
    ? ([
        {
          danger: true,
          disabled: !onKick,
          icon: 'iconfont-user-block',
          onClick: onKick,
          rightTitle: 'from the team',
          title: 'Kick user',
        },
      ] as const)
    : []

  const onShowProfile = () => {
    navToProfile(author)
  }
  const onViewProfile = author && !yourMessage ? onShowProfile : undefined
  const profileSubtitle = `${deviceName} ${deviceRevokedAt ? 'REVOKED at' : '-'} ${
    deviceRevokedAt ? `${formatTimeForRevoked(deviceRevokedAt)}` : formatTimeForPopup(timestamp)
  }`
  const itemProfile = onViewProfile
    ? ([
        {
          icon: 'iconfont-person',
          onClick: onViewProfile,
          subTitle: C.isMobile ? profileSubtitle : undefined,
          title: `View ${author}'s profile`,
        },
      ] as const)
    : []
  return {
    itemBot,
    itemCopyLink,
    itemDelete,
    itemEdit,
    itemExplode,
    itemForward,
    itemKick,
    itemPin,
    itemProfile,
    itemReaction,
    itemReply,
    itemUnread,
  }
}

export type MessagePopupItems = ReturnType<typeof useItemsForMessage>

const useThreadItems = (ordinal: T.Chat.Ordinal, onHidden: () => void) => {
  const conversationIDKey = useConversationThreadID()
  const message = useConversationThreadMessage(ordinal) ?? emptyText
  const {meta, participantInfo} = useConversationThreadSelector(
    C.useShallow(s => ({meta: s.meta, participantInfo: s.participants}))
  )
  const {messageDelete, toggleMessageReaction} = useConversationThreadMessageActions()
  const setMarkAsUnread = useConversationThreadSetMarkAsUnread()
  return useItemsForMessage({
    actions: {
      deleteMessage: () => messageDelete(ordinal),
      markAsUnread: setMarkAsUnread,
      toggleReaction: emoji => toggleMessageReaction(ordinal, emoji),
    },
    conversationIDKey,
    message,
    meta,
    onHidden,
    participantInfo,
  })
}

export const useStorelessItems = (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  message: T.Chat.Message
  meta: T.Chat.ConversationMeta
  onHidden: () => void
  participantInfo: T.Chat.ParticipantInfo
}) =>
  useItemsForMessage({
    actions: {
      deleteMessage: () => deleteConversationMessage(p.conversationIDKey, p.message, p.meta.tlfname),
      markAsUnread: id => markConversationAsUnread(p.conversationIDKey, id),
      toggleReaction: emoji =>
        toggleConversationMessageReaction(p.conversationIDKey, p.message, emoji, p.meta.tlfname),
    },
    conversationIDKey: p.conversationIDKey,
    message: p.message,
    meta: p.meta,
    onHidden: p.onHidden,
    participantInfo: p.participantInfo,
  })

export const useItems = useThreadItems

export const useHeaderForMessage = (message: T.Chat.Message, onHidden: () => void) => {
  const you = useCurrentUserState(s => s.username)
  const {author, deviceType, deviceName, botUsername, timestamp, exploding, explodingTime} = message
  const yourMessage = author === you
  const deviceRevokedAt = message.deviceRevokedAt || undefined
  const mapUnfurl = Chat.getMapUnfurl(message)
  const isLocation = !!mapUnfurl

  return exploding ? (
    <ExplodingPopupHeader
      onHidden={onHidden}
      author={author}
      hideTimer={message.submitState === 'pending' || message.submitState === 'failed'}
      botUsername={botUsername}
      deviceName={deviceName ?? ''}
      deviceRevokedAt={deviceRevokedAt}
      explodesAt={message.exploded ? 0 : (explodingTime ?? 0)}
      timestamp={timestamp}
      yourMessage={yourMessage}
    />
  ) : (
    <MessagePopupHeader
      onHidden={onHidden}
      author={author}
      botUsername={botUsername}
      deviceName={deviceName ?? ''}
      deviceRevokedAt={deviceRevokedAt}
      deviceType={deviceType ?? 'desktop'}
      isLast={false}
      isLocation={isLocation}
      timestamp={timestamp}
      yourMessage={yourMessage}
    />
  )
}

export const useHeader = (ordinal: T.Chat.Ordinal, onHidden: () => void) => {
  const message = useConversationThreadMessage(ordinal) ?? emptyText
  return useHeaderForMessage(message, onHidden)
}
