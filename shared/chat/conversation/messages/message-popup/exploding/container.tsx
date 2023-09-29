import * as C from '../../../../../constants'
import * as Constants from '../../../../../constants/chat2'
import * as React from 'react'
import Exploding from '.'
import ReactionItem from '../reactionitem'
import openURL from '../../../../../util/open-url'
import type * as T from '../../../../../constants/types'
import type {MenuItems} from '../../../../../common-adapters'
import type {Position} from '../../../../../styles'
import type {StylesCrossPlatform} from '../../../../../styles/css'
import {makeMessageText} from '../../../../../constants/chat2/message'
import type HiddenString from '../../../../../util/hidden-string'

export type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageText({})

export default (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  // TODO remove
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'text' || m?.type === 'attachment' ? m : emptyMessage
  const you = C.useCurrentUserState(s => s.username)
  const yourMessage = message.author === you
  const meta = C.useChatContext(s => s.meta)
  const participantInfo = C.useChatContext(s => s.participants)
  const _canDeleteHistory = C.useTeamsState(
    s => meta.teamType === 'adhoc' || C.getCanPerformByID(s, meta.teamID).deleteChatHistory
  )
  const _canExplodeNow = (yourMessage || _canDeleteHistory) && message.isDeleteable
  const _canEdit = yourMessage && message.isEditable
  const _mapUnfurl = Constants.getMapUnfurl(message)
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const _canReplyPrivately =
    !yourMessage &&
    message.type === 'text' &&
    (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
  const authorIsBot = C.useTeamsState(s => Constants.messageAuthorIsBot(s, meta, message, participantInfo))
  const _teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(meta.teamID))

  const _authorIsBot = authorIsBot
  const _participants = participantInfo.all
  const _teamID = meta.teamID
  const _teamname = meta.teamname
  const author = message.author
  const botUsername = message.type === 'text' ? message.botUsername : undefined
  const deviceName = message.deviceName
  const deviceRevokedAt = message.deviceRevokedAt
  const deviceType = message.deviceType
  const explodesAt = message.explodingTime
  const hideTimer = message.submitState === 'pending' || message.submitState === 'failed'
  const timestamp = message.timestamp
  const navigateAppend = C.useChatNavigateAppend()
  const _onAddReaction = () => {
    navigateAppend(conversationIDKey => ({
      props: {
        conversationIDKey,
        onPickAddToMessageOrdinal: ownProps.ordinal,
        pickKey: 'reaction',
      },
      selected: 'chatChooseEmoji',
    }))
  }
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const _onAllMedia = () => {
    showInfoPanel(true, 'attachments')
  }
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const _onCopy = (h: HiddenString) => {
    copyToClipboard(h.stringValue())
  }
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const _onDownload = (message: T.Chat.Message) => {
    attachmentDownload(message.id)
  }
  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const _onEdit = () => {
    setEditing(ownProps.ordinal)
  }
  const messageDelete = C.useChatContext(s => s.dispatch.messageDelete)
  const _onExplodeNow = () => {
    messageDelete(ownProps.ordinal)
  }
  const _onForward = () => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, ordinal: ownProps.ordinal},
      selected: 'chatForwardMsgPick',
    }))
  }
  const _onInstallBot = (author: string) => {
    navigateAppend(() => ({props: {botUsername: author}, selected: 'chatInstallBotPick'}))
  }
  const _onKick = (teamID: T.Teams.TeamID, username: string) => {
    navigateAppend(() => ({props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}))
  }
  const setMarkAsUnread = C.useChatContext(s => s.dispatch.setMarkAsUnread)
  const _onMarkAsUnread = (id: number) => {
    setMarkAsUnread(id)
  }
  const _onPinMessage = C.useChatContext(s => s.dispatch.pinMessage)
  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const _onReact = (emoji: string) => {
    toggleMessageReaction(ownProps.ordinal, emoji)
  }
  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const _onReply = () => {
    setReplyTo(ownProps.ordinal)
  }
  const messageReplyPrivately = C.useChatContext(s => s.dispatch.messageReplyPrivately)
  const _onReplyPrivately = () => {
    messageReplyPrivately(ownProps.ordinal)
  }
  const messageAttachmentNativeSave = C.useChatContext(s => s.dispatch.messageAttachmentNativeSave)
  const messageAttachmentNativeShare = C.useChatContext(s => s.dispatch.messageAttachmentNativeShare)
  const _onSaveAttachment = (message: T.Chat.Message) => {
    messageAttachmentNativeSave(message)
  }
  const _onShareAttachment = (message: T.Chat.Message) => {
    messageAttachmentNativeShare(message.ordinal)
  }
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = (message: T.Chat.Message) => {
    message.type === 'attachment' &&
      message.downloadPath &&
      openLocalPathInSystemFileManagerDesktop?.(message.downloadPath)
  }
  const _onUserBlock = (message: T.Chat.Message, isSingle: boolean) => {
    navigateAppend(conversationIDKey => ({
      props: {
        blockUserByDefault: true,
        context: isSingle ? 'message-popup-single' : 'message-popup',
        conversationIDKey,
        username: message.author,
      },
      selected: 'chatBlockingModal',
    }))
  }

  const authorInTeam = _teamMembers?.has(message.author) ?? true
  const items: MenuItems = []
  if (C.isMobile) {
    // 'Add a reaction' is an option on mobile
    items.push({
      title: 'Reactions',
      unWrapped: true,
      view: <ReactionItem onHidden={ownProps.onHidden} onReact={_onReact} showPicker={_onAddReaction} />,
    })
    items.push('Divider')
  }
  if (message.type === 'attachment') {
    if (C.isMobile) {
      if (message.attachmentType === 'image') {
        items.push({
          icon: 'iconfont-download-2',
          onClick: () => _onSaveAttachment(message),
          title: 'Save',
        })
      }
      if (C.isIOS) {
        items.push({
          icon: 'iconfont-share',
          onClick: () => _onShareAttachment(message),
          title: 'Share',
        })
      }
    } else {
      items.push(
        !message.downloadPath
          ? {
              icon: 'iconfont-download-2',
              onClick: () => _onDownload(message),
              title: 'Download',
            }
          : {
              icon: 'iconfont-finder',
              onClick: () => _onShowInFinder(message),
              title: 'Show in finder',
            }
      )
    }
    if (_authorIsBot) {
      items.push({
        icon: 'iconfont-nav-2-robot',
        onClick: () => _onInstallBot(message.author),
        title: 'Install bot in another team or chat',
      })
    }
    items.push({icon: 'iconfont-camera', onClick: _onAllMedia, title: 'All media'})
    items.push({icon: 'iconfont-reply', onClick: _onReply, title: 'Reply'})
    items.push({icon: 'iconfont-forward', onClick: _onForward, title: 'Forward'})
    items.push({
      icon: 'iconfont-pin',
      onClick: () => _onPinMessage(message.id),
      title: 'Pin message',
    })
    items.push({
      icon: 'iconfont-envelope-solid',
      onClick: () => _onMarkAsUnread(message.id),
      title: 'Mark as unread',
    })
  } else {
    if (_mapUnfurl?.mapInfo && !_mapUnfurl.mapInfo.isLiveLocationDone) {
      const url = _mapUnfurl.url
      items.push({icon: 'iconfont-location', onClick: () => openURL(url), title: 'View on Google Maps'})
    }
    if (_canEdit) {
      items.push({icon: 'iconfont-edit', onClick: _onEdit, title: 'Edit'})
    }
    if (_authorIsBot) {
      items.push({
        icon: 'iconfont-nav-2-robot',
        onClick: () => _onInstallBot(message.author),
        title: 'Install bot in another team or chat',
      })
    }
    items.push({
      icon: 'iconfont-clipboard',
      onClick: () => _onCopy(message.text),
      title: 'Copy text',
    })
    items.push({icon: 'iconfont-reply', onClick: _onReply, title: 'Reply'})
    if (message.type === 'text' && message.unfurls.size > 0) {
      items.push({icon: 'iconfont-forward', onClick: _onForward, title: 'Forward'})
    }
    if (_canReplyPrivately) {
      items.push({
        icon: 'iconfont-reply',
        onClick: _onReplyPrivately,
        title: 'Reply privately',
      })
    }
    items.push({
      icon: 'iconfont-pin',
      onClick: () => _onPinMessage(message.id),
      title: 'Pin message',
    })
    items.push({
      icon: 'iconfont-envelope-solid',
      onClick: () => _onMarkAsUnread(message.id),
      title: 'Mark as unread',
    })
  }
  if (_canExplodeNow) {
    items.push({
      danger: true,
      icon: 'iconfont-bomb',
      onClick: _onExplodeNow,
      title: 'Explode now',
    })
  }
  if (_canDeleteHistory && _teamname && !yourMessage && authorInTeam) {
    items.push({
      danger: true,
      icon: 'iconfont-user-block',
      onClick: () => _onKick(_teamID, author),
      title: 'Kick user',
    })
  }
  if (!yourMessage && message.author) {
    const blockModalSingle = !_teamname && _participants.length === 2
    items.push({
      danger: true,
      icon: 'iconfont-user-block',
      onClick: () => _onUserBlock(message, blockModalSingle),
      title: _teamname ? 'Report user' : 'Block user',
    })
  }
  const props = {
    attachTo: ownProps.attachTo,
    author,
    botUsername,
    deviceName,
    deviceRevokedAt,
    deviceType,
    explodesAt,
    hideTimer,
    isTeam: !!_teamname,
    items,
    onHidden: ownProps.onHidden,
    position: ownProps.position,
    style: ownProps.style,
    timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
  return <Exploding {...props} />
}
