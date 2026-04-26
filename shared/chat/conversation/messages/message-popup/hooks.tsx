import type * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as ConvoState from '@/stores/convostate'
import {useCurrentUserState} from '@/stores/current-user'
import {linkFromConvAndMessage} from '@/constants/deeplinks'
import ReactionItem from './reactionitem'
import MessagePopupHeader from './header'
import ExplodingPopupHeader from './exploding-header'
import {formatTimeForPopup, formatTimeForRevoked} from '@/util/timestamp'
import {navToProfile} from '@/constants/router'
import {copyToClipboard} from '@/util/storeless-actions'
import {useChatTeam, useChatTeamMembers} from '../../team-hooks'

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

export const useItems = (ordinal: T.Chat.Ordinal, onHidden: () => void) => {
  const message = ConvoState.useChatContext(s => {
    return s.messageMap.get(ordinal) ?? emptyText
  })
  const isAttach = message.type === 'attachment'
  const {author, id, deviceName, timestamp, deviceRevokedAt} = message
  const meta = ConvoState.useChatContext(s => s.meta)
  const {teamID, teamname} = meta
  const participantInfo = ConvoState.useChatContext(s => s.participants)
  const toggleMessageReaction = ConvoState.useChatContext(s => s.dispatch.toggleMessageReaction)
  const onReact = (emoji: string) => {
    toggleMessageReaction(ordinal, emoji)
  }
  const navigateAppend = ConvoState.useChatNavigateAppend()
  const _onAddReaction = () => {
    navigateAppend(conversationIDKey => ({
      name: 'chatChooseEmoji',
      params: {
        conversationIDKey,
        onPickAddToMessageOrdinal: ordinal,
        pickKey: 'reaction',
      },
    }))
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
    navigateAppend(() => ({name: 'chatInstallBotPick', params: {botUsername: author}}))
  }
  const onInstallBot = authorIsBot ? _onInstallBot : undefined

  const itemReaction = onAddReaction
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
  const itemCopyLink = [
    {icon: 'iconfont-link', onClick: onCopyLink, title: 'Copy a link to this message'},
  ] as const

  const {messageDelete, pinMessage, setMarkAsUnread} = ConvoState.useChatContext(
    C.useShallow(s => {
      const {messageDelete, pinMessage, setMarkAsUnread} = s.dispatch
      return {messageDelete, pinMessage, setMarkAsUnread}
    })
  )
  const {setEditing, setReplyTo} = ConvoState.useChatUIContext(
    C.useShallow(s => ({setEditing: s.dispatch.setEditing, setReplyTo: s.dispatch.setReplyTo}))
  )

  const onReply = () => {
    setReplyTo(ordinal)
  }
  const itemReply = message.exploded
    ? []
    : ([{icon: 'iconfont-reply', onClick: onReply, title: 'Reply'}] as const)

  const _onEdit = () => {
    setEditing(ordinal)
  }

  const you = useCurrentUserState(s => s.username)
  const yourMessage = author === you
  const onEdit = yourMessage ? _onEdit : undefined
  const isEditable = message.isEditable && yourMessage && !message.exploded
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
    navigateAppend(conversationIDKey => ({
      name: 'chatForwardMsgPick',
      params: {conversationIDKey, ordinal},
    }))
  }
  const onForward = isAttach || (message.unfurls?.size ?? 0) > 0 ? _onForward : undefined // only unfurls for text

  const itemForward = onForward
    ? ([{icon: 'iconfont-forward', onClick: onForward, title: 'Forward'}] as const)
    : []

  const isTeam = !!teamname
  const canPinMessage = (!isTeam || yourOperations.pinMessage) && !message.exploded
  const _onPinMessage = () => {
    pinMessage(id)
  }
  const onPinMessage = canPinMessage ? _onPinMessage : undefined
  const itemPin = onPinMessage
    ? ([{icon: 'iconfont-pin', onClick: onPinMessage, title: 'Pin message'}] as const)
    : []

  const onMarkAsUnread = () => {
    setMarkAsUnread(id)
  }
  const itemUnread = [
    {icon: 'iconfont-envelope-solid', onClick: onMarkAsUnread, title: 'Mark as unread'},
  ] as const

  const clearModals = C.Router2.clearModals
  const _onDelete = () => {
    messageDelete(ordinal)
    clearModals()
  }

  const canDeleteHistory = meta.teamType === 'adhoc' || yourOperations.deleteChatHistory
  const canExplodeNow =
    message.exploding && (yourMessage || canDeleteHistory) && message.isDeleteable && !message.exploded
  const _onExplodeNow = () => {
    messageDelete(ordinal)
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
    navigateAppend(() => ({name: 'teamReallyRemoveMember', params: {members: [author], teamID}}))
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

export const useHeader = (ordinal: T.Chat.Ordinal, onHidden: () => void) => {
  const message = ConvoState.useChatContext(s => {
    return s.messageMap.get(ordinal) ?? emptyText
  })
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
