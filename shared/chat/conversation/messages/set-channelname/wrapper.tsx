import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetChannelnameType from './container'

const SetChannelname = React.memo(function SetChannelname(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'setChannelname') return null
  if (message.newChannelname === 'general') return null

  const SetChannelname = require('./container').default as typeof SetChannelnameType
  return (
    <WrapperMessage {...p} {...common}>
      <SetChannelname message={message} />
    </WrapperMessage>
  )
})

export default SetChannelname
