import * as C from '../../../../constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PinType from '.'

const Pin = React.memo(function Pin(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'pin') return null

  const Pin = require('.').default as typeof PinType
  return (
    <WrapperMessage {...p} {...common}>
      <Pin messageID={message.pinnedMessageID} />
    </WrapperMessage>
  )
})

export default Pin
