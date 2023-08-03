import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemCreateTeamType from './container'

const SystemCreateTeam = React.memo(function SystemCreateTeam(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Constants.useContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemCreateTeam') return null

  const SystemCreateTeam = require('./container').default as typeof SystemCreateTeamType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemCreateTeam message={message} />
    </WrapperMessage>
  )
})

export default SystemCreateTeam
