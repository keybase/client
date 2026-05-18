import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemGitPush from './container'

function WrapperSystemGitPush(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemGitPush') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemGitPush message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemGitPush
