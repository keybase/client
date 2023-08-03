import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemAddedToTeamType from './container'

const SystemAddedToTeam = React.memo(function SystemAddedToTeam(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Constants.useContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemAddedToTeam') return null

  const SystemAddedToTeam = require('./container').default as typeof SystemAddedToTeamType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemAddedToTeam message={message} />
    </WrapperMessage>
  )
})

export default SystemAddedToTeam
