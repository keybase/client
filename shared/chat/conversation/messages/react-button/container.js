// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ReactButton from '.'

export type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  emoji: string,
  ordinal: Types.Ordinal,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const me = state.config.username || ''
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || message.type === 'placeholder' || message.type === 'deleted') {
    return {
      active: false,
      count: 0,
      emoji: '',
    }
  }
  const reactions = message.reactions
  const reaction = reactions.find(r => r.emoji === ownProps.emoji)
  if (!reaction) {
    return {
      active: false,
      count: 0,
      emoji: '',
    }
  }
  const active = reaction.usernames.has(me)
  return {
    active,
    count: reaction.usernames.size,
    emoji: ownProps.emoji,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey, emoji, ordinal}: OwnProps) => ({
  onClick: () => dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal})),
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('ReactButton'))(
  ReactButton
)
