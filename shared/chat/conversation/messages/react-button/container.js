// @flow
import * as React from 'react'
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ReactButton, {NewReactionButton} from '.'

export type WrapperProps = {
  active: boolean,
  conversationIDKey: Types.ConversationIDKey,
  count: number,
  emoji?: string,
  onAddReaction: (emoji: string) => void,
  onClick: () => void,
  onMouseLeave?: (evt: SyntheticEvent<Element>) => void,
  onMouseOver?: (evt: SyntheticEvent<Element>) => void,
  ordinal: Types.Ordinal,
  showBorder?: boolean,
}
const Wrapper = (props: WrapperProps) =>
  props.emoji ? <ReactButton {...props} /> : <NewReactionButton {...props} showBorder={!!props.showBorder} />

export type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  emoji?: string,
  onMouseLeave?: (evt: SyntheticEvent<Element>) => void,
  onMouseOver?: (evt: SyntheticEvent<Element>) => void,
  ordinal: Types.Ordinal,
  showBorder?: boolean,
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
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('ReactButton'))(Wrapper)
