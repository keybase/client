import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import {OrdinalContext} from '../../ids-context'
import ExplodingMeta from '.'

export type OwnProps = {
  onClick?: () => void
}

const ExplodingMetaContainer = React.memo(function ExplodingMetaContainer(p: OwnProps) {
  const {onClick} = p

  const ordinal = React.useContext(OrdinalContext)

  const message = Constants.useContext(s => s.messageMap.get(ordinal))
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
