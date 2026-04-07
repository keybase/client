import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemGitPushType from './container'

function SystemGitPush(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemGitPush') return null

  const {default: SystemGitPush} = require('./container') as {default: typeof SystemGitPushType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemGitPush message={message} />
    </WrapperMessage>
  )
}

export default SystemGitPush
