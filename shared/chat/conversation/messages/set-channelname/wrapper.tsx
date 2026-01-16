import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetChannelnameType from './container'

const SetChannelname = React.memo(function SetChannelname(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'setChannelname') return null
  if (message.newChannelname === 'general') return null

  const {default: SetChannelname} = require('./container') as {default: typeof SetChannelnameType}
  return (
    <WrapperMessage {...p} {...common}>
      <SetChannelname message={message} />
    </WrapperMessage>
  )
})

export default SetChannelname
