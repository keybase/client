import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PinType from '.'

const Pin = React.memo(function Pin(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'pin') return null

  const Pin = require('.').default as typeof PinType
  return (
    <WrapperMessage {...p} {...common}>
      <Pin conversationIDKey={message.conversationIDKey} messageID={message.pinnedMessageID} />
    </WrapperMessage>
  )
})

export default Pin
