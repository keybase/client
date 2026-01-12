import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemChangeAvatarType from '.'

const SystemChangeAvatar = React.memo(function SystemChangeAvatar(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemChangeAvatar') return null

  const {default: SystemChangeAvatar} = require('.') as {default: typeof SystemChangeAvatarType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemChangeAvatar message={message} />
    </WrapperMessage>
  )
})

export default SystemChangeAvatar
