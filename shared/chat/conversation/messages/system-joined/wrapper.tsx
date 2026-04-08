import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type SystemJoinedType from './container'

function SystemJoined(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemJoined') return null

  const {default: SystemJoined} = require('./container') as {default: typeof SystemJoinedType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemJoined message={message} />
    </WrapperMessage>
  )
}

export default SystemJoined
