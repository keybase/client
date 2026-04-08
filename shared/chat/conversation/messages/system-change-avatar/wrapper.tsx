import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type SystemChangeAvatarType from '.'

function SystemChangeAvatar(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message?.type !== 'systemChangeAvatar') return null

  const {default: SystemChangeAvatar} = require('.') as {default: typeof SystemChangeAvatarType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemChangeAvatar message={message} />
    </WrapperMessage>
  )
}

export default SystemChangeAvatar
