import * as React from 'react'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import ExplodingMeta from '.'

export type OwnProps = {
  onClick?: () => void
}

const ExplodingMetaContainer = React.memo(function ExplodingMetaContainer(p: OwnProps) {
  const {onClick} = p

  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

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
    messageKey,
    onClick,
    pending,
  }

  return <ExplodingMeta {...props} />
})
export default ExplodingMetaContainer
