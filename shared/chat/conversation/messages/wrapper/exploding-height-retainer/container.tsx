import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import ExplodingHeightRetainer from '.'
import type * as Types from '../../../../../constants/types/chat2'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
  children: React.ReactNode
  measure?: () => void
}

const ExplodingHeightRetainerContainer = React.memo(function ExplodingHeightRetainerContainer(p: OwnProps) {
  const {conversationIDKey, children, ordinal, measure} = p
  const forceAsh = Container.useSelector(
    state => !!Constants.getMessage(state, conversationIDKey, ordinal)?.explodingUnreadable
  )
  const exploding = Container.useSelector(
    state => !!Constants.getMessage(state, conversationIDKey, ordinal)?.exploding
  )
  const exploded = Container.useSelector(
    state => !!Constants.getMessage(state, conversationIDKey, ordinal)?.exploded
  )
  const explodedBy = Container.useSelector(
    state => Constants.getMessage(state, conversationIDKey, ordinal)?.explodedBy
  )

  const messageKey = Container.useSelector(state => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    return message ? Constants.getMessageKey(message) : ''
  })
  const retainHeight = forceAsh || exploded

  const props = {
    children,
    exploded,
    explodedBy,
    exploding,
    forceAsh,
    measure,
    messageKey,
    retainHeight,
  }

  return <ExplodingHeightRetainer {...props} />
})

export default ExplodingHeightRetainerContainer
