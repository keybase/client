import * as C from '../../../../constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetChannelnameType from './container'

const SetChannelname = React.memo(function SetChannelname(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'setChannelname') return null
  if (message.newChannelname === 'general') return null

  const SetChannelname = require('./container').default as typeof SetChannelnameType
  return (
    <WrapperMessage {...p} {...common}>
      <SetChannelname message={message} />
    </WrapperMessage>
  )
})

export default SetChannelname
