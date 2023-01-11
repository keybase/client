import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemLeftType from './container'

const SystemLeft = React.memo(function SystemLeft(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemLeft') return null

  const SystemLeft = require('./container').default as typeof SystemLeftType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemLeft message={message} />
    </WrapperMessage>
  )
})

export default SystemLeft
