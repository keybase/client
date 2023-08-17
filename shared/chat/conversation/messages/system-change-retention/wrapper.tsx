import * as C from '../../../../constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemChangeRetentionType from './container'

const SystemChangeRetention = React.memo(function SystemChangeRetention(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemChangeRetention') return null

  const SystemChangeRetention = require('./container').default as typeof SystemChangeRetentionType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemChangeRetention message={message} />
    </WrapperMessage>
  )
})

export default SystemChangeRetention
