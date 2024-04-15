import * as React from 'react'
import type * as T from '@/constants/types'
import * as C from '@/constants'
import ReactionItem from './reactionitem'
import MessagePopupHeader from './header'
import ExplodingPopupHeader from './exploding-header'
import {formatTimeForPopup, formatTimeForRevoked} from '@/util/timestamp'

const emptyText = C.Chat.makeMessageText({})

export const useItems = (ordinal: T.Chat.Ordinal, onHidden: () => void) => {
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const isAttach = m?.type === 'attachment'
  const message = m || emptyText
  const {author, id, deviceName, timestamp, deviceRevokedAt} = message
  const meta = C.useChatContext(s => s.meta)
  const {teamID, teamname} = meta
  const participantInfo = C.useChatContext(s => s.participants)
  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const onReact = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )
  const navigateAppend = C.Chat.useChatNavigateAppend()
  const _onAddReaction = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {
        conversationIDKey,
        onPickAddToMessageOrdinal: ordinal,
        pickKey: 'reaction',
      },
      selected: 'chatChooseEmoji',
    }))
  }, [navigateAppend, ordinal])
  const onAddReaction = C.isMobile ? _onAddReaction : undefined

  const authorIsBot = C.useTeamsState(s => C.Chat.messageAuthorIsBot(s, meta, message, participantInfo))
  const _onInstallBot = React.useCallback(() => {
    navigateAppend(() => ({props: {botUsername: author}, selected: 'chatInstallBotPick'}))
  }, [navigateAppend, author])
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

  const convLabel = C.Chat.getConversationLabel(participantInfo, meta, true)
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopyLink = React.useCallback(() => {
    copyToClipboard(C.DeepLinks.linkFromConvAndMessage(convLabel, id))
  }, [copyToClipboard, id, convLabel])
  const itemCopyLink = [
    {icon: 'iconfont-link', onClick: onCopyLink, title: 'Copy a link to this message'},
  ] as const

  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const onReply = React.useCallback(() => {
    setReplyTo(ordinal)
  }, [setReplyTo, ordinal])
  const itemReply = message.exploded
    ? []
    : ([{icon: 'iconfont-reply', onClick: onReply, title: 'Reply'}] as const)

  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const _onEdit = React.useCallback(() => {
    setEditing(ordinal)
  }, [setEditing, ordinal])

  const you = C.useCurrentUserState(s => s.username)
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

  const _onForward = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, ordinal},
      selected: 'chatForwardMsgPick',
    }))
  }, [navigateAppend, ordinal])
  const onForward = isAttach || (message.unfurls?.size ?? 0) > 0 ? _onForward : undefined // only unfurls for text

  const itemForward = onForward
    ? ([{icon: 'iconfont-forward', onClick: onForward, title: 'Forward'}] as const)
    : []

  const isTeam = !!teamname
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID))
  const canPinMessage = (!isTeam || yourOperations.pinMessage) && !message.exploded
  const pinMessage = C.useChatContext(s => s.dispatch.pinMessage)
  const _onPinMessage = React.useCallback(() => {
    pinMessage(id)
  }, [pinMessage, id])
  const onPinMessage = canPinMessage ? _onPinMessage : undefined
  const itemPin = onPinMessage
    ? ([{icon: 'iconfont-pin', onClick: onPinMessage, title: 'Pin message'}] as const)
    : []

  const setMarkAsUnread = C.useChatContext(s => s.dispatch.setMarkAsUnread)
  const onMarkAsUnread = React.useCallback(() => {
    setMarkAsUnread(id)
  }, [setMarkAsUnread, id])
  const itemUnread = [
    {icon: 'iconfont-envelope-solid', onClick: onMarkAsUnread, title: 'Mark as unread'},
  ] as const

  const messageDelete = C.useChatContext(s => s.dispatch.messageDelete)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const _onDelete = React.useCallback(() => {
    messageDelete(ordinal)
    clearModals()
  }, [messageDelete, clearModals, ordinal])

  const canDeleteHistory = C.useTeamsState(
    s => meta.teamType === 'adhoc' || C.Teams.getCanPerformByID(s, teamID).deleteChatHistory
  )
  const canExplodeNow =
    message.exploding && (yourMessage || canDeleteHistory) && message.isDeleteable && !message.exploded
  const _onExplodeNow = React.useCallback(() => {
    messageDelete(ordinal)
  }, [messageDelete, ordinal])
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

  const _onKick = React.useCallback(() => {
    navigateAppend(() => ({props: {members: [author], teamID}, selected: 'teamReallyRemoveMember'}))
  }, [navigateAppend, author, teamID])
  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const authorInTeam = teamMembers?.has(author) ?? true
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

  const _showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUserProfile = React.useCallback(() => {
    _showUserProfile(author)
  }, [_showUserProfile, author])
  const onViewProfile = author && !yourMessage ? showUserProfile : undefined
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

export const useHeader = (ordinal: T.Chat.Ordinal) => {
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const you = C.useCurrentUserState(s => s.username)
  const message = m || emptyText
  const {author, deviceType, deviceName, botUsername, timestamp, exploding, explodingTime} = message
  const yourMessage = author === you
  const deviceRevokedAt = message.deviceRevokedAt || undefined
  const mapUnfurl = C.Chat.getMapUnfurl(message)
  const isLocation = !!mapUnfurl

  return exploding ? (
    <ExplodingPopupHeader
      author={author}
      hideTimer={message.submitState === 'pending' || message.submitState === 'failed'}
      botUsername={botUsername}
      deviceName={deviceName ?? ''}
      deviceRevokedAt={deviceRevokedAt}
      explodesAt={message.exploded ? 0 : explodingTime ?? 0}
      timestamp={timestamp}
      yourMessage={yourMessage}
    />
  ) : (
    <MessagePopupHeader
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
