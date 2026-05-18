import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemChangeAvatar from '.'

function WrapperSystemChangeAvatar(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemChangeAvatar') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemChangeAvatar message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemChangeAvatar
