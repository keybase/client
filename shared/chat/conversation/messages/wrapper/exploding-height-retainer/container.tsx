import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import ExplodingHeightRetainer from '.'
import {useOrdinal} from '../../ids-context'

type OwnProps = {
  children: React.ReactElement
}

const ExplodingHeightRetainerContainer = React.memo(function ExplodingHeightRetainerContainer(p: OwnProps) {
  const ordinal = useOrdinal()
  const {children} = p
  const {forceAsh, exploding, exploded, explodedBy, messageKey} = Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const forceAsh = !!m?.explodingUnreadable
      const exploding = !!m?.exploding
      const exploded = !!m?.exploded
      const explodedBy = m?.explodedBy
      const messageKey = m ? Chat.getMessageKey(m) : ''
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
