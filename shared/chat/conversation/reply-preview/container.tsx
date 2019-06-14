import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import {namedConnect} from '../../../util/container'
import ReplyPreview from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const ordinal = Constants.getReplyToOrdinal(state, conversationIDKey)
  const message = ordinal ? Constants.getMessage(state, conversationIDKey, ordinal) : null
  const text =
    message && message.type === 'text'
      ? message.text.stringValue()
      : message.type === 'attachment'
      ? message.title || (message.attachmentType === 'image' ? '' : message.fileName)
      : ''
  const attachment: Types.MessageAttachment =
    message.type === 'attachment' && message.attachmentType === 'image' ? message : null
  return {
    imageHeight: attachment ? attachment.previewHeight : undefined,
    imageURL: attachment ? attachment.previewURL : undefined,
    imageWidth: attachment ? attachment.previewWidth : undefined,
    text,
    username: message ? message.author : '',
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  onCancel: () => dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey})),
})

export default namedConnect(mapStateToProps, mapDispatchToProps, (s, d) => ({...s, ...d}), 'ReplyPreview')(
  ReplyPreview
)
