import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import {StylesCrossPlatform} from '../../../../../styles'
import EmojiRow from '.'

type OwnProps = {
  className?: string
  conversationIDKey: Types.ConversationIDKey
  onShowingEmojiPicker?: (arg0: boolean) => void
  ordinal: Types.Ordinal
  style?: StylesCrossPlatform
}

const ConnectedEmojiRow = Container.namedConnect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
    return {
      _messageType: message ? message.type : undefined,
      topReacjis: state.chat2.userReacjis.topReacjis,
    }
  },
  dispatch => ({
    _onReact: (emoji: string, conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
    _onReply: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    className: ownProps.className,
    emojis: stateProps.topReacjis.slice(0, 5),
    onReact: (emoji: string) => dispatchProps._onReact(emoji, ownProps.conversationIDKey, ownProps.ordinal),
    onReply:
      stateProps._messageType === 'text' || stateProps._messageType === 'attachment'
        ? () => dispatchProps._onReply(ownProps.conversationIDKey, ownProps.ordinal)
        : undefined,
    onShowingEmojiPicker: ownProps.onShowingEmojiPicker,
    style: ownProps.style,
  }),
  'ConnectedEmojiRow'
)(EmojiRow)

export default ConnectedEmojiRow
