import {namedConnect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import ReactionsRow from '.'

// Get array of emoji names in the order of their earliest reaction
const getOrderedReactions = (reactions: Types.Reactions | null) => {
  if (!reactions) {
    return []
  }
  const mins = reactions
    .map(value =>
      value.reduce((minTimestamp, reaction) => Math.min(minTimestamp, reaction.timestamp), Infinity)
    )
    .sort()
  return mins.keySeq().toArray()
}

export type OwnProps = {
  btnClassName?: string
  newBtnClassName?: string
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
}

export default namedConnect(
  (state, ownProps: OwnProps) => {
    const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
    if (!message || !Constants.isDecoratedMessage(message)) {
      // nothing to see here
      return {_reactions: null}
    }
    return {
      _reactions: message.reactions,
    }
  },
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    ...ownProps,
    emojis: getOrderedReactions(stateProps._reactions),
  }),
  'ReactionsRow'
)(ReactionsRow)
