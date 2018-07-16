// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import ReactionsRow from '.'

export type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || message.type === 'placeholder' || message.type === 'deleted') {
    // nothing to see here
    return {_reactions: null}
  }
  return {
    _reactions: message.reactions,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  emojis: stateProps._reactions ? stateProps._reactions.map(r => r.emoji).toArray() : [],
})

export default compose(connect(mapStateToProps, null, mergeProps), setDisplayName('ReactionsRow'))(
  ReactionsRow
)
