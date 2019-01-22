// @flow
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import getEmojis from './data'
import type {StylesCrossPlatform} from '../../../../../styles'
import EmojiRow from '.'

const hr = 1000 * 60 * 60
const min = 1000 * 60
const currentMinute = () => Math.floor((Date.now() % hr) / min)

type OwnProps = {|
  className?: string,
  conversationIDKey: Types.ConversationIDKey,
  onShowingEmojiPicker?: boolean => void,
  ordinal: Types.Ordinal,
  style?: StylesCrossPlatform,
|}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  _onReact: (emoji, conversationIDKey, ordinal) =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  className: ownProps.className,
  emojis: getEmojis(currentMinute()).slice(0, 5),
  onReact: emoji => dispatchProps._onReact(emoji, ownProps.conversationIDKey, ownProps.ordinal),
  onShowingEmojiPicker: ownProps.onShowingEmojiPicker,
  style: ownProps.style,
})

const ConnectedEmojiRow = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEmojiRow'
)(EmojiRow)

export default ConnectedEmojiRow
