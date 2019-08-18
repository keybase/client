import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {connect, TypedState, TypedDispatch} from '../../../util/container'
import PinnedMessage from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const empty = {
  _messageID: 0,
  author: '',
  imageHeight: undefined,
  imageURL: undefined,
  imageWidth: undefined,
  text: '',
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  if (!meta) {
    return empty
  }
  const message = meta.pinnedMsg
  if (!message || !(message.type === 'text' || message.type === 'attachment')) {
    return empty
  }
  const attachment: Types.MessageAttachment | undefined =
    message.type === 'attachment' && message.attachmentType === 'image' ? message : undefined
  return {
    _messageID: message.id,
    author: message.author,
    imageHeight: attachment ? attachment.previewHeight : undefined,
    imageURL: attachment ? attachment.previewURL : undefined,
    imageWidth: attachment ? attachment.previewWidth : undefined,
    text:
      message.type === 'text'
        ? message.decoratedText
          ? message.decoratedText.stringValue()
          : ''
        : message.title || message.fileName,
  }
}

const mapDispatchToProps = (dispatch: TypedDispatch, {conversationIDKey}: OwnProps) => ({
  _onClick: (messageID: Types.MessageID) =>
    dispatch(
      Chat2Gen.createReplyJump({
        conversationIDKey: conversationIDKey,
        messageID,
      })
    ),
})

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>
) => ({
  author: stateProps.author,
  imageHeight: stateProps.imageHeight,
  imageURL: stateProps.imageURL,
  imageWidth: stateProps.imageWidth,
  onClick: () => dispatchProps._onClick(stateProps._messageID),
  onDismiss: () => {},
  text: stateProps.text,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(PinnedMessage)
