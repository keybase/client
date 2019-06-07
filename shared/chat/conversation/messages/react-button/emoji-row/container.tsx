import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import getEmojis from './data'
import {StylesCrossPlatform} from '../../../../../styles'
import EmojiRow from '.'

const hr = 1000 * 60 * 60
const min = 1000 * 60
const currentMinute = () => Math.floor((Date.now() % hr) / min)

type OwnProps = {
  className?: string
  conversationIDKey: Types.ConversationIDKey
  onShowingEmojiPicker?: (arg0: boolean) => void
  ordinal: Types.Ordinal
  style?: StylesCrossPlatform
}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  _onReact: (emoji, conversationIDKey, ordinal) =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
  _onReply: (conversationIDKey, ordinal) =>
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  className: ownProps.className,
  // @ts-ignore cache busting that isn't typed
  emojis: getEmojis(currentMinute()).slice(0, 5),
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
