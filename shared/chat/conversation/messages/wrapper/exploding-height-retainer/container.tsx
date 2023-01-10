import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import ExplodingHeightRetainer from '.'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import shallowEqual from 'shallowequal'

type OwnProps = {
  children: React.ReactNode
}

const ExplodingHeightRetainerContainer = React.memo(function ExplodingHeightRetainerContainer(p: OwnProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {children} = p
  const {forceAsh, exploding, exploded, explodedBy, messageKey} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const forceAsh = !!m?.explodingUnreadable
    const exploding = !!m?.exploding
    const exploded = !!m?.exploded
    const explodedBy = m?.explodedBy
    const messageKey = m ? Constants.getMessageKey(m) : ''
    return {exploded, explodedBy, exploding, forceAsh, messageKey}
  }, shallowEqual)

  const retainHeight = forceAsh || exploded

  const props = {
    children,
    exploded,
    explodedBy,
    exploding,
    forceAsh,
    messageKey,
    retainHeight,
  }

  return <ExplodingHeightRetainer {...props} />
})

export default ExplodingHeightRetainerContainer
