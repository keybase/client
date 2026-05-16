import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SetDescriptionType from '@/chat/conversation/messages/set-description/container'

function WrapperSetDescription(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'setDescription') return null

  const {default: SetDescriptionComponent} = require('./container') as {default: typeof SetDescriptionType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SetDescriptionComponent message={message} />
    </WrapperMessage>
  )
}

export default WrapperSetDescription
