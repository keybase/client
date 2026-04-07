import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemNewChannelType from './container'

function SystemNewChannel(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemNewChannel') return null

  const {default: SystemNewChannel} = require('./container') as {default: typeof SystemNewChannelType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemNewChannel message={message} />
    </WrapperMessage>
  )
}

export default SystemNewChannel
