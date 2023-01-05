import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemChangeRetentionType from './container'

const SystemChangeRetention = React.memo(function SystemChangeRetention(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemChangeRetention') return null

  const SystemChangeRetention = require('./container').default as typeof SystemChangeRetentionType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemChangeRetention message={message} />
    </WrapperMessage>
  )
})

export default SystemChangeRetention
