import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as FsGen from '../../../../../actions/fs-gen'
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

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey, ordinal} = ownProps
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'text' || m?.type === 'attachment' ? m : emptyMessage
    const yourMessage = message.author === state.config.username
    const meta = Constants.getMeta(state, message.conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, message.conversationIDKey)
    const _canDeleteHistory =
      meta.teamType === 'adhoc' || TeamConstants.getCanPerformByID(state, meta.teamID).deleteChatHistory
    const _canExplodeNow = (yourMessage || _canDeleteHistory) && message.isDeleteable
    const _canEdit = yourMessage && message.isEditable
    const _mapUnfurl = Constants.getMapUnfurl(message)
    // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
    const _canReplyPrivately =
      !yourMessage &&
      message.type === 'text' &&
      (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
    const authorIsBot = Constants.messageAuthorIsBot(state, meta, message, participantInfo)
    const _teamMembers = state.teams.teamIDToMembers.get(meta.teamID)

    return {
      _authorIsBot: authorIsBot,
      _canDeleteHistory,
      _canEdit,
      _canExplodeNow,
      _canReplyPrivately,
      _mapUnfurl,
      _participants: participantInfo.all,
      _teamID: meta.teamID,
      _teamMembers,
      _teamname: meta.teamname,
      author: message.author,
      botUsername: message.type === 'text' ? message.botUsername : undefined,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt,
      deviceType: message.deviceType,
      explodesAt: message.explodingTime,
      hideTimer: message.submitState === 'pending' || message.submitState === 'failed',
      // TODO remove
      message,
      timestamp: message.timestamp,
      yourMessage,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    _onAddReaction: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                conversationIDKey: ownProps.conversationIDKey,
                onPickAddToMessageOrdinal: ownProps.ordinal,
              },
              selected: 'chatChooseEmoji',
            },
          ],
        })
      )
    },
    _onAllMedia: () =>
      dispatch(
        Chat2Gen.createShowInfoPanel({
          conversationIDKey: ownProps.conversationIDKey,
          show: true,
          tab: 'attachments',
        })
      ),
    _onCopy: (h: Container.HiddenString) => {
      dispatch(ConfigGen.createCopyToClipboard({text: h.stringValue()}))
    },
    _onDownload: (message: Types.Message) =>
      dispatch(
        Chat2Gen.createAttachmentDownload({
          conversationIDKey: message.conversationIDKey,
          ordinal: message.id,
        })
      ),
    _onEdit: () =>
      dispatch(
        Chat2Gen.createMessageSetEditing({
          conversationIDKey: ownProps.conversationIDKey,
          ordinal: ownProps.ordinal,
        })
      ),
    _onExplodeNow: () =>
      dispatch(
        Chat2Gen.createMessageDelete({
          conversationIDKey: ownProps.conversationIDKey,
          ordinal: ownProps.ordinal,
        })
      ),
    _onForward: () => {
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
    },
    _onInstallBot: (author: string) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {botUsername: author}, selected: 'chatInstallBotPick'}],
        })
      )
    },
    _onKick: (teamID: TeamTypes.TeamID, username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}],
        })
      ),
    _onMarkAsUnread: (id: number) => {
      dispatch(
        Chat2Gen.createMarkAsUnread({
          conversationIDKey: ownProps.conversationIDKey,
          readMsgID: id,
        })
      )
    },
    _onPinMessage: (id: number) => {
      dispatch(
        Chat2Gen.createPinMessage({
          conversationIDKey: ownProps.conversationIDKey,
          messageID: id,
        })
      )
    },
    _onReact: (emoji: string) => {
      dispatch(
        Chat2Gen.createToggleMessageReaction({
          conversationIDKey: ownProps.conversationIDKey,
          emoji,
          ordinal: ownProps.ordinal,
        })
      )
    },
    _onReply: () =>
      dispatch(
        Chat2Gen.createToggleReplyToMessage({
          conversationIDKey: ownProps.conversationIDKey,
          ordinal: ownProps.ordinal,
        })
      ),
    _onReplyPrivately: () => {
      dispatch(
        Chat2Gen.createMessageReplyPrivately({
          ordinal: ownProps.ordinal,
          sourceConversationIDKey: ownProps.conversationIDKey,
        })
      )
    },
    _onSaveAttachment: (message: Types.Message) =>
      dispatch(Chat2Gen.createMessageAttachmentNativeSave({message})),
    _onShareAttachment: (message: Types.Message) =>
      dispatch(Chat2Gen.createMessageAttachmentNativeShare({message})),
    _onShowInFinder: (message: Types.Message) => {
      message.type === 'attachment' &&
        message.downloadPath &&
        dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
    },
    _onUserBlock: (message: Types.Message, isSingle: boolean) => {
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
    },
  }),
  (stateProps, dispatchProps, ownProps) => {
    const {message} = stateProps
    const authorInTeam = stateProps._teamMembers?.has(message.author) ?? true
    const items: MenuItems = []
    if (Container.isMobile) {
      // 'Add a reaction' is an option on mobile
      items.push({
        title: 'Reactions',
        unWrapped: true,
        view: (
          <ReactionItem
            onHidden={ownProps.onHidden}
            onReact={dispatchProps._onReact}
            showPicker={dispatchProps._onAddReaction}
          />
        ),
      })
      items.push('Divider')
    }
    if (message.type === 'attachment') {
      if (Container.isMobile) {
        if (message.attachmentType === 'image') {
          items.push({
            icon: 'iconfont-download-2',
            onClick: () => dispatchProps._onSaveAttachment(message),
            title: 'Save',
          })
        }
        if (isIOS) {
          items.push({
            icon: 'iconfont-share',
            onClick: () => dispatchProps._onShareAttachment(message),
            title: 'Share',
          })
        }
      } else {
        items.push(
          !message.downloadPath
            ? {
                icon: 'iconfont-download-2',
                onClick: () => dispatchProps._onDownload(message),
                title: 'Download',
              }
            : {
                icon: 'iconfont-finder',
                onClick: () => dispatchProps._onShowInFinder(message),
                title: 'Show in finder',
              }
        )
      }
      if (stateProps._authorIsBot) {
        items.push({
          icon: 'iconfont-nav-2-robot',
          onClick: () => dispatchProps._onInstallBot(message.author),
          title: 'Install bot in another team or chat',
        })
      }
      items.push({icon: 'iconfont-camera', onClick: dispatchProps._onAllMedia, title: 'All media'})
      items.push({icon: 'iconfont-reply', onClick: dispatchProps._onReply, title: 'Reply'})
      items.push({icon: 'iconfont-forward', onClick: dispatchProps._onForward, title: 'Forward'})
      items.push({
        icon: 'iconfont-pin',
        onClick: () => dispatchProps._onPinMessage(message.id),
        title: 'Pin message',
      })
      items.push({
        icon: 'iconfont-envelope-solid',
        onClick: () => dispatchProps._onMarkAsUnread(message.id),
        title: 'Mark as unread',
      })
    } else {
      if (stateProps._mapUnfurl?.mapInfo && !stateProps._mapUnfurl.mapInfo.isLiveLocationDone) {
        const url = stateProps._mapUnfurl.url
        items.push({icon: 'iconfont-location', onClick: () => openURL(url), title: 'View on Google Maps'})
      }
      if (stateProps._canEdit) {
        items.push({icon: 'iconfont-edit', onClick: dispatchProps._onEdit, title: 'Edit'})
      }
      if (stateProps._authorIsBot) {
        items.push({
          icon: 'iconfont-nav-2-robot',
          onClick: () => dispatchProps._onInstallBot(message.author),
          title: 'Install bot in another team or chat',
        })
      }
      items.push({
        icon: 'iconfont-clipboard',
        onClick: () => dispatchProps._onCopy(message.text),
        title: 'Copy text',
      })
      items.push({icon: 'iconfont-reply', onClick: dispatchProps._onReply, title: 'Reply'})
      if (message.type === 'text' && message.unfurls.size > 0) {
        items.push({icon: 'iconfont-forward', onClick: dispatchProps._onForward, title: 'Forward'})
      }
      if (stateProps._canReplyPrivately) {
        items.push({
          icon: 'iconfont-reply',
          onClick: dispatchProps._onReplyPrivately,
          title: 'Reply privately',
        })
      }
      items.push({
        icon: 'iconfont-pin',
        onClick: () => dispatchProps._onPinMessage(message.id),
        title: 'Pin message',
      })
      items.push({
        icon: 'iconfont-envelope-solid',
        onClick: () => dispatchProps._onMarkAsUnread(message.id),
        title: 'Mark as unread',
      })
    }
    if (stateProps._canExplodeNow) {
      items.push({
        danger: true,
        icon: 'iconfont-bomb',
        onClick: dispatchProps._onExplodeNow,
        title: 'Explode now',
      })
    }
    if (stateProps._canDeleteHistory && stateProps._teamname && !stateProps.yourMessage && authorInTeam) {
      items.push({
        danger: true,
        icon: 'iconfont-user-block',
        onClick: () => dispatchProps._onKick(stateProps._teamID, stateProps.author),
        title: 'Kick user',
      })
    }
    if (!stateProps.yourMessage && message.author) {
      const blockModalSingle = !stateProps._teamname && stateProps._participants.length === 2
      items.push({
        danger: true,
        icon: 'iconfont-user-block',
        onClick: () => dispatchProps._onUserBlock(message, blockModalSingle),
        title: stateProps._teamname ? 'Report user' : 'Block user',
      })
    }
    return {
      attachTo: ownProps.attachTo,
      author: stateProps.author,
      botUsername: stateProps.botUsername,
      deviceName: stateProps.deviceName,
      deviceRevokedAt: stateProps.deviceRevokedAt,
      deviceType: stateProps.deviceType,
      explodesAt: stateProps.explodesAt,
      hideTimer: stateProps.hideTimer,
      isTeam: !!stateProps._teamname,
      items,
      onHidden: ownProps.onHidden,
      position: ownProps.position,
      style: ownProps.style,
      timestamp: stateProps.timestamp,
      visible: ownProps.visible,
      yourMessage: stateProps.yourMessage,
    }
  }
)(Exploding)
