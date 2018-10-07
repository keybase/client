// @flow
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../../actions/profile-gen'
import * as TrackerGen from '../../../../../actions/tracker-gen'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import * as MessageConstants from '../../../../../constants/chat2/message'
import WrapperAuthor from '.'
import {setDisplayName, compose, connect, type TypedState} from '../../../../../util/container'
import {isMobile} from '../../../../../constants/platform'

type OwnProps = {|
  isEditing: boolean,
  measure: null | (() => void),
  message: Types.DecoratedMessage,
  previous: ?Types.Message,
  toggleMessageMenu: () => void,
|}

const mapStateToProps = (state: TypedState, {message, previous, isEditing}: OwnProps) => {
  const isYou = state.config.username === message.author
  const isFollowing = state.config.following.has(message.author)
  const isBroken = state.users.infoMap.getIn([message.author, 'broken'], false)
  const orangeLineMessageID = state.chat2.orangeLineMap.get(message.conversationIDKey)
  const lastPositionExists = orangeLineMessageID === message.id

  // text and attachment messages have a bunch of info about the status.
  // payments don't.
  let messageSent, messageFailed, messagePending, isExplodingUnreadable
  if (message.type === 'text' || message.type === 'attachment') {
    messageSent = !message.submitState
    messageFailed = message.submitState === 'failed'
    messagePending = message.submitState === 'pending'
    isExplodingUnreadable = message.explodingUnreadable
  } else {
    messageSent = true
    messageFailed = false
    messagePending = false
    isExplodingUnreadable = false
  }

  return {
    isBroken,
    isEditing,
    isExplodingUnreadable,
    isFollowing,
    isYou,
    lastPositionExists,
    message,
    messageFailed,
    messagePending,
    messageSent,
    previous,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAuthorClick: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  _onCancel: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageDelete({conversationIDKey, ordinal})),
  _onEdit: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal})),
  _onRetry: (conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID) =>
    dispatch(Chat2Gen.createMessageRetry({conversationIDKey, outboxID})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {message, previous} = stateProps

  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    Constants.authorIsCollapsible(message) &&
    Constants.authorIsCollapsible(previous)

  const showAuthor = MessageConstants.enoughTimeBetweenMessages(message, previous)

  const timestamp = stateProps.lastPositionExists || !previous || showAuthor ? message.timestamp : null

  const includeHeader = !previous || !sequentialUserMessages || !!timestamp

  let failureDescription = ''
  let isErrorFixable = false
  if ((message.type === 'text' || message.type === 'attachment') && message.errorReason) {
    failureDescription = message.errorReason
    if (stateProps.isYou && message.submitState === 'pending') {
      // This is a message still in the outbox, we can retry/edit to fix
      failureDescription = stateProps.isYou ? `Failed to send: ${message.errorReason}` : message.errorReason
      isErrorFixable = true
    }
  }

  // Properties that are different between request/payment and text/attachment
  let exploded = false
  let explodedBy = ''
  let explodesAt = 0
  let exploding = false
  let isEdited = false
  if (message.type === 'text' || message.type === 'attachment') {
    exploded = message.exploded
    explodedBy = message.explodedBy
    explodesAt = message.explodingTime
    exploding = message.exploding
    isEdited = message.hasBeenEdited
  }

  return {
    author: message.author,
    conversationIDKey: message.conversationIDKey,
    exploded,
    explodedBy,
    explodesAt,
    exploding,
    failureDescription,
    includeHeader,
    isBroken: stateProps.isBroken,
    isEdited,
    isEditing: stateProps.isEditing,
    isExplodingUnreadable: stateProps.isExplodingUnreadable,
    isFollowing: stateProps.isFollowing,
    isYou: stateProps.isYou,
    measure: ownProps.measure,
    message,
    messageFailed: stateProps.messageFailed,
    // `messageKey` should be unique for the message as long
    // as threads aren't switched
    messageKey: Constants.getMessageKey(message),
    messagePending: stateProps.messagePending,
    messageSent: stateProps.messageSent,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onCancel: isErrorFixable
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : null,
    onEdit: stateProps.isYou ? () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal) : null,
    onRetry: isErrorFixable
      ? () => {
          message.outboxID && dispatchProps._onRetry(message.conversationIDKey, message.outboxID)
        }
      : null,
    ordinal: message.ordinal,
    timestamp: message.timestamp,
    toggleMessageMenu: ownProps.toggleMessageMenu,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('WrapperAuthor')
)(WrapperAuthor)
