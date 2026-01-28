import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemCreateTeamType from './container'

const SystemCreateTeam = React.memo(function SystemCreateTeam(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemCreateTeam') return null

  const {default: SystemCreateTeam} = require('./container') as {default: typeof SystemCreateTeamType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemCreateTeam message={message} />
    </WrapperMessage>
  )
})

export default SystemCreateTeam
