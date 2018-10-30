// @flow
import * as React from 'react'
import {namedConnect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTree from '../../../../actions/route-tree'
import type {StylesCrossPlatform} from '../../../../styles'
import ReactButton, {NewReactionButton} from '.'

export type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  emoji?: string,
  onMouseLeave?: (evt: SyntheticEvent<Element>) => void,
  onMouseOver?: (evt: SyntheticEvent<Element>) => void,
  onLongPress?: () => void,
  onShowPicker?: (showing: boolean) => void,
  ordinal: Types.Ordinal,
  showBorder?: boolean,
  style?: StylesCrossPlatform,
|}

export type WrapperProps = {|
  ...OwnProps,
  active: boolean,
  count: number,
  emoji: string,
  onAddReaction: (emoji: string) => void,
  onClick: () => void,
  onOpenEmojiPicker: () => void,
|}

const Wrapper = (props: WrapperProps) =>
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

const noEmoji = {
  active: false,
  count: 0,
  emoji: '',
}

const mapStateToProps = (state, ownProps: OwnProps) => {
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
    emoji: ownProps.emoji || '',
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey, emoji, ordinal}: OwnProps) => ({
  onAddReaction: (emoji: string) =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
  onClick: () =>
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji: emoji || '', ordinal})),
  onOpenEmojiPicker: () =>
    dispatch(RouteTree.navigateAppend([{props: {conversationIDKey, ordinal}, selected: 'chooseEmoji'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  active: stateProps.active,
  conversationIDKey: ownProps.conversationIDKey,
  count: stateProps.count,
  emoji: stateProps.emoji,
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

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ReactButton')(Wrapper)
