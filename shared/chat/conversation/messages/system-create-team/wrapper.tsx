import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemCreateTeamType from './container'

const SystemCreateTeam = React.memo(function SystemCreateTeam(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemCreateTeam') return null

  const SystemCreateTeam = require('./container').default as typeof SystemCreateTeamType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemCreateTeam message={message} />
    </WrapperMessage>
  )
})

export default SystemCreateTeam
