import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import ReactionsRow from '.'
import {ConvoIDContext, OrdinalContext} from '../ids-context'

// Get array of emoji names in the order of their earliest reaction
const getOrderedReactions = (reactions: Types.Reactions | null) => {
  if (!reactions) {
    return []
  }

  const scoreMap = new Map(
    [...reactions.entries()].map(([key, value]) => {
      return [
        key,
        [...value.users].reduce(
          (minTimestamp, reaction) => Math.min(minTimestamp, reaction.timestamp),
          Infinity
        ),
      ]
    })
  )
  return [...reactions.keys()].sort((a, b) => scoreMap.get(a)! - scoreMap.get(b)!)
}

export type OwnProps = {
  btnClassName?: string
  newBtnClassName?: string
}

const ReactonsRowContainer = React.memo(function ReactonsRowContainer(p: OwnProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const reactions = !message || !Constants.isMessageWithReactions(message) ? null : message.reactions

  const emojis = React.useMemo(() => {
    return getOrderedReactions(reactions)
  }, [reactions])

  const props = {
    ...p,
    conversationIDKey,
    emojis,
    ordinal,
  }

  return <ReactionsRow {...props} />
})

export default ReactonsRowContainer
