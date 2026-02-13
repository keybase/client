import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PinType from '.'

const Pin = React.memo(function Pin(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'pin') return null

  const {default: Pin} = require('.') as {default: typeof PinType}
  return (
    <WrapperMessage {...p} {...common}>
      <Pin messageID={message.pinnedMessageID} />
    </WrapperMessage>
  )
})

export default Pin
