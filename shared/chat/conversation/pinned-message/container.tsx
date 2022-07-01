import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {getCanPerform} from '../../../constants/teams'
import {anyWaiting, connect, TypedState, TypedDispatch} from '../../../util/container'
import PinnedMessage from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const empty = {
  _canAdminDelete: false,
  _messageID: 0,
  _pinnerUsername: '',
  _you: '',
  author: '',
  imageHeight: undefined,
  imageURL: undefined,
  imageWidth: undefined,
  text: '',
  unpinning: false,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  if (!meta) {
    return empty
  }
  const pinnedMsg = meta.pinnedMsg
  if (!pinnedMsg) {
    return empty
  }
  const message = pinnedMsg.message
  if (!message || !(message.type === 'text' || message.type === 'attachment')) {
    return empty
  }
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canAdminDelete = yourOperations && yourOperations.deleteOtherMessages
  const attachment: Types.MessageAttachment | undefined =
    message.type === 'attachment' && message.attachmentType === 'image' ? message : undefined
  return {
    _canAdminDelete,
    _messageID: message.id,
    _pinnerUsername: pinnedMsg.pinnerUsername,
    _you: state.config.username,
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
    unpinning: anyWaiting(state, Constants.waitingKeyUnpin(ownProps.conversationIDKey)),
  }
}

const mapDispatchToProps = (dispatch: TypedDispatch, {conversationIDKey}: OwnProps) => ({
  _onClick: (messageID: Types.MessageID) =>
    dispatch(
      Chat2Gen.createReplyJump({
        conversationIDKey,
        messageID,
      })
    ),
  _onIgnore: () => dispatch(Chat2Gen.createIgnorePinnedMessage({conversationIDKey})),
  _onUnpin: () => dispatch(Chat2Gen.createUnpinMessage({conversationIDKey})),
})

export default connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
  const yourMessage = stateProps._pinnerUsername === stateProps._you
  const dismissUnpins = yourMessage || stateProps._canAdminDelete
  return {
    author: stateProps.author,
    dismissUnpins,
    imageHeight: stateProps.imageHeight,
    imageURL: stateProps.imageURL,
    imageWidth: stateProps.imageWidth,
    onClick: () => dispatchProps._onClick(stateProps._messageID),
    onDismiss: dismissUnpins ? dispatchProps._onUnpin : dispatchProps._onIgnore,
    text: stateProps.text,
    unpinning: stateProps.unpinning,
  }
})(PinnedMessage)
