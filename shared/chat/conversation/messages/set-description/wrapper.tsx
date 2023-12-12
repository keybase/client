import * as C from '@/constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetDescriptionType from './container'

const SetDescription = React.memo(function SetDescription(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'setDescription') return null

  const {default: SetDescription} = require('./container') as {default: typeof SetDescriptionType}
  return (
    <WrapperMessage {...p} {...common}>
      <SetDescription message={message} />
    </WrapperMessage>
  )
})

export default SetDescription
