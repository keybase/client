import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemJoinedType from './container'

const SystemJoined = React.memo(function SystemJoined(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemJoined') return null

  const {default: SystemJoined} = require('./container') as {default: typeof SystemJoinedType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemJoined message={message} />
    </WrapperMessage>
  )
})

export default SystemJoined
