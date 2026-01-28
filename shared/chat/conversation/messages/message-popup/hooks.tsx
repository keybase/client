import * as React from 'react'
import type * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Teams from '@/stores/teams'
import {useConfigState} from '@/stores/config'
import {useProfileState} from '@/stores/profile'
import {useCurrentUserState} from '@/stores/current-user'
import {linkFromConvAndMessage} from '@/constants/deeplinks'
import ReactionItem from './reactionitem'
import MessagePopupHeader from './header'
import ExplodingPopupHeader from './exploding-header'
import {formatTimeForPopup, formatTimeForRevoked} from '@/util/timestamp'

const emptyText = Chat.makeMessageText({})

const messageAuthorIsBot = (
  state: Teams.State,
  metaTeamID: string,
  metaTeamname: string,
  metaTeamType: T.Chat.TeamType,
  messageAuthor: string,
  participantInfo: T.Chat.ParticipantInfo
) => {
  const teamID = metaTeamID
  return metaTeamname
    ? Teams.userIsRoleInTeam(state, teamID, messageAuthor, 'restrictedbot') ||
        Teams.userIsRoleInTeam(state, teamID, messageAuthor, 'bot')
    : metaTeamType === 'adhoc' && participantInfo.name.length > 0 // teams without info may have type adhoc with an empty participant name list
      ? !participantInfo.name.includes(messageAuthor) // if adhoc, check if author in participants
      : false // if we don't have team information, don't show bot icon
}

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
  const message = Chat.useChatContext(s => {
    return s.messageMap.get(ordinal) ?? emptyText
  })
  const isAttach = message.type === 'attachment'
  const {author, id, deviceName, timestamp, deviceRevokedAt} = message
  const meta = Chat.useChatContext(s => s.meta)
  const {teamID, teamname} = meta
  const participantInfo = Chat.useChatContext(s => s.participants)
  const toggleMessageReaction = Chat.useChatContext(s => s.dispatch.toggleMessageReaction)
  const onReact = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )
  const navigateAppend = Chat.useChatNavigateAppend()
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

  const authorIsBot = Teams.useTeamsState(s =>
    messageAuthorIsBot(s, meta.teamID, meta.teamname, meta.teamType, author, participantInfo)
  )
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

  const convLabel = getConversationLabel(participantInfo, meta, true)
  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const onCopyLink = React.useCallback(() => {
    copyToClipboard(linkFromConvAndMessage(convLabel, id))
  }, [copyToClipboard, id, convLabel])
  const itemCopyLink = [
    {icon: 'iconfont-link', onClick: onCopyLink, title: 'Copy a link to this message'},
  ] as const

  const {messageDelete, pinMessage, setEditing, setMarkAsUnread, setReplyTo} = Chat.useChatContext(
    C.useShallow(s => {
      const {messageDelete, pinMessage, setEditing, setMarkAsUnread, setReplyTo} = s.dispatch
      return {messageDelete, pinMessage, setEditing, setMarkAsUnread, setReplyTo}
    })
  )

  const onReply = React.useCallback(() => {
    setReplyTo(ordinal)
  }, [setReplyTo, ordinal])
  const itemReply = message.exploded
    ? []
    : ([{icon: 'iconfont-reply', onClick: onReply, title: 'Reply'}] as const)

  const _onEdit = React.useCallback(() => {
    setEditing(ordinal)
  }, [setEditing, ordinal])

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
  const yourOperations = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID))
  const canPinMessage = (!isTeam || yourOperations.pinMessage) && !message.exploded
  const _onPinMessage = React.useCallback(() => {
    pinMessage(id)
  }, [pinMessage, id])
  const onPinMessage = canPinMessage ? _onPinMessage : undefined
  const itemPin = onPinMessage
    ? ([{icon: 'iconfont-pin', onClick: onPinMessage, title: 'Pin message'}] as const)
    : []

  const onMarkAsUnread = React.useCallback(() => {
    setMarkAsUnread(id)
  }, [setMarkAsUnread, id])
  const itemUnread = [
    {icon: 'iconfont-envelope-solid', onClick: onMarkAsUnread, title: 'Mark as unread'},
  ] as const

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const _onDelete = React.useCallback(() => {
    messageDelete(ordinal)
    clearModals()
  }, [messageDelete, clearModals, ordinal])

  const canDeleteHistory = Teams.useTeamsState(
    s => meta.teamType === 'adhoc' || Teams.getCanPerformByID(s, teamID).deleteChatHistory
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
  const teamMembers = Teams.useTeamsState(s => s.teamIDToMembers.get(teamID))
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

  const _showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
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

export const useHeader = (ordinal: T.Chat.Ordinal, onHidden: () => void) => {
  const message = Chat.useChatContext(s => {
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
