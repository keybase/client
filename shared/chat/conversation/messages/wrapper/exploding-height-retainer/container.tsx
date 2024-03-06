import * as C from '@/constants'
import * as React from 'react'
import ExplodingHeightRetainer from '.'
import {OrdinalContext} from '../../ids-context'

type OwnProps = {
  children: React.ReactElement
}

const ExplodingHeightRetainerContainer = React.memo(function ExplodingHeightRetainerContainer(p: OwnProps) {
  const ordinal = React.useContext(OrdinalContext)
  const {children} = p
  const {forceAsh, exploding, exploded, explodedBy, messageKey} = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const forceAsh = !!m?.explodingUnreadable
      const exploding = !!m?.exploding
      const exploded = !!m?.exploded
      const explodedBy = m?.explodedBy
      const messageKey = m ? C.Chat.getMessageKey(m) : ''
      return {exploded, explodedBy, exploding, forceAsh, messageKey}
    })
  )

  const retainHeight = forceAsh || exploded

  const props = {
    children,
    exploded,
    explodedBy,
    exploding,
    messageKey,
    retainHeight,
  }

  return <ExplodingHeightRetainer {...props} />
})

export default ExplodingHeightRetainerContainer
