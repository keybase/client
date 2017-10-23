// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Wrapper, {type Props} from '.'
import {compose, withHandlers, lifecycle, connect, type TypedState} from '../../../../util/container'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {lookupMessageProps} from '../../../shared'
import {showUserProfile} from '../../../../actions/profile'
import {getProfile} from '../../../../actions/tracker'
import {isMobile} from '../../../../constants/platform'
import {type OwnProps, type StateProps, type DispatchProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey, prevMessageKey}: OwnProps): StateProps => {
  const _conversationState = Constants.getSelectedConversationStates(state)
  const selectedConversationIDKey = Constants.getSelectedConversation(state)

  const {message, localMessageState} = lookupMessageProps(state, messageKey)
  if (!message) {
    throw new Error(`Can't find message for wrapper ${messageKey}`)
  }
  const author = message.author
  const isYou = Constants.getYou(state) === author
  const isFollowing = !!Constants.getFollowingMap(state)[author]
  const isBroken = Constants.getMetaDataMap(state).getIn([author, 'brokenTracker'], false)

  const {message: _prevMessage} = lookupMessageProps(state, prevMessageKey)
  const isEditing = message === Constants.getEditingMessage(state)
  const _editedCount: number = Constants.getMessageUpdateCount(state, message) + message.editedCount

  return {
    _conversationState,
    _localMessageState: localMessageState,
    _message: message,
    _prevMessage,
    _selectedConversationIDKey: selectedConversationIDKey,
    _editedCount,
    author,
    isBroken,
    isEditing,
    isFollowing,
    isYou,
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _onRetryAttachment: (message: Constants.AttachmentMessage) => dispatch(Creators.retryAttachment(message)),
  _onRetryText: (conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey) =>
    dispatch(Creators.retryMessage(conversationIDKey, outboxID)),
  _onUsernameClick: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  const message = stateProps._message
  const prevMessage = stateProps._prevMessage
  const conversationState = stateProps._conversationState

  const isEdited = message.type === 'Text' && stateProps._editedCount > 0
  const isRevoked = !!message.senderDeviceRevokedAt
  const failureDescription = message.messageState === 'failed' ? message.failureDescription : null

  const isFirstNewMessage = !!(conversationState &&
    message &&
    message.messageID &&
    conversationState.get('firstNewMessageID') === message.messageID)

  const skipMsgHeader = prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author

  const firstMessageEver = !prevMessage
  const firstVisibleMessage = prevMessage && Constants.messageKeyValue(prevMessage.key) === '1'

  const oldEnough =
    prevMessage &&
    prevMessage.timestamp &&
    message.timestamp &&
    message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs
  const timestamp = firstMessageEver || firstVisibleMessage || oldEnough
    ? formatTimeForMessages(message.timestamp)
    : null
  const includeHeader = isFirstNewMessage || !skipMsgHeader || !!timestamp

  return {
    _editedCount: stateProps._editedCount,
    _localMessageState: stateProps._localMessageState,
    _message: stateProps._message,
    _onAction: ownProps.onAction,
    _onShowEditor: ownProps.onShowEditor,
    _onUsernameClick: dispatchProps._onUsernameClick,
    author: stateProps.author,
    failureDescription,
    includeHeader,
    innerClass: ownProps.innerClass,
    isBroken: stateProps.isBroken,
    isEdited,
    isEditing: stateProps.isEditing,
    isFirstNewMessage,
    isFollowing: stateProps.isFollowing,
    isRevoked,
    isSelected: ownProps.isSelected,
    isYou: stateProps.isYou,
    measure: ownProps.measure,
    messageKey: ownProps.messageKey,
    onRetry: () => {
      if (stateProps._message.type === 'Attachment') {
        dispatchProps._onRetryAttachment(stateProps._message)
      } else if (stateProps._selectedConversationIDKey && stateProps._message.outboxID) {
        dispatchProps._onRetryText(stateProps._selectedConversationIDKey, stateProps._message.outboxID)
      }
    },
    timestamp,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withHandlers({
    onAction: props => event => props._onAction(props._message, props._localMessageState, event),
    onShowEditor: props => event => props._onShowEditor(props._message, event),
    onClick: props => () => props._onUsernameClick(props.author),
  }),
  lifecycle({
    componentDidUpdate: function(prevProps: Props & {_editedCount: number}) {
      if (
        this.props._editedCount !== prevProps._editedCount ||
        this.props.isFirstNewMessage !== prevProps.isFirstNewMessage ||
        this.props.timestamp !== prevProps.timestamp
      ) {
        this.props.measure && this.props.measure()
      }
    },
  })
)(Wrapper)
