import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import {StylesCrossPlatform} from '../../../../../styles'
import EmojiRow from '.'

type OwnProps = {
  className?: string
  conversationIDKey: Types.ConversationIDKey
  onShowingEmojiPicker?: (arg0: boolean) => void
  ordinal: Types.Ordinal
  style?: StylesCrossPlatform
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  topReacjis: state.chat2.userReacjis.topReacjis,
})

const mapDispatchToProps = dispatch => ({
  _onReact: (emoji, conversationIDKey, ordinal) =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
  _onReply: (conversationIDKey, ordinal) =>
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  className: ownProps.className,
  emojis: stateProps.topReacjis.slice(0, 5),
  onReact: emoji => dispatchProps._onReact(emoji, ownProps.conversationIDKey, ownProps.ordinal),
  onReply: () => dispatchProps._onReply(ownProps.conversationIDKey, ownProps.ordinal),
  onShowingEmojiPicker: ownProps.onShowingEmojiPicker,
  style: ownProps.style,
})

const ConnectedEmojiRow = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEmojiRow'
)(EmojiRow)

export default ConnectedEmojiRow
