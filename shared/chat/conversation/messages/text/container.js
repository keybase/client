// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import TextMessage from '.'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|
  message: Types.MessageText,
|}

const getReplyProps = (replyTo, onReplyClick) => {
  if (!replyTo || replyTo.type !== 'text') {
    return undefined
  }
  return {
    onClick: () => onReplyClick(replyTo.id),
    text: replyTo.text.stringValue(),
    username: replyTo.author,
  }
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const editInfo = Constants.getEditInfo(state, ownProps.message.conversationIDKey)
  const isEditing = !!(editInfo && editInfo.ordinal === ownProps.message.ordinal)
  return {isEditing}
}

const mapDispatchToProps = (dispatch, {message}: OwnProps) => ({
  _onReplyClick: messageID =>
    dispatch(
      Chat2Gen.createLoadMessagesFromSearchHit({conversationIDKey: message.conversationIDKey, messageID})
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  isEditing: stateProps.isEditing,
  message: ownProps.message,
  reply: getReplyProps(ownProps.message.replyTo, dispatchProps._onReplyClick),
  text: ownProps.message.decoratedText
    ? ownProps.message.decoratedText.stringValue()
    : ownProps.message.text.stringValue(),
  type: ownProps.message.errorReason ? 'error' : ownProps.message.submitState === null ? 'sent' : 'pending',
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TextMessage'
)(TextMessage)
