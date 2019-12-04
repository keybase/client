import * as React from 'react'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Container from '../../../../../util/container'
import {createShowUserProfile} from '../../../../../actions/profile-gen'
import {getCanPerform} from '../../../../../constants/teams'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'
import openURL from '../../../../../util/open-url'
import Text from '.'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: Types.MessagesWithReactions
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canDeleteHistory = yourOperations && yourOperations.deleteChatHistory
  const _canAdminDelete = yourOperations && yourOperations.deleteOtherMessages
  let _canPinMessage = message.type === 'text'
  if (_canPinMessage && meta.teamname) {
    _canPinMessage = yourOperations && yourOperations.pinMessage
  }
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const _canReplyPrivately =
    message.type === 'text' && (['small', 'big'].includes(meta.teamType) || meta.participants.length > 2)
  return {
    _canAdminDelete,
    _canDeleteHistory,
    _canPinMessage,
    _canReplyPrivately,
    _isDeleteable: message.isDeleteable,
    _isEditable: message.isEditable,
    _participants: meta.participants,
    _teamname: meta.teamname,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAddReaction: (message: Types.Message) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: message.conversationIDKey, ordinal: message.ordinal},
            selected: 'chatChooseEmoji',
          },
        ],
      })
    )
  },
  _onCopy: (message: Types.Message) => {
    if (message.type === 'text') {
      dispatch(ConfigGen.createCopyToClipboard({text: message.text.stringValue()}))
    }
  },
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({conversationIDKey: message.conversationIDKey, ordinal: message.ordinal})
    ),
  _onDeleteMessageHistory: (message: Types.Message) => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey: message.conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  },
  _onEdit: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onKick: (teamname: string, username: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {navToChat: true, teamname, username}, selected: 'teamReallyRemoveMember'}],
      })
    ),
  _onPinMessage: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createPinMessage({
        conversationIDKey: message.conversationIDKey,
        messageID: message.id,
      })
    )
  },
  _onReply: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createToggleReplyToMessage({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onReplyPrivately: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageReplyPrivately({
        ordinal: message.ordinal,
        sourceConversationIDKey: message.conversationIDKey,
      })
    )
  },
  _onViewProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const message = ownProps.message
    const yourMessage = message.author === stateProps._you
    const isDeleteable = !!(stateProps._isDeleteable && (yourMessage || stateProps._canAdminDelete))
    const isEditable = !!(stateProps._isEditable && yourMessage)
    const canReplyPrivately = stateProps._canReplyPrivately
    const mapUnfurl = Constants.getMapUnfurl(message)
    const authorInConv = stateProps._participants.includes(message.author)
    const isLocation = !!mapUnfurl
    // don't pass onViewMap if we don't have a coordinate (e.g. when a location share ends)
    const onViewMap =
      mapUnfurl && mapUnfurl.mapInfo && !mapUnfurl.mapInfo.isLiveLocationDone
        ? () => openURL(mapUnfurl.url)
        : undefined
    return {
      attachTo: ownProps.attachTo,
      author: message.author,
      botUsername: message.type === 'text' ? message.botUsername : undefined,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt || undefined,
      deviceType: message.deviceType,
      isDeleteable,
      isEditable,
      isKickable: isDeleteable && !!stateProps._teamname && !yourMessage && authorInConv,
      isLocation,
      onAddReaction: Container.isMobile ? () => dispatchProps._onAddReaction(message) : undefined,
      onCopy: message.type === 'text' ? () => dispatchProps._onCopy(message) : undefined,
      onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : undefined,
      onDeleteMessageHistory: stateProps._canDeleteHistory
        ? () => dispatchProps._onDeleteMessageHistory(message)
        : undefined,
      onEdit: yourMessage && message.type === 'text' ? () => dispatchProps._onEdit(message) : undefined,
      onHidden: () => ownProps.onHidden(),
      onKick: () => dispatchProps._onKick(stateProps._teamname, message.author),
      onPinMessage: stateProps._canPinMessage ? () => dispatchProps._onPinMessage(message) : undefined,
      onReply: message.type === 'text' ? () => dispatchProps._onReply(message) : undefined,
      onReplyPrivately:
        !yourMessage && canReplyPrivately ? () => dispatchProps._onReplyPrivately(message) : undefined,
      onViewMap,
      onViewProfile:
        message.author && !yourMessage ? () => dispatchProps._onViewProfile(message.author) : undefined,
      position: ownProps.position,
      showDivider: !message.deviceRevokedAt,
      style: ownProps.style,
      timestamp: message.timestamp,
      visible: ownProps.visible,
      yourMessage,
    }
  },
  'MessagePopupText'
)(Text)
