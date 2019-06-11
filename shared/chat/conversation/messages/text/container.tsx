import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import TextMessage, {Props} from '.'
import * as Container from '../../../../util/container'

type OwnProps = {
  message: Types.MessageText
}

const replyNoop = () => {}

const getReplyProps = (replyTo, onReplyClick) => {
  if (!replyTo) {
    return undefined
  }
  const deletedProps = {
    deleted: true,
    edited: false,
    onClick: replyNoop,
    text: '',
    username: '',
  }
  switch (replyTo.type) {
    case 'text':
      return replyTo.exploded
        ? deletedProps
        : {
            deleted: false,
            edited: replyTo.hasBeenEdited,
            onClick: () => onReplyClick(replyTo.id),
            text: replyTo.text.stringValue(),
            username: replyTo.author,
          }
    case 'deleted':
    case 'placeholder':
      return deletedProps
  }
  return undefined
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const editInfo = Constants.getEditInfo(state, ownProps.message.conversationIDKey)
  const isEditing = !!(editInfo && editInfo.ordinal === ownProps.message.ordinal)
  return {isEditing}
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {message}: OwnProps) => ({
  _onReplyClick: (messageID: Types.MessageID) =>
    dispatch(
      Chat2Gen.createReplyJump({
        conversationIDKey: message.conversationIDKey,
        messageID,
      })
    ),
})

type MsgType = Props['type']
export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    isEditing: stateProps.isEditing,
    message: ownProps.message,
    reply: getReplyProps(ownProps.message.replyTo, dispatchProps._onReplyClick),
    text: ownProps.message.decoratedText
      ? ownProps.message.decoratedText.stringValue()
      : ownProps.message.text.stringValue(),
    type: (ownProps.message.errorReason ? 'error' : ownProps.message.submitState === null ? 'sent' : 'pending') as MsgType,
  }),
  'TextMessage'
)(TextMessage)