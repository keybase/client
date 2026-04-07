import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemChangeAvatarType from '.'

function SystemChangeAvatar(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemChangeAvatar') return null

  const {default: SystemChangeAvatar} = require('.') as {default: typeof SystemChangeAvatarType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemChangeAvatar message={message} />
    </WrapperMessage>
  )
}

export default SystemChangeAvatar
