// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Route from '../../../../actions/route-tree'
import * as TrackerGen from '../../../../actions/tracker-gen'
import * as Types from '../../../../constants/types/chat2'
import Wrapper from '.'
import {connect, type TypedState} from '../../../../util/container'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

const howLongBetweenTimestampsMs = 1000 * 60 * 15

const mapStateToProps = (state: TypedState, {message, previous, innerClass, isSelected, isEditing}): * => {
  const isYou = state.config.username === message.author
  const isFollowing = state.config.following.has(message.author)
  const isBroken = state.users.infoMap.getIn([message.author, 'broken'], false)
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const hasOlderResetConversation = previous ? false : !!meta.supersedes
  const orangeLineAbove = !!previous && meta.orangeLineOrdinal === previous.ordinal

  return {
    hasOlderResetConversation,
    innerClass,
    isBroken,
    isEditing,
    isFollowing,
    isSelected,
    isYou,
    message,
    orangeLineAbove,
    previous,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAuthorClick: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  _onEdit: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal})),
  _onRetry: (conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID) =>
    dispatch(Chat2Gen.createMessageRetry({conversationIDKey, outboxID})),
  _onShowMenu: (targetRect: ?ClientRect, message: Types.Message) =>
    dispatch(
      Route.navigateAppend([
        {
          props: {message, position: 'bottom left', targetRect},
          selected: 'messageAction',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps) => {
  const {message, previous} = stateProps

  const continuingTextBlock =
    previous &&
    previous.author === message.author &&
    (previous.type === 'text' || previous.type === 'deleted')

  const oldEnough =
    previous &&
    previous.timestamp &&
    message.timestamp &&
    message.timestamp - previous.timestamp > howLongBetweenTimestampsMs

  const timestamp =
    stateProps.orangeLineAbove || !previous || oldEnough ? formatTimeForMessages(message.timestamp) : null
  const includeHeader = !previous || !continuingTextBlock || !!timestamp
  let loadMoreType = null
  if (!previous) {
    if (Constants.isOldestOrdinal(message.ordinal)) {
      loadMoreType = 'noMoreToLoad'
    } else {
      loadMoreType = 'moreToLoad'
    }
  }

  const failureDescription =
    message.type === 'text' || message.type === 'attachment' ? message.errorReason : null

  return {
    author: message.author,
    failureDescription,
    hasOlderResetConversation: stateProps.hasOlderResetConversation,
    includeHeader,
    innerClass: stateProps.innerClass,
    isBroken: stateProps.isBroken,
    isEdited: message.hasBeenEdited,
    isEditing: stateProps.isEditing,
    isFirstNewMessage: false, //  TODO
    isFollowing: stateProps.isFollowing,
    isRevoked: !!message.deviceRevokedAt,
    isSelected: stateProps.isSelected,
    isYou: stateProps.isYou,
    loadMoreType,
    message,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onEdit: () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal),
    onRetry: () => dispatchProps._onRetry(message.conversationIDKey, message.outboxID),
    onShowMenu: (clientRect: ?ClientRect) => dispatchProps._onShowMenu(clientRect, message),
    orangeLineAbove: stateProps.orangeLineAbove,
    timestamp,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wrapper)
