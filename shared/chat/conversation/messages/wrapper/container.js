// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import * as Types from '../../../../constants/types/chat2'
import Wrapper from '.'
import {connect, type TypedState} from '../../../../util/container'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

const howLongBetweenTimestampsMs = 1000 * 60 * 15

const mapStateToProps = (state: TypedState, {message, previous, innerClass, isEditing}) => {
  const isYou = state.config.username === message.author
  const isFollowing = state.config.following.has(message.author)
  const isBroken = state.users.infoMap.getIn([message.author, 'broken'], false)
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const orangeLineAbove = !!previous && meta.orangeLineOrdinal === previous.ordinal
  const messageSent = !message.submitState
  const messageFailed = message.submitState === 'failed'
  const messagePending = message.submitState === 'pending'
  const isExplodingUnreadable = message.explodingUnreadable

  return {
    innerClass,
    isBroken,
    isEditing,
    isExplodingUnreadable,
    isFollowing,
    isYou,
    message,
    messageFailed,
    messagePending,
    messageSent,
    orangeLineAbove,
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

const mergeProps = (stateProps, dispatchProps) => {
  const {message, previous} = stateProps

  const continuingTextBlock =
    previous &&
    previous.author === message.author &&
    (previous.type === 'text' || previous.type === 'deleted')

  const oldEnough = !!(
    previous &&
    previous.timestamp &&
    message.timestamp &&
    message.timestamp - previous.timestamp > howLongBetweenTimestampsMs
  )

  // Always show a timestamp if the previous message is a concise joined/left message
  const previousIsJoinedLeft = !!(
    previous &&
    (previous.type === 'systemJoined' || previous.type === 'systemLeft')
  )

  const timestamp =
    stateProps.orangeLineAbove || !previous || oldEnough || previousIsJoinedLeft
      ? formatTimeForMessages(message.timestamp)
      : null
  const includeHeader = !previous || !continuingTextBlock || !!timestamp
  let failureDescription = null
  if ((message.type === 'text' || message.type === 'attachment') && message.errorReason) {
    failureDescription = stateProps.isYou ? `Failed to send: ${message.errorReason}` : message.errorReason
  }

  return {
    author: message.author,
    exploded: message.exploded,
    explodedBy: message.explodedBy,
    explodesAt: message.explodingTime,
    exploding: message.exploding,
    failureDescription,
    includeHeader,
    innerClass: stateProps.innerClass,
    isBroken: stateProps.isBroken,
    isEdited: message.hasBeenEdited,
    isEditing: stateProps.isEditing,
    isExplodingUnreadable: stateProps.isExplodingUnreadable,
    isFollowing: stateProps.isFollowing,
    isRevoked: !!message.deviceRevokedAt,
    isYou: stateProps.isYou,
    message,
    messageFailed: stateProps.messageFailed,
    messagePending: stateProps.messagePending,
    messageSent: stateProps.messageSent,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onCancel: stateProps.isYou
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : null,
    onEdit: stateProps.isYou ? () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal) : null,
    onRetry: stateProps.isYou
      ? () => message.outboxID && dispatchProps._onRetry(message.conversationIDKey, message.outboxID)
      : null,
    orangeLineAbove: stateProps.orangeLineAbove,
    timestamp,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Wrapper)
