import * as C from '../../../../constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemUsersAddedToConvType from './container'

const SystemUsersAddedToConv = React.memo(function SystemUsersAddedToConv(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemUsersAddedToConversation') return null

  const SystemUsersAddedToConv = require('./container').default as typeof SystemUsersAddedToConvType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemUsersAddedToConv message={message} />
    </WrapperMessage>
  )
})

export default SystemUsersAddedToConv
