import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import ExplodingMeta from '.'
import type * as Types from '../../../../../constants/types/chat2'

export type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isParentHighlighted: boolean
  onClick?: () => void
  ordinal: Types.Ordinal
}

const ExplodingMetaContainer = React.memo(function ExplodingMetaContainer(p: OwnProps) {
  const {conversationIDKey, isParentHighlighted, onClick, ordinal} = p

  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  if (!message || (message.type !== 'text' && message.type !== 'attachment') || !message.exploding) {
    return null
  }
  const {exploded, submitState} = message
  const explodesAt = message.explodingTime
  const messageKey = Constants.getMessageKey(message)
  const pending = submitState === 'pending' || submitState === 'failed'
  const props = {
    exploded,
    explodesAt,
    isParentHighlighted,
    messageKey,
    onClick,
    pending,
  }
  return <ExplodingMeta {...props} />
})
export default ExplodingMetaContainer
