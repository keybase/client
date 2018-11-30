// @flow
import WrapperMessage from '.'
import * as Constants from '../../../../constants/chat2'
import * as MessageConstants from '../../../../constants/chat2/message'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  measure: ?() => void,
  ordinal: Types.Ordinal,
  previous: ?Types.Ordinal,
|}

// If there is no matching message treat it like a deleted
const missingMessage = MessageConstants.makeMessageDeleted({})

const mapStateToProps = (state, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal) || missingMessage
  const previous = ownProps.previous
    ? Constants.getMessage(state, ownProps.conversationIDKey, ownProps.previous)
    : null
  const orangeLineAbove = state.chat2.orangeLineMap.get(ownProps.conversationIDKey) === message.id
  const unfurlPrompts =
    message.type === 'text'
      ? state.chat2.unfurlPromptMap.getIn([message.conversationIDKey, message.id])
      : null

  return {
    _you: state.config.username,
    conversationIDKey: ownProps.conversationIDKey,
    hasUnfurlPrompts: !!unfurlPrompts && !unfurlPrompts.isEmpty(),
    message,
    orangeLineAbove,
    previous,
    shouldShowPopup: Constants.shouldShowPopup(state, message),
  }
}

const mapDisaptchToProps = dispatch => ({
  _onAuthorClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
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
  const {previous, message} = stateProps

  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    authorIsCollapsible(message) &&
    authorIsCollapsible(previous)

  const enoughTimeBetween = MessageConstants.enoughTimeBetweenMessages(message, previous)
  const timestamp = stateProps.orangeLineAbove || !previous || enoughTimeBetween ? message.timestamp : null
  let showUsername = ''
  switch (message.type) {
    case 'attachment':
    case 'requestPayment':
    case 'sendPayment':
    case 'text':
    case 'setChannelname':
      showUsername = !previous || !sequentialUserMessages || !!timestamp ? message.author : ''
      break
    case 'systemAddedToTeam':
      showUsername = message.addee
      break
  }
  // $ForceType
  const outboxID = message.outboxID

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
    !!outboxID && !!stateProps._you && failureDescription === 'Failed to send: message is too long'

  // $ForceType
  if (message.explodingUnreadable) {
    failureDescription = 'This exploding message is not available to you.'
  }

  // show send only if its possible we sent while you're looking at it
  const showSendIndicator = stateProps._you === message.author && message.ordinal !== message.id

  let decorate = false
  switch (message.type) {
    case 'text':
      decorate = !message.exploded && !message.errorReason
      break
    case 'attachment':
      decorate = !message.exploded && !message.errorReason
      break
    case 'requestPayment':
    case 'sendPayment':
    case 'systemAddedToTeam':
    case 'systemLeft':
      decorate = true
      break
    case 'systemJoined':
      decorate = message.author !== stateProps._you
      break
  }

  return {
    conversationIDKey: stateProps.conversationIDKey,
    decorate,
    exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
    failureDescription,
    hasUnfurlPrompts: stateProps.hasUnfurlPrompts,
    isRevoked: (message.type === 'text' || message.type === 'attachment') && !!message.deviceRevokedAt,
    showUsername,
    measure: ownProps.measure,
    message: message,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onCancel: allowCancelRetry
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : null,
    onEdit: resolveByEdit ? () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal) : null,
    onRetry:
      allowCancelRetry && !resolveByEdit && outboxID
        ? () => dispatchProps._onRetry(message.conversationIDKey, outboxID)
        : null,
    orangeLineAbove: stateProps.orangeLineAbove,
    previous: stateProps.previous,
    shouldShowPopup: stateProps.shouldShowPopup,
    showSendIndicator,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDisaptchToProps,
  mergeProps,
  'WrapperMessage'
)(WrapperMessage)
