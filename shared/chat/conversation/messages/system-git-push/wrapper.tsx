import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemGitPushType from '@/chat/conversation/messages/system-git-push/container'

function SystemGitPush(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemGitPush') return null

  const {default: SystemGitPush} = require('./container') as {default: typeof SystemGitPushType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemGitPush message={message} />
    </WrapperMessage>
  )
}

export default SystemGitPush
