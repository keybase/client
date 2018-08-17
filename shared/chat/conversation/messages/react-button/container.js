// @flow
import * as React from 'react'
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTree from '../../../../actions/route-tree'
import type {StylesCrossPlatform} from '../../../../styles'
import ReactButton, {NewReactionButton, type Props, type NewReactionButtonProps} from '.'

const Wrapper = (props) =>
  props.emoji ? (
    <ReactButton
      active={props.active}
      conversationIDKey={props.conversationIDKey}
      count={props.count}
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
      onAddReaction={props.onAddReaction}
      onLongPress={props.onLongPress}
      onOpenEmojiPicker={props.onOpenEmojiPicker}
      onShowPicker={props.onShowPicker}
      showBorder={props.showBorder || false}
      style={props.style}
    />
  )

export type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  emoji?: string,
  onMouseLeave?: (evt: SyntheticEvent<Element>) => void,
  onMouseOver?: (evt: SyntheticEvent<Element>) => void,
  onLongPress?: () => void,
  onShowPicker?: (showing: boolean) => void,
  ordinal: Types.Ordinal,
  showBorder?: boolean,
  style?: StylesCrossPlatform,
}

const noEmoji = {
  active: false,
  count: 0,
  emoji: '',
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const me = state.config.username || ''
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || message.type === 'placeholder' || message.type === 'deleted') {
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
    emoji: ownProps.emoji,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey, emoji, ordinal}: OwnProps) => ({
  onAddReaction: (emoji: string) =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
  onClick: () =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji: emoji || '', ordinal})),
  onOpenEmojiPicker: () =>
    dispatch(RouteTree.navigateAppend([{props: {conversationIDKey, ordinal}, selected: 'chooseEmoji'}])),
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('ReactButton'))(Wrapper)
