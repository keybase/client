import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemJoinedType from './container'

const SystemJoined = React.memo(function SystemJoined(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemJoined') return null

  const SystemJoined = require('./container').default as typeof SystemJoinedType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemJoined message={message} />
    </WrapperMessage>
  )
})

export default SystemJoined
