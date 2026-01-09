import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemUsersAddedToConvType from './container'

const SystemUsersAddedToConv = React.memo(function SystemUsersAddedToConv(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemUsersAddedToConversation') return null

  const {default: SystemUsersAddedToConv} = require('./container') as {
    default: typeof SystemUsersAddedToConvType
  }
  return (
    <WrapperMessage {...p} {...common}>
      <SystemUsersAddedToConv message={message} />
    </WrapperMessage>
  )
})

export default SystemUsersAddedToConv
