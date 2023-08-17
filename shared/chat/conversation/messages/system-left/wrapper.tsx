import * as C from '../../../../constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemLeftType from './container'

const SystemLeft = React.memo(function SystemLeft(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemLeft') return null

  const SystemLeft = require('./container').default as typeof SystemLeftType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemLeft />
    </WrapperMessage>
  )
})

export default SystemLeft
