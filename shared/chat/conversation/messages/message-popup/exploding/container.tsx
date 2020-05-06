import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as TeamConstants from '../../../../../constants/teams'
import * as Types from '../../../../../constants/types/chat2'
import * as TeamTypes from '../../../../../constants/types/teams'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Container from '../../../../../util/container'
import {isIOS} from '../../../../../constants/platform'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'
import Exploding from '.'
import {MenuItems} from '../../../../../common-adapters'
import openURL from '../../../../../util/open-url'
import ReactionItem from '../reactionitem'

export type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: Types.MessageAttachment | Types.MessageText
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const yourMessage = ownProps.message.author === state.config.username
    const meta = Constants.getMeta(state, ownProps.message.conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, ownProps.message.conversationIDKey)
    const _canDeleteHistory =
      meta.teamType === 'adhoc' || TeamConstants.getCanPerformByID(state, meta.teamID).deleteChatHistory
    const _canExplodeNow = (yourMessage || _canDeleteHistory) && ownProps.message.isDeleteable
    const _canEdit = yourMessage && ownProps.message.isEditable
    const _mapUnfurl = Constants.getMapUnfurl(ownProps.message)
    // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
    const _canReplyPrivately =
      !yourMessage &&
      ownProps.message.type === 'text' &&
      (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
    const authorIsBot = Constants.messageAuthorIsBot(state, meta, ownProps.message, participantInfo)
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
      author: ownProps.message.author,
      botUsername: ownProps.message.type === 'text' ? ownProps.message.botUsername : undefined,
      deviceName: ownProps.message.deviceName,
      deviceRevokedAt: ownProps.message.deviceRevokedAt,
      deviceType: ownProps.message.deviceType,
      explodesAt: ownProps.message.explodingTime,
      hideTimer: ownProps.message.submitState === 'pending' || ownProps.message.submitState === 'failed',
      timestamp: ownProps.message.timestamp,
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
                conversationIDKey: ownProps.message.conversationIDKey,
                onPickAddToMessageOrdinal: ownProps.message.ordinal,
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
          conversationIDKey: ownProps.message.conversationIDKey,
          show: true,
          tab: 'attachments',
        })
      ),
    _onCopy: () => {
      if (ownProps.message.type === 'text') {
        dispatch(ConfigGen.createCopyToClipboard({text: ownProps.message.text.stringValue()}))
      }
    },
    _onDownload: () =>
      dispatch(
        Chat2Gen.createAttachmentDownload({
          message: ownProps.message,
        })
      ),
    _onEdit: () =>
      dispatch(
        Chat2Gen.createMessageSetEditing({
          conversationIDKey: ownProps.message.conversationIDKey,
          ordinal: ownProps.message.ordinal,
        })
      ),
    _onExplodeNow: () =>
      dispatch(
        Chat2Gen.createMessageDelete({
          conversationIDKey: ownProps.message.conversationIDKey,
          ordinal: ownProps.message.ordinal,
        })
      ),
    _onForward: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {ordinal: ownProps.message.ordinal, srcConvID: ownProps.message.conversationIDKey},
              selected: 'chatForwardMsgPick',
            },
          ],
        })
      )
    },
    _onInstallBot: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {props: {botUsername: ownProps.message.author, navToChat: true}, selected: 'chatInstallBotPick'},
          ],
        })
      )
    },
    _onKick: (teamID: TeamTypes.TeamID, username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}],
        })
      ),
    _onPinMessage: () => {
      dispatch(
        Chat2Gen.createPinMessage({
          conversationIDKey: ownProps.message.conversationIDKey,
          messageID: ownProps.message.id,
        })
      )
    },
    _onReact: (emoji: string) => {
      dispatch(
        Chat2Gen.createToggleMessageReaction({
          conversationIDKey: ownProps.message.conversationIDKey,
          emoji,
          ordinal: ownProps.message.ordinal,
        })
      )
    },
    _onReply: () =>
      dispatch(
        Chat2Gen.createToggleReplyToMessage({
          conversationIDKey: ownProps.message.conversationIDKey,
          ordinal: ownProps.message.ordinal,
        })
      ),
    _onReplyPrivately: () => {
      dispatch(
        Chat2Gen.createMessageReplyPrivately({
          ordinal: ownProps.message.ordinal,
          sourceConversationIDKey: ownProps.message.conversationIDKey,
        })
      )
    },
    _onSaveAttachment: () =>
      dispatch(
        Chat2Gen.createMessageAttachmentNativeSave({
          message: ownProps.message,
        })
      ),
    _onShareAttachment: () =>
      dispatch(
        Chat2Gen.createMessageAttachmentNativeShare({
          message: ownProps.message,
        })
      ),
    _onShowInFinder: () => {
      ownProps.message.type === 'attachment' &&
        ownProps.message.downloadPath &&
        dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: ownProps.message.downloadPath}))
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
    const message = ownProps.message
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
          items.push({icon: 'iconfont-download-2', onClick: dispatchProps._onSaveAttachment, title: 'Save'})
        }
        if (isIOS) {
          items.push({icon: 'iconfont-share', onClick: dispatchProps._onShareAttachment, title: 'Share'})
        }
      } else {
        items.push(
          !message.downloadPath
            ? {icon: 'iconfont-download-2', onClick: dispatchProps._onDownload, title: 'Download'}
            : {icon: 'iconfont-finder', onClick: dispatchProps._onShowInFinder, title: 'Show in finder'}
        )
      }
      if (stateProps._authorIsBot) {
        items.push({
          icon: 'iconfont-nav-2-robot',
          onClick: dispatchProps._onInstallBot,
          title: 'Install bot in another team or chat',
        })
      }
      items.push({icon: 'iconfont-camera', onClick: dispatchProps._onAllMedia, title: 'All media'})
      items.push({icon: 'iconfont-reply', onClick: dispatchProps._onReply, title: 'Reply'})
      items.push({icon: 'iconfont-forward', onClick: dispatchProps._onForward, title: 'Forward'})
      items.push({icon: 'iconfont-pin', onClick: dispatchProps._onPinMessage, title: 'Pin message'})
    } else {
      if (
        stateProps._mapUnfurl &&
        stateProps._mapUnfurl.mapInfo &&
        !stateProps._mapUnfurl.mapInfo.isLiveLocationDone
      ) {
        const url = stateProps._mapUnfurl.url
        items.push({icon: 'iconfont-location', onClick: () => openURL(url), title: 'View on Google Maps'})
      }
      if (stateProps._canEdit) {
        items.push({icon: 'iconfont-edit', onClick: dispatchProps._onEdit, title: 'Edit'})
      }
      if (stateProps._authorIsBot) {
        items.push({
          icon: 'iconfont-nav-2-robot',
          onClick: dispatchProps._onInstallBot,
          title: 'Install bot in another team or chat',
        })
      }
      items.push({icon: 'iconfont-clipboard', onClick: dispatchProps._onCopy, title: 'Copy text'})
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
      items.push({icon: 'iconfont-pin', onClick: dispatchProps._onPinMessage, title: 'Pin message'})
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
