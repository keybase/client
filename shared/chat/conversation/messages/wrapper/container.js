// @flow
// import * as Chat2Gen from '../../../../actions/chat2-gen'
// import {lookupMessageProps} from '../../../shared'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import Wrapper from '.'
import {connect, type TypedState} from '../../../../util/container'
import {createGetProfile} from '../../../../actions/tracker-gen'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'
import {navigateAppend} from '../../../../actions/route-tree'

const howLongBetweenTimestampsMs = 1000 * 60 * 15

const mapStateToProps = (state: TypedState, {message, previous, innerClass, isSelected}) => {
  // const _conversationState = Constants.getSelectedConversationStates(state)
  // const selectedConversationIDKey = Constants.getSelectedConversation(state)

  // const {message, localMessageState} = lookupMessageProps(state, messageKey)
  // if (!message) {
  // throw new Error(`Can't find message for wrapper ${messageKey}`)
  // }
  // const author = message.author
  // const isYou = Constants.getYou(state) === author
  // const isFollowing = Constants.getFollowing(state).has(author)
  // const isBroken = Constants.getMetaDataMap(state).getIn([author, 'brokenTracker'], false)

  // const {message: _prevMessage} = lookupMessageProps(state, prevMessageKey)
  // const isEditing = message === Constants.getEditingMessage(state)
  // const _editedCount: number =
  // Constants.getMessageUpdateCount(state, message.type, message.key) + message.editedCount

  return {
    innerClass,
    isSelected,
    message,
    previous,
    // _conversationState,
    // _localMessageState: localMessageState,
    // _message: message,
    // _prevMessage,
    // _selectedConversationIDKey: selectedConversationIDKey,
    // _editedCount,
    // author,
    // isBroken,
    // isEditing,
    // isFollowing,
    // isYou,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // _onRetryAttachment: (message: Types.AttachmentMessage) =>
  // dispatch(ChatGen.createRetryAttachment({message})),
  // _onRetryText: (conversationIDKey: Types.ConversationIDKey, outboxIDKey: Types.OutboxIDKey) =>
  // dispatch(ChatGen.createRetryMessage({conversationIDKey, outboxIDKey})),
  _onAuthorClick: (username: string) =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  _onShowMenu: (targetRect: ?ClientRect, message: Types.Message) =>
    dispatch(
      navigateAppend([
        {
          props: {message, position: 'bottom left', targetRect},
          selected: 'messageAction',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps) => {
  // const message = stateProps._message
  // const prevMessage = stateProps._prevMessage
  // const conversationState = stateProps._conversationState

  // const isEdited = message.type === 'Text' && stateProps._editedCount > 0
  // const isRevoked = !!message.senderDeviceRevokedAt
  // const failureDescription = message.messageState === 'failed' ? message.failureDescription : null

  // const isFirstNewMessage = !!(
  // conversationState &&
  // message &&
  // message.messageID &&
  // conversationState.get('firstNewMessageID') === message.messageID
  // )

  // const skipMsgHeader = prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author

  // const firstMessageEver = !prevMessage
  // const firstVisibleMessage = prevMessage && Constants.messageKeyValue(prevMessage.key) === '1'

  // const oldEnough =
  // prevMessage &&
  // prevMessage.timestamp &&
  // message.timestamp &&
  // message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs
  // const timestamp =
  // firstMessageEver || firstVisibleMessage || oldEnough ? formatTimeForMessages(message.timestamp) : null
  // const includeHeader = isFirstNewMessage || !skipMsgHeader || !!timestamp

  // return {
  // _editedCount: stateProps._editedCount,
  // _localMessageState: stateProps._localMessageState,
  // _message: stateProps._message,
  // _onAction: ownProps.onAction,
  // _onShowEditor: ownProps.onShowEditor,
  // _onUsernameClick: dispatchProps._onUsernameClick,
  // author: stateProps.author,
  // failureDescription,
  // includeHeader,
  // innerClass: ownProps.innerClass,
  // isBroken: stateProps.isBroken,
  // isEdited,
  // isEditing: stateProps.isEditing,
  // isFirstNewMessage,
  // isFollowing: stateProps.isFollowing,
  // isRevoked,
  // isSelected: ownProps.isSelected,
  // isYou: stateProps.isYou,
  // messageKey: ownProps.messageKey,
  // onRetry: () => {
  // if (stateProps._message.type === 'Attachment') {
  // dispatchProps._onRetryAttachment(stateProps._message)
  // } else if (stateProps._selectedConversationIDKey && stateProps._message.outboxID) {
  // dispatchProps._onRetryText(stateProps._selectedConversationIDKey, stateProps._message.outboxID)
  // }
  // },
  // timestamp,
  // }
  //
  //
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

  const timestamp = !previous || oldEnough ? formatTimeForMessages(message.timestamp) : null
  const includeHeader = !previous || !continuingTextBlock || !!timestamp
  let loadMoreType = null
  if (!previous) {
    if (Constants.isOldestOrdinal(message.ordinal)) {
      loadMoreType = 'noMoreToLoad'
    } else {
      loadMoreType = 'moreToLoad'
    }
  }

  return {
    author: message.author,
    failureDescription: null,
    includeHeader,
    innerClass: stateProps.innerClass,
    isBroken: false, // TODO stateProps.isBroken,
    isEdited: message.isEdited,
    isEditing: false, // stateProps.isEditing,
    isFirstNewMessage: false, // ,
    isFollowing: false, // stateProps.isFollowing,
    isRevoked: false,
    isSelected: stateProps.isSelected,
    isYou: false, // stateProps.isYou,
    loadMoreType,
    message,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onShowMenu: (clientRect: ?ClientRect) => dispatchProps._onShowMenu(clientRect, message),
    timestamp,
  }
}

// $FlowIssue TODO cleanup
export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wrapper)
// withHandlers({
// onAction: props => event => props._onAction(props._message, props._localMessageState, event),
// onShowEditor: props => event => props._onShowEditor(props._message, event),
// onClick: props => () => props._onUsernameClick(props.author),
// }),
// )(Wrapper)
