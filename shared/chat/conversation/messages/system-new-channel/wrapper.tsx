import * as C from '@/constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemNewChannelType from './container'

const SystemNewChannel = React.memo(function SystemNewChannel(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemNewChannel') return null

  const {default: SystemNewChannel} = require('./container') as {default: typeof SystemNewChannelType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemNewChannel message={message} />
    </WrapperMessage>
  )
})

export default SystemNewChannel
