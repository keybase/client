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
import Text from '.'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: Types.MessageWithReactionPopup
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
  const _participantsCount = meta.participants.count()
  return {
    _canAdminDelete,
    _canDeleteHistory,
    _isDeleteable: message.isDeleteable,
    _isEditable: message.isEditable,
    _participantsCount,
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
    const isDeleteable = stateProps._isDeleteable && (yourMessage || stateProps._canAdminDelete)
    const isEditable = stateProps._isEditable && yourMessage
    return {
      attachTo: ownProps.attachTo,
      author: message.author,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt || undefined,
      deviceType: message.deviceType,
      isDeleteable,
      isEditable,
      onAddReaction: Container.isMobile ? () => dispatchProps._onAddReaction(message) : undefined,
      onCopy: message.type === 'text' ? () => dispatchProps._onCopy(message) : undefined,
      onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : undefined,
      onDeleteMessageHistory: stateProps._canDeleteHistory
        ? () => dispatchProps._onDeleteMessageHistory(message)
        : undefined,
      onEdit: yourMessage && message.type === 'text' ? () => dispatchProps._onEdit(message) : undefined,
      onHidden: () => ownProps.onHidden(),
      onReply: message.type === 'text' ? () => dispatchProps._onReply(message) : undefined,
      onReplyPrivately:
        message.type === 'text' && !yourMessage && stateProps._participantsCount > 2
          ? () => dispatchProps._onReplyPrivately(message)
          : undefined,
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
