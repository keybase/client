import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemTextType from './container'

const SystemText = React.memo(function SystemText(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemText') return null

  const {default: SystemText} = require('./container') as {default: typeof SystemTextType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemText text={message.text.stringValue()} />
    </WrapperMessage>
  )
})

export default SystemText
