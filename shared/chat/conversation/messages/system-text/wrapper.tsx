import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type SystemTextType from './container'

function SystemText(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message?.type !== 'systemText') return null

  const {default: SystemText} = require('./container') as {default: typeof SystemTextType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemText text={message.text.stringValue()} />
    </WrapperMessage>
  )
}

export default SystemText
