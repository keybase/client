import * as React from 'react'
import * as C from '@/constants'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemAddedToTeamType from './container'

const SystemAddedToTeam = React.memo(function SystemAddedToTeam(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemAddedToTeam') return null

  const {default: SystemAddedToTeam} = require('./container') as {default: typeof SystemAddedToTeamType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemAddedToTeam message={message} />
    </WrapperMessage>
  )
})

export default SystemAddedToTeam
