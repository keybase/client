import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as FSConstants from '../../../../../constants/fs'
import * as Container from '../../../../../util/container'
import * as ConfigConstants from '../../../../../constants/config'
import * as React from 'react'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as TeamConstants from '../../../../../constants/teams'
import Exploding from '.'
import ReactionItem from '../reactionitem'
import openURL from '../../../../../util/open-url'
import type * as TeamTypes from '../../../../../constants/types/teams'
import type * as Types from '../../../../../constants/types/chat2'
import type {MenuItems} from '../../../../../common-adapters'
import type {Position} from '../../../../../styles'
import type {StylesCrossPlatform} from '../../../../../styles/css'
import {isIOS} from '../../../../../constants/platform'
import {makeMessageText} from '../../../../../constants/chat2/message'

export type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageText({})

export default (ownProps: OwnProps) => {
  const {conversationIDKey, ordinal} = ownProps
  // TODO remove
  const m = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const message = m?.type === 'text' || m?.type === 'attachment' ? m : emptyMessage
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const yourMessage = message.author === you
  const meta = Container.useSelector(state => Constants.getMeta(state, message.conversationIDKey))
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, message.conversationIDKey)
  )
  const _canDeleteHistory = TeamConstants.useState(
    s => meta.teamType === 'adhoc' || TeamConstants.getCanPerformByID(s, meta.teamID).deleteChatHistory
  )
  const _canExplodeNow = (yourMessage || _canDeleteHistory) && message.isDeleteable
  const _canEdit = yourMessage && message.isEditable
  const _mapUnfurl = Constants.getMapUnfurl(message)
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const _canReplyPrivately =
    !yourMessage &&
    message.type === 'text' &&
    (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
  const authorIsBot = TeamConstants.useState(s =>
    Constants.messageAuthorIsBot(s, meta, message, participantInfo)
  )
  const _teamMembers = TeamConstants.useState(s => s.teamIDToMembers.get(meta.teamID))

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

  const dispatch = Container.useDispatch()
  const _onAddReaction = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              conversationIDKey: ownProps.conversationIDKey,
              onPickAddToMessageOrdinal: ownProps.ordinal,
              pickKey: 'reaction',
            },
            selected: 'chatChooseEmoji',
          },
        ],
      })
    )
  }
  const _onAllMedia = () => {
    dispatch(
      Chat2Gen.createShowInfoPanel({
        conversationIDKey: ownProps.conversationIDKey,
        show: true,
        tab: 'attachments',
      })
    )
  }
  const copyToClipboard = ConfigConstants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const _onCopy = (h: Container.HiddenString) => {
    copyToClipboard(h.stringValue())
  }
  const _onDownload = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.id,
      })
    )
  }
  const _onEdit = () => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: ownProps.conversationIDKey,
        ordinal: ownProps.ordinal,
      })
    )
  }
  const _onExplodeNow = () => {
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: ownProps.conversationIDKey,
        ordinal: ownProps.ordinal,
      })
    )
  }
  const _onForward = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {ordinal: ownProps.ordinal, srcConvID: ownProps.conversationIDKey},
            selected: 'chatForwardMsgPick',
          },
        ],
      })
    )
  }
  const _onInstallBot = (author: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {botUsername: author}, selected: 'chatInstallBotPick'}],
      })
    )
  }
  const _onKick = (teamID: TeamTypes.TeamID, username: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}],
      })
    )
  }
  const _onMarkAsUnread = (id: number) => {
    dispatch(
      Chat2Gen.createMarkAsUnread({
        conversationIDKey: ownProps.conversationIDKey,
        readMsgID: id,
      })
    )
  }
  const _onPinMessage = (id: number) => {
    dispatch(
      Chat2Gen.createPinMessage({
        conversationIDKey: ownProps.conversationIDKey,
        messageID: id,
      })
    )
  }
  const _onReact = (emoji: string) => {
    dispatch(
      Chat2Gen.createToggleMessageReaction({
        conversationIDKey: ownProps.conversationIDKey,
        emoji,
        ordinal: ownProps.ordinal,
      })
    )
  }
  const _onReply = () => {
    dispatch(
      Chat2Gen.createToggleReplyToMessage({
        conversationIDKey: ownProps.conversationIDKey,
        ordinal: ownProps.ordinal,
      })
    )
  }
  const _onReplyPrivately = () => {
    dispatch(
      Chat2Gen.createMessageReplyPrivately({
        ordinal: ownProps.ordinal,
        sourceConversationIDKey: ownProps.conversationIDKey,
      })
    )
  }
  const _onSaveAttachment = (message: Types.Message) => {
    dispatch(Chat2Gen.createMessageAttachmentNativeSave({message}))
  }
  const _onShareAttachment = (message: Types.Message) => {
    dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
  }
  const openLocalPathInSystemFileManagerDesktop = FSConstants.useState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = (message: Types.Message) => {
    message.type === 'attachment' &&
      message.downloadPath &&
      openLocalPathInSystemFileManagerDesktop?.(message.downloadPath)
  }
  const _onUserBlock = (message: Types.Message, isSingle: boolean) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              blockUserByDefault: true,
              context: isSingle ? 'message-popup-single' : 'message-popup',
              convID: message.conversationIDKey,
              username: message.author,
            },
            selected: 'chatBlockingModal',
          },
        ],
      })
    )
  }

  const authorInTeam = _teamMembers?.has(message.author) ?? true
  const items: MenuItems = []
  if (Container.isMobile) {
    // 'Add a reaction' is an option on mobile
    items.push({
      title: 'Reactions',
      unWrapped: true,
      view: <ReactionItem onHidden={ownProps.onHidden} onReact={_onReact} showPicker={_onAddReaction} />,
    })
    items.push('Divider')
  }
  if (message.type === 'attachment') {
    if (Container.isMobile) {
      if (message.attachmentType === 'image') {
        items.push({
          icon: 'iconfont-download-2',
          onClick: () => _onSaveAttachment(message),
          title: 'Save',
        })
      }
      if (isIOS) {
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
