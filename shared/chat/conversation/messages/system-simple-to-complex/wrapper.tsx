import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemSimpleToComplexType from './container'

const WrapperSystemSimpleToComplex = React.memo(function WrapperSystemSimpleToComplex(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemSimpleToComplex') return null

  const SystemSimpleToComplex = require('./container').default as typeof SystemSimpleToComplexType

  return (
    <WrapperMessage {...p} {...common}>
      <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
    </WrapperMessage>
  )
})

export default WrapperSystemSimpleToComplex
