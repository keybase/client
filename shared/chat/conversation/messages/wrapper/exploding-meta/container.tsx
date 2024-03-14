import * as C from '@/constants'
import * as React from 'react'
import {OrdinalContext} from '../../ids-context'
import ExplodingMeta from '.'

export type OwnProps = {
  onClick?: () => void
}

const ExplodingMetaContainer = React.memo(function ExplodingMetaContainer(p: OwnProps) {
  const {onClick} = p

  const ordinal = React.useContext(OrdinalContext)

  const {exploding, exploded, submitState, explodesAt, messageKey} = C.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      if (!message || (message.type !== 'text' && message.type !== 'attachment') || !message.exploding) {
        return {
          exploded: false,
          explodesAt: 0,
          exploding: false,
          messageKey: '',
          submitState: '',
        }
      }
      const messageKey = C.Chat.getMessageKey(message)
      const {exploding, exploded, submitState, explodingTime: explodesAt} = message
      return {
        exploded,
        explodesAt,
        exploding,
        messageKey,
        submitState,
      }
    })
  )
  if (!exploding) {
    return null
  }
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
