import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import {StylesCrossPlatform} from '../../../../../styles'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import EmojiRow from '.'

type OwnProps = {
  className?: string
  conversationIDKey: Types.ConversationIDKey
  onShowingEmojiPicker?: (arg0: boolean) => void
  ordinal: Types.Ordinal
  style?: StylesCrossPlatform
  tooltipPosition?: Position
}

const ConnectedEmojiRow = Container.namedConnect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
    return {
      _hasUnfurls: message && message.type === 'text' && message.unfurls && message.unfurls.size,
      _messageType: message ? message.type : undefined,
      topReacjis: state.chat2.userReacjis.topReacjis,
    }
  },
  dispatch => ({
    _onForward: (srcConvID: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {ordinal, srcConvID}, selected: 'chatForwardMsgPick'}],
        })
      ),
    _onReact: (emoji: string, conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
    _onReply: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    className: ownProps.className,
    conversationIDKey: ownProps.conversationIDKey,
    emojis: stateProps.topReacjis.slice(0, 5),
    onForward:
      (stateProps._messageType === 'text' && stateProps._hasUnfurls) ||
      stateProps._messageType === 'attachment'
        ? () => dispatchProps._onForward(ownProps.conversationIDKey, ownProps.ordinal)
        : undefined,
    onReact: (emoji: string) => dispatchProps._onReact(emoji, ownProps.conversationIDKey, ownProps.ordinal),
    onReply:
      stateProps._messageType === 'text' || stateProps._messageType === 'attachment'
        ? () => dispatchProps._onReply(ownProps.conversationIDKey, ownProps.ordinal)
        : undefined,
    onShowingEmojiPicker: ownProps.onShowingEmojiPicker,
    ordinal: ownProps.ordinal,
    style: ownProps.style,
    tooltipPosition: ownProps.tooltipPosition,
  }),
  'ConnectedEmojiRow'
)(EmojiRow)

export default ConnectedEmojiRow
