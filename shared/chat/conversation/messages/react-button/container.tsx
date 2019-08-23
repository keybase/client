import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {StylesCrossPlatform} from '../../../../styles'
import ReactButton, {NewReactionButton} from '.'

export type OwnProps = {
  className?: string
  conversationIDKey: Types.ConversationIDKey
  emoji?: string
  onMouseLeave?: (evt: React.SyntheticEvent) => void
  onMouseOver?: (evt: React.SyntheticEvent) => void
  getAttachmentRef?: () => React.Component<any> | null
  onLongPress?: () => void
  onShowPicker?: (showing: boolean) => void
  ordinal: Types.Ordinal
  showBorder?: boolean
  style?: StylesCrossPlatform
}

export type WrapperProps = {
  active: boolean
  count: number
  emoji: string
  onAddReaction: (emoji: string) => void
  onClick: () => void
  onOpenEmojiPicker: () => void
} & OwnProps

class Wrapper extends React.Component<WrapperProps> {
  render() {
    const props = this.props
    return props.emoji ? (
      <ReactButton
        active={props.active}
        className={props.className}
        conversationIDKey={props.conversationIDKey}
        count={props.count}
        getAttachmentRef={props.getAttachmentRef}
        emoji={props.emoji}
        onClick={props.onClick}
        onLongPress={props.onLongPress}
        onMouseLeave={props.onMouseLeave}
        onMouseOver={props.onMouseOver}
        ordinal={props.ordinal}
        style={props.style}
      />
    ) : (
      <NewReactionButton
        getAttachmentRef={props.getAttachmentRef}
        onAddReaction={props.onAddReaction}
        onLongPress={props.onLongPress}
        onOpenEmojiPicker={props.onOpenEmojiPicker}
        onShowPicker={props.onShowPicker}
        showBorder={props.showBorder || false}
        style={props.style}
      />
    )
  }
}

const noEmoji = {
  active: false,
  count: 0,
  emoji: '',
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const me = state.config.username || ''
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || !Constants.isDecoratedMessage(message)) {
    return noEmoji
  }
  const reaction = message.reactions.get(ownProps.emoji || '')
  if (!reaction) {
    return noEmoji
  }
  const active = reaction.some(r => r.username === me)
  return {
    active,
    count: reaction.size,
    emoji: ownProps.emoji || '',
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey, emoji, ordinal}: OwnProps) => ({
  onAddReaction: (emoji: string) =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
  onClick: () =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji: emoji || '', ordinal})),
  onOpenEmojiPicker: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, ordinal}, selected: 'chatChooseEmoji'}],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  active: stateProps.active,
  className: ownProps.className,
  conversationIDKey: ownProps.conversationIDKey,
  count: stateProps.count,
  emoji: stateProps.emoji,
  getAttachmentRef: ownProps.getAttachmentRef,
  onAddReaction: dispatchProps.onAddReaction,
  onClick: dispatchProps.onClick,
  onLongPress: ownProps.onLongPress,
  onMouseLeave: ownProps.onMouseLeave,
  onMouseOver: ownProps.onMouseOver,
  onOpenEmojiPicker: dispatchProps.onOpenEmojiPicker,
  onShowPicker: ownProps.onShowPicker,
  ordinal: ownProps.ordinal,
  showBorder: ownProps.showBorder,
  style: ownProps.style,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ReactButton', {
  forwardRef: true,
})(Wrapper)
