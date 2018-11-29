// @flow
import * as React from 'react'
import WrapperMessage from '.'
import * as Constants from '../../../../constants/chat2'
import * as MessageConstants from '../../../../constants/chat2/message'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import {namedConnect} from '../../../../util/container'

export type OwnProps = {|
  children?: React.Node,
  isEditing: boolean,
  measure: null | (() => void),
  message: Types.Message,
  previous: ?Types.Message,
  decorate?: boolean,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const messageIDWithOrangeLine = state.chat2.orangeLineMap.get(ownProps.message.conversationIDKey)
  const unfurlPrompts =
    ownProps.message.type === 'text'
      ? state.chat2.unfurlPromptMap.getIn([ownProps.message.conversationIDKey, ownProps.message.id])
      : null
  return {
    _you: state.config.username || '',
    conversationIDKey: ownProps.message.conversationIDKey,
    hasUnfurlPrompts: !!unfurlPrompts && !unfurlPrompts.isEmpty(),
    orangeLineAbove: messageIDWithOrangeLine === ownProps.message.id,
    ordinal: ownProps.message.ordinal,
    previous: ownProps.previous,
    shouldShowPopup: Constants.shouldShowPopup(state, ownProps.message),
  }
}

const mapDisaptchToProps = dispatch => ({
  _onAuthorClick: (username: string) =>
    // isMobile
    /* ? */ dispatch(ProfileGen.createShowUserProfile({username})),
  // : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  _onCancel: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageDelete({conversationIDKey, ordinal})),
  _onEdit: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal})),
  _onRetry: (conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID) =>
    dispatch(Chat2Gen.createMessageRetry({conversationIDKey, outboxID})),
})

// Used to decide whether to show the author for sequential messages
const authorIsCollapsible = (m: Types.Message) =>
  m.type === 'text' || m.type === 'deleted' || m.type === 'attachment'

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {ordinal, previous} = stateProps
  const {message} = ownProps

  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    authorIsCollapsible(message) &&
    authorIsCollapsible(previous)

  const enoughTimeBetween = MessageConstants.enoughTimeBetweenMessages(message, previous)
  const timestamp = stateProps.orangeLineAbove || !previous || enoughTimeBetween ? message.timestamp : null
  const isShowingUsername = !previous || !sequentialUserMessages || !!timestamp

  // const decorate = shouldDecorateMessage(message, stateProps._you)

  let failureDescription = ''
  let allowCancelRetry = false
  if ((message.type === 'text' || message.type === 'attachment') && message.errorReason) {
    failureDescription = message.errorReason
    if (stateProps._you && ['pending', 'failed'].includes(message.submitState)) {
      // This is a message still in the outbox, we can retry/edit to fix
      failureDescription = `Failed to send: ${message.errorReason}`
      allowCancelRetry = true
    }
  }
  const resolveByEdit: boolean =
    // $ForceType
    message.outboxID && stateProps._you && failureDescription === 'Failed to send: message is too long'

  // $ForceType
  if (message.explodingUnreadable) {
    failureDescription = 'This exploding message is not available to you.'
  }

  return {
    children: ownProps.children,
    conversationIDKey: stateProps.conversationIDKey,
    decorate: ownProps.decorate,
    exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
    failureDescription,
    hasUnfurlPrompts: stateProps.hasUnfurlPrompts,
    isEditing: ownProps.isEditing,
    isRevoked: (message.type === 'text' || message.type === 'attachment') && !!message.deviceRevokedAt,
    isShowingUsername,
    measure: ownProps.measure,
    message: message,
    orangeLineAbove: stateProps.orangeLineAbove,
    ordinal,
    previous: ownProps.previous,
    shouldShowPopup: stateProps.shouldShowPopup,
    showSendIndicator: stateProps._you === message.author,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onCancel: allowCancelRetry
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : null,
    onEdit: resolveByEdit ? () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal) : null,
    onRetry:
      allowCancelRetry && !resolveByEdit
        ? () => dispatchProps._onRetry(message.conversationIDKey, message.outboxID)
        : null,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDisaptchToProps,
  mergeProps,
  'WrapperMessage'
)(WrapperMessage)
