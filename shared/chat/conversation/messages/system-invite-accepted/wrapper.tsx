import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemInviteAcceptedType from './container'

const WrapperSystemInvite = React.memo(function WrapperSystemInvite(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemInviteAccepted') return null

  const {default: SystemInviteAccepted} = require('./container') as {default: typeof SystemInviteAcceptedType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemInviteAccepted key="systemInviteAccepted" message={message} />
    </WrapperMessage>
  )
})

export default WrapperSystemInvite
