import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemTextType from './container'

const SystemText = React.memo(function SystemText(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemText') return null

  const SystemText = require('./container').default as typeof SystemTextType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemText message={message} />
    </WrapperMessage>
  )
})

export default SystemText
