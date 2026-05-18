import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemNewChannel from './container'

function WrapperSystemNewChannel(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemNewChannel') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemNewChannel message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemNewChannel
