import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemNewChannelType from './container'

const SystemNewChannel = React.memo(function SystemNewChannel(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemNewChannel') return null

  const SystemNewChannel = require('./container').default as typeof SystemNewChannelType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemNewChannel message={message} />
    </WrapperMessage>
  )
})

export default SystemNewChannel
