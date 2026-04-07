import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemJoinedType from './container'

function SystemJoined(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemJoined') return null

  const {default: SystemJoined} = require('./container') as {default: typeof SystemJoinedType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemJoined message={message} />
    </WrapperMessage>
  )
}

export default SystemJoined
