import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemAddedToTeamType from './container'

const SystemAddedToTeam = React.memo(function SystemAddedToTeam(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemAddedToTeam') return null

  const SystemAddedToTeam = require('./container').default as typeof SystemAddedToTeamType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemAddedToTeam message={message} />
    </WrapperMessage>
  )
})

export default SystemAddedToTeam
