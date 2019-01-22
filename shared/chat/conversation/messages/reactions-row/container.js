// @flow
import {namedConnect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import ReactionsRow from '.'

// Get array of emoji names in the order of their earliest reaction
const getOrderedReactions = (reactions: ?Types.Reactions) => {
  if (!reactions) {
    return []
  }
  const mins = reactions
    .map((value, key) => {
      return value.reduce((minTimestamp, reaction) => Math.min(minTimestamp, reaction.timestamp), Infinity)
    })
    .sort()
  return mins.keySeq().toArray()
}

export type OwnProps = {|
  btnClassName?: string,
  newBtnClassName?: string,
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
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
  emojis: getOrderedReactions(stateProps._reactions),
})

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'ReactionsRow')(
  ReactionsRow
)
