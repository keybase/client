// @flow
import type {Component} from 'react'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as Route from '../../../../../actions/route-tree'
import * as Container from '../../../../../util/container'
import {createShowUserProfile} from '../../../../../actions/profile-gen'
import {getCanPerform} from '../../../../../constants/teams'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import Text from '.'

type OwnProps = {
  attachTo: ?Component<any, any>,
  message: Types.MessageText,
  onHidden: () => void,
  position: Position,
  visible: boolean,
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canDeleteHistory = yourOperations && yourOperations.deleteChatHistory
  const _participantsCount = meta.participants.count()
  return {
    _canDeleteHistory,
    _participantsCount,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAddReaction: (message: Types.Message) => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey: message.conversationIDKey, ordinal: message.ordinal},
          selected: 'chooseEmoji',
        },
      ])
    )
  },
  _onCopy: (message: Types.Message) => {
    if (message.type === 'text') {
      dispatch(ConfigGen.createCopyToClipboard({text: message.text.stringValue()}))
    }
  },
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    ),
  _onDeleteMessageHistory: (message: Types.Message) => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(
      Route.navigateAppend([
        {props: {conversationIDKey: message.conversationIDKey}, selected: 'deleteHistoryWarning'},
      ])
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
  _onQuote: (message: Types.Message) => {
    if (message.type === 'text') {
      dispatch(
        Chat2Gen.createMessageSetQuoting({
          ordinal: message.ordinal,
          sourceConversationIDKey: message.conversationIDKey,
          targetConversationIDKey: message.conversationIDKey,
        })
      )
    }
  },
  _onReplyPrivately: (message: Types.Message) => {
    if (message.type === 'text' && message.author && message.text) {
      dispatch(
        Chat2Gen.createMessageReplyPrivately({
          ordinal: message.ordinal,
          sourceConversationIDKey: message.conversationIDKey,
        })
      )
    }
  },
  _onViewProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.message
  const yourMessage = message.author === stateProps._you
  return {
    attachTo: ownProps.attachTo,
    author: message.author,
    deviceName: message.deviceName,
    deviceRevokedAt: message.deviceRevokedAt,
    deviceType: message.deviceType,
    onAddReaction: Container.isMobile ? () => dispatchProps._onAddReaction(message) : null,
    onCopy: () => dispatchProps._onCopy(message),
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onDeleteMessageHistory: stateProps._canDeleteHistory
      ? () => dispatchProps._onDeleteMessageHistory(message)
      : null,
    onEdit: yourMessage && message.type === 'text' ? () => dispatchProps._onEdit(message) : null,
    onHidden: () => ownProps.onHidden(),
    onQuote: message.type === 'text' && !yourMessage ? () => dispatchProps._onQuote(message) : null,
    onReplyPrivately:
      message.type === 'text' && !yourMessage && stateProps._participantsCount > 2
        ? () => dispatchProps._onReplyPrivately(message)
        : null,
    onViewProfile: message.author && !yourMessage ? () => dispatchProps._onViewProfile(message.author) : null,
    position: ownProps.position,
    showDivider: !message.deviceRevokedAt,
    timestamp: message.timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
}

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.setDisplayName('MessagePopupText')
)(Text)
