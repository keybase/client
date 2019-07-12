import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import ReplyPreview from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state: Container.TypedState, {conversationIDKey}) => {
  const ordinal = Constants.getReplyToOrdinal(state, conversationIDKey)
  const message = ordinal ? Constants.getMessage(state, conversationIDKey, ordinal) : null
  let text = ''
  if (message) {
    switch (message.type) {
      case 'text':
        text = message.text.stringValue()
        break
      case 'attachment':
        text = message.title || (message.attachmentType === 'image' ? '' : message.fileName)
        break
    }
  }
  let attachment: Types.MessageAttachment | undefined
  if (message && message.type === 'attachment') {
    if (message.attachmentType === 'image') {
      attachment = message
    }
  }
  return {
    imageHeight: attachment ? attachment.previewHeight : undefined,
    imageURL: attachment ? attachment.previewURL : undefined,
    imageWidth: attachment ? attachment.previewWidth : undefined,
    text,
    username: message ? message.author : '',
  }
}

export default Container.namedConnect(
  mapStateToProps,
  (dispatch, {conversationIDKey}: OwnProps) => ({
    onCancel: () => dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey})),
  }),
  (s, d, _: OwnProps) => ({...s, ...d}),
  'ReplyPreview'
)(ReplyPreview)
